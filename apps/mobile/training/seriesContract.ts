import type { CatalogLink } from "../catalogs/types";

/**
 * Versión del esquema de series que sella esta app en cada rutina normalizada.
 * Vive por rutina y no en la raíz del almacén: `validateLocalStoreTree` rechaza
 * cualquier clave raíz desconocida y bloquearía la app en la pantalla de
 * recuperación, mientras que `validateTemplate` sí tolera claves nuevas dentro
 * de la rutina.
 */
export const TRAINING_SERIES_SCHEMA_VERSION = 1 as const;

/**
 * Los tipos de serie como valor, no solo como tipo: sin esta lista en tiempo de
 * ejecución no se puede validar un `type` leído del almacén.
 */
export const SERIES_TYPES = [
  "normal",
  "warmup",
  "failure",
  "amrap",
  "partial",
  "negative",
  "forced",
  "tempo",
  "isometric",
  "dropset",
  "restpause",
  "myoreps",
  "cluster",
  "superset",
] as const;

export type SeriesType = (typeof SERIES_TYPES)[number];

/** Tipos cuyas series contienen mini-series. */
export const COMPOUND_SERIES_TYPES = [
  "dropset",
  "restpause",
  "myoreps",
  "cluster",
  "superset",
] as const satisfies readonly SeriesType[];

export type CompoundSeriesType = (typeof COMPOUND_SERIES_TYPES)[number];

export type SubSeries = {
  id: string;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
  exercise_name?: string;
  exercise_id?: string;
  catalog_link?: CatalogLink;
};

export type ExerciseSeries = {
  id: string;
  type?: SeriesType;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
  tempo_contraction?: string;
  tempo_pause?: string;
  tempo_relaxation?: string;
  sub_series?: SubSeries[];
};

export function isSeriesType(value: unknown): value is SeriesType {
  return typeof value === "string" && (SERIES_TYPES as readonly string[]).includes(value);
}

export function isCompoundSeriesType(value: unknown): value is CompoundSeriesType {
  return typeof value === "string" && (COMPOUND_SERIES_TYPES as readonly string[]).includes(value);
}

/**
 * Lee la versión sellada en una rutina cruda. Devuelve `null` para todo lo que no
 * sea un entero positivo: ausente, texto, cero, decimal o `NaN` significan lo
 * mismo, que la rutina es anterior al sellado y hay que migrarla.
 */
export function readSeriesSchemaVersion(rawTemplate: unknown): number | null {
  if (!rawTemplate || typeof rawTemplate !== "object") return null;
  const raw = (rawTemplate as { series_schema_version?: unknown }).series_schema_version;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) return null;
  return raw;
}
