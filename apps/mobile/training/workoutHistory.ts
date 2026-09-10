import {
  WORKOUT_EXECUTION_SCHEMA_VERSION,
  WORKOUT_SUMMARY_CALCULATION_VERSION,
  listWorkoutExecutionUnits,
  parseWorkoutRestSeconds,
  summarizeWorkoutEfforts,
  type WorkoutEffortBreakdown,
  type WorkoutExecutionSummary,
} from "./workoutExecution";
import { isCompoundSeriesType, isSeriesType, type SeriesType } from "./seriesContract";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

export const WORKOUT_SUMMARY_SCHEMA_VERSION = 2 as const;
export const WORKOUT_PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type WorkoutPrescriptionSubSeriesSnapshot = {
  exercise_name: string | null;
  reps: number | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  completed: boolean;
};

export type WorkoutPrescriptionSeriesSnapshot = {
  type: SeriesType;
  reps: number | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  tempo_contraction: number | null;
  tempo_pause: number | null;
  tempo_relaxation: number | null;
  completed: boolean;
  sub_series: WorkoutPrescriptionSubSeriesSnapshot[];
};

export type WorkoutPrescriptionExerciseSnapshot = {
  name: string;
  series: WorkoutPrescriptionSeriesSnapshot[];
};

export type WorkoutPrescriptionSnapshot = {
  schema_version: typeof WORKOUT_PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION;
  execution_schema_version: typeof WORKOUT_EXECUTION_SCHEMA_VERSION;
  weight_unit: "kg";
  exercises: WorkoutPrescriptionExerciseSnapshot[];
};

export type WorkoutCompletionStatus = "completed" | "partial";

export type WorkoutSessionSummary = {
  id: string;
  template_id: string;
  template_name: string;
  finished_at: string;
  elapsed_seconds: number;
  completion_status: WorkoutCompletionStatus;
  summary_schema_version: 1 | typeof WORKOUT_SUMMARY_SCHEMA_VERSION;
  calculation_version: 1 | typeof WORKOUT_SUMMARY_CALCULATION_VERSION;
  can_recalculate: boolean;
  prescription_snapshot: WorkoutPrescriptionSnapshot | null;
  completed_effort_count: number;
  total_effort_count: number;
  effort_breakdown: WorkoutEffortBreakdown | null;
  estimated_calories: number;
  total_volume_kg: number;
  total_reps: number;
};

export type HomeWeekProgressDay = {
  key: string;
  label: string;
  completed: boolean;
  isToday: boolean;
};

type LegacyWorkoutSessionSummary = Partial<WorkoutSessionSummary> & {
  completed_series_count?: unknown;
  total_series_count?: unknown;
};

export type WorkoutSummaryRecalculation =
  | { status: "unavailable" }
  | {
      status: "match" | "mismatch";
      recalculated: WorkoutExecutionSummary;
    };

export type WorkoutHistoryNormalizationOptions = {
  mode?: "repair" | "strict";
  onSnapshotIssue?: (message: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snapshotNumber(rawValue: unknown): number | null | undefined {
  if (rawValue === null) return null;
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0) {
    return undefined;
  }
  return rawValue;
}

function prescribedNumber(rawValue: string | undefined): number | null {
  const normalized = rawValue?.trim().replace(",", ".") ?? "";
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function prescribedRestSeconds(rawValue: string | undefined): number | null {
  const normalized = rawValue?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  const parsed = parseWorkoutRestSeconds(normalized);
  if (parsed > 0) return parsed;
  return /^(0+([.,]0+)?)(s|m)?$/.test(normalized) || /^0+:0+$/.test(normalized)
    ? 0
    : null;
}

function normalizePrescriptionSnapshot(rawValue: unknown): WorkoutPrescriptionSnapshot | null {
  if (!isRecord(rawValue)) return null;
  if (
    rawValue.schema_version !== WORKOUT_PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION
    || rawValue.execution_schema_version !== WORKOUT_EXECUTION_SCHEMA_VERSION
    || rawValue.weight_unit !== "kg"
    || !Array.isArray(rawValue.exercises)
  ) return null;

  const exercises: WorkoutPrescriptionExerciseSnapshot[] = [];
  for (const rawExercise of rawValue.exercises) {
    if (
      !isRecord(rawExercise)
      || typeof rawExercise.name !== "string"
      || !rawExercise.name.trim()
      || !Array.isArray(rawExercise.series)
    ) return null;
    const seriesSnapshots: WorkoutPrescriptionSeriesSnapshot[] = [];
    for (const rawSeries of rawExercise.series) {
      if (!isRecord(rawSeries) || !isSeriesType(rawSeries.type)) return null;
      const reps = snapshotNumber(rawSeries.reps);
      const weightKg = snapshotNumber(rawSeries.weight_kg);
      const restSeconds = snapshotNumber(rawSeries.rest_seconds);
      const tempoContraction = snapshotNumber(rawSeries.tempo_contraction);
      const tempoPause = snapshotNumber(rawSeries.tempo_pause);
      const tempoRelaxation = snapshotNumber(rawSeries.tempo_relaxation);
      if (
        reps === undefined
        || weightKg === undefined
        || restSeconds === undefined
        || tempoContraction === undefined
        || tempoPause === undefined
        || tempoRelaxation === undefined
        || typeof rawSeries.completed !== "boolean"
        || !Array.isArray(rawSeries.sub_series)
      ) return null;
      const subSeriesSnapshots: WorkoutPrescriptionSubSeriesSnapshot[] = [];
      for (const rawSubSeries of rawSeries.sub_series) {
        if (!isRecord(rawSubSeries)) return null;
        const subReps = snapshotNumber(rawSubSeries.reps);
        const subWeightKg = snapshotNumber(rawSubSeries.weight_kg);
        const subRestSeconds = snapshotNumber(rawSubSeries.rest_seconds);
        if (
          (rawSubSeries.exercise_name !== null && typeof rawSubSeries.exercise_name !== "string")
          || subReps === undefined
          || subWeightKg === undefined
          || subRestSeconds === undefined
          || typeof rawSubSeries.completed !== "boolean"
        ) return null;
        subSeriesSnapshots.push({
          exercise_name:
            typeof rawSubSeries.exercise_name === "string" && rawSubSeries.exercise_name.trim()
              ? rawSubSeries.exercise_name.trim()
              : null,
          reps: subReps,
          weight_kg: subWeightKg,
          rest_seconds: subRestSeconds,
          completed: rawSubSeries.completed,
        });
      }
      if (!isCompoundSeriesType(rawSeries.type) && subSeriesSnapshots.length > 0) return null;
      seriesSnapshots.push({
        type: rawSeries.type,
        reps,
        weight_kg: weightKg,
        rest_seconds: restSeconds,
        tempo_contraction: tempoContraction,
        tempo_pause: tempoPause,
        tempo_relaxation: tempoRelaxation,
        completed: rawSeries.completed,
        sub_series: subSeriesSnapshots,
      });
    }
    exercises.push({ name: rawExercise.name.trim(), series: seriesSnapshots });
  }

  return {
    schema_version: WORKOUT_PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION,
    execution_schema_version: WORKOUT_EXECUTION_SCHEMA_VERSION,
    weight_unit: "kg",
    exercises,
  };
}

export function buildWorkoutPrescriptionSnapshot(
  template: WorkoutTemplate,
  completedUnitKeys: readonly string[],
): WorkoutPrescriptionSnapshot {
  const completedKeys = new Set(completedUnitKeys);
  const units = listWorkoutExecutionUnits(template);
  const unitsByPosition = new Map(
    units.map((unit) => [`${unit.exerciseIndex}:${unit.seriesIndex}:${unit.subSeriesIndex ?? "primary"}`, unit]),
  );
  return {
    schema_version: WORKOUT_PRESCRIPTION_SNAPSHOT_SCHEMA_VERSION,
    execution_schema_version: WORKOUT_EXECUTION_SCHEMA_VERSION,
    weight_unit: "kg",
    exercises: template.exercises.map((exercise, exerciseIndex) => ({
      name: exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`,
      series: (exercise.series ?? []).map((series, seriesIndex) => {
        const seriesType = series.type ?? "normal";
        const primaryUnit = unitsByPosition.get(`${exerciseIndex}:${seriesIndex}:primary`);
        return {
          type: seriesType,
          reps: prescribedNumber(series.reps),
          weight_kg: prescribedNumber(series.weight_kg),
          rest_seconds: prescribedRestSeconds(series.rest_seconds),
          tempo_contraction: prescribedNumber(series.tempo_contraction),
          tempo_pause: prescribedNumber(series.tempo_pause),
          tempo_relaxation: prescribedNumber(series.tempo_relaxation),
          completed: primaryUnit ? completedKeys.has(primaryUnit.key) : false,
          sub_series: isCompoundSeriesType(seriesType)
            ? (series.sub_series ?? []).map((subSeries, subSeriesIndex) => {
                const unit = unitsByPosition.get(`${exerciseIndex}:${seriesIndex}:${subSeriesIndex}`);
                return {
                  exercise_name: subSeries.exercise_name?.trim() || null,
                  reps: prescribedNumber(subSeries.reps),
                  weight_kg: prescribedNumber(subSeries.weight_kg),
                  rest_seconds: prescribedRestSeconds(subSeries.rest_seconds),
                  completed: unit ? completedKeys.has(unit.key) : false,
                };
              })
            : [],
        };
      }),
    })),
  };
}

export function summarizeWorkoutPrescriptionSnapshot(
  snapshot: WorkoutPrescriptionSnapshot,
): WorkoutExecutionSummary {
  return summarizeWorkoutEfforts(snapshot.exercises.flatMap((exercise, exerciseIndex) =>
    exercise.series.flatMap((series, seriesIndex) => [
      {
        key: `${exerciseIndex}:${seriesIndex}:primary`,
        kind: "primary" as const,
        reps: series.reps,
        weightKg: series.weight_kg,
        completed: series.completed,
      },
      ...series.sub_series.map((subSeries, subSeriesIndex) => ({
        key: `${exerciseIndex}:${seriesIndex}:${subSeriesIndex}`,
        kind: "sub_series" as const,
        reps: subSeries.reps,
        weightKg: subSeries.weight_kg,
        completed: subSeries.completed,
      })),
    ]),
  ));
}

function sameEffortBreakdown(
  stored: WorkoutEffortBreakdown | null,
  recalculated: WorkoutEffortBreakdown,
): boolean {
  return stored !== null
    && stored.completed_primary === recalculated.completed_primary
    && stored.completed_sub_series === recalculated.completed_sub_series
    && stored.total_primary === recalculated.total_primary
    && stored.total_sub_series === recalculated.total_sub_series;
}

export function recalculateWorkoutSessionSummary(
  summary: WorkoutSessionSummary,
): WorkoutSummaryRecalculation {
  if (!summary.prescription_snapshot) return { status: "unavailable" };
  const recalculated = summarizeWorkoutPrescriptionSnapshot(summary.prescription_snapshot);
  const storedVolume = Math.round(summary.total_volume_kg * 10) / 10;
  const matches =
    summary.total_reps === recalculated.totalReps
    && storedVolume === recalculated.totalVolumeKg
    && summary.completed_effort_count === recalculated.completedEffortCount
    && summary.total_effort_count === recalculated.totalEffortCount
    && sameEffortBreakdown(summary.effort_breakdown, recalculated.effortBreakdown);
  return { status: matches ? "match" : "mismatch", recalculated };
}

function normalizeNonNegativeNumber(rawValue: unknown): number {
  const parsed = typeof rawValue === "string" && rawValue.trim()
    ? Number(rawValue.replace(",", "."))
    : Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeCount(rawValue: unknown): number {
  return Math.max(0, Math.round(normalizeNonNegativeNumber(rawValue)));
}

function normalizeFinishedAt(rawValue: unknown, fallbackFinishedAt: string): string {
  if (typeof rawValue === "string") {
    const parsed = new Date(rawValue);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallbackFinishedAt;
}

function normalizeEffortBreakdown(rawValue: unknown): WorkoutEffortBreakdown | null {
  if (!rawValue || typeof rawValue !== "object") return null;
  const rawBreakdown = rawValue as Partial<WorkoutEffortBreakdown>;
  const totalPrimary = normalizeCount(rawBreakdown.total_primary);
  const totalSubSeries = normalizeCount(rawBreakdown.total_sub_series);
  return {
    completed_primary: Math.min(normalizeCount(rawBreakdown.completed_primary), totalPrimary),
    completed_sub_series: Math.min(
      normalizeCount(rawBreakdown.completed_sub_series),
      totalSubSeries,
    ),
    total_primary: totalPrimary,
    total_sub_series: totalSubSeries,
  };
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function completedDayKeys(summaries: readonly WorkoutSessionSummary[]): Set<string> {
  return new Set(
    summaries
      .filter(isCompletedWorkoutSummary)
      .map((summary) => {
        const parsed = new Date(summary.finished_at);
        if (Number.isNaN(parsed.getTime())) return null;
        return localDateKey(startOfLocalDay(parsed));
      })
      .filter((value): value is string => value !== null),
  );
}

export function classifyWorkoutCompletion(
  completedEffortCount: number,
  totalEffortCount: number,
): WorkoutCompletionStatus {
  const completed = normalizeCount(completedEffortCount);
  const total = normalizeCount(totalEffortCount);
  return total > 0 && completed >= total ? "completed" : "partial";
}

export function normalizeWorkoutSessionSummary(
  rawValue: unknown,
  index: number,
  fallbackId: string,
  fallbackFinishedAt = new Date().toISOString(),
  options: WorkoutHistoryNormalizationOptions = {},
): WorkoutSessionSummary {
  const maybe = rawValue && typeof rawValue === "object"
    ? rawValue as LegacyWorkoutSessionSummary
    : {};
  const calculationVersion = maybe.calculation_version === WORKOUT_SUMMARY_CALCULATION_VERSION
    ? WORKOUT_SUMMARY_CALCULATION_VERSION
    : 1;
  const totalEffortCount = normalizeCount(
    maybe.total_effort_count ?? maybe.total_series_count,
  );
  const completedEffortCount = Math.min(
    normalizeCount(maybe.completed_effort_count ?? maybe.completed_series_count),
    totalEffortCount,
  );
  const effortBreakdown = calculationVersion === WORKOUT_SUMMARY_CALCULATION_VERSION
    ? normalizeEffortBreakdown(maybe.effort_breakdown)
    : null;
  const hasUnsupportedSummaryVersion = maybe.summary_schema_version !== undefined
    && maybe.summary_schema_version !== 1
    && maybe.summary_schema_version !== WORKOUT_SUMMARY_SCHEMA_VERSION;
  const declaresSnapshot = maybe.summary_schema_version === WORKOUT_SUMMARY_SCHEMA_VERSION
    || (maybe.prescription_snapshot !== undefined && maybe.prescription_snapshot !== null);
  const prescriptionSnapshot = declaresSnapshot && !hasUnsupportedSummaryVersion
    ? normalizePrescriptionSnapshot(maybe.prescription_snapshot)
    : null;
  if (hasUnsupportedSummaryVersion || (declaresSnapshot && !prescriptionSnapshot)) {
    const message = "Una sesión histórica contenía una prescripción no compatible; se conservan sus totales originales sin recalcularlos.";
    if (options.mode === "strict") throw new Error(message);
    options.onSnapshotIssue?.(message);
  }

  return {
    id: typeof maybe.id === "string" && maybe.id ? maybe.id : fallbackId || `session_summary_${index}`,
    template_id:
      typeof maybe.template_id === "string" && maybe.template_id.trim()
        ? maybe.template_id.trim()
        : "",
    template_name:
      typeof maybe.template_name === "string" && maybe.template_name.trim()
        ? maybe.template_name.trim()
        : "Rutina",
    finished_at: normalizeFinishedAt(maybe.finished_at, fallbackFinishedAt),
    elapsed_seconds: normalizeCount(maybe.elapsed_seconds),
    completion_status: classifyWorkoutCompletion(completedEffortCount, totalEffortCount),
    summary_schema_version: prescriptionSnapshot ? WORKOUT_SUMMARY_SCHEMA_VERSION : 1,
    calculation_version: calculationVersion,
    can_recalculate: prescriptionSnapshot !== null,
    prescription_snapshot: prescriptionSnapshot,
    completed_effort_count: completedEffortCount,
    total_effort_count: totalEffortCount,
    effort_breakdown: effortBreakdown,
    estimated_calories: normalizeCount(maybe.estimated_calories),
    total_volume_kg: normalizeNonNegativeNumber(maybe.total_volume_kg),
    total_reps: normalizeCount(maybe.total_reps),
  };
}

export function sortWorkoutHistoryDesc(
  summaries: readonly WorkoutSessionSummary[],
): WorkoutSessionSummary[] {
  return [...summaries].sort((a, b) => {
    const aTime = new Date(a.finished_at).getTime();
    const bTime = new Date(b.finished_at).getTime();
    return bTime - aTime;
  });
}

export function isCompletedWorkoutSummary(
  summary: WorkoutSessionSummary,
): boolean {
  return summary.completion_status === "completed";
}

export function calculateWorkoutStreak(
  summaries: readonly WorkoutSessionSummary[],
  now = new Date(),
): number {
  const dayKeys = completedDayKeys(summaries);
  if (dayKeys.size === 0) return 0;

  const cursor = startOfLocalDay(now);
  if (!dayKeys.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (dayKeys.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildHomeWeekProgress(
  summaries: readonly WorkoutSessionSummary[],
  now = new Date(),
): HomeWeekProgressDay[] {
  const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];
  const today = startOfLocalDay(now);
  const monday = new Date(today);
  const dayIndex = today.getDay();
  monday.setDate(monday.getDate() - (dayIndex === 0 ? 6 : dayIndex - 1));
  const dayKeys = completedDayKeys(summaries);
  const todayKey = localDateKey(today);

  return weekdayLabels.map((label, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const key = localDateKey(current);
    return {
      key,
      label,
      completed: dayKeys.has(key),
      isToday: key === todayKey,
    };
  });
}
