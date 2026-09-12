import type { ExerciseSeries } from "./seriesContract";
import type { WorkoutPrescriptionSeriesSnapshot } from "./workoutHistory";
import type { WorkoutSession } from "./workoutSessionModel";
import {
  ROUTINE_ICON_NAMES,
  type RoutineIconName,
  type TrainingCategory,
  type WorkoutTemplate,
} from "./workoutTemplateOperations";
import { listWorkoutExecutionUnits, parseWorkoutRestSeconds } from "./workoutExecution";
import { resolveTrainingCategory } from "./workoutSessionModel";

export type TrainingStatsPeriodKey = "3m" | "6m" | "12m" | "all";
export type TrainingStatsMetricKey = "volume" | "reps" | "duration";

export const ROUTINE_ICON_OPTIONS: RoutineIconName[] = [...ROUTINE_ICON_NAMES];
const ROUTINE_ICON_BY_CATEGORY: Record<TrainingCategory, RoutineIconName[]> = {
  strength: ["activity", "shield", "crosshair", "award", "target"],
  hypertrophy: ["award", "target", "crosshair", "activity", "shield"],
  cardio: ["heart", "zap", "trending-up", "activity", "wind"],
  flexibility: ["wind", "sun", "moon", "compass", "sliders"],
};

export function parseRestSecondsInput(rawValue: string): number {
  return parseWorkoutRestSeconds(rawValue);
}

export function extractFirstPositiveInt(rawValue: string): number | null {
  const match = rawValue.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function normalizeDurationText(rawValue: string): string {
  return rawValue.replace(/[^\d]/g, "").slice(0, 3);
}

export function inferDurationFromText(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export function defaultTemplateIcon(
  category: TrainingCategory,
  index: number,
): RoutineIconName {
  const options = ROUTINE_ICON_BY_CATEGORY[category];
  if (options.length === 0) return "activity";
  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return options[normalizedIndex % options.length];
}

export function normalizeTemplateIcon(
  maybeIcon: unknown,
  category: TrainingCategory,
  templateIndex: number,
): RoutineIconName {
  if (typeof maybeIcon === "string") {
    const normalized = maybeIcon.trim() as RoutineIconName;
    if (ROUTINE_ICON_OPTIONS.includes(normalized)) {
      return normalized;
    }
  }
  return defaultTemplateIcon(category, templateIndex);
}

export function trainingCategoryMeta(category: TrainingCategory): {
  label: string;
  color: string;
  iconBg: string;
} {
  if (category === "hypertrophy") {
    return { label: "Hipertrofia", color: "#7C5CFF", iconBg: "rgba(124,92,255,0.2)" };
  }
  if (category === "cardio") {
    return { label: "Cardio", color: "#FF8A3D", iconBg: "rgba(255,138,61,0.2)" };
  }
  if (category === "flexibility") {
    return { label: "Flexibilidad", color: "#00D2FF", iconBg: "rgba(0,210,255,0.2)" };
  }
  return { label: "Fuerza", color: "#CBFF1A", iconBg: "rgba(203,255,26,0.2)" };
}

export function inferTemplateDurationMinutes(template: WorkoutTemplate): number {
  const fixedDuration = inferDurationFromText(template.duration_minutes);
  if (fixedDuration !== null) return fixedDuration;

  const totalSeconds = template.exercises.reduce((total, item) => {
    const seriesItems = item.series ?? [];
    if (seriesItems.length === 0) return total;
    const name = (item.name ?? "").toLowerCase();
    const isLegPress =
      name.includes("prensa") ||
      name.includes("sentadilla") ||
      name.includes("squat") ||
      name.includes("leg press") ||
      name.includes("pierna");
    const executionSeconds = isLegPress ? 90 : 60;
    return total + seriesItems.reduce(
      (seriesTotal, series) =>
        seriesTotal + executionSeconds + parseRestSecondsInput(series.rest_seconds),
      0,
    );
  }, 0);
  if (totalSeconds <= 0) return 0;
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

export function inferExerciseMuscle(
  exerciseName: string,
  category: TrainingCategory,
): string {
  const normalized = exerciseName.toLowerCase();
  if (
    normalized.includes("pierna") ||
    normalized.includes("squat") ||
    normalized.includes("sentadilla")
  ) {
    return "Piernas";
  }
  if (
    normalized.includes("hombro") ||
    normalized.includes("militar") ||
    normalized.includes("lateral")
  ) {
    return "Hombros";
  }
  if (normalized.includes("tricep") || normalized.includes("fondo")) return "Tríceps";
  if (
    normalized.includes("espalda") ||
    normalized.includes("remo") ||
    normalized.includes("jalón")
  ) {
    return "Espalda";
  }
  if (normalized.includes("core") || normalized.includes("abdominal")) return "Core";
  if (category === "cardio") return "Cardio";
  if (category === "flexibility") return "Movilidad";
  return "Pecho";
}

export function normalizeExerciseImageUri(
  rawValue: string | null | undefined,
): string | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  return trimmed || null;
}

export function resolveExercisePreviewMeta(
  exerciseName: string,
  muscle: string,
  category: TrainingCategory,
): {
  backgroundColor: string;
  accentColor: string;
  label: string;
  icon: RoutineIconName;
} {
  const normalized = `${exerciseName} ${muscle}`.trim().toLowerCase();

  if (
    normalized.includes("pierna") ||
    normalized.includes("squat") ||
    normalized.includes("sentadilla") ||
    normalized.includes("zancada") ||
    normalized.includes("lunge")
  ) {
    return { backgroundColor: "#232A17", accentColor: "#CBFF1A", label: "Piernas", icon: "shield" };
  }
  if (
    normalized.includes("espalda") ||
    normalized.includes("remo") ||
    normalized.includes("jalon") ||
    normalized.includes("jalón") ||
    normalized.includes("pull")
  ) {
    return { backgroundColor: "#162331", accentColor: "#76A9FF", label: "Espalda", icon: "wind" };
  }
  if (
    normalized.includes("hombro") ||
    normalized.includes("militar") ||
    normalized.includes("lateral") ||
    normalized.includes("press")
  ) {
    return { backgroundColor: "#2A2116", accentColor: "#FFB166", label: "Hombros", icon: "target" };
  }
  if (
    normalized.includes("tricep") ||
    normalized.includes("trícep") ||
    normalized.includes("fondo") ||
    normalized.includes("pecho") ||
    normalized.includes("push")
  ) {
    return { backgroundColor: "#2A1C1C", accentColor: "#FF8D8D", label: "Pecho", icon: "award" };
  }
  if (
    normalized.includes("core") ||
    normalized.includes("abdominal") ||
    normalized.includes("planch")
  ) {
    return { backgroundColor: "#182824", accentColor: "#55D6BE", label: "Core", icon: "crosshair" };
  }
  if (category === "cardio") {
    return { backgroundColor: "#2A2015", accentColor: "#FF9F4D", label: "Cardio", icon: "heart" };
  }
  if (category === "flexibility") {
    return { backgroundColor: "#16272A", accentColor: "#74D7F7", label: "Movilidad", icon: "compass" };
  }
  return { backgroundColor: "#1D2430", accentColor: "#A5B0C2", label: "General", icon: "activity" };
}

export function defaultTemplateName(category: TrainingCategory, index: number): string {
  if (category === "hypertrophy") return `Hipertrofia — Volumen ${index}`;
  if (category === "cardio") return `Cardio — Resistencia ${index}`;
  if (category === "flexibility") return `Movilidad y Estiramiento ${index}`;
  return `Tren Superior — Fuerza ${index}`;
}

export function totalSeriesCount(template: WorkoutTemplate): number {
  return template.exercises.reduce((total, exercise) => {
    const seriesCount = exercise.series?.length ?? 0;
    return total + (seriesCount > 0 ? seriesCount : exercise.sets.length);
  }, 0);
}

export function estimateTrainingCalories(
  minutes: number,
  category: TrainingCategory,
): number {
  const burnRateByCategory: Record<TrainingCategory, number> = {
    strength: 8.8,
    hypertrophy: 9.2,
    cardio: 10.5,
    flexibility: 4.5,
  };
  return Math.max(1, Math.round(Math.max(1, minutes) * burnRateByCategory[category]));
}

export function estimateWorkoutCalories(session: WorkoutSession): number {
  return estimateTrainingCalories(session.elapsed_seconds / 60, session.category);
}

export function estimateTemplateCalories(template: WorkoutTemplate): number {
  return estimateTrainingCalories(
    inferTemplateDurationMinutes(template),
    resolveTrainingCategory(template),
  );
}

export function formatSpanishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${`${remainder}`.padStart(2, "0")}`;
}

export function formatHomeExerciseVolume(series: ExerciseSeries[]): string {
  if (series.length === 0) return "Sin series configuradas";
  const repsLabel = series.find((item) => item.reps.trim())?.reps.trim() || "--";
  const weightLabel = series.find((item) => item.weight_kg.trim())?.weight_kg.trim() || "";
  return `${series.length} x ${repsLabel} reps${weightLabel ? ` • ${weightLabel} kg` : ""}`;
}

export function resolveTrainingStatsPeriodStart(
  period: TrainingStatsPeriodKey,
): number | null {
  if (period === "all") return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (period === "12m") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    return cutoff.getTime();
  }
  cutoff.setMonth(cutoff.getMonth() - (period === "6m" ? 6 : 3));
  return cutoff.getTime();
}

export function formatTrainingStatsHistoryLabel(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatTrainingHistoryDate(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "Fecha desconocida";
  return parsed.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWorkoutHistoryVolume(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} kg` : `${rounded.toFixed(1)} kg`;
}

export function formatPrescriptionNumber(value: number | null, suffix: string): string {
  if (value === null) return `— ${suffix}`;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${suffix}`;
}

export function workoutPrescriptionSeriesDetail(
  series: WorkoutPrescriptionSeriesSnapshot,
): string {
  const details = [
    formatPrescriptionNumber(series.reps, "reps"),
    formatPrescriptionNumber(series.weight_kg, "kg"),
    series.rest_seconds === null
      ? "descanso —"
      : `descanso ${formatClock(series.rest_seconds)}`,
  ];
  if (
    series.tempo_contraction !== null ||
    series.tempo_pause !== null ||
    series.tempo_relaxation !== null
  ) {
    details.push(
      `tempo ${series.tempo_contraction ?? "—"}-${series.tempo_pause ?? "—"}-${series.tempo_relaxation ?? "—"}`,
    );
  }
  return details.join(" · ");
}

export function formatTrainingStatsMetricValue(
  metric: TrainingStatsMetricKey,
  value: number,
): string {
  if (metric === "duration") {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} min` : `${rounded.toFixed(1)} min`;
  }
  if (metric === "volume") {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} kg` : `${rounded.toFixed(1)} kg`;
  }
  return `${Math.round(value)} reps`;
}

export function hasRunnableSeries(template: WorkoutTemplate): boolean {
  return listWorkoutExecutionUnits(template).length > 0;
}
