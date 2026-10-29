import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { artifactRelativePath, utf8ByteLength } from "../catalogCache";
import { createBoundedCatalogArtifacts, type ArtifactBackend } from "./catalogArtifactStorage";

const prefix = "test:artifact:";
const key = (index: number) => `${prefix}sha256:${"a".repeat(64)}:pages/${String(index).padStart(4, "0")}.json`;
function backend() {
  const values = new Map<string, string>();
  const port: ArtifactBackend = {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => { values.set(key, value); },
    remove: async (key) => { values.delete(key); },
    list: async () => [...values].map(([key, value]) => ({ key, bytes: utf8ByteLength(value) })),
    clear: async () => { values.clear(); },
    measure: async () => ({ entries: values.size, bytes: [...values.values()].reduce((sum, value) => sum + utf8ByteLength(value), 0) }),
  };
  return { values, port };
}

describe("bounded public catalog cache", () => {
  it("never exceeds its budget under concurrent writes, replacements and UTF-8 input", async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.string({ maxLength: 70 }), { maxLength: 35 }), async (values) => {
      const store = backend();
      const cache = createBoundedCatalogArtifacts(store.port, prefix, 128);
      await Promise.allSettled(values.map((value, index) => cache.setItem(key(index % 5), value)));
      const usage = await cache.measure();
      expect(usage.bytes).toBeLessThanOrEqual(128);
      for (const [id, value] of store.values) expect(await cache.getItem(id)).toBe(value);
    }));
  });

  it("retains offline pages when full and clear waits for already accepted writes", async () => {
    const store = backend();
    const cache = createBoundedCatalogArtifacts(store.port, prefix, 5);
    await cache.setItem(key(0), "12345");
    await expect(cache.setItem(key(1), "6")).rejects.toThrow();
    expect(await cache.getItem(key(0))).toBe("12345");
    await Promise.all([cache.setItem(key(0), "abc"), cache.clear()]);
    expect(await cache.measure()).toMatchObject({ bytes: 0, entries: 0 });
  });

  it("recounts allocated files after an ambiguous write failure", async () => {
    const store = backend();
    const original = store.port.put;
    store.port.put = async (key, value) => { await original(key, value); throw new Error("readback unavailable"); };
    const cache = createBoundedCatalogArtifacts(store.port, prefix, 5);
    await expect(cache.setItem(key(0), "12345")).rejects.toThrow();
    store.port.put = original;
    await expect(cache.setItem(key(1), "6")).rejects.toThrow();
    expect(await cache.getItem(key(0))).toBe("12345");
  });

  it("rejects personal keys and path traversal before accessing a backend", async () => {
    for (const candidate of ["gymnasia.mobile.local.v3", `${prefix}sha256:${"a".repeat(64)}:../secret`, `${key(0)}/../../secret`]) {
      expect(() => artifactRelativePath(candidate, prefix)).toThrow();
    }
    const store = backend();
    await expect(createBoundedCatalogArtifacts(store.port, prefix).setItem(key(0), "a".repeat(2 * 1024 * 1024 + 1))).rejects.toThrow();
    expect(store.values.size).toBe(0);
  });
});
