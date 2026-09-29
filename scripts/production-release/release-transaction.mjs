#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { compareSemver, loadReleasePolicy, parseSemver } from "./production-release.mjs";
import {
  assertLocalAttempt,
  assertLocalBuildMetadata,
  assertSharedVersionCode,
  assertVersionCodeProgression,
  localAttemptId,
  localToolchain,
} from "./local-build.mjs";

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BUILD_LEGS = new Set(["aab", "apk"]);
const ACTIVE_SUBMISSION_STATUSES = new Set(["NEW", "IN_QUEUE", "IN_PROGRESS", "AWAITING_BUILD"]);
const FAILED_SUBMISSION_STATUSES = new Set(["ERRORED", "CANCELED"]);
const LEG_CONTRACT = Object.freeze({
  aab: { profile: "production", artifactType: "aab", filename: "gymnasia.aab" },
  apk: { profile: "production-apk", artifactType: "apk", filename: "gymnasia.apk" },
});

export const TRANSACTION_ASSET = "android-release-transaction.json";
export const EVIDENCE_ASSETS = Object.freeze({
  source: "production-source-evidence.json",
  aab: "production-aab-evidence.json",
  apk: "production-apk-evidence.json",
  play: "production-play-evidence.json",
});

function timestamp(value = new Date().toISOString()) {
  if (Number.isNaN(Date.parse(value))) throw new Error(`Fecha inválida: ${value}.`);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function record(transaction, event, now, details = {}) {
  transaction.transitions.push({ event, at: now, ...details });
  transaction.updatedAt = now;
}

function publicError(reason) {
  const value = String(reason ?? "").trim().replaceAll(/(?:expo|eas|google)?[_-]?(?:token|key|secret|credential)\s*[:=]\s*\S+/gi, "[credencial saneada]");
  if (!value) throw new Error("El fallo exige un motivo accionable.");
  return value.slice(0, 500);
}

export function createReleaseTransaction({ version, sourceCommit, now = new Date().toISOString() }) {
  parseSemver(version);
  if (!COMMIT_PATTERN.test(sourceCommit)) throw new Error("El commit fuente de la transacción no es válido.");
  const at = timestamp(now);
  return {
    schemaVersion: 2,
    kind: "AndroidReleaseTransactionV2",
    id: `android-v${version}`,
    version,
    versionCode: null,
    tag: `v${version}`,
    sourceCommit,
    state: "prepared",
    createdAt: at,
    updatedAt: at,
    legs: {
      aab: { ...LEG_CONTRACT.aab, state: "prepared", attempts: [] },
      apk: { ...LEG_CONTRACT.apk, state: "prepared", attempts: [] },
      play: {
        provider: "eas",
        profile: "production",
        track: "internal",
        releaseStatus: "completed",
        state: "prepared",
        attempts: [],
      },
    },
    transitions: [{ event: "prepared", at }],
  };
}

function assertLegacyTransaction(transaction) {
  if (transaction?.schemaVersion !== 1 || transaction?.kind !== "AndroidReleaseTransactionV1") {
    throw new Error("El asset no cumple AndroidReleaseTransactionV1 ni V2.");
  }
  parseSemver(transaction.version);
  if (transaction.id !== `android-v${transaction.version}` || transaction.tag !== `v${transaction.version}`
    || !COMMIT_PATTERN.test(transaction.sourceCommit) || transaction.profile !== "production-apk"
    || transaction.artifactType !== "apk" || !Array.isArray(transaction.attempts)
    || !Array.isArray(transaction.transitions)) {
    throw new Error("La transacción histórica V1 está dañada.");
  }
  for (const attempt of transaction.attempts) {
    if (attempt.backend === "wallabot-local") assertLocalAttempt(attempt, transaction);
    else if (attempt.backend && attempt.backend !== "eas-cloud") throw new Error("Backend histórico desconocido.");
  }
  return transaction;
}

export function assertReleaseTransaction(transaction) {
  if (transaction?.schemaVersion === 1) return assertLegacyTransaction(transaction);
  if (transaction?.schemaVersion !== 2 || transaction?.kind !== "AndroidReleaseTransactionV2") {
    throw new Error("El asset no cumple AndroidReleaseTransactionV2.");
  }
  parseSemver(transaction.version);
  if (transaction.id !== `android-v${transaction.version}` || transaction.tag !== `v${transaction.version}`
    || !COMMIT_PATTERN.test(transaction.sourceCommit) || !Array.isArray(transaction.transitions)) {
    throw new Error("La identidad o el historial de la transacción V2 no son válidos.");
  }
  for (const leg of BUILD_LEGS) {
    const value = transaction.legs?.[leg];
    const contract = LEG_CONTRACT[leg];
    if (value?.profile !== contract.profile || value?.artifactType !== contract.artifactType
      || !Array.isArray(value?.attempts)) throw new Error(`La pata ${leg} no cumple su contrato.`);
    if (!["prepared", "building", "built", "validated", "failed"].includes(value.state)) {
      throw new Error(`Estado inválido en la pata ${leg}: ${value.state}.`);
    }
    for (const attempt of value.attempts) assertLocalAttempt(attempt, transaction, leg);
    if (value.state === "validated") {
      if (value.artifact?.filename !== contract.filename || !SHA256_PATTERN.test(value.artifact?.sha256 ?? "")
        || !SHA256_PATTERN.test(value.artifact?.evidenceSha256 ?? "")
        || !Number.isSafeInteger(value.artifact?.size) || value.artifact.size <= 0
        || !/^[1-9]\d*$/.test(String(value.artifact?.versionCode))) {
        throw new Error(`La pata ${leg} validada no conserva artefacto y evidencia íntegros.`);
      }
    }
  }
  const play = transaction.legs?.play;
  if (play?.provider !== "eas" || play?.profile !== "production" || play?.track !== "internal"
    || play?.releaseStatus !== "completed" || !Array.isArray(play?.attempts)) {
    throw new Error("La pata Play no cumple su contrato.");
  }
  if (!["prepared", "submitting", "submitted", "retry-pending", "validated", "failed", "uncertain"].includes(play.state)) {
    throw new Error(`Estado inválido en la pata Play: ${play.state}.`);
  }
  if (transaction.versionCode !== null && !/^[1-9]\d*$/.test(String(transaction.versionCode))) {
    throw new Error("versionCode de transacción inválido.");
  }
  if (transaction.legs.aab.state === "validated" && transaction.legs.apk.state === "validated") {
    assertSharedVersionCode(transaction.legs.aab.artifact.versionCode, transaction.legs.apk.artifact.versionCode);
    if (String(transaction.versionCode) !== String(transaction.legs.aab.artifact.versionCode)) {
      throw new Error("La transacción no conserva el versionCode común.");
    }
  }
  if (![
    "prepared", "building", "artifacts-validated", "submitting", "validated", "failed", "superseded",
  ].includes(transaction.state)) throw new Error(`Estado de transacción inválido: ${transaction.state}.`);
  if (transaction.state === "validated" && (play.state !== "validated" || !play.submission?.id
    || !SHA256_PATTERN.test(play.evidenceSha256 ?? ""))) {
    throw new Error("La transacción validada no conserva el envío de Play y su evidencia.");
  }
  return transaction;
}

function requireLeg(transaction, leg, { play = false } = {}) {
  if ((play ? leg !== "play" : !BUILD_LEGS.has(leg)) || !transaction.legs?.[leg]) {
    throw new Error(`Pata inválida: ${leg || "(vacía)"}.`);
  }
  return transaction.legs[leg];
}

function latestAttempt(leg) {
  return leg.attempts.at(-1) ?? null;
}

function refreshGlobalState(transaction) {
  if (transaction.state === "superseded") return;
  if ([transaction.legs.aab, transaction.legs.apk, transaction.legs.play].some((leg) => leg.state === "failed" || leg.state === "uncertain")) {
    transaction.state = "failed";
  } else if (transaction.legs.play.state === "validated") {
    transaction.state = "validated";
  } else if (["submitting", "submitted", "retry-pending"].includes(transaction.legs.play.state)) {
    transaction.state = "submitting";
  } else if (transaction.legs.aab.state === "validated" && transaction.legs.apk.state === "validated") {
    transaction.state = "artifacts-validated";
  } else if ([transaction.legs.aab, transaction.legs.apk].some((leg) => ["building", "built"].includes(leg.state))) {
    transaction.state = "building";
  } else {
    transaction.state = "prepared";
  }
}

export function transitionReleaseTransaction(transaction, event, payload = {}) {
  assertReleaseTransaction(transaction);
  if (transaction.schemaVersion !== 2 && event !== "supersede") {
    throw new Error("Una transacción histórica V1 solo puede leerse o sustituirse manualmente.");
  }
  const next = clone(transaction);
  const now = timestamp(payload.now ?? new Date().toISOString());

  if (event === "start-local") {
    const leg = requireLeg(next, payload.leg);
    if (leg.state !== "prepared") throw new Error(`La pata ${payload.leg} no está preparada.`);
    if (payload.leg === "apk" && !["building", "built", "validated"].includes(next.legs.aab.state)) {
      throw new Error("El AAB debe reservar versionCode antes de iniciar el APK.");
    }
    const attemptId = localAttemptId({ ...payload, sourceCommit: next.sourceCommit, leg: payload.leg });
    if (leg.attempts.some((attempt) => attempt.attemptId === attemptId)) throw new Error("El intento local ya se ha utilizado.");
    leg.attempts.push({
      number: leg.attempts.length + 1,
      leg: payload.leg,
      backend: "wallabot-local",
      attemptId,
      runId: String(payload.runId),
      runAttempt: String(payload.runAttempt),
      sourceCommit: next.sourceCommit,
      profile: leg.profile,
      version: next.version,
      toolchain: { ...localToolchain },
      status: "IN_PROGRESS",
      startedAt: now,
    });
    leg.state = "building";
    refreshGlobalState(next);
    record(next, "local-started", now, { leg: payload.leg, attemptId });
    return next;
  }

  if (event === "finish-local") {
    const leg = requireLeg(next, payload.leg);
    assertLocalBuildMetadata(payload.metadata, next, payload.metadata?.artifact ?? {}, payload.leg);
    const attempt = latestAttempt(leg);
    if (leg.state === "built" || leg.state === "validated") return next;
    if (leg.state !== "building") throw new Error(`La pata ${payload.leg} no está compilando.`);
    attempt.status = "FINISHED";
    attempt.finishedAt = now;
    attempt.artifact = { ...payload.metadata.artifact };
    leg.state = "built";
    refreshGlobalState(next);
    record(next, "local-finished", now, { leg: payload.leg, attemptId: attempt.attemptId, artifactSha256: attempt.artifact.sha256 });
    return next;
  }

  if (event === "fail-local") {
    const leg = requireLeg(next, payload.leg);
    const attempt = latestAttempt(leg);
    if (attempt?.backend !== "wallabot-local" || !["building", "built"].includes(leg.state)) {
      throw new Error(`Solo un intento local pendiente de ${payload.leg} puede marcarse fallido.`);
    }
    attempt.status = "ERRORED";
    attempt.failedAt = now;
    attempt.reason = publicError(payload.reason);
    leg.state = "failed";
    refreshGlobalState(next);
    record(next, "local-failed", now, { leg: payload.leg, attemptId: attempt.attemptId, reason: attempt.reason });
    return next;
  }

  if (event === "validate-artifact") {
    const leg = requireLeg(next, payload.leg);
    const attempt = latestAttempt(leg);
    if (attempt?.artifact?.sha256 !== payload.artifactSha256
      || attempt?.artifact?.size !== Number(payload.artifactSize)) {
      throw new Error(`La validación de ${payload.leg} no coincide con los bytes de wallabot.`);
    }
    if (!SHA256_PATTERN.test(payload.artifactSha256 ?? "") || !SHA256_PATTERN.test(payload.evidenceSha256 ?? "")
      || !Number.isSafeInteger(Number(payload.artifactSize)) || Number(payload.artifactSize) <= 0
      || !/^[1-9]\d*$/.test(String(payload.versionCode))) {
      throw new Error("La validación exige hashes, tamaño y versionCode válidos.");
    }
    if (leg.state === "validated") {
      if (leg.artifact.sha256 !== payload.artifactSha256 || leg.artifact.size !== Number(payload.artifactSize)
        || String(leg.artifact.versionCode) !== String(payload.versionCode)) {
        throw new Error(`Una reconciliación no puede sustituir el ${payload.leg.toUpperCase()} validado.`);
      }
      if (leg.artifact.evidenceSha256 === payload.evidenceSha256) return next;
      leg.artifact.evidenceSha256 = payload.evidenceSha256;
      record(next, "evidence-revalidated", now, { leg: payload.leg, evidenceSha256: payload.evidenceSha256 });
      return next;
    }
    if (leg.state !== "built") throw new Error(`Solo un ${payload.leg.toUpperCase()} terminado puede validarse.`);
    if (payload.leg === "aab") assertVersionCodeProgression(payload.versionCode, payload.versionCodeFloor ?? 0);
    const other = next.legs[payload.leg === "aab" ? "apk" : "aab"];
    if (other.state === "validated") assertSharedVersionCode(other.artifact.versionCode, payload.versionCode);
    leg.artifact = {
      filename: LEG_CONTRACT[payload.leg].filename,
      sha256: payload.artifactSha256,
      size: Number(payload.artifactSize),
      evidenceSha256: payload.evidenceSha256,
      versionCode: String(payload.versionCode),
    };
    leg.state = "validated";
    if (next.legs.aab.state === "validated" && next.legs.apk.state === "validated") {
      next.versionCode = String(next.legs.aab.artifact.versionCode);
    }
    refreshGlobalState(next);
    record(next, "artifact-validated", now, { leg: payload.leg, artifactSha256: payload.artifactSha256, versionCode: String(payload.versionCode) });
    return next;
  }

  if (event === "prepare-play") {
    const play = requireLeg(next, payload.leg, { play: true });
    if (!SHA256_PATTERN.test(payload.artifactSha256 ?? "")
      || payload.artifactSha256 !== next.legs.aab.artifact.sha256
      || String(payload.versionCode) !== String(next.versionCode)) {
      throw new Error("La intención de Play no coincide con el AAB validado.");
    }
    const intentId = `play-${next.versionCode}-${payload.artifactSha256.slice(0, 16)}`;
    const existing = play.attempts.find((attempt) => attempt.intentId === intentId);
    if (existing) return next;
    if (next.state !== "artifacts-validated") throw new Error("Play solo puede prepararse tras validar AAB y APK.");
    play.attempts.push({
      number: play.attempts.length + 1,
      intentId,
      artifactSha256: payload.artifactSha256,
      versionCode: String(payload.versionCode),
      status: "INTENT_RECORDED",
      preparedAt: now,
    });
    play.state = "submitting";
    refreshGlobalState(next);
    record(next, "play-intent-recorded", now, { intentId, versionCode: String(payload.versionCode) });
    return next;
  }

  if (event === "start-play-retry") {
    const play = requireLeg(next, payload.leg, { play: true });
    if (play.state !== "retry-pending") throw new Error("Play no tiene un submission fallido reintentable.");
    const previous = latestAttempt(play);
    if (!previous?.submissionId) throw new Error("Falta el submission fallido que se quiere reintentar.");
    play.attempts.push({
      number: play.attempts.length + 1,
      intentId: `${previous.intentId}-retry-${play.attempts.length + 1}`,
      retryOf: previous.submissionId,
      artifactSha256: next.legs.aab.artifact.sha256,
      versionCode: String(next.versionCode),
      status: "INTENT_RECORDED",
      preparedAt: now,
    });
    play.state = "submitting";
    refreshGlobalState(next);
    record(next, "play-retry-recorded", now, { retryOf: previous.submissionId });
    return next;
  }

  if (event === "adopt-submission") {
    const play = requireLeg(next, payload.leg, { play: true });
    const attempt = latestAttempt(play);
    if (!attempt || !["submitting", "submitted", "retry-pending", "uncertain"].includes(play.state)) {
      throw new Error("No hay una intención de Play que pueda adoptar el submission.");
    }
    const submissionId = String(payload.submissionId ?? "").trim();
    if (!submissionId) throw new Error("Falta submission-id.");
    if (attempt.submissionId && attempt.submissionId !== submissionId) {
      throw new Error("La intención ya está ligada a otro submission; se bloquea el duplicado.");
    }
    attempt.submissionId = submissionId;
    attempt.status = String(payload.status ?? "NEW").toUpperCase();
    attempt.adoptedAt = now;
    play.submission = { id: submissionId, status: attempt.status };
    play.state = attempt.status === "FINISHED" ? "submitted" : "submitted";
    refreshGlobalState(next);
    record(next, "play-submission-adopted", now, { submissionId, status: attempt.status });
    return next;
  }

  if (event === "observe-play") {
    const play = requireLeg(next, payload.leg, { play: true });
    const attempt = latestAttempt(play);
    if (!attempt?.submissionId) throw new Error("No hay submission conocido que reconciliar.");
    if (payload.submissionId && payload.submissionId !== attempt.submissionId) throw new Error("El submission observado no coincide.");
    const status = String(payload.status ?? "").toUpperCase();
    if (!status) throw new Error("Falta el estado del submission.");
    attempt.status = status;
    attempt.observedAt = now;
    play.submission = { id: attempt.submissionId, status };
    if (status === "FINISHED") play.state = "submitted";
    else if (ACTIVE_SUBMISSION_STATUSES.has(status)) play.state = "submitted";
    else if (FAILED_SUBMISSION_STATUSES.has(status)) {
      attempt.reason = publicError(payload.reason ?? `EAS Submit terminó en ${status}.`);
      play.state = "failed";
    } else throw new Error(`Estado EAS Submit desconocido: ${status}.`);
    refreshGlobalState(next);
    record(next, "play-observed", now, { submissionId: attempt.submissionId, status });
    return next;
  }

  if (event === "fail-play") {
    const play = requireLeg(next, payload.leg, { play: true });
    const attempt = latestAttempt(play);
    if (!attempt || play.state === "validated") throw new Error("No hay un envío de Play pendiente que marcar fallido.");
    attempt.reason = publicError(payload.reason);
    attempt.failedAt = now;
    attempt.status = payload.uncertain === true || payload.uncertain === "true" ? "UNKNOWN_AFTER_REQUEST" : "ERRORED";
    play.state = attempt.status === "UNKNOWN_AFTER_REQUEST" ? "uncertain" : "failed";
    refreshGlobalState(next);
    record(next, "play-failed", now, { submissionId: attempt.submissionId ?? null, uncertain: play.state === "uncertain", reason: attempt.reason });
    return next;
  }

  if (event === "validate-play") {
    const play = requireLeg(next, payload.leg, { play: true });
    const attempt = latestAttempt(play);
    if (!attempt?.submissionId || attempt.status !== "FINISHED") {
      throw new Error("Solo un submission FINISHED puede validar Play Interno.");
    }
    if (!SHA256_PATTERN.test(payload.evidenceSha256 ?? "")) throw new Error("Falta el hash de la evidencia de Play.");
    play.state = "validated";
    play.evidenceSha256 = payload.evidenceSha256;
    play.submission = { id: attempt.submissionId, status: "FINISHED" };
    refreshGlobalState(next);
    record(next, "play-validated", now, { submissionId: attempt.submissionId, evidenceSha256: payload.evidenceSha256 });
    return next;
  }

  if (event === "retry") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede reintentarse.");
    const reason = publicError(payload.reason);
    if (next.legs.play.state === "uncertain") {
      throw new Error("El estado de Play es incierto: adopta primero el submission; nunca se repite automáticamente.");
    }
    for (const legName of BUILD_LEGS) {
      if (next.legs[legName].state === "failed") next.legs[legName].state = "prepared";
    }
    if (next.legs.play.state === "failed") {
      next.legs.play.state = latestAttempt(next.legs.play)?.submissionId ? "retry-pending" : "prepared";
    }
    refreshGlobalState(next);
    record(next, "retry-authorized", now, { reason });
    return next;
  }

  if (event === "supersede") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede marcarse como sustituida.");
    const reason = publicError(payload.reason);
    next.state = "superseded";
    record(next, "superseded", now, { reason });
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

function assertEvidence(evidence, { leg, transaction, currentCommit }) {
  const artifact = transaction.legs[leg].artifact;
  const attempt = latestAttempt(transaction.legs[leg]);
  if (evidence?.schemaVersion !== 2 || evidence?.kind !== "ProductionArtifactEvidenceV2"
    || evidence?.result !== "passed" || evidence?.source?.commit !== currentCommit
    || evidence?.source?.profile !== transaction.legs[leg].profile
    || evidence?.build?.id !== attempt?.attemptId
    || evidence?.artifact?.publishedFilename !== artifact.filename
    || evidence?.artifact?.type !== leg || evidence?.artifact?.versionName !== transaction.version
    || String(evidence?.artifact?.versionCode) !== String(transaction.versionCode)
    || evidence?.artifact?.sha256 !== artifact.sha256 || evidence?.artifact?.size !== artifact.size) {
    throw new Error(`La evidencia ${leg.toUpperCase()} no describe la transacción exacta.`);
  }
}

export function assertPublishedRelease({
  release,
  transaction,
  sourceEvidence,
  aabEvidence,
  apkEvidence,
  playEvidence,
  artifactEvidence,
  currentCommit,
  policy = loadReleasePolicy(),
}) {
  assertReleaseTransaction(transaction);
  if (transaction.schemaVersion === 1) {
    // Historical APK-only releases remain readable; no new V1 release can be created.
    const apk = releaseAsset(release, "gymnasia.apk");
    if (release?.draft !== false || release?.immutable !== true || release.target_commitish !== currentCommit
      || transaction.sourceCommit !== currentCommit || transaction.state !== "validated"
      || apk.digest !== expectedDigest(transaction.artifact.sha256)
      || artifactEvidence?.kind !== "ProductionArtifactEvidenceV1") {
      throw new Error("La release histórica V1 no coincide con su transacción.");
    }
    return true;
  }
  if (release?.draft !== false || release?.immutable !== true || release.target_commitish !== currentCommit
    || transaction.sourceCommit !== currentCommit || transaction.state !== "validated") {
    throw new Error("La release publicada no coincide exactamente con la fuente y transacción actuales.");
  }
  for (const leg of BUILD_LEGS) {
    const asset = releaseAsset(release, LEG_CONTRACT[leg].filename);
    const evidenceAsset = releaseAsset(release, EVIDENCE_ASSETS[leg]);
    const artifact = transaction.legs[leg].artifact;
    if (asset.content_type !== policy.artifacts[leg].githubMimeType
      || asset.size < policy.artifacts[leg].minBytes || asset.size > policy.artifacts[leg].maxBytes
      || asset.digest !== expectedDigest(artifact.sha256) || asset.size !== artifact.size
      || evidenceAsset.digest !== expectedDigest(artifact.evidenceSha256)) {
      throw new Error(`El ${leg.toUpperCase()} publicado no coincide con la transacción validada.`);
    }
  }
  assertEvidence(aabEvidence, { leg: "aab", transaction, currentCommit });
  assertEvidence(apkEvidence, { leg: "apk", transaction, currentCommit });
  const sourceAsset = releaseAsset(release, EVIDENCE_ASSETS.source);
  const playAsset = releaseAsset(release, EVIDENCE_ASSETS.play);
  releaseAsset(release, TRANSACTION_ASSET);
  if (sourceEvidence?.schemaVersion !== 2 || sourceEvidence?.kind !== "ProductionSourceEvidenceV2"
    || sourceEvidence?.result !== "passed" || sourceEvidence?.commit !== currentCommit
    || sourceEvidence?.appVersion !== transaction.version
    || playEvidence?.schemaVersion !== 2 || playEvidence?.kind !== "ProductionPlayEvidenceV2"
    || playEvidence?.result !== "passed" || playEvidence?.submission?.id !== transaction.legs.play.submission.id
    || playEvidence?.artifact?.sha256 !== transaction.legs.aab.artifact.sha256
    || String(playEvidence?.artifact?.versionCode) !== String(transaction.versionCode)
    || playEvidence?.track !== "internal" || playEvidence?.releaseStatus !== "completed"
    || sourceAsset.digest !== expectedDigest(aabEvidence.source.evidenceSha256)
    || aabEvidence.source.evidenceSha256 !== apkEvidence.source.evidenceSha256
    || playAsset.digest !== expectedDigest(transaction.legs.play.evidenceSha256)) {
    throw new Error("La evidencia publicada de fuente o Play no coincide con la transacción.");
  }
  return true;
}

export function selectReleaseAction({
  transactions,
  publishedVersions,
  currentVersion,
  currentCommit,
  operation = "reconcile",
  targetVersion = "",
  reason = "",
  submissionId = "",
}) {
  parseSemver(currentVersion);
  const published = new Set(publishedVersions);
  for (const transaction of transactions) assertReleaseTransaction(transaction);
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
      if (operation === "adopt-submission") {
        if (oldest.schemaVersion !== 2 || oldest.legs.play.state !== "uncertain") {
          throw new Error("Solo una intención incierta de Play puede adoptar manualmente un submission.");
        }
        if (!String(submissionId).trim()) throw new Error("La adopción exige --submission-id.");
        return {
          action: "build",
          mode: "adopt",
          transaction: oldest,
          submissionId: String(submissionId).trim(),
        };
      }
      if (operation === "retry-failed") {
        if (!reason.trim()) throw new Error("El reintento exige --reason.");
        return { action: "build", mode: "retry", transaction: oldest, reason };
      }
      if (operation === "supersede-failed") {
        if (!reason.trim()) throw new Error("Sustituir la versión exige --reason.");
        if (compareSemver(currentVersion, oldest.version) <= 0) {
          throw new Error("La sustitución exige que main declare una versión posterior.");
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
  return { action: "build", mode: "new", transaction: createReleaseTransaction({ version: currentVersion, sourceCommit: currentCommit }) };
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
  return { Accept: accept, Authorization: `Bearer ${token}`, "User-Agent": "gymnasia-android-release-transaction", "X-GitHub-Api-Version": "2022-11-28" };
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
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, { headers: githubHeaders("application/octet-stream") });
  if (!response.ok) throw new Error(`No se pudo descargar ${asset.name}: HTTP ${response.status}.`);
  return response.json();
}

function releaseVersion(release) {
  const value = String(release.tag_name ?? "").replace(/^v/, "");
  try { parseSemver(value); return value; } catch { return null; }
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
    const transaction = asset ? await downloadJsonAsset(policy.repository, asset) : JSON.parse(Buffer.from(bodyFallback, "base64").toString("utf8"));
    if (transaction.version !== releaseVersion(release) || releasesByVersion.has(transaction.version)) {
      throw new Error(`El draft ${release.tag_name} no conserva una transacción única de su versión.`);
    }
    transactions.push(transaction);
    releasesByVersion.set(transaction.version, release);
  }
  const selection = selectReleaseAction({
    transactions,
    publishedVersions: publishedReleases.map(releaseVersion),
    currentVersion: options["current-version"],
    currentCommit: options["current-commit"],
    operation: options.operation ?? "reconcile",
    targetVersion: options["target-version"] ?? "",
    reason: options.reason ?? "",
    submissionId: options["submission-id"] ?? "",
  });
  if (selection.action === "verify-published") {
    const release = publishedReleases.find((candidate) => releaseVersion(candidate) === options["current-version"]);
    const transaction = await downloadJsonAsset(policy.repository, releaseAsset(release, TRANSACTION_ASSET));
    if (transaction.schemaVersion === 1) {
      const [artifactEvidence, sourceEvidence] = await Promise.all([
        downloadJsonAsset(policy.repository, releaseAsset(release, "production-artifact-evidence.json")),
        downloadJsonAsset(policy.repository, releaseAsset(release, EVIDENCE_ASSETS.source)),
      ]);
      assertPublishedRelease({ release, transaction, artifactEvidence, sourceEvidence, currentCommit: options["current-commit"], policy });
    } else {
      const [sourceEvidence, aabEvidence, apkEvidence, playEvidence] = await Promise.all([
        downloadJsonAsset(policy.repository, releaseAsset(release, EVIDENCE_ASSETS.source)),
        downloadJsonAsset(policy.repository, releaseAsset(release, EVIDENCE_ASSETS.aab)),
        downloadJsonAsset(policy.repository, releaseAsset(release, EVIDENCE_ASSETS.apk)),
        downloadJsonAsset(policy.repository, releaseAsset(release, EVIDENCE_ASSETS.play)),
      ]);
      assertPublishedRelease({ release, transaction, sourceEvidence, aabEvidence, apkEvidence, playEvidence, currentCommit: options["current-commit"], policy });
    }
    selection.transaction = transaction;
  } else {
    selection.releaseId = releasesByVersion.get(selection.transaction.version)?.id ?? null;
  }
  writeJson(options.output, selection);
  if (options["github-output"]) {
    const lines = [
      `action=${selection.action}`,
      `mode=${selection.mode}`,
      `version=${selection.transaction?.version ?? options["current-version"]}`,
      `tag=${selection.transaction?.tag ?? `v${options["current-version"]}`}`,
      `source_commit=${selection.transaction?.sourceCommit ?? options["current-commit"]}`,
      `release_id=${selection.releaseId ?? ""}`,
    ];
    writeFileSync(resolve(options["github-output"]), `${lines.join("\n")}\n`, { flag: "a" });
  }
  console.log(`Selección Production: ${selection.action}/${selection.mode} ${selection.transaction?.version ?? options["current-version"]}.`);
}

function transition(options) {
  const transaction = JSON.parse(readFileSync(resolve(options.input), "utf8"));
  const payload = {
    leg: options.leg,
    runId: options["run-id"],
    runAttempt: options["run-attempt"],
    metadata: options.metadata ? JSON.parse(readFileSync(resolve(options.metadata), "utf8")) : undefined,
    reason: options.reason,
    uncertain: options.uncertain,
    artifactSha256: options["artifact-sha256"],
    artifactSize: options["artifact-size"],
    evidenceSha256: options["evidence-sha256"],
    versionCode: options["version-code"],
    versionCodeFloor: options["version-code-floor"],
    submissionId: options["submission-id"],
    status: options.status,
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
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
}
