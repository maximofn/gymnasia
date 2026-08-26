import { pushTrace } from "../trace";
import {
  BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
  type HealthSafetyRuntimePolicy,
} from "./healthSafety";
import { RUNTIME_ENVIRONMENT } from "../runtimeEnvironment";
import { acquireAgentPolicyLease } from "./agentPolicyRuntime";
import { clearSignedPolicyMemoryCache } from "./signedPolicyRuntime";

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
  try {
    const lease = await acquireAgentPolicyLease("background");
    const value: HealthSafetyPolicySelection = {
      ...lease.healthSafety,
    };
    void pushTrace("healthSafety", "signed-policy-selected", {
      source: value.source,
      candidate: value.candidate,
      policyVersion: value.policy.policyVersion,
      sequence: lease.context.sequence,
    });
    return value;
  } catch {
    const value = bundledSelection();
    void pushTrace("healthSafety", "signed-policy-fallback", {
      source: value.source,
      reasonCode: "signed-policy-unavailable",
    });
    return value;
  }
}

export function clearHealthSafetyPolicyMemoryCache(): void {
  clearSignedPolicyMemoryCache();
}
