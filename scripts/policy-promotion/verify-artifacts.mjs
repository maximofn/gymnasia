#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  readAnnouncedToolNames,
  repositoryRoot,
  verifyBundleAgainstSources,
} from "./bundle.mjs";
import { sha256Hex, validateTrustedRoots, verifySignedPolicy } from "./signing.mjs";

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error("Uso: verify-artifacts.mjs --bundle PATH --signature PATH --activation PATH --activation-signature PATH --channel Staging|Production [--roots PATH] [--source-root PATH]");
    }
    options[name.slice(2)] = value;
  }
  for (const required of ["bundle", "signature", "activation", "activation-signature", "channel"]) {
    if (!options[required]) throw new Error(`Falta --${required}.`);
  }
  if (!["Staging", "Production"].includes(options.channel)) throw new Error("El canal es inválido.");
  return options;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} no es JSON legible: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function verifyArtifactFiles(options) {
  const bundleBytes = readFileSync(resolve(options.bundle));
  const activationBytes = readFileSync(resolve(options.activation));
  const bundleSignature = readJson(resolve(options.signature), "La firma del bundle");
  const activationSignature = readJson(
    resolve(options["activation-signature"]),
    "La firma de activación",
  );
  const rootsPath = resolve(
    options.roots || resolve(repositoryRoot, "policy", "signing", "trusted-roots.json"),
  );
  const trustedRoots = validateTrustedRoots(readJson(rootsPath, "El registro de raíces"));
  const announcedTools = readAnnouncedToolNames(repositoryRoot);
  const verified = verifySignedPolicy({
    bundleBytes,
    bundleSignature,
    activationBytes,
    activationSignature,
    trustedRoots,
    announcedTools,
    expectedChannel: options.channel,
  });

  const now = Date.now();
  const activationIssuedAt = Date.parse(verified.activation.issuedAt);
  if (
    activationIssuedAt < now - 24 * 60 * 60 * 1000
    || activationIssuedAt > now + 5 * 60 * 1000
    || Date.parse(verified.activationSignatureCertificate.notBefore) > now
    || Date.parse(verified.activationSignatureCertificate.notAfter) < now
  ) {
    throw new Error("La activación no es reciente o su certificado firmante no está vigente ahora.");
  }
  if (options["source-root"]) {
    verifyBundleAgainstSources(verified.bundle, resolve(options["source-root"]));
  }
  return {
    activationId: verified.activation.id,
    action: verified.activation.action,
    bundleId: verified.bundle.id,
    bundleSha256: sha256Hex(bundleBytes),
    channel: verified.activation.channel,
    critical: verified.activation.critical,
    policyVersion: verified.bundle.healthSafetyRuntime.policyVersion,
    promptSha256: verified.bundle.prompt.sha256,
    sequence: verified.activation.sequence,
    version: verified.bundle.version,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = verifyArtifactFiles(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
