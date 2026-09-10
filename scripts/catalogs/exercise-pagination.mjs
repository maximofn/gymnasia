import { createHash } from "node:crypto";
import { join } from "node:path";

export const EXERCISE_CATALOG_SCHEMA_VERSION = 1;
export const EXERCISE_CATALOG_PAGE_SIZE = 30;
export const EXERCISE_CATALOG_STALE_AFTER_SECONDS = 7 * 24 * 60 * 60;
export const EXERCISE_CATALOG_DIRECTORY = "catalog-v1";

export const EXERCISE_SEARCH_FIELDS = Object.freeze([
  "name",
  "muscle_group",
  "secondary_muscles",
  "equipment",
  "difficulty",
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalCatalogJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function hashCatalogValue(value) {
  return `sha256:${createHash("sha256").update(canonicalCatalogJson(value)).digest("hex")}`;
}

export function normalizeExerciseSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function exerciseSearchGrams(value) {
  const normalized = normalizeExerciseSearchText(value);
  if (!normalized) return [];
  const grams = new Set(normalized);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return [...grams].sort();
}

export function exerciseSearchAnchor(value) {
  const normalized = normalizeExerciseSearchText(value);
  if (!normalized) return null;
  return normalized.length === 1 ? normalized : normalized.slice(0, 2);
}

export function exerciseSearchShardId(gram) {
  if (!gram) return null;
  return Buffer.from(gram[0], "utf8").toString("hex");
}

export const EXERCISE_SEARCH_DOCUMENT_FIELDS = Object.freeze([
  "ordinal",
  "page",
  "id",
  "name",
  "image_male",
  "image_female",
  "muscle_group",
  "secondary_muscles",
  "equipment",
  "difficulty",
]);

function summaryFor(entry, ordinal, page) {
  return [
    ordinal,
    page,
    entry.id,
    entry.name,
    entry.image_male,
    entry.image_female,
    entry.muscle_group,
    entry.secondary_muscles,
    entry.equipment,
    entry.difficulty,
  ];
}

function searchValues(entry) {
  return {
    name: [entry.name],
    muscle_group: [entry.muscle_group],
    secondary_muscles: entry.secondary_muscles,
    equipment: [entry.equipment],
    difficulty: [entry.difficulty],
  };
}

function addPosting(shards, shardId, field, gram, ordinal) {
  let shard = shards.get(shardId);
  if (!shard) {
    shard = new Map(EXERCISE_SEARCH_FIELDS.map((name) => [name, new Map()]));
    shards.set(shardId, shard);
  }
  const postings = shard.get(field);
  const ordinals = postings.get(gram) ?? new Set();
  ordinals.add(ordinal);
  postings.set(gram, ordinals);
}

function artifact(domain, path, value, pretty = false) {
  return {
    domain,
    path,
    contents: `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`,
  };
}

export function createExerciseCatalogArtifacts(catalogRoot, entries) {
  const domain = "ejercicios";
  const generatedRoot = join(catalogRoot, EXERCISE_CATALOG_DIRECTORY);
  const catalogVersion = hashCatalogValue(entries);
  const summaries = entries.map((entry, ordinal) => (
    summaryFor(entry, ordinal, Math.floor(ordinal / EXERCISE_CATALOG_PAGE_SIZE))
  ));
  const pages = [];
  const artifacts = [];

  for (let offset = 0; offset < entries.length; offset += EXERCISE_CATALOG_PAGE_SIZE) {
    const page = Math.floor(offset / EXERCISE_CATALOG_PAGE_SIZE);
    const pageValue = {
      schemaVersion: EXERCISE_CATALOG_SCHEMA_VERSION,
      catalogVersion,
      page,
      items: entries.slice(offset, offset + EXERCISE_CATALOG_PAGE_SIZE),
    };
    const path = `pages/${String(page).padStart(4, "0")}.json`;
    pages.push({
      page,
      path,
      count: pageValue.items.length,
      contentHashSha256: hashCatalogValue(pageValue),
    });
    artifacts.push(artifact(domain, join(generatedRoot, path), pageValue));
  }

  const directoryGroups = new Map();
  for (const [ordinal, entry] of entries.entries()) {
    const shardId = Buffer.from(entry.id[0] ?? "_", "utf8").toString("hex");
    const existing = directoryGroups.get(shardId) ?? {};
    existing[entry.id] = [ordinal, Math.floor(ordinal / EXERCISE_CATALOG_PAGE_SIZE)];
    directoryGroups.set(shardId, existing);
  }
  const directory = [];
  for (const [shardId, records] of [...directoryGroups].sort(([left], [right]) => left.localeCompare(right))) {
    const value = {
      schemaVersion: EXERCISE_CATALOG_SCHEMA_VERSION,
      catalogVersion,
      shardId,
      records,
    };
    const path = `by-id/${shardId}.json`;
    directory.push({ shardId, path, count: Object.keys(records).length, contentHashSha256: hashCatalogValue(value) });
    artifacts.push(artifact(domain, join(generatedRoot, path), value));
  }

  const postingGroups = new Map();
  for (const [ordinal, entry] of entries.entries()) {
    for (const [field, values] of Object.entries(searchValues(entry))) {
      for (const value of values) {
        for (const gram of exerciseSearchGrams(value)) {
          addPosting(postingGroups, exerciseSearchShardId(gram), field, gram, ordinal);
        }
      }
    }
  }

  const search = [];
  for (const [shardId, fields] of [...postingGroups].sort(([left], [right]) => left.localeCompare(right))) {
    const referencedOrdinals = new Set();
    for (const postings of fields.values()) {
      for (const ordinals of postings.values()) {
        for (const ordinal of ordinals) referencedOrdinals.add(ordinal);
      }
    }
    const shardOrdinals = [...referencedOrdinals].sort((left, right) => left - right);
    const localIndex = new Map(shardOrdinals.map((ordinal, index) => [ordinal, index]));
    const postings = Object.fromEntries(EXERCISE_SEARCH_FIELDS.map((field) => [
      field,
      Object.fromEntries(
        [...fields.get(field)].sort(([left], [right]) => left.localeCompare(right)).map(([gram, ordinals]) => [
          gram,
          [...ordinals].sort((left, right) => left - right).map((ordinal) => localIndex.get(ordinal)),
        ]),
      ),
    ]));
    const value = {
      schemaVersion: EXERCISE_CATALOG_SCHEMA_VERSION,
      catalogVersion,
      shardId,
      documents: shardOrdinals.map((ordinal) => summaries[ordinal]),
      postings,
    };
    const path = `search/${shardId}.json`;
    search.push({ shardId, path, count: value.documents.length, contentHashSha256: hashCatalogValue(value) });
    artifacts.push(artifact(domain, join(generatedRoot, path), value));
  }

  const muscleCounts = new Map();
  for (const entry of entries) {
    muscleCounts.set(entry.muscle_group, (muscleCounts.get(entry.muscle_group) ?? 0) + 1);
  }
  const manifest = {
    schemaVersion: EXERCISE_CATALOG_SCHEMA_VERSION,
    catalogVersion,
    sourceId: "gymnasia_exercises",
    itemCount: entries.length,
    pageSize: EXERCISE_CATALOG_PAGE_SIZE,
    pageCount: pages.length,
    staleAfterSeconds: EXERCISE_CATALOG_STALE_AFTER_SECONDS,
    pages,
    search: {
      strategy: "normalized-unigram-bigram-v1",
      fields: EXERCISE_SEARCH_FIELDS,
      documentFields: EXERCISE_SEARCH_DOCUMENT_FIELDS,
      shards: search,
    },
    directory: {
      strategy: "first-id-byte-v1",
      shards: directory,
    },
    muscleGroups: [...muscleCounts]
      .sort(([left], [right]) => left.localeCompare(right, "es"))
      .map(([value, count]) => ({ value, normalized: normalizeExerciseSearchText(value), count })),
  };
  artifacts.push(artifact(domain, join(generatedRoot, "manifest.json"), manifest, true));

  return { artifacts, manifest, summaries };
}
