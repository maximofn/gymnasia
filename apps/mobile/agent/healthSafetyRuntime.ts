import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT } from "../runtimeEnvironment";
import {
  BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
  mergeHealthSafetyPolicies,
  type HealthSafetyRuntimePolicy,
} from "./healthSafety";
import { clearSignedPolicyMemoryCache, loadSignedPolicy } from "./signedPolicyRuntime";

type HealthSafetyPolicySource = "bundled" | "remote" | "cache";

export type HealthSafetyPolicySelection = {
  policy: HealthSafetyRuntimePolicy;
  source: HealthSafetyPolicySource;
  candidate: string;
  deploymentId: number | null;
};

function bundledSelection(): HealthSafetyPolicySelection {
  return {
    policy: BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
    source: "bundled",
    candidate: RUNTIME_ENVIRONMENT.policyCandidate,
    deploymentId: null,
  };
}

export async function loadHealthSafetyPolicy(): Promise<HealthSafetyPolicySelection> {
  if (RUNTIME_ENVIRONMENT.policyChannel === "Local") return bundledSelection();
  try {
    const signed = await loadSignedPolicy();
    const merged = mergeHealthSafetyPolicies(
      BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
      signed.bundle.healthSafetyRuntime.content,
    );
    if (merged.errors.length > 0) throw new Error("signed-runtime-contract");
    const value: HealthSafetyPolicySelection = {
      policy: merged.policy,
      source: signed.source === "remote"
        ? "remote"
        : signed.source === "bundled" ? "bundled" : "cache",
      candidate: signed.bundle.id,
      deploymentId: signed.package.deploymentId,
    };
    void pushTrace("healthSafety", "signed-policy-selected", {
      source: value.source,
      candidate: value.candidate,
      policyVersion: value.policy.policyVersion,
      sequence: signed.activation.sequence,
    });
    return value;
  } catch (error) {
    const value = bundledSelection();
    void pushTrace("healthSafety", "signed-policy-fallback", {
      source: value.source,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return value;
  }
}

export function clearHealthSafetyPolicyMemoryCache(): void {
  clearSignedPolicyMemoryCache();
}
