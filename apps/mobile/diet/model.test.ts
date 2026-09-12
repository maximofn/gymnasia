import { describe, expect, it } from "vitest";

import {
  createDefaultDietSettings,
  formatDietDayContext,
  normalizeDietByDate,
  normalizeDietSettings,
  shiftISODateByDays,
  sumDayCalories,
  sumDayMacroGrams,
} from "./model";

describe("diet model", () => {
  it("normalizes legacy days without changing persisted field names", () => {
    let id = 0;
    const result = normalizeDietByDate(
      {
        "2026-09-12": {
          meals: [
            {
              title: "Comida",
              items: [{ title: " Arroz ", calories_kcal: "120,5", protein_g: 3 }],
            },
          ],
        },
      },
      (prefix) => `${prefix}-${++id}`,
    );

    expect(result["2026-09-12"].meals[0].items[0]).toMatchObject({
      title: "Arroz",
      calories_kcal: 120.5,
      protein_g: 3,
      carbs_g: 0,
      fat_g: 0,
      image_uri: null,
    });
    expect(result["2026-09-12"].meals[0].items[0].id).toContain("food_0_0_0");
  });

  it("keeps defaults and aggregate selectors stable", () => {
    expect(normalizeDietSettings(null)).toEqual(createDefaultDietSettings());
    const day = normalizeDietByDate(
      {
        today: {
          meals: [{ items: [{ calories_kcal: 100, protein_g: 12, carbs_g: 7, fat_g: 4 }] }],
        },
      },
      (prefix) => prefix,
    ).today;
    expect(sumDayCalories(day)).toBe(100);
    expect(sumDayMacroGrams(day, "protein_g")).toBe(12);
  });

  it("uses local calendar dates for navigation labels", () => {
    expect(shiftISODateByDays("2026-09-12", 1)).toBe("2026-09-13");
    expect(formatDietDayContext("2026-09-11", "2026-09-12")).toBe("Ayer");
  });
});
