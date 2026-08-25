#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderRuntimePolicyModule } from "../health-safety/policy.mjs";
import { readAnnouncedToolNames } from "./bundle.mjs";
import {
  canonicalJson,
  MAX_POLICY_BUNDLE_BYTES,
  sha256Hex,
  utf8Bytes,
  validateTrustedRoots,
  verifySignedPolicy,
} from "./signing.mjs";

const repository = process.env.GITHUB_REPOSITORY || "maximofn/gymnasia";
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../..");
const outputPath = join(repositoryRoot, "apps/mobile/agent/generated/chatSystemPrompt.generated.ts");
const metadataOutputPath = join(repositoryRoot, "apps/mobile/agent/generated/policySnapshot.generated.json");
const runtimeOutputPath = join(repositoryRoot, "apps/mobile/agent/generated/healthSafetyPolicy.generated.ts");
const signedSnapshotOutputPath = join(
  repositoryRoot,
  "apps/mobile/agent/generated/signedPolicySnapshot.generated.ts",
);
const trustedRootsPath = join(repositoryRoot, "policy/signing/trusted-roots.json");
const acceptedJsonTypes = new Set([
  "application/json",
  "application/octet-stream",
  "text/plain",
]);

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error("Uso: prepare-policy-snapshot.mjs --environment staging|production [--github-env ruta]");
    }
    result[name.slice(2)] = value;
  }
  if (!["staging", "production"].includes(result.environment)) {
    throw new Error("--environment debe ser staging o production.");
  }
  return result;
}

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function parsePayload(value, channel) {
  const payload = typeof value === "string" ? JSON.parse(value) : value;
  const candidatePattern = /^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/;
  const digestPattern = /^[a-f0-9]{64}$/;
  const baseUrl = `https://github.com/${repository}/releases/download/${payload?.candidate}`;
  if (
    !exactObject(payload, [
      "activation",
      "activationSignature",
      "bundleSha256",
      "bundleUrl",
      "candidate",
      "schemaVersion",
      "signatureUrl",
      "sourceCommit",
    ])
    || payload.schemaVersion !== 3
    || !candidatePattern.test(payload.candidate || "")
    || !/^[a-f0-9]{40}$/.test(payload.sourceCommit || "")
    || payload.bundleUrl !== `${baseUrl}/policy.bundle.json`
    || payload.signatureUrl !== `${baseUrl}/policy.bundle.signature.json`
    || !digestPattern.test(payload.bundleSha256 || "")
    || !payload.activation
    || !payload.activationSignature
    || payload.activation.channel !== channel
  ) {
    throw new Error(`Payload de deployment firmado ${channel} inválido.`);
  }
  return payload;
}

async function githubJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function findDeployment(channel) {
  const deployments = await githubJson(
    `https://api.github.com/repos/${repository}/deployments?environment=${encodeURIComponent(channel)}&task=gymnasia-policy&per_page=100`,
  );
  for (const deployment of deployments) {
    if (deployment.task !== "gymnasia-policy" || deployment.environment !== channel) continue;
    let payload;
    try {
      payload = parsePayload(deployment.payload, channel);
    } catch {
      continue;
    }
    const statuses = await githubJson(deployment.statuses_url);
    if (statuses[0]?.state === "success") return { id: deployment.id, payload };
  }
  throw new Error(`No existe un deployment firmado gymnasia-policy válido para ${channel}.`);
}

async function downloadText(url, maximumBytes) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { Accept: "application/json, application/octet-stream;q=0.9, text/plain;q=0.8" },
  });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
  if (mediaType && !acceptedJsonTypes.has(mediaType)) {
    throw new Error(`Tipo de asset de política no permitido: ${mediaType}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    throw new Error(`Tamaño de asset de política no permitido: ${bytes.length}`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function renderPromptModule(content, digest) {
  return `// Generated by scripts/policy-promotion/prepare-policy-snapshot.mjs. Do not edit by hand.\n`
    + `export const CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION = 1 as const;\n`
    + `export const BUNDLED_CHAT_SYSTEM_PROMPT_SHA256 = ${JSON.stringify(digest)};\n`
    + `export const BUNDLED_CHAT_SYSTEM_PROMPT_VERSION = ${JSON.stringify(`sha256:${digest}`)};\n`
    + `export const BUNDLED_CHAT_SYSTEM_PROMPT = ${JSON.stringify(content)};\n`;
}

function renderSignedSnapshotModule(packageValue) {
  return `// Generated by scripts/policy-promotion/prepare-policy-snapshot.mjs. Do not edit by hand.\n`
    + `import type { SignedPolicyPackage } from "../signedPolicy";\n\n`
    + `export const BUNDLED_SIGNED_POLICY_PACKAGE = ${JSON.stringify(packageValue, null, 2)} satisfies SignedPolicyPackage;\n`;
}

export async function preparePolicySnapshot({ environment, githubEnv }) {
  const channel = environment === "production" ? "Production" : "Staging";
  const { id: deploymentId, payload } = await findDeployment(channel);
  const [bundleBody, bundleSignatureBody] = await Promise.all([
    downloadText(payload.bundleUrl, MAX_POLICY_BUNDLE_BYTES),
    downloadText(payload.signatureUrl, 64 * 1024),
  ]);
  const bundleBytes = utf8Bytes(bundleBody);
  if (sha256Hex(bundleBytes) !== payload.bundleSha256) {
    throw new Error("El digest público del bundle no coincide.");
  }
  const activationBody = canonicalJson(payload.activation);
  const trustedRoots = validateTrustedRoots(JSON.parse(readFileSync(trustedRootsPath, "utf8")));
  const verified = verifySignedPolicy({
    bundleBytes,
    bundleSignature: JSON.parse(bundleSignatureBody),
    activationBytes: utf8Bytes(activationBody),
    activationSignature: payload.activationSignature,
    trustedRoots,
    announcedTools: readAnnouncedToolNames(repositoryRoot),
    expectedChannel: channel,
  });
  if (verified.bundle.id !== payload.candidate) {
    throw new Error("La identidad del bundle no coincide con el deployment.");
  }

  const baseUrl = payload.bundleUrl.replace(/\/policy\.bundle\.json$/, "");
  const [reportBody, evidenceBody] = await Promise.all([
    downloadText(`${baseUrl}/health-safety-report.json`, 512 * 1024),
    downloadText(`${baseUrl}/promotion-evidence.json`, 64 * 1024),
  ]);
  const reportSha256 = sha256Hex(utf8Bytes(reportBody));
  const report = JSON.parse(reportBody);
  const evidence = JSON.parse(evidenceBody);
  if (
    report.authorizing !== false
    || report.summary?.failed !== 0
    || report.promptVersion !== `sha256:${verified.bundle.prompt.sha256}`
    || evidence.schemaVersion !== 3
    || evidence.candidate !== payload.candidate
    || evidence.sourceCommit !== payload.sourceCommit
    || evidence.bundleSha256 !== payload.bundleSha256
    || evidence.healthSafetyReportSha256 !== reportSha256
    || evidence.owner !== "maximofn"
    || evidence.gate?.command !== "npm run check:health-safety"
    || evidence.gate?.passed !== true
    || evidence.gate?.authorizingReport !== false
  ) {
    throw new Error("La evidencia obligatoria del bundle firmado es inválida.");
  }

  const signedPackage = {
    activationBody,
    activationSignature: payload.activationSignature,
    bundleBody,
    bundleSignature: JSON.parse(bundleSignatureBody),
    candidate: verified.bundle.id,
    channel,
    deploymentId,
    environment,
    schemaVersion: 1,
  };
  writeFileSync(
    outputPath,
    renderPromptModule(verified.bundle.prompt.content, verified.bundle.prompt.sha256),
    "utf8",
  );
  writeFileSync(
    runtimeOutputPath,
    renderRuntimePolicyModule(verified.bundle.healthSafetyRuntime.content),
    "utf8",
  );
  writeFileSync(signedSnapshotOutputPath, renderSignedSnapshotModule(signedPackage), "utf8");
  writeFileSync(metadataOutputPath, `${JSON.stringify({
    schemaVersion: 2,
    environment,
    channel,
    candidate: verified.bundle.id,
    sha256: verified.bundle.prompt.sha256,
    bundleSha256: payload.bundleSha256,
    runtimePolicySha256: verified.bundle.healthSafetyRuntime.sha256,
    runtimePolicyVersion: verified.bundle.healthSafetyRuntime.policyVersion,
    activationId: verified.activation.id,
    sequence: verified.activation.sequence,
    deploymentId,
  }, null, 2)}\n`, "utf8");
  if (githubEnv) {
    appendFileSync(
      githubEnv,
      `APP_ENV=${environment}\nPOLICY_CANDIDATE=${verified.bundle.id}\nPOLICY_SHA256=${verified.bundle.prompt.sha256}\nPOLICY_DEPLOYMENT_ID=${deploymentId}\n`,
      "utf8",
    );
  }
  return {
    environment,
    channel,
    deploymentId,
    candidate: verified.bundle.id,
    digest: verified.bundle.prompt.sha256,
    bundleDigest: payload.bundleSha256,
    sequence: verified.activation.sequence,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await preparePolicySnapshot(parseArguments(process.argv.slice(2)));
  console.log(
    `${result.channel}: ${result.candidate} @ ${result.bundleDigest.slice(0, 12)} `
    + `(secuencia ${result.sequence}, deployment ${result.deploymentId})`,
  );
}
