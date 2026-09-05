import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  maskApiKey,
  readProviderApiKeys,
  stripProviderApiKeys,
  type SecureCredentialStore,
  writeProviderApiKeys,
} from "./providerCredentials";

class MemorySecureStore implements SecureCredentialStore {
  readonly values = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const providers = ["openai", "anthropic", "google"] as const;
const storageKey = (provider: (typeof providers)[number]) => `provider.${provider}`;

describe("provider credentials", () => {
  it("masks credentials without returning the original secret", () => {
    expect(maskApiKey("  abcd123456wxyz  ")).toBe("abcd...wxyz");
    expect(maskApiKey("short")).toBe("sh***");
    expect(maskApiKey("   ")).toBe("Sin API key");
  });

  it("never returns a non-empty credential unchanged", () => {
    fc.assert(fc.property(fc.string({ minLength: 1 }), (value) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      expect(maskApiKey(value)).not.toBe(trimmed);
    }));
  });

  it("removes provider keys before native AsyncStorage serialization", () => {
    const store = {
      keys: [
        { provider: "google", api_key: "secret", model: "gemini-3.8-flash" },
      ],
      threads: [{ id: "thread-1" }],
    };

    const sanitized = stripProviderApiKeys(store);
    expect(sanitized.keys[0]).toEqual({
      provider: "google",
      api_key: "",
      model: "gemini-3.8-flash",
    });
    expect(sanitized.threads).toEqual(store.threads);
    expect(store.keys[0].api_key).toBe("secret");
  });

  it("reads, trims, rotates and deletes credentials in SecureStore", async () => {
    const storage = new MemorySecureStore();
    storage.values.set("provider.google", " first-key ");

    expect(await readProviderApiKeys(storage, providers, storageKey)).toEqual({
      openai: "",
      anthropic: "",
      google: "first-key",
    });

    await writeProviderApiKeys(
      storage,
      [{ provider: "google", api_key: " second-key " }] as const,
      storageKey,
    );
    expect(storage.values.get("provider.google")).toBe("second-key");

    await writeProviderApiKeys(
      storage,
      [{ provider: "google", api_key: "   " }] as const,
      storageKey,
    );
    expect(storage.values.has("provider.google")).toBe(false);
  });
});
