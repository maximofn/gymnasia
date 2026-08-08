import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptPrivateState,
  encryptPrivateState,
} from "../scripts/private-state.mjs";

const PASSPHRASE = "test-only-private-state-passphrase-over-32-characters";

test("private state round-trips without exposing plaintext", () => {
  const plaintext = Buffer.from("private Linear evidence and Personal Brain wiki", "utf8");
  const encrypted = encryptPrivateState(plaintext, PASSPHRASE);

  assert.deepEqual(decryptPrivateState(encrypted, PASSPHRASE), plaintext);
  assert.doesNotMatch(encrypted.toString("utf8"), /Linear evidence/u);
});

test("private state rejects the wrong passphrase", () => {
  const encrypted = encryptPrivateState(Buffer.from("private", "utf8"), PASSPHRASE);

  assert.throws(
    () => decryptPrivateState(encrypted, "different-private-state-passphrase-over-32-chars"),
    /Unable to decrypt Personal Brain state/u,
  );
});

test("private state rejects tampering", () => {
  const envelope = JSON.parse(
    encryptPrivateState(Buffer.from("private", "utf8"), PASSPHRASE).toString("utf8"),
  );
  envelope.tag = `${envelope.tag.slice(0, -2)}AA`;

  assert.throws(
    () => decryptPrivateState(Buffer.from(JSON.stringify(envelope)), PASSPHRASE),
    /Unable to decrypt Personal Brain state/u,
  );
});
