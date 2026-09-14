import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import {
  assertPublishedRelease,
  assertReleaseTransaction,
  createReleaseTransaction,
  selectReleaseAction,
  transitionReleaseTransaction,
} from "./release-transaction.mjs";
import { localToolchain } from "./local-build.mjs";

const commit = "a".repeat(40);
const now = "2026-09-14T10:00:00.000Z";
const hashes = { aab: "b".repeat(64), apk: "c".repeat(64), aabEvidence: "d".repeat(64), apkEvidence: "e".repeat(64), playEvidence: "f".repeat(64), source: "1".repeat(64) };

function transaction(version = "1.45.0") {
  return createReleaseTransaction({ version, sourceCommit: commit, now });
}

function buildMetadata(value, leg) {
  return {
    schemaVersion: 2,
    backend: "wallabot-local",
    leg,
    attemptId: value.legs[leg].attempts.at(-1).attemptId,
    sourceCommit: commit,
    profile: leg === "aab" ? "production" : "production-apk",
    version: value.version,
    status: "FINISHED",
    toolchain: { ...localToolchain },
    artifact: { filename: `gymnasia.${leg}`, sha256: hashes[leg], size: 100_000_000 },
  };
}

function artifactsValidated(version = "1.45.0") {
  let value = transaction(version);
  for (const leg of ["aab", "apk"]) {
    value = transitionReleaseTransaction(value, "start-local", { leg, runId: "12", runAttempt: "1", now });
  }
  for (const leg of ["aab", "apk"]) {
    value = transitionReleaseTransaction(value, "finish-local", { leg, metadata: buildMetadata(value, leg), now });
  }
  value = transitionReleaseTransaction(value, "validate-artifact", {
    leg: "aab", artifactSha256: hashes.aab, artifactSize: 100_000_000,
    evidenceSha256: hashes.aabEvidence, versionCode: "58", versionCodeFloor: "57", now,
  });
  return transitionReleaseTransaction(value, "validate-artifact", {
    leg: "apk", artifactSha256: hashes.apk, artifactSize: 100_000_000,
    evidenceSha256: hashes.apkEvidence, versionCode: "58", versionCodeFloor: "57", now,
  });
}

function playValidated() {
  let value = artifactsValidated();
  value = transitionReleaseTransaction(value, "prepare-play", { leg: "play", artifactSha256: hashes.aab, versionCode: "58", now });
  value = transitionReleaseTransaction(value, "adopt-submission", { leg: "play", submissionId: "submission-1", status: "IN_PROGRESS", now });
  value = transitionReleaseTransaction(value, "observe-play", { leg: "play", submissionId: "submission-1", status: "FINISHED", now });
  return transitionReleaseTransaction(value, "validate-play", { leg: "play", evidenceSha256: hashes.playEvidence, now });
}

test("V2 conserva dos builds wallabot y un único envío a Play", () => {
  const value = playValidated();
  assert.equal(value.state, "validated");
  assert.equal(value.versionCode, "58");
  assert.equal(value.legs.aab.attempts.length, 1);
  assert.equal(value.legs.apk.attempts.length, 1);
  assert.equal(value.legs.play.submission.id, "submission-1");
});

test("la intención de Play es idempotente y se liga a un solo submission", () => {
  const base = artifactsValidated();
  const prepared = transitionReleaseTransaction(base, "prepare-play", { leg: "play", artifactSha256: hashes.aab, versionCode: "58", now });
  assert.deepEqual(
    transitionReleaseTransaction(prepared, "prepare-play", { leg: "play", artifactSha256: hashes.aab, versionCode: "58", now }),
    prepared,
  );
  const adopted = transitionReleaseTransaction(prepared, "adopt-submission", { leg: "play", submissionId: "one", status: "NEW", now });
  assert.throws(() => transitionReleaseTransaction(adopted, "adopt-submission", {
    leg: "play", submissionId: "two", status: "NEW", now,
  }), /otro submission/);
});

test("un corte sin submission ID queda incierto y nunca autoriza otra subida", () => {
  let value = artifactsValidated();
  value = transitionReleaseTransaction(value, "prepare-play", { leg: "play", artifactSha256: hashes.aab, versionCode: "58", now });
  value = transitionReleaseTransaction(value, "fail-play", { leg: "play", uncertain: true, reason: "Corte después de enviar", now });
  assert.equal(value.legs.play.state, "uncertain");
  assert.throws(() => transitionReleaseTransaction(value, "retry", { reason: "probar otra vez", now }), /incierto/);
  const selected = selectReleaseAction({
    transactions: [value], publishedVersions: ["1.44.0"], currentVersion: "1.45.0",
    currentCommit: commit, operation: "adopt-submission", targetVersion: "1.45.0",
    submissionId: "submission-recovered",
  });
  const adopted = transitionReleaseTransaction(selected.transaction, "adopt-submission", {
    leg: "play", submissionId: selected.submissionId, status: "IN_PROGRESS", now,
  });
  assert.equal(adopted.legs.play.submission.id, "submission-recovered");
});

test("un submission terminal conocido usa retry y conserva AAB y APK", () => {
  let value = artifactsValidated();
  value = transitionReleaseTransaction(value, "prepare-play", { leg: "play", artifactSha256: hashes.aab, versionCode: "58", now });
  value = transitionReleaseTransaction(value, "adopt-submission", { leg: "play", submissionId: "failed-1", status: "IN_PROGRESS", now });
  value = transitionReleaseTransaction(value, "observe-play", { leg: "play", submissionId: "failed-1", status: "ERRORED", reason: "Credencial inválida", now });
  value = transitionReleaseTransaction(value, "retry", { reason: "Credencial reparada", now });
  assert.equal(value.legs.play.state, "retry-pending");
  value = transitionReleaseTransaction(value, "start-play-retry", { leg: "play", now });
  assert.equal(value.legs.play.attempts.at(-1).retryOf, "failed-1");
  assert.equal(value.legs.aab.state, "validated");
  assert.equal(value.legs.apk.state, "validated");
});

test("solo se sustituye una versión fallida cuando main ya declara otra posterior", () => {
  let failed = transaction("1.45.0");
  failed = transitionReleaseTransaction(failed, "start-local", { leg: "aab", runId: "12", runAttempt: "1", now });
  failed = transitionReleaseTransaction(failed, "fail-local", { leg: "aab", reason: "falló", now });
  assert.throws(() => selectReleaseAction({
    transactions: [failed], publishedVersions: ["1.44.0"], currentVersion: "1.45.0",
    currentCommit: commit, operation: "supersede-failed", targetVersion: "1.45.0", reason: "defecto",
  }), /versión posterior/);
  const selected = selectReleaseAction({
    transactions: [failed], publishedVersions: ["1.44.0"], currentVersion: "1.45.1",
    currentCommit: commit, operation: "supersede-failed", targetVersion: "1.45.0", reason: "defecto",
  });
  assert.equal(selected.mode, "supersede");
});

function publishedFixture() {
  const tx = playValidated();
  const sourceEvidence = { schemaVersion: 2, kind: "ProductionSourceEvidenceV2", result: "passed", commit, appVersion: "1.45.0" };
  const evidence = (leg) => ({
    schemaVersion: 2,
    kind: "ProductionArtifactEvidenceV2",
    result: "passed",
    source: { commit, profile: tx.legs[leg].profile, evidenceSha256: hashes.source },
    build: { id: tx.legs[leg].attempts.at(-1).attemptId },
    artifact: { publishedFilename: `gymnasia.${leg}`, type: leg, versionName: "1.45.0", versionCode: "58", sha256: hashes[leg], size: 100_000_000 },
  });
  const playEvidence = {
    schemaVersion: 2, kind: "ProductionPlayEvidenceV2", result: "passed", track: "internal", releaseStatus: "completed",
    artifact: { sha256: hashes.aab, versionCode: "58" }, submission: { id: "submission-1", status: "FINISHED" },
  };
  const assets = [
    { name: "android-release-transaction.json", digest: `sha256:${"9".repeat(64)}` },
    { name: "production-source-evidence.json", digest: `sha256:${hashes.source}` },
    { name: "production-aab-evidence.json", digest: `sha256:${hashes.aabEvidence}` },
    { name: "production-apk-evidence.json", digest: `sha256:${hashes.apkEvidence}` },
    { name: "production-play-evidence.json", digest: `sha256:${hashes.playEvidence}` },
    { name: "gymnasia.aab", digest: `sha256:${hashes.aab}`, content_type: "application/octet-stream", size: 100_000_000 },
    { name: "gymnasia.apk", digest: `sha256:${hashes.apk}`, content_type: "application/vnd.android.package-archive", size: 100_000_000 },
  ];
  return {
    release: { draft: false, immutable: true, target_commitish: commit, assets },
    transaction: tx,
    sourceEvidence,
    aabEvidence: evidence("aab"),
    apkEvidence: evidence("apk"),
    playEvidence,
    currentCommit: commit,
    policy: {
      artifacts: {
        aab: { githubMimeType: "application/octet-stream", minBytes: 90_000_000, maxBytes: 110_000_000 },
        apk: { githubMimeType: "application/vnd.android.package-archive", minBytes: 90_000_000, maxBytes: 110_000_000 },
      },
    },
  };
}

test("la release no se publica sin AAB, APK y Play verificados", () => {
  assert.equal(assertPublishedRelease(publishedFixture()), true);
  const broken = publishedFixture();
  broken.release.assets = broken.release.assets.filter((asset) => asset.name !== "production-play-evidence.json");
  assert.throws(() => assertPublishedRelease(broken), /carece/);
});

test("lee transacciones V1 históricas sin crear otras nuevas", () => {
  const legacy = {
    schemaVersion: 1, kind: "AndroidReleaseTransactionV1", id: "android-v1.44.0", version: "1.44.0",
    tag: "v1.44.0", sourceCommit: commit, profile: "production-apk", artifactType: "apk",
    state: "validated", attempts: [], transitions: [], artifact: { filename: "gymnasia.apk", sha256: hashes.apk, size: 100_000_000, evidenceSha256: hashes.apkEvidence },
  };
  assert.equal(assertReleaseTransaction(legacy), legacy);
  assert.equal(transaction().schemaVersion, 2);
});

test("propiedad: la selección nunca salta la transacción semver más antigua", () => {
  fc.assert(fc.property(
    fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
    (patches) => {
      const transactions = patches.map((patch) => transaction(`3.7.${patch}`));
      const selected = selectReleaseAction({ transactions, publishedVersions: ["3.7.0"], currentVersion: "3.8.0", currentCommit: commit });
      assert.equal(selected.transaction.version, `3.7.${Math.min(...patches)}`);
    },
  ));
});

test("propiedad: una intención nunca acepta dos submission IDs", () => {
  const base = transitionReleaseTransaction(artifactsValidated(), "prepare-play", {
    leg: "play", artifactSha256: hashes.aab, versionCode: "58", now,
  });
  fc.assert(fc.property(
    fc.string({ minLength: 1, maxLength: 40 }),
    fc.string({ minLength: 1, maxLength: 40 }),
    (first, second) => {
      fc.pre(first.trim() !== "" && second.trim() !== "" && first.trim() !== second.trim());
      const adopted = transitionReleaseTransaction(base, "adopt-submission", {
        leg: "play", submissionId: first, status: "NEW", now,
      });
      assert.throws(() => transitionReleaseTransaction(adopted, "adopt-submission", {
        leg: "play", submissionId: second, status: "NEW", now,
      }));
    },
  ));
});
