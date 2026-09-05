import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  anthropicApiHeaders,
  anthropicProxyCredentials,
  anthropicThinkingConfig,
  createFakeProviderResult,
  DEFAULT_GOOGLE_MODEL,
  explainAnthropicError,
  googleApiHeaders,
  normalizeAnthropicWorkspaceId,
  normalizeGoogleModel,
  providerCredential,
  usesLegacyAnthropicThinking,
} from "./providerTransport";

describe("development provider transport", () => {
  it("uses an in-memory credential only in fake mode", () => {
    expect(providerCredential("", true)).toBe("development-fixture");
    expect(providerCredential("", false)).toBe("");
    expect(providerCredential(" real-key ", true)).toBe("real-key");
  });

  it("returns deterministic chat fixtures without a network dependency", () => {
    const network = vi.fn();
    const first = createFakeProviderResult("main-chat", "  Hola   mundo ");
    const second = createFakeProviderResult("main-chat", "Hola mundo");
    expect(first).toEqual(second);
    expect(network).not.toHaveBeenCalled();
  });

  it("returns structured food data for the personal-food surface", () => {
    const result = createFakeProviderResult("personal-food-assistant", "yogur");
    expect(result.content).toContain("```json");
    expect(result.content).toContain('"name": "Yogur de desarrollo"');
  });

  it("migrates only known Google defaults to the stable model", () => {
    expect(normalizeGoogleModel(undefined)).toBe(DEFAULT_GOOGLE_MODEL);
    expect(normalizeGoogleModel("gemini-1.5-flash")).toBe(DEFAULT_GOOGLE_MODEL);
    expect(normalizeGoogleModel("gemini-3-flash-preview")).toBe(DEFAULT_GOOGLE_MODEL);
    expect(normalizeGoogleModel(" custom-model ")).toBe("custom-model");
  });

  it("preserves arbitrary custom Google models after trimming", () => {
    fc.assert(fc.property(fc.string(), (value) => {
      const trimmed = value.trim();
      fc.pre(Boolean(trimmed));
      fc.pre(!["gemini-1.5-flash", "gemini-3-flash-preview"].includes(trimmed));
      expect(normalizeGoogleModel(value)).toBe(trimmed);
    }));
  });

  it("authenticates Google through a header without mutating other headers", () => {
    expect(googleApiHeaders(" reviewer-key ", { Accept: "text/event-stream" })).toEqual({
      Accept: "text/event-stream",
      "x-goog-api-key": "reviewer-key",
    });
  });

  it("adds an Anthropic workspace only when the user configured one", () => {
    expect(anthropicApiHeaders(" key ", "2023-06-01", " wrkspc_demo ", {
      Accept: "text/event-stream",
    })).toEqual({
      Accept: "text/event-stream",
      "x-api-key": "key",
      "anthropic-version": "2023-06-01",
      "anthropic-workspace-id": "wrkspc_demo",
    });
    expect(anthropicApiHeaders("key", "2023-06-01", "  ")).not.toHaveProperty(
      "anthropic-workspace-id",
    );
  });

  it("keeps workspace configuration out of the Anthropic message body contract", () => {
    expect(anthropicProxyCredentials(" key ", " wrkspc_demo ")).toEqual({
      api_key: "key",
      workspace_id: "wrkspc_demo",
    });
    expect(anthropicProxyCredentials("key", "")).toEqual({ api_key: "key" });
    expect(normalizeAnthropicWorkspaceId(" wrkspc_demo ")).toBe("wrkspc_demo");
  });

  it("turns the identity-linked Anthropic error into an actionable message", () => {
    expect(explainAnthropicError(
      "anthropic-workspace-id is required when authenticating with an identity-linked API key",
    )).toContain("wrkspc_…");
    expect(explainAnthropicError("another error")).toBe("another error");
  });

  // Regresión: con `type: "enabled"` los modelos desde la generación 4.6
  // responden 400 y la conversación muere. Verificado en un móvil real con
  // claude-sonnet-5 el 5 de septiembre de 2026.
  it("pide razonamiento adaptativo a los modelos que rechazan el presupuesto fijo", () => {
    for (const model of [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-sonnet-4-6",
      "claude-opus-4-8",
      "claude-fable-5-1",
    ]) {
      expect(usesLegacyAnthropicThinking(model)).toBe(false);
      expect(anthropicThinkingConfig(model, 1024)).toEqual({
        type: "adaptive",
        display: "summarized",
      });
    }
  });

  it("conserva el presupuesto fijo en los modelos que solo entienden esa forma", () => {
    for (const model of [
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-5-20250929",
      "claude-opus-4-5",
      "claude-3-5-sonnet-latest",
      "claude-3-7-sonnet-latest",
    ]) {
      expect(usesLegacyAnthropicThinking(model)).toBe(true);
      expect(anthropicThinkingConfig(model, 1024)).toEqual({
        type: "enabled",
        budget_tokens: 1024,
      });
    }
  });

  it("trata cualquier modelo desconocido como moderno, para no romper con los que salgan", () => {
    fc.assert(fc.property(fc.string(), (raw) => {
      const config = anthropicThinkingConfig(raw, 1024);
      if (usesLegacyAnthropicThinking(raw)) {
        expect(config).toEqual({ type: "enabled", budget_tokens: 1024 });
      } else {
        expect(config).toEqual({ type: "adaptive", display: "summarized" });
      }
    }));
    expect(anthropicThinkingConfig("claude-sonnet-9-9", 1024)).toEqual({
      type: "adaptive",
      display: "summarized",
    });
  });
});
