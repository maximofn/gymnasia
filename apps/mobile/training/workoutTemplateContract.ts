import type { CatalogLink } from "../catalogs/types";
import {
  COMPOUND_SERIES_TYPES,
  TRAINING_SERIES_SCHEMA_VERSION,
  isSeriesType,
  seriesToLegacySets,
  type ExerciseSeries,
} from "./seriesContract";
import {
  ROUTINE_ICON_NAMES,
  TRAINING_CATEGORIES,
  cloneWorkoutTemplateSnapshot,
  type WorkoutTemplate,
} from "./workoutTemplateOperations";

export const WORKOUT_TEMPLATE_ISSUE_CODES = [
  "required",
  "unknown_value",
  "invalid_number",
  "not_integer",
  "not_positive",
  "negative",
  "out_of_range",
  "empty_collection",
  "compound_requires_sub_series",
  "superset_target_required",
  "invalid_catalog_link",
  "unsupported_schema_version",
] as const;

export type WorkoutTemplateIssueCode = (typeof WORKOUT_TEMPLATE_ISSUE_CODES)[number];

export type WorkoutTemplateIssue = {
  field: string;
  code: WorkoutTemplateIssueCode;
  message: string;
};

export type WorkoutTemplateWriteValidation =
  | { ok: true; value: WorkoutTemplate; issues: [] }
  | { ok: false; value: null; issues: WorkoutTemplateIssue[] };

function pushIssue(
  issues: WorkoutTemplateIssue[],
  field: string,
  code: WorkoutTemplateIssueCode,
  message: string,
): void {
  issues.push({ field, code, message });
}

function validateRequiredText(
  value: string | undefined,
  field: string,
  label: string,
  issues: WorkoutTemplateIssue[],
): void {
  if (!value?.trim()) pushIssue(issues, field, "required", `${label} es obligatorio.`);
}

function parseDecimalText(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?(?:\d+(?:[.,]\d+)?|\d+(?:\.\d+)?[eE][+-]?\d+)$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateNumericText(
  value: string | undefined,
  field: string,
  label: string,
  issues: WorkoutTemplateIssue[],
  options: { required: boolean; integer: boolean; positive: boolean; maximum?: number },
): void {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    if (options.required) pushIssue(issues, field, "required", `${label} es obligatorio.`);
    return;
  }
  const parsed = parseDecimalText(trimmed);
  if (parsed === null) {
    pushIssue(issues, field, "invalid_number", `${label} debe ser un número válido.`);
    return;
  }
  if (options.integer && !Number.isSafeInteger(parsed)) {
    pushIssue(issues, field, "not_integer", `${label} debe ser un número entero.`);
  }
  if (options.positive && parsed <= 0) {
    pushIssue(issues, field, "not_positive", `${label} debe ser mayor que cero.`);
  } else if (!options.positive && parsed < 0) {
    pushIssue(issues, field, "negative", `${label} no puede ser negativo.`);
  }
  if (options.maximum !== undefined && parsed > options.maximum) {
    pushIssue(
      issues,
      field,
      "out_of_range",
      `${label} no puede superar ${options.maximum}.`,
    );
  }
}

function validateCatalogLink(
  link: CatalogLink | undefined,
  field: string,
  issues: WorkoutTemplateIssue[],
): void {
  if (!link || link.status !== "linked") return;
  if (!link.ref.sourceId.trim() || !link.ref.itemId.trim()) {
    pushIssue(
      issues,
      field,
      "invalid_catalog_link",
      "La referencia de catálogo debe incluir source_id e item_id.",
    );
  }
}

function validateSeries(
  series: ExerciseSeries,
  field: string,
  issues: WorkoutTemplateIssue[],
): void {
  const seriesType = series.type ?? "normal";
  if (!isSeriesType(seriesType)) {
    pushIssue(issues, `${field}.type`, "unknown_value", `El tipo de serie "${seriesType}" no existe.`);
  }
  validateNumericText(series.reps, `${field}.reps`, "Las repeticiones", issues, {
    required: true,
    integer: true,
    positive: true,
  });
  validateNumericText(series.weight_kg, `${field}.weight_kg`, "El peso", issues, {
    required: false,
    integer: false,
    positive: false,
  });
  validateNumericText(series.rest_seconds, `${field}.rest_seconds`, "El descanso", issues, {
    required: false,
    integer: true,
    positive: false,
  });

  const tempoFields = [
    ["tempo_contraction", series.tempo_contraction, "La contracción del tempo"],
    ["tempo_pause", series.tempo_pause, "La pausa del tempo"],
    ["tempo_relaxation", series.tempo_relaxation, "La relajación del tempo"],
  ] as const;
  for (const [key, value, label] of tempoFields) {
    validateNumericText(value, `${field}.${key}`, label, issues, {
      required: seriesType === "tempo",
      integer: false,
      positive: false,
    });
  }

  const subSeries = series.sub_series ?? [];
  if ((COMPOUND_SERIES_TYPES as readonly string[]).includes(seriesType) && subSeries.length === 0) {
    pushIssue(
      issues,
      `${field}.sub_series`,
      "compound_requires_sub_series",
      `La serie ${seriesType} necesita al menos una subserie.`,
    );
  }
  subSeries.forEach((subSeriesItem, subSeriesIndex) => {
    const subField = `${field}.sub_series[${subSeriesIndex}]`;
    validateNumericText(subSeriesItem.reps, `${subField}.reps`, "Las repeticiones", issues, {
      required: true,
      integer: true,
      positive: true,
    });
    validateNumericText(subSeriesItem.weight_kg, `${subField}.weight_kg`, "El peso", issues, {
      required: false,
      integer: false,
      positive: false,
    });
    validateNumericText(subSeriesItem.rest_seconds, `${subField}.rest_seconds`, "El descanso", issues, {
      required: false,
      integer: true,
      positive: false,
    });
    validateCatalogLink(subSeriesItem.catalog_link, `${subField}.catalog_link`, issues);
    if (seriesType === "superset" && !subSeriesItem.exercise_name?.trim()) {
      pushIssue(
        issues,
        `${subField}.exercise_name`,
        "superset_target_required",
        "Cada subserie de una superserie necesita un ejercicio de catálogo o personalizado.",
      );
    }
  });
}

function firstPositiveNumber(series: readonly ExerciseSeries[], key: "weight_kg" | "rest_seconds"): number | null {
  const raw = series.find((item) => item[key].trim())?.[key] ?? "";
  const parsed = parseDecimalText(raw);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function validateWorkoutTemplateForWrite(
  template: WorkoutTemplate,
): WorkoutTemplateWriteValidation {
  const issues: WorkoutTemplateIssue[] = [];
  validateRequiredText(template.name, "name", "El nombre de la rutina", issues);
  if (!TRAINING_CATEGORIES.includes(template.category as (typeof TRAINING_CATEGORIES)[number])) {
    pushIssue(issues, "category", "unknown_value", "La categoría de la rutina no es válida.");
  }
  if (!ROUTINE_ICON_NAMES.includes(template.icon as (typeof ROUTINE_ICON_NAMES)[number])) {
    pushIssue(issues, "icon", "unknown_value", "El icono de la rutina no es válido.");
  }
  validateNumericText(
    template.duration_minutes,
    "duration_minutes",
    "La duración",
    issues,
    { required: false, integer: true, positive: true, maximum: 999 },
  );
  if (
    template.series_schema_version !== undefined
    && template.series_schema_version > TRAINING_SERIES_SCHEMA_VERSION
  ) {
    pushIssue(
      issues,
      "series_schema_version",
      "unsupported_schema_version",
      "La rutina usa una versión de series posterior a la que soporta esta app.",
    );
  }
  if (template.exercises.length === 0) {
    pushIssue(
      issues,
      "exercises",
      "empty_collection",
      "La rutina debe tener al menos un ejercicio.",
    );
  }
  template.exercises.forEach((exercise, exerciseIndex) => {
    const exerciseField = `exercises[${exerciseIndex}]`;
    validateRequiredText(exercise.name, `${exerciseField}.name`, "El nombre del ejercicio", issues);
    validateCatalogLink(exercise.catalog_link, `${exerciseField}.catalog_link`, issues);
    const series = exercise.series ?? [];
    if (series.length === 0) {
      pushIssue(
        issues,
        `${exerciseField}.series`,
        "empty_collection",
        "Cada ejercicio debe tener al menos una serie ejecutable.",
      );
    }
    series.forEach((seriesItem, seriesIndex) => {
      validateSeries(seriesItem, `${exerciseField}.series[${seriesIndex}]`, issues);
    });
  });
  if (issues.length > 0) return { ok: false, value: null, issues };

  const candidate = cloneWorkoutTemplateSnapshot(template);
  candidate.series_schema_version = TRAINING_SERIES_SCHEMA_VERSION;
  candidate.exercises = candidate.exercises.map((exercise) => {
    const series = exercise.series ?? [];
    return {
      ...exercise,
      sets: seriesToLegacySets(series),
      load_kg: firstPositiveNumber(series, "weight_kg"),
      rest_seconds: firstPositiveNumber(series, "rest_seconds"),
    };
  });
  return { ok: true, value: candidate, issues: [] };
}

export function formatWorkoutTemplateIssues(issues: readonly WorkoutTemplateIssue[]): string {
  const first = issues[0]?.message ?? "La rutina contiene datos no válidos.";
  const remaining = issues.length - 1;
  if (remaining === 1) return `${first} Queda 1 error por corregir.`;
  return remaining > 1 ? `${first} Quedan ${remaining} errores por corregir.` : first;
}
