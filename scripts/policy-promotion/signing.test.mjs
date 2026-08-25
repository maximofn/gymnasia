import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalJson,
  createPolicyActivation,
  createPolicyBundle,
  createSignatureEnvelope,
  createSigningCertificate,
  generateEd25519KeyPair,
  parsePolicyBundleBytes,
  sha256Hex,
  utf8Bytes,
  verifySignatureEnvelope,
  verifySignedPolicy,
} from "./signing.mjs";

const ISSUED_AT = "2026-08-25T12:00:00.000Z";
const ROOT = generateEd25519KeyPair("gymnasia-policy-root-2026-01");
const SIGNER = generateEd25519KeyPair("gymnasia-policy-signer-2026-01");
const ROOTS = {
  roots: [{
    algorithm: "Ed25519",
    keyId: ROOT.keyId,
    publicKeyBase64Url: ROOT.publicKeyBase64Url,
  }],
  schemaVersion: 1,
};
const CERTIFICATE = createSigningCertificate({
  keyId: SIGNER.keyId,
  publicKeyBase64Url: SIGNER.publicKeyBase64Url,
  rootKeyId: ROOT.keyId,
  notBefore: "2026-01-01T00:00:00.000Z",
  notAfter: "2027-01-01T00:00:00.000Z",
  rootPrivateKeyPkcs8Base64: ROOT.privateKeyPkcs8Base64,
});
const TOOLS = ["read_field_value", "save_personal_data"];
const RUNTIME = {
  policyVersion: "2026.08.1",
  rules: [{ id: "SAFE-1", enabled: true }],
  schemaVersion: 1,
};

function signedFixture() {
  const { bundle, bytes: bundleBytes } = createPolicyBundle({
    version: "2026.08.2",
    issuedAt: ISSUED_AT,
    critical: false,
    requiredTools: TOOLS,
    prompt: "Política auténtica\n",
    healthSafetyRuntime: RUNTIME,
  });
  const bundleSignature = createSignatureEnvelope(
    bundleBytes,
    CERTIFICATE,
    SIGNER.privateKeyPkcs8Base64,
  );
  const { activation, bytes: activationBytes } = createPolicyActivation({
    id: "activation-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    action: "activate",
    channel: "Staging",
    sequence: 1,
    bundleId: bundle.id,
    bundleSha256: sha256Hex(bundleBytes),
    issuedAt: ISSUED_AT,
    critical: bundle.critical,
  });
  const activationSignature = createSignatureEnvelope(
    activationBytes,
    CERTIFICATE,
    SIGNER.privateKeyPkcs8Base64,
  );
  return {
    bundle,
    bundleBytes,
    bundleSignature,
    activation,
    activationBytes,
    activationSignature,
  };
}

test("firma y verifica un bundle y su activación de canal", () => {
  const fixture = signedFixture();
  const verified = verifySignedPolicy({
    ...fixture,
    trustedRoots: ROOTS,
    announcedTools: TOOLS,
    expectedChannel: "Staging",
  });
  assert.equal(verified.bundle.prompt.content, "Política auténtica\n");
  assert.equal(verified.activation.sequence, 1);
});

test("el bundle canónico hace interoperables publicador y cliente", () => {
  const { bundle, bundleBytes, bundleSignature } = signedFixture();
  assert.equal(canonicalJson(bundle), new TextDecoder().decode(bundleBytes));
  assert.equal(parsePolicyBundleBytes(bundleBytes, TOOLS).id, bundle.id);
  assert.doesNotThrow(() => verifySignatureEnvelope(
    bundleBytes,
    bundleSignature,
    ROOTS,
    bundle.issuedAt,
  ));
});

test("rechaza cualquier alteración del bundle o de su firma", () => {
  const fixture = signedFixture();
  const mutated = Uint8Array.from(fixture.bundleBytes);
  mutated[mutated.length - 2] ^= 1;
  assert.throws(
    () => verifySignatureEnvelope(mutated, fixture.bundleSignature, ROOTS, fixture.bundle.issuedAt),
    /no corresponde|inválida/,
  );

  const invalidSignature = structuredClone(fixture.bundleSignature);
  invalidSignature.signatureBase64Url = `${"A".repeat(85)}B`;
  assert.throws(
    () => verifySignatureEnvelope(fixture.bundleBytes, invalidSignature, ROOTS, fixture.bundle.issuedAt),
    /inválida/,
  );
});

test("rechaza certificado no autorizado, expirado o alterado", () => {
  const fixture = signedFixture();
  assert.throws(
    () => verifySignatureEnvelope(fixture.bundleBytes, fixture.bundleSignature, {
      roots: [{ ...ROOTS.roots[0], keyId: "gymnasia-policy-root-other" }],
      schemaVersion: 1,
    }, fixture.bundle.issuedAt),
    /no está autorizada/,
  );

  const expired = createSigningCertificate({
    keyId: SIGNER.keyId,
    publicKeyBase64Url: SIGNER.publicKeyBase64Url,
    rootKeyId: ROOT.keyId,
    notBefore: "2025-01-01T00:00:00.000Z",
    notAfter: "2025-12-31T23:59:59.999Z",
    rootPrivateKeyPkcs8Base64: ROOT.privateKeyPkcs8Base64,
  });
  const expiredEnvelope = createSignatureEnvelope(
    fixture.bundleBytes,
    expired,
    SIGNER.privateKeyPkcs8Base64,
  );
  assert.throws(
    () => verifySignatureEnvelope(fixture.bundleBytes, expiredEnvelope, ROOTS, fixture.bundle.issuedAt),
    /fuera de la vigencia/,
  );

  const altered = structuredClone(fixture.bundleSignature);
  altered.certificate.payload.notAfter = "2028-01-01T00:00:00.000Z";
  assert.throws(
    () => verifySignatureEnvelope(fixture.bundleBytes, altered, ROOTS, fixture.bundle.issuedAt),
    /firma raíz.*inválida/,
  );
});

test("rechaza canal, protocolo y tools incompatibles", () => {
  const fixture = signedFixture();
  assert.throws(() => verifySignedPolicy({
    ...fixture,
    trustedRoots: ROOTS,
    announcedTools: TOOLS,
    expectedChannel: "Production",
  }), /canal/);
  assert.throws(() => verifySignedPolicy({
    ...fixture,
    trustedRoots: ROOTS,
    announcedTools: ["read_field_value"],
    expectedChannel: "Staging",
  }), /herramientas desconocidas/);

  const future = createPolicyBundle({
    version: "2026.08.3",
    issuedAt: ISSUED_AT,
    critical: false,
    minClientProtocol: 2,
    requiredTools: TOOLS,
    prompt: "Futuro\n",
    healthSafetyRuntime: RUNTIME,
  });
  const futureSignature = createSignatureEnvelope(
    future.bytes,
    CERTIFICATE,
    SIGNER.privateKeyPkcs8Base64,
  );
  const activation = createPolicyActivation({
    id: "activation-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    action: "activate",
    channel: "Staging",
    sequence: 2,
    bundleId: future.bundle.id,
    bundleSha256: sha256Hex(future.bytes),
    issuedAt: ISSUED_AT,
    critical: false,
  });
  assert.throws(() => verifySignedPolicy({
    bundleBytes: future.bytes,
    bundleSignature: futureSignature,
    activationBytes: activation.bytes,
    activationSignature: createSignatureEnvelope(
      activation.bytes,
      CERTIFICATE,
      SIGNER.privateKeyPkcs8Base64,
    ),
    trustedRoots: ROOTS,
    announcedTools: TOOLS,
    expectedChannel: "Staging",
    clientProtocol: 1,
  }), /protocolo/);
});

test("una activación normal no puede disfrazarse de rollback", () => {
  const fixture = signedFixture();
  const invalid = { ...fixture.activation, fromBundleId: "policy-v2026.08.1-aaaaaaaaaaaa" };
  assert.throws(
    () => createPolicyActivation(invalid),
    /rollback/,
  );
});

test("rechaza bytes no UTF-8, HTML, tamaño excesivo y JSON no canónico", () => {
  assert.throws(() => parsePolicyBundleBytes(Uint8Array.from([0xc3, 0x28]), TOOLS), /encoded|cod|JSON|UTF/i);
  const fixture = signedFixture();
  const nonCanonical = utf8Bytes(JSON.stringify(fixture.bundle));
  assert.throws(() => parsePolicyBundleBytes(nonCanonical, TOOLS), /canónica/);
  const htmlBundle = structuredClone(fixture.bundle);
  htmlBundle.prompt.content = "<!doctype html><title>Error</title>";
  htmlBundle.prompt.sha256 = sha256Hex(utf8Bytes(htmlBundle.prompt.content));
  htmlBundle.id = `policy-v${htmlBundle.version}-${htmlBundle.prompt.sha256.slice(0, 12)}`;
  assert.throws(
    () => parsePolicyBundleBytes(utf8Bytes(canonicalJson(htmlBundle)), TOOLS),
    /prompt/,
  );
  assert.throws(
    () => parsePolicyBundleBytes(new Uint8Array(256 * 1024 + 1), TOOLS),
    /tamaño/,
  );
});
