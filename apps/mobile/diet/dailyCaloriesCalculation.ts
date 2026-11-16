import type { ActivityLevel, DietGoal, UserSex } from "./model";

export const DAILY_CALORIES_MISSING_DATA_MESSAGE =
  "Introduce altura, peso y fecha de nacimiento para calcular.";

const MILLISECONDS_PER_YEAR = 31557600000;

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  moderate: 1.55,
  intermediate: 1.725,
  high: 1.9,
};

const GOAL_MULTIPLIERS: Record<DietGoal, number> = {
  cut: 0.8,
  maintain: 1,
  bulk: 1.2,
};

export type DailyCaloriesCalculationInput = {
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | undefined;
  sex: UserSex | undefined;
  activityLevel: ActivityLevel | undefined;
  goal: DietGoal;
  now?: number;
};

export type DailyCaloriesCalculation =
  | { ok: true; dailyCalories: number }
  | { ok: false; message: string };

// Mifflin-St Jeor sobre los datos del plan. Devuelve el motivo cuando falta
// algo en vez de lanzar: la pantalla lo muestra junto al botón Calcular.
export function calculateDailyCalories(input: DailyCaloriesCalculationInput): DailyCaloriesCalculation {
  const weightKg = input.weightKg ?? 0;
  const heightCm = input.heightCm ?? 0;
  const birthDate = input.birthDate ?? "";
  if (!weightKg || !heightCm || !birthDate) {
    return { ok: false, message: DAILY_CALORIES_MISSING_DATA_MESSAGE };
  }
  const now = input.now ?? Date.now();
  const ageYears = Math.floor((now - new Date(birthDate).getTime()) / MILLISECONDS_PER_YEAR);
  const sexOffset = (input.sex ?? "male") === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
  const activityMultiplier = ACTIVITY_MULTIPLIERS[input.activityLevel ?? "moderate"] ?? ACTIVITY_MULTIPLIERS.moderate;
  const goalMultiplier = GOAL_MULTIPLIERS[input.goal] ?? GOAL_MULTIPLIERS.maintain;
  return { ok: true, dailyCalories: Math.round(bmr * activityMultiplier * goalMultiplier) };
}
