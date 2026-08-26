import { describe, expect, it } from "vitest";

import { policyStatusPresentation } from "./policyStatusPresentation";
import type { PolicyRuntimeStatus } from "./signedPolicySelection";

const IDENTITY: PolicyRuntimeStatus["active"] = {
  activationId: "activation-11111111111111111111111111111111",
  action: "activate",
  bundleSha256: "a".repeat(64),
  candidate: "policy-v2026.08.2-bbbbbbbbbbbb",
  critical: false,
  issuedAt: "2026-08-26T10:00:00.000Z",
  sequence: 2,
  source: "remote",
  version: "2026.08.2",
};

function status(overrides: Partial<PolicyRuntimeStatus> = {}): PolicyRuntimeStatus {
  return {
    active: IDENTITY,
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
    ...overrides,
  };
}

describe("tarjeta de estado de política", () => {
  it("presenta activa remota, caché y snapshot con origen inequívoco", () => {
    expect(policyStatusPresentation(status()).sourceLabel).toBe("Remota verificada");
    expect(policyStatusPresentation(status({
      active: { ...IDENTITY, source: "cache-active" },
    })).sourceLabel).toBe("Caché verificada");
    expect(policyStatusPresentation(status({
      active: { ...IDENTITY, source: "bundled" },
    })).sourceLabel).toBe("Integrada en la app");
  });

  it("distingue pendiente normal de rollback o crítica", () => {
    const normal = policyStatusPresentation(status({
      pending: { ...IDENTITY, sequence: 3 },
      state: "pending",
    }));
    expect(normal.title).toBe("Actualización pendiente");
    expect(normal.pendingInstruction).toContain("conversación nueva");

    const rollback = policyStatusPresentation(status({
      pending: { ...IDENTITY, action: "rollback", sequence: 4 },
      state: "pending",
    }));
    expect(rollback.pendingInstruction).toContain("siguiente envío seguro");
  });

  it("explica offline y errores conservando una política segura", () => {
    const offline = policyStatusPresentation(status({
      degradation: "offline",
      lastCheckOutcome: "offline",
      state: "degraded",
    }));
    expect(offline.degradationMessage).toContain("Sin conexión");
    expect(offline.tone).toBe("warning");

    const rejected = policyStatusPresentation(status({
      degradation: "invalid-remote",
      lastCheckOutcome: "rejected",
      state: "degraded",
    }));
    expect(rejected.degradationMessage).toContain("no pudo sustituir");
  });
});
