#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  compareSemver,
  loadReleasePolicy,
  parseSemver,
} from "./production-release.mjs";

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const TERMINAL_BUILD_STATUSES = new Set(["ERRORED", "CANCELED"]);
const ACTIVE_BUILD_STATUSES = new Set(["NEW", "IN_QUEUE", "IN_PROGRESS", "PENDING_CANCEL"]);
export const TRANSACTION_ASSET = "android-release-transaction.json";

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

export function createReleaseTransaction({ version, sourceCommit, now = new Date().toISOString() }) {
  parseSemver(version);
  if (!COMMIT_PATTERN.test(sourceCommit)) throw new Error("El commit fuente de la transacción no es válido.");
  const at = timestamp(now);
  return {
    schemaVersion: 1,
    kind: "AndroidReleaseTransactionV1",
    id: `android-v${version}`,
    version,
    tag: `v${version}`,
    sourceCommit,
    profile: "production-apk",
    artifactType: "apk",
    state: "prepared",
    createdAt: at,
    updatedAt: at,
    attempts: [],
    transitions: [{ event: "prepared", at }],
  };
}

export function assertReleaseTransaction(transaction) {
  if (transaction?.schemaVersion !== 1 || transaction?.kind !== "AndroidReleaseTransactionV1") {
    throw new Error("El asset no cumple AndroidReleaseTransactionV1.");
  }
  parseSemver(transaction.version);
  if (transaction.id !== `android-v${transaction.version}` || transaction.tag !== `v${transaction.version}`) {
    throw new Error("El identificador o tag de la transacción no coincide con su versión.");
  }
  if (!COMMIT_PATTERN.test(transaction.sourceCommit)) throw new Error("La transacción no conserva un SHA fuente válido.");
  if (transaction.profile !== "production-apk" || transaction.artifactType !== "apk") {
    throw new Error("La transacción no corresponde al APK Production.");
  }
  if (!Array.isArray(transaction.attempts) || !Array.isArray(transaction.transitions)) {
    throw new Error("La transacción no conserva su historial.");
  }
  if (![
    "prepared",
    "build-submitted",
    "build-running",
    "build-finished",
    "failed",
    "validated",
    "superseded",
  ].includes(transaction.state)) {
    throw new Error(`Estado de transacción inválido: ${transaction.state}.`);
  }
  if (transaction.state === "validated") {
    if (transaction.artifact?.filename !== "gymnasia.apk"
      || !/^[a-f0-9]{64}$/.test(String(transaction.artifact?.sha256 ?? ""))
      || !Number.isSafeInteger(Number(transaction.artifact?.size))
      || Number(transaction.artifact?.size) <= 0
      || !/^[a-f0-9]{64}$/.test(String(transaction.artifact?.evidenceSha256 ?? ""))) {
      throw new Error("La transacción validada no conserva artefacto y evidencia íntegros.");
    }
  }
  return transaction;
}

function currentAttempt(transaction) {
  return transaction.attempts.at(-1) ?? null;
}

export function transitionReleaseTransaction(transaction, event, payload = {}) {
  assertReleaseTransaction(transaction);
  const next = clone(transaction);
  const now = timestamp(payload.now ?? new Date().toISOString());
  const attempt = currentAttempt(next);

  if (event === "retry") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede reintentarse.");
    if (!String(payload.reason ?? "").trim()) throw new Error("El reintento manual exige un motivo.");
    next.state = "prepared";
    record(next, "retry-authorized", now, { reason: payload.reason });
    return next;
  }
  if (event === "supersede") {
    if (next.state !== "failed") throw new Error("Solo una transacción fallida puede marcarse como sustituida.");
    if (!String(payload.reason ?? "").trim()) throw new Error("Sustituir una versión exige un motivo.");
    next.state = "superseded";
    record(next, "superseded", now, { reason: payload.reason });
    return next;
  }
  if (event === "submit") {
    if (!String(payload.buildId ?? "").trim()) throw new Error("Falta el identificador de EAS.");
    if (attempt?.buildId === payload.buildId) return next;
    if (next.state !== "prepared") throw new Error(`No se puede enviar un build desde ${next.state}.`);
    next.attempts.push({
      number: next.attempts.length + 1,
      buildId: payload.buildId,
      submittedAt: now,
      status: "NEW",
    });
    next.state = "build-submitted";
    record(next, "build-submitted", now, { buildId: payload.buildId });
    return next;
  }
  if (event === "observe") {
    if (!attempt) throw new Error("No hay un intento EAS que observar.");
    const status = String(payload.status ?? "").toUpperCase();
    if (attempt.status === status && (!payload.artifactUrl || attempt.artifactUrl === payload.artifactUrl)) {
      return next;
    }
    attempt.status = status;
    attempt.observedAt = now;
    if (ACTIVE_BUILD_STATUSES.has(status)) {
      next.state = status === "IN_PROGRESS" ? "build-running" : "build-submitted";
    } else if (status === "FINISHED") {
      if (!String(payload.artifactUrl ?? "").startsWith("https://")) {
        throw new Error("EAS terminó sin una URL HTTPS de artefacto.");
      }
      attempt.artifactUrl = payload.artifactUrl;
      attempt.finishedAt = now;
      next.state = "build-finished";
    } else if (TERMINAL_BUILD_STATUSES.has(status)) {
      attempt.failedAt = now;
      attempt.reason = payload.reason ?? `EAS terminó en ${status}.`;
      next.state = "failed";
    } else {
      throw new Error(`Estado EAS desconocido: ${status || "(vacío)"}.`);
    }
    record(next, "build-observed", now, { buildId: attempt.buildId, status });
    return next;
  }
  if (event === "validate") {
    if (!/^[a-f0-9]{64}$/.test(String(payload.artifactSha256 ?? ""))) {
      throw new Error("La validación exige el SHA-256 del APK.");
    }
    if (!Number.isSafeInteger(Number(payload.artifactSize)) || Number(payload.artifactSize) <= 0) {
      throw new Error("La validación exige el tamaño entero del APK.");
    }
    if (!/^[a-f0-9]{64}$/.test(String(payload.evidenceSha256 ?? ""))) {
      throw new Error("La validación exige el SHA-256 de su evidencia.");
    }
    if (next.state === "validated") {
      if (next.artifact.sha256 !== payload.artifactSha256
        || next.artifact.size !== Number(payload.artifactSize)) {
        throw new Error("Una reconciliación no puede sustituir el APK ya validado.");
      }
      if (next.artifact.evidenceSha256 === payload.evidenceSha256) return next;
      next.artifact.evidenceSha256 = payload.evidenceSha256;
      record(next, "evidence-revalidated", now, {
        artifactSha256: payload.artifactSha256,
        evidenceSha256: payload.evidenceSha256,
      });
      return next;
    }
    if (next.state !== "build-finished") throw new Error("Solo un build terminado puede validarse.");
    next.state = "validated";
    next.artifact = {
      filename: "gymnasia.apk",
      sha256: payload.artifactSha256,
      size: Number(payload.artifactSize),
      evidenceSha256: payload.evidenceSha256,
    };
    record(next, "validated", now, { artifactSha256: payload.artifactSha256 });
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

export function assertPublishedRelease({
  release,
  transaction,
  artifactEvidence,
  sourceEvidence,
  currentCommit,
  apkPolicy,
}) {
  assertReleaseTransaction(transaction);
  if (release?.draft !== false || release?.immutable !== true) {
    throw new Error("La release de Production no está publicada e inmutable.");
  }
  if (release.target_commitish !== currentCommit
    || transaction.sourceCommit !== currentCommit
    || transaction.state !== "validated") {
    throw new Error("La release publicada no coincide exactamente con la fuente y transacción actuales.");
  }

  const apk = releaseAsset(release, "gymnasia.apk");
  const artifactEvidenceAsset = releaseAsset(release, "production-artifact-evidence.json");
  const sourceEvidenceAsset = releaseAsset(release, "production-source-evidence.json");
  releaseAsset(release, TRANSACTION_ASSET);
  if (apk.content_type !== apkPolicy.githubMimeType
    || apk.size < apkPolicy.minBytes
    || apk.size > apkPolicy.maxBytes) {
    throw new Error("El APK publicado no conserva el MIME o tamaño aprobados.");
  }
  if (apk.digest !== expectedDigest(transaction.artifact.sha256)
    || apk.size !== transaction.artifact.size) {
    throw new Error("El APK publicado no coincide con la transacción validada.");
  }
  if (artifactEvidenceAsset.digest !== expectedDigest(transaction.artifact.evidenceSha256)) {
    throw new Error("La evidencia publicada no coincide con la transacción validada.");
  }
  if (artifactEvidence?.schemaVersion !== 1
    || artifactEvidence?.kind !== "ProductionArtifactEvidenceV1"
    || artifactEvidence?.result !== "passed"
    || artifactEvidence?.source?.commit !== currentCommit
    || artifactEvidence?.source?.profile !== transaction.profile
    || artifactEvidence?.build?.id !== transaction.attempts.at(-1)?.buildId
    || artifactEvidence?.artifact?.publishedFilename !== transaction.artifact.filename
    || artifactEvidence?.artifact?.type !== transaction.artifactType
    || artifactEvidence?.artifact?.versionName !== transaction.version
    || artifactEvidence?.artifact?.sha256 !== transaction.artifact.sha256
    || artifactEvidence?.artifact?.size !== transaction.artifact.size) {
    throw new Error("La evidencia de artefacto publicada no describe la transacción exacta.");
  }
  if (sourceEvidenceAsset.digest !== expectedDigest(artifactEvidence.source.evidenceSha256)) {
    throw new Error("La evidencia de fuente publicada no coincide con la enlazada por el artefacto.");
  }
  if (sourceEvidence?.schemaVersion !== 1
    || sourceEvidence?.kind !== "ProductionSourceEvidenceV1"
    || sourceEvidence?.result !== "passed"
    || sourceEvidence?.commit !== currentCommit
    || sourceEvidence?.appVersion !== transaction.version
    || sourceEvidence?.profile !== transaction.profile
    || sourceEvidence?.artifactType !== transaction.artifactType) {
    throw new Error("La evidencia de fuente publicada no describe la transacción exacta.");
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
      if (operation === "retry-failed") {
        if (!reason.trim()) throw new Error("El reintento exige --reason.");
        return { action: "build", mode: "retry", transaction: oldest, reason };
      }
      if (operation === "supersede-failed") {
        if (!reason.trim()) throw new Error("Sustituir la versión exige --reason.");
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
  if (currentSuperseded) {
    return { action: "noop", mode: "superseded", transaction: currentSuperseded };
  }
  if (latestPublished && compareSemver(currentVersion, latestPublished) <= 0) {
    throw new Error(`La versión fuente ${currentVersion} no es posterior a ${latestPublished}.`);
  }
  return {
    action: "build",
    mode: "new",
    transaction: createReleaseTransaction({ version: currentVersion, sourceCommit: currentCommit }),
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
    const batch = await githubJson(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
    );
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

async function selectRemote(options) {
  const policy = loadReleasePolicy();
  const releases = await listReleases(policy.repository);
  const publishedReleases = releases.filter((release) => !release.draft && !release.prerelease && releaseVersion(release));
  const draftReleases = releases.filter((release) => release.draft && releaseVersion(release));
  const transactions = [];
  const releasesByVersion = new Map();
  for (const release of draftReleases) {
    const asset = release.assets?.find((candidate) => candidate.name === TRANSACTION_ASSET);
    const bodyFallback = String(release.body ?? "")
      .match(/<!-- android-release-transaction:([A-Za-z0-9+/=]+) -->/)?.[1];
    if (!asset && !bodyFallback) {
      throw new Error(`El draft ${release.tag_name} no conserva ${TRANSACTION_ASSET}.`);
    }
    const transaction = asset
      ? await downloadJsonAsset(policy.repository, asset)
      : JSON.parse(Buffer.from(bodyFallback, "base64").toString("utf8"));
    if (transaction.version !== releaseVersion(release)) {
      throw new Error(`El draft ${release.tag_name} contiene una transacción de otra versión.`);
    }
    if (releasesByVersion.has(transaction.version)) {
      throw new Error(`Hay más de un draft para ${transaction.version}.`);
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
  });

  if (selection.action === "verify-published") {
    const release = publishedReleases.find((candidate) => releaseVersion(candidate) === options["current-version"]);
    const transactionAsset = releaseAsset(release, TRANSACTION_ASSET);
    const artifactEvidenceAsset = releaseAsset(release, "production-artifact-evidence.json");
    const sourceEvidenceAsset = releaseAsset(release, "production-source-evidence.json");
    const [transaction, artifactEvidence, sourceEvidence] = await Promise.all([
      downloadJsonAsset(policy.repository, transactionAsset),
      downloadJsonAsset(policy.repository, artifactEvidenceAsset),
      downloadJsonAsset(policy.repository, sourceEvidenceAsset),
    ]);
    assertPublishedRelease({
      release,
      transaction,
      artifactEvidence,
      sourceEvidence,
      currentCommit: options["current-commit"],
      apkPolicy: policy.artifacts.apk,
    });
    selection.transaction = transaction;
  } else {
    const release = releasesByVersion.get(selection.transaction.version);
    selection.releaseId = release?.id ?? null;
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
    buildId: options["build-id"],
    status: options.status,
    artifactUrl: options["artifact-url"],
    reason: options.reason,
    artifactSha256: options["artifact-sha256"],
    artifactSize: options["artifact-size"],
    evidenceSha256: options["evidence-sha256"],
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
