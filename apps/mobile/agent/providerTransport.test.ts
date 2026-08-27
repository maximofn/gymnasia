import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeProviderResult,
  DEFAULT_GOOGLE_MODEL,
  googleApiHeaders,
  normalizeGoogleModel,
  providerCredential,
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
});
