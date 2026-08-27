import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPolicyOperationAudit,
  formatTelegramMessage,
  POLICY_AUDIT_TASK,
  runPolicyAudit,
} from "./policy-audit.mjs";

const COMMIT = "a".repeat(40);
const CANDIDATE = "policy-v2026.08.3-bbbbbbbbbbbb";
const ACTIVATION = {
  action: "rollback",
  bundleId: CANDIDATE,
  bundleSha256: "c".repeat(64),
  channel: "Production",
  critical: false,
  fromBundleId: "policy-v2026.08.4-dddddddddddd",
  id: "activation-11111111111111111111111111111111",
  issuedAt: "2026-08-26T10:00:00.000Z",
  schemaVersion: 1,
  sequence: 7,
};

function audit(overrides = {}) {
  return buildPolicyOperationAudit({
    activationBase64: Buffer.from(JSON.stringify(ACTIVATION)).toString("base64"),
    actor: "maximofn",
    candidate: CANDIDATE,
    fallbackCommit: COMMIT,
    operation: "rollback",
    publicationResult: "success",
    reasonCode: "rollback-drill",
    sourceCommit: COMMIT,
    validationResult: "success",
    workflowRunUrl: "https://github.com/maximofn/gymnasia/actions/runs/123",
    occurredAt: "2026-08-26T10:01:00.000Z",
    ...overrides,
  });
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("PolicyOperationAuditV1 usa una allowlist exacta sin contenido sensible", () => {
  const value = audit();
  assert.deepEqual(Object.keys(value).sort(), [
    "activation",
    "actor",
    "bundle",
    "checks",
    "environment",
    "eventId",
    "links",
    "occurredAt",
    "operation",
    "outcome",
    "reasonCode",
    "schemaVersion",
    "sourceCommit",
    "telegram",
  ].sort());
  assert.deepEqual(Object.keys(value.activation).sort(), [
    "action",
    "bundleId",
    "bundleSha256",
    "channel",
    "critical",
    "fromBundleId",
    "id",
    "issuedAt",
    "sequence",
  ].sort());
  assert.deepEqual(Object.keys(value.bundle).sort(), ["candidate", "sha256"]);
  assert.deepEqual(Object.keys(value.checks).sort(), ["publication", "validation"]);
  assert.deepEqual(Object.keys(value.links).sort(), ["releaseUrl", "workflowRunUrl"]);
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "prompt",
    "message",
    "api_key",
    "token",
    "input",
    "output",
    "health_data",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("el mensaje Telegram solo contiene metadatos permitidos e identificador estable", () => {
  const first = audit();
  const second = audit({ occurredAt: "2026-08-26T10:05:00.000Z" });
  assert.equal(first.eventId, second.eventId);
  const message = formatTelegramMessage(first);
  assert.match(message, new RegExp(first.eventId));
  assert.match(message, /ROLLBACK|rollback/);
  assert.doesNotMatch(message, /prompt|api.?key|token|USER_TEXT/i);
});

test("los rechazos sin activación se deduplican por workflow, no entre operaciones distintas", () => {
  const first = audit({
    activationBase64: "invalid",
    publicationResult: "skipped",
    validationResult: "failure",
  });
  const retry = audit({
    activationBase64: "invalid",
    publicationResult: "skipped",
    validationResult: "failure",
  });
  const another = audit({
    activationBase64: "invalid",
    publicationResult: "skipped",
    validationResult: "failure",
    workflowRunUrl: "https://github.com/maximofn/gymnasia/actions/runs/456",
  });
  assert.equal(first.eventId, retry.eventId);
  assert.notEqual(first.eventId, another.eventId);
});

test("registra deployment de auditoría y Telegram sin mezclar sus payloads", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/deployments?") && !options.method) return jsonResponse([]);
    if (String(url).includes("api.telegram.org")) return jsonResponse({ ok: true });
    if (String(url).endsWith("/deployments")) return jsonResponse({ id: 42 }, 201);
    if (String(url).endsWith("/statuses")) return jsonResponse({ id: 43 }, 201);
    throw new Error(`unexpected ${url}`);
  };

  const result = await runPolicyAudit({
    audit: audit(),
    botToken: "bot-secret",
    chatId: "chat-id",
    fetchImpl,
    githubToken: "github-secret",
    repository: "maximofn/gymnasia",
  });

  assert.equal(result.audit.telegram.status, "sent");
  const deploymentCall = calls.find((call) => call.url.endsWith("/deployments") && call.options.method === "POST");
  const deployment = JSON.parse(deploymentCall.options.body);
  assert.equal(deployment.task, POLICY_AUDIT_TASK);
  assert.equal(deployment.payload.telegram.status, "sent");
  const statusCall = calls.find((call) => call.url.endsWith("/statuses"));
  assert.equal(JSON.parse(statusCall.options.body).auto_inactive, false);
  const telegramCall = calls.find((call) => call.url.includes("api.telegram.org"));
  assert.equal(JSON.parse(telegramCall.options.body).text.includes("github-secret"), false);
});

test("la ausencia o fallo de Telegram queda diagnosticado y permite reintento", async () => {
  let telegramAttempts = 0;
  let audits = [];
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes("/deployments?") && !options.method) return jsonResponse(audits);
    if (String(url).includes("api.telegram.org")) {
      telegramAttempts += 1;
      return telegramAttempts === 1 ? jsonResponse({ ok: false }, 500) : jsonResponse({ ok: true });
    }
    if (String(url).endsWith("/deployments")) {
      const payload = JSON.parse(options.body).payload;
      audits = [{ payload }];
      return jsonResponse({ id: 40 + telegramAttempts }, 201);
    }
    if (String(url).endsWith("/statuses")) return jsonResponse({ id: 99 }, 201);
    throw new Error(`unexpected ${url}`);
  };

  const first = await runPolicyAudit({
    audit: audit(),
    botToken: "bot-secret",
    chatId: "chat-id",
    fetchImpl,
    githubToken: "github-secret",
    repository: "maximofn/gymnasia",
  });
  assert.deepEqual(first.audit.telegram, { status: "failed", errorCode: "http-error" });

  const second = await runPolicyAudit({
    audit: audit(),
    botToken: "bot-secret",
    chatId: "chat-id",
    fetchImpl,
    githubToken: "github-secret",
    repository: "maximofn/gymnasia",
  });
  assert.equal(second.audit.telegram.status, "sent");
  assert.equal(telegramAttempts, 2);

  const missing = await runPolicyAudit({
    audit: audit({ operation: "production", reasonCode: "routine-release" }),
    botToken: "",
    chatId: "",
    fetchImpl,
    githubToken: "github-secret",
    repository: "maximofn/gymnasia",
  });
  assert.deepEqual(missing.audit.telegram, { status: "skipped", errorCode: "missing-config" });
});

test("un evento ya enviado no duplica Telegram", async () => {
  const existing = audit();
  existing.telegram = { status: "sent", errorCode: null };
  let telegramCalled = false;
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes("/deployments?") && !options.method) return jsonResponse([{ payload: existing }]);
    if (String(url).includes("api.telegram.org")) {
      telegramCalled = true;
      return jsonResponse({ ok: true });
    }
    if (String(url).endsWith("/deployments")) return jsonResponse({ id: 45 }, 201);
    if (String(url).endsWith("/statuses")) return jsonResponse({ id: 46 }, 201);
    throw new Error(`unexpected ${url}`);
  };
  const result = await runPolicyAudit({
    audit: audit(),
    botToken: "bot-secret",
    chatId: "chat-id",
    fetchImpl,
    githubToken: "github-secret",
    repository: "maximofn/gymnasia",
  });
  assert.equal(telegramCalled, false);
  assert.equal(result.audit.telegram.status, "duplicate");
});
