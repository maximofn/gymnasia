import {
  CATALOG_CACHE_SCHEMA_VERSION,
  CATALOG_STALE_AFTER_MS,
  type CatalogAggregateAvailability,
  type CatalogCacheEnvelope,
  type CatalogProvenance,
  type CatalogSnapshot,
  type CatalogSourceStatus,
  type RemoteCatalogSourceId,
} from "./types";
import { catalogContentHash } from "./schemaValidation";

export type CatalogStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type CatalogFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  headers?: { get: (name: string) => string | null };
};

export type CatalogDefinition<T> = {
  sourceId: RemoteCatalogSourceId;
  label: string;
  url: string;
  cacheKey: string;
  legacyCacheKey: string;
  provenance: CatalogProvenance;
  parse: (value: unknown) => T[] | null;
};

export type CatalogRuntimeDependencies = {
  storage: CatalogStorage;
  fetcher: (url: string) => Promise<CatalogFetchResponse>;
  now?: () => number;
};

export function initialCatalogSnapshot<T>(definition: CatalogDefinition<T>): CatalogSnapshot<T> {
  return {
    sourceId: definition.sourceId,
    label: definition.label,
    availability: "unavailable",
    data: [],
    fetchedAt: null,
    refreshing: false,
    cachePersisted: false,
    warning: null,
    provenance: definition.provenance,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseFetchedAt(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return value;
}

function isProvenance(value: unknown): value is CatalogProvenance {
  if (!isRecord(value)
    || typeof value.repositoryUrl !== "string"
    || typeof value.catalogPath !== "string") {
    return false;
  }
  return (value.attributionUrl === undefined || typeof value.attributionUrl === "string")
    && (value.licenseLabel === undefined || typeof value.licenseLabel === "string");
}

function cacheAvailability(fetchedAt: string | null, now: number): "cached" | "stale" {
  if (!fetchedAt) return "stale";
  return now - Date.parse(fetchedAt) > CATALOG_STALE_AFTER_MS ? "stale" : "cached";
}

function parseEnvelope<T>(
  raw: string,
  definition: CatalogDefinition<T>,
  now: number,
): CatalogSnapshot<T> | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(candidate)
    || candidate.schemaVersion !== CATALOG_CACHE_SCHEMA_VERSION
    || candidate.sourceId !== definition.sourceId
    || typeof candidate.contentHashSha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/.test(candidate.contentHashSha256)
    || (candidate.etag !== undefined && candidate.etag !== null && typeof candidate.etag !== "string")
    || (candidate.provenance !== undefined && !isProvenance(candidate.provenance))) {
    return null;
  }
  const fetchedAt = parseFetchedAt(candidate.fetchedAt);
  if (fetchedAt === undefined) return null;
  const data = definition.parse(candidate.data);
  if (!data || catalogContentHash(data) !== candidate.contentHashSha256) return null;
  return {
    ...initialCatalogSnapshot(definition),
    availability: cacheAvailability(fetchedAt, now),
    data,
    fetchedAt,
    cachePersisted: true,
  };
}

function envelopeFor<T>(
  definition: CatalogDefinition<T>,
  data: T[],
  fetchedAt: string | null,
  etag: string | null,
): CatalogCacheEnvelope<T> {
  return {
    schemaVersion: CATALOG_CACHE_SCHEMA_VERSION,
    sourceId: definition.sourceId,
    fetchedAt,
    contentHashSha256: catalogContentHash(data),
    etag,
    provenance: definition.provenance,
    data,
  };
}

export async function readCatalogCache<T>(
  definition: CatalogDefinition<T>,
  dependencies: CatalogRuntimeDependencies,
): Promise<CatalogSnapshot<T>> {
  const now = (dependencies.now ?? Date.now)();
  let currentRaw: string | null = null;
  try {
    currentRaw = await dependencies.storage.getItem(definition.cacheKey);
  } catch {
    return { ...initialCatalogSnapshot(definition), warning: "cache_invalid" };
  }
  if (currentRaw) {
    const current = parseEnvelope(currentRaw, definition, now);
    if (current) return current;
    return { ...initialCatalogSnapshot(definition), warning: "cache_invalid" };
  }

  let legacyRaw: string | null = null;
  try {
    legacyRaw = await dependencies.storage.getItem(definition.legacyCacheKey);
  } catch {
    return { ...initialCatalogSnapshot(definition), warning: "cache_invalid" };
  }
  if (!legacyRaw) return initialCatalogSnapshot(definition);
  try {
    const data = definition.parse(JSON.parse(legacyRaw));
    if (!data) return { ...initialCatalogSnapshot(definition), warning: "cache_invalid" };
    const envelope = envelopeFor(definition, data, null, null);
    let cachePersisted = true;
    try {
      await dependencies.storage.setItem(definition.cacheKey, JSON.stringify(envelope));
    } catch {
      cachePersisted = false;
    }
    return {
      ...initialCatalogSnapshot(definition),
      availability: "stale",
      data,
      cachePersisted,
      warning: cachePersisted ? null : "cache_write_failed",
    };
  } catch {
    return { ...initialCatalogSnapshot(definition), warning: "cache_invalid" };
  }
}

export async function refreshCatalog<T>(
  definition: CatalogDefinition<T>,
  previous: CatalogSnapshot<T>,
  dependencies: CatalogRuntimeDependencies,
): Promise<CatalogSnapshot<T>> {
  const now = dependencies.now ?? Date.now;
  const refreshedAt = now();
  try {
    const separator = definition.url.includes("?") ? "&" : "?";
    const fetcher = dependencies.fetcher;
    const response = await fetcher(`${definition.url}${separator}ts=${refreshedAt}`);
    if (!response.ok) throw new Error(`http-${response.status}`);
    const text = await response.text();
    const data = definition.parse(JSON.parse(text));
    if (!data) throw new Error("schema-invalid");
    const fetchedAt = new Date(refreshedAt).toISOString();
    const envelope = envelopeFor(
      definition,
      data,
      fetchedAt,
      response.headers?.get("etag") ?? null,
    );
    let cachePersisted = true;
    try {
      await dependencies.storage.setItem(definition.cacheKey, JSON.stringify(envelope));
    } catch {
      cachePersisted = false;
    }
    return {
      ...initialCatalogSnapshot(definition),
      availability: "fresh",
      data,
      fetchedAt,
      cachePersisted,
      warning: cachePersisted ? null : "cache_write_failed",
    };
  } catch {
    return {
      ...previous,
      availability: previous.availability === "fresh"
        ? cacheAvailability(previous.fetchedAt, refreshedAt)
        : previous.availability,
      refreshing: false,
      warning: previous.warning === "cache_invalid" || previous.warning === "cache_write_failed"
        ? previous.warning
        : "remote_failed",
    };
  }
}

export function aggregateCatalogAvailability(
  sources: Array<CatalogSnapshot<unknown>>,
): CatalogAggregateAvailability {
  if (sources.length === 0 || sources.every((source) => source.availability === "unavailable")) {
    return "unavailable";
  }
  const first = sources[0]?.availability;
  if (first && sources.every((source) => source.availability === first)) return first;
  return "partial";
}

export function catalogStatuses(sources: Array<CatalogSnapshot<unknown>>): CatalogSourceStatus[] {
  return sources.map(({ sourceId, label, availability, fetchedAt, refreshing, cachePersisted, warning }) => ({
    sourceId,
    label,
    availability,
    fetchedAt,
    refreshing,
    cachePersisted,
    warning,
  }));
}

export function latestCatalogFetch(sources: Array<CatalogSnapshot<unknown>>): string | null {
  return sources
    .map((source) => source.fetchedAt)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) ?? null;
}

export function catalogWarnings(sources: Array<CatalogSnapshot<unknown>>): string[] {
  const warnings: string[] = [];
  for (const source of sources) {
    if (source.availability === "cached") warnings.push(`${source.label}: usando una copia local.`);
    if (source.availability === "stale") warnings.push(`${source.label}: la copia local es antigua o no tiene fecha conocida.`);
    if (source.availability === "unavailable") warnings.push(`${source.label}: no disponible.`);
    if (source.warning === "cache_write_failed") warnings.push(`${source.label}: los datos nuevos no se guardaron para uso offline.`);
    if (source.warning === "cache_invalid") warnings.push(`${source.label}: se rechazó una caché incompatible.`);
  }
  return [...new Set(warnings)];
}
