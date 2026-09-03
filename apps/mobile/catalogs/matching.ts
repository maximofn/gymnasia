import {
  CATALOG_LINK_SCHEMA_VERSION,
  type CatalogItemRef,
  type CatalogMatch,
  type CatalogSourceId,
} from "./types";

type MatchCandidate = {
  id: string;
  name: string;
  sourceId: CatalogSourceId;
};

const EXERCISE_MATCH_STOPWORDS = new Set([
  "con", "de", "del", "en", "el", "la", "los", "las", "y", "a", "para", "sin",
]);

export function normalizeCatalogName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function exerciseCatalogMatchKey(value: string | null | undefined): string {
  return normalizeCatalogName(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !EXERCISE_MATCH_STOPWORDS.has(token))
    .map((token) => token.replace(/es$/, "").replace(/s$/, ""))
    .sort()
    .join(" ");
}

function stableCandidates<T extends MatchCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((left, right) => (
    left.sourceId.localeCompare(right.sourceId) || left.id.localeCompare(right.id)
  ));
}

function resultForCandidates<T extends MatchCandidate>(
  candidates: T[],
  kind: "exact" | "alias",
): CatalogMatch<T> {
  const stable = stableCandidates(candidates);
  if (stable.length === 0) return { kind: "not_found" };
  if (stable.length > 1) return { kind: "ambiguous", candidates: stable };
  return { kind, candidate: stable[0] };
}

export function matchFoodCatalog<T extends MatchCandidate>(
  entries: T[],
  rawName: string | null | undefined,
): CatalogMatch<T> {
  const needle = normalizeCatalogName(rawName);
  if (!needle) return { kind: "not_found" };
  const exact = entries.filter((entry) => normalizeCatalogName(entry.name) === needle);
  if (exact.length > 0) return resultForCandidates(exact, "exact");
  return resultForCandidates(entries.filter((entry) => {
    const candidate = normalizeCatalogName(entry.name);
    return candidate.includes(needle) || needle.includes(candidate);
  }), "alias");
}

export function matchExerciseCatalog<T extends MatchCandidate>(
  entries: T[],
  rawName: string | null | undefined,
): CatalogMatch<T> {
  const needle = normalizeCatalogName(rawName);
  if (!needle) return { kind: "not_found" };
  const exact = entries.filter((entry) => normalizeCatalogName(entry.name) === needle);
  if (exact.length > 0) return resultForCandidates(exact, "exact");
  const key = exerciseCatalogMatchKey(rawName);
  if (!key) return { kind: "not_found" };
  return resultForCandidates(
    entries.filter((entry) => exerciseCatalogMatchKey(entry.name) === key),
    "alias",
  );
}

export const CATALOG_ID_ALIASES: Readonly<Partial<Record<CatalogSourceId, Readonly<Record<string, string>>>>> = {
  gymnasia_foods: {},
  gymnasia_products: {},
  gymnasia_recipes: {},
  gymnasia_exercises: {},
  user_personal_foods: {},
};

export function migrateCatalogItemRef(ref: CatalogItemRef): CatalogItemRef {
  const migratedItemId = CATALOG_ID_ALIASES[ref.sourceId]?.[ref.itemId] ?? ref.itemId;
  return {
    schemaVersion: CATALOG_LINK_SCHEMA_VERSION,
    sourceId: ref.sourceId,
    itemId: migratedItemId,
  };
}

export function findByCatalogRef<T extends MatchCandidate>(entries: T[], ref: CatalogItemRef): T | null {
  const migrated = migrateCatalogItemRef(ref);
  return entries.find((entry) => entry.sourceId === migrated.sourceId && entry.id === migrated.itemId) ?? null;
}
