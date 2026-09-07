import { isCompoundSeriesType, type ExerciseSeries, type SeriesType, type SubSeries } from "./seriesContract";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

export const WORKOUT_EXECUTION_SCHEMA_VERSION = 1 as const;
export const WORKOUT_SUMMARY_CALCULATION_VERSION = 2 as const;

export type WorkoutExecutionUnitKind = "primary" | "sub_series";

export type WorkoutExecutionUnit = {
  key: string;
  blockKey: string;
  kind: WorkoutExecutionUnitKind;
  exerciseIndex: number;
  seriesIndex: number;
  subSeriesIndex: number | null;
  exerciseId: string;
  seriesId: string;
  subSeriesId: string | null;
  exerciseName: string;
  seriesType: SeriesType;
  reps: string;
  weightKg: string;
  restInput: string;
  blockRestInput: string;
  series: ExerciseSeries;
  subSeries: SubSeries | null;
};

export type WorkoutEffortBreakdown = {
  completed_primary: number;
  completed_sub_series: number;
  total_primary: number;
  total_sub_series: number;
};

export type WorkoutExecutionSummary = {
  completedEffortCount: number;
  totalEffortCount: number;
  totalVolumeKg: number;
  totalReps: number;
  effortBreakdown: WorkoutEffortBreakdown;
};

export function primaryWorkoutExecutionKey(exerciseId: string, seriesId: string): string {
  return `${exerciseId}:${seriesId}`;
}

export function subSeriesWorkoutExecutionKey(
  exerciseId: string,
  seriesId: string,
  subSeriesId: string,
): string {
  return `${exerciseId}:${seriesId}:${subSeriesId}`;
}

export function listWorkoutExecutionUnits(template: WorkoutTemplate): WorkoutExecutionUnit[] {
  const units: WorkoutExecutionUnit[] = [];
  const seenKeys = new Set<string>();

  template.exercises.forEach((exercise, exerciseIndex) => {
    const rootExerciseName = exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`;
    (exercise.series ?? []).forEach((series, seriesIndex) => {
      const blockKey = primaryWorkoutExecutionKey(exercise.id, series.id);
      const seriesType = series.type ?? "normal";
      if (!seenKeys.has(blockKey)) {
        units.push({
          key: blockKey,
          blockKey,
          kind: "primary",
          exerciseIndex,
          seriesIndex,
          subSeriesIndex: null,
          exerciseId: exercise.id,
          seriesId: series.id,
          subSeriesId: null,
          exerciseName: rootExerciseName,
          seriesType,
          reps: series.reps,
          weightKg: series.weight_kg,
          restInput: series.rest_seconds,
          blockRestInput: series.rest_seconds,
          series,
          subSeries: null,
        });
        seenKeys.add(blockKey);
      }

      if (!isCompoundSeriesType(seriesType)) return;
      (series.sub_series ?? []).forEach((subSeries, subSeriesIndex) => {
        const key = subSeriesWorkoutExecutionKey(exercise.id, series.id, subSeries.id);
        if (seenKeys.has(key)) return;
        units.push({
          key,
          blockKey,
          kind: "sub_series",
          exerciseIndex,
          seriesIndex,
          subSeriesIndex,
          exerciseId: exercise.id,
          seriesId: series.id,
          subSeriesId: subSeries.id,
          exerciseName:
            seriesType === "superset" && subSeries.exercise_name?.trim()
              ? subSeries.exercise_name.trim()
              : rootExerciseName,
          seriesType,
          reps: subSeries.reps,
          weightKg: subSeries.weight_kg,
          restInput: subSeries.rest_seconds,
          blockRestInput: series.rest_seconds,
          series,
          subSeries,
        });
        seenKeys.add(key);
      });
    });
  });

  return units;
}

export function parseWorkoutRestSeconds(rawValue: string): number {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return 0;

  if (normalized.includes(":")) {
    const [minutesRaw, secondsRaw] = normalized.split(":");
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (
      normalized.split(":").length === 2
      && Number.isFinite(minutes)
      && minutes >= 0
      && Number.isFinite(seconds)
      && seconds >= 0
    ) {
      return Math.max(0, Math.round(minutes * 60 + seconds));
    }
    return 0;
  }

  if (normalized.endsWith("m")) {
    const parsed = Number(normalized.slice(0, -1));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 60);
    return 0;
  }

  if (normalized.endsWith("s")) {
    const parsed = Number(normalized.slice(0, -1));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    return 0;
  }

  if (normalized.startsWith("-")) return 0;

  const numeric = Number(normalized.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric);
}

export function resolveWorkoutExecutionRest(
  completedUnit: WorkoutExecutionUnit,
  nextUnit: WorkoutExecutionUnit | null,
): number {
  if (!nextUnit) return 0;
  if (nextUnit.blockKey === completedUnit.blockKey && nextUnit.kind === "sub_series") {
    return parseWorkoutRestSeconds(nextUnit.restInput);
  }
  if (nextUnit.blockKey !== completedUnit.blockKey) {
    return parseWorkoutRestSeconds(completedUnit.blockRestInput);
  }
  return 0;
}

function parseNonNegativeNumber(rawValue: string): number {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function summarizeWorkoutExecution(
  units: readonly WorkoutExecutionUnit[],
  completedUnitKeys: readonly string[],
): WorkoutExecutionSummary {
  const completedKeys = new Set(completedUnitKeys);
  const seenKeys = new Set<string>();
  let totalReps = 0;
  let totalVolumeKg = 0;
  const effortBreakdown: WorkoutEffortBreakdown = {
    completed_primary: 0,
    completed_sub_series: 0,
    total_primary: 0,
    total_sub_series: 0,
  };

  for (const unit of units) {
    if (seenKeys.has(unit.key)) continue;
    seenKeys.add(unit.key);
    if (unit.kind === "primary") effortBreakdown.total_primary += 1;
    else effortBreakdown.total_sub_series += 1;

    if (!completedKeys.has(unit.key)) continue;
    if (unit.kind === "primary") effortBreakdown.completed_primary += 1;
    else effortBreakdown.completed_sub_series += 1;
    const reps = Math.max(0, Math.round(parseNonNegativeNumber(unit.reps)));
    const weightKg = parseNonNegativeNumber(unit.weightKg);
    totalReps += reps;
    totalVolumeKg += reps * weightKg;
  }

  return {
    completedEffortCount:
      effortBreakdown.completed_primary + effortBreakdown.completed_sub_series,
    totalEffortCount: effortBreakdown.total_primary + effortBreakdown.total_sub_series,
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    totalReps,
    effortBreakdown,
  };
}

export function expandLegacyCompletedSeriesKeys(
  units: readonly WorkoutExecutionUnit[],
  completedSeriesKeys: readonly string[],
): string[] {
  const completedBlocks = new Set(completedSeriesKeys);
  return units
    .filter((unit) => completedBlocks.has(unit.blockKey))
    .map((unit) => unit.key);
}

export function resolveWorkoutExecutionCurrentKey(
  units: readonly WorkoutExecutionUnit[],
  requestedKey: string | null,
  completedUnitKeys: readonly string[],
): string | null {
  if (units.length === 0) return null;
  const requestedIndex = requestedKey
    ? units.findIndex((unit) => unit.key === requestedKey)
    : -1;
  const completedKeys = new Set(completedUnitKeys);
  if (requestedIndex >= 0 && !completedKeys.has(units[requestedIndex].key)) {
    return units[requestedIndex].key;
  }
  const fromRequested = units
    .slice(Math.max(0, requestedIndex))
    .find((unit) => !completedKeys.has(unit.key));
  return fromRequested?.key
    ?? units.find((unit) => !completedKeys.has(unit.key))?.key
    ?? units[Math.max(0, requestedIndex)].key;
}
