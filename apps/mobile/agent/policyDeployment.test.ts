import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import {
  clearPolicyDeploymentResolutionCache,
  fetchActivePolicyDeployment,
  parsePolicyDeploymentPayload,
} from "./policyDeployment";

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const CANDIDATE = "policy-v2026.08.2-aaaaaaaaaaaa";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    candidate: CANDIDATE,
    sourceCommit: SHA,
    bundleUrl: `https://github.com/maximofn/gymnasia/releases/download/${CANDIDATE}/policy.bundle.json`,
    signatureUrl: `https://github.com/maximofn/gymnasia/releases/download/${CANDIDATE}/policy.bundle.signature.json`,
    bundleSha256: DIGEST,
    activation: {
      action: "activate",
      bundleId: CANDIDATE,
      sequence: 1,
    },
    activationSignature: {
      algorithm: "Ed25519",
      signatureBase64Url: "A".repeat(86),
    },
    ...overrides,
  };
}

describe("policy deployment contract", () => {
  it("acepta el puntero público al bundle y a sus firmas", () => {
    expect(parsePolicyDeploymentPayload(payload())).toEqual(payload());
  });

  it.each([
    { schemaVersion: 2 },
    { candidate: "main" },
    { sourceCommit: "abc" },
    { bundleUrl: "https://raw.githubusercontent.com/maximofn/gymnasia/main/prompts/AGENTS.md" },
    { signatureUrl: "https://evil.example/signature.json" },
    { bundleSha256: "no" },
    { activation: null },
    { activationSignature: "signature" },
    { extra: true },
  ])("rechaza combinaciones no firmadas o ambiguas %#", (override) => {
    expect(parsePolicyDeploymentPayload(payload(override))).toBeNull();
  });

  it("nunca acepta una URL arbitraria aunque parezca una release", () => {
    fc.assert(fc.property(fc.webUrl(), (bundleUrl) => {
      fc.pre(bundleUrl !== payload().bundleUrl);
      expect(parsePolicyDeploymentPayload(payload({ bundleUrl }))).toBeNull();
    }));
  });

  it("resuelve el último deployment firmado exitoso y lo cachea cinco minutos", async () => {
    clearPolicyDeploymentResolutionCache();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("?environment=Staging")) {
        return new Response(JSON.stringify([{
          id: 44,
          task: "gymnasia-policy",
          environment: "Staging",
          payload: payload(),
          statuses_url: "https://api.github.com/repos/maximofn/gymnasia/deployments/44/statuses",
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ state: "success" }]), { status: 200 });
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const first = await fetchActivePolicyDeployment("Staging", fetchImpl, 1_000);
    const second = await fetchActivePolicyDeployment("Staging", fetchImpl, 2_000);
    expect(first).toMatchObject({ deploymentId: 44, channel: "Staging", schemaVersion: 3 });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("task=gymnasia-policy");
  });

  it("ignora deployments heredados y exige estado success", async () => {
    clearPolicyDeploymentResolutionCache();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes("?environment=Production")) {
        return new Response(JSON.stringify([{
          id: 45,
          task: "gymnasia-policy",
          environment: "Production",
          payload: payload({ schemaVersion: 2 }),
          statuses_url: "https://api.github.com/repos/maximofn/gymnasia/deployments/45/statuses",
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ state: "success" }]), { status: 200 });
    });
    await expect(fetchActivePolicyDeployment(
      "Production",
      fetchMock as unknown as typeof fetch,
      3_000,
    )).rejects.toThrow(/deployment firmado/);
  });

  it("limita durante cinco minutos los fallos de GitHub", async () => {
    clearPolicyDeploymentResolutionCache();
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchActivePolicyDeployment("Production", fetchImpl, 10_000)).rejects.toThrow("503");
    await expect(fetchActivePolicyDeployment("Production", fetchImpl, 11_000)).rejects.toThrow("503");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
