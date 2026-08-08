import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  decryptFile,
  decryptOAuthState,
  encryptFile,
  encryptOAuthState,
  selectOAuthEnv,
} from "../scripts/oauth-state.mjs";

const PASSPHRASE = "test-only-passphrase-with-more-than-32-characters";
const SOURCE = [
  "OPENAI_CHATGPT_ACCESS_TOKEN=access-token",
  "OPENAI_CHATGPT_REFRESH_TOKEN=refresh-token",
  "OPENAI_CHATGPT_EXPIRES_AT=1900000000000",
  "OPENAI_CHATGPT_ACCOUNT_ID=account-id",
  "OPENAI_CHATGPT_EMAIL=user@example.com",
  "OPENAI_CHATGPT_PLAN=plus",
  "LANGSMITH_API_KEY=must-not-leave-the-machine",
  "OPENAI_API_KEY=must-not-leave-the-machine-either",
  "",
].join("\n");

test("selectOAuthEnv keeps only managed ChatGPT OAuth fields", () => {
  const selected = selectOAuthEnv(SOURCE);

  assert.match(selected, /OPENAI_CHATGPT_REFRESH_TOKEN=refresh-token/u);
  assert.doesNotMatch(selected, /LANGSMITH/u);
  assert.doesNotMatch(selected, /OPENAI_API_KEY/u);
});

test("OAuth state round-trips through authenticated encryption", () => {
  const encrypted = encryptOAuthState(SOURCE, PASSPHRASE);
  const decrypted = decryptOAuthState(encrypted, PASSPHRASE);

  assert.equal(decrypted, selectOAuthEnv(SOURCE));
  assert.doesNotMatch(encrypted, /refresh-token|user@example\.com/u);
});

test("a different passphrase cannot decrypt the OAuth state", () => {
  const encrypted = encryptOAuthState(SOURCE, PASSPHRASE);

  assert.throws(
    () => decryptOAuthState(encrypted, "another-passphrase-with-more-than-32-characters"),
    /Unable to decrypt OpenWiki OAuth state/u,
  );
});

test("tampering is rejected", () => {
  const envelope = JSON.parse(encryptOAuthState(SOURCE, PASSPHRASE));
  envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;

  assert.throws(
    () => decryptOAuthState(JSON.stringify(envelope), PASSPHRASE),
    /Unable to decrypt OpenWiki OAuth state/u,
  );
});

test("required refresh credentials cannot be omitted", () => {
  assert.throws(
    () => selectOAuthEnv("OPENAI_CHATGPT_ACCESS_TOKEN=access-token\n"),
    /OPENAI_CHATGPT_REFRESH_TOKEN.*OPENAI_CHATGPT_ACCOUNT_ID/u,
  );
});

test("file helpers write a private restored env file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openwiki-oauth-test-"));
  const inputPath = path.join(directory, "source.env");
  const encryptedPath = path.join(directory, "state.enc");
  const restoredPath = path.join(directory, "restored", ".env");
  await writeFile(inputPath, SOURCE, "utf8");

  const env = { OPENWIKI_OAUTH_PASSPHRASE: PASSPHRASE };
  await encryptFile(inputPath, encryptedPath, env);
  await decryptFile(encryptedPath, restoredPath, env);

  assert.equal(await readFile(restoredPath, "utf8"), selectOAuthEnv(SOURCE));
  assert.equal((await stat(restoredPath)).mode & 0o777, 0o600);
});
