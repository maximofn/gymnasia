import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";

export const POLICY_BUNDLE_SCHEMA_VERSION = 1;
export const POLICY_ACTIVATION_SCHEMA_VERSION = 1;
export const POLICY_SIGNATURE_SCHEMA_VERSION = 1;
export const POLICY_CERTIFICATE_SCHEMA_VERSION = 1;
export const POLICY_ROOTS_SCHEMA_VERSION = 1;
export const POLICY_PROTOCOL_VERSION = 1;
export const MAX_POLICY_BUNDLE_BYTES = 256 * 1024;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d+$/;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const BUNDLE_ID_PATTERN = /^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/;
const ACTIVATION_ID_PATTERN = /^activation-[a-f0-9]{32}$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const ALLOWED_CHANNELS = new Set(["Staging", "Production"]);

function sortedJsonValue(value, depth = 0) {
  if (depth > 64) throw new Error("La política supera la profundidad máxima.");
  if (Array.isArray(value)) return value.map((entry) => sortedJsonValue(entry, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortedJsonValue(value[key], depth + 1)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(sortedJsonValue(value), null, 2)}\n`;
}

export function utf8Bytes(value) {
  return new TextEncoder().encode(value);
}

export function decodeUtf8Strict(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function decodeBase64Url(value, expectedBytes, label) {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value) || value.includes("=")) {
    throw new Error(`${label} no es base64url canónico.`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== expectedBytes || encodeBase64Url(decoded) !== value) {
    throw new Error(`${label} tiene una longitud o codificación inválida.`);
  }
  return decoded;
}

function assertExactObject(value, required, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto.`);
  }
  const keys = Object.keys(value).sort();
  const expected = [...required].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contiene campos ausentes o desconocidos.`);
  }
  return value;
}

function assertIsoDate(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`${label} debe usar RFC 3339 UTC con milisegundos.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${label} no es una fecha válida.`);
  }
  return timestamp;
}

function publicKeyFromRaw(publicKeyBase64Url) {
  return createPublicKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: publicKeyBase64Url,
    },
    format: "jwk",
  });
}

function privateKeyFromBase64(privateKeyPkcs8Base64) {
  if (typeof privateKeyPkcs8Base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(privateKeyPkcs8Base64)) {
    throw new Error("La clave privada PKCS#8 no es base64 válido.");
  }
  return createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

export function generateEd25519KeyPair(keyId) {
  if (!KEY_ID_PATTERN.test(keyId)) throw new Error("El identificador de clave es inválido.");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  if (typeof publicJwk.x !== "string") throw new Error("No se pudo exportar la clave pública Ed25519.");
  return {
    keyId,
    privateKeyPkcs8Base64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKeyBase64Url: publicJwk.x,
  };
}

export function createSigningCertificate({
  keyId,
  publicKeyBase64Url,
  rootKeyId,
  notBefore,
  notAfter,
  rootPrivateKeyPkcs8Base64,
}) {
  const payload = {
    algorithm: "Ed25519",
    keyId,
    notAfter,
    notBefore,
    publicKeyBase64Url,
    purpose: "gymnasia-policy",
    rootKeyId,
    schemaVersion: POLICY_CERTIFICATE_SCHEMA_VERSION,
  };
  validateCertificatePayload(payload);
  const signature = nodeSign(
    null,
    utf8Bytes(canonicalJson(payload)),
    privateKeyFromBase64(rootPrivateKeyPkcs8Base64),
  );
  return {
    payload,
    rootSignatureBase64Url: encodeBase64Url(signature),
  };
}

export function validateCertificatePayload(value) {
  const payload = assertExactObject(value, [
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
    payload.schemaVersion !== POLICY_CERTIFICATE_SCHEMA_VERSION
    || payload.algorithm !== "Ed25519"
    || payload.purpose !== "gymnasia-policy"
    || !KEY_ID_PATTERN.test(payload.keyId)
    || !KEY_ID_PATTERN.test(payload.rootKeyId)
  ) {
    throw new Error("El certificado contiene metadatos inválidos.");
  }
  decodeBase64Url(payload.publicKeyBase64Url, 32, "La clave pública del certificado");
  const notBefore = assertIsoDate(payload.notBefore, "certificate.notBefore");
  const notAfter = assertIsoDate(payload.notAfter, "certificate.notAfter");
  if (notAfter <= notBefore) throw new Error("La vigencia del certificado es inválida.");
  return payload;
}

export function validateTrustedRoots(value) {
  const document = assertExactObject(value, ["roots", "schemaVersion"], "El registro de raíces");
  if (document.schemaVersion !== POLICY_ROOTS_SCHEMA_VERSION || !Array.isArray(document.roots) || document.roots.length === 0) {
    throw new Error("El registro de raíces es inválido.");
  }
  const seen = new Set();
  for (const rootValue of document.roots) {
    const root = assertExactObject(rootValue, ["algorithm", "keyId", "publicKeyBase64Url"], "Una raíz");
    if (root.algorithm !== "Ed25519" || !KEY_ID_PATTERN.test(root.keyId) || seen.has(root.keyId)) {
      throw new Error("El registro contiene una raíz inválida o duplicada.");
    }
    decodeBase64Url(root.publicKeyBase64Url, 32, "La clave pública raíz");
    seen.add(root.keyId);
  }
  return document;
}

function rootForCertificate(certificate, trustedRoots) {
  const roots = validateTrustedRoots(trustedRoots).roots;
  const root = roots.find((candidate) => candidate.keyId === certificate.payload.rootKeyId);
  if (!root) throw new Error("La raíz del certificado no está autorizada.");
  const certificateSignature = decodeBase64Url(
    certificate.rootSignatureBase64Url,
    64,
    "La firma raíz del certificado",
  );
  const valid = nodeVerify(
    null,
    utf8Bytes(canonicalJson(certificate.payload)),
    publicKeyFromRaw(root.publicKeyBase64Url),
    certificateSignature,
  );
  if (!valid) throw new Error("La firma raíz del certificado es inválida.");
  return root;
}

export function createSignatureEnvelope(bytes, certificate, privateKeyPkcs8Base64) {
  validateCertificatePayload(certificate.payload);
  decodeBase64Url(certificate.rootSignatureBase64Url, 64, "La firma raíz del certificado");
  const signature = nodeSign(null, bytes, privateKeyFromBase64(privateKeyPkcs8Base64));
  return {
    algorithm: "Ed25519",
    certificate,
    schemaVersion: POLICY_SIGNATURE_SCHEMA_VERSION,
    signatureBase64Url: encodeBase64Url(signature),
    signedSha256: sha256Hex(bytes),
  };
}

export function verifySignatureEnvelope(bytes, value, trustedRoots, issuedAt) {
  const envelope = assertExactObject(value, [
    "algorithm",
    "certificate",
    "schemaVersion",
    "signatureBase64Url",
    "signedSha256",
  ], "La envoltura de firma");
  if (
    envelope.schemaVersion !== POLICY_SIGNATURE_SCHEMA_VERSION
    || envelope.algorithm !== "Ed25519"
    || !SHA256_PATTERN.test(envelope.signedSha256)
    || envelope.signedSha256 !== sha256Hex(bytes)
  ) {
    throw new Error("La envoltura de firma no corresponde al contenido.");
  }
  const certificate = assertExactObject(
    envelope.certificate,
    ["payload", "rootSignatureBase64Url"],
    "El certificado firmado",
  );
  const payload = validateCertificatePayload(certificate.payload);
  rootForCertificate(certificate, trustedRoots);
  const signedAt = assertIsoDate(issuedAt, "issuedAt");
  if (signedAt < Date.parse(payload.notBefore) || signedAt > Date.parse(payload.notAfter)) {
    throw new Error("La firma se emitió fuera de la vigencia del certificado.");
  }
  const signature = decodeBase64Url(envelope.signatureBase64Url, 64, "La firma Ed25519");
  const valid = nodeVerify(
    null,
    bytes,
    publicKeyFromRaw(payload.publicKeyBase64Url),
    signature,
  );
  if (!valid) throw new Error("La firma Ed25519 es inválida.");
  return { envelope, certificate: payload };
}

export function validatePolicyBundle(value, announcedTools) {
  const bundle = assertExactObject(value, [
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
  if (
    bundle.schemaVersion !== POLICY_BUNDLE_SCHEMA_VERSION
    || !VERSION_PATTERN.test(bundle.version)
    || !BUNDLE_ID_PATTERN.test(bundle.id)
    || bundle.id !== `policy-v${bundle.version}-${bundle.prompt?.sha256?.slice(0, 12)}`
    || typeof bundle.critical !== "boolean"
    || !Number.isSafeInteger(bundle.minClientProtocol)
    || bundle.minClientProtocol < 1
  ) {
    throw new Error("El bundle contiene metadatos inválidos.");
  }
  assertIsoDate(bundle.issuedAt, "bundle.issuedAt");
  const prompt = assertExactObject(bundle.prompt, ["content", "encoding", "sha256"], "El prompt");
  if (
    prompt.encoding !== "utf-8"
    || typeof prompt.content !== "string"
    || !prompt.content.trim()
    || prompt.content.includes("\u0000")
    || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(prompt.content)
    || !SHA256_PATTERN.test(prompt.sha256)
    || sha256Hex(utf8Bytes(prompt.content)) !== prompt.sha256
  ) {
    throw new Error("El prompt del bundle es inválido.");
  }
  const runtime = assertExactObject(
    bundle.healthSafetyRuntime,
    ["content", "policyVersion", "sha256"],
    "La política sanitaria",
  );
  if (
    !VERSION_PATTERN.test(runtime.policyVersion)
    || !runtime.content
    || typeof runtime.content !== "object"
    || Array.isArray(runtime.content)
    || runtime.content.policyVersion !== runtime.policyVersion
    || !SHA256_PATTERN.test(runtime.sha256)
    || sha256Hex(utf8Bytes(canonicalJson(runtime.content))) !== runtime.sha256
  ) {
    throw new Error("La política sanitaria del bundle es inválida.");
  }
  if (!Array.isArray(bundle.requiredTools) || bundle.requiredTools.length === 0) {
    throw new Error("El bundle debe declarar herramientas requeridas.");
  }
  const tools = new Set(announcedTools);
  const sorted = [...bundle.requiredTools].sort();
  if (
    sorted.some((tool, index) => tool !== bundle.requiredTools[index])
    || new Set(sorted).size !== sorted.length
    || sorted.some((tool) => !TOOL_NAME_PATTERN.test(tool) || !tools.has(tool))
  ) {
    throw new Error("El bundle requiere herramientas desconocidas, duplicadas o desordenadas.");
  }
  return bundle;
}

export function parsePolicyBundleBytes(bytes, announcedTools) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_POLICY_BUNDLE_BYTES) {
    throw new Error("El bundle está vacío o supera el tamaño máximo.");
  }
  const text = decodeUtf8Strict(bytes);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("El bundle no es JSON válido.");
  }
  const bundle = validatePolicyBundle(value, announcedTools);
  if (canonicalJson(bundle) !== text) throw new Error("El bundle no usa la representación JSON canónica.");
  return bundle;
}

export function createPolicyBundle({
  version,
  issuedAt,
  critical,
  minClientProtocol = POLICY_PROTOCOL_VERSION,
  requiredTools,
  prompt,
  healthSafetyRuntime,
}) {
  const promptSha256 = sha256Hex(utf8Bytes(prompt));
  const runtimeCanonical = canonicalJson(healthSafetyRuntime);
  const bundle = {
    critical,
    healthSafetyRuntime: {
      content: healthSafetyRuntime,
      policyVersion: healthSafetyRuntime.policyVersion,
      sha256: sha256Hex(utf8Bytes(runtimeCanonical)),
    },
    id: `policy-v${version}-${promptSha256.slice(0, 12)}`,
    issuedAt,
    minClientProtocol,
    prompt: {
      content: prompt,
      encoding: "utf-8",
      sha256: promptSha256,
    },
    requiredTools: [...requiredTools].sort(),
    schemaVersion: POLICY_BUNDLE_SCHEMA_VERSION,
    version,
  };
  validatePolicyBundle(bundle, requiredTools);
  const bytes = utf8Bytes(canonicalJson(bundle));
  if (bytes.byteLength > MAX_POLICY_BUNDLE_BYTES) throw new Error("El bundle generado supera el tamaño máximo.");
  return { bundle, bytes };
}

export function validatePolicyActivation(value) {
  const activation = assertExactObject(value, [
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
    activation.schemaVersion !== POLICY_ACTIVATION_SCHEMA_VERSION
    || !ACTIVATION_ID_PATTERN.test(activation.id)
    || !["activate", "rollback"].includes(activation.action)
    || !ALLOWED_CHANNELS.has(activation.channel)
    || !BUNDLE_ID_PATTERN.test(activation.bundleId)
    || !SHA256_PATTERN.test(activation.bundleSha256)
    || typeof activation.critical !== "boolean"
    || !Number.isSafeInteger(activation.sequence)
    || activation.sequence < 1
  ) {
    throw new Error("La activación contiene metadatos inválidos.");
  }
  assertIsoDate(activation.issuedAt, "activation.issuedAt");
  if (
    (activation.action === "activate" && activation.fromBundleId !== null)
    || (activation.action === "rollback" && !BUNDLE_ID_PATTERN.test(activation.fromBundleId || ""))
    || activation.fromBundleId === activation.bundleId
  ) {
    throw new Error("La relación de rollback de la activación es inválida.");
  }
  return activation;
}

export function createPolicyActivation({
  id,
  action,
  channel,
  sequence,
  bundleId,
  bundleSha256,
  issuedAt,
  critical,
  fromBundleId = null,
}) {
  const activation = {
    action,
    bundleId,
    bundleSha256,
    channel,
    critical,
    fromBundleId,
    id,
    issuedAt,
    schemaVersion: POLICY_ACTIVATION_SCHEMA_VERSION,
    sequence,
  };
  validatePolicyActivation(activation);
  return { activation, bytes: utf8Bytes(canonicalJson(activation)) };
}

export function verifySignedPolicy({
  bundleBytes,
  bundleSignature,
  activationBytes,
  activationSignature,
  trustedRoots,
  announcedTools,
  expectedChannel,
  clientProtocol = POLICY_PROTOCOL_VERSION,
}) {
  const bundle = parsePolicyBundleBytes(bundleBytes, announcedTools);
  const bundleSignatureVerification = verifySignatureEnvelope(
    bundleBytes,
    bundleSignature,
    trustedRoots,
    bundle.issuedAt,
  );
  const activationText = decodeUtf8Strict(activationBytes);
  let activationValue;
  try {
    activationValue = JSON.parse(activationText);
  } catch {
    throw new Error("La activación no es JSON válido.");
  }
  const activation = validatePolicyActivation(activationValue);
  if (canonicalJson(activation) !== activationText) {
    throw new Error("La activación no usa la representación JSON canónica.");
  }
  const activationSignatureVerification = verifySignatureEnvelope(
    activationBytes,
    activationSignature,
    trustedRoots,
    activation.issuedAt,
  );
  if (
    activation.channel !== expectedChannel
    || activation.bundleId !== bundle.id
    || activation.bundleSha256 !== sha256Hex(bundleBytes)
    || activation.critical !== bundle.critical
  ) {
    throw new Error("La activación no corresponde al bundle o al canal.");
  }
  if (bundle.minClientProtocol > clientProtocol) {
    throw new Error("El bundle exige un protocolo de cliente incompatible.");
  }
  return {
    bundle,
    activation,
    bundleSignatureCertificate: bundleSignatureVerification.certificate,
    activationSignatureCertificate: activationSignatureVerification.certificate,
  };
}
