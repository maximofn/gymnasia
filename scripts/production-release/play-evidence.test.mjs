import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fixture, hash } from "./release-test-fixtures.mjs";
import { transitionReleaseTransaction } from "./release-transaction.mjs";
import { loadReleasePolicy, repositoryRoot } from "./production-release.mjs";

test("la CLI de evidencia liga el recibo real al submission y bloquea su ausencia o sustitución", () => {
  const directory = mkdtempSync(join(tmpdir(), "play-evidence-"));
  const policy = loadReleasePolicy();
  let transaction = fixture().transaction;
  transaction = transitionReleaseTransaction(transaction, "prepare-play", {
    leg: "play", artifactSha256: transaction.legs.aab.artifact.sha256, versionCode: transaction.versionCode,
  });
  transaction = transitionReleaseTransaction(transaction, "adopt-submission", {
    leg: "play", submissionId: "test-submission", status: "FINISHED",
  });
  const receipt = { schemaVersion: 1, kind: "GooglePlayArtifactReceiptV1", packageName: policy.android.packageName,
    versionCode: transaction.versionCode, sha256: transaction.legs.aab.artifact.sha256,
    track: policy.play.track, releaseStatus: "completed", observedAt: new Date().toISOString() };
  try {
    const write = (name, value) => writeFileSync(join(directory, name), JSON.stringify(value));
    write("transaction.json", transaction);
    write("submission.json", { id: "test-submission", status: "FINISHED", platform: "ANDROID",
      track: policy.play.track, releaseStatus: "completed" });
    write("receipt.json", receipt);
    const args = ["scripts/production-release/create-play-evidence.mjs",
      "--transaction", join(directory, "transaction.json"), "--submission", join(directory, "submission.json"),
      "--output", join(directory, "evidence.json")];
    const run = (extra) => spawnSync(process.execPath, [...args, ...extra], { cwd: repositoryRoot, encoding: "utf8" });
    assert.notEqual(run([]).status, 0);
    const extra = ["--google-receipt", join(directory, "receipt.json")];
    assert.equal(run(extra).status, 0);
    const evidence = JSON.parse(readFileSync(join(directory, "evidence.json")));
    assert.deepEqual(evidence.googleReceipt, receipt);
    assert.equal(evidence.googleReceiptSha256, hash(readFileSync(join(directory, "receipt.json"))));
    for (const changed of [{ sha256: "0".repeat(64) }, { versionCode: "87" }, { track: "production" }, { releaseStatus: "draft" }]) {
      write("receipt.json", { ...receipt, ...changed });
      assert.notEqual(run(extra).status, 0);
    }
  } finally { rmSync(directory, { recursive: true }); }
});
