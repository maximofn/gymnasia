import { describe, expect, it, vi } from "vitest";

import {
  createFakeProviderResult,
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
});
