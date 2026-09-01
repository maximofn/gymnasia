import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import {
  createReleaseTransaction,
  selectReleaseAction,
  transitionReleaseTransaction,
} from "./release-transaction.mjs";

const commit = "a".repeat(40);
const now = "2026-09-01T10:00:00.000Z";

function transaction(version = "1.2.3") {
  return createReleaseTransaction({ version, sourceCommit: commit, now });
}

test("persiste el build ID antes de observar o validar el APK", () => {
  const submitted = transitionReleaseTransaction(transaction(), "submit", {
    buildId: "eas-build-1",
    now: "2026-09-01T10:01:00.000Z",
  });
  assert.equal(submitted.state, "build-submitted");
  assert.equal(submitted.attempts[0].buildId, "eas-build-1");
  const running = transitionReleaseTransaction(submitted, "observe", {
    status: "IN_PROGRESS",
    now: "2026-09-01T10:02:00.000Z",
  });
  assert.equal(running.state, "build-running");
  const finished = transitionReleaseTransaction(running, "observe", {
    status: "FINISHED",
    artifactUrl: "https://expo.dev/artifacts/eas-build-1.apk",
    now: "2026-09-01T10:03:00.000Z",
  });
  const validated = transitionReleaseTransaction(finished, "validate", {
    artifactSha256: "b".repeat(64),
    artifactSize: 100_000_000,
    evidenceSha256: "c".repeat(64),
    now: "2026-09-01T10:04:00.000Z",
  });
  assert.equal(validated.state, "validated");
  assert.equal(validated.artifact.filename, "gymnasia.apk");
});

test("la reconciliación reutiliza el mismo build y es idempotente", () => {
  const submitted = transitionReleaseTransaction(transaction(), "submit", { buildId: "same", now });
  assert.deepEqual(
    transitionReleaseTransaction(submitted, "submit", { buildId: "same", now }),
    submitted,
  );
  const selected = selectReleaseAction({
    transactions: [submitted],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.3",
    currentCommit: commit,
  });
  assert.equal(selected.mode, "resume");
  assert.equal(selected.transaction.attempts[0].buildId, "same");
});

test("un fallo terminal exige reintento o sustitución manual con motivo", () => {
  const submitted = transitionReleaseTransaction(transaction(), "submit", { buildId: "bad", now });
  const failed = transitionReleaseTransaction(submitted, "observe", { status: "ERRORED", now });
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
  assert.equal(retry.mode, "retry");
  const prepared = transitionReleaseTransaction(failed, "retry", { reason: retry.reason, now });
  assert.equal(prepared.state, "prepared");
  assert.equal(prepared.attempts.length, 1);
});

test("si se sustituye la versión fallida, la siguiente queda desbloqueada", () => {
  const failed = transitionReleaseTransaction(
    transitionReleaseTransaction(transaction("1.2.3"), "submit", { buildId: "bad", now }),
    "observe",
    { status: "CANCELED", now },
  );
  const superseded = transitionReleaseTransaction(failed, "supersede", {
    reason: "La fuente contiene un defecto que exige una versión nueva",
    now,
  });
  const selected = selectReleaseAction({
    transactions: [superseded],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.4",
    currentCommit: commit,
  });
  assert.equal(selected.mode, "new");
  assert.equal(selected.transaction.version, "1.2.4");
  const sameVersion = selectReleaseAction({
    transactions: [superseded],
    publishedVersions: ["1.2.2"],
    currentVersion: "1.2.3",
    currentCommit: commit,
  });
  assert.equal(sameVersion.action, "noop");
});

test("propiedad: la selección nunca salta la transacción semver más antigua", () => {
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
