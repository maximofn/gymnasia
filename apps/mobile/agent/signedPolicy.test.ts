import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalPolicyJson,
  type PolicySignatureEnvelope,
  type PolicyTrustedRoots,
  type SignedPolicyPackage,
  verifySignedPolicyPackage,
} from "./signedPolicy";

const ANNOUNCED_TOOLS = ["read_field_value", "save_personal_data"];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function publicKeyBase64Url(key: KeyObject): string {
  const jwk = key.export({ format: "jwk" });
  if (typeof jwk.x !== "string") throw new Error("missing public key");
  return jwk.x;
}

function nodeSignature(body: string, privateKey: KeyObject): Uint8Array {
  const signature = sign(
    null,
    new TextEncoder().encode(body),
    privateKey,
  ) as unknown as Uint8Array;
  return Uint8Array.from(signature);
}

function envelope(
  body: string,
  issuedAt: string,
  signerPrivateKey: KeyObject,
  signerPublicKey: KeyObject,
  rootPrivateKey: KeyObject,
): PolicySignatureEnvelope {
  const certificatePayload = {
    algorithm: "Ed25519" as const,
    keyId: "gymnasia-policy-signer-2026-01",
    notAfter: "2027-01-01T00:00:00.000Z",
    notBefore: "2026-01-01T00:00:00.000Z",
    publicKeyBase64Url: publicKeyBase64Url(signerPublicKey),
    purpose: "gymnasia-policy" as const,
    rootKeyId: "gymnasia-policy-root-2026-01",
    schemaVersion: 1 as const,
  };
  expect(Date.parse(issuedAt)).toBeGreaterThanOrEqual(Date.parse(certificatePayload.notBefore));
  return {
    algorithm: "Ed25519",
    certificate: {
      payload: certificatePayload,
      rootSignatureBase64Url: base64Url(nodeSignature(
        canonicalPolicyJson(certificatePayload),
        rootPrivateKey,
      )),
    },
    schemaVersion: 1,
    signatureBase64Url: base64Url(nodeSignature(body, signerPrivateKey)),
    signedSha256: sha256(body),
  };
}

function fixture(): {
  packageValue: SignedPolicyPackage;
  roots: PolicyTrustedRoots;
} {
  const root = generateKeyPairSync("ed25519");
  const signer = generateKeyPairSync("ed25519");
  const issuedAt = "2026-08-25T10:00:00.000Z";
  const prompt = "Política de prueba segura.\n";
  const runtime = {
    policyVersion: "2026.08.1",
    rules: [],
    schemaVersion: 1,
  };
  const bundle = {
    critical: false,
    healthSafetyRuntime: {
      content: runtime,
      policyVersion: runtime.policyVersion,
      sha256: sha256(canonicalPolicyJson(runtime)),
    },
    id: `policy-v2026.08.2-${sha256(prompt).slice(0, 12)}`,
    issuedAt,
    minClientProtocol: 1,
    prompt: {
      content: prompt,
      encoding: "utf-8",
      sha256: sha256(prompt),
    },
    requiredTools: ["read_field_value"],
    schemaVersion: 1,
    version: "2026.08.2",
  };
  const bundleBody = canonicalPolicyJson(bundle);
  const activation = {
    action: "activate",
    bundleId: bundle.id,
    bundleSha256: sha256(bundleBody),
    channel: "Production",
    critical: false,
    fromBundleId: null,
    id: "activation-0123456789abcdef0123456789abcdef",
    issuedAt,
    schemaVersion: 1,
    sequence: 7,
  };
  const activationBody = canonicalPolicyJson(activation);
  return {
    roots: {
      roots: [{
        algorithm: "Ed25519",
        keyId: "gymnasia-policy-root-2026-01",
        publicKeyBase64Url: publicKeyBase64Url(root.publicKey),
      }],
      schemaVersion: 1,
    },
    packageValue: {
      activationBody,
      activationSignature: envelope(
        activationBody,
        issuedAt,
        signer.privateKey,
        signer.publicKey,
        root.privateKey,
      ),
      bundleBody,
      bundleSignature: envelope(
        bundleBody,
        issuedAt,
        signer.privateKey,
        signer.publicKey,
        root.privateKey,
      ),
      candidate: bundle.id,
      channel: "Production",
      deploymentId: 42,
      environment: "production",
      schemaVersion: 1,
    },
  };
}

function verifyFixture(packageValue: unknown, roots: unknown, clientProtocol = 1) {
  return verifySignedPolicyPackage({
    packageValue,
    trustedRoots: roots,
    announcedTools: ANNOUNCED_TOOLS,
    expectedEnvironment: "production",
    expectedChannel: "Production",
    clientProtocol,
  });
}

describe("signed policy verification", () => {
  it("verifica en JavaScript móvil las firmas Ed25519 creadas por Node", () => {
    const { packageValue, roots } = fixture();
    const verified = verifyFixture(packageValue, roots);

    expect(verified.bundle.prompt.content).toBe("Política de prueba segura.\n");
    expect(verified.activation.sequence).toBe(7);
  });

  it.each([
    "bundle",
    "bundle-signature",
    "activation",
    "activation-signature",
  ])("rechaza alteraciones de %s", (target) => {
    const { packageValue, roots } = fixture();
    const tampered = structuredClone(packageValue);
    if (target === "bundle") tampered.bundleBody = tampered.bundleBody.replace("segura", "insegura");
    if (target === "bundle-signature") tampered.bundleSignature.signatureBase64Url = "A".repeat(86);
    if (target === "activation") tampered.activationBody = tampered.activationBody.replace('"sequence": 7', '"sequence": 8');
    if (target === "activation-signature") tampered.activationSignature.signatureBase64Url = "A".repeat(86);

    expect(() => verifyFixture(tampered, roots)).toThrow();
  });

  it("rechaza una raíz no incluida en la app", () => {
    const { packageValue } = fixture();
    const other = fixture();
    expect(() => verifyFixture(packageValue, other.roots)).toThrow(/raíz|firma raíz/i);
  });

  it("rechaza canal, entorno, tools y protocolo incompatibles", () => {
    const { packageValue, roots } = fixture();
    expect(() => verifySignedPolicyPackage({
      packageValue,
      trustedRoots: roots,
      announcedTools: ANNOUNCED_TOOLS,
      expectedEnvironment: "staging",
      expectedChannel: "Staging",
    })).toThrow(/entorno o canal/);
    expect(() => verifySignedPolicyPackage({
      packageValue,
      trustedRoots: roots,
      announcedTools: [],
      expectedEnvironment: "production",
      expectedChannel: "Production",
    })).toThrow(/herramientas/);

    const incompatible = structuredClone(packageValue);
    const bundle = JSON.parse(incompatible.bundleBody);
    bundle.minClientProtocol = 2;
    incompatible.bundleBody = canonicalPolicyJson(bundle);
    expect(() => verifyFixture(incompatible, roots, 1)).toThrow();
  });

  it("rechaza JSON no canónico antes de usarlo", () => {
    const { packageValue, roots } = fixture();
    packageValue.activationBody = JSON.stringify(JSON.parse(packageValue.activationBody));
    expect(() => verifyFixture(packageValue, roots)).toThrow(/canónico/);
  });
});
