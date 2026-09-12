import {
  listWorkoutExecutionUnits,
  primaryWorkoutExecutionKey,
  resolveWorkoutExecutionRest,
  summarizeWorkoutExecution,
  type WorkoutExecutionUnit,
} from "./workoutExecution";
import { inferExerciseMuscle } from "./presentationModel";
import type { ExerciseSeries } from "./seriesContract";
import type { WorkoutSessionTemplateDraftRecord } from "./workoutTemplateTransactions";
import type { WorkoutTemplate } from "./workoutTemplateOperations";
import type { WorkoutSession } from "./workoutSessionModel";

export type ActiveSessionPresentation = {
  template: WorkoutTemplate | null;
  units: WorkoutExecutionUnit[];
  performance: ReturnType<typeof summarizeWorkoutExecution>;
  currentUnit: WorkoutExecutionUnit | null;
  progressPercent: number;
  exercises: Array<{
    exercise: WorkoutTemplate["exercises"][number];
    exerciseIndex: number;
    seriesStates: Array<{
      key: string;
      series: ExerciseSeries;
      seriesIndex: number;
      subSeriesStates: Array<{
        key: string;
        unit: WorkoutExecutionUnit;
        subSeries: NonNullable<WorkoutExecutionUnit["subSeries"]>;
        subSeriesIndex: number;
        isCompleted: boolean;
        isCurrent: boolean;
      }>;
      isCompleted: boolean;
      isCurrent: boolean;
    }>;
    completedEffortCount: number;
    totalEffortCount: number;
    isCurrentExercise: boolean;
    isCompletedExercise: boolean;
    muscle: string;
  }>;
  restTargetSeconds: number;
  restProgressRatio: number;
};

export function buildActiveSessionPresentation(
  session: WorkoutSession | null,
  sessionDraft: WorkoutSessionTemplateDraftRecord | null,
  templates: readonly WorkoutTemplate[],
): ActiveSessionPresentation {
  const template = !session
    ? null
    : sessionDraft?.session_id === session.id
      ? sessionDraft.draft
      : templates.find((candidate) => candidate.id === session.template_id) ?? null;
  const units = template ? listWorkoutExecutionUnits(template) : [];
  const completedKeys = session?.completed_unit_keys ?? [];
  const performance = summarizeWorkoutExecution(units, completedKeys);
  const currentUnitIndex = session
    ? units.findIndex((unit) => unit.key === session.current_unit_key)
    : -1;
  const currentUnit = units.length === 0
    ? null
    : currentUnitIndex < 0
      ? units[0]
      : units[currentUnitIndex];
  const progressRatio = !session || session.total_effort_count <= 0
    ? 0
    : Math.max(0, Math.min(1, session.completed_effort_count / session.total_effort_count));
  const completedKeySet = new Set(completedKeys);
  const exercises = !session || !template ? [] : template.exercises.map((exercise, exerciseIndex) => {
    const seriesStates = (exercise.series ?? []).map((series, seriesIndex) => {
      const key = primaryWorkoutExecutionKey(exercise.id, series.id);
      const subSeriesStates = units
        .filter((candidate) => candidate.blockKey === key && candidate.kind === "sub_series")
        .map((subUnit) => ({
          key: subUnit.key,
          unit: subUnit,
          subSeries: subUnit.subSeries!,
          subSeriesIndex: subUnit.subSeriesIndex!,
          isCompleted: completedKeySet.has(subUnit.key),
          isCurrent: currentUnit?.key === subUnit.key,
        }));
      return {
        key,
        series,
        seriesIndex,
        subSeriesStates,
        isCompleted: completedKeySet.has(key),
        isCurrent: currentUnit?.key === key,
      };
    });
    const exerciseUnits = units.filter((unit) => unit.exerciseId === exercise.id);
    const completedEffortCount = exerciseUnits.filter((unit) => completedKeySet.has(unit.key)).length;
    const totalEffortCount = exerciseUnits.length;
    return {
      exercise,
      exerciseIndex,
      seriesStates,
      completedEffortCount,
      totalEffortCount,
      isCurrentExercise: currentUnit?.exerciseId === exercise.id,
      isCompletedExercise: totalEffortCount > 0 && completedEffortCount === totalEffortCount,
      muscle: exercise.muscle?.trim() || inferExerciseMuscle(exercise.name ?? "", session.category),
    };
  });
  const restTargetSeconds = session?.is_resting
    ? session.rest_seconds_total ?? 0
    : currentUnit
      ? resolveWorkoutExecutionRest(currentUnit, units[currentUnitIndex + 1] ?? null)
      : 0;
  const restProgressRatio = !session?.is_resting
    ? 0
    : Math.max(0, Math.min(1, (Math.max(1, restTargetSeconds) - session.rest_seconds_left)
      / Math.max(1, restTargetSeconds)));

  return {
    template,
    units,
    performance,
    currentUnit,
    progressPercent: Math.max(0, Math.min(100, Math.round(progressRatio * 100))),
    exercises,
    restTargetSeconds,
    restProgressRatio,
  };
}
