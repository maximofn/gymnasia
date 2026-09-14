import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { assertLocalBuildMetadata, assertVersionCodeProgression, localToolchain } from "./local-build.mjs";
import { createReleaseTransaction, transitionReleaseTransaction as transition, selectReleaseAction } from "./release-transaction.mjs";

const commit = "a".repeat(40);
function started() {
  return transition(createReleaseTransaction({ version: "1.44.0", sourceCommit: commit }), "start-local", { runId: "1234", runAttempt: "1" });
}
function metadata(tx = started()) {
  return {
    schemaVersion: 1, backend: "wallabot-local", attemptId: tx.attempts.at(-1).attemptId,
    sourceCommit: commit, profile: "production-apk", version: "1.44.0", status: "FINISHED",
    toolchain: { ...localToolchain }, artifact: { filename: "gymnasia.apk", sha256: "b".repeat(64), size: 102000000 },
  };
}

test("reserva la identidad local antes de compilar, sin recurso EAS", () => {
  const tx = started();
  assert.equal(tx.state, "build-running");
  assert.equal(tx.attempts[0].attemptId, `github-1234-1-${commit}`);
  assert.equal(tx.attempts[0].backend, "wallabot-local");
  assert.equal(tx.attempts[0].buildId, undefined);
  assert.equal(tx.attempts[0].artifactUrl, undefined);
  assert.throws(() => transition(tx, "start-local", { runId: "1234", runAttempt: "2" }), /no se recompila/);
  assert.throws(() => transition(tx, "observe", { status: "FINISHED", artifactUrl: "https://expo.dev/a.apk" }), /local/);
});

test("termina, valida y reconcilia exactamente los mismos bytes", () => {
  const finished = transition(started(), "finish-local", { metadata: metadata() });
  const payload = { artifactSha256: "b".repeat(64), artifactSize: 102000000, evidenceSha256: "c".repeat(64) };
  const validated = transition(finished, "validate", payload);
  assert.equal(validated.state, "validated");
  assert.deepEqual(transition(validated, "finish-local", { metadata: metadata() }), validated);
  assert.throws(() => transition(finished, "validate", { ...payload, artifactSize: 102000001 }), /bytes/);
  const substituted = metadata();
  substituted.artifact.sha256 = "d".repeat(64);
  assert.throws(() => transition(validated, "finish-local", { metadata: substituted }), /sustituir/);
});

test("rechaza metadatos de otro SHA, perfil, versión, toolchain o APK", () => {
  for (const [field, value] of [["sourceCommit", "e".repeat(40)], ["profile", "staging"], ["version", "1.43.0"], ["attemptId", "remote-id"], ["backend", "eas-cloud"], ["status", "ERRORED"]]) {
    assert.throws(() => assertLocalBuildMetadata({ ...metadata(), [field]: value }, started(), metadata().artifact));
  }
  assert.throws(() => assertLocalBuildMetadata({ ...metadata(), toolchain: { ...localToolchain, node: "20.0.0" } }, started(), metadata().artifact));
  assert.throws(() => assertLocalBuildMetadata(metadata(), started(), { ...metadata().artifact, sha256: "d".repeat(64) }));
});

test("no acepta entorno, secretos ni rutas privadas en los metadatos", () => {
  for (const field of ["environment", "token", "hostname", "logs", "path", "credentials"]) {
    assert.throws(() => assertLocalBuildMetadata({ ...metadata(), [field]: "untrusted" }, started(), metadata().artifact), /no permitidos/);
  }
});

test("un fallo conserva el intento y requiere operación manual motivada", () => {
  const failed = transition(started(), "fail-local", { reason: "VM apagada antes de generar el APK" });
  assert.equal(failed.attempts.length, 1);
  assert.throws(() => selectReleaseAction({ transactions: [failed], currentVersion: "1.44.1", currentCommit: commit }), /manual/);
  assert.throws(() => transition(failed, "retry", {}), /motivo/);
  assert.throws(() => transition(failed, "supersede", {}), /motivo/);
  const retry = transition(failed, "retry", { reason: "VM reparada y verificada" });
  assert.throws(() => transition(retry, "start-local", { runId: "1234", runAttempt: "1" }), /utilizado/);
  const resumed = transition(retry, "start-local", { runId: "1234", runAttempt: "2" });
  assert.equal(resumed.attempts.length, 2);
  assert.deepEqual(resumed.attempts[0], failed.attempts[0]);
});

test("lee intentos anteriores a los SDK adicionales sin admitir campos arbitrarios", () => {
  const tx = structuredClone(started());
  delete tx.attempts[0].toolchain.androidBuildToolsAdditional;
  delete tx.attempts[0].toolchain.androidPlatformTools;
  const oldMetadata = { ...metadata(), toolchain: { ...tx.attempts[0].toolchain } };
  assertLocalBuildMetadata(oldMetadata, tx, oldMetadata.artifact);
  for (const field of ["token", "environment", "path"]) {
    const altered = structuredClone(tx);
    altered.attempts[0].toolchain[field] = "123";
    assert.throws(() => assertLocalBuildMetadata(oldMetadata, altered, oldMetadata.artifact), /no permitidos/);
  }
  const incomplete = structuredClone(started());
  delete incomplete.attempts[0].toolchain.androidPlatformTools;
  assert.throws(() => assertLocalBuildMetadata(metadata(), incomplete, metadata().artifact), /incompletos/);
});

test("la evidencia debe superar versionCode 52; rechaza códigos inválidos", () => {
  assertVersionCodeProgression("53", "52");
  for (const value of ["52", "51", "0", "-1", "abc", "1.2", "53x", "99999999999999999999", "2100000001"]) {
    assert.throws(() => assertVersionCodeProgression(value, "52"), /versionCode/);
  }
});

test("propiedad: un código repetido o decreciente nunca pasa", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 2100000000 }), fc.nat(), (previous, delta) => {
    assert.throws(() => assertVersionCodeProgression(String(Math.max(1, previous - delta)), String(previous)));
  }));
});
