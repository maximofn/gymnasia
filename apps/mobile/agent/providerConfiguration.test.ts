import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  applyProviderCandidate,
  beginProviderDiscovery,
  beginProviderSave,
  createDefaultProviderConfigurations,
  createProviderOperationMap,
  editProviderOperation,
  getSupportedOpenAIReasoningEfforts,
  isProviderDiscoveryCurrent,
  isProviderSaveCurrent,
  normalizeOpenAIReasoningEffort,
  normalizeProviderConfigurations,
  normalizeProviderModel,
} from "./providerConfiguration";

describe("provider configuration state", () => {
  it("normalizes legacy models and keeps exactly one active provider", () => {
    const normalized = normalizeProviderConfigurations([
      {
        provider: "openai",
        is_active: true,
        api_key: " key-one ",
        model: "gpt-4o-mini",
      },
      {
        provider: "google",
        is_active: true,
        api_key: " key-two ",
        model: "gemini-1.5-flash",
      },
    ]);

    expect(normalized.filter((item) => item.is_active)).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      provider: "openai",
      api_key: "key-one",
      model: "gpt-5-mini",
      is_active: true,
    });
    expect(normalized[2]).toMatchObject({
      provider: "google",
      api_key: "key-two",
      is_active: false,
    });
  });

  it("normalizes reasoning effort against the selected OpenAI model", () => {
    expect(getSupportedOpenAIReasoningEfforts("gpt-5.4-pro")).toEqual([
      "medium",
      "high",
      "xhigh",
    ]);
    expect(normalizeOpenAIReasoningEffort("minimal", "gpt-5.4-pro")).toBe("medium");
    expect(normalizeOpenAIReasoningEffort("high", "gpt-5-pro")).toBe("high");
    expect(normalizeOpenAIReasoningEffort("high", "gpt-4.1")).toBeNull();
  });

  it("invalidates a save when its draft changes", () => {
    let state = createProviderOperationMap();
    const first = beginProviderSave(state, "openai", true);
    state = first.state;
    expect(isProviderSaveCurrent(state, first.token)).toBe(true);

    state = editProviderOperation(state, "openai");
    expect(isProviderSaveCurrent(state, first.token)).toBe(false);

    const second = beginProviderSave(state, "openai", true);
    state = second.state;
    expect(isProviderSaveCurrent(state, first.token)).toBe(false);
    expect(isProviderSaveCurrent(state, second.token)).toBe(true);
  });

  it("invalidates a provider save after a newer global configuration mutation", () => {
    const state = createProviderOperationMap();
    const started = beginProviderSave(state, "google", true, 4);

    expect(isProviderSaveCurrent(started.state, started.token, 4)).toBe(true);
    expect(isProviderSaveCurrent(started.state, started.token, 5)).toBe(false);
  });

  it("invalidates model discovery on edits and newer discoveries", () => {
    let state = createProviderOperationMap();
    const first = beginProviderDiscovery(state, "anthropic");
    state = first.state;
    expect(isProviderDiscoveryCurrent(state, first.token)).toBe(true);

    const second = beginProviderDiscovery(state, "anthropic");
    state = second.state;
    expect(isProviderDiscoveryCurrent(state, first.token)).toBe(false);
    expect(isProviderDiscoveryCurrent(state, second.token)).toBe(true);

    state = editProviderOperation(state, "anthropic");
    expect(isProviderDiscoveryCurrent(state, second.token)).toBe(false);
  });

  it("can update a non-active provider without changing the active selection", () => {
    const initial = createDefaultProviderConfigurations();
    const google = {
      ...initial.find((item) => item.provider === "google")!,
      api_key: "google-key",
    };
    const updated = applyProviderCandidate(initial, google, false);

    expect(updated.find((item) => item.provider === "openai")?.is_active).toBe(true);
    expect(updated.find((item) => item.provider === "google")).toMatchObject({
      api_key: "google-key",
      is_active: false,
    });
  });

  it("never accepts a save token after any positive number of edits", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (editCount) => {
      let state = createProviderOperationMap();
      const started = beginProviderSave(state, "google", true);
      state = started.state;
      for (let index = 0; index < editCount; index += 1) {
        state = editProviderOperation(state, "google");
      }
      expect(isProviderSaveCurrent(state, started.token)).toBe(false);
    }));
  });

  it("preserves arbitrary trimmed custom provider models", () => {
    fc.assert(fc.property(fc.string(), (raw) => {
      const trimmed = raw.trim();
      fc.pre(Boolean(trimmed));
      fc.pre(trimmed !== "gpt-4o-mini");
      expect(normalizeProviderModel("openai", raw)).toBe(trimmed);
    }));
  });
});
