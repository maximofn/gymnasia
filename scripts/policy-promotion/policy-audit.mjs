#!/usr/bin/env node
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const POLICY_AUDIT_TASK = "gymnasia-policy-audit";
export const POLICY_AUDIT_SCHEMA_VERSION = 1;
export const POLICY_REASON_CODES = Object.freeze([
  "routine-release",
  "critical-policy-fix",
  "incident-response",
  "rollback-drill",
]);

const CANDIDATE_PATTERN = /^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ACTIVATION_ID_PATTERN = /^activation-[a-f0-9]{32}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9-]{1,39}$/;

function safeCandidate(value) {
  return CANDIDATE_PATTERN.test(value || "") ? value : null;
}

function safeCommit(value, fallback) {
  if (COMMIT_PATTERN.test(value || "")) return value;
  if (COMMIT_PATTERN.test(fallback || "")) return fallback;
  throw new Error("policy-audit-source-commit");
}

function safeActor(value) {
  return ACTOR_PATTERN.test(value || "") ? value : "unknown";
}

function parseActivation(base64) {
  if (!base64 || base64.length > 64 * 1024) return null;
  try {
    const value = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    const keys = Object.keys(value).sort();
    const expected = [
      "action",
      "bundleId",
      "bundleSha256",
      "channel",
      "critical",
      "fromBundleId",
      "id",
      "issuedAt",
      "schemaVersion",
      "sequence",
    ].sort();
    if (
      keys.length !== expected.length
      || !keys.every((key, index) => key === expected[index])
      || value.schemaVersion !== 1
      || !ACTIVATION_ID_PATTERN.test(value.id || "")
      || !["activate", "rollback"].includes(value.action)
      || !["Staging", "Production"].includes(value.channel)
      || !CANDIDATE_PATTERN.test(value.bundleId || "")
      || !SHA256_PATTERN.test(value.bundleSha256 || "")
      || typeof value.critical !== "boolean"
      || !Number.isSafeInteger(value.sequence)
      || value.sequence < 1
      || !Number.isFinite(Date.parse(value.issuedAt))
      || (value.fromBundleId !== null && !CANDIDATE_PATTERN.test(value.fromBundleId || ""))
      || (value.action === "rollback") !== (value.fromBundleId !== null)
    ) {
      return null;
    }
    return {
      action: value.action,
      bundleId: value.bundleId,
      bundleSha256: value.bundleSha256,
      channel: value.channel,
      critical: value.critical,
      fromBundleId: value.fromBundleId,
      id: value.id,
      issuedAt: value.issuedAt,
      sequence: value.sequence,
    };
  } catch {
    return null;
  }
}

function normalizedJobResult(value) {
  return ["success", "failure", "cancelled", "skipped"].includes(value)
    ? value
    : "unknown";
}

function resultForJobs(validation, publication) {
  if (validation === "success" && publication === "success") return "success";
  if (validation === "failure" || validation === "cancelled") return "rejected";
  return "failed";
}

function operationName(value) {
  if (value === "staging") return "publish";
  return value === "rollback" ? "rollback" : "promote";
}

function stableEventId({ activation, environment, operation, outcome, reasonCode, workflowRunUrl }) {
  const seed = [
    activation?.id ?? workflowRunUrl,
    environment,
    operation,
    outcome,
    reasonCode,
  ].join("|");
  return `policy-audit-${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

export function buildPolicyOperationAudit({
  activationBase64,
  actor,
  candidate,
  fallbackCommit,
  operation: rawOperation,
  publicationResult,
  reasonCode,
  sourceCommit,
  validationResult,
  workflowRunUrl,
  occurredAt = new Date().toISOString(),
}) {
  if (!["staging", "production", "rollback"].includes(rawOperation)) {
    throw new Error("policy-audit-operation");
  }
  if (!POLICY_REASON_CODES.includes(reasonCode)) throw new Error("policy-audit-reason-code");
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+$/.test(workflowRunUrl || "")) {
    throw new Error("policy-audit-workflow-url");
  }
  const validation = normalizedJobResult(validationResult);
  const publication = normalizedJobResult(publicationResult);
  const outcome = resultForJobs(validation, publication);
  const operation = operationName(rawOperation);
  const environment = rawOperation === "staging" ? "Staging" : "Production";
  const activation = parseActivation(activationBase64);
  const allowedCandidate = safeCandidate(candidate);
  const audit = {
    schemaVersion: POLICY_AUDIT_SCHEMA_VERSION,
    eventId: stableEventId({
      activation,
      environment,
      operation,
      outcome,
      reasonCode,
      workflowRunUrl,
    }),
    operation,
    outcome,
    environment,
    sourceCommit: safeCommit(sourceCommit, fallbackCommit),
    bundle: allowedCandidate && activation?.bundleId === allowedCandidate
      ? { candidate: allowedCandidate, sha256: activation.bundleSha256 }
      : null,
    actor: safeActor(actor),
    reasonCode,
    checks: { validation, publication },
    activation,
    links: {
      releaseUrl: allowedCandidate
        ? `https://github.com/maximofn/gymnasia/releases/tag/${allowedCandidate}`
        : null,
      workflowRunUrl,
    },
    occurredAt,
    telegram: { status: "pending", errorCode: null },
  };
  return audit;
}

export function formatTelegramMessage(audit) {
  const bundle = audit.bundle?.candidate ?? "sin candidato verificado";
  const sequence = audit.activation?.sequence ?? "n/d";
  return [
    `Gymnasia policy · ${audit.outcome.toUpperCase()}`,
    `${audit.operation} · ${audit.environment}`,
    `Bundle: ${bundle}`,
    `Hash: ${audit.bundle?.sha256.slice(0, 12) ?? "n/d"} · Commit: ${audit.sourceCommit.slice(0, 12)}`,
    `Secuencia: ${sequence} · Motivo: ${audit.reasonCode}`,
    `Actor: ${audit.actor}`,
    `Evento: ${audit.eventId}`,
    audit.links.workflowRunUrl,
  ].join("\n");
}

async function githubJson(fetchImpl, token, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`policy-audit-github-${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function alreadySent(fetchImpl, token, repository, audit) {
  const url = `https://api.github.com/repos/${repository}/deployments?environment=${audit.environment}`
    + `&task=${POLICY_AUDIT_TASK}&per_page=100`;
  const deployments = await githubJson(fetchImpl, token, url);
  return Array.isArray(deployments) && deployments.some((deployment) => {
    let payload = deployment?.payload;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { return false; }
    }
    return payload?.schemaVersion === POLICY_AUDIT_SCHEMA_VERSION
      && payload?.eventId === audit.eventId
      && payload?.telegram?.status === "sent";
  });
}

async function notifyTelegram(fetchImpl, audit, botToken, chatId, skipBecauseSent) {
  if (skipBecauseSent) return { status: "duplicate", errorCode: null };
  if (!botToken || !chatId) return { status: "skipped", errorCode: "missing-config" };
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        disable_web_page_preview: true,
        text: formatTelegramMessage(audit),
      }),
    });
    if (!response.ok) return { status: "failed", errorCode: "http-error" };
    const value = await response.json().catch(() => null);
    return value?.ok === true
      ? { status: "sent", errorCode: null }
      : { status: "failed", errorCode: "api-rejected" };
  } catch {
    return { status: "failed", errorCode: "network-error" };
  }
}

async function createAuditDeployment(fetchImpl, token, repository, audit) {
  const deployment = await githubJson(
    fetchImpl,
    token,
    `https://api.github.com/repos/${repository}/deployments`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: audit.sourceCommit,
        task: POLICY_AUDIT_TASK,
        environment: audit.environment,
        auto_merge: false,
        required_contexts: [],
        payload: audit,
      }),
    },
  );
  const deploymentId = deployment?.id;
  if (!Number.isSafeInteger(deploymentId)) throw new Error("policy-audit-deployment-id");
  await githubJson(
    fetchImpl,
    token,
    `https://api.github.com/repos/${repository}/deployments/${deploymentId}/statuses`,
    {
      method: "POST",
      body: JSON.stringify({
        auto_inactive: false,
        state: audit.outcome === "success" ? "success" : "failure",
        environment: audit.environment,
        log_url: audit.links.workflowRunUrl,
        description: `Policy ${audit.operation} ${audit.outcome} (${audit.eventId.slice(-8)})`,
      }),
    },
  );
  return deploymentId;
}

export async function runPolicyAudit({
  audit,
  botToken,
  chatId,
  fetchImpl = fetch,
  githubToken,
  repository,
}) {
  if (!githubToken) throw new Error("policy-audit-github-token");
  const duplicate = await alreadySent(fetchImpl, githubToken, repository, audit);
  audit.telegram = await notifyTelegram(fetchImpl, audit, botToken, chatId, duplicate);
  const deploymentId = await createAuditDeployment(fetchImpl, githubToken, repository, audit);
  return { audit, deploymentId };
}

async function main() {
  const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const audit = buildPolicyOperationAudit({
    activationBase64: process.env.POLICY_ACTIVATION_BASE64,
    actor: process.env.GITHUB_ACTOR,
    candidate: process.env.POLICY_CANDIDATE,
    fallbackCommit: process.env.GITHUB_SHA,
    operation: process.env.POLICY_OPERATION,
    publicationResult: process.env.POLICY_PUBLICATION_RESULT,
    reasonCode: process.env.POLICY_REASON_CODE,
    sourceCommit: process.env.POLICY_SOURCE_COMMIT,
    validationResult: process.env.POLICY_VALIDATION_RESULT,
    workflowRunUrl: runUrl,
  });
  const result = await runPolicyAudit({
    audit,
    botToken: process.env.POLICY_TELEGRAM_BOT_TOKEN,
    chatId: process.env.POLICY_TELEGRAM_CHAT_ID,
    githubToken: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  });
  const summary = [
    "## Policy operation audit",
    `- Event: \`${result.audit.eventId}\``,
    `- Result: \`${result.audit.outcome}\``,
    `- Telegram: \`${result.audit.telegram.status}\` (${result.audit.telegram.errorCode ?? "ok"})`,
    `- Audit deployment: \`${result.deploymentId}\``,
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!["sent", "duplicate"].includes(result.audit.telegram.status)) {
    console.warn(
      `::warning title=Policy Telegram notification::${result.audit.telegram.status}`
      + ` (${result.audit.telegram.errorCode ?? "unknown"}); policy result is unchanged`,
    );
  }
  console.log(`${result.audit.eventId}: audit=${result.deploymentId} telegram=${result.audit.telegram.status}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "policy-audit-failed");
    process.exitCode = 1;
  });
}
