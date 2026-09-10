import { describe, expect, it, vi } from "vitest";

vi.mock("../runtimeEnvironment", () => ({
  scopedStorageKey: (key: string) => `test:${key}`,
}));

import { catalogContentHash } from "./schemaValidation";
import {
  EXERCISE_CATALOG_V3_CACHE_KEY,
  createExerciseCatalogService,
  type ExerciseCatalogManifest,
} from "./exerciseCatalogRuntime";
import type { RawExerciseCatalogEntry } from "./types";

function rawExercise(index: number, name = `Ejercicio ${index}`): RawExerciseCatalogEntry {
  const id = `e-${String(index).padStart(3, "0")}`;
  return {
    id,
    name,
    image_male: `images/${id}-male.webp`,
    image_female: `images/${id}-female.webp`,
    muscle_group: "pierna",
    secondary_muscles: ["glúteos"],
    equipment: "peso corporal",
    difficulty: "beginner",
    instructions: `Instrucciones ${index}`,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { values.delete(key); }),
    getAllKeys: vi.fn(async () => [...values.keys()]),
  };
}

function fixture(versionSeed = "v1") {
  const entries = Array.from({ length: 31 }, (_, index) => rawExercise(index));
  entries[30] = rawExercise(30, "Cúrl remoto");
  const version = catalogContentHash({ versionSeed, entries });
  const pageValues = [entries.slice(0, 30), entries.slice(30)].map((items, page) => ({
    schemaVersion: 1 as const,
    catalogVersion: version,
    page,
    items,
  }));
  const pages = pageValues.map((value) => ({
    page: value.page,
    path: `pages/${String(value.page).padStart(4, "0")}.json`,
    count: value.items.length,
    contentHashSha256: catalogContentHash(value),
  }));
  const searchShard = {
    schemaVersion: 1 as const,
    catalogVersion: version,
    shardId: "63",
    documents: [[
      30, 1, entries[30].id, entries[30].name, entries[30].image_male,
      entries[30].image_female, entries[30].muscle_group, entries[30].secondary_muscles,
      entries[30].equipment, entries[30].difficulty,
    ]],
    postings: {
      name: { cu: [0] },
      muscle_group: {},
      secondary_muscles: {},
      equipment: {},
      difficulty: {},
    },
  };
  const directoryShard = {
    schemaVersion: 1 as const,
    catalogVersion: version,
    shardId: "65",
    records: Object.fromEntries(entries.map((entry, index) => [entry.id, [index, Math.floor(index / 30)]])),
  };
  const manifest: ExerciseCatalogManifest = {
    schemaVersion: 1,
    catalogVersion: version,
    sourceId: "gymnasia_exercises",
    itemCount: entries.length,
    pageSize: 30,
    pageCount: 2,
    staleAfterSeconds: 604800,
    pages,
    search: {
      strategy: "normalized-unigram-bigram-v1",
      fields: ["name", "muscle_group", "secondary_muscles", "equipment", "difficulty"],
      documentFields: ["ordinal", "page", "id", "name"],
      shards: [{ shardId: "63", path: "search/63.json", count: 1, contentHashSha256: catalogContentHash(searchShard) }],
    },
    directory: {
      strategy: "first-id-byte-v1",
      shards: [{ shardId: "65", path: "by-id/65.json", count: entries.length, contentHashSha256: catalogContentHash(directoryShard) }],
    },
    muscleGroups: [{ value: "pierna", normalized: "pierna", count: entries.length }],
  };
  const artifacts: Record<string, unknown> = {
    "manifest.json": manifest,
    "pages/0000.json": pageValues[0],
    "pages/0001.json": pageValues[1],
    "search/63.json": searchShard,
    "by-id/65.json": directoryShard,
  };
  return { entries, manifest, artifacts };
}

function catalogFetcher(artifacts: Record<string, unknown>, calls: string[]) {
  return vi.fn(async (url: string) => {
    const path = url.replace(/^https:\/\/catalog\.test\//, "").split("?")[0];
    calls.push(path);
    const value = artifacts[path];
    let consumed = false;
    return value
      ? {
          ok: true,
          status: 200,
          text: async () => {
            if (consumed) throw new Error("response-body-already-consumed");
            consumed = true;
            return JSON.stringify(value);
          },
        }
      : { ok: false, status: 404, text: async () => "" };
  });
}

describe("catálogo paginado de ejercicios", () => {
  it("al arrancar solo lee la caché y al abrir pide manifiesto y página cero", async () => {
    const { artifacts } = fixture();
    const calls: string[] = [];
    const service = createExerciseCatalogService({
      storage: memoryStorage(),
      fetcher: catalogFetcher(artifacts, calls),
      baseUrl: "https://catalog.test",
      now: () => Date.parse("2026-09-10T10:00:00Z"),
    });
    await service.initialize();
    expect(calls).toEqual([]);
    await service.open();
    expect(calls).toEqual(["manifest.json", "pages/0000.json"]);
    expect(calls.some((path) => path.includes("all.json"))).toBe(false);
  });

  it("con 10.000 ejercicios la apertura sigue limitada al manifiesto y la primera página", async () => {
    const base = fixture();
    const firstPage = base.artifacts["pages/0000.json"];
    const manifest = {
      ...base.manifest,
      itemCount: 10_000,
      pageCount: 334,
      pages: Array.from({ length: 334 }, (_, page) => {
        if (page === 0) return base.manifest.pages[0];
        return {
          page,
          path: `pages/${String(page).padStart(4, "0")}.json`,
          count: page === 333 ? 10 : 30,
          contentHashSha256: catalogContentHash({ page }),
        };
      }),
    } satisfies ExerciseCatalogManifest;
    const calls: string[] = [];
    const service = createExerciseCatalogService({
      storage: memoryStorage(),
      fetcher: catalogFetcher({ "manifest.json": manifest, "pages/0000.json": firstPage }, calls),
      baseUrl: "https://catalog.test",
    });
    await service.open();
    expect(calls).toEqual(["manifest.json", "pages/0000.json"]);
  });

  it("encuentra globalmente un resultado de una página no visitada y carga su ficha", async () => {
    const { artifacts } = fixture();
    const calls: string[] = [];
    const service = createExerciseCatalogService({
      storage: memoryStorage(), fetcher: catalogFetcher(artifacts, calls), baseUrl: "https://catalog.test",
    });
    await service.open();
    const found = await service.search({ query: "curl", queryFields: ["name"] });
    expect(found).toMatchObject({ globalCoverage: true, done: true });
    expect(found.items.map((item) => item.name)).toEqual(["Cúrl remoto"]);
    expect(calls).not.toContain("pages/0001.json");
    const detail = await service.getEntry(found.items[0]);
    expect(detail?.instructions).toBe("Instrucciones 30");
    expect(calls).toContain("pages/0001.json");
  });

  it("rechaza cursores de otra consulta y de otra versión", async () => {
    const { artifacts } = fixture();
    const service = createExerciseCatalogService({
      storage: memoryStorage(), fetcher: catalogFetcher(artifacts, []), baseUrl: "https://catalog.test",
    });
    await service.open();
    const first = await service.browse();
    expect(first.nextCursor).not.toBeNull();
    await expect(service.search({ query: "curl" }, first.nextCursor!)).rejects.toThrow("cursor-invalid");
    const secondFixture = fixture("v2");
    const second = createExerciseCatalogService({
      storage: memoryStorage(), fetcher: catalogFetcher(secondFixture.artifacts, []), baseUrl: "https://catalog.test",
    });
    await second.open();
    await expect(second.browse(first.nextCursor!)).rejects.toThrow("cursor-invalid");
  });

  it("deduplica fragmentos simultáneos y resuelve varios IDs por lote", async () => {
    const { artifacts } = fixture();
    const calls: string[] = [];
    const service = createExerciseCatalogService({
      storage: memoryStorage(), fetcher: catalogFetcher(artifacts, calls), baseUrl: "https://catalog.test",
    });
    await service.open();
    const [left, right] = await Promise.all([
      service.resolveByIds(["e-000", "e-030"]),
      service.resolveByIds(["e-030"]),
    ]);
    expect([...left.keys()]).toEqual(["e-000", "e-030"]);
    expect([...right.keys()]).toEqual(["e-030"]);
    expect(calls.filter((path) => path === "by-id/65.json")).toHaveLength(1);
  });

  it("resuelve desde páginas cacheadas aunque el índice por ID no esté disponible", async () => {
    const { artifacts } = fixture();
    const storage = memoryStorage();
    let offline = false;
    const fetcher = vi.fn(async (url: string) => {
      if (offline) return { ok: false, status: 503, text: async () => "" };
      const path = url.replace(/^https:\/\/catalog\.test\//, "").split("?")[0];
      const value = artifacts[path];
      return value
        ? { ok: true, status: 200, text: async () => JSON.stringify(value) }
        : { ok: false, status: 404, text: async () => "" };
    });
    const service = createExerciseCatalogService({ storage, fetcher, baseUrl: "https://catalog.test" });
    await service.open();
    offline = true;
    const resolved = await service.resolveByIds(["e-000", "e-030"]);
    expect([...resolved.keys()]).toEqual(["e-000"]);
  });

  it("migra una sola vez la caché v3 completa cuando la red falla", async () => {
    const entries = [rawExercise(0), rawExercise(1)];
    const storage = memoryStorage({
      [EXERCISE_CATALOG_V3_CACHE_KEY]: JSON.stringify({ data: entries, sourceId: "gymnasia_exercises" }),
    });
    const fetcher = vi.fn(async () => ({ ok: false, status: 503, text: async () => "" }));
    const service = createExerciseCatalogService({ storage, fetcher, baseUrl: "https://catalog.test" });
    const state = await service.open();
    expect(state).toMatchObject({ availability: "stale", manifest: { itemCount: 2, localMigration: true } });
    const result = await service.search({ query: "ejercicio 1", queryFields: ["name"] });
    expect(result).toMatchObject({ globalCoverage: true, cachedResults: true });
    expect(result.items.map((item) => item.id)).toEqual(["e-001"]);
    expect(storage.values.has(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(true);
  });

  it("conserva la versión comprobada si la publicación nueva está corrupta", async () => {
    const stable = fixture();
    const storage = memoryStorage();
    const first = createExerciseCatalogService({
      storage, fetcher: catalogFetcher(stable.artifacts, []), baseUrl: "https://catalog.test",
    });
    await first.open();
    const corrupt = fixture("v2");
    corrupt.artifacts["pages/0000.json"] = { broken: true };
    const second = createExerciseCatalogService({
      storage, fetcher: catalogFetcher(corrupt.artifacts, []), baseUrl: "https://catalog.test",
    });
    await second.initialize();
    const state = await second.open();
    expect(state.manifest?.catalogVersion).toBe(stable.manifest.catalogVersion);
    expect(state.warning).toBe("remote_failed");
  });

  it("conserva solo la versión activa y la anterior en la caché de artefactos", async () => {
    const storage = memoryStorage();
    let current = fixture("retention-v1").artifacts;
    const fetcher = vi.fn(async (url: string) => {
      const path = url.replace(/^https:\/\/catalog\.test\//, "").split("?")[0];
      const value = current[path];
      return value
        ? { ok: true, status: 200, text: async () => JSON.stringify(value) }
        : { ok: false, status: 404, text: async () => "" };
    });
    const service = createExerciseCatalogService({ storage, fetcher, baseUrl: "https://catalog.test" });
    const versions: string[] = [];
    for (const seed of ["retention-v1", "retention-v2", "retention-v3"]) {
      const next = fixture(seed);
      current = next.artifacts;
      versions.push(next.manifest.catalogVersion);
      await service.open();
    }
    const artifactKeys = [...storage.values.keys()].filter((key) => key.includes(":artifact:"));
    expect(artifactKeys.some((key) => key.includes(versions[0]))).toBe(false);
    expect(artifactKeys.some((key) => key.includes(versions[1]))).toBe(true);
    expect(artifactKeys.some((key) => key.includes(versions[2]))).toBe(true);
  });
});
