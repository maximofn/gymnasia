import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  evaluateDietPlan,
  resolveDietMealCategory,
  validateNutritionFormInput,
  validateNutritionItem,
  validateStructuredNutrition,
} from "./nutritionContract";

const validItem = {
  name: "Arroz blanco",
  grams: 150,
  calories_kcal: 195,
  protein_g: 4.1,
  carbs_g: 43.4,
  fat_g: 0.4,
};

describe("contrato nutricional", () => {
  it("acepta valores finitos no negativos, incluido un alimento completamente a cero", () => {
    expect(validateNutritionItem(validItem)).toEqual({ ok: true, value: validItem, issues: [] });
    expect(validateNutritionItem({
      name: "Agua",
      grams: 0,
      calories_kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    }).ok).toBe(true);
  });

  it.each([
    ["grams", -1, "negative"],
    ["calories_kcal", Number.NaN, "not_finite"],
    ["protein_g", Number.POSITIVE_INFINITY, "not_finite"],
    ["carbs_g", "10", "invalid_type"],
    ["fat_g", null, "invalid_type"],
  ])("rechaza %s inválido sin convertirlo", (field, value, code) => {
    const result = validateNutritionItem({ ...validItem, [field]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(expect.objectContaining({ field, code }));
    }
  });

  it("exige nombre y todos los campos numéricos", () => {
    const result = validateNutritionItem({ name: " ", grams: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual([
        "name",
        "calories_kcal",
        "protein_g",
        "carbs_g",
        "fat_g",
      ]);
    }
  });

  it("interpreta blancos como cero y coma decimal solo en el formulario", () => {
    const result = validateNutritionFormInput({
      name: "Agua",
      grams: "250,5",
      calories_kcal: "",
      protein_g: "",
      carbs_g: "0",
      fat_g: 0,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Agua",
        grams: 250.5,
        calories_kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
      issues: [],
    });
  });

  it("valida el enum y los campos de la salida estructurada", () => {
    expect(validateStructuredNutrition({
      dish_name: validItem.name,
      grams: validItem.grams,
      calories_kcal: validItem.calories_kcal,
      protein_g: validItem.protein_g,
      carbs_g: validItem.carbs_g,
      fat_g: validItem.fat_g,
      food_type: "alimento",
    }).ok).toBe(true);

    const invalid = validateStructuredNutrition({
      dish_name: validItem.name,
      grams: validItem.grams,
      calories_kcal: -1,
      protein_g: validItem.protein_g,
      carbs_g: validItem.carbs_g,
      fat_g: validItem.fat_g,
      food_type: "snack",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.field)).toEqual(["calories_kcal", "food_type"]);
    }
  });

  it("resuelve las categorías actuales y rechaza categorías arbitrarias", () => {
    expect(resolveDietMealCategory("  desayuno ")).toEqual({
      ok: true,
      value: "Desayuno",
      issues: [],
    });
    expect(resolveDietMealCategory("Picoteo nocturno").ok).toBe(false);
  });

  it("evalúa presupuestos manuales sin producir remanentes negativos", () => {
    const result = evaluateDietPlan({
      daily_calories: "2000",
      macro_mode: "manual_calories",
      manual_macro_calories: { protein: "1000", carbs: "1000", fat: "500" },
      protein_grams_per_kg: "",
      carbs_grams_per_kg: "",
      fat_grams_per_kg: "",
    }, 80);
    expect(result.issues).toEqual([]);
    expect(result.assignedCalories).toBe(2500);
    expect(result.remainingCalories).toBe(0);
    expect(result.excessCalories).toBe(500);
    expect(result.budgetStatus).toBe("exceeded");
  });

  it("evalúa el modo g/kg con el peso actual", () => {
    const result = evaluateDietPlan({
      daily_calories: "2400",
      macro_mode: "protein_by_weight",
      manual_macro_calories: { protein: "", carbs: "", fat: "" },
      protein_grams_per_kg: "2",
      carbs_grams_per_kg: "3",
      fat_grams_per_kg: "1",
    }, 80);
    expect(result.issues).toEqual([]);
    expect(result.macroGrams).toEqual({ protein: 160, carbs: 240, fat: 80 });
    expect(result.assignedCalories).toBe(2320);
    expect(result.remainingCalories).toBe(80);
    expect(result.budgetStatus).toBe("valid");
  });

  it("distingue objetivo sin configurar de objetivo cero o no finito", () => {
    const base = {
      macro_mode: "manual_calories" as const,
      manual_macro_calories: { protein: "", carbs: "", fat: "" },
      protein_grams_per_kg: "",
      carbs_grams_per_kg: "",
      fat_grams_per_kg: "",
    };
    expect(evaluateDietPlan({ ...base, daily_calories: "" }, null).budgetStatus).toBe("unconfigured");
    expect(evaluateDietPlan({ ...base, daily_calories: "0" }, null).issues[0]).toEqual(
      expect.objectContaining({ field: "daily_calories", code: "not_positive" }),
    );
    expect(evaluateDietPlan({ ...base, daily_calories: "Infinity" }, null).issues[0]).toEqual(
      expect.objectContaining({ field: "daily_calories", code: "not_finite" }),
    );
  });

  it("nunca acepta nutrientes no finitos o negativos (property-based)", () => {
    fc.assert(fc.property(
      fc.record({
        name: fc.string(),
        grams: fc.oneof(fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string(), fc.constant(null)),
        calories_kcal: fc.oneof(fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string(), fc.constant(undefined)),
        protein_g: fc.oneof(fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string()),
        carbs_g: fc.oneof(fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string()),
        fat_g: fc.oneof(fc.double({ noNaN: false, noDefaultInfinity: false }), fc.string()),
      }),
      (candidate) => {
        const result = validateNutritionItem(candidate);
        if (!result.ok) return true;
        return result.value.name.length > 0
          && [
            result.value.grams,
            result.value.calories_kcal,
            result.value.protein_g,
            result.value.carbs_g,
            result.value.fat_g,
          ].every((value) => Number.isFinite(value) && value >= 0);
      },
    ), { numRuns: 1000, seed: 167 });
  });
});
