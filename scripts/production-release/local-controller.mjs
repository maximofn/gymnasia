#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertReleaseTransaction, transitionReleaseTransaction } from "./release-transaction.mjs";
import { loadReleasePolicy, normalizeCertificateDigest } from "./production-release.mjs";
import { sha256 } from "./local-build.mjs";

const [command, directory] = process.argv.slice(2);
const path = (name) => resolve(directory, name);
const read = (name) => JSON.parse(readFileSync(path(name), "utf8"));
const write = (name, value) => writeFileSync(path(name), `${JSON.stringify(value, null, 2)}\n`);
const headers = {
  Authorization: `Bearer ${process.env.GH_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
const policy = loadReleasePolicy();

async function api(route, accept) {
  const response = await fetch(`https://api.github.com/repos/${policy.repository}/${route}`, {
    headers: { ...headers, ...(accept ? { Accept: accept } : {}) },
  });
  if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}.`);
  return response;
}

async function downloadEvidence(release, names) {
  const asset = names.map((name) => release.assets.find((candidate) => candidate.name === name)).find(Boolean);
  assert.ok(asset, `Falta ${names.join(" o ")} en la última release.`);
  const bytes = Buffer.from(await (await api(`releases/assets/${asset.id}`, "application/octet-stream")).arrayBuffer());
  assert.equal(`sha256:${sha256(bytes)}`, asset.digest, "La evidencia anterior no conserva el digest de GitHub.");
  return { bytes, evidence: JSON.parse(bytes), asset };
}

async function baseline() {
  const playFloor = Number(process.env.PLAY_VERSION_CODE_FLOOR);
  if (!Number.isSafeInteger(playFloor) || playFloor < 1) {
    throw new Error("Falta PLAY_VERSION_CODE_FLOOR con el mayor versionCode real de Play Console.");
  }
  const release = await (await api("releases/latest")).json();
  assert.equal(release.draft, false);
  assert.equal(release.immutable, true);
  const downloaded = await downloadEvidence(release, ["production-apk-evidence.json", "production-artifact-evidence.json"]);
  const evidence = downloaded.evidence;
  assert.equal(evidence.result, "passed");
  assert.equal(evidence.artifact.packageName, policy.android.packageName);
  assert.equal(normalizeCertificateDigest(evidence.artifact.certificateSha256), normalizeCertificateDigest(policy.android.uploadCertificateSha256));
  const lastPublished = Number(evidence.artifact.versionCode);
  assert.ok(Number.isSafeInteger(lastPublished) && lastPublished > 0, "La evidencia publicada no conserva un versionCode válido.");
  const apk = release.assets.find((item) => item.name === "gymnasia.apk");
  assert.equal(apk?.digest, `sha256:${evidence.artifact.sha256}`);
  writeFileSync(path("previous-apk-evidence.json"), downloaded.bytes);
  write("version-code-baseline.json", {
    schemaVersion: 2,
    playFloor,
    lastPublished,
    minimumExclusive: Math.max(playFloor, lastPublished),
    releaseTag: release.tag_name,
  });
}

async function reserve() {
  let transaction = assertReleaseTransaction(read("android-release-transaction.json"));
  if (transaction.schemaVersion !== 2) {
    throw new Error("Queda una transacción V1 pendiente: debe reconciliarse o sustituirse manualmente antes de activar el flujo AAB/APK.");
  }
  const source = read("production-source-evidence.json");
  assert.equal(source.result, "passed");
  assert.equal(source.commit, transaction.sourceCommit);
  assert.deepEqual(source.targets, [
    { profile: "production", artifactType: "aab" },
    { profile: "production-apk", artifactType: "apk" },
  ]);

  for (const legName of ["aab", "apk"]) {
    const leg = transaction.legs[legName];
    if (leg.state !== "building") continue;
    const attempt = leg.attempts.at(-1);
    if (attempt.runId === process.env.GITHUB_RUN_ID && attempt.runAttempt === process.env.GITHUB_RUN_ATTEMPT) continue;
    const run = await (await api(`actions/runs/${attempt.runId}/attempts/${attempt.runAttempt}`)).json();
    if (run.status !== "completed") throw new Error(`El intento ${legName} anterior sigue activo; no se puede duplicar.`);
    transaction = transitionReleaseTransaction(transaction, "fail-local", {
      leg: legName,
      reason: "El workflow anterior terminó sin conservar un resultado verificable; requiere reintento manual.",
    });
    write("android-release-transaction.json", transaction);
    throw new Error(`Intento ${legName} interrumpido marcado fallido; conservar el draft y usar retry-failed con motivo.`);
  }

  const inputs = Object.fromEntries([
    "production-policy-snapshot.json",
    "production-policy-bundle.tar.gz",
    "production-source-evidence.json",
    "previous-apk-evidence.json",
    "version-code-baseline.json",
  ].map((name) => [name, sha256(readFileSync(path(name)))]));
  const buildLegs = [];
  for (const legName of ["aab", "apk"]) {
    if (transaction.legs[legName].state !== "prepared") continue;
    transaction = transitionReleaseTransaction(transaction, "start-local", {
      leg: legName,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    });
    const attempt = transaction.legs[legName].attempts.at(-1);
    attempt.inputs = inputs;
    buildLegs.push(legName);
  }
  const builtLegs = ["aab", "apk"].filter((legName) => transaction.legs[legName].state === "built");
  const resultLegs = buildLegs.length > 0 ? buildLegs : builtLegs;
  let artifactRunId = process.env.GITHUB_RUN_ID;
  let artifactRunAttempt = process.env.GITHUB_RUN_ATTEMPT;
  if (buildLegs.length === 0 && builtLegs.length > 0) {
    const identities = new Set(builtLegs.map((legName) => {
      const attempt = transaction.legs[legName].attempts.at(-1);
      return `${attempt.runId}/${attempt.runAttempt}`;
    }));
    assert.equal(identities.size, 1, "Los resultados locales recuperables pertenecen a runs distintos.");
    [artifactRunId, artifactRunAttempt] = [...identities][0].split("/");
  }
  write("android-release-transaction.json", transaction);
  const artifactName = `production-local-github-${artifactRunId}-${artifactRunAttempt}`;
  writeFileSync(process.env.GITHUB_OUTPUT, [
    `should_build=${buildLegs.length > 0}`,
    `has_local_results=${resultLegs.length > 0}`,
    `build_legs=${resultLegs.join(",")}`,
    `artifact_name=${artifactName}`,
    `artifact_run_id=${artifactRunId}`,
  ].join("\n") + "\n", { flag: "a" });
}

function checkInputs() {
  const transaction = assertReleaseTransaction(read("android-release-transaction.json"));
  const attempts = ["aab", "apk"]
    .map((leg) => transaction.legs[leg].attempts.at(-1))
    .filter((attempt) => attempt?.runId === process.env.GITHUB_RUN_ID
      && attempt?.runAttempt === process.env.GITHUB_RUN_ATTEMPT);
  assert.ok(attempts.length > 0, "Este run no tiene patas locales reservadas.");
  for (const attempt of attempts) {
    for (const [name, digest] of Object.entries(attempt.inputs ?? {})) {
      assert.equal(sha256(readFileSync(path(name))), digest, `Input alterado: ${name}.`);
    }
  }
}

async function main() {
  if (command === "baseline") return baseline();
  if (command === "reserve") return reserve();
  if (command === "check-inputs") return checkInputs();
  throw new Error("Uso: local-controller.mjs baseline|reserve|check-inputs DIRECTORIO");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
