import { normalizeCatalogLink } from "../catalogs/migrations";
import type { CatalogLink } from "../catalogs/types";
import {
  DIET_MEAL_CATEGORIES,
  type DietMacroMode,
  type DietMealCategory,
} from "./nutritionContract";

export type DietItem = {
  id: string;
  title: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_uri?: string | null;
  catalog_link?: CatalogLink;
};

export type DietMeal = { id: string; title: string; items: DietItem[] };
export type DietDay = { day_date: string; meals: DietMeal[] };
export type GkgMacroKey = "protein" | "carbs" | "fat";
export type DietGoal = "bulk" | "cut" | "maintain";
export type ActivityLevel = "moderate" | "intermediate" | "high";
export type UserSex = "male" | "female";

export type DietSettings = {
  goal: DietGoal;
  activity_level?: ActivityLevel;
  sex?: UserSex;
  height_cm?: string;
  birth_date?: string;
  daily_calories: string;
  macro_mode: DietMacroMode;
  manual_macro_calories: {
    carbs: string;
    protein: string;
    fat: string;
  };
  protein_grams_per_kg: string;
  carbs_grams_per_kg: string;
  fat_grams_per_kg: string;
};

export const DIET_WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const DIET_MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export const GKG_MACRO_KEYS: GkgMacroKey[] = ["protein", "carbs", "fat"];

export function normalizeNumberInputText(rawValue: unknown): string {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return `${rawValue}`;
  }
  if (typeof rawValue === "string") {
    return rawValue.trim().replace(",", ".");
  }
  return "";
}

export function parseNonNegativeNumberInput(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function createDefaultDietSettings(): DietSettings {
  return {
    goal: "maintain",
    daily_calories: "",
    macro_mode: "manual_calories",
    manual_macro_calories: {
      carbs: "",
      protein: "",
      fat: "",
    },
    protein_grams_per_kg: "1.5",
    carbs_grams_per_kg: "",
    fat_grams_per_kg: "",
  };
}

export function isDietMealCategory(value: string): value is DietMealCategory {
  return DIET_MEAL_CATEGORIES.includes(value as DietMealCategory);
}

export function createDietMealExpandedState(): Record<DietMealCategory, boolean> {
  return {
    Desayuno: true,
    Almuerzo: true,
    Comida: true,
    Merienda: true,
    Cena: true,
  };
}

export function sortDietMealsByCategory(meals: DietMeal[]): DietMeal[] {
  const order = new Map(DIET_MEAL_CATEGORIES.map((category, index) => [category, index]));
  return [...meals].sort((a, b) => {
    const aOrder = isDietMealCategory(a.title) ? (order.get(a.title) ?? 999) : 999;
    const bOrder = isDietMealCategory(b.title) ? (order.get(b.title) ?? 999) : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  });
}

function dateAtLocalNoon(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export function isoDateFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return isoDateFromDate(new Date());
}

export function dateFromISO(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return dateAtLocalNoon(new Date());
  return dateAtLocalNoon(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export function shiftISODateByDays(isoDate: string, days: number): string {
  const next = dateFromISO(isoDate);
  next.setDate(next.getDate() + days);
  return isoDateFromDate(next);
}

export function formatDietDayHeader(isoDate: string): string {
  const parsed = dateFromISO(isoDate);
  return `${DIET_WEEKDAY_LABELS[parsed.getDay()]}, ${parsed.getDate()} ${DIET_MONTH_LABELS_SHORT[parsed.getMonth()]}`;
}

export function formatDietDayContext(isoDate: string, referenceIsoDate: string): string {
  const selected = dateFromISO(isoDate);
  const reference = dateFromISO(referenceIsoDate);
  const diffInDays = Math.round((selected.getTime() - reference.getTime()) / 86400000);
  if (diffInDays === 0) return "Hoy";
  if (diffInDays === -1) return "Ayer";
  if (diffInDays === 1) return "Mañana";
  return selected
    .toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");
}

export function sumDayCalories(day: DietDay | null): number {
  if (!day) return 0;
  return day.meals.reduce(
    (mealTotal, meal) =>
      mealTotal + meal.items.reduce((itemTotal, item) => itemTotal + item.calories_kcal, 0),
    0,
  );
}

export function sumDayMacroGrams(
  day: DietDay | null,
  macro: "protein_g" | "carbs_g" | "fat_g",
): number {
  if (!day) return 0;
  return day.meals.reduce(
    (mealTotal, meal) =>
      mealTotal + meal.items.reduce((itemTotal, item) => itemTotal + item[macro], 0),
    0,
  );
}

export function formatNutritionNumber(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function gkgMacroCaloriesPerGram(macro: GkgMacroKey): number {
  return macro === "fat" ? 9 : 4;
}

export function normalizeDietSettings(rawValue: unknown): DietSettings {
  const defaults = createDefaultDietSettings();
  if (!rawValue || typeof rawValue !== "object") return defaults;

  const maybe = rawValue as Partial<DietSettings>;
  const maybeManual = maybe.manual_macro_calories as
    | Partial<DietSettings["manual_macro_calories"]>
    | undefined;
  const macroMode: DietMacroMode =
    maybe.macro_mode === "protein_by_weight" ? "protein_by_weight" : "manual_calories";
  const goal: DietGoal =
    maybe.goal === "bulk" || maybe.goal === "cut" || maybe.goal === "maintain"
      ? maybe.goal
      : defaults.goal;
  const activityLevel: ActivityLevel | undefined =
    maybe.activity_level === "moderate" ||
    maybe.activity_level === "intermediate" ||
    maybe.activity_level === "high"
      ? maybe.activity_level
      : undefined;
  const sex: UserSex | undefined =
    maybe.sex === "male" || maybe.sex === "female" ? maybe.sex : undefined;
  const proteinPerKg = normalizeNumberInputText(maybe.protein_grams_per_kg);
  const carbsPerKg = normalizeNumberInputText(maybe.carbs_grams_per_kg);
  const fatPerKg = normalizeNumberInputText(maybe.fat_grams_per_kg);

  return {
    goal,
    activity_level: activityLevel,
    sex,
    height_cm: typeof maybe.height_cm === "string" ? maybe.height_cm : undefined,
    birth_date: typeof maybe.birth_date === "string" ? maybe.birth_date : undefined,
    daily_calories: normalizeNumberInputText(maybe.daily_calories),
    macro_mode: macroMode,
    manual_macro_calories: {
      carbs: normalizeNumberInputText(maybeManual?.carbs),
      protein: normalizeNumberInputText(maybeManual?.protein),
      fat: normalizeNumberInputText(maybeManual?.fat),
    },
    protein_grams_per_kg: proteinPerKg || defaults.protein_grams_per_kg,
    carbs_grams_per_kg: carbsPerKg || defaults.carbs_grams_per_kg,
    fat_grams_per_kg: fatPerKg || defaults.fat_grams_per_kg,
  };
}

export function normalizeDietNonNegativeNumber(rawValue: unknown): number {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.max(0, Math.round(rawValue * 10) / 10);
  }
  if (typeof rawValue === "string") {
    const parsed = parseNonNegativeNumberInput(rawValue);
    return parsed === null ? 0 : Math.round(parsed * 10) / 10;
  }
  return 0;
}

function normalizeImageUri(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  return trimmed || null;
}

export function normalizeDietByDate(
  rawValue: unknown,
  createId: (prefix: string) => string,
): Record<string, DietDay> {
  if (!rawValue || typeof rawValue !== "object") return {};

  const normalized: Record<string, DietDay> = {};
  Object.entries(rawValue as Record<string, unknown>).forEach(([dayKey, dayValue], dayIndex) => {
    const maybeDay = dayValue && typeof dayValue === "object" ? (dayValue as Partial<DietDay>) : {};
    const dayDate =
      typeof maybeDay.day_date === "string" && maybeDay.day_date.trim()
        ? maybeDay.day_date
        : dayKey;
    const meals: DietMeal[] = (Array.isArray(maybeDay.meals) ? maybeDay.meals : []).map(
      (mealRaw, mealIndex) => {
        const maybeMeal = mealRaw && typeof mealRaw === "object" ? (mealRaw as Partial<DietMeal>) : {};
        const items: DietItem[] = (Array.isArray(maybeMeal.items) ? maybeMeal.items : []).map(
          (itemRaw, itemIndex) => {
            const maybeItem = itemRaw && typeof itemRaw === "object" ? (itemRaw as Partial<DietItem>) : {};
            return {
              id:
                typeof maybeItem.id === "string" && maybeItem.id
                  ? maybeItem.id
                  : createId(`food_${dayIndex}_${mealIndex}_${itemIndex}`),
              title:
                typeof maybeItem.title === "string" && maybeItem.title.trim()
                  ? maybeItem.title.trim()
                  : "Comida",
              grams: normalizeDietNonNegativeNumber(maybeItem.grams),
              calories_kcal: normalizeDietNonNegativeNumber(maybeItem.calories_kcal),
              protein_g: normalizeDietNonNegativeNumber(maybeItem.protein_g),
              carbs_g: normalizeDietNonNegativeNumber(maybeItem.carbs_g),
              fat_g: normalizeDietNonNegativeNumber(maybeItem.fat_g),
              image_uri: normalizeImageUri(maybeItem.image_uri),
              catalog_link: normalizeCatalogLink(maybeItem.catalog_link, "legacy_unknown"),
            };
          },
        );

        return {
          id:
            typeof maybeMeal.id === "string" && maybeMeal.id
              ? maybeMeal.id
              : createId(`meal_${dayIndex}_${mealIndex}`),
          title:
            typeof maybeMeal.title === "string" && maybeMeal.title.trim()
              ? maybeMeal.title.trim()
              : `Comida ${mealIndex + 1}`,
          items,
        };
      },
    );

    normalized[dayDate] = { day_date: dayDate, meals };
  });

  return normalized;
}
