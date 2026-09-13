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

const commit = "a".repeat(40);
const now = "2026-09-01T10:00:00.000Z";

function transaction(version = "1.2.3", minimumVersionCode = 16) {
  return createReleaseTransaction({ version, sourceCommit: commit, minimumVersionCode, now });
}

function finishArtifact(input, leg, buildId, versionCode = 17) {
  const submitted = transitionReleaseTransaction(input, "submit", { leg, buildId, now });
  const finished = transitionReleaseTransaction(submitted, "observe", {
    leg,
    status: "FINISHED",
    artifactUrl: `https://expo.dev/artifacts/${buildId}.${leg}`,
    now,
  });
  return transitionReleaseTransaction(finished, "validate", {
    leg,
    artifactSha256: (leg === "aab" ? "b" : "c").repeat(64),
    artifactSize: 100_000_000,
    evidenceSha256: (leg === "aab" ? "d" : "e").repeat(64),
    versionName: input.version,
    versionCode,
    now,
  });
}

function validatedTransaction() {
  let value = finishArtifact(transaction(), "aab", "aab-build");
  value = finishArtifact(value, "apk", "apk-build");
  value = transitionReleaseTransaction(value, "submit", {
    leg: "play",
    buildId: "aab-build",
    submissionId: "play-submission",
    now,
  });
  value = transitionReleaseTransaction(value, "observe", { leg: "play", status: "FINISHED", now });
  return transitionReleaseTransaction(value, "validate", {
    leg: "play",
    versionCode: 17,
    evidenceSha256: "f".repeat(64),
    now,
  });
}

test("persiste por separado AAB, APK y submission antes de avanzar", () => {
  let value = transitionReleaseTransaction(transaction(), "submit", {
    leg: "aab",
    buildId: "aab-build",
    now,
  });
  assert.equal(value.state, "building");
  assert.equal(value.legs.aab.attempts[0].buildId, "aab-build");
  value = finishArtifact(transaction(), "aab", "aab-build");
  value = finishArtifact(value, "apk", "apk-build");
  assert.equal(value.state, "artifacts-validated");
  const submitted = transitionReleaseTransaction(value, "submit", {
    leg: "play",
    buildId: "aab-build",
    submissionId: "play-submission",
    now,
  });
  assert.equal(submitted.state, "submitting");
  assert.equal(submitted.legs.play.attempts[0].submissionId, "play-submission");
});

test("la reconciliación de un identificador ya persistido es idempotente", () => {
  const submitted = transitionReleaseTransaction(transaction(), "submit", {
    leg: "aab",
    buildId: "same",
    now,
  });
  assert.deepEqual(
    transitionReleaseTransaction(submitted, "submit", { leg: "aab", buildId: "same", now }),
    submitted,
  );
  const selected = selectReleaseAction({
    transactions: [submitted],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.3",
    currentCommit: commit,
  });
  assert.equal(selected.mode, "resume");
  assert.equal(selected.transaction.legs.aab.attempts[0].buildId, "same");
});

test("una intención incierta queda durable y exige reintento antes de emitir otra", () => {
  const intended = transitionReleaseTransaction(transaction(), "intent", {
    leg: "aab",
    message: "android-v1.2.3-aab-attempt-1",
    now,
  });
  assert.equal(intended.state, "building");
  assert.equal(intended.legs.aab.attempts.length, 0);
  assert.equal(intended.legs.aab.intent.number, 1);
  assert.throws(() => transitionReleaseTransaction(intended, "intent", {
    leg: "aab",
    message: "android-v1.2.3-aab-attempt-2",
    now,
  }), /desde intent/);
  const failed = transitionReleaseTransaction(intended, "fail", {
    leg: "aab",
    reason: "La petición no apareció en EAS",
    now,
  });
  assert.equal(failed.state, "failed");
  const retried = transitionReleaseTransaction(failed, "retry", {
    reason: "EAS confirma que no existe el build",
    now,
  });
  const secondIntent = transitionReleaseTransaction(retried, "intent", {
    leg: "aab",
    message: "android-v1.2.3-aab-attempt-2",
    now,
  });
  assert.equal(secondIntent.legs.aab.intent.number, 2);
});

test("AAB y APK deben compartir una versión creciente", () => {
  const aab = finishArtifact(transaction(), "aab", "aab-build", 17);
  const apkFinished = transitionReleaseTransaction(
    transitionReleaseTransaction(aab, "submit", { leg: "apk", buildId: "apk-build", now }),
    "observe",
    { leg: "apk", status: "FINISHED", artifactUrl: "https://expo.dev/apk", now },
  );
  assert.throws(() => transitionReleaseTransaction(apkFinished, "validate", {
    leg: "apk",
    artifactSha256: "c".repeat(64),
    artifactSize: 100_000_000,
    evidenceSha256: "e".repeat(64),
    versionName: "1.2.3",
    versionCode: 18,
    now,
  }), /compartir versionCode/);
  assert.throws(() => finishArtifact(transaction("1.2.3", 17), "aab", "old", 17), /no supera/);
});

test("Play solo acepta el AAB validado después de ambos artefactos", () => {
  const aab = finishArtifact(transaction(), "aab", "aab-build");
  assert.throws(() => transitionReleaseTransaction(aab, "submit", {
    leg: "play",
    buildId: "aab-build",
    submissionId: "too-soon",
    now,
  }), /antes de validar AAB y APK/);
  const complete = validatedTransaction();
  assert.equal(complete.state, "validated");
  assert.equal(complete.legs.play.versionCode, 17);
  assertReleaseTransaction(complete);
});

test("un fallo terminal exige reintento o sustitución manual con motivo", () => {
  const submitted = transitionReleaseTransaction(transaction(), "submit", {
    leg: "aab",
    buildId: "bad",
    now,
  });
  const failed = transitionReleaseTransaction(submitted, "observe", {
    leg: "aab",
    status: "ERRORED",
    reason: "token=secret\nfallo remoto",
    now,
  });
  assert.equal(failed.state, "failed");
  assert.throws(() => selectReleaseAction({
    transactions: [failed],
    publishedVersions: [],
    currentVersion: "1.2.4",
    currentCommit: commit,
  }), /requiere reintento o sustitución manual/);
  const retry = selectReleaseAction({
    transactions: [failed],
    publishedVersions: [],
    currentVersion: "1.2.4",
    currentCommit: commit,
    operation: "retry-failed",
    targetVersion: "1.2.3",
    reason: "EAS sufrió una incidencia confirmada",
  });
  const prepared = transitionReleaseTransaction(failed, "retry", { reason: retry.reason, now });
  assert.equal(prepared.state, "prepared");
  assert.equal(prepared.legs.aab.attempts.length, 1);
});

test("sustituir exige una versión posterior y desbloquea esa versión", () => {
  const failed = transitionReleaseTransaction(
    transitionReleaseTransaction(transaction("1.2.3"), "submit", { leg: "apk", buildId: "bad", now }),
    "observe",
    { leg: "apk", status: "CANCELED", now },
  );
  assert.throws(() => selectReleaseAction({
    transactions: [failed],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.3",
    currentCommit: commit,
    operation: "supersede-failed",
    reason: "defecto confirmado",
  }), /versión posterior/);
  const superseded = transitionReleaseTransaction(failed, "supersede", {
    reason: "La fuente contiene un defecto que exige una versión nueva",
    now,
  });
  const selected = selectReleaseAction({
    transactions: [superseded],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.4",
    currentCommit: commit,
    minimumVersionCode: 17,
  });
  assert.equal(selected.mode, "new");
  assert.equal(selected.transaction.minimumVersionCode, 17);
});

function publishedFixture() {
  const transactionValue = validatedTransaction();
  const sourceEvidenceSha = "1".repeat(64);
  const release = {
    draft: false,
    immutable: true,
    target_commitish: commit,
    assets: [
      { name: "android-release-transaction.json", digest: `sha256:${"2".repeat(64)}` },
      { name: "production-source-evidence.json", digest: `sha256:${sourceEvidenceSha}` },
      { name: "production-aab-evidence.json", digest: `sha256:${"d".repeat(64)}` },
      { name: "production-apk-evidence.json", digest: `sha256:${"e".repeat(64)}` },
      { name: "production-play-evidence.json", digest: `sha256:${"f".repeat(64)}` },
      { name: "gymnasia.aab", digest: `sha256:${"b".repeat(64)}`, content_type: "application/octet-stream", size: 100_000_000 },
      { name: "gymnasia.apk", digest: `sha256:${"c".repeat(64)}`, content_type: "application/vnd.android.package-archive", size: 100_000_000 },
    ],
  };
  const artifact = (leg) => ({
    schemaVersion: 2,
    kind: "ProductionArtifactEvidenceV2",
    result: "passed",
    source: {
      commit,
      profile: transactionValue.legs[leg].profile,
      evidenceSha256: sourceEvidenceSha,
    },
    build: { id: transactionValue.legs[leg].attempts.at(-1).buildId },
    artifact: {
      publishedFilename: `gymnasia.${leg}`,
      type: leg,
      versionName: "1.2.3",
      versionCode: "17",
      sha256: transactionValue.legs[leg].artifact.sha256,
      size: 100_000_000,
    },
  });
  return {
    release,
    transaction: transactionValue,
    artifactEvidences: { aab: artifact("aab"), apk: artifact("apk") },
    sourceEvidence: {
      schemaVersion: 2,
      kind: "ProductionSourceEvidenceV2",
      result: "passed",
      commit,
      appVersion: "1.2.3",
    },
    playEvidence: {
      schemaVersion: 1,
      kind: "ProductionPlayEvidenceV1",
      result: "passed",
      provider: "eas",
      profile: "production",
      track: "internal",
      releaseStatus: "completed",
      buildId: "aab-build",
      submissionId: "play-submission",
      status: "FINISHED",
      versionCode: 17,
    },
    currentCommit: commit,
  };
}

test("la release publicada conserva AAB, APK, Play y toda la cadena de hashes", () => {
  const fixture = publishedFixture();
  assert.equal(assertPublishedRelease(fixture), true);
  fixture.release.assets.find((asset) => asset.name === "production-play-evidence.json").digest = `sha256:${"0".repeat(64)}`;
  assert.throws(() => assertPublishedRelease(fixture), /evidencia de Play/);
});

test("mantiene lectura compatible de las transacciones V1 históricas", () => {
  assert.doesNotThrow(() => assertReleaseTransaction({
    schemaVersion: 1,
    kind: "AndroidReleaseTransactionV1",
    id: "android-v1.2.2",
    version: "1.2.2",
    tag: "v1.2.2",
    sourceCommit: commit,
    profile: "production-apk",
    artifactType: "apk",
    state: "validated",
    attempts: [],
    transitions: [],
  }));
});

test("propiedad: nunca salta la transacción semver más antigua", () => {
  fc.assert(fc.property(
    fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
    (patches) => {
      const transactions = patches.map((patch) => transaction(`3.7.${patch}`));
      const selected = selectReleaseAction({
        transactions,
        publishedVersions: ["3.7.0"],
        currentVersion: "3.8.0",
        currentCommit: commit,
      });
      assert.equal(selected.transaction.version, `3.7.${Math.min(...patches)}`);
    },
  ));
});

test("propiedad: ningún versionCode repetido o decreciente se valida", () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 10_000 }),
    fc.integer({ min: 0, max: 10_000 }),
    (minimum, candidateOffset) => {
      const candidate = Math.min(minimum, candidateOffset);
      assert.throws(() => finishArtifact(transaction("4.0.0", minimum), "aab", "build", candidate));
    },
  ));
});
