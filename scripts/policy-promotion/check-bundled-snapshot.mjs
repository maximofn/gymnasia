import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readAnnouncedToolNames } from "./bundle.mjs";
import { canonicalJson, sha256Hex, utf8Bytes, verifySignedPolicy } from "./signing.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

function generatedValue(source, name, suffix = "") {
  const match = source?.match(new RegExp(`^export const ${name} = ([\\s\\S]*?)${suffix};\\s*$`, "m"));
  assert.ok(match, `Falta ${name} en el snapshot integrado.`);
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new Error(`${name} no contiene JSON válido.`);
  }
}

export function verifyBundledSnapshot({
  environment, signedModule, metadata, promptModule, runtimeModule, trustedRoots, announcedTools,
}) {
  assert.ok(["development", "staging", "production"].includes(environment), "APP_ENV no es válido.");
  if (environment === "development") return { environment, signed: false };
  const channel = environment === "staging" ? "Staging" : "Production";
  assert.ok(signedModule?.includes(" satisfies SignedPolicyPackage;"),
    `Falta el snapshot firmado de ${channel}. Ejecuta npm run prepare:policy-snapshot -- --environment ${environment} antes de compilar.`);
  const snapshot = generatedValue(signedModule, "BUNDLED_SIGNED_POLICY_PACKAGE", " satisfies SignedPolicyPackage");
  assert.equal(snapshot.schemaVersion, 1, "Versión de snapshot firmado inesperada.");
  assert.equal(snapshot.environment, environment, "El snapshot firmado pertenece a otro entorno.");
  assert.equal(snapshot.channel, channel, "El snapshot firmado pertenece a otro canal.");
  assert.ok(Number.isSafeInteger(snapshot.deploymentId) && snapshot.deploymentId > 0, "Deployment del snapshot inválido.");
  const bundleBytes = utf8Bytes(snapshot.bundleBody);
  const verified = verifySignedPolicy({
    bundleBytes,
    bundleSignature: snapshot.bundleSignature,
    activationBytes: utf8Bytes(snapshot.activationBody),
    activationSignature: snapshot.activationSignature,
    trustedRoots,
    announcedTools,
    expectedChannel: channel,
  });
  assert.equal(snapshot.candidate, verified.bundle.id, "La identidad del snapshot firmado no coincide.");
  const expectedMetadata = {
    schemaVersion: 2, environment, channel,
    candidate: verified.bundle.id,
    sha256: verified.bundle.prompt.sha256,
    bundleSha256: sha256Hex(bundleBytes),
    runtimePolicySha256: verified.bundle.healthSafetyRuntime.sha256,
    runtimePolicyVersion: verified.bundle.healthSafetyRuntime.policyVersion,
    activationId: verified.activation.id,
    sequence: verified.activation.sequence,
    deploymentId: snapshot.deploymentId,
  };
  for (const [name, value] of Object.entries(expectedMetadata)) {
    assert.equal(metadata?.[name], value, `Metadato del snapshot incoherente: ${name}.`);
  }
  assert.ok(generatedValue(promptModule, "BUNDLED_CHAT_SYSTEM_PROMPT") === verified.bundle.prompt.content,
    "El prompt integrado no corresponde al snapshot firmado.");
  assert.equal(generatedValue(promptModule, "BUNDLED_CHAT_SYSTEM_PROMPT_SHA256"), verified.bundle.prompt.sha256);
  assert.equal(generatedValue(promptModule, "BUNDLED_CHAT_SYSTEM_PROMPT_VERSION"), `sha256:${verified.bundle.prompt.sha256}`);
  assert.ok(canonicalJson(generatedValue(runtimeModule, "BUNDLED_HEALTH_SAFETY_POLICY", " as const"))
    === canonicalJson(verified.bundle.healthSafetyRuntime.content),
    "La política sanitaria integrada no corresponde al snapshot firmado.");
  return { environment, channel, candidate: verified.bundle.id, signed: true };
}

export function checkBundledSnapshot(environment = process.env.APP_ENV, root = repositoryRoot) {
  if (environment === "development") return verifyBundledSnapshot({ environment });
  const generated = join(root, "apps/mobile/agent/generated");
  return verifyBundledSnapshot({
    environment,
    signedModule: readFileSync(join(generated, "signedPolicySnapshot.generated.ts"), "utf8"),
    metadata: JSON.parse(readFileSync(join(generated, "policySnapshot.generated.json"), "utf8")),
    promptModule: readFileSync(join(generated, "chatSystemPrompt.generated.ts"), "utf8"),
    runtimeModule: readFileSync(join(generated, "healthSafetyPolicy.generated.ts"), "utf8"),
    trustedRoots: JSON.parse(readFileSync(join(root, "policy/signing/trusted-roots.json"), "utf8")),
    announcedTools: readAnnouncedToolNames(root),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkBundledSnapshot();
  console.log(result.signed ? `Snapshot firmado verificado: ${result.channel} · ${result.candidate}.` : "Development usa el snapshot local.");
}
