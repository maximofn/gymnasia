import {
  WORKOUT_SUMMARY_CALCULATION_VERSION,
  type WorkoutEffortBreakdown,
} from "./workoutExecution";

export type WorkoutCompletionStatus = "completed" | "partial";

export type WorkoutSessionSummary = {
  id: string;
  template_id: string;
  template_name: string;
  finished_at: string;
  elapsed_seconds: number;
  completion_status: WorkoutCompletionStatus;
  calculation_version: 1 | typeof WORKOUT_SUMMARY_CALCULATION_VERSION;
  can_recalculate: boolean;
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
    calculation_version: calculationVersion,
    can_recalculate:
      calculationVersion === WORKOUT_SUMMARY_CALCULATION_VERSION
      && maybe.can_recalculate === true,
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
