export const APP_ENVIRONMENTS = ["development", "staging", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type PolicyChannel = "Local" | "Staging" | "Production";
export type ProviderMode = "fake" | "byok";

export const APP_CONFIGURATION_VERSION = 1 as const;

export type AppVariant = {
  environment: AppEnvironment;
  name: string;
  applicationId: string;
  policyChannel: PolicyChannel;
  storageNamespace: string;
  providerMode: ProviderMode;
  configurationVersion: typeof APP_CONFIGURATION_VERSION;
};

export type RuntimeEnvironment = AppVariant & {
  policyCandidate: string;
  policySha256: string;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const BASE_VARIANTS: Record<AppEnvironment, Omit<AppVariant, "providerMode">> = {
  development: {
    environment: "development",
    name: "Gymnasia Dev",
    applicationId: "com.maximofn.gymnasia.dev",
    policyChannel: "Local",
    storageNamespace: "gymnasia.development",
    configurationVersion: APP_CONFIGURATION_VERSION,
  },
  staging: {
    environment: "staging",
    name: "Gymnasia Staging",
    applicationId: "com.maximofn.gymnasia.staging",
    policyChannel: "Staging",
    storageNamespace: "gymnasia.staging",
    configurationVersion: APP_CONFIGURATION_VERSION,
  },
  production: {
    environment: "production",
    name: "Gymnasia",
    applicationId: "com.maximofn.gymnasia",
    policyChannel: "Production",
    storageNamespace: "gymnasia.production",
    configurationVersion: APP_CONFIGURATION_VERSION,
  },
};

export function resolveAppVariant(
  rawEnvironment: string | undefined,
  rawDevelopmentProviderMode: string | undefined,
): AppVariant {
  if (!rawEnvironment) {
    throw new Error(
      `APP_ENV es obligatorio (${APP_ENVIRONMENTS.join(" | ")}).`,
    );
  }
  if (!APP_ENVIRONMENTS.includes(rawEnvironment as AppEnvironment)) {
    throw new Error(`APP_ENV desconocido: ${rawEnvironment}.`);
  }

  const environment = rawEnvironment as AppEnvironment;
  if (environment !== "development" && rawDevelopmentProviderMode) {
    throw new Error("DEV_PROVIDER_MODE solo puede usarse con APP_ENV=development.");
  }

  let providerMode: ProviderMode = "byok";
  if (environment === "development") {
    const requestedMode = rawDevelopmentProviderMode || "fake";
    if (requestedMode !== "fake" && requestedMode !== "byok") {
      throw new Error(`DEV_PROVIDER_MODE desconocido: ${requestedMode}.`);
    }
    providerMode = requestedMode;
  }

  return { ...BASE_VARIANTS[environment], providerMode };
}

export function storageKeyForVariant(variant: AppVariant, key: string): string {
  return variant.environment === "production"
    ? key
    : `${variant.storageNamespace}:${key}`;
}

export function secureStorageKeyForVariant(variant: AppVariant, key: string): string {
  return variant.environment === "production"
    ? key
    : `${variant.storageNamespace}.${key}`;
}

export function isStorageKeyInVariant(variant: AppVariant, key: string): boolean {
  if (variant.environment !== "production") {
    return key.startsWith(`${variant.storageNamespace}:`);
  }
  return (
    (key.startsWith("gymnasia.") || key === "gymnasia_debug_traces")
    && !key.startsWith("gymnasia.development:")
    && !key.startsWith("gymnasia.staging:")
  );
}

export function resolveRuntimeEnvironment(extra: unknown): RuntimeEnvironment {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    throw new Error("Falta la configuración pública del entorno.");
  }
  const candidate = extra as Record<string, unknown>;
  const environment = typeof candidate.environment === "string"
    ? candidate.environment
    : undefined;
  const providerMode = typeof candidate.providerMode === "string"
    ? candidate.providerMode
    : undefined;
  const variant = resolveAppVariant(
    environment,
    environment === "development" ? providerMode : undefined,
  );

  if (
    candidate.configurationVersion !== APP_CONFIGURATION_VERSION
    || candidate.channel !== variant.policyChannel
    || candidate.storageNamespace !== variant.storageNamespace
    || candidate.providerMode !== variant.providerMode
  ) {
    throw new Error("La configuración pública del entorno es híbrida o incompatible.");
  }

  const policyCandidate = typeof candidate.policyCandidate === "string"
    ? candidate.policyCandidate.trim()
    : "";
  const policySha256 = typeof candidate.policySha256 === "string"
    ? candidate.policySha256.trim().toLowerCase()
    : "";
  if (!policyCandidate || !SHA256_PATTERN.test(policySha256)) {
    throw new Error("Los metadatos públicos de política son inválidos.");
  }

  return { ...variant, policyCandidate, policySha256 };
}

export type FeedbackEndpoint =
  | { available: true; baseUrl: string }
  | { available: false; reason: "not_configured" | "invalid_config" };

/**
 * Resuelve el endpoint del backend de incidencias desde `expoConfig.extra`.
 *
 * Nunca lanza, a diferencia de `resolveRuntimeEnvironment`: un endpoint mal
 * configurado degrada la funcionalidad, no puede tumbar el arranque de la app.
 */
export function resolveFeedbackEndpoint(extra: unknown): FeedbackEndpoint {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    return { available: false, reason: "not_configured" };
  }
  const candidate = extra as Record<string, unknown>;
  const raw = typeof candidate.feedbackApiBaseUrl === "string"
    ? candidate.feedbackApiBaseUrl.trim()
    : "";
  if (!raw) return { available: false, reason: "not_configured" };

  const isDevelopment = candidate.environment === "development";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { available: false, reason: "invalid_config" };
  }

  // HTTP solo se tolera contra el propio equipo y solo en desarrollo.
  const isLocalHttp = parsed.protocol === "http:"
    && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (parsed.protocol !== "https:" && !(isDevelopment && isLocalHttp)) {
    return { available: false, reason: "invalid_config" };
  }
  // Credenciales embebidas, consulta o fragmento indican una URL manipulada.
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { available: false, reason: "invalid_config" };
  }

  return { available: true, baseUrl: raw.replace(/\/+$/, "") };
}
