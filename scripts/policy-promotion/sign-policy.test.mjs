import assert from "node:assert/strict";
import test from "node:test";

import { populateBitwardenKeyFields } from "./sign-policy.mjs";

const KEY = {
  keyId: "gymnasia-policy-root-2026-08",
  privateKeyPkcs8Base64: "private-material",
  publicKeyBase64Url: "public-material",
};

test("Bitwarden recibe la clave privada oculta sin alterar campos ajenos", () => {
  const item = populateBitwardenKeyFields({
    fields: [{ name: "owner", type: 0, value: "Gymnasia" }],
    id: "item-1",
  }, KEY, "root");

  assert.equal(item.fields.length, 4);
  assert.deepEqual(item.fields.find((field) => field.name === "owner"), {
    name: "owner",
    type: 0,
    value: "Gymnasia",
  });
  assert.deepEqual(item.fields.find((field) => field.name === "ed25519_pkcs8_base64"), {
    name: "ed25519_pkcs8_base64",
    type: 1,
    value: "private-material",
  });
});

test("la inicialización nunca sobrescribe material de firma existente", () => {
  assert.throws(() => populateBitwardenKeyFields({
    fields: [{ name: "gymnasia_policy_key_id", type: 0, value: "existing" }],
  }, KEY, "root"), /ya contiene material de firma/);
});
