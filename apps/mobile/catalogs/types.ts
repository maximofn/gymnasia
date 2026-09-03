export const CATALOG_LINK_SCHEMA_VERSION = 1 as const;
export const CATALOG_CACHE_SCHEMA_VERSION = 1 as const;
export const CATALOG_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const CATALOG_SOURCE_IDS = [
  "gymnasia_foods",
  "gymnasia_products",
  "gymnasia_recipes",
  "gymnasia_exercises",
  "user_personal_foods",
] as const;

export type CatalogSourceId = (typeof CATALOG_SOURCE_IDS)[number];
export type RemoteCatalogSourceId = Exclude<CatalogSourceId, "user_personal_foods">;
export type FoodCatalogSourceId = Exclude<CatalogSourceId, "gymnasia_exercises">;

export type CatalogItemRef = {
  schemaVersion: typeof CATALOG_LINK_SCHEMA_VERSION;
  sourceId: CatalogSourceId;
  itemId: string;
};

export type CatalogLink =
  | {
      schemaVersion: typeof CATALOG_LINK_SCHEMA_VERSION;
      status: "linked";
      ref: CatalogItemRef;
      linkedBy: "selection" | "tool" | "legacy_exact" | "legacy_alias";
    }
  | {
      schemaVersion: typeof CATALOG_LINK_SCHEMA_VERSION;
      status: "unresolved";
      reason: "manual" | "external_estimate" | "legacy_unknown" | "ambiguous" | "not_found";
    };

export type RawFoodCatalogEntry = {
  id: string;
  name: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  serving_size_g: number;
  serving_description: string;
  image?: string;
};

export type LegacyFoodSource = "alimento" | "producto_comercial" | "receta" | "personal";

export type FoodCatalogEntry = RawFoodCatalogEntry & {
  sourceId: FoodCatalogSourceId;
  source: LegacyFoodSource;
};

export type RawExerciseCatalogEntry = {
  id: string;
  name: string;
  image_male: string;
  image_female: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string;
  instructions: string;
};

export type ExerciseCatalogEntry = RawExerciseCatalogEntry & {
  sourceId: "gymnasia_exercises";
};

export type CatalogProvenance = {
  repositoryUrl: string;
  catalogPath: string;
  attributionUrl?: string;
  licenseLabel?: string;
};

export type CatalogCacheEnvelope<T> = {
  schemaVersion: typeof CATALOG_CACHE_SCHEMA_VERSION;
  sourceId: RemoteCatalogSourceId;
  fetchedAt: string | null;
  contentHashSha256: `sha256:${string}`;
  etag?: string | null;
  provenance?: CatalogProvenance;
  data: T[];
};

export type CatalogAvailability = "fresh" | "cached" | "stale" | "unavailable";
export type CatalogAggregateAvailability = CatalogAvailability | "partial";

export type CatalogSnapshot<T> = {
  sourceId: RemoteCatalogSourceId;
  label: string;
  availability: CatalogAvailability;
  data: T[];
  fetchedAt: string | null;
  refreshing: boolean;
  cachePersisted: boolean;
  warning: "remote_failed" | "cache_write_failed" | "cache_invalid" | null;
  provenance: CatalogProvenance;
};

export type CatalogSourceStatus = Pick<
  CatalogSnapshot<unknown>,
  "label" | "availability" | "fetchedAt" | "refreshing" | "cachePersisted" | "warning"
> & { sourceId: CatalogSourceId };

export type CatalogSearchAvailability = {
  availability: CatalogAggregateAvailability;
  fetchedAt: string | null;
  sources: CatalogSourceStatus[];
  warnings: string[];
};

export type CatalogMatch<T> =
  | { kind: "exact"; candidate: T }
  | { kind: "alias"; candidate: T }
  | { kind: "ambiguous"; candidates: T[] }
  | { kind: "not_found" };

export function linkedCatalog(
  ref: CatalogItemRef,
  linkedBy: Extract<CatalogLink, { status: "linked" }>["linkedBy"],
): CatalogLink {
  return { schemaVersion: CATALOG_LINK_SCHEMA_VERSION, status: "linked", ref, linkedBy };
}

export function unresolvedCatalog(
  reason: Extract<CatalogLink, { status: "unresolved" }>["reason"],
): CatalogLink {
  return { schemaVersion: CATALOG_LINK_SCHEMA_VERSION, status: "unresolved", reason };
}

export function catalogRef(sourceId: CatalogSourceId, itemId: string): CatalogItemRef {
  return { schemaVersion: CATALOG_LINK_SCHEMA_VERSION, sourceId, itemId };
}
