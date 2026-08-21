import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import {
  clearPolicyDeploymentResolutionCache,
  fetchActivePolicyDeployment,
  parsePolicyDeploymentPayload,
} from "./policyDeployment";

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const REPORT_DIGEST = "c".repeat(64);
const CANDIDATE = "policy-v2026.08.1-aaaaaaaaaaaa";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    candidate: CANDIDATE,
    sourceCommit: SHA,
    assetUrl: `https://github.com/maximofn/gymnasia/releases/download/${CANDIDATE}/policy.md`,
    assetSha256: DIGEST,
    policyVersion: "2026.08.1",
    datasetVersion: "2026.08.1",
    promptVersion: `sha256:${DIGEST}`,
    reportSha256: REPORT_DIGEST,
    workflowRunUrl: "https://github.com/maximofn/gymnasia/actions/runs/123",
    ...overrides,
  };
}

describe("policy deployment contract", () => {
  it("accepts the complete public payload", () => {
    expect(parsePolicyDeploymentPayload(payload())).toEqual(payload());
  });

  it.each([
    { schemaVersion: 2 },
    { candidate: "main" },
    { sourceCommit: "abc" },
    { assetUrl: "https://raw.githubusercontent.com/maximofn/gymnasia/main/prompts/AGENTS.md" },
    { assetSha256: "no" },
    { datasetVersion: "other" },
    { promptVersion: "sha256:other" },
    { workflowRunUrl: "https://evil.example/run/1" },
  ])("rejects invalid combinations %#", (override) => {
    expect(parsePolicyDeploymentPayload(payload(override))).toBeNull();
  });

  it("never accepts an arbitrary non-release URL", () => {
    fc.assert(fc.property(fc.webUrl(), (assetUrl) => {
      fc.pre(!assetUrl.startsWith("https://github.com/maximofn/gymnasia/releases/download/"));
      expect(parsePolicyDeploymentPayload(payload({ assetUrl }))).toBeNull();
    }));
  });

  it("resolves the latest successful deployment and caches it for five minutes", async () => {
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
    expect(first).toMatchObject({ deploymentId: 44, channel: "Staging" });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("task=gymnasia-policy");
  });

  it("throttles failed GitHub resolutions for the same five-minute window", async () => {
    clearPolicyDeploymentResolutionCache();
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchActivePolicyDeployment("Production", fetchImpl, 10_000)).rejects.toThrow("503");
    await expect(fetchActivePolicyDeployment("Production", fetchImpl, 11_000)).rejects.toThrow("503");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
