import { describe, expect, it, vi } from "vitest";

import { catalogContentHash, parseFoodCatalog } from "./schemaValidation";
import {
  aggregateCatalogAvailability,
  initialCatalogSnapshot,
  readCatalogCache,
  refreshCatalog,
  type CatalogDefinition,
} from "./runtime";
import { CATALOG_STALE_AFTER_MS, type FoodCatalogEntry } from "./types";

const definition: CatalogDefinition<FoodCatalogEntry> = {
  sourceId: "gymnasia_foods",
  label: "Alimentos",
  url: "https://example.test/alimentos/all.json",
  cacheKey: "foods.v2",
  legacyCacheKey: "foods.v1",
  provenance: { repositoryUrl: "https://example.test/repo", catalogPath: "alimentos" },
  parse: (value) => parseFoodCatalog(Array.isArray(value) ? value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const { sourceId: _sourceId, source: _source, ...raw } = entry as Record<string, unknown>;
    return raw;
  }) : value)?.map((entry) => ({ ...entry, sourceId: "gymnasia_foods", source: "alimento" })) ?? null,
};
const rawFood = {
  id: "arroz-blanco", name: "Arroz blanco", category: "cereal",
  calories_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28,
  fat_per_100g: 0.3, fiber_per_100g: 0.4, serving_size_g: 100,
  serving_description: "100 g",
};

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
}

describe("runtime de caché de catálogos", () => {
  it("migra el array antiguo como stale y conserva la clave anterior", async () => {
    const storage = memoryStorage({ [definition.legacyCacheKey]: JSON.stringify([rawFood]) });
    const snapshot = await readCatalogCache(definition, {
      storage, fetcher: vi.fn(), now: () => Date.parse("2026-09-03T10:00:00Z"),
    });
    expect(snapshot.availability).toBe("stale");
    expect(snapshot.fetchedAt).toBeNull();
    expect(storage.values.has(definition.legacyCacheKey)).toBe(true);
    expect(JSON.parse(storage.values.get(definition.cacheKey)!).sourceId).toBe("gymnasia_foods");
  });

  it("aplica el límite exacto de siete días", async () => {
    const data = definition.parse([rawFood]) as FoodCatalogEntry[];
    const now = Date.parse("2026-09-08T00:00:00Z");
    const envelope = (fetchedAt: string) => JSON.stringify({
      schemaVersion: 1, sourceId: definition.sourceId, fetchedAt,
      contentHashSha256: catalogContentHash(data), etag: null,
      provenance: definition.provenance, data,
    });
    const exact = await readCatalogCache(definition, {
      storage: memoryStorage({ [definition.cacheKey]: envelope(new Date(now - CATALOG_STALE_AFTER_MS).toISOString()) }),
      fetcher: vi.fn(), now: () => now,
    });
    const old = await readCatalogCache(definition, {
      storage: memoryStorage({ [definition.cacheKey]: envelope(new Date(now - CATALOG_STALE_AFTER_MS - 1).toISOString()) }),
      fetcher: vi.fn(), now: () => now,
    });
    expect(exact.availability).toBe("cached");
    expect(old.availability).toBe("stale");
  });

  it("rechaza hashes manipulados, metadatos inválidos y sobres futuros", async () => {
    const data = definition.parse([rawFood])!;
    const base = { schemaVersion: 1, sourceId: definition.sourceId, fetchedAt: "2026-09-03T00:00:00Z", contentHashSha256: catalogContentHash(data), etag: null, provenance: definition.provenance, data };
    for (const value of [
      { ...base, contentHashSha256: "sha256:bad" },
      { ...base, schemaVersion: 2 },
      { ...base, etag: 42 },
      { ...base, provenance: { repositoryUrl: 42 } },
    ]) {
      const snapshot = await readCatalogCache(definition, {
        storage: memoryStorage({ [definition.cacheKey]: JSON.stringify(value) }), fetcher: vi.fn(),
      });
      expect(snapshot.availability).toBe("unavailable");
      expect(snapshot.warning).toBe("cache_invalid");
    }
  });

  it("no oculta una caché actual corrupta recuperando silenciosamente la clave antigua", async () => {
    const data = definition.parse([rawFood])!;
    const corrupt = {
      schemaVersion: 1,
      sourceId: definition.sourceId,
      fetchedAt: "2026-09-03T00:00:00Z",
      contentHashSha256: "sha256:bad",
      data,
    };
    const snapshot = await readCatalogCache(definition, {
      storage: memoryStorage({
        [definition.cacheKey]: JSON.stringify(corrupt),
        [definition.legacyCacheKey]: JSON.stringify([rawFood]),
      }),
      fetcher: vi.fn(),
    });
    expect(snapshot).toMatchObject({ availability: "unavailable", warning: "cache_invalid", data: [] });
  });

  it("usa datos frescos durante la sesión aunque falle su escritura offline", async () => {
    const storage = memoryStorage();
    storage.setItem.mockRejectedValueOnce(new Error("sin espacio"));
    const snapshot = await refreshCatalog(definition, initialCatalogSnapshot(definition), {
      storage,
      fetcher: async () => ({ ok: true, status: 200, text: async () => JSON.stringify([rawFood]), headers: { get: () => '"etag"' } }),
      now: () => Date.parse("2026-09-03T10:00:00Z"),
    });
    expect(snapshot.availability).toBe("fresh");
    expect(snapshot.cachePersisted).toBe(false);
    expect(snapshot.warning).toBe("cache_write_failed");
  });

  it("espera a que termine la escritura de caché antes de completar el refresco", async () => {
    let releaseWrite = () => {};
    const writePending = new Promise<void>((resolve) => { releaseWrite = resolve; });
    const storage = memoryStorage();
    storage.setItem.mockImplementationOnce(async () => writePending);
    let completed = false;
    const refresh = refreshCatalog(definition, initialCatalogSnapshot(definition), {
      storage,
      fetcher: async () => ({ ok: true, status: 200, text: async () => JSON.stringify([rawFood]) }),
    }).then((snapshot) => {
      completed = true;
      return snapshot;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(completed).toBe(false);
    releaseWrite();
    await expect(refresh).resolves.toMatchObject({ availability: "fresh", cachePersisted: true });
  });

  it("degrada fresh a cached si un refresco posterior falla", async () => {
    const previous = {
      ...initialCatalogSnapshot(definition),
      availability: "fresh" as const,
      fetchedAt: "2026-09-03T09:00:00.000Z",
      data: definition.parse([rawFood])!,
    };
    const snapshot = await refreshCatalog(definition, previous, {
      storage: memoryStorage(),
      fetcher: async () => ({ ok: false, status: 503, text: async () => "" }),
      now: () => Date.parse("2026-09-03T10:00:00Z"),
    });
    expect(snapshot.availability).toBe("cached");
    expect(snapshot.warning).toBe("remote_failed");
  });

  it("conserva el aviso de escritura offline si también falla el siguiente refresco", async () => {
    const previous = {
      ...initialCatalogSnapshot(definition),
      availability: "fresh" as const,
      fetchedAt: "2026-09-03T09:00:00.000Z",
      data: definition.parse([rawFood])!,
      warning: "cache_write_failed" as const,
    };
    const snapshot = await refreshCatalog(definition, previous, {
      storage: memoryStorage(),
      fetcher: async () => ({ ok: false, status: 503, text: async () => "" }),
      now: () => Date.parse("2026-09-03T10:00:00Z"),
    });
    expect(snapshot.warning).toBe("cache_write_failed");
  });

  it("calcula partial para fuentes con distinta disponibilidad", () => {
    const fresh = { ...initialCatalogSnapshot(definition), availability: "fresh" as const };
    const cached = { ...initialCatalogSnapshot(definition), availability: "cached" as const };
    expect(aggregateCatalogAvailability([fresh, cached])).toBe("partial");
    expect(aggregateCatalogAvailability([fresh, fresh])).toBe("fresh");
    expect(aggregateCatalogAvailability([])).toBe("unavailable");
  });

  it("agrega de forma determinista todas las combinaciones de disponibilidad", () => {
    const states = ["fresh", "cached", "stale", "unavailable"] as const;
    for (const left of states) {
      for (const right of states) {
        const snapshots = [left, right].map((availability) => ({
          ...initialCatalogSnapshot(definition),
          availability,
        }));
        expect(aggregateCatalogAvailability(snapshots)).toBe(left === right ? left : "partial");
      }
    }
  });
});
