import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderRuntimePolicyModule } from "../health-safety/policy.mjs";
import { verifyBundledSnapshot } from "./check-bundled-snapshot.mjs";
import {
  canonicalJson, createPolicyActivation, createPolicyBundle, createSignatureEnvelope,
  createSigningCertificate, generateEd25519KeyPair, sha256Hex,
} from "./signing.mjs";

const root = generateEd25519KeyPair("snapshot-test-root");
const signer = generateEd25519KeyPair("snapshot-test-signer");
const trustedRoots = { schemaVersion: 1, roots: [{ algorithm: "Ed25519", keyId: root.keyId, publicKeyBase64Url: root.publicKeyBase64Url }] };
const certificate = createSigningCertificate({
  keyId: signer.keyId, publicKeyBase64Url: signer.publicKeyBase64Url, rootKeyId: root.keyId,
  notBefore: "2026-01-01T00:00:00.000Z", notAfter: "2027-01-01T00:00:00.000Z",
  rootPrivateKeyPkcs8Base64: root.privateKeyPkcs8Base64,
});
const literal = (name, value, suffix = "") => `export const ${name} = ${JSON.stringify(value, null, 2)}${suffix};\n`;

function fixture(environment = "staging") {
  const channel = environment === "staging" ? "Staging" : "Production";
  const issuedAt = "2026-10-14T00:00:00.000Z";
  const runtime = { schemaVersion: 1, policyVersion: "2026.08.1", rules: [{ id: "SAFE-1", enabled: true }] };
  const { bundle, bytes: bundleBytes } = createPolicyBundle({ version: "2026.08.3", issuedAt, critical: false,
    requiredTools: ["search_exercises"], prompt: "Política auténtica\n", healthSafetyRuntime: runtime });
  const { activation, bytes: activationBytes } = createPolicyActivation({ id: `activation-${"a".repeat(32)}`,
    action: "activate", channel, sequence: 1, bundleId: bundle.id, bundleSha256: sha256Hex(bundleBytes), issuedAt, critical: false });
  const snapshot = { schemaVersion: 1, environment, channel, candidate: bundle.id, deploymentId: 1,
    bundleBody: canonicalJson(bundle), bundleSignature: createSignatureEnvelope(bundleBytes, certificate, signer.privateKeyPkcs8Base64),
    activationBody: canonicalJson(activation), activationSignature: createSignatureEnvelope(activationBytes, certificate, signer.privateKeyPkcs8Base64) };
  return {
    environment, trustedRoots, announcedTools: ["search_exercises"],
    signedModule: literal("BUNDLED_SIGNED_POLICY_PACKAGE", snapshot, " satisfies SignedPolicyPackage"),
    metadata: { schemaVersion: 2, environment, channel, candidate: bundle.id, sha256: bundle.prompt.sha256,
      bundleSha256: sha256Hex(bundleBytes), runtimePolicySha256: bundle.healthSafetyRuntime.sha256,
      runtimePolicyVersion: runtime.policyVersion, activationId: activation.id, sequence: 1, deploymentId: 1 },
    promptModule: literal("BUNDLED_CHAT_SYSTEM_PROMPT", bundle.prompt.content)
      + literal("BUNDLED_CHAT_SYSTEM_PROMPT_SHA256", bundle.prompt.sha256)
      + literal("BUNDLED_CHAT_SYSTEM_PROMPT_VERSION", `sha256:${bundle.prompt.sha256}`),
    runtimeModule: renderRuntimePolicyModule(runtime),
  };
}

for (const environment of ["staging", "production"]) {
  test(`${environment} exige y verifica el snapshot firmado completo antes del build nativo`, () => {
    assert.equal(verifyBundledSnapshot(fixture(environment)).signed, true);
  });
  test(`${environment} rechaza el módulo null que permitió publicar un Staging inutilizable`, () => {
    const input = fixture(environment);
    input.signedModule = "export const BUNDLED_SIGNED_POLICY_PACKAGE: SignedPolicyPackage | null = null;\n";
    assert.throws(() => verifyBundledSnapshot(input), /Falta el snapshot firmado.*prepare:policy-snapshot/);
  });
}

test("Development conserva su snapshot local sin necesitar firma ni red", () => {
  assert.deepEqual(verifyBundledSnapshot({ environment: "development" }), { environment: "development", signed: false });
});

test("rechaza mezclar paquetes de Staging y Production", () => {
  const input = fixture();
  input.environment = "production";
  assert.throws(() => verifyBundledSnapshot(input), /otro entorno/);
});

test("no acepta cambiar el prompt dentro de un paquete auténtico", () => {
  const input = fixture();
  input.signedModule = input.signedModule.replace("Política auténtica", "Política modificada");
  assert.throws(() => verifyBundledSnapshot(input), /inválid|digest|firma|sha256|coincide/i);
});

test("los metadatos visibles no sustituyen el paquete firmado", () => {
  for (const name of ["schemaVersion", "environment", "channel", "candidate", "sha256", "bundleSha256",
    "runtimePolicySha256", "runtimePolicyVersion", "activationId", "sequence", "deploymentId"]) {
    const input = fixture();
    input.metadata[name] = typeof input.metadata[name] === "number" ? 999 : "incorrecto";
    assert.throws(() => verifyBundledSnapshot(input), /Metadato del snapshot incoherente/);
  }
});

test("rechaza módulos de prompt y política sanitaria distintos del paquete firmado", () => {
  for (const module of ["promptModule", "runtimeModule"]) {
    const input = fixture();
    input[module] = input[module].replace(module === "promptModule" ? "auténtica" : "SAFE-1", "alterada");
    assert.throws(() => verifyBundledSnapshot(input), /no corresponde/);
  }
});

test("EAS verifica el snapshot antes de instalar dependencias y compilar Android", () => {
  const mobile = JSON.parse(readFileSync(new URL("../../apps/mobile/package.json", import.meta.url)));
  assert.equal(mobile.scripts["eas-build-pre-install"], "node ../../scripts/policy-promotion/check-bundled-snapshot.mjs");
});
