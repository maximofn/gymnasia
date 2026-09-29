import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  HEALTH_SAFETY_CONSENT_SCHEMA_VERSION,
  applyHealthSafetyConsentUpdate,
  configuredHealthSafetyProviders,
  createHealthSafetyConsentState,
  describeHealthSafetyConsentSwitch,
  normalizeHealthSafetyConsentState,
  sanitizeHealthSafetyConsent,
  shouldEvaluateWithProvider,
  type HealthSafetyConsentState,
} from "./healthSafetyConsent";
import type { Provider } from "./providerConfiguration";

const CONSENT_VERSION = "2026.08.1";
const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "google"];

function keys(configured: readonly Provider[]) {
  return PROVIDERS.map((provider) => ({
    provider,
    api_key: configured.includes(provider) ? `sk-${provider}` : "",
  }));
}

function providers(configured: readonly Provider[]): ReadonlySet<Provider> {
  return configuredHealthSafetyProviders(keys(configured));
}

function state(overrides: Partial<HealthSafetyConsentState> = {}): HealthSafetyConsentState {
  return { ...createHealthSafetyConsentState(CONSENT_VERSION), ...overrides };
}

// Documento tal como lo escribía la 1.20.0: un booleano por proveedor y sin schemaVersion.
function legacyDocument(enabled: Partial<Record<Provider, boolean>>, seen: Partial<Record<Provider, boolean>> = {}) {
  return {
    consentVersion: CONSENT_VERSION,
    providers: { anthropic: false, openai: false, google: false, ...enabled },
    noticeSeen: { anthropic: false, openai: false, google: false, ...seen },
  };
}

describe("configuredHealthSafetyProviders", () => {
  it("solo cuenta claves no vacías", () => {
    expect([...providers([])]).toEqual([]);
    expect([...providers(["openai"])]).toEqual(["openai"]);
    expect([...configuredHealthSafetyProviders([{ provider: "google", api_key: "   " }])]).toEqual([]);
  });
});

describe("normalizeHealthSafetyConsentState", () => {
  it("devuelve todo apagado ante basura o versión de consentimiento distinta", () => {
    for (const value of [null, undefined, 3, "x", [], { consentVersion: "2025.01.1", schemaVersion: 2, enabled: true }]) {
      expect(normalizeHealthSafetyConsentState(value, { consentVersion: CONSENT_VERSION, configuredProviders: providers(["openai"]) }))
        .toEqual(state());
    }
  });

  it("conserva el esquema actual cuando hay clave", () => {
    const stored = { consentVersion: CONSENT_VERSION, schemaVersion: 2, enabled: true, noticeSeen: true };
    expect(normalizeHealthSafetyConsentState(stored, { consentVersion: CONSENT_VERSION, configuredProviders: providers(["google"]) }))
      .toEqual(state({ enabled: true, noticeSeen: true }));
  });

  it("apaga el esquema actual si ya no queda ninguna clave", () => {
    const stored = { consentVersion: CONSENT_VERSION, schemaVersion: 2, enabled: true, noticeSeen: true };
    expect(normalizeHealthSafetyConsentState(stored, { consentVersion: CONSENT_VERSION, configuredProviders: providers([]) }))
      .toEqual(state({ enabled: false, noticeSeen: true }));
  });

  it("migra el documento heredado: un consentimiento huérfano no enciende el interruptor", () => {
    // Contrato: la 1.20.0 dejaba «Activada» para Anthropic sin clave. Con clave solo de OpenAI,
    // ese permiso no puede convertirse en permiso para enviar texto a OpenAI.
    const migrated = normalizeHealthSafetyConsentState(
      legacyDocument({ anthropic: true }, { anthropic: true }),
      { consentVersion: CONSENT_VERSION, configuredProviders: providers(["openai"]) },
    );
    expect(migrated).toEqual(state({ enabled: false, noticeSeen: true }));
    expect(migrated.schemaVersion).toBe(HEALTH_SAFETY_CONSENT_SCHEMA_VERSION);
  });

  it("migra el documento heredado: el consentimiento de un proveedor con clave sí se conserva", () => {
    expect(normalizeHealthSafetyConsentState(
      legacyDocument({ anthropic: true, google: true }),
      { consentVersion: CONSENT_VERSION, configuredProviders: providers(["google"]) },
    )).toEqual(state({ enabled: true, noticeSeen: false }));
  });

  it("no lanza con documentos heredados incompletos", () => {
    expect(normalizeHealthSafetyConsentState(
      { consentVersion: CONSENT_VERSION, providers: null },
      { consentVersion: CONSENT_VERSION, configuredProviders: providers(["google"]) },
    )).toEqual(state());
    expect(normalizeHealthSafetyConsentState(
      { consentVersion: CONSENT_VERSION, providers: { openai: "yes" }, noticeSeen: [] },
      { consentVersion: CONSENT_VERSION, configuredProviders: providers(["openai"]) },
    )).toEqual(state());
  });
});

describe("applyHealthSafetyConsentUpdate", () => {
  it("ignora enabled: true sin ninguna clave", () => {
    expect(applyHealthSafetyConsentUpdate(state(), { enabled: true, noticeSeen: true }, providers([])))
      .toEqual(state({ enabled: false, noticeSeen: true }));
  });

  it("enciende y apaga con clave", () => {
    const on = applyHealthSafetyConsentUpdate(state(), { enabled: true }, providers(["anthropic"]));
    expect(on.enabled).toBe(true);
    expect(applyHealthSafetyConsentUpdate(on, { enabled: false }, providers(["anthropic"])).enabled).toBe(false);
  });

  it("solo marcar el aviso como visto no toca el interruptor", () => {
    expect(applyHealthSafetyConsentUpdate(state({ enabled: true }), { noticeSeen: true }, providers(["openai"])))
      .toEqual(state({ enabled: true, noticeSeen: true }));
  });
});

describe("sanitizeHealthSafetyConsent", () => {
  it("apaga al borrar la última clave y lo señala", () => {
    expect(sanitizeHealthSafetyConsent(state({ enabled: true }), providers([])))
      .toEqual({ state: state({ enabled: false }), changed: true });
  });

  it("no cambia nada cuando queda alguna clave o ya estaba apagado", () => {
    const on = state({ enabled: true });
    expect(sanitizeHealthSafetyConsent(on, providers(["google"]))).toEqual({ state: on, changed: false });
    expect(sanitizeHealthSafetyConsent(state(), providers([]))).toEqual({ state: state(), changed: false });
  });
});

describe("describeHealthSafetyConsentSwitch", () => {
  it("sin clave: deshabilitado, apagado y lo dice", () => {
    expect(describeHealthSafetyConsentSwitch(state({ enabled: true }), providers([])))
      .toEqual({ enabled: false, available: false, status: "Sin clave" });
  });

  it("con clave: refleja el estado", () => {
    expect(describeHealthSafetyConsentSwitch(state(), providers(["openai"])))
      .toEqual({ enabled: false, available: true, status: "Desactivada" });
    expect(describeHealthSafetyConsentSwitch(state({ enabled: true }), providers(["openai"])))
      .toEqual({ enabled: true, available: true, status: "Activada" });
  });
});

describe("shouldEvaluateWithProvider", () => {
  it("solo evalúa con el interruptor activo y un proveedor activo con clave", () => {
    const active = { provider: "openai" as Provider, api_key: "sk-openai" };
    expect(shouldEvaluateWithProvider(state({ enabled: true }), active)).toBe(true);
    expect(shouldEvaluateWithProvider(state({ enabled: false }), active)).toBe(false);
    expect(shouldEvaluateWithProvider(state({ enabled: true }), { ...active, api_key: "" })).toBe(false);
    expect(shouldEvaluateWithProvider(state({ enabled: true }), null)).toBe(false);
  });
});

describe("propiedades", () => {
  const providerSubset = fc.uniqueArray(fc.constantFrom(...PROVIDERS));
  const storedDocument = fc.oneof(
    fc.record({
      consentVersion: fc.constantFrom(CONSENT_VERSION, "2025.01.1"),
      schemaVersion: fc.constantFrom(2, 1, undefined),
      enabled: fc.oneof(fc.boolean(), fc.constant("true")),
      noticeSeen: fc.boolean(),
    }, { requiredKeys: ["consentVersion"] }),
    fc.record({
      consentVersion: fc.constant(CONSENT_VERSION),
      providers: fc.record({ anthropic: fc.boolean(), openai: fc.boolean(), google: fc.boolean() }, { requiredKeys: [] }),
      noticeSeen: fc.record({ anthropic: fc.boolean(), openai: fc.boolean(), google: fc.boolean() }, { requiredKeys: [] }),
    }),
    fc.anything(),
  );

  it("tras normalizar nunca hay consentimiento activo sin clave", () => {
    fc.assert(fc.property(storedDocument, providerSubset, (document, configured) => {
      const normalized = normalizeHealthSafetyConsentState(document, {
        consentVersion: CONSENT_VERSION,
        configuredProviders: providers(configured),
      });
      expect(normalized.schemaVersion).toBe(HEALTH_SAFETY_CONSENT_SCHEMA_VERSION);
      expect(normalized.consentVersion).toBe(CONSENT_VERSION);
      if (configured.length === 0) expect(normalized.enabled).toBe(false);
    }));
  });

  it("ninguna secuencia de cambios y borrados de clave deja el interruptor activo sin clave", () => {
    const step = fc.oneof(
      fc.record({ kind: fc.constant("update" as const), enabled: fc.option(fc.boolean(), { nil: undefined }), noticeSeen: fc.option(fc.boolean(), { nil: undefined }) }),
      fc.record({ kind: fc.constant("keys" as const), configured: providerSubset }),
    );
    fc.assert(fc.property(providerSubset, fc.array(step, { maxLength: 25 }), (initial, steps) => {
      let configured = providers(initial);
      let current = state();
      for (const action of steps) {
        if (action.kind === "update") {
          current = applyHealthSafetyConsentUpdate(current, { enabled: action.enabled, noticeSeen: action.noticeSeen }, configured);
        } else {
          configured = providers(action.configured);
          current = sanitizeHealthSafetyConsent(current, configured).state;
        }
        const view = describeHealthSafetyConsentSwitch(current, configured);
        expect(current.enabled && configured.size === 0).toBe(false);
        expect(view.available).toBe(configured.size > 0);
        expect(view.status).toBe(!view.available ? "Sin clave" : view.enabled ? "Activada" : "Desactivada");
      }
    }));
  });
});
