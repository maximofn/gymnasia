import bundledCiqual from "./generated/ciqualBaseline.generated.json";
import type { CatalogSourceStatus, FoodCatalogEntry } from "./types";

// Datos versionados verificados por check:ciqual:mobile; sin descargas ni caché.
export const CIQUAL_FOODS = bundledCiqual.foods as unknown as FoodCatalogEntry[];
export const CIQUAL_ATTRIBUTION = bundledCiqual.attribution;
export const CIQUAL_SOURCE = {
  sourceId: "anses_ciqual_2025",
  label: "ANSES-CIQUAL 2025 (integrado)",
  provenance: {
    repositoryUrl: "https://github.com/maximofn/gymnasia",
    catalogPath: "alimentos/ciqual",
    attributionUrl: "https://github.com/maximofn/gymnasia/blob/main/alimentos/SOURCES.md",
    licenseLabel: "Licence Ouverte 2.0 — ANSES",
  },
} as const;

export const CIQUAL_STATUS: CatalogSourceStatus = {
  sourceId: CIQUAL_SOURCE.sourceId,
  label: CIQUAL_SOURCE.label,
  availability: "cached",
  fetchedAt: null,
  refreshing: false,
  cachePersisted: true,
  warning: null,
};
