#!/usr/bin/env node

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const AAD = Buffer.from("gymnasia-openwiki-private-brain-state:v1", "utf8");
const MAX_ENCRYPTED_BYTES = 140 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 100 * 1024 * 1024;
const PASSPHRASE_ENV = "OPENWIKI_PERSONAL_STATE_PASSPHRASE";

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
    p: 1,
    r: 8,
  });
}

function requirePassphrase(env = process.env) {
  const passphrase = env[PASSPHRASE_ENV];
  if (!passphrase || passphrase.length < 32) {
    throw new Error(`${PASSPHRASE_ENV} must contain at least 32 characters.`);
  }
  return passphrase;
}

export function encryptPrivateState(plaintext, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.from(`${JSON.stringify({
    cipher: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    kdf: "scrypt",
    salt: salt.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    version: 1,
  })}\n`, "utf8");
}

export function decryptPrivateState(serialized, passphrase) {
  let envelope;
  try {
    envelope = JSON.parse(serialized.toString("utf8"));
  } catch {
    throw new Error("Encrypted Personal Brain state is not valid JSON.");
  }

  if (
    envelope?.version !== 1 ||
    envelope?.cipher !== "aes-256-gcm" ||
    envelope?.kdf !== "scrypt" ||
    typeof envelope?.ciphertext !== "string" ||
    typeof envelope?.iv !== "string" ||
    typeof envelope?.salt !== "string" ||
    typeof envelope?.tag !== "string"
  ) {
    throw new Error("Encrypted Personal Brain state has an unsupported format.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(passphrase, Buffer.from(envelope.salt, "base64")),
      Buffer.from(envelope.iv, "base64"),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
  } catch {
    throw new Error("Unable to decrypt Personal Brain state.");
  }
}

async function writeSecureFile(filePath, content) {
  await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
  await writeFile(filePath, content, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath || !["decrypt", "encrypt"].includes(command)) {
    throw new Error("Usage: private-state.mjs <encrypt|decrypt> <input> <output>");
  }

  const passphrase = requirePassphrase();
  const inputBytes = (await stat(inputPath)).size;
  const maximumBytes = command === "encrypt" ? MAX_PLAINTEXT_BYTES : MAX_ENCRYPTED_BYTES;
  if (inputBytes > maximumBytes) {
    throw new Error(`Personal Brain state exceeds the ${maximumBytes} byte safety limit.`);
  }
  const input = await readFile(inputPath);
  const output = command === "encrypt"
    ? encryptPrivateState(input, passphrase)
    : decryptPrivateState(input, passphrase);
  await writeSecureFile(outputPath, output);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unknown state error.");
    process.exitCode = 1;
  });
}
