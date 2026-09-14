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

async function main() {
  if (command === "baseline") {
    const release = await (await api("releases/latest")).json();
    assert.equal(release.draft, false);
    assert.equal(release.immutable, true);
    const asset = release.assets.find((item) => item.name === "production-artifact-evidence.json");
    assert.ok(asset, "Falta la evidencia del último APK publicado.");
    const bytes = Buffer.from(await (await api(`releases/assets/${asset.id}`, "application/octet-stream")).arrayBuffer());
    assert.equal(`sha256:${sha256(bytes)}`, asset.digest, "La evidencia anterior no conserva el digest de GitHub.");
    const evidence = JSON.parse(bytes);
    assert.equal(evidence.result, "passed");
    assert.equal(evidence.artifact.packageName, policy.android.packageName);
    assert.equal(normalizeCertificateDigest(evidence.artifact.certificateSha256), normalizeCertificateDigest(policy.android.uploadCertificateSha256));
    const apk = release.assets.find((item) => item.name === "gymnasia.apk");
    assert.equal(apk?.digest, `sha256:${evidence.artifact.sha256}`);
    writeFileSync(path("previous-artifact-evidence.json"), bytes);
    return;
  }
  const transaction = assertReleaseTransaction(read("android-release-transaction.json"));
  if (command === "reserve") {
    const source = read("production-source-evidence.json");
    assert.equal(source.result, "passed");
    assert.equal(source.commit, transaction.sourceCommit);
    assert.equal(source.profile, "production-apk");
    const next = transaction.state === "prepared"
      ? transitionReleaseTransaction(transaction, "start-local", {
        runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      }) : transaction;
    const attempt = next.attempts.at(-1);
    if (attempt?.backend !== "wallabot-local") {
      throw new Error("Queda una transacción EAS pendiente: reconciliarla con el workflow de reversión antes de migrar.");
    }
    if (transaction.state !== "prepared" && !["build-finished", "validated"].includes(transaction.state)) {
      // A previous run could have died before its always() finalizer persisted failure.
      const run = await (await api(`actions/runs/${attempt.runId}/attempts/${attempt.runAttempt}`)).json();
      if (run.status !== "completed") throw new Error("El intento anterior sigue activo; no se puede duplicar.");
      const failed = transitionReleaseTransaction(next, "fail-local", {
        reason: "El workflow anterior terminó sin conservar un resultado verificable; requiere reintento manual.",
      });
      write("android-release-transaction.json", failed);
      throw new Error("Intento interrumpido marcado fallido; conservar el draft y usar retry-failed con motivo.");
    }
    const inputs = Object.fromEntries([
      "production-policy-snapshot.json", "production-policy-bundle.tar.gz", "previous-artifact-evidence.json",
    ].map((name) => [name, sha256(readFileSync(path(name)))]));
    if (attempt.inputs) assert.deepEqual(attempt.inputs, inputs, "No se pueden cambiar los inputs de un intento reservado.");
    else attempt.inputs = inputs;
    write("android-release-transaction.json", next);
    writeFileSync(process.env.GITHUB_OUTPUT, [
      `should_build=${transaction.state === "prepared"}`,
      `artifact_name=production-local-${attempt.attemptId}`,
      `artifact_run_id=${attempt.runId}`,
    ].join("\n") + "\n", { flag: "a" });
    return;
  }
  if (command === "check-inputs") {
    for (const [name, digest] of Object.entries(transaction.attempts.at(-1).inputs)) {
      assert.equal(sha256(readFileSync(path(name))), digest, `Input alterado: ${name}.`);
    }
    return;
  }
  throw new Error("Uso: local-controller.mjs baseline|reserve|check-inputs DIRECTORIO");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
