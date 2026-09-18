import {
  validateMeasurementMetric,
  type MeasurementPatch,
} from "./measurementContract";

/**
 * Peso y altura escritos en el plan de dieta.
 *
 * El plan no guarda estos valores por su cuenta: al confirmar, se escriben como
 * medición de hoy en Medidas, que es la única fuente de verdad del peso y la
 * altura. Este módulo decide qué se escribe y qué valor efectivo usan los
 * cálculos mientras el usuario edita.
 */
export type BodyMetricsDraft = {
  weightInput: string;
  heightInput: string;
};

export type BodyMetricsLatest = {
  latestWeightKg: number | null;
  latestHeightCm: number | null;
};

export type ResolvedBodyMetrics = {
  /** Peso que usan Calcular y los macros por g/kg: el borrador si es válido, si no el último registrado. */
  weightKg: number | null;
  heightCm: number | null;
  weightIssue: string | null;
  heightIssue: string | null;
  hasIssues: boolean;
  /** Solo los campos válidos, no vacíos y distintos del último valor registrado. */
  patch: MeasurementPatch;
};

export const BODY_METRIC_ISSUE_MESSAGES = {
  weight_kg: "Introduce un peso válido, mayor que cero.",
  height_cm: "Introduce una altura válida, mayor que cero.",
} as const;

export function formatBodyMetricInput(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

export function parseBodyMetricInput(
  field: "weight_kg" | "height_cm",
  rawValue: string,
): { value: number | null; invalid: boolean } {
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) return { value: null, invalid: false };
  const parsed = validateMeasurementMetric(field, trimmed, { allowNumericString: true });
  return { value: parsed.ok ? parsed.value : null, invalid: !parsed.ok };
}

export function resolveBodyMetricsDraft(
  draft: BodyMetricsDraft,
  latest: BodyMetricsLatest,
): ResolvedBodyMetrics {
  const weight = parseBodyMetricInput("weight_kg", draft.weightInput);
  const height = parseBodyMetricInput("height_cm", draft.heightInput);
  const patch: MeasurementPatch = {};
  if (weight.value !== null && weight.value !== latest.latestWeightKg) patch.weight_kg = weight.value;
  if (height.value !== null && height.value !== latest.latestHeightCm) patch.height_cm = height.value;
  return {
    weightKg: weight.invalid ? null : (weight.value ?? latest.latestWeightKg),
    heightCm: height.invalid ? null : (height.value ?? latest.latestHeightCm),
    weightIssue: weight.invalid ? BODY_METRIC_ISSUE_MESSAGES.weight_kg : null,
    heightIssue: height.invalid ? BODY_METRIC_ISSUE_MESSAGES.height_cm : null,
    hasIssues: weight.invalid || height.invalid,
    patch,
  };
}
