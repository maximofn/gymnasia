import { describe, expect, it } from "vitest";

import { createDefaultDietSettings } from "./model";
import { buildDietPlanningModel } from "./planningModel";

describe("buildDietPlanningModel", () => {
  it("calcula límites y autocompleta el único macro por peso ausente", () => {
    const settings = {
      ...createDefaultDietSettings(),
      daily_calories: "2000",
      macro_mode: "protein_by_weight" as const,
      protein_grams_per_kg: "2",
      carbs_grams_per_kg: "3",
      fat_grams_per_kg: "",
    };

    const model = buildDietPlanningModel(settings, settings, 80);

    expect(model.dailyCaloriesTarget).toBe(2000);
    expect(model.autocomplete).toEqual({
      enabled: true,
      macro: "fat",
      gramsPerKgText: "0.56",
    });
    expect(model.proteinMaxGramsPerKgHint).toBeCloseTo(3.25);
    expect(model.issueByField).toBeInstanceOf(Map);
  });

  it("no ofrece cálculos por kilo sin un peso válido", () => {
    const settings = createDefaultDietSettings();
    const model = buildDietPlanningModel(settings, settings, null);

    expect(model.autocomplete.enabled).toBe(false);
    expect(model.autocomplete.gramsPerKgText).toBeNull();
    expect(model.proteinMaxGramsPerKgHint).toBeNull();
  });
});
