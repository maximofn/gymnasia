import {
  anthropicModelsQuery,
  collectAnthropicModels,
  type AnthropicModelCatalog,
} from "./anthropicModels";
import type { ProviderConfiguration } from "./providerConfiguration";
import {
  anthropicApiHeaders,
  anthropicProxyCredentials,
  explainAnthropicError,
  FAKE_PROVIDER_MODELS,
  fetchProviderConfiguration,
  googleApiHeaders,
} from "./providerTransport";
import {
  verifyProviderConfiguration,
  type ProviderVerificationResult,
} from "./providerVerification";
import { googleInteractionEndpoint } from "./googleStreamTransport";

export type { ProviderVerificationResult } from "./providerVerification";

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE =
  "No se pudo conectar con el proxy local de Anthropic. Inícialo y vuelve a intentarlo.";

export type OpenAIModelOption = { id: string; owned_by: string | null };
export type GoogleModelOption = { id: string; display_name: string | null };

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as {
    error?: { message?: string };
    detail?: string;
    message?: string;
  };
  return candidate.error?.message ?? candidate.detail ?? candidate.message ?? fallback;
}

export function parseOpenAIModelOptions(payload: unknown): OpenAIModelOption[] {
  if (!payload || typeof payload !== "object") return [];
  const candidate = payload as {
    data?: Array<{ id?: string; owned_by?: string }>;
    models?: Array<{ id?: string; owned_by?: string }>;
  };
  const rawItems = Array.isArray(candidate.models)
    ? candidate.models
    : Array.isArray(candidate.data)
      ? candidate.data
      : [];
  const deduplicated = new Map<string, OpenAIModelOption>();
  rawItems.forEach((item) => {
    const id = item?.id?.trim();
    if (!id) return;
    deduplicated.set(id, { id, owned_by: item?.owned_by?.trim() || null });
  });
  return [...deduplicated.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function parseGoogleModelOptions(payload: unknown): GoogleModelOption[] {
  if (!payload || typeof payload !== "object") return [];
  const candidate = payload as {
    models?: Array<{
      name?: string;
      displayName?: string;
      display_name?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  const rawItems = Array.isArray(candidate.models) ? candidate.models : [];
  const deduplicated = new Map<string, GoogleModelOption>();
  rawItems.forEach((item) => {
    const rawName = item?.name?.trim();
    if (!rawName) return;
    const id = rawName.replace(/^models\//, "").trim();
    if (!id) return;
    const methods = Array.isArray(item?.supportedGenerationMethods)
      ? item.supportedGenerationMethods
      : null;
    if (methods && methods.length > 0 && !methods.includes("generateContent")) return;
    deduplicated.set(id, {
      id,
      display_name: item?.displayName?.trim() || item?.display_name?.trim() || null,
    });
  });
  return [...deduplicated.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export async function fetchAnthropicModelsViaWebProxy(input: {
  apiKey: string;
  workspaceId?: string;
  proxyUrl: string;
  fakeMode: boolean;
}): Promise<AnthropicModelCatalog> {
  if (input.fakeMode) {
    return {
      options: [...FAKE_PROVIDER_MODELS.anthropic],
      pagesFetched: 1,
      truncated: false,
      partial: false,
      warning: null,
    };
  }
  try {
    return await collectAnthropicModels(async () => {
      const response = await fetchProviderConfiguration(input.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anthropicProxyCredentials(input.apiKey, input.workspaceId)),
      });
      let payload: unknown = null;
      try { payload = await response.json(); } catch { /* ignore invalid JSON */ }
      if (!response.ok) {
        throw new Error(explainAnthropicError(
          extractErrorMessage(payload, `Proxy Anthropic error (${response.status})`),
        ));
      }
      return payload;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : "";
    if (message.toLowerCase().includes("failed to fetch")) {
      throw new Error(ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE);
    }
    throw new Error(message || ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE);
  }
}

export async function fetchAnthropicModelsDirect(input: {
  apiKey: string;
  workspaceId?: string;
  fakeMode: boolean;
  directBrowserAccess: boolean;
}): Promise<AnthropicModelCatalog> {
  if (input.fakeMode) {
    return {
      options: [...FAKE_PROVIDER_MODELS.anthropic],
      pagesFetched: 1,
      truncated: false,
      partial: false,
      warning: null,
    };
  }
  return collectAnthropicModels(async (afterId) => {
    const response = await fetchProviderConfiguration(
      `https://api.anthropic.com/v1/models${anthropicModelsQuery(afterId)}`,
      {
        method: "GET",
        headers: anthropicApiHeaders(
          input.apiKey,
          ANTHROPIC_API_VERSION,
          input.workspaceId,
          { "Content-Type": "application/json" },
          { directBrowserAccess: input.directBrowserAccess },
        ),
      },
    );
    let payload: unknown = null;
    try { payload = await response.json(); } catch { /* ignore invalid JSON */ }
    if (!response.ok) {
      throw new Error(explainAnthropicError(
        extractErrorMessage(payload, `Anthropic error (${response.status})`),
      ));
    }
    return payload;
  });
}

export async function fetchOpenAIModels(input: {
  apiKey: string;
  fakeMode: boolean;
}): Promise<OpenAIModelOption[]> {
  if (input.fakeMode) return [...FAKE_PROVIDER_MODELS.openai];
  const response = await fetchProviderConfiguration("https://api.openai.com/v1/models", {
    method: "GET",
    headers: { Authorization: `Bearer ${input.apiKey}` },
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* ignore invalid JSON */ }
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OpenAI error (${response.status})`));
  }
  return parseOpenAIModelOptions(payload);
}

export function googleModelsBaseUrl(input: {
  apiKey: string;
  fixturePort?: unknown;
  environment?: unknown;
}): string {
  return googleInteractionEndpoint(input.fixturePort, input.environment, input.apiKey)
    .replace(/\/interactions$/, "/models");
}

export async function fetchGoogleModels(input: {
  apiKey: string;
  fakeMode: boolean;
  fixturePort?: unknown;
  environment?: unknown;
}): Promise<GoogleModelOption[]> {
  if (input.fakeMode) return [...FAKE_PROVIDER_MODELS.google];
  const response = await fetchProviderConfiguration(googleModelsBaseUrl(input), {
    method: "GET",
    headers: googleApiHeaders(input.apiKey),
  });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* ignore invalid JSON */ }
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Google AI error (${response.status})`));
  }
  return parseGoogleModelOptions(payload);
}

export function verifyProviderConnection(input: {
  provider: ProviderConfiguration;
  platform: "web" | "native";
  fakeMode: boolean;
  anthropicProxyUrl?: string;
  googleFixturePort?: unknown;
  environment?: unknown;
}): Promise<ProviderVerificationResult> {
  return verifyProviderConfiguration(input.provider, {
    platform: input.platform,
    fakeMode: input.fakeMode,
    ...(input.provider.provider === "google"
      ? {
          googleModelsBaseUrl: googleModelsBaseUrl({
            apiKey: input.provider.api_key,
            fixturePort: input.googleFixturePort,
            environment: input.environment,
          }),
        }
      : {}),
    anthropicProxyUrl: input.anthropicProxyUrl,
  });
}
