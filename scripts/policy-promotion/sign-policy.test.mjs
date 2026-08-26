import assert from "node:assert/strict";
import test from "node:test";

import {
  orderPolicyDeploymentsBySequence,
  populateBitwardenKeyFields,
  validatePolicyReasonCode,
  validateRollbackPlan,
} from "./sign-policy.mjs";

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

test("la CLI solo admite los cuatro motivos operativos cerrados", () => {
  for (const reason of [
    "routine-release",
    "critical-policy-fix",
    "incident-response",
    "rollback-drill",
  ]) {
    assert.equal(validatePolicyReasonCode(reason), reason);
  }
  assert.throws(() => validatePolicyReasonCode("texto libre"), /--reason-code/);
});

test("el rollback ordena los deployments válidos por secuencia", () => {
  const older = {
    id: 10,
    payload: { schemaVersion: 3, candidate: "policy-v2026.08.2-aaaaaaaaaaaa", activation: { sequence: 4 } },
  };
  const current = {
    id: 11,
    payload: JSON.stringify({ schemaVersion: 3, candidate: "policy-v2026.08.3-bbbbbbbbbbbb", activation: { sequence: 7 } }),
  };
  assert.deepEqual(orderPolicyDeploymentsBySequence([older, current]), [current, older]);
});

test("la previsualización de rollback exige historia correcta y origen activo exacto", () => {
  const candidate = "policy-v2026.08.2-aaaaaaaaaaaa";
  const currentCandidate = "policy-v2026.08.3-bbbbbbbbbbbb";
  assert.deepEqual(validateRollbackPlan({
    candidate,
    currentCandidate,
    requestedFrom: undefined,
    stagingCandidates: [candidate, currentCandidate],
    productionCandidates: [candidate, currentCandidate],
  }), { candidate, fromBundleId: currentCandidate });
  assert.throws(() => validateRollbackPlan({
    candidate,
    currentCandidate,
    requestedFrom: "policy-v2026.08.4-cccccccccccc",
    stagingCandidates: [candidate],
    productionCandidates: [candidate],
  }), /no coincide/);
  assert.throws(() => validateRollbackPlan({
    candidate,
    currentCandidate,
    requestedFrom: undefined,
    stagingCandidates: [candidate],
    productionCandidates: [],
  }), /Staging y Production/);
});
