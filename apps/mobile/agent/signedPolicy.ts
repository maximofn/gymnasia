import { hashes, verify } from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

export const POLICY_PROTOCOL_VERSION = 1 as const;
export const SIGNED_POLICY_PACKAGE_SCHEMA_VERSION = 1 as const;
export const MAX_POLICY_BUNDLE_BYTES = 256 * 1024;

hashes.sha512 = sha512;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d+$/;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const BUNDLE_ID_PATTERN = /^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/;
const ACTIVATION_ID_PATTERN = /^activation-[a-f0-9]{32}$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

export type PolicyChannelName = "Staging" | "Production";

export type PolicyTrustedRoots = {
  schemaVersion: 1;
  roots: Array<{
    algorithm: "Ed25519";
    keyId: string;
    publicKeyBase64Url: string;
  }>;
};

export type PolicySignatureEnvelope = {
  algorithm: "Ed25519";
  certificate: {
    payload: {
      algorithm: "Ed25519";
      keyId: string;
      notAfter: string;
      notBefore: string;
      publicKeyBase64Url: string;
      purpose: "gymnasia-policy";
      rootKeyId: string;
      schemaVersion: 1;
    };
    rootSignatureBase64Url: string;
  };
  schemaVersion: 1;
  signatureBase64Url: string;
  signedSha256: string;
};

export type PolicyBundle = {
  critical: boolean;
  healthSafetyRuntime: {
    content: Record<string, unknown>;
    policyVersion: string;
    sha256: string;
  };
  id: string;
  issuedAt: string;
  minClientProtocol: number;
  prompt: {
    content: string;
    encoding: "utf-8";
    sha256: string;
  };
  requiredTools: string[];
  schemaVersion: 1;
  version: string;
};

export type PolicyActivation = {
  action: "activate" | "rollback";
  bundleId: string;
  bundleSha256: string;
  channel: PolicyChannelName;
  critical: boolean;
  fromBundleId: string | null;
  id: string;
  issuedAt: string;
  schemaVersion: 1;
  sequence: number;
};

export type SignedPolicyPackage = {
  schemaVersion: typeof SIGNED_POLICY_PACKAGE_SCHEMA_VERSION;
  environment: string;
  channel: PolicyChannelName;
  candidate: string;
  deploymentId: number | null;
  bundleBody: string;
  bundleSignature: PolicySignatureEnvelope;
  activationBody: string;
  activationSignature: PolicySignatureEnvelope;
};

export type VerifiedSignedPolicy = {
  package: SignedPolicyPackage;
  bundle: PolicyBundle;
  activation: PolicyActivation;
};

function sortedJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 64) throw new Error("La política supera la profundidad máxima.");
  if (Array.isArray(value)) {
    return value.map((entry) => sortedJsonValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortedJsonValue((value as Record<string, unknown>)[key], depth + 1),
        ]),
    );
  }
  return value;
}

export function canonicalPolicyJson(value: unknown): string {
  return `${JSON.stringify(sortedJsonValue(value), null, 2)}\n`;
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function policySha256Hex(value: Uint8Array | string): string {
  return hex(sha256(typeof value === "string" ? utf8Bytes(value) : value));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: unknown, expectedBytes: number, label: string): Uint8Array {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value) || value.includes("=")) {
    throw new Error(`${label} no es base64url canónico.`);
  }
  const standard = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = `${standard}${"=".repeat((4 - (standard.length % 4)) % 4)}`;
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error(`${label} no es base64url válido.`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length !== expectedBytes || encodeBase64Url(bytes) !== value) {
    throw new Error(`${label} tiene una longitud o codificación inválida.`);
  }
  return bytes;
}

function exactObject(
  value: unknown,
  required: string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto.`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...required].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contiene campos ausentes o desconocidos.`);
  }
  return record;
}

function isoTimestamp(value: unknown, label: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`${label} debe usar RFC 3339 UTC con milisegundos.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${label} no es una fecha válida.`);
  }
  return timestamp;
}

function parseCanonicalJson(body: string, label: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${label} no es JSON válido.`);
  }
  if (canonicalPolicyJson(parsed) !== body) {
    throw new Error(`${label} no usa JSON canónico.`);
  }
  return parsed;
}

export function validatePolicyTrustedRoots(value: unknown): PolicyTrustedRoots {
  const document = exactObject(value, ["roots", "schemaVersion"], "El registro de raíces");
  if (document.schemaVersion !== 1 || !Array.isArray(document.roots) || document.roots.length === 0) {
    throw new Error("El registro de raíces es inválido.");
  }
  const seen = new Set<string>();
  for (const candidate of document.roots) {
    const root = exactObject(candidate, ["algorithm", "keyId", "publicKeyBase64Url"], "Una raíz");
    if (
      root.algorithm !== "Ed25519"
      || typeof root.keyId !== "string"
      || !KEY_ID_PATTERN.test(root.keyId)
      || seen.has(root.keyId)
    ) {
      throw new Error("El registro contiene una raíz inválida o duplicada.");
    }
    decodeBase64Url(root.publicKeyBase64Url, 32, "La clave pública raíz");
    seen.add(root.keyId);
  }
  return document as PolicyTrustedRoots;
}

function validateCertificatePayload(value: unknown): PolicySignatureEnvelope["certificate"]["payload"] {
  const payload = exactObject(value, [
    "algorithm",
    "keyId",
    "notAfter",
    "notBefore",
    "publicKeyBase64Url",
    "purpose",
    "rootKeyId",
    "schemaVersion",
  ], "El certificado");
  if (
    payload.schemaVersion !== 1
    || payload.algorithm !== "Ed25519"
    || payload.purpose !== "gymnasia-policy"
    || typeof payload.keyId !== "string"
    || !KEY_ID_PATTERN.test(payload.keyId)
    || typeof payload.rootKeyId !== "string"
    || !KEY_ID_PATTERN.test(payload.rootKeyId)
  ) {
    throw new Error("El certificado contiene metadatos inválidos.");
  }
  decodeBase64Url(payload.publicKeyBase64Url, 32, "La clave pública del certificado");
  const notBefore = isoTimestamp(payload.notBefore, "certificate.notBefore");
  const notAfter = isoTimestamp(payload.notAfter, "certificate.notAfter");
  if (notAfter <= notBefore) throw new Error("La vigencia del certificado es inválida.");
  return payload as PolicySignatureEnvelope["certificate"]["payload"];
}

function verifyEnvelope(
  bytes: Uint8Array,
  value: unknown,
  trustedRootsValue: unknown,
  issuedAt: string,
): PolicySignatureEnvelope {
  const envelope = exactObject(value, [
    "algorithm",
    "certificate",
    "schemaVersion",
    "signatureBase64Url",
    "signedSha256",
  ], "La envoltura de firma");
  if (
    envelope.schemaVersion !== 1
    || envelope.algorithm !== "Ed25519"
    || typeof envelope.signedSha256 !== "string"
    || !SHA256_PATTERN.test(envelope.signedSha256)
    || envelope.signedSha256 !== policySha256Hex(bytes)
  ) {
    throw new Error("La envoltura de firma no corresponde al contenido.");
  }
  const certificate = exactObject(
    envelope.certificate,
    ["payload", "rootSignatureBase64Url"],
    "El certificado firmado",
  );
  const payload = validateCertificatePayload(certificate.payload);
  const trustedRoots = validatePolicyTrustedRoots(trustedRootsValue);
  const root = trustedRoots.roots.find((candidate) => candidate.keyId === payload.rootKeyId);
  if (!root) throw new Error("La raíz del certificado no está autorizada.");
  const rootSignature = decodeBase64Url(
    certificate.rootSignatureBase64Url,
    64,
    "La firma raíz del certificado",
  );
  if (!verify(
    rootSignature,
    utf8Bytes(canonicalPolicyJson(payload)),
    decodeBase64Url(root.publicKeyBase64Url, 32, "La clave pública raíz"),
    { zip215: false },
  )) {
    throw new Error("La firma raíz del certificado es inválida.");
  }
  const signedAt = isoTimestamp(issuedAt, "issuedAt");
  if (signedAt < Date.parse(payload.notBefore) || signedAt > Date.parse(payload.notAfter)) {
    throw new Error("La firma se emitió fuera de la vigencia del certificado.");
  }
  const signature = decodeBase64Url(envelope.signatureBase64Url, 64, "La firma Ed25519");
  if (!verify(
    signature,
    bytes,
    decodeBase64Url(payload.publicKeyBase64Url, 32, "La clave pública del certificado"),
    { zip215: false },
  )) {
    throw new Error("La firma Ed25519 es inválida.");
  }
  return envelope as PolicySignatureEnvelope;
}

function validateActivation(value: unknown): PolicyActivation {
  const activation = exactObject(value, [
    "action",
    "bundleId",
    "bundleSha256",
    "channel",
    "critical",
    "fromBundleId",
    "id",
    "issuedAt",
    "schemaVersion",
    "sequence",
  ], "La activación");
  if (
    activation.schemaVersion !== 1
    || typeof activation.id !== "string"
    || !ACTIVATION_ID_PATTERN.test(activation.id)
    || !["activate", "rollback"].includes(String(activation.action))
    || !["Staging", "Production"].includes(String(activation.channel))
    || typeof activation.bundleId !== "string"
    || !BUNDLE_ID_PATTERN.test(activation.bundleId)
    || typeof activation.bundleSha256 !== "string"
    || !SHA256_PATTERN.test(activation.bundleSha256)
    || typeof activation.critical !== "boolean"
    || !Number.isSafeInteger(activation.sequence)
    || Number(activation.sequence) < 1
  ) {
    throw new Error("La activación contiene metadatos inválidos.");
  }
  isoTimestamp(activation.issuedAt, "activation.issuedAt");
  if (
    (activation.action === "activate" && activation.fromBundleId !== null)
    || (
      activation.action === "rollback"
      && (typeof activation.fromBundleId !== "string" || !BUNDLE_ID_PATTERN.test(activation.fromBundleId))
    )
    || activation.fromBundleId === activation.bundleId
  ) {
    throw new Error("La relación de rollback de la activación es inválida.");
  }
  return activation as PolicyActivation;
}

function validateBundle(value: unknown, announcedTools: readonly string[]): PolicyBundle {
  const bundle = exactObject(value, [
    "critical",
    "healthSafetyRuntime",
    "id",
    "issuedAt",
    "minClientProtocol",
    "prompt",
    "requiredTools",
    "schemaVersion",
    "version",
  ], "El bundle");
  const prompt = exactObject(bundle.prompt, ["content", "encoding", "sha256"], "El prompt");
  if (
    bundle.schemaVersion !== 1
    || typeof bundle.version !== "string"
    || !VERSION_PATTERN.test(bundle.version)
    || typeof bundle.id !== "string"
    || !BUNDLE_ID_PATTERN.test(bundle.id)
    || typeof prompt.sha256 !== "string"
    || bundle.id !== `policy-v${bundle.version}-${prompt.sha256.slice(0, 12)}`
    || typeof bundle.critical !== "boolean"
    || !Number.isSafeInteger(bundle.minClientProtocol)
    || Number(bundle.minClientProtocol) < 1
  ) {
    throw new Error("El bundle contiene metadatos inválidos.");
  }
  isoTimestamp(bundle.issuedAt, "bundle.issuedAt");
  if (
    prompt.encoding !== "utf-8"
    || typeof prompt.content !== "string"
    || !prompt.content.trim()
    || prompt.content.includes("\u0000")
    || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(prompt.content)
    || !SHA256_PATTERN.test(prompt.sha256)
    || policySha256Hex(prompt.content) !== prompt.sha256
  ) {
    throw new Error("El prompt del bundle es inválido.");
  }
  const runtime = exactObject(
    bundle.healthSafetyRuntime,
    ["content", "policyVersion", "sha256"],
    "La política sanitaria",
  );
  if (
    typeof runtime.policyVersion !== "string"
    || !VERSION_PATTERN.test(runtime.policyVersion)
    || !runtime.content
    || typeof runtime.content !== "object"
    || Array.isArray(runtime.content)
    || (runtime.content as Record<string, unknown>).policyVersion !== runtime.policyVersion
    || typeof runtime.sha256 !== "string"
    || !SHA256_PATTERN.test(runtime.sha256)
    || policySha256Hex(canonicalPolicyJson(runtime.content)) !== runtime.sha256
  ) {
    throw new Error("La política sanitaria del bundle es inválida.");
  }
  if (!Array.isArray(bundle.requiredTools) || bundle.requiredTools.length === 0) {
    throw new Error("El bundle debe declarar herramientas requeridas.");
  }
  const availableTools = new Set(announcedTools);
  const requiredTools = bundle.requiredTools as unknown[];
  const sortedTools = requiredTools.map(String).sort();
  if (
    requiredTools.some((tool) => typeof tool !== "string")
    || sortedTools.some((tool, index) => tool !== requiredTools[index])
    || new Set(sortedTools).size !== sortedTools.length
    || sortedTools.some((tool) => !TOOL_NAME_PATTERN.test(tool) || !availableTools.has(tool))
  ) {
    throw new Error("El bundle requiere herramientas desconocidas, duplicadas o desordenadas.");
  }
  return bundle as PolicyBundle;
}

function validatePackageMetadata(value: unknown): SignedPolicyPackage {
  const packageValue = exactObject(value, [
    "activationBody",
    "activationSignature",
    "bundleBody",
    "bundleSignature",
    "candidate",
    "channel",
    "deploymentId",
    "environment",
    "schemaVersion",
  ], "El paquete de política");
  if (
    packageValue.schemaVersion !== SIGNED_POLICY_PACKAGE_SCHEMA_VERSION
    || typeof packageValue.environment !== "string"
    || !packageValue.environment
    || !["Staging", "Production"].includes(String(packageValue.channel))
    || typeof packageValue.candidate !== "string"
    || !BUNDLE_ID_PATTERN.test(packageValue.candidate)
    || (
      packageValue.deploymentId !== null
      && (!Number.isSafeInteger(packageValue.deploymentId) || Number(packageValue.deploymentId) < 1)
    )
    || typeof packageValue.bundleBody !== "string"
    || typeof packageValue.activationBody !== "string"
  ) {
    throw new Error("Los metadatos del paquete de política son inválidos.");
  }
  return packageValue as SignedPolicyPackage;
}

export function verifySignedPolicyPackage({
  packageValue,
  trustedRoots,
  announcedTools,
  expectedEnvironment,
  expectedChannel,
  clientProtocol = POLICY_PROTOCOL_VERSION,
}: {
  packageValue: unknown;
  trustedRoots: unknown;
  announcedTools: readonly string[];
  expectedEnvironment: string;
  expectedChannel: PolicyChannelName;
  clientProtocol?: number;
}): VerifiedSignedPolicy {
  const signedPackage = validatePackageMetadata(packageValue);
  if (
    signedPackage.environment !== expectedEnvironment
    || signedPackage.channel !== expectedChannel
  ) {
    throw new Error("El paquete pertenece a otro entorno o canal.");
  }
  const bundleBytes = utf8Bytes(signedPackage.bundleBody);
  if (bundleBytes.length === 0 || bundleBytes.length > MAX_POLICY_BUNDLE_BYTES) {
    throw new Error("El bundle está vacío o supera el tamaño máximo.");
  }
  const activationBytes = utf8Bytes(signedPackage.activationBody);
  if (activationBytes.length === 0 || activationBytes.length > 16 * 1024) {
    throw new Error("La activación está vacía o supera el tamaño máximo.");
  }

  const activation = validateActivation(parseCanonicalJson(
    signedPackage.activationBody,
    "La activación",
  ));
  verifyEnvelope(
    activationBytes,
    signedPackage.activationSignature,
    trustedRoots,
    activation.issuedAt,
  );
  if (
    activation.channel !== expectedChannel
    || activation.bundleSha256 !== policySha256Hex(bundleBytes)
  ) {
    throw new Error("La activación no corresponde al bundle o al canal.");
  }

  const bundle = validateBundle(
    parseCanonicalJson(signedPackage.bundleBody, "El bundle"),
    announcedTools,
  );
  verifyEnvelope(
    bundleBytes,
    signedPackage.bundleSignature,
    trustedRoots,
    bundle.issuedAt,
  );
  if (
    signedPackage.candidate !== bundle.id
    || activation.bundleId !== bundle.id
    || activation.critical !== bundle.critical
  ) {
    throw new Error("Las identidades firmadas del paquete no coinciden.");
  }
  if (bundle.minClientProtocol > clientProtocol) {
    throw new Error("El bundle exige un protocolo de cliente incompatible.");
  }
  return { package: signedPackage, bundle, activation };
}
