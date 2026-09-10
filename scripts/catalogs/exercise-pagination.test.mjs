import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import fc from "fast-check";

import {
  EXERCISE_CATALOG_PAGE_SIZE,
  createExerciseCatalogArtifacts,
  exerciseSearchAnchor,
  exerciseSearchShardId,
  hashCatalogValue,
  normalizeExerciseSearchText,
} from "./exercise-pagination.mjs";

function exercise(id, overrides = {}) {
  return {
    id,
    name: `Ejercicio ${id}`,
    image_male: `images/${id}-male.webp`,
    image_female: `images/${id}-female.webp`,
    muscle_group: "pierna",
    secondary_muscles: ["glúteos"],
    equipment: "peso corporal",
    difficulty: "beginner",
    instructions: `Instrucciones para ${id}`,
    ...overrides,
  };
}

function parsedArtifact(result, relativePath) {
  const artifact = result.artifacts.find((candidate) => (
    candidate.path.endsWith(join("catalog-v1", relativePath))
  ));
  assert.ok(artifact, `falta ${relativePath}`);
  return JSON.parse(artifact.contents);
}

function searchNames(result, query) {
  const anchor = exerciseSearchAnchor(query);
  assert.ok(anchor);
  const shardId = exerciseSearchShardId(anchor);
  const descriptor = result.manifest.search.shards.find((candidate) => candidate.shardId === shardId);
  if (!descriptor) return [];
  const shard = parsedArtifact(result, descriptor.path);
  const normalized = normalizeExerciseSearchText(query);
  return (shard.postings.name[anchor] ?? [])
    .map((index) => shard.documents[index])
    .filter((tuple) => normalizeExerciseSearchText(tuple[3]).includes(normalized))
    .sort((left, right) => left[0] - right[0])
    .map((tuple) => tuple[3]);
}

test("pagina 30 elementos, conserva cada identidad y publica hashes verificables", () => {
  const entries = Array.from({ length: 67 }, (_, index) => exercise(`e-${String(index).padStart(3, "0")}`));
  const result = createExerciseCatalogArtifacts("/catalog", entries);
  assert.equal(result.manifest.pageSize, EXERCISE_CATALOG_PAGE_SIZE);
  assert.deepEqual(result.manifest.pages.map((page) => page.count), [30, 30, 7]);
  const concatenated = result.manifest.pages.flatMap((descriptor) => {
    const page = parsedArtifact(result, descriptor.path);
    assert.equal(hashCatalogValue(page), descriptor.contentHashSha256);
    return page.items.map((entry) => `${result.manifest.sourceId}:${entry.id}`);
  });
  assert.deepEqual(concatenated, entries.map((entry) => `gymnasia_exercises:${entry.id}`));
  assert.equal(new Set(concatenated).size, entries.length);
});

test("la búsqueda global encuentra coincidencias con tildes fuera de la primera página", () => {
  const entries = Array.from({ length: 65 }, (_, index) => exercise(`e-${String(index).padStart(3, "0")}`));
  entries[61] = exercise("curl-zottman", { name: "Cúrl Zottman" });
  const result = createExerciseCatalogArtifacts("/catalog", entries);
  assert.deepEqual(searchNames(result, "curl"), ["Cúrl Zottman"]);
  assert.equal(result.summaries[61][1], 2);
});

test("particiones aleatorias conservan IDs y buscar equivale a filtrar el catálogo", () => {
  fc.assert(fc.property(
    fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9-]{1,16}$/), { minLength: 1, maxLength: 160 }),
    fc.constantFrom("curl", "pierna", "barra", "facil", "a"),
    (ids, query) => {
      const entries = ids.sort().map((id, index) => exercise(id, {
        name: index % 5 === 0 ? `Curl ${id}` : `Movimiento ${id}`,
        muscle_group: index % 3 === 0 ? "pierna" : "espalda",
        equipment: index % 4 === 0 ? "barra" : "mancuerna",
        difficulty: index % 2 === 0 ? "fácil" : "media",
      }));
      const result = createExerciseCatalogArtifacts("/catalog", entries);
      const pageIds = result.manifest.pages.flatMap((descriptor) => (
        parsedArtifact(result, descriptor.path).items.map((entry) => entry.id)
      ));
      assert.deepEqual(pageIds, entries.map((entry) => entry.id));
      const expected = entries
        .filter((entry) => normalizeExerciseSearchText(entry.name).includes(normalizeExerciseSearchText(query)))
        .map((entry) => entry.name);
      assert.deepEqual(searchNames(result, query), expected);
    },
  ), { numRuns: 100 });
});
