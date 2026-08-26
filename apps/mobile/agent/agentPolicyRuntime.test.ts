import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        channel: "Local",
        configurationVersion: 1,
        environment: "development",
        policyCandidate: "development-bundled",
        policySha256: "a".repeat(64),
        providerMode: "fake",
        storageNamespace: "gymnasia.development",
      },
    },
  },
}));
vi.mock("../trace", () => ({ pushTrace: vi.fn(async () => undefined) }));
vi.mock("./signedPolicyRuntime", () => ({ loadSignedPolicy: vi.fn() }));

import { createSignedAgentPolicyLease } from "./agentPolicyRuntime";
import { BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY } from "./healthSafety";
import type { SignedPolicyResolution } from "./signedPolicySelection";

function resolution(): SignedPolicyResolution {
  const candidate = "policy-v2026.08.3-bbbbbbbbbbbb";
  const activationId = "activation-11111111111111111111111111111111";
  const packageValue = {
    activationBody: "{}",
    activationSignature: {},
    bundleBody: "{}",
    bundleSignature: {},
    candidate,
    channel: "Production",
    deploymentId: 42,
    environment: "production",
    schemaVersion: 1,
  };
  const active = {
    activationId,
    action: "activate" as const,
    bundleSha256: "c".repeat(64),
    candidate,
    critical: false,
    issuedAt: "2026-08-26T10:00:00.000Z",
    sequence: 3,
    source: "remote" as const,
    version: "2026.08.3",
  };
  return {
    selection: {
      source: "remote",
      package: packageValue,
      activation: {
        action: "activate",
        bundleId: candidate,
        bundleSha256: active.bundleSha256,
        channel: "Production",
        critical: false,
        fromBundleId: null,
        id: activationId,
        issuedAt: active.issuedAt,
        schemaVersion: 1,
        sequence: 3,
      },
      bundle: {
        critical: false,
        healthSafetyRuntime: {
          content: BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
          policyVersion: BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY.policyVersion,
          sha256: "d".repeat(64),
        },
        id: candidate,
        issuedAt: "2026-08-26T09:00:00.000Z",
        minClientProtocol: 1,
        prompt: { content: "same-bundle-prompt", encoding: "utf-8", sha256: "e".repeat(64) },
        requiredTools: ["read_field_value"],
        schemaVersion: 1,
        version: active.version,
      },
    },
    status: {
      active,
      activeSince: "2026-08-26T10:00:01.000Z",
      channel: "Production",
      degradation: "none",
      environment: "production",
      lastCheckedAt: "2026-08-26T10:00:01.000Z",
      lastCheckOutcome: "verified",
      lastFailureCode: null,
      pending: null,
      propagationMs: 1000,
      state: "active",
    },
  } as unknown as SignedPolicyResolution;
}

describe("AgentPolicyLease", () => {
  it("inmoviliza prompt, guardrail y atribución del mismo bundle para toda la petición", () => {
    const lease = createSignedAgentPolicyLease("turn", resolution());

    expect(lease.prompt.candidate).toBe(lease.context.candidate);
    expect(lease.healthSafety.candidate).toBe(lease.context.candidate);
    expect(lease.prompt.content).toBe("same-bundle-prompt");
    expect(lease.context.sequence).toBe(3);
    expect(Object.isFrozen(lease)).toBe(true);
    expect(Object.isFrozen(lease.prompt)).toBe(true);
    expect(Object.isFrozen(lease.healthSafety)).toBe(true);
    expect(Object.isFrozen(lease.healthSafety.policy)).toBe(true);
    expect(Object.isFrozen(lease.healthSafety.policy.rules)).toBe(true);
    expect(Object.isFrozen(lease.context)).toBe(true);
    expect(Object.isFrozen(lease.context.activation)).toBe(true);
  });
});
