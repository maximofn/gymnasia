import {
  DEFAULT_GOOGLE_MODEL,
  normalizeAnthropicWorkspaceId,
  normalizeGoogleModel,
} from "./providerTransport";

export type Provider = "anthropic" | "openai" | "google";

export type OpenAIReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type ProviderConfiguration = {
  provider: Provider;
  is_active: boolean;
  api_key: string;
  model: string;
  workspace_id?: string;
  reasoning_effort?: OpenAIReasoningEffort | null;
};

export type ProviderDraft = {
  api_key: string;
  model: string;
  workspace_id?: string;
  reasoning_effort?: OpenAIReasoningEffort | null;
};

export type ProviderOperationPhase =
  | "idle"
  | "dirty"
  | "verifying"
  | "persisting"
  | "connected"
  | "rejected"
  | "save_failed";

export type ProviderOperation = {
  draftRevision: number;
  saveRevision: number;
  discoveryRevision: number;
  phase: ProviderOperationPhase;
};

export type ProviderOperationMap = Record<Provider, ProviderOperation>;

export type ProviderSaveToken = {
  provider: Provider;
  draftRevision: number;
  saveRevision: number;
  configurationRevision: number;
};

export type ProviderDiscoveryToken = {
  provider: Provider;
  draftRevision: number;
  discoveryRevision: number;
};

export const PROVIDERS: Provider[] = ["openai", "anthropic", "google"];

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.6-luna",
  anthropic: "claude-sonnet-5",
  google: DEFAULT_GOOGLE_MODEL,
};

export const DEFAULT_OPENAI_REASONING_EFFORT: OpenAIReasoningEffort = "medium";

export const OPENAI_REASONING_EFFORT_OPTIONS: OpenAIReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

const LEGACY_OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export function normalizeProviderModel(
  provider: Provider,
  rawModel: string | null | undefined,
): string {
  if (provider === "google") {
    return normalizeGoogleModel(rawModel);
  }
  const trimmed = (rawModel ?? "").trim();
  const model = trimmed || DEFAULT_MODELS[provider];
  if (provider === "openai" && model === LEGACY_OPENAI_DEFAULT_MODEL) {
    return DEFAULT_MODELS.openai;
  }
  return model;
}

export function getSupportedOpenAIReasoningEfforts(
  rawModel: string | null | undefined,
): OpenAIReasoningEffort[] {
  const model = normalizeProviderModel("openai", rawModel).trim().toLowerCase();
  if (!model) return ["minimal", "low", "medium", "high"];
  if (model.startsWith("gpt-5.4-pro")) return ["medium", "high", "xhigh"];
  if (model.startsWith("gpt-5-pro")) return ["high"];
  if (
    model.startsWith("gpt-5.4")
    || model.startsWith("gpt-5.3")
    || model.startsWith("gpt-5.2")
  ) {
    return ["none", "low", "medium", "high", "xhigh"];
  }
  if (model.startsWith("gpt-5.1")) return ["none", "low", "medium", "high"];
  if (model.startsWith("gpt-5")) return ["minimal", "low", "medium", "high"];
  if (model.startsWith("o")) return ["low", "medium", "high"];
  return [];
}

export function normalizeOpenAIReasoningEffort(
  rawEffort: string | null | undefined,
  rawModel: string | null | undefined,
): OpenAIReasoningEffort | null {
  const supported = getSupportedOpenAIReasoningEfforts(rawModel);
  if (supported.length === 0) return null;
  const normalized = (rawEffort ?? "").trim().toLowerCase();
  const candidate = OPENAI_REASONING_EFFORT_OPTIONS.find((effort) => effort === normalized);
  if (candidate && supported.includes(candidate)) {
    return candidate;
  }
  if (supported.includes(DEFAULT_OPENAI_REASONING_EFFORT)) {
    return DEFAULT_OPENAI_REASONING_EFFORT;
  }
  return supported[0] ?? null;
}

export function normalizeProviderConfiguration(
  provider: Provider,
  raw: Partial<ProviderConfiguration> | ProviderDraft | undefined,
  isActive = false,
): ProviderConfiguration {
  const model = normalizeProviderModel(provider, raw?.model);
  return {
    provider,
    is_active: "is_active" in (raw ?? {})
      ? (raw as Partial<ProviderConfiguration>).is_active === true
      : isActive,
    api_key: (raw?.api_key ?? "").trim(),
    model,
    workspace_id:
      provider === "anthropic"
        ? normalizeAnthropicWorkspaceId(raw?.workspace_id)
        : "",
    reasoning_effort:
      provider === "openai"
        ? normalizeOpenAIReasoningEffort(raw?.reasoning_effort, model)
        : null,
  };
}

export function normalizeProviderConfigurations(
  values: readonly Partial<ProviderConfiguration>[] | null | undefined,
): ProviderConfiguration[] {
  const byProvider = new Map<Provider, Partial<ProviderConfiguration>>();
  for (const value of values ?? []) {
    if (
      value?.provider === "openai"
      || value?.provider === "anthropic"
      || value?.provider === "google"
    ) {
      byProvider.set(value.provider, value);
    }
  }

  const normalized = PROVIDERS.map((provider, index) =>
    normalizeProviderConfiguration(provider, byProvider.get(provider), index === 0));
  const firstActiveIndex = normalized.findIndex((item) => item.is_active);
  const activeIndex = firstActiveIndex >= 0 ? firstActiveIndex : 0;
  return normalized.map((item, index) => ({ ...item, is_active: index === activeIndex }));
}

export function createDefaultProviderConfigurations(): ProviderConfiguration[] {
  return normalizeProviderConfigurations([]);
}

export function createProviderDrafts(
  values: readonly ProviderConfiguration[],
): Record<Provider, ProviderDraft> {
  const normalized = normalizeProviderConfigurations(values);
  return Object.fromEntries(normalized.map((item) => [
    item.provider,
    {
      api_key: item.api_key,
      model: item.model,
      workspace_id: item.workspace_id ?? "",
      reasoning_effort: item.reasoning_effort ?? null,
    },
  ])) as Record<Provider, ProviderDraft>;
}

export function applyProviderCandidate(
  values: readonly ProviderConfiguration[],
  candidate: ProviderConfiguration,
  activate = true,
): ProviderConfiguration[] {
  return normalizeProviderConfigurations(values.map((item) => {
    if (item.provider === candidate.provider) {
      return { ...candidate, is_active: activate ? true : item.is_active };
    }
    return activate ? { ...item, is_active: false } : item;
  }));
}

export function createProviderOperationMap(): ProviderOperationMap {
  return Object.fromEntries(PROVIDERS.map((provider) => [provider, {
    draftRevision: 0,
    saveRevision: 0,
    discoveryRevision: 0,
    phase: "idle" as const,
  }])) as ProviderOperationMap;
}

export function editProviderOperation(
  state: ProviderOperationMap,
  provider: Provider,
): ProviderOperationMap {
  const current = state[provider];
  return {
    ...state,
    [provider]: {
      ...current,
      draftRevision: current.draftRevision + 1,
      discoveryRevision: current.discoveryRevision + 1,
      phase: "dirty",
    },
  };
}

export function beginProviderSave(
  state: ProviderOperationMap,
  provider: Provider,
  needsVerification: boolean,
  configurationRevision = 0,
): { state: ProviderOperationMap; token: ProviderSaveToken } {
  const current = state[provider];
  const next: ProviderOperation = {
    ...current,
    saveRevision: current.saveRevision + 1,
    discoveryRevision: current.discoveryRevision + 1,
    phase: needsVerification ? "verifying" : "persisting",
  };
  return {
    state: { ...state, [provider]: next },
    token: {
      provider,
      draftRevision: current.draftRevision,
      saveRevision: next.saveRevision,
      configurationRevision,
    },
  };
}

export function isProviderSaveCurrent(
  state: ProviderOperationMap,
  token: ProviderSaveToken,
  configurationRevision = token.configurationRevision,
): boolean {
  const current = state[token.provider];
  return current.draftRevision === token.draftRevision
    && current.saveRevision === token.saveRevision
    && configurationRevision === token.configurationRevision;
}

export function setProviderSavePhase(
  state: ProviderOperationMap,
  token: ProviderSaveToken,
  phase: Extract<ProviderOperationPhase, "persisting" | "connected" | "rejected" | "save_failed">,
): ProviderOperationMap {
  if (!isProviderSaveCurrent(state, token)) return state;
  return {
    ...state,
    [token.provider]: { ...state[token.provider], phase },
  };
}

export function beginProviderDiscovery(
  state: ProviderOperationMap,
  provider: Provider,
): { state: ProviderOperationMap; token: ProviderDiscoveryToken } {
  const current = state[provider];
  const next = {
    ...current,
    discoveryRevision: current.discoveryRevision + 1,
  };
  return {
    state: { ...state, [provider]: next },
    token: {
      provider,
      draftRevision: current.draftRevision,
      discoveryRevision: next.discoveryRevision,
    },
  };
}

export function isProviderDiscoveryCurrent(
  state: ProviderOperationMap,
  token: ProviderDiscoveryToken,
): boolean {
  const current = state[token.provider];
  return current.draftRevision === token.draftRevision
    && current.discoveryRevision === token.discoveryRevision;
}
