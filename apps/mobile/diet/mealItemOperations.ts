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

/*
 * Operaciones sobre una comida entera (todas sus entradas a la vez).
 *
 * Una comida se señala por día y categoría. Cuando la comida de destino ya
 * tiene alimentos, quien llama debe decir si se sustituyen o se suman: sin esa
 * decisión no se toca nada, para no mezclar ni perder comidas por sorpresa.
 */

export type DietMealLocator = { date: string; category: DietMealCategory };

/** `replace` deja en el destino solo lo que llega; `append` lo suma a lo que ya había. */
export type DietMealPlacement = "replace" | "append";

export type MealOperationError = {
  code: "meal_empty" | "same_meal" | "destination_not_empty";
  message: string;
  /** En `destination_not_empty`, lo que ya hay en el destino. */
  existing?: DietItem[];
};

export type MealOperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MealOperationError };

function mealFailure<T>(error: MealOperationError): MealOperationResult<T> {
  return { ok: false, error };
}

function findMeal(dietByDate: DietByDate, locator: DietMealLocator): DietMeal | null {
  return dietByDate[locator.date]?.meals.find((meal) => mealMatches(meal, { category: locator.category })) ?? null;
}

/** Alimentos de una comida, en su orden; vacío si el día o la comida no existen. */
export function dietMealItems(dietByDate: DietByDate, locator: DietMealLocator): DietItem[] {
  return findMeal(dietByDate, locator)?.items ?? [];
}

/**
 * Coloca una lista de entradas en una comida, creándola con `createMealId` si no
 * existe. Es la pieza común de «repetir día» en la pantalla y de las
 * herramientas de Coach que añaden, copian o mueven comidas.
 */
export function placeItemsInMeal(
  dietByDate: DietByDate,
  target: DietMealLocator,
  items: readonly DietItem[],
  placement: DietMealPlacement,
  createMealId: () => string,
): { dietByDate: DietByDate; replaced: DietItem[] } {
  const day = dietByDate[target.date] ?? { day_date: target.date, meals: [] };
  const existing = day.meals.find((meal) => mealMatches(meal, { category: target.category }));
  const replaced = placement === "replace" ? existing?.items ?? [] : [];
  const meals = existing
    ? day.meals.map((meal) => meal === existing
      ? { ...meal, items: placement === "replace" ? [...items] : [...meal.items, ...items] }
      : meal)
    : [...day.meals, { id: createMealId(), title: target.category, items: [...items] }];
  return { dietByDate: withDayMeals(dietByDate, target.date, meals), replaced };
}

function sameMeal(source: DietMealLocator, target: DietMealLocator): boolean {
  return source.date === target.date && source.category.toLowerCase() === target.category.toLowerCase();
}

function emptyMeal<T>(locator: DietMealLocator): MealOperationResult<T> {
  return mealFailure({
    code: "meal_empty",
    message: `No hay alimentos en ${locator.category} del ${locator.date}. No se ha cambiado nada.`,
  });
}

/**
 * Comprueba si se puede escribir en el destino. Sin `placement`, solo se puede
 * si el destino está vacío; si tiene alimentos, devuelve cuáles.
 */
function resolvePlacement(
  dietByDate: DietByDate,
  target: DietMealLocator,
  placement: DietMealPlacement | undefined,
): MealOperationResult<DietMealPlacement> {
  if (placement) return { ok: true, value: placement };
  const existing = dietMealItems(dietByDate, target);
  if (existing.length === 0) return { ok: true, value: "append" };
  return mealFailure({
    code: "destination_not_empty",
    message: `${target.category} del ${target.date} ya tiene alimentos. Hay que decidir si se sustituyen o se suman. No se ha cambiado nada.`,
    existing,
  });
}

/**
 * Copia los alimentos de una comida a otra, del mismo día o de otro, con los
 * mismos gramos y macros. Cada copia recibe un id nuevo de `createItemId`, para
 * que origen y destino se puedan corregir por separado.
 */
export function copyDietMeal(
  dietByDate: DietByDate,
  source: DietMealLocator,
  target: DietMealLocator,
  options: { placement?: DietMealPlacement; createItemId: (index: number) => string; createMealId: () => string },
): MealOperationResult<{ dietByDate: DietByDate; copied: DietItem[]; replaced: DietItem[] }> {
  if (sameMeal(source, target)) {
    return mealFailure({ code: "same_meal", message: "El origen y el destino son la misma comida. No se ha cambiado nada." });
  }
  const items = dietMealItems(dietByDate, source);
  if (items.length === 0) return emptyMeal(source);
  const placement = resolvePlacement(dietByDate, target, options.placement);
  if (!placement.ok) return placement;
  const copied = items.map((item, index) => ({ ...item, id: options.createItemId(index) }));
  const placed = placeItemsInMeal(dietByDate, target, copied, placement.value, options.createMealId);
  return { ok: true, value: { dietByDate: placed.dietByDate, copied, replaced: placed.replaced } };
}

/**
 * Lleva todos los alimentos de una comida a otra y deja la de origen vacía. Las
 * entradas conservan su id: siguen siendo las mismas, solo cambian de sitio.
 */
export function moveDietMeal(
  dietByDate: DietByDate,
  source: DietMealLocator,
  target: DietMealLocator,
  options: { placement?: DietMealPlacement; createMealId: () => string },
): MealOperationResult<{ dietByDate: DietByDate; moved: DietItem[]; replaced: DietItem[] }> {
  if (sameMeal(source, target)) {
    return mealFailure({ code: "same_meal", message: "El origen y el destino son la misma comida. No se ha cambiado nada." });
  }
  const items = dietMealItems(dietByDate, source);
  if (items.length === 0) return emptyMeal(source);
  const placement = resolvePlacement(dietByDate, target, options.placement);
  if (!placement.ok) return placement;
  const cleared = clearDietMeal(dietByDate, source);
  if (!cleared.ok) return cleared;
  const placed = placeItemsInMeal(cleared.value.dietByDate, target, items, placement.value, options.createMealId);
  return { ok: true, value: { dietByDate: placed.dietByDate, moved: [...items], replaced: placed.replaced } };
}

/** Quita todos los alimentos de una comida de un día; las demás comidas y días quedan intactos. */
export function clearDietMeal(
  dietByDate: DietByDate,
  locator: DietMealLocator,
): MealOperationResult<{ dietByDate: DietByDate; cleared: DietItem[] }> {
  const meal = findMeal(dietByDate, locator);
  if (!meal || meal.items.length === 0) return emptyMeal(locator);
  const day = dietByDate[locator.date];
  const meals = day.meals.filter((candidate) => candidate !== meal);
  return { ok: true, value: { dietByDate: withDayMeals(dietByDate, locator.date, meals), cleared: [...meal.items] } };
}
