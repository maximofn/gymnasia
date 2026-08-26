import { describe, expect, it } from "vitest";

import { normalizePolicyContext, policyLeaseTracePayload } from "./policyContext";

const CONTEXT = {
  activation: {
    action: "rollback" as const,
    id: "activation-11111111111111111111111111111111",
  },
  bundle_sha256: "a".repeat(64),
  candidate: "policy-v2026.08.2-bbbbbbbbbbbb",
  sequence: 7,
  source: "cache" as const,
  version: "2026.08.2",
};

describe("policy_context persistible", () => {
  it("conserva únicamente la atribución pública exacta", () => {
    expect(normalizePolicyContext(CONTEXT)).toEqual(CONTEXT);
    expect(Object.keys(normalizePolicyContext(CONTEXT) ?? {}).sort()).toEqual([
      "activation",
      "bundle_sha256",
      "candidate",
      "sequence",
      "source",
      "version",
    ]);
  });

  it.each(["prompt", "message", "api_key", "input", "output", "health_data"])(
    "rechaza el campo no permitido %s",
    (field) => {
      expect(normalizePolicyContext({ ...CONTEXT, [field]: "sensitive" })).toBeUndefined();
    },
  );

  it("rechaza hashes, secuencias y activaciones no válidos", () => {
    expect(normalizePolicyContext({ ...CONTEXT, bundle_sha256: "short" })).toBeUndefined();
    expect(normalizePolicyContext({ ...CONTEXT, sequence: -1 })).toBeUndefined();
    expect(normalizePolicyContext({
      ...CONTEXT,
      activation: { ...CONTEXT.activation, id: "free-form" },
    })).toBeUndefined();
  });

  it("limita la traza de lease a metadatos públicos", () => {
    const payload = policyLeaseTracePayload(CONTEXT, "turn");
    expect(Object.keys(payload).sort()).toEqual([
      "activationId",
      "boundary",
      "bundleSha256",
      "candidate",
      "sequence",
      "source",
      "version",
    ]);
    expect(JSON.stringify(payload)).not.toContain("prompt");
  });
});
