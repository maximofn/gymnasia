#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  PRODUCTION_GATES,
  commandLabel,
  evaluateSourceCandidate,
  loadReleasePolicy,
  repositoryRoot,
} from "./production-release.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Uso: verify-source.mjs --profile production|production-apk --artifact-type aab|apk --output RUTA");
    }
    options[key.slice(2)] = value;
  }
  if (!options.profile || !options["artifact-type"] || !options.output) {
    throw new Error("Faltan --profile, --artifact-type o --output.");
  }
  return options;
}

function run(command, args, { inherit = false, allowFailure = false, environment = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...environment },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${commandLabel(command, args)} terminó con código ${result.status}.`);
  }
  return result;
}

function stdout(command, args) {
  return run(command, args).stdout.trim();
}

function repositoryFromRemote(remoteUrl) {
  return remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? "";
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "gymnasia-production-release-verifier",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubJson(repository, path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: githubHeaders(),
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path} devolvió HTTP ${response.status}.`);
  }
  return response.json();
}

async function readRemoteControls(policy, checkedOutSha) {
  const summaries = await githubJson(policy.repository, "/rulesets");
  const matching = summaries.find((ruleset) => ruleset.name === policy.rulesetName);
  const ruleset = matching
    ? await githubJson(policy.repository, `/rulesets/${matching.id}`)
    : null;
  const environments = await githubJson(policy.repository, "/environments");
  const productionEnvironment = environments.environments
    ?.find((environment) => environment.name === policy.environment) ?? null;
  const associatedPulls = await githubJson(policy.repository, `/commits/${checkedOutSha}/pulls`);
  const pullRequest = associatedPulls.find((pull) =>
    pull.merged_at && pull.base?.ref === policy.productionBranch) ?? null;
  let statuses = [];
  let checkRuns = [];
  if (pullRequest?.head?.sha) {
    const combinedStatus = await githubJson(
      policy.repository,
      `/commits/${pullRequest.head.sha}/status`,
    );
    const checks = await githubJson(policy.repository, `/commits/${pullRequest.head.sha}/check-runs`);
    statuses = combinedStatus.statuses ?? [];
    checkRuns = checks.check_runs ?? [];
  }
  return {
    rulesets: ruleset ? [ruleset] : [],
    productionEnvironment,
    pullRequest,
    statuses,
    checkRuns,
  };
}

function writeEvidence(path, evidence) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function runProductionGates() {
  const results = [];
  for (const [command, args, environment = {}] of PRODUCTION_GATES) {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const result = run(command, args, { inherit: true, allowFailure: true, environment });
    const evidence = {
      command: commandLabel(command, args, environment),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      result: result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
    };
    results.push(evidence);
    if (result.status !== 0) break;
  }
  return results;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const policy = loadReleasePolicy();
  const checkedOutSha = stdout("git", ["rev-parse", "HEAD"]);
  const originRepository = repositoryFromRemote(stdout("git", ["remote", "get-url", "origin"]));
  const status = stdout("git", ["status", "--porcelain", "--untracked-files=all"]);
  run("git", ["fetch", "--quiet", "--no-tags", "origin", policy.productionBranch]);
  const reachability = run(
    "git",
    ["merge-base", "--is-ancestor", checkedOutSha, `refs/remotes/origin/${policy.productionBranch}`],
    { allowFailure: true },
  );
  const remote = await readRemoteControls(policy, checkedOutSha);
  const evaluated = evaluateSourceCandidate({
    policy,
    profile: options.profile,
    artifactType: options["artifact-type"],
    ref: process.env.GITHUB_REF ?? "",
    headSha: process.env.GITHUB_SHA ?? "",
    checkedOutSha,
    originRepository,
    clean: status === "",
    reachableFromProduction: reachability.status === 0,
    ...remote,
  });

  const evidence = {
    schemaVersion: 1,
    kind: "ProductionSourceEvidenceV1",
    repository: policy.repository,
    commit: checkedOutSha,
    ref: process.env.GITHUB_REF || `refs/remotes/origin/${policy.productionBranch}`,
    profile: options.profile,
    artifactType: options["artifact-type"],
    auditedAt: new Date().toISOString(),
    source: {
      clean: status === "",
      reachableFromProduction: reachability.status === 0,
      originRepository,
    },
    remoteControls: {
      rulesetId: evaluated.ruleset?.id ?? null,
      rulesetName: evaluated.ruleset?.name ?? null,
      rulesetEnforcement: evaluated.ruleset?.enforcement ?? null,
      bypassActors: evaluated.ruleset?.bypass_actors ?? [],
      environment: remote.productionEnvironment?.name ?? null,
      protectedBranchesOnly:
        remote.productionEnvironment?.deployment_branch_policy?.protected_branches === true,
      ownerReviewer: policy.owner,
      preventSelfReview: remote.productionEnvironment?.protection_rules
        ?.find((rule) => rule.type === "required_reviewers")?.prevent_self_review ?? null,
      pullRequest: remote.pullRequest ? {
        number: remote.pullRequest.number,
        url: remote.pullRequest.html_url,
        author: remote.pullRequest.user?.login ?? null,
        headSha: remote.pullRequest.head?.sha ?? null,
        mergedAt: remote.pullRequest.merged_at,
      } : null,
      requiredStatuses: policy.requiredStatusChecks.map((context) => ({
        context,
        result: context === "prompt-policy"
          ? remote.checkRuns.some((check) => check.name === context && check.conclusion === "success")
          : remote.statuses.some((status) => status.context === context && status.state === "success"),
      })),
    },
    contractViolations: evaluated.violations,
    gates: [],
    result: "failed",
  };

  if (evaluated.violations.length === 0) {
    evidence.gates = runProductionGates();
    const statusAfterGates = stdout("git", ["status", "--porcelain", "--untracked-files=all"]);
    evidence.source.cleanAfterGates = statusAfterGates === "";
    if (statusAfterGates !== "") {
      evidence.contractViolations.push({
        code: "gate-mutation",
        message: "Los gates modificaron el checkout; el binario ya no correspondería al SHA validado.",
      });
    }
    evidence.result = evidence.gates.length === PRODUCTION_GATES.length
      && evidence.gates.every((gate) => gate.result === "passed")
      && evidence.source.cleanAfterGates
      ? "passed"
      : "failed";
  }
  writeEvidence(options.output, evidence);
  if (evidence.result !== "passed") {
    for (const violation of evidence.contractViolations) {
      console.error(`[${violation.code}] ${violation.message}`);
    }
    throw new Error(`La fuente de Production no es publicable. Evidencia: ${resolve(options.output)}`);
  }
  console.log(`Fuente Production verificada: ${checkedOutSha}. Evidencia: ${resolve(options.output)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
