#!/usr/bin/env node

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AAD = Buffer.from("gymnasia-openwiki-private-oauth-state:v1", "utf8");
const CIPHER = "aes-256-gcm";
const KDF = "scrypt";
const PASSPHRASE_ENV = "OPENWIKI_OAUTH_PASSPHRASE";
const VERSION = 1;

const OAUTH_KEYS = [
  "OPENAI_CHATGPT_ACCESS_TOKEN",
  "OPENAI_CHATGPT_REFRESH_TOKEN",
  "OPENAI_CHATGPT_EXPIRES_AT",
  "OPENAI_CHATGPT_ACCOUNT_ID",
  "OPENAI_CHATGPT_EMAIL",
  "OPENAI_CHATGPT_PLAN",
];

const REQUIRED_KEYS = [
  "OPENAI_CHATGPT_REFRESH_TOKEN",
  "OPENAI_CHATGPT_ACCOUNT_ID",
];

function requirePassphrase(env = process.env) {
  const value = env[PASSPHRASE_ENV];
  if (!value || value.length < 32) {
    throw new Error(`${PASSPHRASE_ENV} must contain at least 32 characters.`);
  }
  return value;
}

export function selectOAuthEnv(source) {
  const selected = new Map();

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.startsWith("export ") ? rawLine.slice(7) : rawLine;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (!match || !OAUTH_KEYS.includes(match[1])) {
      continue;
    }
    selected.set(match[1], match[2]);
  }

  const missing = REQUIRED_KEYS.filter(
    (key) => !selected.has(key) || selected.get(key)?.length === 0,
  );
  if (missing.length > 0) {
    throw new Error(`OpenWiki OAuth state is missing: ${missing.join(", ")}.`);
  }

  return `${OAUTH_KEYS.filter((key) => selected.has(key))
    .map((key) => `${key}=${selected.get(key)}`)
    .join("\n")}\n`;
}

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
    p: 1,
    r: 8,
  });
}

export function encryptOAuthState(source, passphrase) {
  const plaintext = Buffer.from(selectOAuthEnv(source), "utf8");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, deriveKey(passphrase, salt), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return `${JSON.stringify({
    cipher: CIPHER,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    kdf: KDF,
    salt: salt.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    version: VERSION,
  })}\n`;
}

export function decryptOAuthState(source, passphrase) {
  let envelope;
  try {
    envelope = JSON.parse(source);
  } catch {
    throw new Error("Encrypted OpenWiki OAuth state is not valid JSON.");
  }

  if (
    envelope?.version !== VERSION ||
    envelope?.cipher !== CIPHER ||
    envelope?.kdf !== KDF ||
    typeof envelope?.ciphertext !== "string" ||
    typeof envelope?.iv !== "string" ||
    typeof envelope?.salt !== "string" ||
    typeof envelope?.tag !== "string"
  ) {
    throw new Error("Encrypted OpenWiki OAuth state has an unsupported format.");
  }

  try {
    const salt = Buffer.from(envelope.salt, "base64");
    const iv = Buffer.from(envelope.iv, "base64");
    const decipher = createDecipheriv(CIPHER, deriveKey(passphrase, salt), iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return selectOAuthEnv(plaintext);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("OpenWiki OAuth state")) {
      throw error;
    }
    throw new Error("Unable to decrypt OpenWiki OAuth state.");
  }
}

async function writeSecureFile(filePath, content) {
  await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
  await writeFile(filePath, content, { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600);
}

export async function encryptFile(inputPath, outputPath, env = process.env) {
  const source = await readFile(inputPath, "utf8");
  const encrypted = encryptOAuthState(source, requirePassphrase(env));
  await writeSecureFile(outputPath, encrypted);
}

export async function decryptFile(inputPath, outputPath, env = process.env) {
  const source = await readFile(inputPath, "utf8");
  const decrypted = decryptOAuthState(source, requirePassphrase(env));
  await writeSecureFile(outputPath, decrypted);
}

async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath || !["decrypt", "encrypt"].includes(command)) {
    throw new Error("Usage: oauth-state.mjs <encrypt|decrypt> <input> <output>");
  }

  if (command === "encrypt") {
    await encryptFile(inputPath, outputPath);
  } else {
    await decryptFile(inputPath, outputPath);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown OAuth state error.";
    console.error(message);
    process.exitCode = 1;
  });
}
