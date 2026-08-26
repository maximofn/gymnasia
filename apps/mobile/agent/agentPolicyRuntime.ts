import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT } from "../runtimeEnvironment";
import type { ChatSystemPromptSelection } from "./chatSystemPrompt";
import {
  BUNDLED_CHAT_SYSTEM_PROMPT,
  BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
  BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
} from "./generated/chatSystemPrompt.generated";
import {
  BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
  mergeHealthSafetyPolicies,
  type HealthSafetyRuntimePolicy,
} from "./healthSafety";
import { loadSignedPolicy } from "./signedPolicyRuntime";
import type {
  PolicyBoundary,
  PolicyRuntimeStatus,
  SignedPolicyResolution,
  SignedPolicySource,
} from "./signedPolicySelection";
import { policyLeaseTracePayload, type PolicyContext } from "./policyContext";

export type AgentPolicyLease = Readonly<{
  boundary: PolicyBoundary;
  context: Readonly<PolicyContext>;
  healthSafety: Readonly<{
    policy: HealthSafetyRuntimePolicy;
    source: "bundled" | "cache" | "remote";
    candidate: string;
    deploymentId: number | null;
  }>;
  prompt: Readonly<ChatSystemPromptSelection>;
  status: Readonly<PolicyRuntimeStatus>;
}>;

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function immutableHealthPolicy(policy: HealthSafetyRuntimePolicy): HealthSafetyRuntimePolicy {
  return deepFreeze(JSON.parse(JSON.stringify(policy)) as HealthSafetyRuntimePolicy);
}

function publicSource(source: SignedPolicySource): "bundled" | "cache" | "remote" {
  if (source === "remote") return "remote";
  return source === "bundled" ? "bundled" : "cache";
}

function localLease(boundary: PolicyBoundary): AgentPolicyLease {
  const source = "bundled" as const;
  const prompt: ChatSystemPromptSelection = {
    content: BUNDLED_CHAT_SYSTEM_PROMPT,
    source,
    sha256: BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
    version: BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
    environment: RUNTIME_ENVIRONMENT.environment,
    channel: RUNTIME_ENVIRONMENT.policyChannel,
    candidate: RUNTIME_ENVIRONMENT.policyCandidate,
    deploymentId: null,
  };
  const context: PolicyContext = {
    activation: { action: "activate", id: "local-bundled" },
    bundle_sha256: BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
    candidate: RUNTIME_ENVIRONMENT.policyCandidate,
    sequence: 0,
    source,
    version: BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
  };
  const status: PolicyRuntimeStatus = {
    active: {
      activationId: context.activation.id,
      action: context.activation.action,
      bundleSha256: context.bundle_sha256,
      candidate: context.candidate,
      critical: false,
      issuedAt: "",
      sequence: context.sequence,
      source: "bundled",
      version: context.version,
    },
    activeSince: null,
    channel: "Local",
    degradation: "none",
    environment: RUNTIME_ENVIRONMENT.environment,
    lastCheckedAt: null,
    lastCheckOutcome: "verified",
    lastFailureCode: null,
    pending: null,
    propagationMs: null,
    state: "active",
  };
  return deepFreeze({
    boundary,
    context,
    healthSafety: {
      policy: immutableHealthPolicy(BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY),
      source,
      candidate: context.candidate,
      deploymentId: null,
    },
    prompt,
    status,
  });
}

export async function acquireAgentPolicyLease(
  boundary: PolicyBoundary,
  { force = false }: { force?: boolean } = {},
): Promise<AgentPolicyLease> {
  const lease = RUNTIME_ENVIRONMENT.policyChannel === "Local"
    ? localLease(boundary)
    : createSignedAgentPolicyLease(
        boundary,
        await loadSignedPolicy({ boundary, force }),
      );
  void pushTrace(
    "signedPolicy",
    "lease-acquired",
    policyLeaseTracePayload(lease.context, boundary),
  );
  return lease;
}

export function createSignedAgentPolicyLease(
  boundary: PolicyBoundary,
  resolution: SignedPolicyResolution,
): AgentPolicyLease {
  const selected = resolution.selection;
  const merged = mergeHealthSafetyPolicies(
    BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
    selected.bundle.healthSafetyRuntime.content,
  );
  if (merged.errors.length > 0) {
    throw new Error("La política sanitaria firmada no cumple el contrato móvil.");
  }
  const source = publicSource(selected.source);
  const prompt: ChatSystemPromptSelection = {
    content: selected.bundle.prompt.content,
    source,
    sha256: selected.bundle.prompt.sha256,
    version: `sha256:${selected.bundle.prompt.sha256}`,
    environment: RUNTIME_ENVIRONMENT.environment,
    channel: selected.activation.channel,
    candidate: selected.bundle.id,
    deploymentId: selected.package.deploymentId,
  };
  const context: PolicyContext = {
    activation: {
      action: selected.activation.action,
      id: selected.activation.id,
    },
    bundle_sha256: selected.activation.bundleSha256,
    candidate: selected.bundle.id,
    sequence: selected.activation.sequence,
    source,
    version: selected.bundle.version,
  };
  return deepFreeze({
    boundary,
    context,
    healthSafety: {
      policy: immutableHealthPolicy(merged.policy),
      source,
      candidate: selected.bundle.id,
      deploymentId: selected.package.deploymentId,
    },
    prompt,
    status: resolution.status,
  });
}
