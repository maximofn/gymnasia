import { describe, expect, it } from "vitest";

import type { FoodCatalogEntry } from "../catalogs/types";
import { buildDietDailyPresentationModel } from "./dailyPresentationModel";

const apple: FoodCatalogEntry = {
  id: "apple",
  sourceId: "gymnasia_foods",
  source: "alimento",
  name: "Manzana",
  calories_per_100g: 52,
  protein_per_100g: 0.3,
  carbs_per_100g: 14,
  fat_per_100g: 0.2,
  fiber_per_100g: 2.4,
  serving_size_g: 100,
  serving_description: "1 unidad",
  category: "Fruta",
};

describe("buildDietDailyPresentationModel", () => {
  it("agrega el día y conserva el orden canónico de comidas", () => {
    const model = buildDietDailyPresentationModel({
      selectedDate: "2026-09-12",
      referenceDate: "2026-09-12",
      day: {
        day_date: "2026-09-12",
        meals: [{
          id: "dinner",
          title: "Cena",
          items: [{
            id: "apple-item",
            title: "Manzana",
            grams: 150,
            calories_kcal: 78,
            protein_g: 0.5,
            carbs_g: 21,
            fat_g: 0.3,
          }],
        }],
      },
      dailyCaloriesTarget: 2000,
      macroTargets: { protein: 150, carbs: 250, fat: 70 },
      foods: [apple],
      personalFoods: [],
      foodSearch: "manz",
      selectedFood: apple,
      selectedGrams: "150",
      nutritionIssues: [],
      manualFields: {
        name: "",
        grams: "",
        calories_kcal: "",
        protein_g: "",
        carbs_g: "",
        fat_g: "",
      },
    });

    expect(model.dateContextLabel).toBe("Hoy");
    expect(model.caloriesConsumed).toBe(78);
    expect(model.caloriesProgress).toBe(0.039);
    expect(model.meals.map((meal) => meal.title)).toEqual([
      "Desayuno",
      "Almuerzo",
      "Comida",
      "Merienda",
      "Cena",
    ]);
    expect(model.meals[4].id).toBe("dinner");
    expect(model.foodSearchResults).toEqual([apple]);
    expect(model.selectedFoodPreview).toEqual({
      calories: 78,
      protein: 0.5,
      carbs: 21,
      fat: 0.3,
    });
  });

  it("limita resultados, valida gramos y expone incidencias por campo", () => {
    const foods = Array.from({ length: 10 }, (_, index) => ({
      ...apple,
      id: `apple-${index}`,
      name: `Manzana ${index}`,
    }));
    const issue = { field: "grams", code: "not_positive" as const, message: "Inválido" };
    const model = buildDietDailyPresentationModel({
      selectedDate: "2026-09-11",
      referenceDate: "2026-09-12",
      day: { day_date: "2026-09-11", meals: [] },
      dailyCaloriesTarget: 0,
      macroTargets: { protein: 0, carbs: 0, fat: 0 },
      foods,
      personalFoods: [],
      foodSearch: "manzana",
      selectedFood: apple,
      selectedGrams: "no válido",
      nutritionIssues: [issue],
      manualFields: {
        name: "",
        grams: "",
        calories_kcal: "",
        protein_g: "",
        carbs_g: "",
        fat_g: "",
      },
    });

    expect(model.dateContextLabel).toBe("Ayer");
    expect(model.caloriesProgress).toBe(0);
    expect(model.caloriesPercent).toBe(0);
    expect(model.foodSearchResults).toHaveLength(8);
    expect(model.selectedFoodPreview).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(model.nutritionIssues.get("grams")).toEqual(issue);
  });
});
