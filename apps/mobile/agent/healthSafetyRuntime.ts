import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT, scopedStorageKey } from "../runtimeEnvironment";
import {
  BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
  mergeHealthSafetyPolicies,
  type HealthSafetyRuntimePolicy,
} from "./healthSafety";
import { fetchActivePolicyDeployment, POLICY_DEPLOYMENT_REFRESH_MS } from "./policyDeployment";

const HEALTH_SAFETY_CACHE_KEY = scopedStorageKey("gymnasia.mobile.health_safety.runtime.v1");

type HealthSafetyPolicySource = "bundled" | "remote" | "cache";

export type HealthSafetyPolicySelection = {
  policy: HealthSafetyRuntimePolicy;
  source: HealthSafetyPolicySource;
  candidate: string;
  deploymentId: number | null;
};

type HealthSafetyCacheRecord = {
  schemaVersion: 1;
  environment: string;
  channel: string;
  candidate: string;
  deploymentId: number;
  sha256: string;
  body: string;
};

let memorySelection: { expiresAt: number; value: HealthSafetyPolicySelection } | null = null;

function bundledSelection(): HealthSafetyPolicySelection {
  return {
    policy: BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
    source: "bundled",
    candidate: RUNTIME_ENVIRONMENT.policyCandidate,
    deploymentId: null,
  };
}

async function sha256(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function parseAndMerge(body: string): HealthSafetyRuntimePolicy | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    const merged = mergeHealthSafetyPolicies(BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY, parsed);
    if (merged.errors.length > 0) {
      void pushTrace("healthSafety", "runtime-overlay-rejected", { errors: merged.errors });
      return null;
    }
    return merged.policy;
  } catch {
    void pushTrace("healthSafety", "runtime-overlay-rejected", { errors: ["invalid-json"] });
    return null;
  }
}

async function loadCachedSelection(): Promise<HealthSafetyPolicySelection | null> {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_SAFETY_CACHE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<HealthSafetyCacheRecord>;
    if (
      record.schemaVersion !== 1
      || record.environment !== RUNTIME_ENVIRONMENT.environment
      || record.channel !== RUNTIME_ENVIRONMENT.policyChannel
      || typeof record.candidate !== "string"
      || typeof record.deploymentId !== "number"
      || typeof record.sha256 !== "string"
      || typeof record.body !== "string"
      || await sha256(record.body) !== record.sha256
    ) {
      return null;
    }
    const policy = parseAndMerge(record.body);
    return policy ? {
      policy,
      source: "cache",
      candidate: record.candidate,
      deploymentId: record.deploymentId,
    } : null;
  } catch {
    return null;
  }
}

export async function loadHealthSafetyPolicy(): Promise<HealthSafetyPolicySelection> {
  const now = Date.now();
  if (memorySelection && memorySelection.expiresAt > now) return memorySelection.value;
  if (RUNTIME_ENVIRONMENT.policyChannel === "Local") return bundledSelection();

  try {
    const deployment = await fetchActivePolicyDeployment(RUNTIME_ENVIRONMENT.policyChannel);
    if (
      deployment.schemaVersion !== 2
      || !deployment.runtimePolicyUrl
      || !deployment.runtimePolicySha256
      || !deployment.runtimePolicyVersion
    ) {
      throw new Error("deployment-without-runtime-overlay");
    }
    const response = await fetch(deployment.runtimePolicyUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`runtime-overlay-http-${response.status}`);
    const body = await response.text();
    if (await sha256(body) !== deployment.runtimePolicySha256) {
      throw new Error("runtime-overlay-hash-mismatch");
    }
    const policy = parseAndMerge(body);
    if (!policy || policy.policyVersion !== deployment.runtimePolicyVersion) {
      throw new Error("runtime-overlay-version-mismatch");
    }
    const value: HealthSafetyPolicySelection = {
      policy,
      source: "remote",
      candidate: deployment.candidate,
      deploymentId: deployment.deploymentId,
    };
    const record: HealthSafetyCacheRecord = {
      schemaVersion: 1,
      environment: RUNTIME_ENVIRONMENT.environment,
      channel: deployment.channel,
      candidate: deployment.candidate,
      deploymentId: deployment.deploymentId,
      sha256: deployment.runtimePolicySha256,
      body,
    };
    await AsyncStorage.setItem(HEALTH_SAFETY_CACHE_KEY, JSON.stringify(record));
    memorySelection = { value, expiresAt: now + POLICY_DEPLOYMENT_REFRESH_MS };
    void pushTrace("healthSafety", "runtime-overlay-selected", {
      source: value.source,
      candidate: value.candidate,
      policyVersion: value.policy.policyVersion,
    });
    return value;
  } catch (error) {
    const cached = await loadCachedSelection();
    const value = cached ?? bundledSelection();
    memorySelection = { value, expiresAt: now + POLICY_DEPLOYMENT_REFRESH_MS };
    void pushTrace("healthSafety", "runtime-overlay-fallback", {
      source: value.source,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return value;
  }
}

export function clearHealthSafetyPolicyMemoryCache(): void {
  memorySelection = null;
}
