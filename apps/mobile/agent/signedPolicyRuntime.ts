import AsyncStorage from "@react-native-async-storage/async-storage";

import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT, scopedStorageKey } from "../runtimeEnvironment";
import { BUNDLED_SIGNED_POLICY_PACKAGE } from "./generated/signedPolicySnapshot.generated";
import { TRUSTED_POLICY_ROOTS } from "./generated/trustedPolicyRoots.generated";
import { mergeHealthSafetyPolicies, BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY } from "./healthSafety";
import {
  canonicalPolicyJson,
  MAX_POLICY_BUNDLE_BYTES,
  policySha256Hex,
  verifySignedPolicyPackage,
  type PolicySignatureEnvelope,
  type SignedPolicyPackage,
  type VerifiedSignedPolicy,
} from "./signedPolicy";
import {
  selectSignedPolicy,
  type SignedPolicyDiagnostic,
  type SignedPolicySelection,
} from "./signedPolicySelection";
import {
  fetchActivePolicyDeployment,
  POLICY_DEPLOYMENT_REFRESH_MS,
} from "./policyDeployment";
import { AGENT_TOOL_NAMES } from "./toolDefinitions";

const SIGNED_POLICY_CACHE_KEY = scopedStorageKey("gymnasia.mobile.signed_policy.cache.v1");
const ACCEPTED_JSON_TYPES = new Set([
  "application/json",
  "application/octet-stream",
  "text/plain",
]);

let memorySelection: { expiresAt: number; value: SignedPolicySelection } | null = null;
let pendingSelection: Promise<SignedPolicySelection> | null = null;

function traceSignedPolicy(diagnostic: SignedPolicyDiagnostic): void {
  const { event, ...data } = diagnostic;
  void pushTrace("signedPolicy", event, data);
}

async function downloadUtf8(
  url: string,
  maximumBytes: number,
): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: "application/json, application/octet-stream;q=0.9, text/plain;q=0.8" },
  });
  if (!response.ok) throw new Error(`policy-asset-http-${response.status}`);
  const mediaType = response.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType && !ACCEPTED_JSON_TYPES.has(mediaType)) {
    throw new Error("policy-asset-content-type");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    throw new Error("policy-asset-size");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("policy-asset-utf8");
  }
}

function parseSignature(body: string): PolicySignatureEnvelope {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid signature");
    }
    return parsed as PolicySignatureEnvelope;
  } catch {
    throw new Error("policy-signature-json");
  }
}

function verifyPackage(packageValue: unknown): VerifiedSignedPolicy {
  const channel = RUNTIME_ENVIRONMENT.policyChannel;
  if (channel === "Local") throw new Error("Local no usa política remota firmada.");
  const verified = verifySignedPolicyPackage({
    packageValue,
    trustedRoots: TRUSTED_POLICY_ROOTS,
    announcedTools: AGENT_TOOL_NAMES,
    expectedEnvironment: RUNTIME_ENVIRONMENT.environment,
    expectedChannel: channel,
  });
  const merged = mergeHealthSafetyPolicies(
    BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY,
    verified.bundle.healthSafetyRuntime.content,
  );
  if (merged.errors.length > 0) {
    throw new Error("La política sanitaria firmada no cumple el contrato móvil.");
  }
  return verified;
}

async function fetchRemotePackage(): Promise<SignedPolicyPackage> {
  const channel = RUNTIME_ENVIRONMENT.policyChannel;
  if (channel === "Local") throw new Error("Local no tiene deployment remoto.");
  const deployment = await fetchActivePolicyDeployment(channel);
  const [bundleBody, signatureBody] = await Promise.all([
    downloadUtf8(deployment.bundleUrl, MAX_POLICY_BUNDLE_BYTES),
    downloadUtf8(deployment.signatureUrl, 64 * 1024),
  ]);
  if (policySha256Hex(bundleBody) !== deployment.bundleSha256) {
    throw new Error("policy-deployment-bundle-digest");
  }
  return {
    activationBody: canonicalPolicyJson(deployment.activation),
    activationSignature: deployment.activationSignature,
    bundleBody,
    bundleSignature: parseSignature(signatureBody),
    candidate: deployment.candidate,
    channel,
    deploymentId: deployment.deploymentId,
    environment: RUNTIME_ENVIRONMENT.environment,
    schemaVersion: 1,
  };
}

async function resolveSignedPolicy(): Promise<SignedPolicySelection> {
  if (!BUNDLED_SIGNED_POLICY_PACKAGE) {
    throw new Error("La compilación no contiene un snapshot firmado.");
  }
  return selectSignedPolicy({
    fetchRemote: fetchRemotePackage,
    readCache: () => AsyncStorage.getItem(SIGNED_POLICY_CACHE_KEY),
    writeCache: (value) => AsyncStorage.setItem(SIGNED_POLICY_CACHE_KEY, value),
    verify: verifyPackage,
    bundled: BUNDLED_SIGNED_POLICY_PACKAGE,
    scope: {
      environment: RUNTIME_ENVIRONMENT.environment,
      channel: RUNTIME_ENVIRONMENT.policyChannel as "Staging" | "Production",
    },
    diagnostic: traceSignedPolicy,
  });
}

export async function loadSignedPolicy(): Promise<SignedPolicySelection> {
  if (RUNTIME_ENVIRONMENT.policyChannel === "Local") {
    throw new Error("El entorno Local usa exclusivamente el snapshot de desarrollo.");
  }
  const now = Date.now();
  if (memorySelection && memorySelection.expiresAt > now) return memorySelection.value;
  if (!pendingSelection) {
    pendingSelection = resolveSignedPolicy()
      .then((value) => {
        memorySelection = { value, expiresAt: Date.now() + POLICY_DEPLOYMENT_REFRESH_MS };
        return value;
      })
      .finally(() => {
        pendingSelection = null;
      });
  }
  return pendingSelection;
}

export function clearSignedPolicyMemoryCache(): void {
  memorySelection = null;
  pendingSelection = null;
}
