import { hasCompleteFoodNutrition } from "../catalogs/foodNutrition";
import { findByCatalogRef } from "../catalogs/matching";
import type { FoodCatalogEntry } from "../catalogs/types";
import { sortDietMealsByCategory, type DietDay, type DietItem, type DietMeal } from "./model";
import type { DietMealCategory } from "./nutritionContract";

/**
 * Operaciones sobre una entrada concreta de una comida, compartidas por la
 * pantalla de Dieta y por las herramientas de Coach.
 *
 * Una entrada se identifica siempre por su `id`, nunca por el nombre ni por la
 * referencia del catálogo: el mismo alimento puede aparecer dos veces en una
 * comida. Todas las funciones son puras: devuelven un mapa nuevo y no tocan el
 * recibido. Una comida que se queda sin alimentos desaparece, igual que al
 * borrar desde la pantalla.
 */

export type DietByDate = Record<string, DietDay>;

/** La comida se señala por su id (pantalla) o por su categoría (Coach). */
export type DietMealSelector = { id: string } | { category: DietMealCategory };

export type DietItemLocator = {
  date: string;
  meal: DietMealSelector;
  itemId: string;
};

export type DietItemDestination = {
  date: string;
  category: DietMealCategory;
};

export type MealItemOperationError = {
  code: "entry_not_found" | "invalid_grams" | "cannot_scale";
  message: string;
};

export type MealItemOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MealItemOperationError };

export type LocatedDietItem = { day: DietDay; meal: DietMeal; item: DietItem };

function mealMatches(meal: DietMeal, selector: DietMealSelector): boolean {
  return "id" in selector
    ? meal.id === selector.id
    : meal.title.toLowerCase() === selector.category.toLowerCase();
}

function failure<T>(code: MealItemOperationError["code"], message: string): MealItemOperationResult<T> {
  return { ok: false, error: { code, message } };
}

function entryNotFound<T>(locator: DietItemLocator): MealItemOperationResult<T> {
  const where = "category" in locator.meal ? `en ${locator.meal.category} del ${locator.date}` : `en esa comida del ${locator.date}`;
  return failure("entry_not_found", `No existe la entrada "${locator.itemId}" ${where}. No se ha cambiado nada.`);
}

export function locateDietItem(dietByDate: DietByDate, locator: DietItemLocator): LocatedDietItem | null {
  const day = dietByDate[locator.date];
  if (!day) return null;
  const meal = day.meals.find((candidate) => mealMatches(candidate, locator.meal));
  if (!meal) return null;
  const item = meal.items.find((candidate) => candidate.id === locator.itemId);
  return item ? { day, meal, item } : null;
}

function withDayMeals(dietByDate: DietByDate, date: string, meals: DietMeal[]): DietByDate {
  const day = dietByDate[date] ?? { day_date: date, meals: [] };
  return {
    ...dietByDate,
    [date]: {
      ...day,
      meals: sortDietMealsByCategory(meals.filter((meal) => meal.items.length > 0)),
    },
  };
}

/** Quita exactamente la entrada indicada; las demás, aunque sean el mismo alimento, quedan intactas. */
export function removeDietItem(
  dietByDate: DietByDate,
  locator: DietItemLocator,
): MealItemOperationResult<{ dietByDate: DietByDate; removed: DietItem }> {
  const located = locateDietItem(dietByDate, locator);
  if (!located) return entryNotFound(locator);
  const meals = located.day.meals.map((meal) => meal === located.meal
    ? { ...meal, items: meal.items.filter((item) => item.id !== locator.itemId) }
    : meal);
  return { ok: true, value: { dietByDate: withDayMeals(dietByDate, locator.date, meals), removed: located.item } };
}

/** Sustituye el contenido de una entrada conservando su id y su posición. */
export function replaceDietItem(
  dietByDate: DietByDate,
  locator: DietItemLocator,
  next: DietItem,
): MealItemOperationResult<{ dietByDate: DietByDate; previous: DietItem; item: DietItem }> {
  const located = locateDietItem(dietByDate, locator);
  if (!located) return entryNotFound(locator);
  const item = { ...next, id: located.item.id };
  const meals = located.day.meals.map((meal) => meal === located.meal
    ? { ...meal, items: meal.items.map((current) => current.id === locator.itemId ? item : current) }
    : meal);
  return { ok: true, value: { dietByDate: withDayMeals(dietByDate, locator.date, meals), previous: located.item, item } };
}

/**
 * Lleva una entrada a otra comida, del mismo día o de otro, conservando su id.
 * Si la comida de destino no existe se crea con `createMealId`. Si el destino es
 * la propia comida, la entrada se queda donde estaba.
 */
export function moveDietItem(
  dietByDate: DietByDate,
  locator: DietItemLocator,
  destination: DietItemDestination,
  createMealId: () => string,
  replacement?: DietItem,
): MealItemOperationResult<{ dietByDate: DietByDate; previous: DietItem; item: DietItem }> {
  const located = locateDietItem(dietByDate, locator);
  if (!located) return entryNotFound(locator);
  const item = { ...(replacement ?? located.item), id: located.item.id };
  if (destination.date === locator.date && mealMatches(located.meal, { category: destination.category })) {
    return replaceDietItem(dietByDate, locator, item);
  }
  const removed = removeDietItem(dietByDate, locator);
  if (!removed.ok) return removed;
  const afterRemoval = removed.value.dietByDate;
  const targetDay = afterRemoval[destination.date] ?? { day_date: destination.date, meals: [] };
  const targetMeal = targetDay.meals.find((meal) => mealMatches(meal, { category: destination.category }));
  const meals = targetMeal
    ? targetDay.meals.map((meal) => meal === targetMeal ? { ...meal, items: [...meal.items, item] } : meal)
    : [...targetDay.meals, { id: createMealId(), title: destination.category, items: [item] }];
  return {
    ok: true,
    value: { dietByDate: withDayMeals(afterRemoval, destination.date, meals), previous: located.item, item },
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Recalcula una entrada para otra cantidad de gramos. Si está vinculada a una
 * ficha del catálogo con datos completos, parte de la ficha; si no (alimento
 * manual o ficha ya no disponible), escala en proporción a sus propios valores,
 * como hace la pantalla al editar.
 */
export function rescaleDietItem(
  item: DietItem,
  grams: number,
  catalog: readonly FoodCatalogEntry[],
): MealItemOperationResult<DietItem> {
  if (!Number.isFinite(grams) || grams <= 0) {
    return failure("invalid_grams", "Los gramos deben ser un número mayor que 0.");
  }
  const link = item.catalog_link;
  const entry = link?.status === "linked" ? findByCatalogRef(catalog as FoodCatalogEntry[], link.ref) : null;
  if (entry && hasCompleteFoodNutrition(entry)) {
    const ratio = grams / 100;
    return {
      ok: true,
      value: {
        ...item,
        grams,
        calories_kcal: roundTenth(entry.calories_per_100g * ratio),
        protein_g: roundTenth(entry.protein_per_100g * ratio),
        carbs_g: roundTenth(entry.carbs_per_100g * ratio),
        fat_g: roundTenth(entry.fat_per_100g * ratio),
      },
    };
  }
  if (!(item.grams > 0)) {
    return failure("cannot_scale", "La entrada no tiene gramos de referencia y no se pueden recalcular sus calorías. No se ha cambiado nada.");
  }
  const ratio = grams / item.grams;
  return {
    ok: true,
    value: {
      ...item,
      grams,
      calories_kcal: roundTenth(item.calories_kcal * ratio),
      protein_g: roundTenth(item.protein_g * ratio),
      carbs_g: roundTenth(item.carbs_g * ratio),
      fat_g: roundTenth(item.fat_g * ratio),
    },
  };
}
