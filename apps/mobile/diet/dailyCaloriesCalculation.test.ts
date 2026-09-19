import { describe, expect, it } from "vitest";

import {
  DAILY_CALORIES_MISSING_DATA_MESSAGE,
  calculateDailyCalories,
} from "./dailyCaloriesCalculation";

const now = Date.UTC(2026, 8, 18);
const complete = {
  weightKg: 80.5,
  heightCm: 180,
  birthDate: "1990-01-01",
  sex: "male" as const,
  activityLevel: "moderate" as const,
  goal: "maintain" as const,
  now,
};

describe("calculateDailyCalories", () => {
  it("returns the missing-data message instead of a number when weight, height or birth date is absent", () => {
    for (const partial of [
      { ...complete, weightKg: null },
      { ...complete, weightKg: 0 },
      { ...complete, heightCm: null },
      { ...complete, birthDate: undefined },
      { ...complete, birthDate: "" },
    ]) {
      expect(calculateDailyCalories(partial)).toEqual({ ok: false, message: DAILY_CALORIES_MISSING_DATA_MESSAGE });
    }
  });

  it("applies Mifflin-St Jeor with the activity and goal multipliers", () => {
    const ageYears = Math.floor((now - Date.UTC(1990, 0, 1)) / 31557600000);
    const bmr = 10 * 80.5 + 6.25 * 180 - 5 * ageYears + 5;

    expect(calculateDailyCalories(complete)).toEqual({ ok: true, dailyCalories: Math.round(bmr * 1.55) });
    expect(calculateDailyCalories({ ...complete, sex: "female", goal: "cut", activityLevel: "high" })).toEqual({
      ok: true,
      dailyCalories: Math.round((bmr - 166) * 1.9 * 0.8),
    });
  });

  it("defaults sex and activity level when the plan has not set them", () => {
    expect(calculateDailyCalories({ ...complete, sex: undefined, activityLevel: undefined })).toEqual(
      calculateDailyCalories(complete),
    );
  });
});
