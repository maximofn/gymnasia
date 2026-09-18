import type { Provider } from "./providerConfiguration";

// GYM-247 (ticket para impedir activar la evaluación sanitaria en un proveedor
// sin API key). El consentimiento pasó de tres interruptores por proveedor a
// uno solo: si está activo, las consultas ambiguas se envían al proveedor que
// esté usando esa superficie (Coach o Estimador) para una segunda
// clasificación; si no, no se envía nada. El documento persistido conserva la
// clave `gymnasia.mobile.health_safety.consent.v1` y se versiona por dentro con
// `schemaVersion`, igual que las preferencias de usuario.

export const HEALTH_SAFETY_CONSENT_SCHEMA_VERSION = 2;

export type HealthSafetyConsentState = {
  consentVersion: string;
  schemaVersion: typeof HEALTH_SAFETY_CONSENT_SCHEMA_VERSION;
  enabled: boolean;
  noticeSeen: boolean;
};

export type HealthSafetyConsentUpdate = {
  enabled?: boolean;
  noticeSeen?: boolean;
};

export type HealthSafetyConsentSwitchStatus = "Activada" | "Desactivada" | "Sin clave";

export type HealthSafetyConsentSwitchModel = {
  enabled: boolean;
  available: boolean;
  status: HealthSafetyConsentSwitchStatus;
};

type ProviderKeyLike = { provider: Provider; api_key: string };

const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "google"];

export function createHealthSafetyConsentState(consentVersion: string): HealthSafetyConsentState {
  return {
    consentVersion,
    schemaVersion: HEALTH_SAFETY_CONSENT_SCHEMA_VERSION,
    enabled: false,
    noticeSeen: false,
  };
}

/** Proveedores con una API key guardada no vacía. */
export function configuredHealthSafetyProviders(
  keys: ReadonlyArray<ProviderKeyLike>,
): ReadonlySet<Provider> {
  const configured = new Set<Provider>();
  for (const key of keys) {
    if (PROVIDERS.includes(key.provider) && typeof key.api_key === "string" && key.api_key.trim() !== "") {
      configured.add(key.provider);
    }
  }
  return configured;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Migra el documento heredado con un booleano por proveedor. Solo cuenta el
 * consentimiento de proveedores que siguen teniendo clave: un «Activada»
 * huérfano nunca se convierte en permiso para enviar texto a otro proveedor.
 */
function migrateLegacyProviders(
  providers: unknown,
  configuredProviders: ReadonlySet<Provider>,
): boolean {
  if (!isRecord(providers)) return false;
  return PROVIDERS.some((provider) => providers[provider] === true && configuredProviders.has(provider));
}

function anyLegacyNoticeSeen(noticeSeen: unknown): boolean {
  if (!isRecord(noticeSeen)) return false;
  return PROVIDERS.some((provider) => noticeSeen[provider] === true);
}

/**
 * Normaliza lo leído del almacenamiento. Acepta el esquema actual y el
 * heredado; cualquier otra cosa, o una `consentVersion` distinta a la de la
 * política vigente, vuelve al estado por defecto (todo apagado).
 */
export function normalizeHealthSafetyConsentState(
  value: unknown,
  options: { consentVersion: string; configuredProviders: ReadonlySet<Provider> },
): HealthSafetyConsentState {
  const fallback = createHealthSafetyConsentState(options.consentVersion);
  if (!isRecord(value)) return fallback;
  if (value.consentVersion !== options.consentVersion) return fallback;

  if (value.schemaVersion === HEALTH_SAFETY_CONSENT_SCHEMA_VERSION) {
    return sanitizeHealthSafetyConsent(
      {
        ...fallback,
        enabled: value.enabled === true,
        noticeSeen: value.noticeSeen === true,
      },
      options.configuredProviders,
    ).state;
  }

  if (value.schemaVersion === undefined && "providers" in value) {
    return {
      ...fallback,
      enabled: migrateLegacyProviders(value.providers, options.configuredProviders),
      noticeSeen: anyLegacyNoticeSeen(value.noticeSeen),
    };
  }

  return fallback;
}

/** Sin ninguna clave guardada no hay a quién enviar nada: el consentimiento se apaga. */
export function sanitizeHealthSafetyConsent(
  state: HealthSafetyConsentState,
  configuredProviders: ReadonlySet<Provider>,
): { state: HealthSafetyConsentState; changed: boolean } {
  if (state.enabled && configuredProviders.size === 0) {
    return { state: { ...state, enabled: false }, changed: true };
  }
  return { state, changed: false };
}

/** Aplica un cambio del interruptor; `enabled: true` sin clave se ignora. */
export function applyHealthSafetyConsentUpdate(
  state: HealthSafetyConsentState,
  update: HealthSafetyConsentUpdate,
  configuredProviders: ReadonlySet<Provider>,
): HealthSafetyConsentState {
  const next: HealthSafetyConsentState = {
    ...state,
    ...(update.noticeSeen === undefined ? {} : { noticeSeen: update.noticeSeen }),
  };
  if (update.enabled === true) {
    next.enabled = configuredProviders.size > 0;
  } else if (update.enabled === false) {
    next.enabled = false;
  }
  return sanitizeHealthSafetyConsent(next, configuredProviders).state;
}

/** Cómo debe pintarse el interruptor único del panel de Ajustes. */
export function describeHealthSafetyConsentSwitch(
  state: HealthSafetyConsentState,
  configuredProviders: ReadonlySet<Provider>,
): HealthSafetyConsentSwitchModel {
  const available = configuredProviders.size > 0;
  const enabled = available && state.enabled;
  return {
    enabled,
    available,
    status: !available ? "Sin clave" : enabled ? "Activada" : "Desactivada",
  };
}

/**
 * El evaluador solo se consulta con el proveedor activo de la superficie, y
 * solo si ese proveedor tiene clave guardada.
 */
export function shouldEvaluateWithProvider(
  state: HealthSafetyConsentState,
  activeProvider: ProviderKeyLike | null | undefined,
): boolean {
  if (!state.enabled || !activeProvider) return false;
  return configuredHealthSafetyProviders([activeProvider]).has(activeProvider.provider);
}
