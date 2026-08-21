import type { PolicyChannel } from "../environment";

export const POLICY_DEPLOYMENT_TASK = "gymnasia-policy" as const;
export const POLICY_DEPLOYMENT_SCHEMA_VERSION = 1 as const;
export const POLICY_DEPLOYMENT_REFRESH_MS = 5 * 60 * 1000;

const REPOSITORY = "maximofn/gymnasia";
const DEPLOYMENTS_API = `https://api.github.com/repos/${REPOSITORY}/deployments`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const POLICY_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d+$/;

export type PolicyDeploymentPayload = {
  schemaVersion: typeof POLICY_DEPLOYMENT_SCHEMA_VERSION;
  candidate: string;
  sourceCommit: string;
  assetUrl: string;
  assetSha256: string;
  policyVersion: string;
  datasetVersion: string;
  promptVersion: string;
  reportSha256: string;
  workflowRunUrl: string;
};

export type ActivePolicyDeployment = PolicyDeploymentPayload & {
  deploymentId: number;
  channel: Exclude<PolicyChannel, "Local">;
};

type GitHubDeployment = {
  id?: unknown;
  task?: unknown;
  environment?: unknown;
  payload?: unknown;
  statuses_url?: unknown;
};

type CacheEntry = {
  expiresAt: number;
  value?: ActivePolicyDeployment;
  error?: string;
};

const deploymentCache = new Map<string, CacheEntry>();

function isAllowedAssetUrl(value: string, candidate: string): boolean {
  const expectedPrefix = `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(candidate)}/`;
  return value === `${expectedPrefix}policy.md`;
}

function isAllowedWorkflowRunUrl(value: string): boolean {
  return new RegExp(`^https://github\\.com/${REPOSITORY}/actions/runs/[0-9]+$`).test(value);
}

export function parsePolicyDeploymentPayload(
  value: unknown,
): PolicyDeploymentPayload | null {
  let candidateValue = value;
  if (typeof candidateValue === "string") {
    try {
      candidateValue = JSON.parse(candidateValue) as unknown;
    } catch {
      return null;
    }
  }
  if (!candidateValue || typeof candidateValue !== "object" || Array.isArray(candidateValue)) {
    return null;
  }
  const payload = candidateValue as Record<string, unknown>;
  if (
    payload.schemaVersion !== POLICY_DEPLOYMENT_SCHEMA_VERSION
    || typeof payload.candidate !== "string"
    || !/^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/.test(payload.candidate)
    || typeof payload.sourceCommit !== "string"
    || !COMMIT_PATTERN.test(payload.sourceCommit)
    || typeof payload.assetUrl !== "string"
    || !isAllowedAssetUrl(payload.assetUrl, payload.candidate)
    || typeof payload.assetSha256 !== "string"
    || !SHA256_PATTERN.test(payload.assetSha256)
    || typeof payload.policyVersion !== "string"
    || !POLICY_VERSION_PATTERN.test(payload.policyVersion)
    || typeof payload.datasetVersion !== "string"
    || payload.datasetVersion !== payload.policyVersion
    || typeof payload.promptVersion !== "string"
    || payload.promptVersion !== `sha256:${payload.assetSha256}`
    || typeof payload.reportSha256 !== "string"
    || !SHA256_PATTERN.test(payload.reportSha256)
    || typeof payload.workflowRunUrl !== "string"
    || !isAllowedWorkflowRunUrl(payload.workflowRunUrl)
  ) {
    return null;
  }
  return payload as PolicyDeploymentPayload;
}

function isAllowedStatusesUrl(value: string, deploymentId: number): boolean {
  return value === `${DEPLOYMENTS_API}/${deploymentId}/statuses`;
}

async function deploymentSucceeded(
  deploymentId: number,
  statusesUrl: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  if (!isAllowedStatusesUrl(statusesUrl, deploymentId)) return false;
  const response = await fetchImpl(statusesUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return false;
  const statuses = await response.json() as Array<{ state?: unknown }>;
  return Array.isArray(statuses) && statuses[0]?.state === "success";
}

export async function fetchActivePolicyDeployment(
  channel: Exclude<PolicyChannel, "Local">,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<ActivePolicyDeployment> {
  const cached = deploymentCache.get(channel);
  if (cached && cached.expiresAt > now) {
    if (cached.value) return cached.value;
    throw new Error(cached.error || `No se pudo resolver la política ${channel}.`);
  }

  try {
    const url = `${DEPLOYMENTS_API}?environment=${encodeURIComponent(channel)}`
      + `&task=${encodeURIComponent(POLICY_DEPLOYMENT_TASK)}&per_page=20`;
    const response = await fetchImpl(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      throw new Error(`No se pudo resolver la política ${channel} (${response.status}).`);
    }
    const deployments = await response.json() as GitHubDeployment[];
    if (!Array.isArray(deployments)) throw new Error("Respuesta de deployments inválida.");

    for (const deployment of deployments) {
      if (
        deployment.task !== POLICY_DEPLOYMENT_TASK
        || deployment.environment !== channel
        || typeof deployment.id !== "number"
        || typeof deployment.statuses_url !== "string"
      ) {
        continue;
      }
      const payload = parsePolicyDeploymentPayload(deployment.payload);
      if (!payload) continue;
      if (!await deploymentSucceeded(deployment.id, deployment.statuses_url, fetchImpl)) continue;
      const value = { ...payload, deploymentId: deployment.id, channel };
      deploymentCache.set(channel, {
        value,
        expiresAt: now + POLICY_DEPLOYMENT_REFRESH_MS,
      });
      return value;
    }
    throw new Error(`No existe un deployment válido para ${channel}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : `No se pudo resolver la política ${channel}.`;
    deploymentCache.set(channel, {
      error: message,
      expiresAt: now + POLICY_DEPLOYMENT_REFRESH_MS,
    });
    throw new Error(message);
  }
}

export function clearPolicyDeploymentResolutionCache(): void {
  deploymentCache.clear();
}
