#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { compareSemver, loadReleasePolicy, parseSemver } from "./production-release.mjs";

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const TERMINAL_STATUSES = new Set(["ERRORED", "CANCELED"]);
const ACTIVE_STATUSES = new Set(["NEW", "IN_QUEUE", "IN_PROGRESS", "PENDING_CANCEL"]);
const GLOBAL_STATES = new Set([
  "prepared", "building", "artifacts-validated", "submitting", "validated", "failed", "superseded",
]);

export const TRANSACTION_ASSET = "android-release-transaction.json";
export const SOURCE_EVIDENCE_ASSET = "production-source-evidence.json";
export const ARTIFACT_EVIDENCE_ASSETS = Object.freeze({
  aab: "production-aab-evidence.json",
  apk: "production-apk-evidence.json",
});
export const PLAY_EVIDENCE_ASSET = "production-play-evidence.json";

function timestamp(value = new Date().toISOString()) {
  if (Number.isNaN(Date.parse(value))) throw new Error(`Fecha inválida: ${value}.`);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} debe ser un entero positivo.`);
  return parsed;
}

function nonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} debe ser un entero no negativo.`);
  return parsed;
}

function cleanReason(value, fallback) {
  const normalized = String(value ?? fallback ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 500);
  return normalized || "EAS terminó sin detalle de error.";
}

function record(transaction, event, now, details = {}) {
  transaction.transitions.push({ event, at: now, ...details });
  transaction.updatedAt = now;
}

function currentAttempt(leg) {
  return leg.attempts.at(-1) ?? null;
}

function deriveState(transaction) {
  if (transaction.state === "superseded") return "superseded";
  const { aab, apk, play } = transaction.legs;
  if ([aab, apk, play].some((leg) => leg.state === "failed")) return "failed";
  if (aab.state === "validated" && apk.state === "validated" && play.state === "validated") return "validated";
  if (["intent", "submitted", "running", "finished"].includes(play.state)) return "submitting";
  if (aab.state === "validated" && apk.state === "validated") return "artifacts-validated";
  if ([aab, apk].some((leg) => leg.state !== "prepared")) return "building";
  return "prepared";
}

export function createReleaseTransaction({
  version,
  sourceCommit,
  minimumVersionCode = 0,
  now = new Date().toISOString(),
}) {
  parseSemver(version);
  if (!COMMIT_PATTERN.test(sourceCommit)) throw new Error("El commit fuente de la transacción no es válido.");
  const at = timestamp(now);
  return {
    schemaVersion: 2,
    kind: "AndroidReleaseTransactionV2",
    id: `android-v${version}`,
    version,
    tag: `v${version}`,
    sourceCommit,
    minimumVersionCode: nonNegativeInteger(minimumVersionCode, "minimumVersionCode"),
    state: "prepared",
    createdAt: at,
    updatedAt: at,
    legs: {
      aab: {
        kind: "build",
        profile: "production",
        artifactType: "aab",
        state: "prepared",
        attempts: [],
      },
      apk: {
        kind: "build",
        profile: "production-apk",
        artifactType: "apk",
        state: "prepared",
        attempts: [],
      },
      play: {
        kind: "submission",
        provider: "eas",
        profile: "production",
        track: "internal",
        releaseStatus: "completed",
        state: "prepared",
        attempts: [],
      },
    },
    transitions: [{ event: "prepared", at, minimumVersionCode: Number(minimumVersionCode) }],
  };
}

export function isLegacyReleaseTransaction(transaction) {
  return transaction?.schemaVersion === 1 && transaction?.kind === "AndroidReleaseTransactionV1";
}

function assertLegacyReleaseTransaction(transaction) {
  parseSemver(transaction.version);
  if (transaction.id !== `android-v${transaction.version}`
    || transaction.tag !== `v${transaction.version}`
    || !COMMIT_PATTERN.test(transaction.sourceCommit)
    || transaction.profile !== "production-apk"
    || transaction.artifactType !== "apk"
    || !Array.isArray(transaction.attempts)
    || !Array.isArray(transaction.transitions)) {
    throw new Error("La transacción histórica V1 no conserva su contrato.");
  }
  return transaction;
}

export function assertReleaseTransaction(transaction, { allowLegacy = true } = {}) {
  if (isLegacyReleaseTransaction(transaction)) {
    if (!allowLegacy) throw new Error("Un borrador V1 histórico no puede reanudarse con el flujo AAB + APK + Play.");
    return assertLegacyReleaseTransaction(transaction);
  }
  if (transaction?.schemaVersion !== 2 || transaction?.kind !== "AndroidReleaseTransactionV2") {
    throw new Error("El asset no cumple AndroidReleaseTransactionV2.");
  }
  parseSemver(transaction.version);
  if (transaction.id !== `android-v${transaction.version}` || transaction.tag !== `v${transaction.version}`) {
    throw new Error("El identificador o tag de la transacción no coincide con su versión.");
  }
  if (!COMMIT_PATTERN.test(transaction.sourceCommit)) throw new Error("La transacción no conserva un SHA fuente válido.");
  nonNegativeInteger(transaction.minimumVersionCode, "minimumVersionCode");
  if (!Array.isArray(transaction.transitions) || !GLOBAL_STATES.has(transaction.state)) {
    throw new Error("La transacción no conserva un estado o historial válido.");
  }
  const expected = {
    aab: ["build", "production", "aab"],
    apk: ["build", "production-apk", "apk"],
  };
  for (const [legName, [kind, profile, artifactType]] of Object.entries(expected)) {
    const leg = transaction.legs?.[legName];
    if (leg?.kind !== kind || leg?.profile !== profile || leg?.artifactType !== artifactType
      || !Array.isArray(leg?.attempts)) {
      throw new Error(`La pata ${legName} no conserva el contrato de build.`);
    }
  }
  const play = transaction.legs?.play;
  if (play?.kind !== "submission" || play?.provider !== "eas" || play?.profile !== "production"
    || play?.track !== "internal" || play?.releaseStatus !== "completed" || !Array.isArray(play?.attempts)) {
    throw new Error("La pata play no conserva el contrato de envío interno.");
  }
  for (const leg of Object.values(transaction.legs)) {
    if (!["prepared", "intent", "submitted", "running", "finished", "validated", "failed"].includes(leg.state)) {
      throw new Error(`Estado de pata inválido: ${leg.state}.`);
    }
  }
  for (const legName of ["aab", "apk"]) {
    const leg = transaction.legs[legName];
    if (leg.state === "validated") {
      const artifact = leg.artifact;
      if (artifact?.filename !== `gymnasia.${legName}`
        || artifact?.versionName !== transaction.version
        || !Number.isSafeInteger(artifact?.versionCode)
        || artifact.versionCode <= transaction.minimumVersionCode
        || !SHA256_PATTERN.test(String(artifact?.sha256 ?? ""))
        || !Number.isSafeInteger(artifact?.size)
        || artifact.size <= 0
        || !SHA256_PATTERN.test(String(artifact?.evidenceSha256 ?? ""))) {
        throw new Error(`La pata ${legName} validada no conserva artefacto, versión y evidencia íntegros.`);
      }
    }
  }
  if (transaction.legs.aab.state === "validated" && transaction.legs.apk.state === "validated"
    && transaction.legs.aab.artifact.versionCode !== transaction.legs.apk.artifact.versionCode) {
    throw new Error("AAB y APK no conservan el mismo versionCode.");
  }
  if (play.state === "validated") {
    const aabBuildId = currentAttempt(transaction.legs.aab)?.buildId;
    const attempt = currentAttempt(play);
    if (!attempt?.submissionId || play.buildId !== aabBuildId
      || play.versionCode !== transaction.legs.aab.artifact?.versionCode
      || !SHA256_PATTERN.test(String(play.evidenceSha256 ?? ""))) {
      throw new Error("La pata Play validada no conserva build, submission, versión y evidencia íntegros.");
    }
  }
  if (transaction.state !== "superseded" && transaction.state !== deriveState(transaction)) {
    throw new Error(`El estado global ${transaction.state} no coincide con sus tres patas.`);
  }
  return transaction;
}

function requireLeg(transaction, name) {
  if (!Object.hasOwn(transaction.legs, name)) throw new Error("--leg debe ser aab, apk o play.");
  return transaction.legs[name];
}

function updateGlobalState(transaction) {
  transaction.state = deriveState(transaction);
}

export function transitionReleaseTransaction(transaction, event, payload = {}) {
  assertReleaseTransaction(transaction, { allowLegacy: false });
  const next = clone(transaction);
  const now = timestamp(payload.now ?? new Date().toISOString());

  if (event === "retry") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede reintentarse.");
    if (!String(payload.reason ?? "").trim()) throw new Error("El reintento manual exige un motivo.");
    const failedLegs = Object.entries(next.legs).filter(([, leg]) => leg.state === "failed");
    for (const [, leg] of failedLegs) leg.state = "prepared";
    updateGlobalState(next);
    record(next, "retry-authorized", now, {
      reason: cleanReason(payload.reason),
      legs: failedLegs.map(([name]) => name),
    });
    return next;
  }
  if (event === "supersede") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede marcarse como sustituida.");
    if (!String(payload.reason ?? "").trim()) throw new Error("Sustituir una versión exige un motivo.");
    next.state = "superseded";
    record(next, "superseded", now, { reason: cleanReason(payload.reason) });
    return next;
  }

  const legName = String(payload.leg ?? "");
  const leg = requireLeg(next, legName);
  const attempt = currentAttempt(leg);

  if (event === "intent") {
    if (leg.state !== "prepared") throw new Error(`No se puede registrar una intención ${legName} desde ${leg.state}.`);
    if (legName === "play") {
      if (next.legs.aab.state !== "validated" || next.legs.apk.state !== "validated") {
        throw new Error("No se puede preparar Play antes de validar AAB y APK.");
      }
      if (payload.buildId !== currentAttempt(next.legs.aab)?.buildId) {
        throw new Error("La intención de Play debe apuntar al AAB validado.");
      }
      leg.buildId = payload.buildId;
      leg.versionCode = next.legs.aab.artifact.versionCode;
    } else if (!String(payload.message ?? "").trim()) {
      throw new Error(`La intención de ${legName} exige un mensaje EAS único.`);
    }
    leg.intent = {
      number: Number(leg.intent?.number ?? 0) + 1,
      at: now,
      ...(legName === "play" ? { buildId: payload.buildId } : { message: payload.message }),
    };
    leg.state = "intent";
    updateGlobalState(next);
    record(next, "external-intent-recorded", now, { leg: legName, ...leg.intent });
    return next;
  }

  if (event === "fail") {
    if (["validated", "failed"].includes(leg.state)) throw new Error(`No se puede marcar ${legName} fallida desde ${leg.state}.`);
    leg.state = "failed";
    leg.reason = cleanReason(payload.reason);
    updateGlobalState(next);
    record(next, "leg-failed", now, { leg: legName, reason: leg.reason });
    return next;
  }

  if (event === "submit") {
    const identifierKey = legName === "play" ? "submissionId" : "buildId";
    const identifier = String(payload[identifierKey] ?? "").trim();
    if (!identifier) throw new Error(`Falta ${identifierKey} para ${legName}.`);
    if (legName === "play") {
      if (next.legs.aab.state !== "validated" || next.legs.apk.state !== "validated") {
        throw new Error("No se puede enviar a Play antes de validar AAB y APK.");
      }
      const aabBuildId = currentAttempt(next.legs.aab)?.buildId;
      if (payload.buildId !== aabBuildId) throw new Error("Play solo puede recibir el AAB validado.");
      leg.buildId = payload.buildId;
      leg.versionCode = next.legs.aab.artifact.versionCode;
    }
    if (attempt?.[identifierKey] === identifier && !["prepared", "intent"].includes(leg.state)) return next;
    if (!["prepared", "intent"].includes(leg.state)) {
      throw new Error(`No se puede enviar ${legName} desde ${leg.state}.`);
    }
    if (attempt?.[identifierKey] === identifier) {
      attempt.status = "NEW";
      attempt.submittedAt = now;
    } else {
      leg.attempts.push({
        number: leg.attempts.length + 1,
        [identifierKey]: identifier,
        ...(legName === "play" ? { buildId: payload.buildId } : {}),
        submittedAt: now,
        status: "NEW",
      });
    }
    leg.state = "submitted";
    updateGlobalState(next);
    record(next, legName === "play" ? "submission-recorded" : "build-recorded", now, {
      leg: legName,
      [identifierKey]: identifier,
    });
    return next;
  }

  if (event === "observe") {
    if (!attempt) throw new Error(`No hay un intento ${legName} que observar.`);
    const status = String(payload.status ?? "").toUpperCase();
    const url = String(payload.artifactUrl ?? "");
    if (attempt.status === status && (!url || attempt.artifactUrl === url)) return next;
    attempt.status = status;
    attempt.observedAt = now;
    if (ACTIVE_STATUSES.has(status)) {
      leg.state = status === "IN_PROGRESS" ? "running" : "submitted";
    } else if (status === "FINISHED") {
      if (legName !== "play" && !url.startsWith("https://")) {
        throw new Error(`EAS terminó ${legName} sin una URL HTTPS de artefacto.`);
      }
      if (url) attempt.artifactUrl = url;
      attempt.finishedAt = now;
      leg.state = "finished";
    } else if (TERMINAL_STATUSES.has(status)) {
      attempt.failedAt = now;
      attempt.reason = cleanReason(payload.reason, `EAS terminó en ${status}.`);
      leg.state = "failed";
    } else {
      throw new Error(`Estado EAS desconocido: ${status || "(vacío)"}.`);
    }
    updateGlobalState(next);
    record(next, legName === "play" ? "submission-observed" : "build-observed", now, {
      leg: legName,
      status,
      id: attempt.submissionId ?? attempt.buildId,
    });
    return next;
  }

  if (event === "validate") {
    if (leg.state === "validated") {
      if (legName === "play") {
        if (Number(payload.versionCode) !== leg.versionCode) {
          throw new Error("Una reconciliación no puede sustituir la versión validada de Play.");
        }
        if (leg.evidenceSha256 === payload.evidenceSha256) return next;
        leg.evidenceSha256 = payload.evidenceSha256;
      } else {
        if (payload.artifactSha256 !== leg.artifact.sha256
          || Number(payload.artifactSize) !== leg.artifact.size
          || payload.versionName !== leg.artifact.versionName
          || Number(payload.versionCode) !== leg.artifact.versionCode) {
          throw new Error(`Una reconciliación no puede sustituir el ${legName} ya validado.`);
        }
        if (leg.artifact.evidenceSha256 === payload.evidenceSha256) return next;
        leg.artifact.evidenceSha256 = payload.evidenceSha256;
      }
      record(next, "evidence-revalidated", now, { leg: legName, evidenceSha256: payload.evidenceSha256 });
      return next;
    }
    if (leg.state !== "finished") throw new Error(`Solo un ${legName} terminado puede validarse.`);
    if (!SHA256_PATTERN.test(String(payload.evidenceSha256 ?? ""))) {
      throw new Error(`La validación de ${legName} exige el SHA-256 de su evidencia.`);
    }
    if (legName === "play") {
      const versionCode = positiveInteger(payload.versionCode, "versionCode de Play");
      if (versionCode !== next.legs.aab.artifact?.versionCode
        || currentAttempt(leg)?.buildId !== currentAttempt(next.legs.aab)?.buildId) {
        throw new Error("La evidencia de Play no corresponde al AAB y versionCode validados.");
      }
      leg.evidenceSha256 = payload.evidenceSha256;
      leg.versionCode = versionCode;
      leg.state = "validated";
    } else {
      const versionCode = positiveInteger(payload.versionCode, `versionCode de ${legName}`);
      if (versionCode <= next.minimumVersionCode) {
        throw new Error(`versionCode ${versionCode} no supera la referencia ${next.minimumVersionCode}.`);
      }
      if (payload.versionName !== next.version) {
        throw new Error(`${legName} declara versionName ${payload.versionName || "(vacío)"}; se esperaba ${next.version}.`);
      }
      const other = next.legs[legName === "aab" ? "apk" : "aab"];
      if (other.state === "validated" && other.artifact.versionCode !== versionCode) {
        throw new Error("AAB y APK deben compartir versionCode.");
      }
      if (!SHA256_PATTERN.test(String(payload.artifactSha256 ?? ""))) {
        throw new Error(`La validación exige el SHA-256 de ${legName}.`);
      }
      const artifactSize = positiveInteger(payload.artifactSize, `tamaño de ${legName}`);
      leg.artifact = {
        filename: `gymnasia.${legName}`,
        sha256: payload.artifactSha256,
        size: artifactSize,
        evidenceSha256: payload.evidenceSha256,
        versionName: payload.versionName,
        versionCode,
      };
      leg.state = "validated";
    }
    updateGlobalState(next);
    record(next, "leg-validated", now, { leg: legName, versionCode: leg.versionCode ?? leg.artifact.versionCode });
    return next;
  }
  throw new Error(`Transición desconocida: ${event}.`);
}

function releaseAsset(release, name) {
  const asset = release?.assets?.find((candidate) => candidate.name === name);
  if (!asset) throw new Error(`La release publicada carece de ${name}.`);
  return asset;
}

function expectedDigest(value) {
  return `sha256:${value}`;
}

function assertPublishedV1({ release, transaction, artifactEvidence, sourceEvidence, currentCommit, policy }) {
  assertLegacyReleaseTransaction(transaction);
  if (release?.draft !== false || release?.immutable !== true
    || release.target_commitish !== currentCommit
    || transaction.sourceCommit !== currentCommit
    || transaction.state !== "validated") {
    throw new Error("La release histórica V1 no coincide con la fuente y transacción actuales.");
  }
  const apk = releaseAsset(release, "gymnasia.apk");
  const artifactEvidenceAsset = releaseAsset(release, "production-artifact-evidence.json");
  const sourceEvidenceAsset = releaseAsset(release, SOURCE_EVIDENCE_ASSET);
  releaseAsset(release, TRANSACTION_ASSET);
  if (apk.content_type !== policy.artifacts.apk.githubMimeType
    || apk.digest !== expectedDigest(transaction.artifact.sha256)
    || apk.size !== transaction.artifact.size
    || artifactEvidenceAsset.digest !== expectedDigest(transaction.artifact.evidenceSha256)
    || sourceEvidenceAsset.digest !== expectedDigest(artifactEvidence.source.evidenceSha256)
    || artifactEvidence?.source?.commit !== currentCommit
    || sourceEvidence?.commit !== currentCommit) {
    throw new Error("La release histórica V1 no conserva su cadena exacta de hashes.");
  }
  return true;
}

export function assertPublishedRelease({
  release,
  transaction,
  artifactEvidences,
  artifactEvidence,
  sourceEvidence,
  playEvidence,
  currentCommit,
  policy = loadReleasePolicy(),
}) {
  if (isLegacyReleaseTransaction(transaction)) {
    return assertPublishedV1({ release, transaction, artifactEvidence, sourceEvidence, currentCommit, policy });
  }
  assertReleaseTransaction(transaction, { allowLegacy: false });
  if (release?.draft !== false || release?.immutable !== true
    || release.target_commitish !== currentCommit
    || transaction.sourceCommit !== currentCommit
    || transaction.state !== "validated") {
    throw new Error("La release de Production no está publicada, inmutable o ligada a la fuente exacta.");
  }
  releaseAsset(release, TRANSACTION_ASSET);
  const sourceAsset = releaseAsset(release, SOURCE_EVIDENCE_ASSET);
  for (const legName of ["aab", "apk"]) {
    const leg = transaction.legs[legName];
    const artifact = releaseAsset(release, leg.artifact.filename);
    const evidenceAsset = releaseAsset(release, ARTIFACT_EVIDENCE_ASSETS[legName]);
    const evidence = artifactEvidences?.[legName];
    const artifactPolicy = policy.artifacts[legName];
    if (artifact.content_type !== artifactPolicy.githubMimeType
      || artifact.size < artifactPolicy.minBytes
      || artifact.size > artifactPolicy.maxBytes
      || artifact.digest !== expectedDigest(leg.artifact.sha256)
      || artifact.size !== leg.artifact.size
      || evidenceAsset.digest !== expectedDigest(leg.artifact.evidenceSha256)
      || evidence?.schemaVersion !== 2
      || evidence?.kind !== "ProductionArtifactEvidenceV2"
      || evidence?.result !== "passed"
      || evidence?.source?.commit !== currentCommit
      || evidence?.source?.profile !== leg.profile
      || evidence?.build?.id !== currentAttempt(leg)?.buildId
      || evidence?.artifact?.publishedFilename !== leg.artifact.filename
      || evidence?.artifact?.type !== leg.artifactType
      || evidence?.artifact?.versionName !== transaction.version
      || Number(evidence?.artifact?.versionCode) !== leg.artifact.versionCode
      || evidence?.artifact?.sha256 !== leg.artifact.sha256
      || evidence?.artifact?.size !== leg.artifact.size) {
      throw new Error(`La evidencia publicada de ${legName} no describe la transacción exacta.`);
    }
  }
  if (sourceEvidence?.schemaVersion !== 2
    || sourceEvidence?.kind !== "ProductionSourceEvidenceV2"
    || sourceEvidence?.result !== "passed"
    || sourceEvidence?.commit !== currentCommit
    || sourceEvidence?.appVersion !== transaction.version
    || sourceAsset.digest !== expectedDigest(artifactEvidences.aab.source.evidenceSha256)
    || artifactEvidences.aab.source.evidenceSha256 !== artifactEvidences.apk.source.evidenceSha256) {
    throw new Error("La evidencia de fuente publicada no autoriza conjuntamente ambos artefactos.");
  }
  const playAsset = releaseAsset(release, PLAY_EVIDENCE_ASSET);
  const play = transaction.legs.play;
  const playAttempt = currentAttempt(play);
  if (playAsset.digest !== expectedDigest(play.evidenceSha256)
    || playEvidence?.schemaVersion !== 1
    || playEvidence?.kind !== "ProductionPlayEvidenceV1"
    || playEvidence?.result !== "passed"
    || playEvidence?.provider !== play.provider
    || playEvidence?.profile !== play.profile
    || playEvidence?.track !== play.track
    || playEvidence?.releaseStatus !== play.releaseStatus
    || playEvidence?.buildId !== play.buildId
    || playEvidence?.submissionId !== playAttempt?.submissionId
    || playEvidence?.status !== "FINISHED"
    || Number(playEvidence?.versionCode) !== play.versionCode) {
    throw new Error("La evidencia de Play no describe el AAB enviado y confirmado.");
  }
  return true;
}

export function selectReleaseAction({
  transactions,
  publishedVersions,
  currentVersion,
  currentCommit,
  minimumVersionCode = 0,
  operation = "reconcile",
  targetVersion = "",
  reason = "",
}) {
  parseSemver(currentVersion);
  const published = new Set(publishedVersions);
  for (const transaction of transactions) assertReleaseTransaction(transaction, { allowLegacy: false });
  const superseded = transactions.filter((transaction) => transaction.state === "superseded");
  const pending = transactions
    .filter((transaction) => !published.has(transaction.version) && transaction.state !== "superseded")
    .sort((left, right) => compareSemver(left.version, right.version));
  const latestPublished = [...published].sort(compareSemver).at(-1);
  if (latestPublished && pending.some((transaction) => compareSemver(transaction.version, latestPublished) <= 0)) {
    throw new Error("Existe un draft pendiente anterior a una release ya publicada.");
  }
  const oldest = pending[0];
  if (oldest) {
    if (targetVersion && targetVersion !== oldest.version) {
      throw new Error(`La transacción más antigua es ${oldest.version}; no se puede operar ${targetVersion}.`);
    }
    if (oldest.state === "failed") {
      if (operation === "retry-failed") {
        if (!reason.trim()) throw new Error("El reintento exige --reason.");
        return { action: "build", mode: "retry", transaction: oldest, reason };
      }
      if (operation === "supersede-failed") {
        if (!reason.trim()) throw new Error("Sustituir la versión exige --reason.");
        if (compareSemver(currentVersion, oldest.version) <= 0) {
          throw new Error("Sustituir una versión fallida exige que main declare una versión posterior.");
        }
        return { action: "supersede", mode: "supersede", transaction: oldest, reason };
      }
      throw new Error(`La versión ${oldest.version} falló; requiere reintento o sustitución manual con motivo.`);
    }
    if (operation !== "reconcile") throw new Error(`La versión ${oldest.version} no está fallida.`);
    return { action: "build", mode: "resume", transaction: oldest };
  }
  if (operation !== "reconcile") throw new Error("No existe una transacción fallida que operar.");
  if (published.has(currentVersion)) return { action: "verify-published", mode: "published" };
  const currentSuperseded = superseded.find((transaction) => transaction.version === currentVersion);
  if (currentSuperseded) return { action: "noop", mode: "superseded", transaction: currentSuperseded };
  if (latestPublished && compareSemver(currentVersion, latestPublished) <= 0) {
    throw new Error(`La versión fuente ${currentVersion} no es posterior a ${latestPublished}.`);
  }
  return {
    action: "build",
    mode: "new",
    transaction: createReleaseTransaction({ version: currentVersion, sourceCommit: currentCommit, minimumVersionCode }),
  };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Argumento inválido: ${key}.`);
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function writeJson(path, value) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function githubHeaders(accept = "application/vnd.github+json") {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error("Falta GITHUB_TOKEN para reconciliar releases.");
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "User-Agent": "gymnasia-android-release-transaction",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson(url, accept) {
  const response = await fetch(url, { headers: githubHeaders(accept) });
  if (!response.ok) throw new Error(`GitHub devolvió HTTP ${response.status} para ${url}.`);
  return response.json();
}

async function listReleases(repository) {
  const releases = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubJson(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) return releases;
  }
}

async function downloadJsonAsset(repository, asset) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
    { headers: githubHeaders("application/octet-stream") },
  );
  if (!response.ok) throw new Error(`No se pudo descargar ${asset.name}: HTTP ${response.status}.`);
  return response.json();
}

function releaseVersion(release) {
  const value = String(release.tag_name ?? "").replace(/^v/, "");
  try {
    parseSemver(value);
    return value;
  } catch {
    return null;
  }
}

async function latestPublishedVersionCode(repository, publishedReleases) {
  const ordered = [...publishedReleases].sort((left, right) => compareSemver(releaseVersion(right), releaseVersion(left)));
  for (const release of ordered) {
    const asset = release.assets?.find((candidate) => candidate.name === TRANSACTION_ASSET);
    if (!asset) continue;
    const transaction = await downloadJsonAsset(repository, asset);
    if (transaction?.schemaVersion === 2 && Number.isSafeInteger(transaction.legs?.play?.versionCode)) {
      return transaction.legs.play.versionCode;
    }
  }
  return 0;
}

async function selectRemote(options) {
  const policy = loadReleasePolicy();
  const releases = await listReleases(policy.repository);
  const publishedReleases = releases.filter((release) => !release.draft && !release.prerelease && releaseVersion(release));
  const draftReleases = releases.filter((release) => release.draft && releaseVersion(release));
  const transactions = [];
  const releasesByVersion = new Map();
  for (const release of draftReleases) {
    const asset = release.assets?.find((candidate) => candidate.name === TRANSACTION_ASSET);
    const bodyFallback = String(release.body ?? "").match(/<!-- android-release-transaction:([A-Za-z0-9+/=]+) -->/)?.[1];
    if (!asset && !bodyFallback) throw new Error(`El draft ${release.tag_name} no conserva ${TRANSACTION_ASSET}.`);
    const transaction = asset
      ? await downloadJsonAsset(policy.repository, asset)
      : JSON.parse(Buffer.from(bodyFallback, "base64").toString("utf8"));
    if (isLegacyReleaseTransaction(transaction)) {
      throw new Error(`El draft histórico ${release.tag_name} usa V1 y requiere resolución manual antes de continuar.`);
    }
    assertReleaseTransaction(transaction, { allowLegacy: false });
    if (transaction.version !== releaseVersion(release)) {
      throw new Error(`El draft ${release.tag_name} contiene una transacción de otra versión.`);
    }
    if (releasesByVersion.has(transaction.version)) throw new Error(`Hay más de un draft para ${transaction.version}.`);
    transactions.push(transaction);
    releasesByVersion.set(transaction.version, release);
  }
  const configuredFloor = nonNegativeInteger(options["play-version-code-floor"] ?? 0, "PLAY_VERSION_CODE_FLOOR");
  const publishedFloor = await latestPublishedVersionCode(policy.repository, publishedReleases);
  const minimumVersionCode = Math.max(configuredFloor, publishedFloor);
  const selection = selectReleaseAction({
    transactions,
    publishedVersions: publishedReleases.map(releaseVersion),
    currentVersion: options["current-version"],
    currentCommit: options["current-commit"],
    minimumVersionCode,
    operation: options.operation ?? "reconcile",
    targetVersion: options["target-version"] ?? "",
    reason: options.reason ?? "",
  });

  if (selection.action === "verify-published") {
    const release = publishedReleases.find((candidate) => releaseVersion(candidate) === options["current-version"]);
    const transaction = await downloadJsonAsset(policy.repository, releaseAsset(release, TRANSACTION_ASSET));
    const sourceEvidence = await downloadJsonAsset(policy.repository, releaseAsset(release, SOURCE_EVIDENCE_ASSET));
    if (isLegacyReleaseTransaction(transaction)) {
      const artifactEvidence = await downloadJsonAsset(policy.repository, releaseAsset(release, "production-artifact-evidence.json"));
      assertPublishedRelease({ release, transaction, artifactEvidence, sourceEvidence, currentCommit: options["current-commit"], policy });
    } else {
      const [aabEvidence, apkEvidence, playEvidence] = await Promise.all([
        downloadJsonAsset(policy.repository, releaseAsset(release, ARTIFACT_EVIDENCE_ASSETS.aab)),
        downloadJsonAsset(policy.repository, releaseAsset(release, ARTIFACT_EVIDENCE_ASSETS.apk)),
        downloadJsonAsset(policy.repository, releaseAsset(release, PLAY_EVIDENCE_ASSET)),
      ]);
      assertPublishedRelease({
        release,
        transaction,
        artifactEvidences: { aab: aabEvidence, apk: apkEvidence },
        sourceEvidence,
        playEvidence,
        currentCommit: options["current-commit"],
        policy,
      });
    }
    selection.transaction = transaction;
  } else {
    const release = releasesByVersion.get(selection.transaction.version);
    selection.releaseId = release?.id ?? null;
  }
  selection.minimumVersionCode = minimumVersionCode;
  writeJson(options.output, selection);
  if (options["github-output"]) {
    const lines = [
      `action=${selection.action}`,
      `mode=${selection.mode}`,
      `version=${selection.transaction?.version ?? options["current-version"]}`,
      `tag=${selection.transaction?.tag ?? `v${options["current-version"]}`}`,
      `source_commit=${selection.transaction?.sourceCommit ?? options["current-commit"]}`,
      `release_id=${selection.releaseId ?? ""}`,
      `minimum_version_code=${minimumVersionCode}`,
    ];
    writeFileSync(resolve(options["github-output"]), `${lines.join("\n")}\n`, { flag: "a" });
  }
  console.log(`Selección Production: ${selection.action}/${selection.mode} ${selection.transaction?.version ?? options["current-version"]}.`);
}

function transition(options) {
  const transaction = JSON.parse(readFileSync(resolve(options.input), "utf8"));
  const payload = {
    leg: options.leg,
    buildId: options["build-id"],
    submissionId: options["submission-id"],
    status: options.status,
    artifactUrl: options["artifact-url"],
    reason: options.reason,
    artifactSha256: options["artifact-sha256"],
    artifactSize: options["artifact-size"],
    evidenceSha256: options["evidence-sha256"],
    versionCode: options["version-code"],
    versionName: options["version-name"],
    message: options.message,
  };
  writeJson(options.output, transitionReleaseTransaction(transaction, options.event, payload));
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === "select-remote") return selectRemote(options);
  if (command === "transition") return transition(options);
  throw new Error("Uso: release-transaction.mjs select-remote|transition ...");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
