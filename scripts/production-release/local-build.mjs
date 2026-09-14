import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const localToolchain = Object.freeze(JSON.parse(readFileSync(
  new URL("../../ops/android-build/toolchain.json", import.meta.url), "utf8",
)));

const LEG_CONTRACT = Object.freeze({
  aab: { profile: "production", filename: "gymnasia.aab" },
  apk: { profile: "production-apk", filename: "gymnasia.apk" },
});

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function localAttemptId({ runId, runAttempt, sourceCommit, leg }) {
  if (!/^[1-9]\d*$/.test(String(runId)) || !/^[1-9]\d*$/.test(String(runAttempt))
    || !/^[a-f0-9]{40}$/.test(String(sourceCommit)) || (leg && !LEG_CONTRACT[leg])) {
    throw new Error("El intento local exige pata, run ID, run attempt y SHA exactos.");
  }
  const suffix = leg ? `-${leg}` : "";
  return `github-${runId}-${runAttempt}-${sourceCommit}${suffix}`;
}

function assertToolchain(toolchain) {
  const keys = Object.keys(toolchain ?? {}).sort();
  const currentKeys = Object.keys(localToolchain).sort();
  const originalKeys = currentKeys.filter((key) => ![
    "androidBuildToolsAdditional", "androidPlatformTools",
  ].includes(key));
  assert.ok(JSON.stringify(keys) === JSON.stringify(currentKeys)
    || JSON.stringify(keys) === JSON.stringify(originalKeys),
  "Campos de toolchain no permitidos o incompletos.");
  assert.equal(toolchain.schemaVersion, 1);
  for (const [key, value] of Object.entries(toolchain)) {
    if (key !== "schemaVersion") assert.match(value, /^\d+(?:\.\d+){0,3}$/, "Versión de toolchain inválida.");
  }
}

export function assertLocalAttempt(attempt, transaction, leg = attempt?.leg) {
  assert.equal(attempt.backend, "wallabot-local", "Backend local incorrecto.");
  assert.equal(attempt.attemptId, localAttemptId({ ...attempt, leg }), "Identidad local incorrecta.");
  assert.equal(attempt.sourceCommit, transaction.sourceCommit, "El intento cambia la fuente validada.");
  assert.equal(attempt.version, transaction.version, "El intento cambia la versión.");
  if (transaction.schemaVersion === 1) {
    assert.equal(attempt.profile, transaction.profile, "El intento cambia el perfil.");
  } else {
    assert.ok(LEG_CONTRACT[leg], "Pata local desconocida.");
    assert.equal(attempt.leg, leg, "El intento cambia de pata.");
    assert.equal(attempt.profile, LEG_CONTRACT[leg].profile, "El intento cambia el perfil de su pata.");
  }
  // Historical attempts remain readable after a toolchain update or rollback.
  assertToolchain(attempt.toolchain);
}

export function assertLocalBuildMetadata(metadata, transaction, artifact, leg = metadata?.leg) {
  const container = transaction.schemaVersion === 2 ? transaction.legs?.[leg] : transaction;
  const attempt = container?.attempts?.at(-1);
  assertLocalAttempt(attempt, transaction, transaction.schemaVersion === 2 ? leg : undefined);
  const v1Keys = [
    "artifact", "attemptId", "backend", "profile", "schemaVersion", "sourceCommit", "status", "toolchain", "version",
  ].sort();
  const v2Keys = [...v1Keys, "leg"].sort();
  assert.deepEqual(Object.keys(metadata).sort(), transaction.schemaVersion === 2 ? v2Keys : v1Keys,
    "Los metadatos locales contienen campos no permitidos.");
  assert.equal(metadata.schemaVersion, transaction.schemaVersion === 2 ? 2 : 1);
  assert.equal(metadata.status, "FINISHED");
  for (const key of ["attemptId", "backend", "profile", "sourceCommit", "version"]) {
    assert.equal(metadata[key], attempt[key], `Metadato local incorrecto: ${key}.`);
  }
  if (transaction.schemaVersion === 2) assert.equal(metadata.leg, leg);
  assert.deepEqual(metadata.toolchain, attempt.toolchain);
  const filename = transaction.schemaVersion === 2 ? LEG_CONTRACT[leg].filename : "gymnasia.apk";
  assert.deepEqual(metadata.artifact, { filename, sha256: artifact.sha256, size: artifact.size });
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.size) || artifact.size <= 0) {
    throw new Error("El resultado local no conserva el hash y tamaño del artefacto.");
  }
  if (attempt.artifact) assert.deepEqual(attempt.artifact, metadata.artifact, "No se puede sustituir un resultado local.");
  return metadata;
}

export function assertVersionCodeProgression(current, floor) {
  if (!/^[1-9]\d*$/.test(String(current)) || !/^(0|[1-9]\d*)$/.test(String(floor))
    || !Number.isSafeInteger(Number(current)) || !Number.isSafeInteger(Number(floor))
    || Number(current) > 2100000000 || Number(current) <= Number(floor)) {
    throw new Error("El versionCode debe ser válido y superar la referencia de Play y la última evidencia publicada.");
  }
}

export function assertSharedVersionCode(aabVersionCode, apkVersionCode) {
  if (!/^[1-9]\d*$/.test(String(aabVersionCode)) || String(aabVersionCode) !== String(apkVersionCode)) {
    throw new Error("El AAB y el APK deben compartir exactamente el mismo versionCode.");
  }
}
