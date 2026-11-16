import { scopedStorageKey } from "../runtimeEnvironment";
import { catalogContentHash, parseExerciseCatalog } from "./schemaValidation";
import type { CatalogAvailability, ExerciseCatalogEntry, RawExerciseCatalogEntry } from "./types";

export const EXERCISE_CATALOG_V4_CACHE_KEY = scopedStorageKey("gymnasia.mobile.exercise_catalog.v4");
export const EXERCISE_CATALOG_V2_CACHE_KEY = scopedStorageKey("gymnasia.mobile.exercises_repo.v2");
export const EXERCISE_CATALOG_V3_CACHE_KEY = scopedStorageKey("gymnasia.mobile.exercises_repo.v3");
export const EXERCISE_CATALOG_PAGE_SIZE = 30;
const SOURCE_ID = "gymnasia_exercises" as const;
const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/maximofn/gymnasia/main/ejercicios/catalog-v1";

type ArtifactDescriptor = {
  path: string;
  contentHashSha256: `sha256:${string}`;
};

export type ExerciseCatalogManifest = {
  schemaVersion: 1;
  catalogVersion: string;
  sourceId: typeof SOURCE_ID;
  itemCount: number;
  pageSize: number;
  pageCount: number;
  staleAfterSeconds: number;
  pages: Array<ArtifactDescriptor & { page: number; count: number }>;
  search: {
    strategy: "normalized-unigram-bigram-v1";
    fields: readonly string[];
    documentFields: readonly string[];
    shards: Array<ArtifactDescriptor & { shardId: string; count: number }>;
  };
  directory: {
    strategy: "first-id-byte-v1";
    shards: Array<ArtifactDescriptor & { shardId: string; count: number }>;
  };
  muscleGroups: Array<{ value: string; normalized: string; count: number }>;
  localMigration?: boolean;
};

type ExercisePage = {
  schemaVersion: 1;
  catalogVersion: string;
  page: number;
  items: RawExerciseCatalogEntry[];
};

type SearchDocumentTuple = [
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  string[],
  string,
  string,
];

type SearchShard = {
  schemaVersion: 1;
  catalogVersion: string;
  shardId: string;
  documents: SearchDocumentTuple[];
  postings: Record<string, Record<string, number[]>>;
};

type DirectoryShard = {
  schemaVersion: 1;
  catalogVersion: string;
  shardId: string;
  records: Record<string, [number, number]>;
};

type ActiveManifest = { manifest: ExerciseCatalogManifest; fetchedAt: string | null };
type CacheMetadata = { schemaVersion: 4; active: ActiveManifest; previous?: ActiveManifest };

export type ExerciseCatalogStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
  getAllKeys?: () => Promise<readonly string[]>;
};

export type ExerciseCatalogFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type ExerciseCatalogRuntimeDependencies = {
  storage: ExerciseCatalogStorage;
  artifacts?: ExerciseCatalogStorage;
  fetcher: (url: string, init?: { signal?: AbortSignal }) => Promise<ExerciseCatalogFetchResponse>;
  now?: () => number;
  baseUrl?: string;
};

export type ExerciseCatalogSummary = Omit<ExerciseCatalogEntry, "instructions"> & {
  ordinal: number;
  page: number;
};

export type ExerciseCatalogState = {
  availability: CatalogAvailability;
  manifest: ExerciseCatalogManifest | null;
  fetchedAt: string | null;
  warning: "remote_failed" | "cache_invalid" | "cache_write_failed" | null;
};

export type ExerciseSearchCriteria = {
  query?: string;
  queryFields?: Array<"name" | "muscle_group">;
  muscleGroup?: string;
  secondaryMuscle?: string;
  equipment?: string;
  difficulty?: string;
};

export type ExerciseCatalogResult = {
  availability: CatalogAvailability;
  globalCoverage: boolean;
  cachedResults: boolean;
  items: ExerciseCatalogSummary[];
  nextCursor: string | null;
  done: boolean;
  warning: "remote_failed" | "cache_invalid" | null;
};

type CursorPayload = { version: string; signature: string; offset: number };
type ArtifactRead<T> = { data: T; cached: boolean };
type DownloadedResponse = { ok: boolean; status: number; body: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isHash(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function parseDescriptor(value: unknown): value is ArtifactDescriptor {
  return isRecord(value)
    && typeof value.path === "string"
    && !value.path.includes("..")
    && !value.path.startsWith("/")
    && isHash(value.contentHashSha256);
}

function parseShardDescriptor(value: unknown, directory: "search" | "by-id"): boolean {
  return isRecord(value)
    && typeof value.shardId === "string"
    && /^[a-f0-9]{2}$/.test(value.shardId)
    && value.path === `${directory}/${value.shardId}.json`
    && Number.isInteger(value.count)
    && (value.count as number) >= 0
    && parseDescriptor(value);
}

export function parseExerciseCatalogManifest(value: unknown): ExerciseCatalogManifest | null {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isHash(value.catalogVersion)
    || value.sourceId !== SOURCE_ID
    || !Number.isInteger(value.itemCount) || (value.itemCount as number) < 0
    || value.pageSize !== EXERCISE_CATALOG_PAGE_SIZE
    || !Number.isInteger(value.pageCount) || (value.pageCount as number) < 0
    || !Number.isInteger(value.staleAfterSeconds) || (value.staleAfterSeconds as number) <= 0
    || !Array.isArray(value.pages)
    || !value.pages.every((page, index) => isRecord(page)
      && page.page === index
      && page.path === `pages/${String(index).padStart(4, "0")}.json`
      && Number.isInteger(page.count)
      && (page.count as number) >= 0
      && parseDescriptor(page))
    || value.pages.length !== value.pageCount
    || !isRecord(value.search)
    || value.search.strategy !== "normalized-unigram-bigram-v1"
    || !Array.isArray(value.search.fields)
    || !Array.isArray(value.search.documentFields)
    || !Array.isArray(value.search.shards)
    || !value.search.shards.every((shard) => parseShardDescriptor(shard, "search"))
    || !isRecord(value.directory)
    || value.directory.strategy !== "first-id-byte-v1"
    || !Array.isArray(value.directory.shards)
    || !value.directory.shards.every((shard) => parseShardDescriptor(shard, "by-id"))
    || !Array.isArray(value.muscleGroups)) {
    return null;
  }
  const manifest = value as unknown as ExerciseCatalogManifest;
  const total = manifest.pages.reduce((sum, page) => sum + page.count, 0);
  if (total !== manifest.itemCount || manifest.pageCount !== Math.ceil(manifest.itemCount / manifest.pageSize)) {
    return null;
  }
  if (manifest.pages.some((page) => page.count !== Math.min(
    manifest.pageSize,
    manifest.itemCount - page.page * manifest.pageSize,
  ))) return null;
  if (!manifest.muscleGroups.every((group) => isRecord(group)
    && typeof group.value === "string"
    && typeof group.normalized === "string"
    && Number.isInteger(group.count)
    && (group.count as number) >= 0)) return null;
  const searchShardIds = new Set(manifest.search.shards.map((shard) => shard.shardId));
  const directoryShardIds = new Set(manifest.directory.shards.map((shard) => shard.shardId));
  if (searchShardIds.size !== manifest.search.shards.length
    || directoryShardIds.size !== manifest.directory.shards.length) return null;
  return manifest;
}

export function normalizeExerciseCatalogSearch(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function summaryFromTuple(tuple: SearchDocumentTuple): ExerciseCatalogSummary | null {
  const [ordinal, page, id, name, imageMale, imageFemale, muscleGroup, secondary, equipment, difficulty] = tuple;
  if (!Number.isInteger(ordinal) || !Number.isInteger(page)
    || ![id, name, imageMale, imageFemale, muscleGroup, equipment, difficulty].every((item) => typeof item === "string")
    || !Array.isArray(secondary) || !secondary.every((item) => typeof item === "string")) {
    return null;
  }
  return {
    ordinal,
    page,
    sourceId: SOURCE_ID,
    id,
    name,
    image_male: imageMale,
    image_female: imageFemale,
    muscle_group: muscleGroup,
    secondary_muscles: secondary,
    equipment,
    difficulty,
  };
}

function summaryFromEntry(entry: ExerciseCatalogEntry, ordinal: number, page: number): ExerciseCatalogSummary {
  const { instructions: _instructions, ...summary } = entry;
  return { ...summary, ordinal, page };
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function artifactKey(version: string, path: string): string {
  return `${EXERCISE_CATALOG_V4_CACHE_KEY}:artifact:${version}:${path}`;
}

function parseCursor(cursor: string | undefined, version: string, signature: string): number {
  if (!cursor) return 0;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(cursor));
  } catch {
    throw new Error("exercise-catalog-cursor-invalid");
  }
  if (!isRecord(value)
    || value.version !== version
    || value.signature !== signature
    || !Number.isInteger(value.offset)
    || (value.offset as number) < 0) {
    throw new Error("exercise-catalog-cursor-invalid");
  }
  return value.offset as number;
}

function makeCursor(version: string, signature: string, offset: number): string {
  const payload: CursorPayload = { version, signature, offset };
  return encodeURIComponent(JSON.stringify(payload));
}

function availabilityFor(active: ActiveManifest, now: number): CatalogAvailability {
  if (!active.fetchedAt) return "stale";
  return now - Date.parse(active.fetchedAt) > active.manifest.staleAfterSeconds * 1000 ? "stale" : "cached";
}

function exactMatches(summary: ExerciseCatalogSummary, criteria: ExerciseSearchCriteria): boolean {
  const includes = (haystack: string, needle: string | undefined) => (
    !normalizeExerciseCatalogSearch(needle)
    || normalizeExerciseCatalogSearch(haystack).includes(normalizeExerciseCatalogSearch(needle))
  );
  const query = normalizeExerciseCatalogSearch(criteria.query);
  const queryFields = criteria.queryFields ?? ["name", "muscle_group"];
  if (query && !queryFields.some((field) => normalizeExerciseCatalogSearch(summary[field]).includes(query))) return false;
  return includes(summary.muscle_group, criteria.muscleGroup)
    && (!normalizeExerciseCatalogSearch(criteria.secondaryMuscle)
      || summary.secondary_muscles.some((value) => includes(value, criteria.secondaryMuscle)))
    && includes(summary.equipment, criteria.equipment)
    && includes(summary.difficulty, criteria.difficulty);
}

function criterionAnchors(criteria: ExerciseSearchCriteria): Array<{ field: string; value: string }> {
  const anchors: Array<{ field: string; value: string }> = [];
  const query = normalizeExerciseCatalogSearch(criteria.query);
  for (const field of criteria.queryFields ?? ["name", "muscle_group"]) {
    if (query) anchors.push({ field, value: query });
  }
  for (const [field, raw] of [
    ["muscle_group", criteria.muscleGroup],
    ["secondary_muscles", criteria.secondaryMuscle],
    ["equipment", criteria.equipment],
    ["difficulty", criteria.difficulty],
  ] as const) {
    const value = normalizeExerciseCatalogSearch(raw);
    if (value) anchors.push({ field, value });
  }
  return anchors;
}

function gramFor(value: string): string {
  return value.length === 1 ? value : value.slice(0, 2);
}

function shardIdFor(value: string): string {
  return value.charCodeAt(0).toString(16).padStart(2, "0");
}

function pageValue(entries: ExerciseCatalogEntry[], version: string, page: number): ExercisePage {
  return {
    schemaVersion: 1,
    catalogVersion: version,
    page,
    items: entries.map(({ sourceId: _sourceId, ...entry }) => entry),
  };
}

export function createExerciseCatalogService(dependencies: ExerciseCatalogRuntimeDependencies) {
  const artifacts = dependencies.artifacts ?? dependencies.storage;
  let cacheWriteFailed = false;
  const now = dependencies.now ?? Date.now;
  const baseUrl = dependencies.baseUrl ?? DEFAULT_BASE_URL;
  const inFlight = new Map<string, Promise<DownloadedResponse>>();
  let active: ActiveManifest | null = null;
  let previousActive: ActiveManifest | null = null;
  let state: ExerciseCatalogState = {
    availability: "unavailable",
    manifest: null,
    fetchedAt: null,
    warning: null,
  };

  async function deduplicatedFetch(url: string, signal?: AbortSignal): Promise<DownloadedResponse> {
    if (signal?.aborted) throw new Error("aborted");
    let pending = inFlight.get(url);
    if (!pending) {
      pending = dependencies.fetcher(url).then(async (response) => ({
        ok: response.ok,
        status: response.status,
        body: await response.text(),
      })).finally(() => inFlight.delete(url));
      inFlight.set(url, pending);
    }
    if (!signal) return pending;
    return new Promise<DownloadedResponse>((resolve, reject) => {
      const abort = () => reject(new Error("aborted"));
      signal.addEventListener("abort", abort, { once: true });
      pending!.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  async function readCachedArtifact<T>(version: string, descriptor: ArtifactDescriptor): Promise<T | null> {
    const key = artifactKey(version, descriptor.path);
    const read = async (storage: ExerciseCatalogStorage) => {
      try {
        const raw = await storage.getItem(key);
        if (!raw) return null;
        const value = parseJson(raw);
        return catalogContentHash(value) === descriptor.contentHashSha256 ? { raw, value: value as T } : null;
      } catch { return null; }
    };
    const separate = await read(artifacts);
    // Read the old store only for this public, manifest-declared key.
    const legacy = artifacts !== dependencies.storage ? await read(dependencies.storage) : null;
    if (legacy) {
      try {
        if (!separate) await artifacts.setItem(key, legacy.raw);
        const verified = await read(artifacts);
        if (!verified) throw new Error("artifact-copy-invalid");
        await dependencies.storage.removeItem?.(key);
      } catch { cacheWriteFailed = true; }
    }
    return separate?.value ?? legacy?.value ?? null;
  }

  async function fetchArtifact<T>(
    manifest: ExerciseCatalogManifest,
    descriptor: ArtifactDescriptor,
    signal?: AbortSignal,
  ): Promise<ArtifactRead<T>> {
    const cached = await readCachedArtifact<T>(manifest.catalogVersion, descriptor);
    if (cached) return { data: cached, cached: true };
    const response = await deduplicatedFetch(`${baseUrl}/${descriptor.path}?v=${encodeURIComponent(manifest.catalogVersion)}`, signal);
    if (!response.ok) throw new Error(`http-${response.status}`);
    const data = parseJson(response.body) as T;
    if (catalogContentHash(data) !== descriptor.contentHashSha256) throw new Error("artifact-hash-invalid");
    try {
      await artifacts.setItem(artifactKey(manifest.catalogVersion, descriptor.path), JSON.stringify(data));
    } catch {
      cacheWriteFailed = true;
      state = { ...state, warning: "cache_write_failed" };
    }
    return { data, cached: false };
  }

  function parsePage(value: ExercisePage, manifest: ExerciseCatalogManifest, page: number): ExerciseCatalogEntry[] | null {
    if (!isRecord(value)
      || value.schemaVersion !== 1
      || value.catalogVersion !== manifest.catalogVersion
      || value.page !== page) return null;
    const raw = parseExerciseCatalog(value.items);
    return raw?.map((entry) => ({ ...entry, sourceId: SOURCE_ID })) ?? null;
  }

  async function loadPage(manifest: ExerciseCatalogManifest, page: number, signal?: AbortSignal) {
    const descriptor = manifest.pages[page];
    if (!descriptor) return null;
    const artifact = await fetchArtifact<ExercisePage>(manifest, descriptor, signal);
    const items = parsePage(artifact.data, manifest, page);
    if (!items || items.length !== descriptor.count) throw new Error("exercise-page-invalid");
    return { items, cached: artifact.cached };
  }

  async function writeMetadata(next: CacheMetadata): Promise<boolean> {
    try {
      const raw = JSON.stringify(next);
      await dependencies.storage.setItem(EXERCISE_CATALOG_V4_CACHE_KEY, raw);
      return await dependencies.storage.getItem(EXERCISE_CATALOG_V4_CACHE_KEY) === raw;
    } catch {
      return false;
    }
  }

  async function pruneVersions(keep: string[]): Promise<void> {
    if (!artifacts.getAllKeys || !artifacts.removeItem) return;
    const prefix = `${EXERCISE_CATALOG_V4_CACHE_KEY}:artifact:`;
    const keys = await artifacts.getAllKeys();
    await Promise.all(keys
      .filter((key) => key.startsWith(prefix) && !keep.some((version) => key.startsWith(`${prefix}${version}:`)))
      .map((key) => artifacts.removeItem!(key)));
  }

  async function activate(next: ActiveManifest): Promise<void> {
    const activePage = active?.manifest.pages[0];
    const activeDurable = active && (!activePage || !!await readCachedArtifact(active.manifest.catalogVersion, activePage));
    const previous = previousActive?.manifest.localMigration ? previousActive
      : activeDurable && active && active.manifest.catalogVersion !== next.manifest.catalogVersion ? active : previousActive;
    const metadata: CacheMetadata = {
      schemaVersion: 4,
      active: next,
      ...(previous ? { previous } : {}),
    };
    // Never replace durable metadata with a manifest whose first page could
    // not be stored. Network results can still be used in the current session.
    const first = next.manifest.pages[0];
    const durable = !first || !!await readCachedArtifact(next.manifest.catalogVersion, first);
    const persisted = durable && await writeMetadata(metadata);
    active = next;
    previousActive = previous;
    state = {
      availability: next.manifest.localMigration ? "stale" : "fresh",
      manifest: next.manifest,
      fetchedAt: next.fetchedAt,
      warning: persisted && !cacheWriteFailed ? null : "cache_write_failed",
    };
    try {
      if (persisted) await pruneVersions([next.manifest.catalogVersion, metadata.previous?.manifest.catalogVersion].filter(Boolean) as string[]);
    } catch {
      state = { ...state, warning: "cache_write_failed" };
    }
  }

  async function migrateLegacyCatalogs(): Promise<boolean> {
    const entriesById = new Map<string, ExerciseCatalogEntry>();
    const legacyKeys: string[] = [];
    // A retry after a crash between the two removals must keep entries that
    // existed only in the already retired v2 copy.
    const oldFallback = [active, previousActive].find((item) => item?.manifest.localMigration);
    if (oldFallback) {
      for (const page of oldFallback.manifest.pages) {
        const value = await readCachedArtifact<ExercisePage>(oldFallback.manifest.catalogVersion, page);
        const entries = value && parsePage(value, oldFallback.manifest, page.page);
        if (!entries || entries.length !== page.count) return false;
        for (const entry of entries) entriesById.set(entry.id, entry);
      }
    }
    for (const key of [EXERCISE_CATALOG_V2_CACHE_KEY, EXERCISE_CATALOG_V3_CACHE_KEY]) {
      try {
        const raw = await dependencies.storage.getItem(key);
        if (!raw) continue;
        const envelope = parseJson(raw);
        const value = isRecord(envelope) && Array.isArray(envelope.data) ? envelope.data : envelope;
        // Do not retire a malformed or foreign envelope.
        if (isRecord(envelope) && envelope.sourceId !== undefined && envelope.sourceId !== SOURCE_ID) continue;
        if (isRecord(envelope) && envelope.contentHashSha256 !== undefined
          && catalogContentHash(value) !== envelope.contentHashSha256) continue;
        const parsed = parseExerciseCatalog(Array.isArray(value) ? value.map((candidate) => {
          if (!isRecord(candidate)) return candidate;
          const { sourceId: _sourceId, ...entry } = candidate;
          return entry;
        }) : value);
        if (!parsed || new Set(parsed.map((entry) => entry.id)).size !== parsed.length) continue;
        for (const entry of parsed) entriesById.set(entry.id, { ...entry, sourceId: SOURCE_ID });
        legacyKeys.push(key);
      } catch { cacheWriteFailed = true; }
    }
    if (legacyKeys.length === 0) return false;
    const entries = [...entriesById.values()].sort((left, right) => left.id.localeCompare(right.id));
    const version = catalogContentHash(entries);
    const pages: ExerciseCatalogManifest["pages"] = [];
    try {
      for (let offset = 0; offset < entries.length; offset += EXERCISE_CATALOG_PAGE_SIZE) {
        const page = Math.floor(offset / EXERCISE_CATALOG_PAGE_SIZE);
        const value = pageValue(entries.slice(offset, offset + EXERCISE_CATALOG_PAGE_SIZE), version, page);
        const path = `pages/${String(page).padStart(4, "0")}.json`;
        const raw = JSON.stringify(value);
        const key = artifactKey(version, path);
        const descriptor = { page, path, count: value.items.length, contentHashSha256: catalogContentHash(value) };
        // Retry without replacing an already verified immutable page. The
        // serialized property order may differ from an earlier valid copy.
        let verified = false;
        const existing = await artifacts.getItem(key);
        try { verified = existing !== null && catalogContentHash(parseJson(existing)) === descriptor.contentHashSha256; } catch {}
        if (!verified) {
          await artifacts.setItem(key, raw);
          if (await artifacts.getItem(key) !== raw) throw new Error("legacy-copy-invalid");
        }
        pages.push(descriptor);
      }
      const muscleCounts = new Map<string, number>();
      for (const entry of entries) muscleCounts.set(entry.muscle_group, (muscleCounts.get(entry.muscle_group) ?? 0) + 1);
      const fallback: ActiveManifest = { fetchedAt: null, manifest: {
        schemaVersion: 1, catalogVersion: version, sourceId: SOURCE_ID,
        itemCount: entries.length, pageSize: EXERCISE_CATALOG_PAGE_SIZE, pageCount: pages.length,
        staleAfterSeconds: 7 * 24 * 60 * 60, pages,
        search: { strategy: "normalized-unigram-bigram-v1", fields: [], documentFields: [], shards: [] },
        directory: { strategy: "first-id-byte-v1", shards: [] },
        muscleGroups: [...muscleCounts].map(([value, count]) => ({ value, normalized: normalizeExerciseCatalogSearch(value), count })),
        localMigration: true,
      } };
      const current = active && !active.manifest.localMigration ? active : fallback;
      const metadata: CacheMetadata = { schemaVersion: 4, active: current,
        ...(current !== fallback ? { previous: fallback } : {}) };
      if (!await writeMetadata(metadata)) throw new Error("legacy-metadata-invalid");
      active = current;
      previousActive = current !== fallback ? fallback : null;
      state = { availability: availabilityFor(current, now()), manifest: current.manifest,
        fetchedAt: current.fetchedAt, warning: cacheWriteFailed ? "cache_write_failed" : null };
      for (const key of legacyKeys) await dependencies.storage.removeItem?.(key);
      await pruneVersions([current.manifest.catalogVersion, fallback.manifest.catalogVersion]);
      return true;
    } catch {
      cacheWriteFailed = true;
      state = { ...state, warning: "cache_write_failed" };
      return false;
    }
  }

  async function initializeCache(): Promise<ExerciseCatalogState> {
    try {
      const raw = await dependencies.storage.getItem(EXERCISE_CATALOG_V4_CACHE_KEY);
      if (!raw) { await migrateLegacyCatalogs(); return state; }
      const metadata = parseJson(raw);
      if (!isRecord(metadata) || metadata.schemaVersion !== 4 || !isRecord(metadata.active)) throw new Error("metadata-invalid");
      const validateCachedActive = async (candidate: Record<string, unknown>): Promise<ActiveManifest | null> => {
        const manifest = parseExerciseCatalogManifest(candidate.manifest);
        const fetchedAt = candidate.fetchedAt;
        if (!manifest || (fetchedAt !== null && (typeof fetchedAt !== "string" || !Number.isFinite(Date.parse(fetchedAt))))) return null;
        // Migrate every declared legacy artifact, including indexes not read
        // again during this launch. Only hash-verified copies can be removed.
        for (const descriptor of [...manifest.pages, ...manifest.search.shards, ...manifest.directory.shards]) {
          await readCachedArtifact(manifest.catalogVersion, descriptor);
        }
        if (manifest.itemCount > 0) {
          const descriptor = manifest.pages[0];
          const cachedPage = await readCachedArtifact<ExercisePage>(manifest.catalogVersion, descriptor);
          if (!cachedPage || !parsePage(cachedPage, manifest, 0)) return null;
        }
        return { manifest, fetchedAt: fetchedAt as string | null };
      };
      const current = await validateCachedActive(metadata.active);
      const fallback = isRecord(metadata.previous) ? await validateCachedActive(metadata.previous) : null;
      active = current ?? fallback;
      previousActive = current ? fallback : null;
      if (!active) throw new Error("first-page-missing");
      const { manifest } = active;
      state = { availability: availabilityFor(active, now()), manifest, fetchedAt: active.fetchedAt,
        warning: cacheWriteFailed ? "cache_write_failed" : null };
    } catch {
      state = { availability: "unavailable", manifest: null, fetchedAt: null, warning: "cache_invalid" };
    }
    await migrateLegacyCatalogs();
    return state;
  }

  let initialization: Promise<ExerciseCatalogState> | null = null;
  async function initialize(): Promise<ExerciseCatalogState> {
    initialization ??= initializeCache();
    await initialization;
    return state;
  }

  async function open(signal?: AbortSignal): Promise<ExerciseCatalogState> {
    // Opening the selector while startup is still copying legacy pages must
    // not activate/prune a different version halfway through that migration.
    await initialize();
    try {
      const response = await deduplicatedFetch(`${baseUrl}/manifest.json?ts=${now()}`, signal);
      if (!response.ok) throw new Error(`http-${response.status}`);
      const manifest = parseExerciseCatalogManifest(parseJson(response.body));
      if (!manifest) throw new Error("manifest-invalid");
      if (manifest.itemCount > 0 && !await loadPage(manifest, 0, signal)) throw new Error("first-page-invalid");
      await activate({ manifest, fetchedAt: new Date(now()).toISOString() });
    } catch {
      if (!active) await migrateLegacyCatalogs();
      if (!active) state = { availability: "unavailable", manifest: null, fetchedAt: null, warning: "remote_failed" };
      else state = { ...state, availability: availabilityFor(active, now()), warning: "remote_failed" };
    }
    return state;
  }

  async function cachedPageSummaries(manifest: ExerciseCatalogManifest): Promise<ExerciseCatalogSummary[]> {
    const summaries: ExerciseCatalogSummary[] = [];
    for (const descriptor of manifest.pages) {
      const value = await readCachedArtifact<ExercisePage>(manifest.catalogVersion, descriptor);
      if (!value) continue;
      const entries = parsePage(value, manifest, descriptor.page);
      if (!entries) continue;
      entries.forEach((entry, index) => summaries.push(summaryFromEntry(entry, descriptor.page * manifest.pageSize + index, descriptor.page)));
    }
    return summaries;
  }

  async function resolveCachedByIds(ids: string[]): Promise<Map<string, ExerciseCatalogEntry>> {
    const result = new Map<string, ExerciseCatalogEntry>();
    if (!active) return result;
    const wanted = new Set(ids);
    for (const candidate of [active, previousActive]) {
      if (!candidate) continue;
      for (const descriptor of candidate.manifest.pages) {
        const value = await readCachedArtifact<ExercisePage>(candidate.manifest.catalogVersion, descriptor);
        if (!value) continue;
        const entries = parsePage(value, candidate.manifest, descriptor.page);
        for (const entry of entries ?? []) if (wanted.has(entry.id) && !result.has(entry.id)) result.set(entry.id, entry);
        if (result.size === wanted.size) return result;
      }
    }
    return result;
  }

  async function browse(cursor?: string, signal?: AbortSignal): Promise<ExerciseCatalogResult> {
    if (!active) return { availability: "unavailable", globalCoverage: false, cachedResults: false, items: [], nextCursor: null, done: true, warning: "remote_failed" };
    const { manifest } = active;
    const signature = catalogContentHash({ type: "browse" });
    const offset = parseCursor(cursor, manifest.catalogVersion, signature);
    const page = Math.floor(offset / manifest.pageSize);
    try {
      const loaded = await loadPage(manifest, page, signal);
      const items = loaded?.items.map((entry, index) => summaryFromEntry(entry, page * manifest.pageSize + index, page)) ?? [];
      const nextOffset = (page + 1) * manifest.pageSize;
      return {
        availability: state.availability,
        globalCoverage: true,
        cachedResults: loaded?.cached ?? false,
        items,
        nextCursor: nextOffset < manifest.itemCount ? makeCursor(manifest.catalogVersion, signature, nextOffset) : null,
        done: nextOffset >= manifest.itemCount,
        warning: null,
      };
    } catch {
      return { availability: state.availability, globalCoverage: false, cachedResults: true, items: [], nextCursor: null, done: true, warning: "remote_failed" };
    }
  }

  async function search(
    criteria: ExerciseSearchCriteria,
    cursor?: string,
    limit = EXERCISE_CATALOG_PAGE_SIZE,
    signal?: AbortSignal,
  ): Promise<ExerciseCatalogResult> {
    if (!active) return { availability: "unavailable", globalCoverage: false, cachedResults: false, items: [], nextCursor: null, done: true, warning: "remote_failed" };
    const { manifest } = active;
    const normalizedCriteria = {
      query: normalizeExerciseCatalogSearch(criteria.query),
      queryFields: criteria.queryFields ?? ["name", "muscle_group"],
      muscleGroup: normalizeExerciseCatalogSearch(criteria.muscleGroup),
      secondaryMuscle: normalizeExerciseCatalogSearch(criteria.secondaryMuscle),
      equipment: normalizeExerciseCatalogSearch(criteria.equipment),
      difficulty: normalizeExerciseCatalogSearch(criteria.difficulty),
    };
    const anchors = criterionAnchors(criteria);
    if (anchors.length === 0) return browse(cursor, signal);
    const signature = catalogContentHash(normalizedCriteria);
    const offset = parseCursor(cursor, manifest.catalogVersion, signature);

    try {
      if (manifest.localMigration) throw new Error("local-index-unavailable");
      const shardId = shardIdFor(anchors[0].value);
      const descriptor = manifest.search.shards.find((item) => item.shardId === shardId);
      if (!descriptor) return { availability: state.availability, globalCoverage: true, cachedResults: false, items: [], nextCursor: null, done: true, warning: null };
      const loaded = await fetchArtifact<SearchShard>(manifest, descriptor, signal);
      const shard = loaded.data;
      if (!isRecord(shard) || shard.catalogVersion !== manifest.catalogVersion || shard.shardId !== shardId
        || shard.schemaVersion !== 1
        || !Array.isArray(shard.documents)
        || shard.documents.length !== descriptor.count
        || !shard.documents.every((tuple) => {
          const summary = summaryFromTuple(tuple);
          return !!summary
            && summary.ordinal >= 0
            && summary.ordinal < manifest.itemCount
            && summary.page === Math.floor(summary.ordinal / manifest.pageSize);
        })
        || !isRecord(shard.postings)) throw new Error("search-shard-invalid");
      const candidateIndexes = new Set<number>();
      const matchingAnchors = anchors.filter((anchor) => shardIdFor(anchor.value) === shardId);
      for (const anchor of matchingAnchors) {
        for (const index of shard.postings[anchor.field]?.[gramFor(anchor.value)] ?? []) candidateIndexes.add(index);
      }
      const candidates = [...candidateIndexes]
        .map((index) => summaryFromTuple(shard.documents[index]))
        .filter((item): item is ExerciseCatalogSummary => !!item)
        .filter((item) => exactMatches(item, criteria))
        .sort((left, right) => left.ordinal - right.ordinal);
      const items = candidates.slice(offset, offset + limit);
      const nextOffset = offset + items.length;
      return {
        availability: state.availability,
        globalCoverage: true,
        cachedResults: loaded.cached,
        items,
        nextCursor: nextOffset < candidates.length ? makeCursor(manifest.catalogVersion, signature, nextOffset) : null,
        done: nextOffset >= candidates.length,
        warning: null,
      };
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === "exercise-catalog-cursor-invalid")) throw error;
      const summaries = await cachedPageSummaries(manifest);
      if (previousActive) summaries.push(...await cachedPageSummaries(previousActive.manifest));
      const cached = [...new Map([...summaries].reverse().map((item) => [item.id, item])).values()].reverse()
        .filter((item) => exactMatches(item, criteria));
      const items = cached.slice(offset, offset + limit);
      return {
        availability: state.availability,
        globalCoverage: manifest.localMigration === true,
        cachedResults: true,
        items,
        nextCursor: offset + items.length < cached.length
          ? makeCursor(manifest.catalogVersion, signature, offset + items.length) : null,
        done: offset + items.length >= cached.length,
        warning: "remote_failed",
      };
    }
  }

  async function resolveByIds(ids: string[], signal?: AbortSignal): Promise<Map<string, ExerciseCatalogEntry>> {
    if (!active) return new Map<string, ExerciseCatalogEntry>();
    const { manifest } = active;
    const unique = [...new Set(ids.filter(Boolean))];
    const result = await resolveCachedByIds(unique);
    const unresolved = unique.filter((id) => !result.has(id));
    if (unresolved.length === 0) return result;
    if (manifest.localMigration) {
      return result;
    }
    const grouped = new Map<string, string[]>();
    for (const id of unresolved) {
      const shardId = shardIdFor(normalizeExerciseCatalogSearch(id) || "_");
      grouped.set(shardId, [...(grouped.get(shardId) ?? []), id]);
    }
    const pageRefs = new Map<number, string[]>();
    await Promise.all([...grouped].map(async ([shardId, shardIds]) => {
      try {
        const descriptor = manifest.directory.shards.find((item) => item.shardId === shardId);
        if (!descriptor) return;
        const { data } = await fetchArtifact<DirectoryShard>(manifest, descriptor, signal);
        if (!isRecord(data)
          || data.schemaVersion !== 1
          || data.catalogVersion !== manifest.catalogVersion
          || data.shardId !== shardId
          || !isRecord(data.records)
          || Object.keys(data.records).length !== descriptor.count) return;
        for (const id of shardIds) {
          const record = data.records[id];
          if (Array.isArray(record)
            && record.length === 2
            && Number.isInteger(record[0])
            && Number.isInteger(record[1])
            && record[0] >= 0
            && record[0] < manifest.itemCount
            && record[1] === Math.floor(record[0] / manifest.pageSize)) {
            pageRefs.set(record[1], [...(pageRefs.get(record[1]) ?? []), id]);
          }
        }
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }));
    await Promise.all([...pageRefs].map(async ([page, pageIds]) => {
      try {
        const loaded = await loadPage(manifest, page, signal);
        for (const entry of loaded?.items ?? []) if (pageIds.includes(entry.id)) result.set(entry.id, entry);
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }));
    return result;
  }

  async function getEntry(summary: Pick<ExerciseCatalogSummary, "id" | "page">, signal?: AbortSignal): Promise<ExerciseCatalogEntry | null> {
    if (!active) return null;
    try {
      const loaded = await loadPage(active.manifest, summary.page, signal);
      const entry = loaded?.items.find((item) => item.id === summary.id);
      if (entry) return entry;
    } catch { /* A result may belong to the complete offline fallback. */ }
    return (await resolveCachedByIds([summary.id])).get(summary.id) ?? null;
  }

  return {
    initialize,
    open,
    browse,
    search,
    resolveByIds,
    resolveCachedByIds,
    getEntry,
    getState: () => state,
  };
}

export type ExerciseCatalogService = ReturnType<typeof createExerciseCatalogService>;
