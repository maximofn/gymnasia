import { normalizeCatalogItemRef, normalizeCatalogLink } from "../catalogs/migrations";
import { linkedCatalog, type CatalogLink } from "../catalogs/types";

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

/**
 * Versión que hay que sellar en una rutina tras normalizarla. Conserva un número
 * mayor que el soportado en vez de bajarlo: si una versión posterior de la app
 * escribió la rutina, marcarla como v1 mentiría sobre su contenido.
 */
export function sealedSeriesSchemaVersion(rawTemplate: unknown): number {
  const current = readSeriesSchemaVersion(rawTemplate);
  return current !== null && current > TRAINING_SERIES_SCHEMA_VERSION
    ? current
    : TRAINING_SERIES_SCHEMA_VERSION;
}

export type TrainingIssueCode =
  | "expected_object"
  | "expected_array"
  | "expected_string"
  | "missing_id"
  | "duplicate_id"
  | "unknown_series_type"
  | "invalid_tempo"
  | "invalid_catalog_link"
  | "unknown_schema_version";

/**
 * `repaired`: el dato se ha podido arreglar y la rutina sigue siendo utilizable.
 * `unrecoverable`: la estructura no era interpretable. Solo se emite en modo
 * estricto, y solo para códigos estructurales.
 */
export type TrainingIssueSeverity = "repaired" | "unrecoverable";

export type TrainingValidationIssue = {
  /** Ruta indexada dentro del almacén, p.ej. `templates[2].exercises[0].series[3].reps`. */
  field: string;
  code: TrainingIssueCode;
  severity: TrainingIssueSeverity;
  /** En español y legible: se muestra al usuario tal cual. */
  message: string;
};

export type TrainingValidationResult<T> =
  | { ok: true; value: T; issues: TrainingValidationIssue[] }
  | { ok: false; value: null; issues: TrainingValidationIssue[] };

export type TrainingNormalizationMode = "repair" | "strict";

/** Códigos que en modo estricto abortan en vez de repararse. */
const STRUCTURAL_CODES: readonly TrainingIssueCode[] = [
  "expected_object",
  "expected_array",
  "expected_string",
];

export type CreateId = (prefix: string) => string;

/**
 * Acumulador de incidencias. Las funciones de nivel hoja escriben aquí en vez de
 * devolver un resultado propio: así la ruta indexada se construye una sola vez,
 * al bajar, y no hay que remapearla en cada nivel al subir.
 */
export type TrainingIssueSink = {
  push(
    field: string,
    code: TrainingIssueCode,
    message: string,
  ): void;
  readonly issues: TrainingValidationIssue[];
};

export function createIssueSink(mode: TrainingNormalizationMode = "repair"): TrainingIssueSink {
  const issues: TrainingValidationIssue[] = [];
  return {
    issues,
    push(field, code, message) {
      const severity: TrainingIssueSeverity =
        mode === "strict" && STRUCTURAL_CODES.includes(code) ? "unrecoverable" : "repaired";
      issues.push({ field, code, severity, message });
    },
  };
}

export function resolveTrainingIssues<T>(
  value: T,
  sink: TrainingIssueSink,
): TrainingValidationResult<T> {
  const blocked = sink.issues.some((issue) => issue.severity === "unrecoverable");
  return blocked
    ? { ok: false, value: null, issues: sink.issues }
    : { ok: true, value, issues: sink.issues };
}

export function formatTrainingIssues(issues: readonly TrainingValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}

export function summarizeTrainingIssues(issues: readonly TrainingValidationIssue[]): {
  repaired: number;
  unrecoverable: number;
  byCode: Partial<Record<TrainingIssueCode, number>>;
} {
  const byCode: Partial<Record<TrainingIssueCode, number>> = {};
  let repaired = 0;
  let unrecoverable = 0;
  for (const issue of issues) {
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
    if (issue.severity === "unrecoverable") unrecoverable += 1;
    else repaired += 1;
  }
  return { repaired, unrecoverable, byCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Texto de un campo de serie. Un número se acepta y se convierte, porque los
 * almacenes antiguos guardaban repeticiones y pesos numéricos; cualquier otra
 * cosa se descarta con incidencia en vez de reventar más tarde en un `.trim()`.
 */
function normalizeSeriesText(
  rawValue: unknown,
  field: string,
  sink: TrainingIssueSink,
  label: string,
): string {
  if (rawValue === undefined || rawValue === null) return "";
  if (typeof rawValue === "string") return rawValue.trim();
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return `${rawValue}`;
  sink.push(field, "expected_string", `${label} tenía un formato no reconocido y se ha vaciado.`);
  return "";
}

function normalizeTempo(
  rawValue: unknown,
  field: string,
  sink: TrainingIssueSink,
): string | undefined {
  if (rawValue === undefined || rawValue === null) return undefined;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return `${rawValue}`;
  if (typeof rawValue !== "string") {
    sink.push(field, "invalid_tempo", "Un tiempo de tempo no era un texto y se ha descartado.");
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) {
    sink.push(field, "invalid_tempo", `El tempo "${trimmed}" no es un número y se ha descartado.`);
    return undefined;
  }
  return trimmed;
}

function normalizeSeriesCatalogLink(
  rawLink: unknown,
  legacyRef: unknown,
  field: string,
  sink: TrainingIssueSink,
): CatalogLink | undefined {
  const link = normalizeCatalogLink(rawLink);
  if (link) return link;
  const ref = normalizeCatalogItemRef(legacyRef);
  if (ref) return linkedCatalog(ref, "selection");
  if (rawLink !== undefined && rawLink !== null) {
    sink.push(
      field,
      "invalid_catalog_link",
      "El enlace con el catálogo de ejercicios no se ha reconocido y se ha soltado.",
    );
  }
  return undefined;
}

/** Reserva un identificador, regenerándolo si falta o si ya estaba en uso. */
function claimId(
  rawId: unknown,
  field: string,
  prefix: string,
  seen: Set<string>,
  createId: CreateId,
  sink: TrainingIssueSink,
): string {
  const candidate = typeof rawId === "string" ? rawId.trim() : "";
  if (!candidate) {
    sink.push(field, "missing_id", "Una serie no tenía identificador y se le ha asignado uno.");
    const generated = createId(prefix);
    seen.add(generated);
    return generated;
  }
  if (seen.has(candidate)) {
    sink.push(field, "duplicate_id", "Dos series compartían identificador y se ha renumerado una.");
    const generated = createId(prefix);
    seen.add(generated);
    return generated;
  }
  seen.add(candidate);
  return candidate;
}

export function normalizeSubSeries(
  rawValue: unknown,
  field: string,
  createId: CreateId,
  seen: Set<string>,
  sink: TrainingIssueSink,
): SubSeries {
  if (!isRecord(rawValue)) {
    sink.push(field, "expected_object", "Una mini-serie no era un objeto y se ha reconstruido vacía.");
    return { id: createId("sub"), reps: "", weight_kg: "", rest_seconds: "" };
  }
  const normalized: SubSeries = {
    id: claimId(rawValue.id, `${field}.id`, "sub", seen, createId, sink),
    reps: normalizeSeriesText(rawValue.reps, `${field}.reps`, sink, "Las repeticiones"),
    weight_kg: normalizeSeriesText(rawValue.weight_kg, `${field}.weight_kg`, sink, "El peso"),
    rest_seconds: normalizeSeriesText(
      rawValue.rest_seconds,
      `${field}.rest_seconds`,
      sink,
      "El descanso",
    ),
  };
  if (typeof rawValue.exercise_name === "string" && rawValue.exercise_name.trim()) {
    normalized.exercise_name = rawValue.exercise_name.trim();
  }
  if (typeof rawValue.exercise_id === "string" && rawValue.exercise_id.trim()) {
    normalized.exercise_id = rawValue.exercise_id.trim();
  }
  const link = normalizeSeriesCatalogLink(
    rawValue.catalog_link,
    rawValue.exercise_ref,
    `${field}.catalog_link`,
    sink,
  );
  if (link) normalized.catalog_link = link;
  return normalized;
}

export function normalizeSeries(
  rawValue: unknown,
  field: string,
  index: number,
  createId: CreateId,
  seen: Set<string>,
  sink: TrainingIssueSink,
): ExerciseSeries {
  if (!isRecord(rawValue)) {
    sink.push(field, "expected_object", "Una serie no era un objeto y se ha reconstruido vacía.");
    return { id: createId("set"), reps: `${index + 1}`, weight_kg: "", rest_seconds: "" };
  }

  const normalized: ExerciseSeries = {
    id: claimId(rawValue.id, `${field}.id`, "set", seen, createId, sink),
    reps:
      normalizeSeriesText(rawValue.reps, `${field}.reps`, sink, "Las repeticiones") ||
      `${index + 1}`,
    weight_kg: normalizeSeriesText(rawValue.weight_kg, `${field}.weight_kg`, sink, "El peso"),
    rest_seconds: normalizeSeriesText(
      rawValue.rest_seconds,
      `${field}.rest_seconds`,
      sink,
      "El descanso",
    ),
  };

  if (rawValue.type !== undefined && rawValue.type !== null) {
    if (isSeriesType(rawValue.type)) {
      normalized.type = rawValue.type;
    } else {
      sink.push(
        `${field}.type`,
        "unknown_series_type",
        `El tipo de serie "${String(rawValue.type)}" no existe y se ha dejado como normal.`,
      );
    }
  }

  const contraction = normalizeTempo(
    rawValue.tempo_contraction,
    `${field}.tempo_contraction`,
    sink,
  );
  const pause = normalizeTempo(rawValue.tempo_pause, `${field}.tempo_pause`, sink);
  const relaxation = normalizeTempo(
    rawValue.tempo_relaxation,
    `${field}.tempo_relaxation`,
    sink,
  );
  if (contraction !== undefined) normalized.tempo_contraction = contraction;
  if (pause !== undefined) normalized.tempo_pause = pause;
  if (relaxation !== undefined) normalized.tempo_relaxation = relaxation;

  // Las mini-series se conservan aunque el tipo sea simple: borrarlas sería
  // perder trabajo del usuario, que es justo lo que este contrato evita.
  if (rawValue.sub_series !== undefined && rawValue.sub_series !== null) {
    if (!Array.isArray(rawValue.sub_series)) {
      sink.push(
        `${field}.sub_series`,
        "expected_array",
        "Las mini-series de una serie no eran una lista y se han descartado.",
      );
    } else {
      const subSeen = new Set<string>();
      normalized.sub_series = rawValue.sub_series.map((subSeries, subIndex) =>
        normalizeSubSeries(
          subSeries,
          `${field}.sub_series[${subIndex}]`,
          createId,
          subSeen,
          sink,
        ),
      );
    }
  }

  return normalized;
}

/**
 * Series de un ejercicio. Si ya tiene `series`, se validan y reparan conservando
 * todo lo avanzado; si no, se derivan del formato heredado (`sets` numéricos más
 * `load_kg` y `rest_seconds` del ejercicio).
 */
export function buildSeriesFromLegacyExercise(
  exercise: unknown,
  field: string,
  createId: CreateId,
  sink: TrainingIssueSink,
): ExerciseSeries[] {
  if (!isRecord(exercise)) {
    sink.push(field, "expected_object", "Un ejercicio no era un objeto y se ha dejado sin series.");
    return [];
  }

  const rawSeries = exercise.series;
  if (rawSeries !== undefined && rawSeries !== null && !Array.isArray(rawSeries)) {
    sink.push(
      `${field}.series`,
      "expected_array",
      "Las series de un ejercicio no eran una lista y se han reconstruido.",
    );
  }

  if (Array.isArray(rawSeries) && rawSeries.length > 0) {
    const seen = new Set<string>();
    return rawSeries.map((item, index) =>
      normalizeSeries(item, `${field}.series[${index}]`, index, createId, seen, sink),
    );
  }

  const legacyWeight = exercise.load_kg;
  const legacyRest = exercise.rest_seconds;
  const rawSets = exercise.sets;
  if (rawSets !== undefined && rawSets !== null && !Array.isArray(rawSets)) {
    sink.push(
      `${field}.sets`,
      "expected_array",
      "Las repeticiones heredadas no eran una lista y se han descartado.",
    );
    return [];
  }

  return (Array.isArray(rawSets) ? rawSets : []).map((setValue, setIndex) => {
    const reps =
      typeof setValue === "number" && Number.isFinite(setValue) ? `${Math.round(setValue)}` : "";
    const weight =
      typeof legacyWeight === "number" && Number.isFinite(legacyWeight)
        ? `${Math.max(0, Math.round((legacyWeight - setIndex * 2) * 10) / 10)}`
        : "";
    const rest =
      typeof legacyRest === "number" && Number.isFinite(legacyRest)
        ? `${Math.max(0, Math.round(legacyRest))}`
        : "";
    return { id: createId("set"), reps, weight_kg: weight, rest_seconds: rest };
  });
}

function extractFirstPositiveInt(rawValue: string): number | null {
  const match = rawValue.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export { extractFirstPositiveInt };

/**
 * Proyección al formato heredado `sets: number[]`, que la app sigue guardando por
 * compatibilidad. Una serie sin repeticiones legibles no aporta ninguna entrada,
 * así que el resultado puede ser más corto que la lista de series.
 */
export function seriesToLegacySets(series: readonly ExerciseSeries[]): number[] {
  return series
    .map((item) => extractFirstPositiveInt(item.reps))
    .filter((value): value is number => value !== null);
}
