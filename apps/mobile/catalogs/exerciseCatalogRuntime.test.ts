import { describe, expect, it, vi } from "vitest";

vi.mock("../runtimeEnvironment", () => ({
  scopedStorageKey: (key: string) => `test:${key}`,
}));

import { catalogContentHash } from "./schemaValidation";
import {
  EXERCISE_CATALOG_V3_CACHE_KEY,
  EXERCISE_CATALOG_V2_CACHE_KEY,
  EXERCISE_CATALOG_V4_CACHE_KEY,
  createExerciseCatalogService,
  type ExerciseCatalogManifest,
} from "./exerciseCatalogRuntime";
import type { RawExerciseCatalogEntry } from "./types";
import { measureStorageUsage, utf8ByteLength } from "../storage/storageUsage";

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
    expect(storage.values.has(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(false);
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

  it("incluye en el diagnóstico las páginas e índices que realmente escribe el catálogo", async () => {
    const data = fixture();
    const storage = memoryStorage();
    const service = createExerciseCatalogService({
      storage, fetcher: catalogFetcher(data.artifacts, []), baseUrl: "https://catalog.test",
    });
    await service.open();
    await service.search({ query: "curl", queryFields: ["name"] });
    await service.resolveByIds(["e-030"]);
    const before = new Map(storage.values);
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    const report = await measureStorageUsage({ storage,
      scopedKey: (key) => `test:${key}`, belongsToActiveNamespace: (key) => key.startsWith("test:"),
      measurePhotos: async () => ({ bytes: null, fileCount: null, availableDiskBytes: null }),
    });
    expect(report.unknownEntries).toBe(0);
    expect(report.measuredEntries).toBe(before.size);
    expect(report.valueBytes).toBe([...before.values()].reduce((sum, value) => sum + utf8ByteLength(value), 0));
    expect(report.catalogSections.map((row) => row.id)).toEqual(expect.arrayContaining(["pages", "search", "directory", "metadata"]));
    expect(storage.values).toEqual(before);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});


describe("migración verificada a caché separada", () => {
  const offline = async () => ({ ok: false, status: 503, text: async () => "" });
  const legacy = (entries: RawExerciseCatalogEntry[]) => JSON.stringify({ data: entries, sourceId: "gymnasia_exercises" });
  it("mueve páginas, búsquedas e índices existentes y conserva todo al reiniciar offline", async () => {
    const data = fixture();
    const storage = memoryStorage();
    const first = createExerciseCatalogService({ storage, fetcher: catalogFetcher(data.artifacts, []), baseUrl: "https://catalog.test" });
    await first.open(); await first.search({ query: "curl" }); await first.resolveByIds(["e-030"]);
    storage.values.set("private-history", "must not read or change");
    const artifacts = memoryStorage();
    const service = createExerciseCatalogService({ storage, artifacts, fetcher: offline });
    await service.initialize();
    expect(artifacts.values.size).toBe(4);
    expect([...storage.values.keys()].some((key) => key.includes(":artifact:"))).toBe(false);
    expect(storage.values.get("private-history")).toBe("must not read or change");
    expect(storage.getItem).not.toHaveBeenCalledWith("private-history");
    const restarted = createExerciseCatalogService({ storage, artifacts, fetcher: offline });
    await restarted.initialize();
    expect((await restarted.search({ query: "curl" })).items[0].id).toBe("e-030");
    expect((await restarted.resolveCachedByIds(["e-030"])).get("e-030")?.instructions).toBe("Instrucciones 30");
  });

  it("retira v2 y v3 solo tras guardar todas las páginas y conserva IDs antiguos entre versiones remotas", async () => {
    const storage = memoryStorage({
      [EXERCISE_CATALOG_V2_CACHE_KEY]: legacy([rawExercise(99, "Cúrl antiguo 99")]),
      [EXERCISE_CATALOG_V3_CACHE_KEY]: legacy(Array.from({ length: 61 }, (_, index) => rawExercise(index))),
    });
    const artifacts = memoryStorage();
    let data = fixture("first");
    const fetcher = async (url: string) => catalogFetcher(data.artifacts, [])(url);
    const service = createExerciseCatalogService({ storage, artifacts, fetcher, baseUrl: "https://catalog.test" });
    await service.initialize();
    expect(storage.values.has(EXERCISE_CATALOG_V2_CACHE_KEY)).toBe(false);
    expect(storage.values.has(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(false);
    expect((await service.search({ query: "ejercicio" }, undefined, 30)).nextCursor).not.toBeNull();
    for (const seed of ["first", "second", "third"]) { data = fixture(seed); await service.open(); }
    const restarted = createExerciseCatalogService({ storage, artifacts, fetcher: offline });
    await restarted.initialize();
    expect((await restarted.resolveCachedByIds(["e-099", "e-060"])).size).toBe(2);
    const result = await restarted.search({ query: "curl antiguo 99" });
    expect((await restarted.getEntry(result.items[0]))?.id).toBe("e-099");
    const versions = new Set([...artifacts.values.keys()].map((key) => key.split(":artifact:")[1].split(":pages")[0]));
    expect(versions.size).toBe(2);
  });

  it.each(["write", "readback", "metadata"])("conserva las copias completas ante un fallo de %s", async (failure) => {
    const storage = memoryStorage({ [EXERCISE_CATALOG_V3_CACHE_KEY]: legacy([rawExercise(0)]) });
    const before = storage.values.get(EXERCISE_CATALOG_V3_CACHE_KEY);
    const artifacts = memoryStorage();
    if (failure === "write") artifacts.setItem.mockImplementation(async () => { throw new Error("disk full"); });
    if (failure === "readback") artifacts.getItem.mockResolvedValue(null);
    if (failure === "metadata") storage.setItem.mockImplementation(async () => {});
    await createExerciseCatalogService({ storage, artifacts, fetcher: offline }).initialize();
    expect(storage.values.get(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(before);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("reanuda tras un cierre entre la retirada de v2 y v3 sin perder IDs exclusivos de v2", async () => {
    const storage = memoryStorage({
      [EXERCISE_CATALOG_V2_CACHE_KEY]: legacy([rawExercise(99, "Cúrl antiguo 99")]),
      [EXERCISE_CATALOG_V3_CACHE_KEY]: legacy([rawExercise(0)]),
    });
    const artifacts = memoryStorage();
    storage.removeItem.mockImplementation(async (key) => {
      if (key === EXERCISE_CATALOG_V3_CACHE_KEY) throw new Error("interrupted");
      storage.values.delete(key);
    });
    await createExerciseCatalogService({ storage, artifacts, fetcher: offline }).initialize();
    expect(storage.values.has(EXERCISE_CATALOG_V2_CACHE_KEY)).toBe(false);
    storage.removeItem.mockImplementation(async (key) => { storage.values.delete(key); });
    const resumed = createExerciseCatalogService({ storage, artifacts, fetcher: offline });
    await resumed.initialize();
    expect((await resumed.resolveCachedByIds(["e-099", "e-000"])).size).toBe(2);
    expect(storage.values.has(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(false);
  });

  it("un fallo de caché no convierte una descarga válida en un fallo de catálogo ni poda la versión durable", async () => {
    const data = fixture();
    const storage = memoryStorage();
    const artifacts = memoryStorage();
    const first = createExerciseCatalogService({ storage, artifacts, fetcher: catalogFetcher(data.artifacts, []), baseUrl: "https://catalog.test" });
    await first.open();
    const durable = storage.values.get(EXERCISE_CATALOG_V4_CACHE_KEY);
    artifacts.setItem.mockRejectedValue(new Error("cache full"));
    const next = createExerciseCatalogService({ storage, artifacts, fetcher: catalogFetcher(fixture("next").artifacts, []), baseUrl: "https://catalog.test" });
    await next.initialize();
    expect((await next.open()).warning).toBe("cache_write_failed");
    expect((await next.browse()).items).toHaveLength(30);
    expect((await next.search({ query: "curl" })).items[0].id).toBe("e-030");
    expect(storage.values.get(EXERCISE_CATALOG_V4_CACHE_KEY)).toBe(durable);
    expect(artifacts.removeItem).not.toHaveBeenCalled();
  });

  it("no retira datos corruptos ni artefactos sin manifiesto verificable", async () => {
    const storage = memoryStorage({
      [EXERCISE_CATALOG_V3_CACHE_KEY]: JSON.stringify({ data: [rawExercise(0)], contentHashSha256: "sha256:invalid" }),
      [`${EXERCISE_CATALOG_V4_CACHE_KEY}:artifact:unknown:search/63.json`]: "untrusted",
    });
    const before = new Map(storage.values);
    await createExerciseCatalogService({ storage, artifacts: memoryStorage(), fetcher: offline }).initialize();
    expect(storage.values).toEqual(before);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});


it("una apertura concurrente espera la migración y no poda su copia a medias", async () => {
  const storage = memoryStorage({ [EXERCISE_CATALOG_V3_CACHE_KEY]: JSON.stringify([rawExercise(99)]) });
  const artifacts = memoryStorage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  artifacts.setItem.mockImplementationOnce(async (key, raw) => { await gate; artifacts.values.set(key, raw); });
  const fetcher = catalogFetcher(fixture().artifacts, []);
  const service = createExerciseCatalogService({ storage, artifacts, fetcher, baseUrl: "https://catalog.test" });
  const copying = service.initialize();
  await vi.waitFor(() => expect(artifacts.setItem).toHaveBeenCalledOnce());
  const opening = service.open();
  await Promise.resolve();
  expect(fetcher).not.toHaveBeenCalled();
  expect(storage.values.has(EXERCISE_CATALOG_V3_CACHE_KEY)).toBe(true);
  release();
  await Promise.all([copying, opening]);
  expect((await service.resolveCachedByIds(["e-099"])).has("e-099")).toBe(true);
});

it("conserva los fragmentos de AsyncStorage y los usa offline cuando la copia separada falla", async () => {
  const data = fixture();
  const storage = memoryStorage();
  const old = createExerciseCatalogService({ storage, fetcher: catalogFetcher(data.artifacts, []), baseUrl: "https://catalog.test" });
  await old.open(); await old.search({ query: "curl" }); await old.resolveByIds(["e-030"]);
  const before = new Map(storage.values);
  const artifacts = memoryStorage();
  artifacts.setItem.mockRejectedValue(new Error("unavailable"));
  const next = createExerciseCatalogService({ storage, artifacts,
    fetcher: async () => ({ ok: false, status: 503, text: async () => "" }) });
  await next.initialize();
  expect(storage.values).toEqual(before);
  expect((await next.search({ query: "curl" })).items[0].id).toBe("e-030");
  expect((await next.resolveByIds(["e-030"])).get("e-030")?.instructions).toBe("Instrucciones 30");
});
