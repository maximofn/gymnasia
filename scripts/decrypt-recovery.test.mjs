import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import portableEncryption from "../apps/mobile/backup/portableEncryption.ts";

const { encryptPortablePayloadToBytes } = portableEncryption;

const PASSWORD = "recovery test password";
const cli = new URL("./decrypt-recovery.ts", import.meta.url).pathname;

function deterministicRandom() {
  let call = 0;
  return (length) => Uint8Array.from(
    { length },
    (_, index) => ((call++ < 16 ? 0x20 : 0x70) + index) & 0xff,
  );
}

test("la CLI descifra recuperación, protege permisos y no sobrescribe", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gymnasia-recovery-cli-"));
  const input = join(directory, "recovery.gymnasia");
  const output = join(directory, "recovery.json");
  const payload = {
    app: "gymnasia",
    type: "local-store-recovery",
    schemaVersion: 1,
    recovery: { rawPayload: "sensitive-value" },
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await encryptPortablePayloadToBytes(plaintext, PASSWORD, deterministicRandom());
  await writeFile(input, encrypted);

  const success = spawnSync(
    process.execPath,
    ["--import", "tsx", cli, "--input", input, "--output", output, "--password-stdin"],
    { input: `${PASSWORD}\n`, encoding: "utf8" },
  );
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), payload);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  assert.equal(success.stdout, "");

  const overwrite = spawnSync(
    process.execPath,
    ["--import", "tsx", cli, "--input", input, "--output", output, "--password-stdin"],
    { input: `${PASSWORD}\n`, encoding: "utf8" },
  );
  assert.equal(overwrite.status, 1);
  assert.match(overwrite.stderr, /no se sobrescribirá/);

  const wrongOutput = join(directory, "wrong.json");
  const wrongPassword = spawnSync(
    process.execPath,
    ["--import", "tsx", cli, "--input", input, "--output", wrongOutput, "--password-stdin"],
    { input: "definitely wrong\n", encoding: "utf8" },
  );
  assert.equal(wrongPassword.status, 1);
  assert.match(wrongPassword.stderr, /contraseña no es correcta o el archivo está dañado/);
  await assert.rejects(stat(wrongOutput), { code: "ENOENT" });
});
