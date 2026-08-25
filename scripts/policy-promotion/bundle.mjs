import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  createPolicyBundle,
  createSignatureEnvelope,
  parsePolicyBundleBytes,
  sha256Hex,
  utf8Bytes,
  validateTrustedRoots,
  verifySignatureEnvelope,
} from "./signing.mjs";

export const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const policySigningDirectory = join(repositoryRoot, "policy", "signing");
export const bundleConfigPath = join(policySigningDirectory, "bundle.config.json");
export const trustedRootsPath = join(policySigningDirectory, "trusted-roots.json");
export const signerCertificatePath = join(policySigningDirectory, "signer-certificate.json");
export const currentBundlePath = join(policySigningDirectory, "current.bundle.json");
export const currentBundleSignaturePath = join(policySigningDirectory, "current.bundle.signature.json");

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertBundleConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("bundle.config.json debe ser un objeto.");
  }
  const expected = ["critical", "minClientProtocol", "requiredTools", "schemaVersion", "version"];
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("bundle.config.json contiene campos ausentes o desconocidos.");
  }
  if (
    value.schemaVersion !== 1
    || !/^\d{4}\.\d{2}\.\d+$/.test(value.version)
    || typeof value.critical !== "boolean"
    || !Number.isSafeInteger(value.minClientProtocol)
    || value.minClientProtocol < 1
    || !Array.isArray(value.requiredTools)
    || value.requiredTools.length === 0
  ) {
    throw new Error("bundle.config.json es inválido.");
  }
  return value;
}

export function normalizePrompt(value) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function readAnnouncedToolNames(root = repositoryRoot) {
  const source = readFileSync(join(root, "apps", "mobile", "agent", "toolDefinitions.ts"), "utf8");
  const start = source.indexOf("export const AGENT_TOOL_DEFINITIONS");
  const end = source.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("No se pudo localizar AGENT_TOOL_DEFINITIONS.");
  const names = [...source.slice(start, end).matchAll(/^\s+name: "([a-z][a-z0-9_]*)",$/gm)]
    .map((match) => match[1]);
  if (names.length === 0 || new Set(names).size !== names.length) {
    throw new Error("El catálogo anunciado de tools es vacío o contiene duplicados.");
  }
  return names;
}

export function loadBundleInputs(root = repositoryRoot) {
  const config = assertBundleConfig(readJson(
    join(root, "policy", "signing", "bundle.config.json"),
    "policy/signing/bundle.config.json",
  ));
  const prompt = normalizePrompt(readFileSync(join(root, "prompts", "AGENTS.md"), "utf8"));
  const healthSafetyRuntime = readJson(
    join(root, "policy", "health-safety", "runtime.json"),
    "policy/health-safety/runtime.json",
  );
  const announcedTools = readAnnouncedToolNames(root);
  for (const tool of config.requiredTools) {
    if (!announcedTools.includes(tool)) throw new Error(`La tool requerida ${tool} no existe en el catálogo móvil.`);
  }
  return { config, prompt, healthSafetyRuntime, announcedTools };
}

export function buildCurrentBundle({ issuedAt, root = repositoryRoot } = {}) {
  const { config, prompt, healthSafetyRuntime, announcedTools } = loadBundleInputs(root);
  const result = createPolicyBundle({
    version: config.version,
    issuedAt,
    critical: config.critical,
    minClientProtocol: config.minClientProtocol,
    requiredTools: config.requiredTools,
    prompt,
    healthSafetyRuntime,
  });
  parsePolicyBundleBytes(result.bytes, announcedTools);
  return { ...result, announcedTools };
}

export function signCurrentBundle({
  issuedAt,
  certificate,
  privateKeyPkcs8Base64,
  root = repositoryRoot,
}) {
  const built = buildCurrentBundle({ issuedAt, root });
  const signature = createSignatureEnvelope(
    built.bytes,
    certificate,
    privateKeyPkcs8Base64,
  );
  return { ...built, signature };
}

export function verifyCurrentBundleFiles(root = repositoryRoot) {
  const verified = verifyBundleFiles({
    bundlePath: join(root, "policy", "signing", "current.bundle.json"),
    signaturePath: join(root, "policy", "signing", "current.bundle.signature.json"),
    rootsPath: join(root, "policy", "signing", "trusted-roots.json"),
    announcedRoot: root,
  });
  verifyBundleAgainstSources(verified.bundle, root);
  return verified;
}

export function verifyBundleFiles({ bundlePath, signaturePath, rootsPath, announcedRoot = repositoryRoot }) {
  const announcedTools = readAnnouncedToolNames(announcedRoot);
  const trustedRoots = validateTrustedRoots(readJson(rootsPath, "trusted-roots.json"));
  const bundleText = readFileSync(bundlePath, "utf8");
  const signature = readJson(signaturePath, "policy.bundle.signature.json");
  const bytes = utf8Bytes(bundleText);
  const bundle = parsePolicyBundleBytes(bytes, announcedTools);
  verifySignatureEnvelope(bytes, signature, trustedRoots, bundle.issuedAt);
  if (signature.signedSha256 !== sha256Hex(bytes)) {
    throw new Error("La firma no contiene el digest del bundle.");
  }
  return { bundle, bundleBytes: bytes, signature, trustedRoots };
}

export function verifyBundleAgainstSources(bundle, root = repositoryRoot) {
  const { config, prompt, healthSafetyRuntime } = loadBundleInputs(root);
  if (
    bundle.version !== config.version
    || bundle.critical !== config.critical
    || bundle.minClientProtocol !== config.minClientProtocol
    || canonicalJson(bundle.requiredTools) !== canonicalJson([...config.requiredTools].sort())
    || bundle.prompt.content !== prompt
    || canonicalJson(bundle.healthSafetyRuntime.content) !== canonicalJson(healthSafetyRuntime)
  ) {
    throw new Error("El bundle firmado no corresponde a sus fuentes canónicas.");
  }
  return bundle;
}
