import { SERIES_TYPES, type SeriesType } from "./seriesContract";

export type SeriesTypeMeta = {
  label: string;
  short: string;
  color?: string;
};

/**
 * Etiquetas visibles de cada tipo de serie. Separadas del contrato para que un
 * cambio de copy o de color no toque el módulo que protege la integridad de los
 * datos guardados.
 */
export const SERIES_TYPE_META: Record<SeriesType, SeriesTypeMeta> = {
  normal:    { label: "Normal",         short: "N" },
  warmup:    { label: "Calentamiento",  short: "🔥", color: "#FF4A4A" },
  failure:   { label: "Al fallo",       short: "F" },
  amrap:     { label: "AMRAP",          short: "A" },
  partial:   { label: "Parcial",        short: "P" },
  negative:  { label: "Negativa",       short: "—" },
  forced:    { label: "Forzada",        short: "F+" },
  tempo:     { label: "Tempo",          short: "T" },
  isometric: { label: "Isométrica",     short: "I" },
  dropset:   { label: "Drop set",       short: "DS" },
  restpause: { label: "Rest-Pause",     short: "RP" },
  myoreps:   { label: "Myo-Reps",       short: "MR" },
  cluster:   { label: "Cluster",        short: "CL" },
  superset:  { label: "Superserie",     short: "SS" },
};

/**
 * Orden del selector de tipo de serie. Se deriva del dominio, no de las claves de
 * `SERIES_TYPE_META`: cuando salía de ahí, reordenar las etiquetas reordenaba el
 * selector sin que nadie lo pidiera.
 */
export const ALL_SERIES_TYPES: readonly SeriesType[] = SERIES_TYPES;

export function seriesTypeShortLabel(type: SeriesType | undefined): string {
  return SERIES_TYPE_META[type ?? "normal"].short;
}
