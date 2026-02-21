import { apiFetch } from "./api";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "other";

export type DietItem = {
  id?: string;
  name: string;
  grams: number | null;
  serving_count: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  calories_protein_kcal: number | null;
  calories_carbs_kcal: number | null;
  calories_fat_kcal: number | null;
  created_by_ai?: boolean;
};

export type DietMeal = {
  id?: string;
  meal_type: MealType;
  title: string | null;
  position?: number;
  items: DietItem[];
};

export type DietDay = {
  id?: string;
  day_date: string;
  notes: string | null;
  meals: DietMeal[];
};

export type DietDayUpsertPayload = {
  notes?: string;
  meals: Array<{
    meal_type: MealType;
    title?: string;
    items: Array<{
      name: string;
      grams?: number;
      serving_count?: number;
      calories_kcal?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      calories_protein_kcal?: number;
      calories_carbs_kcal?: number;
      calories_fat_kcal?: number;
    }>;
  }>;
};

export function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyDietDay(dayDate: string): DietDay {
  return {
    day_date: dayDate,
    notes: null,
    meals: [
      { meal_type: "breakfast", title: "Desayuno", items: [] },
      { meal_type: "lunch", title: "Comida", items: [] },
      { meal_type: "snack", title: "Merienda", items: [] },
      { meal_type: "dinner", title: "Cena", items: [] },
    ],
  };
}

function toUpsertPayload(day: DietDay): DietDayUpsertPayload {
  return {
    notes: day.notes ?? undefined,
    meals: day.meals.map((meal) => ({
      meal_type: meal.meal_type,
      title: meal.title ?? undefined,
      items: meal.items.map((item) => ({
        name: item.name,
        grams: item.grams ?? undefined,
        serving_count: item.serving_count ?? undefined,
        calories_kcal: item.calories_kcal ?? undefined,
        protein_g: item.protein_g ?? undefined,
        carbs_g: item.carbs_g ?? undefined,
        fat_g: item.fat_g ?? undefined,
        calories_protein_kcal: item.calories_protein_kcal ?? undefined,
        calories_carbs_kcal: item.calories_carbs_kcal ?? undefined,
        calories_fat_kcal: item.calories_fat_kcal ?? undefined,
      })),
    })),
  };
}

export async function getDietDay(dayDate: string): Promise<DietDay | null> {
  return apiFetch<DietDay | null>(`/diet/days/${dayDate}`, { auth: true });
}

export async function upsertDietDay(dayDate: string, day: DietDay): Promise<DietDay> {
  return apiFetch<DietDay>(`/diet/days/${dayDate}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(toUpsertPayload(day)),
  });
}

export function sumDayCalories(day: DietDay): number {
  return day.meals.reduce((mealAcc, meal) => {
    return (
      mealAcc +
      meal.items.reduce((itemAcc, item) => {
        return itemAcc + (item.calories_kcal ?? 0);
      }, 0)
    );
  }, 0);
}

export function defaultDietItem(): DietItem {
  return {
    name: "Nuevo item",
    grams: null,
    serving_count: null,
    calories_kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    calories_protein_kcal: null,
    calories_carbs_kcal: null,
    calories_fat_kcal: null,
  };
}
