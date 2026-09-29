import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import fc from "fast-check";
import { createReleaseTransaction, transitionReleaseTransaction } from "./release-transaction.mjs";
import { assertLocalBuildMetadata, assertSharedVersionCode, assertVersionCodeProgression, localToolchain } from "./local-build.mjs";

const commit = "a".repeat(40);
const now = "2026-09-14T10:00:00.000Z";

function started() {
  let value = createReleaseTransaction({ version: "1.45.0", sourceCommit: commit, now });
  value = transitionReleaseTransaction(value, "start-local", { leg: "aab", runId: "12", runAttempt: "1", now });
  return transitionReleaseTransaction(value, "start-local", { leg: "apk", runId: "12", runAttempt: "1", now });
}

function metadata(transaction, leg, hash = leg === "aab" ? "b".repeat(64) : "c".repeat(64)) {
  const attempt = transaction.legs[leg].attempts.at(-1);
  return {
    schemaVersion: 2,
    backend: "wallabot-local",
    leg,
    attemptId: attempt.attemptId,
    sourceCommit: commit,
    profile: leg === "aab" ? "production" : "production-apk",
    version: "1.45.0",
    status: "FINISHED",
    toolchain: { ...localToolchain },
    artifact: { filename: `gymnasia.${leg}`, sha256: hash, size: 100_000_000 },
  };
}

test("reserva identidades locales distintas para AAB y APK sin build remoto", () => {
  const value = started();
  assert.equal(value.state, "building");
  assert.match(value.legs.aab.attempts[0].attemptId, /-aab$/);
  assert.match(value.legs.apk.attempts[0].attemptId, /-apk$/);
  assert.equal(value.legs.aab.attempts[0].backend, "wallabot-local");
  assert.equal(value.legs.apk.attempts[0].profile, "production-apk");
});

test("termina y valida los mismos bytes con un versionCode común", () => {
  let value = started();
  for (const leg of ["aab", "apk"]) {
    const build = metadata(value, leg);
    assertLocalBuildMetadata(build, value, build.artifact, leg);
    value = transitionReleaseTransaction(value, "finish-local", { leg, metadata: build, now });
  }
  value = transitionReleaseTransaction(value, "validate-artifact", {
    leg: "aab", artifactSha256: "b".repeat(64), artifactSize: 100_000_000,
    evidenceSha256: "d".repeat(64), versionCode: "58", versionCodeFloor: "57", now,
  });
  value = transitionReleaseTransaction(value, "validate-artifact", {
    leg: "apk", artifactSha256: "c".repeat(64), artifactSize: 100_000_000,
    evidenceSha256: "e".repeat(64), versionCode: "58", versionCodeFloor: "57", now,
  });
  assert.equal(value.state, "artifacts-validated");
  assert.equal(value.versionCode, "58");
});

test("rechaza metadatos con campos secretos o una pata cruzada", () => {
  const value = started();
  const extra = { ...metadata(value, "aab"), EXPO_TOKEN: "no" };
  assert.throws(() => assertLocalBuildMetadata(extra, value, extra.artifact, "aab"), /no permitidos/);
  const crossed = { ...metadata(value, "aab"), profile: "production-apk" };
  assert.throws(() => assertLocalBuildMetadata(crossed, value, crossed.artifact, "aab"), /profile/);
});

test("un fallo de APK conserva el AAB y el reintento solo prepara la pata fallida", () => {
  let value = started();
  const aab = metadata(value, "aab");
  value = transitionReleaseTransaction(value, "finish-local", { leg: "aab", metadata: aab, now });
  value = transitionReleaseTransaction(value, "validate-artifact", {
    leg: "aab", artifactSha256: "b".repeat(64), artifactSize: 100_000_000,
    evidenceSha256: "d".repeat(64), versionCode: "58", versionCodeFloor: "57", now,
  });
  value = transitionReleaseTransaction(value, "fail-local", { leg: "apk", reason: "Gradle falló", now });
  assert.equal(value.state, "failed");
  value = transitionReleaseTransaction(value, "retry", { reason: "Incidencia reparada", now });
  assert.equal(value.legs.aab.state, "validated");
  assert.equal(value.legs.apk.state, "prepared");
});

test("el ejecutor exige EXPO_TOKEN y ordena production antes de production-apk", () => {
  const script = readFileSync(new URL("./run-local-build.mjs", import.meta.url), "utf8");
  assert.match(script, /Falta EXPO_TOKEN/);
  assert.ok(script.indexOf('aab: { profile: "production"') < script.indexOf('apk: { profile: "production-apk"'));
  assert.match(script, /for \(const leg of requested\) build\(leg, transaction, sdk\)/);
  assert.doesNotMatch(script, /--auto-submit|build:list|build:view/);
});

test("versionCode debe crecer sobre el máximo conocido y coincidir", () => {
  assert.doesNotThrow(() => assertVersionCodeProgression("58", 57));
  assert.throws(() => assertVersionCodeProgression("57", 57), /superar/);
  assert.doesNotThrow(() => assertSharedVersionCode("58", "58"));
  assert.throws(() => assertSharedVersionCode("58", "59"), /mismo versionCode/);
});

test("propiedad: ningún versionCode repetido o decreciente pasa", () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 2_000_000_000 }),
    fc.integer({ min: 0, max: 2_000_000_000 }),
    (current, floor) => {
      if (current <= floor) assert.throws(() => assertVersionCodeProgression(String(current), floor));
      else assert.doesNotThrow(() => assertVersionCodeProgression(String(current), floor));
    },
  ));
});
