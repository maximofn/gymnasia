import { describe, expect, it } from "vitest";

import {
  createActivityResetStore,
  createInitialStore,
  mergeStoreWithSecureApiKeys,
  serializeStoreForAsyncStorage,
} from "./localStoreModel";

const runtime = {
  now: () => Date.parse("2026-09-12T10:00:00.000Z"),
  createId: (prefix: string) => `${prefix}-fixed`,
};

describe("local store model", () => {
  it("creates the same local-first aggregate shape", () => {
    const store = createInitialStore(runtime);
    expect(store.threads).toEqual([{ id: "thread-fixed", title: "Gymnasia Coach 1" }]);
    expect(store.messagesByThread["thread-fixed"]).toHaveLength(1);
    expect(store.templates).toEqual([]);
    expect(store.measurements).toEqual([]);
  });

  it("keeps credentials out of the general aggregate serialization", () => {
    const store = createInitialStore(runtime);
    store.keys[0] = { ...store.keys[0], api_key: "secret" };
    expect(serializeStoreForAsyncStorage(store).keys[0].api_key).toBe("");
    expect(
      mergeStoreWithSecureApiKeys(store, {
        openai: "secure-secret",
        anthropic: "",
        google: "",
      }).keys[0].api_key,
    ).toBe("secure-secret");
  });

  it("resets activity while retaining preferences and provider selection", () => {
    const store = createInitialStore(runtime);
    store.dietSettings.daily_calories = "2200";
    store.chatProvider = "anthropic";
    const reset = createActivityResetStore(store, runtime);
    expect(reset.dietSettings.daily_calories).toBe("2200");
    expect(reset.chatProvider).toBe("anthropic");
    expect(reset.workoutHistory).toEqual([]);
  });
});
