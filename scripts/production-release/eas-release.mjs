#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertReleaseTransaction } from "./release-transaction.mjs";

const TERMINAL_STATUSES = new Set(["ERRORED", "CANCELED"]);

function upper(value) {
  return String(value ?? "").toUpperCase();
}

function normalizedTrack(value) {
  return String(value ?? "").toLowerCase();
}

export function sanitizeEasError(value) {
  const source = typeof value === "string"
    ? value
    : value?.message ?? value?.error?.message ?? value?.errorMessage ?? "";
  const sanitized = String(source)
    .replace(/(?:(?:google\s+)?service|expo|eas|google)[-_ ]?(?:token|key|secret)\s*[:=]\s*\S+/gi, "[credencial saneada]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);
  return sanitized || null;
}

export function selectAdoptableBuild(builds, expected) {
  if (!Array.isArray(builds)) throw new Error("eas build:list no devolvió un array.");
  const matches = builds.filter((build) =>
    build?.buildProfile === expected.profile
    && build?.appVersion === expected.version
    && build?.gitCommitHash === expected.commit
    && build?.message === expected.message
    && (!build?.platform || upper(build.platform) === "ANDROID"));
  if (matches.length > 1) {
    throw new Error(`Hay ${matches.length} builds EAS para la misma pata e intento; no es seguro elegir uno.`);
  }
  return matches[0] ?? null;
}

export function selectAdoptableSubmission(submissions, expected) {
  if (!Array.isArray(submissions)) throw new Error("eas submit:list no devolvió un array.");
  const matches = submissions.filter((submission) =>
    submission?.submittedBuild?.id === expected.buildId
    && normalizedTrack(submission?.androidConfig?.track) === normalizedTrack(expected.track)
    && normalizedTrack(submission?.androidConfig?.releaseStatus) === normalizedTrack(expected.releaseStatus));
  if (matches.length > 1) {
    const live = matches.filter((submission) => !TERMINAL_STATUSES.has(upper(submission.status)));
    if (live.length === 1) return live[0];
    throw new Error(`Hay ${matches.length} submissions EAS para el mismo AAB y track; no es seguro elegir uno.`);
  }
  return matches[0] ?? null;
}

export function createPlayEvidence({ transaction, submission, observedAt = new Date().toISOString() }) {
  assertReleaseTransaction(transaction, { allowLegacy: false });
  const play = transaction.legs.play;
  const attempt = play.attempts.at(-1);
  const status = upper(submission?.status);
  const error = sanitizeEasError(submission);
  const violations = [];
  if (submission?.id !== attempt?.submissionId) violations.push("submission-id");
  if (submission?.submittedBuild?.id !== play.buildId) violations.push("build-id");
  if (normalizedTrack(submission?.androidConfig?.track) !== play.track) violations.push("track");
  if (normalizedTrack(submission?.androidConfig?.releaseStatus) !== play.releaseStatus) violations.push("release-status");
  if (status !== "FINISHED") violations.push("status");
  return {
    schemaVersion: 1,
    kind: "ProductionPlayEvidenceV1",
    result: violations.length === 0 ? "passed" : "failed",
    observedAt,
    provider: play.provider,
    profile: play.profile,
    track: play.track,
    releaseStatus: play.releaseStatus,
    buildId: play.buildId,
    submissionId: attempt?.submissionId ?? null,
    status,
    versionName: transaction.version,
    versionCode: transaction.legs.aab.artifact?.versionCode ?? null,
    error,
    violations,
  };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Argumento inválido: ${key}.`);
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function writeJson(path, value) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === "select-build") {
    return writeJson(options.output, selectAdoptableBuild(readJson(options.input), {
      profile: options.profile,
      version: options.version,
      commit: options.commit,
      message: options.message,
    }));
  }
  if (command === "select-submission") {
    return writeJson(options.output, selectAdoptableSubmission(readJson(options.input), {
      buildId: options["build-id"],
      track: options.track,
      releaseStatus: options["release-status"],
    }));
  }
  if (command === "play-evidence") {
    const evidence = createPlayEvidence({
      transaction: readJson(options.transaction),
      submission: readJson(options.submission),
    });
    writeJson(options.output, evidence);
    if (evidence.result !== "passed") {
      throw new Error(`La submission no cumple el contrato: ${evidence.violations.join(", ")}.`);
    }
    return;
  }
  throw new Error("Uso: eas-release.mjs select-build|select-submission|play-evidence ...");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
