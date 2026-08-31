import { describe, expect, it } from "vitest";

import {
  createDefaultProviderConfigurations,
  type ProviderConfiguration,
} from "./providerConfiguration";
import {
  ProviderConfigurationRepository,
  type AsyncKeyValueStorage,
  type SecureKeyValueStorage,
} from "./providerConfigurationPersistence";

class MemoryAsyncStorage implements AsyncKeyValueStorage {
  readonly values = new Map<string, string>();
  failSetAt: number | null = null;
  setCount = 0;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.setCount += 1;
    if (this.failSetAt === this.setCount) throw new Error("async write failed");
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class MemorySecureStorage implements SecureKeyValueStorage {
  readonly values = new Map<string, string>();
  failSetAt: number | null = null;
  setCount = 0;

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.setCount += 1;
    if (this.failSetAt === this.setCount) throw new Error("secure write failed");
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const ASYNC_KEY = "provider.configuration";
const SECURE_KEY = "provider.configuration.secure";

function withApiKey(
  values: readonly ProviderConfiguration[],
  provider: ProviderConfiguration["provider"],
  apiKey: string,
): ProviderConfiguration[] {
  return values.map((item) => item.provider === provider
    ? { ...item, api_key: apiKey }
    : item);
}

describe("provider configuration repository", () => {
  it("migrates legacy keys once and restores the committed snapshot", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const legacy = withApiKey(createDefaultProviderConfigurations(), "openai", "legacy-secret");
    const first = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });

    const migrated = await first.hydrate(legacy);
    expect(migrated.migrated).toBe(true);
    expect(migrated.snapshot.keys[0].api_key).toBe("legacy-secret");

    const second = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });
    const restored = await second.hydrate(createDefaultProviderConfigurations());
    expect(restored.migrated).toBe(false);
    expect(restored.snapshot).toEqual(migrated.snapshot);
  });

  it("stores web credentials in its dedicated AsyncStorage journal", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });
    const initial = await repository.hydrate(createDefaultProviderConfigurations());
    await repository.commit(withApiKey(initial.snapshot.keys, "google", "web-secret"));

    expect(asyncStorage.values.get(ASYNC_KEY)).toContain("web-secret");
  });

  it("keeps native credentials only in SecureStore", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const secureStorage = new MemorySecureStorage();
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
      secureStorage,
      secureStorageKey: SECURE_KEY,
    });
    const initial = await repository.hydrate(createDefaultProviderConfigurations());
    await repository.commit(withApiKey(initial.snapshot.keys, "anthropic", "native-secret"));

    expect(asyncStorage.values.get(ASYNC_KEY)).not.toContain("native-secret");
    expect(secureStorage.values.get(SECURE_KEY)).toContain("native-secret");
  });

  it("keeps the previous commit when the final secure write fails", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const secureStorage = new MemorySecureStorage();
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
      secureStorage,
      secureStorageKey: SECURE_KEY,
    });
    const initial = await repository.hydrate(
      withApiKey(createDefaultProviderConfigurations(), "openai", "old-secret"),
    );
    // hydrate performs one secure write; commit writes pending, then final.
    secureStorage.failSetAt = secureStorage.setCount + 2;

    await expect(repository.commit(
      withApiKey(initial.snapshot.keys, "openai", "new-secret"),
    )).rejects.toThrow("secure write failed");
    expect(repository.getCurrent()?.keys[0].api_key).toBe("old-secret");

    const recovered = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
      secureStorage,
      secureStorageKey: SECURE_KEY,
    });
    const hydration = await recovered.hydrate(createDefaultProviderConfigurations());
    expect(hydration.snapshot.keys[0].api_key).toBe("old-secret");
  });

  it("rolls back an invalidated write instead of promoting its pending value", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });
    const initial = await repository.hydrate(createDefaultProviderConfigurations());
    let current = true;
    const originalSet = asyncStorage.setItem.bind(asyncStorage);
    asyncStorage.setItem = async (key, value) => {
      await originalSet(key, value);
      const journal = JSON.parse(value) as { pending?: unknown };
      if (journal.pending) current = false;
    };

    const result = await repository.commit(
      withApiKey(initial.snapshot.keys, "google", "stale-secret"),
      () => current,
    );

    expect(result.status).toBe("stale");
    expect(repository.getCurrent()).toEqual(initial.snapshot);
    expect(asyncStorage.values.get(ASYNC_KEY)).not.toContain("stale-secret");
  });

  it("serializes concurrent updates without losing changes to other providers", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });
    await repository.hydrate(createDefaultProviderConfigurations());

    await Promise.all([
      repository.commit((current) => withApiKey(current, "openai", "openai-secret")),
      repository.commit((current) => withApiKey(current, "google", "google-secret")),
    ]);

    expect(repository.getCurrent()?.keys).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "openai", api_key: "openai-secret" }),
      expect.objectContaining({ provider: "google", api_key: "google-secret" }),
    ]));
  });

  it("discards a pending-only journal after restart", async () => {
    const asyncStorage = new MemoryAsyncStorage();
    const pending = {
      schemaVersion: 1,
      revision: 7,
      keys: withApiKey(createDefaultProviderConfigurations(), "openai", "pending-secret"),
    };
    asyncStorage.values.set(ASYNC_KEY, JSON.stringify({
      schemaVersion: 1,
      committed: null,
      pending,
    }));
    const repository = new ProviderConfigurationRepository({
      asyncStorage,
      asyncStorageKey: ASYNC_KEY,
    });

    const result = await repository.hydrate(createDefaultProviderConfigurations());
    expect(result.snapshot.revision).toBe(0);
    expect(result.snapshot.keys.some((item) => item.api_key === "pending-secret")).toBe(false);
  });
});
