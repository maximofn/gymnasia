#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  currentBundlePath,
  currentBundleSignaturePath,
  repositoryRoot,
  signerCertificatePath,
  signCurrentBundle,
  trustedRootsPath,
  verifyBundleFiles,
  verifyCurrentBundleFiles,
} from "./bundle.mjs";
import {
  canonicalJson,
  createPolicyActivation,
  createSignatureEnvelope,
  createSigningCertificate,
  generateEd25519KeyPair,
  sha256Hex,
  utf8Bytes,
  validatePolicyActivation,
  validateTrustedRoots,
  verifySignatureEnvelope,
} from "./signing.mjs";

const PRIVATE_KEY_FIELD = "ed25519_pkcs8_base64";
const PUBLIC_KEY_FIELD = "ed25519_public_base64url";
const KEY_ID_FIELD = "gymnasia_policy_key_id";

function usage() {
  return [
    "Uso:",
    "  node scripts/policy-promotion/sign-policy.mjs key-init-root --key-id ID",
    "  node scripts/policy-promotion/sign-policy.mjs key-init-signer --key-id ID --not-after ISO",
    "  node scripts/policy-promotion/sign-policy.mjs bundle-sign [--issued-at ISO]",
    "  node scripts/policy-promotion/sign-policy.mjs bundle-check",
    "  node scripts/policy-promotion/sign-policy.mjs activation-sign --channel Staging|Production --sequence N [--rollback-from ID] --output DIR",
    "  node scripts/policy-promotion/sign-policy.mjs promote --operation staging|production|rollback [--pr N | --bootstrap-main true] [--candidate ID] [--sequence N] [--rollback-from ID]",
  ].join("\n");
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(usage());
    options[name.slice(2)] = value;
  }
  return options;
}

function runBw(args, { input } = {}) {
  const entrypoint = process.env.BITWARDEN_CLI_JS_ENTRYPOINT?.trim();
  const command = entrypoint ? process.execPath : "bw";
  const commandArgs = entrypoint
    ? ["--dns-result-order=ipv4first", entrypoint, ...args]
    : args;
  const result = spawnSync(command, commandArgs, {
    input,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error?.code === "ENOENT") {
    throw new Error("Falta Bitwarden CLI (`bw`). Instálala y desbloquea el vault antes de continuar.");
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim();
    throw new Error(
      `Bitwarden CLI rechazó ${args[0]}. Comprueba que el vault está desbloqueado.`
      + (detail ? ` Detalle: ${detail}` : ""),
    );
  }
  return result.stdout;
}

function runGh(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error?.code === "ENOENT") {
    throw new Error("Falta GitHub CLI (`gh`) para lanzar la promoción.");
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`GitHub CLI rechazó ${args[0]}${detail ? `: ${detail}` : "."}`);
  }
  return result.stdout;
}

function assertBitwardenUnlocked() {
  const status = JSON.parse(runBw(["status"]));
  if (status.status !== "unlocked") {
    throw new Error("Bitwarden debe estar desbloqueado. Ejecuta `bw login`/`bw unlock` sin compartir la sesión.");
  }
}

function itemIdForRole(role) {
  const name = role === "root"
    ? "BITWARDEN_POLICY_ROOT_ITEM_ID"
    : "BITWARDEN_POLICY_SIGNER_ITEM_ID";
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en el entorno local.`);
  return value;
}

function hiddenField(item, name) {
  const field = Array.isArray(item.fields)
    ? item.fields.find((candidate) => candidate?.name === name)
    : undefined;
  return typeof field?.value === "string" ? field.value : "";
}

function readBitwardenKey(role) {
  assertBitwardenUnlocked();
  const item = JSON.parse(runBw(["get", "item", itemIdForRole(role)]));
  const privateKeyPkcs8Base64 = hiddenField(item, PRIVATE_KEY_FIELD);
  const publicKeyBase64Url = hiddenField(item, PUBLIC_KEY_FIELD);
  const keyId = hiddenField(item, KEY_ID_FIELD);
  if (!privateKeyPkcs8Base64 || !publicKeyBase64Url || !keyId) {
    throw new Error(`El elemento ${role} de Bitwarden no contiene los tres campos de firma esperados.`);
  }
  return { keyId, privateKeyPkcs8Base64, publicKeyBase64Url };
}

export function populateBitwardenKeyFields(item, key, role) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`El elemento ${role} de Bitwarden es inválido.`);
  }
  const fields = Array.isArray(item.fields) ? item.fields : [];
  const names = new Set([PRIVATE_KEY_FIELD, PUBLIC_KEY_FIELD, KEY_ID_FIELD]);
  if (fields.some((field) => names.has(field?.name))) {
    throw new Error(
      `El elemento ${role} de Bitwarden ya contiene material de firma. `
      + "Usa una nota segura vacía para evitar sobrescribir una clave existente.",
    );
  }
  return {
    ...item,
    fields: [
      ...fields,
      { name: PRIVATE_KEY_FIELD, type: 1, value: key.privateKeyPkcs8Base64 },
      { name: PUBLIC_KEY_FIELD, type: 0, value: key.publicKeyBase64Url },
      { name: KEY_ID_FIELD, type: 0, value: key.keyId },
    ],
  };
}

function writeBitwardenKey(role, key) {
  assertBitwardenUnlocked();
  const itemId = itemIdForRole(role);
  const item = populateBitwardenKeyFields(
    JSON.parse(runBw(["get", "item", itemId])),
    key,
    role,
  );
  const encoded = runBw(["encode"], { input: JSON.stringify(item) }).trim();
  runBw(["edit", "item", itemId], { input: encoded });
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function commandKeyInitRoot(options) {
  if (!options["key-id"]) throw new Error("key-init-root exige --key-id.");
  const key = generateEd25519KeyPair(options["key-id"]);
  writeBitwardenKey("root", key);
  const roots = {
    roots: [{
      algorithm: "Ed25519",
      keyId: key.keyId,
      publicKeyBase64Url: key.publicKeyBase64Url,
    }],
    schemaVersion: 1,
  };
  validateTrustedRoots(roots);
  writeFileSync(trustedRootsPath, canonicalJson(roots), "utf8");
  console.log(`Raíz ${key.keyId} creada en Bitwarden; solo se ha escrito su parte pública en el repositorio.`);
}

function commandKeyInitSigner(options) {
  if (!options["key-id"] || !options["not-after"]) {
    throw new Error("key-init-signer exige --key-id y --not-after.");
  }
  const root = readBitwardenKey("root");
  const key = generateEd25519KeyPair(options["key-id"]);
  const notBefore = new Date().toISOString();
  const certificate = createSigningCertificate({
    keyId: key.keyId,
    publicKeyBase64Url: key.publicKeyBase64Url,
    rootKeyId: root.keyId,
    notBefore,
    notAfter: new Date(options["not-after"]).toISOString(),
    rootPrivateKeyPkcs8Base64: root.privateKeyPkcs8Base64,
  });
  writeBitwardenKey("signer", key);
  writeFileSync(signerCertificatePath, canonicalJson(certificate), "utf8");
  console.log(`Firmante ${key.keyId} creado en Bitwarden y certificado por ${root.keyId}.`);
}

function commandBundleSign(options) {
  const issuedAt = options["issued-at"]
    ? new Date(options["issued-at"]).toISOString()
    : new Date().toISOString();
  const signer = readBitwardenKey("signer");
  const certificate = readJson(signerCertificatePath, "signer-certificate.json");
  if (certificate?.payload?.keyId !== signer.keyId) {
    throw new Error("El certificado público no corresponde al firmante activo de Bitwarden.");
  }
  const result = signCurrentBundle({
    issuedAt,
    certificate,
    privateKeyPkcs8Base64: signer.privateKeyPkcs8Base64,
  });
  writeFileSync(currentBundlePath, new TextDecoder().decode(result.bytes), "utf8");
  writeFileSync(currentBundleSignaturePath, canonicalJson(result.signature), "utf8");
  verifyCurrentBundleFiles();
  console.log(`${result.bundle.id} firmado (${result.signature.signedSha256.slice(0, 12)}).`);
}

function commandBundleCheck() {
  const { bundle, signature } = verifyCurrentBundleFiles();
  console.log(`${bundle.id}: firma válida ${signature.signedSha256.slice(0, 12)}.`);
}

function writeSignedActivation(options) {
  const channel = options.channel;
  const sequence = Number(options.sequence);
  const output = options.output ? resolve(options.output) : "";
  if (!output || !["Staging", "Production"].includes(channel) || !Number.isSafeInteger(sequence)) {
    throw new Error("activation-sign exige --channel, --sequence entero y --output.");
  }
  const verified = options["bundle-path"] && options["bundle-signature-path"]
    ? verifyBundleFiles({
      bundlePath: resolve(options["bundle-path"]),
      signaturePath: resolve(options["bundle-signature-path"]),
      rootsPath: trustedRootsPath,
    })
    : verifyCurrentBundleFiles();
  const {
    bundle,
    bundleBytes = utf8Bytes(canonicalJson(verified.bundle)),
    signature: bundleSignature,
    trustedRoots,
  } = verified;
  const signer = readBitwardenKey("signer");
  const certificate = readJson(signerCertificatePath, "signer-certificate.json");
  const action = options["rollback-from"] ? "rollback" : "activate";
  const { activation, bytes } = createPolicyActivation({
    id: `activation-${randomBytes(16).toString("hex")}`,
    action,
    channel,
    sequence,
    bundleId: bundle.id,
    bundleSha256: sha256Hex(bundleBytes),
    issuedAt: new Date().toISOString(),
    critical: bundle.critical,
    fromBundleId: options["rollback-from"] || null,
  });
  const activationSignature = createSignatureEnvelope(
    bytes,
    certificate,
    signer.privateKeyPkcs8Base64,
  );
  validatePolicyActivation(activation);
  verifySignatureEnvelope(bytes, activationSignature, trustedRoots, activation.issuedAt);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "policy.bundle.json"), canonicalJson(bundle), "utf8");
  writeFileSync(resolve(output, "policy.bundle.signature.json"), canonicalJson(bundleSignature), "utf8");
  writeFileSync(resolve(output, "policy.activation.json"), canonicalJson(activation), "utf8");
  writeFileSync(resolve(output, "policy.activation.signature.json"), canonicalJson(activationSignature), "utf8");
  return activation;
}

function commandActivationSign(options) {
  const activation = writeSignedActivation(options);
  const { action, channel, sequence } = activation;
  console.log(`${activation.id}: ${action} ${channel} secuencia ${sequence}.`);
}

function deploymentPayload(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function nextChannelSequence(repository, channel) {
  const encodedChannel = encodeURIComponent(channel);
  const response = JSON.parse(runGh([
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/deployments?environment=${encodedChannel}&task=gymnasia-policy&per_page=100`,
  ]));
  const deployments = response.flat();
  const current = deployments.reduce((maximum, deployment) => {
    const payload = deploymentPayload(deployment?.payload);
    return payload.schemaVersion === 3
      && Number.isSafeInteger(payload.activation?.sequence)
      ? Math.max(maximum, payload.activation.sequence)
      : maximum;
  }, 0);
  return current + 1;
}

function commandPromote(options) {
  const operation = options.operation;
  if (!["staging", "production", "rollback"].includes(operation)) {
    throw new Error("promote exige --operation staging, production o rollback.");
  }
  const bootstrapMain = options["bootstrap-main"] === "true";
  if (options["bootstrap-main"] !== undefined && !["true", "false"].includes(options["bootstrap-main"])) {
    throw new Error("--bootstrap-main debe ser true o false.");
  }
  if (operation !== "staging" && bootstrapMain) {
    throw new Error("--bootstrap-main solo se admite con --operation staging.");
  }
  const hasPullRequest = /^\d+$/.test(options.pr || "");
  if (operation === "staging" && hasPullRequest === bootstrapMain) {
    throw new Error(
      "La promoción a staging exige exactamente una PR abierta o --bootstrap-main true para el arranque único.",
    );
  }
  if (operation === "rollback" && !options["rollback-from"]) {
    throw new Error("El rollback exige --rollback-from con el bundle activo actual.");
  }
  if (operation === "rollback" && !/^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/.test(options.candidate || "")) {
    throw new Error("El rollback exige --candidate con el bundle histórico de destino.");
  }
  if (operation !== "rollback" && options["rollback-from"]) {
    throw new Error("--rollback-from solo se admite con --operation rollback.");
  }

  const repository = runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim();
  const channel = operation === "staging" ? "Staging" : "Production";
  const sequence = options.sequence === undefined
    ? nextChannelSequence(repository, channel)
    : Number(options.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("--sequence debe ser un entero positivo.");
  }

  const directory = mkdtempSync(resolve(tmpdir(), "gymnasia-policy-promotion-"));
  try {
    if (operation === "rollback") {
      runGh([
        "release",
        "download",
        options.candidate,
        "--repo",
        repository,
        "--pattern",
        "policy.bundle.json",
        "--pattern",
        "policy.bundle.signature.json",
        "--dir",
        directory,
      ]);
    }
    const activation = writeSignedActivation({
      channel,
      sequence: String(sequence),
      output: directory,
      ...(operation === "rollback" ? { "rollback-from": options["rollback-from"] } : {}),
      ...(operation === "rollback" ? {
        "bundle-path": resolve(directory, "policy.bundle.json"),
        "bundle-signature-path": resolve(directory, "policy.bundle.signature.json"),
      } : {}),
    });
    if (operation === "rollback" && activation.bundleId !== options.candidate) {
      throw new Error("El bundle descargado no corresponde al candidato solicitado.");
    }
    const workflowArgs = [
      "workflow",
      "run",
      "promote-policy.yml",
      "--repo",
      repository,
      "--ref",
      "main",
      "-f",
      `operation=${operation}`,
      "-f",
      `activation_base64=${readFileSync(resolve(directory, "policy.activation.json")).toString("base64")}`,
      "-f",
      `activation_signature_base64=${readFileSync(resolve(directory, "policy.activation.signature.json")).toString("base64")}`,
    ];
    if (operation === "staging") {
      workflowArgs.push("-f", `bootstrap_main=${bootstrapMain}`);
      if (hasPullRequest) workflowArgs.push("-f", `pr_number=${options.pr}`);
    }
    else workflowArgs.push("-f", `candidate=${activation.bundleId}`);
    runGh(workflowArgs);
    console.log(`${activation.id}: workflow ${operation} lanzado para ${activation.bundleId} (secuencia ${sequence}).`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  switch (command) {
    case "key-init-root":
      commandKeyInitRoot(options);
      break;
    case "key-init-signer":
      commandKeyInitSigner(options);
      break;
    case "bundle-sign":
      commandBundleSign(options);
      break;
    case "bundle-check":
      commandBundleCheck();
      break;
    case "activation-sign":
      commandActivationSign(options);
      break;
    case "promote":
      commandPromote(options);
      break;
    default:
      throw new Error(usage());
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
