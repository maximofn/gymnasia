import type { FoodCatalogEntry, FoodNutrientField } from "./types";

export type CompleteFoodCatalogEntry = FoodCatalogEntry & Record<Exclude<FoodNutrientField, "fiber_per_100g">, number>;

export function hasCompleteFoodNutrition(food: FoodCatalogEntry): food is CompleteFoodCatalogEntry {
  return (["calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g"] as const)
    .every((field) => typeof food[field] === "number" && Number.isFinite(food[field]) && food[field]! >= 0);
}

export function formatFoodNutrient(food: FoodCatalogEntry, field: FoodNutrientField, unit = ""): string {
  const value = food[field];
  const suffix = unit ? ` ${unit}` : "";
  if (value !== null) return `${value}${suffix}`;
  const qualifier = food.ciqual?.qualifiers[field];
  if (qualifier?.qualifier === "less_than") return `<${qualifier.limit}${suffix}`;
  if (qualifier?.qualifier === "trace") return "Trazas";
  return "No disponible";
}

export function scaleFoodNutrient(value: number | null, grams: number): number | null {
  return value === null ? null : Math.round(value * grams / 100 * 10) / 10;
}

export function formatFoodServing(food: FoodCatalogEntry): string {
  if (food.serving_size_g === null || !hasCompleteFoodNutrition(food)) return "No disponible";
  const ratio = food.serving_size_g / 100;
  return `${Math.round(food.calories_per_100g * ratio)} kcal · P:${(food.protein_per_100g * ratio).toFixed(1)}g · C:${(food.carbs_per_100g * ratio).toFixed(1)}g · G:${(food.fat_per_100g * ratio).toFixed(1)}g`;
}
