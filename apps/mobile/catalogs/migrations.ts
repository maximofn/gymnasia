import {
  CATALOG_LINK_SCHEMA_VERSION,
  CATALOG_SOURCE_IDS,
  catalogRef,
  linkedCatalog,
  unresolvedCatalog,
  type CatalogItemRef,
  type CatalogLink,
  type ExerciseCatalogEntry,
} from "./types";
import { findByCatalogRef, matchExerciseCatalog, migrateCatalogItemRef } from "./matching";

type StoredExercise = {
  name?: string;
  image_uri?: string | null;
  muscle?: string;
  catalog_link?: CatalogLink;
  series?: Array<{
    sub_series?: Array<{
      exercise_name?: string;
      catalog_link?: CatalogLink;
    }>;
  }>;
};

type StoredTemplate<TExercise extends StoredExercise> = {
  exercises: TExercise[];
};

export function normalizeCatalogItemRef(value: unknown): CatalogItemRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CatalogItemRef>;
  if (candidate.schemaVersion !== CATALOG_LINK_SCHEMA_VERSION
    || !CATALOG_SOURCE_IDS.includes(candidate.sourceId as CatalogItemRef["sourceId"])
    || typeof candidate.itemId !== "string"
    || !candidate.itemId.trim()) {
    return null;
  }
  return migrateCatalogItemRef(catalogRef(candidate.sourceId!, candidate.itemId.trim()));
}

export function normalizeCatalogLink(
  value: unknown,
  fallbackReason: Extract<CatalogLink, { status: "unresolved" }>["reason"] | null = null,
): CatalogLink | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallbackReason ? unresolvedCatalog(fallbackReason) : undefined;
  }
  const candidate = value as Partial<CatalogLink>;
  if (candidate.schemaVersion !== CATALOG_LINK_SCHEMA_VERSION) {
    return fallbackReason ? unresolvedCatalog(fallbackReason) : undefined;
  }
  if (candidate.status === "linked") {
    const ref = normalizeCatalogItemRef(candidate.ref);
    const linkedBy = candidate.linkedBy;
    if (ref && (linkedBy === "selection" || linkedBy === "tool"
      || linkedBy === "legacy_exact" || linkedBy === "legacy_alias")) {
      return linkedCatalog(ref, linkedBy);
    }
  }
  if (candidate.status === "unresolved"
    && (candidate.reason === "manual" || candidate.reason === "external_estimate"
      || candidate.reason === "legacy_unknown" || candidate.reason === "ambiguous"
      || candidate.reason === "not_found")) {
    return unresolvedCatalog(candidate.reason);
  }
  return fallbackReason ? unresolvedCatalog(fallbackReason) : undefined;
}

export function linkLegacyExercisesFromFreshCatalog<
  TExercise extends StoredExercise,
  TTemplate extends StoredTemplate<TExercise>,
>(templates: TTemplate[], catalog: ExerciseCatalogEntry[]): { templates: TTemplate[]; changed: boolean } {
  let changed = false;
  const nextTemplates = templates.map((template) => {
    let templateChanged = false;
    const exercises = template.exercises.map((exercise) => {
      let exerciseChanged = false;
      let catalogLink = exercise.catalog_link;
      if (!catalogLink) {
        const match = matchExerciseCatalog(catalog, exercise.name);
        if (match.kind === "exact" || match.kind === "alias") {
          catalogLink = linkedCatalog(
            catalogRef(match.candidate.sourceId, match.candidate.id),
            match.kind === "exact" ? "legacy_exact" : "legacy_alias",
          );
          exerciseChanged = true;
        }
      }
      const series = exercise.series?.map((seriesItem) => {
        let seriesChanged = false;
        const subSeries = seriesItem.sub_series?.map((subSeriesItem) => {
          if (subSeriesItem.catalog_link || !subSeriesItem.exercise_name) return subSeriesItem;
          const match = matchExerciseCatalog(catalog, subSeriesItem.exercise_name);
          if (match.kind !== "exact" && match.kind !== "alias") return subSeriesItem;
          seriesChanged = true;
          return {
            ...subSeriesItem,
            catalog_link: linkedCatalog(
              catalogRef(match.candidate.sourceId, match.candidate.id),
              match.kind === "exact" ? "legacy_exact" : "legacy_alias",
            ),
          };
        });
        if (!seriesChanged) return seriesItem;
        exerciseChanged = true;
        return { ...seriesItem, sub_series: subSeries };
      });
      if (!exerciseChanged) return exercise;
      changed = true;
      templateChanged = true;
      return { ...exercise, catalog_link: catalogLink, series } as TExercise;
    });
    return templateChanged ? { ...template, exercises } : template;
  });
  return { templates: nextTemplates, changed };
}

export function synchronizeLinkedExercises<
  TExercise extends StoredExercise,
  TTemplate extends StoredTemplate<TExercise>,
>(templates: TTemplate[], catalog: ExerciseCatalogEntry[], imageUri: (entry: ExerciseCatalogEntry) => string): {
  templates: TTemplate[];
  changed: boolean;
} {
  let changed = false;
  const nextTemplates = templates.map((template) => {
    let templateChanged = false;
    const exercises = template.exercises.map((exercise) => {
      let exerciseChanged = false;
      let nextExercise = exercise;
      if (exercise.catalog_link?.status === "linked") {
        const candidate = findByCatalogRef(catalog, exercise.catalog_link.ref);
        if (candidate) {
          const nextImage = imageUri(candidate);
          if (exercise.name !== candidate.name
            || exercise.muscle !== candidate.muscle_group
            || exercise.image_uri !== nextImage) {
            nextExercise = {
              ...exercise,
              name: candidate.name,
              muscle: candidate.muscle_group,
              image_uri: nextImage,
            } as TExercise;
            exerciseChanged = true;
          }
        }
      }
      const series = nextExercise.series?.map((seriesItem) => {
        let seriesChanged = false;
        const subSeries = seriesItem.sub_series?.map((subSeriesItem) => {
          if (subSeriesItem.catalog_link?.status !== "linked") return subSeriesItem;
          const candidate = findByCatalogRef(catalog, subSeriesItem.catalog_link.ref);
          if (!candidate || subSeriesItem.exercise_name === candidate.name) return subSeriesItem;
          seriesChanged = true;
          return { ...subSeriesItem, exercise_name: candidate.name };
        });
        if (!seriesChanged) return seriesItem;
        exerciseChanged = true;
        return { ...seriesItem, sub_series: subSeries };
      });
      if (!exerciseChanged) return exercise;
      changed = true;
      templateChanged = true;
      return { ...nextExercise, series } as TExercise;
    });
    return templateChanged ? { ...template, exercises } : template;
  });
  return { templates: nextTemplates, changed };
}
