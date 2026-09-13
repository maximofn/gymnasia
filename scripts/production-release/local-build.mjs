import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const localToolchain = Object.freeze(JSON.parse(readFileSync(
  new URL("../../ops/android-build/toolchain.json", import.meta.url), "utf8",
)));

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function localAttemptId({ runId, runAttempt, sourceCommit }) {
  if (!/^[1-9]\d*$/.test(String(runId)) || !/^[1-9]\d*$/.test(String(runAttempt))
    || !/^[a-f0-9]{40}$/.test(String(sourceCommit))) {
    throw new Error("El intento local exige run ID, run attempt y SHA exactos.");
  }
  return `github-${runId}-${runAttempt}-${sourceCommit}`;
}

export function assertLocalAttempt(attempt, transaction) {
  assert.equal(attempt.backend, "wallabot-local", "Backend local incorrecto.");
  assert.equal(attempt.attemptId, localAttemptId(attempt), "Identidad local incorrecta.");
  assert.equal(attempt.sourceCommit, transaction.sourceCommit, "El intento cambia la fuente validada.");
  assert.equal(attempt.version, transaction.version, "El intento cambia la versión.");
  assert.equal(attempt.profile, transaction.profile, "El intento cambia el perfil.");
  // Historical attempts remain readable after a toolchain update or rollback.
  // The build worker separately requires equality with the current lock.
  assert.deepEqual(Object.keys(attempt.toolchain ?? {}).sort(), Object.keys(localToolchain).sort());
  assert.equal(attempt.toolchain.schemaVersion, 1);
  for (const [key, value] of Object.entries(attempt.toolchain)) {
    if (key !== "schemaVersion") assert.match(value, /^\d+(?:\.\d+){0,3}$/, "Versión de toolchain inválida.");
  }
}

export function assertLocalBuildMetadata(metadata, transaction, artifact) {
  const attempt = transaction.attempts.at(-1);
  assertLocalAttempt(attempt, transaction);
  // Reject arbitrary environment, host paths and other unreviewed fields.
  assert.deepEqual(Object.keys(metadata).sort(), [
    "artifact", "attemptId", "backend", "profile", "schemaVersion", "sourceCommit", "status", "toolchain", "version",
  ].sort(), "Los metadatos locales contienen campos no permitidos.");
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.status, "FINISHED");
  for (const key of ["attemptId", "backend", "profile", "sourceCommit", "version"]) {
    assert.equal(metadata[key], attempt[key], `Metadato local incorrecto: ${key}.`);
  }
  assert.deepEqual(metadata.toolchain, attempt.toolchain);
  assert.deepEqual(metadata.artifact, { filename: "gymnasia.apk", sha256: artifact.sha256, size: artifact.size });
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.size) || artifact.size <= 0) {
    throw new Error("El resultado local no conserva el hash y tamaño del APK.");
  }
  if (attempt.artifact) assert.deepEqual(attempt.artifact, metadata.artifact, "No se puede sustituir un resultado local.");
  return metadata;
}

export function assertVersionCodeProgression(current, previous) {
  if (!/^[1-9]\d*$/.test(String(current)) || !/^[1-9]\d*$/.test(String(previous))
    || !Number.isSafeInteger(Number(current)) || !Number.isSafeInteger(Number(previous))
    || Number(current) > 2100000000 || Number(current) <= Number(previous)) {
    throw new Error("El versionCode debe ser válido y superar al último APK publicado.");
  }
}
