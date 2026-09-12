import {
  WORKOUT_EXECUTION_SCHEMA_VERSION,
  expandLegacyCompletedSeriesKeys,
  listWorkoutExecutionUnits,
  resolveWorkoutExecutionCurrentKey,
} from "./workoutExecution";
import {
  classifyWorkoutCompletion,
  type WorkoutCompletionStatus,
} from "./workoutHistory";
import {
  normalizeWorkoutClockFields,
  type WorkoutClockFields,
} from "./workoutSessionClock";
import type {
  TrainingCategory,
  WorkoutTemplate,
} from "./workoutTemplateOperations";

export type WorkoutSessionStatus = "running" | "paused";
export type WorkoutSessionResolutionKind = WorkoutCompletionStatus | "discard";

export type WorkoutSession = WorkoutClockFields & {
  id: string;
  template_id: string;
  template_name: string;
  category: TrainingCategory;
  started_at: string;
  execution_schema_version: typeof WORKOUT_EXECUTION_SCHEMA_VERSION;
  current_unit_key: string;
  completed_unit_keys: string[];
  completed_effort_count: number;
  total_effort_count: number;
  elapsed_seconds: number;
  is_resting: boolean;
  rest_seconds_left: number;
  rest_seconds_total: number;
  status: WorkoutSessionStatus;
  pending_resolution?: {
    kind: WorkoutSessionResolutionKind;
    requested_at: string;
  };
};

export type WorkoutSessionRuntime = {
  now(): number;
  createId(prefix: string): string;
};

const defaultRuntime: WorkoutSessionRuntime = {
  now: () => Date.now(),
  createId: (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

export function inferTrainingCategory(templateName: string): TrainingCategory {
  const normalized = templateName.trim().toLowerCase();
  if (
    normalized.includes("hipertrof") ||
    normalized.includes("hypertroph") ||
    normalized.includes("volumen") ||
    normalized.includes("masa muscular")
  ) {
    return "hypertrophy";
  }
  if (
    normalized.includes("cardio") ||
    normalized.includes("hiit") ||
    normalized.includes("running")
  ) {
    return "cardio";
  }
  if (
    normalized.includes("flex") ||
    normalized.includes("movilidad") ||
    normalized.includes("mobility") ||
    normalized.includes("estir")
  ) {
    return "flexibility";
  }
  return "strength";
}

export function resolveTrainingCategory(template: WorkoutTemplate): TrainingCategory {
  if (
    template.category === "strength" ||
    template.category === "hypertrophy" ||
    template.category === "cardio" ||
    template.category === "flexibility"
  ) {
    return template.category;
  }
  return inferTrainingCategory(template.name);
}

export function templateHasRunnableSeries(template: WorkoutTemplate): boolean {
  return listWorkoutExecutionUnits(template).length > 0;
}

export function normalizeWorkoutSession(
  rawValue: unknown,
  templates: WorkoutTemplate[],
  runtime: WorkoutSessionRuntime = defaultRuntime,
): WorkoutSession | null {
  if (!rawValue || typeof rawValue !== "object") return null;
  const maybe = rawValue as Partial<WorkoutSession> & {
    current_exercise_index?: unknown;
    current_series_index?: unknown;
    completed_series_keys?: unknown;
    completed_series_count?: unknown;
    total_series_count?: unknown;
  };
  if (!maybe.template_id || typeof maybe.template_id !== "string") return null;

  const template = templates.find((item) => item.id === maybe.template_id);
  if (!template || !templateHasRunnableSeries(template)) return null;

  const units = listWorkoutExecutionUnits(template);
  if (units.length === 0) return null;

  const knownKeys = new Set(units.map((unit) => unit.key));
  const usesExecutionUnits =
    maybe.execution_schema_version === WORKOUT_EXECUTION_SCHEMA_VERSION;
  const completedUnitKeys = usesExecutionUnits
    ? [
        ...new Set(
          (Array.isArray(maybe.completed_unit_keys) ? maybe.completed_unit_keys : [])
            .filter((item): item is string => typeof item === "string")
            .filter((item) => knownKeys.has(item)),
        ),
      ]
    : expandLegacyCompletedSeriesKeys(
        units,
        (Array.isArray(maybe.completed_series_keys) ? maybe.completed_series_keys : [])
          .filter((item): item is string => typeof item === "string"),
      );
  const requestedLegacyUnit = usesExecutionUnits
    ? null
    : units.find(
        (unit) =>
          unit.kind === "primary" &&
          unit.exerciseIndex === Number(maybe.current_exercise_index) &&
          unit.seriesIndex === Number(maybe.current_series_index),
      ) ?? null;
  const requestedKey =
    usesExecutionUnits && typeof maybe.current_unit_key === "string"
      ? maybe.current_unit_key
      : requestedLegacyUnit?.key ?? units[0].key;
  const currentUnitKey =
    resolveWorkoutExecutionCurrentKey(units, requestedKey, completedUnitKeys) ??
    units[0].key;
  const elapsedSeconds = Number.isFinite(Number(maybe.elapsed_seconds))
    ? Math.max(0, Math.round(Number(maybe.elapsed_seconds)))
    : 0;
  const restSecondsLeft = Number.isFinite(Number(maybe.rest_seconds_left))
    ? Math.max(0, Math.round(Number(maybe.rest_seconds_left)))
    : 0;
  const restSecondsTotal = Number.isFinite(Number(maybe.rest_seconds_total))
    ? Math.max(0, Math.round(Number(maybe.rest_seconds_total)))
    : restSecondsLeft;
  const requestedStatus = maybe.status === "paused" ? "paused" : "running";
  const isResting = Boolean(maybe.is_resting) && restSecondsLeft > 0;
  const rawPendingResolution = (maybe as {
    pending_resolution?: { kind?: unknown; requested_at?: unknown };
  }).pending_resolution;
  const pendingResolutionKind: WorkoutSessionResolutionKind | null =
    rawPendingResolution?.kind === "discard"
      ? "discard"
      : rawPendingResolution?.kind === "finish" ||
          rawPendingResolution?.kind === "completed" ||
          rawPendingResolution?.kind === "partial"
        ? classifyWorkoutCompletion(completedUnitKeys.length, units.length)
        : null;
  const pendingResolution =
    pendingResolutionKind && typeof rawPendingResolution?.requested_at === "string"
      ? {
          kind: pendingResolutionKind,
          requested_at: rawPendingResolution.requested_at,
        }
      : undefined;
  const status: WorkoutSessionStatus = pendingResolution ? "paused" : requestedStatus;
  const now = runtime.now();
  const clockFields = normalizeWorkoutClockFields(maybe, {
    now,
    isResting,
    restSecondsLeft,
    status,
    hasPendingResolution: !!pendingResolution,
    createRestCycleId: () => runtime.createId("rest"),
  });
  return {
    id:
      typeof maybe.id === "string" && maybe.id
        ? maybe.id
        : runtime.createId("session"),
    template_id: template.id,
    template_name: template.name,
    category: resolveTrainingCategory(template),
    started_at:
      typeof maybe.started_at === "string" && maybe.started_at
        ? maybe.started_at
        : new Date(now).toISOString(),
    execution_schema_version: WORKOUT_EXECUTION_SCHEMA_VERSION,
    current_unit_key: currentUnitKey,
    completed_unit_keys: completedUnitKeys,
    completed_effort_count: completedUnitKeys.length,
    total_effort_count: units.length,
    elapsed_seconds: elapsedSeconds,
    is_resting: isResting,
    rest_seconds_left: restSecondsLeft,
    rest_seconds_total: restSecondsTotal,
    status,
    ...clockFields,
    ...(pendingResolution ? { pending_resolution: pendingResolution } : {}),
  };
}
