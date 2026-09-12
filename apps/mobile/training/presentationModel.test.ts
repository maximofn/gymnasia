import { describe, expect, it } from "vitest";

import {
  formatClock,
  formatHomeExerciseVolume,
  inferExerciseMuscle,
  normalizeDurationText,
  resolveExercisePreviewMeta,
  trainingCategoryMeta,
} from "./presentationModel";

describe("training presentation model", () => {
  it("keeps duration and clock formatting deterministic", () => {
    expect(normalizeDurationText(" 12 min ")).toBe("12");
    expect(formatClock(65.4)).toBe("1:05");
  });

  it("builds exercise summaries without React state", () => {
    expect(
      formatHomeExerciseVolume([
        { id: "one", reps: "8", weight_kg: "40", rest_seconds: "90" },
      ]),
    ).toBe("1 x 8 reps • 40 kg");
    expect(inferExerciseMuscle("Sentadilla", "strength")).toBe("Piernas");
  });

  it("keeps category and preview styling as pure data", () => {
    expect(trainingCategoryMeta("cardio").label).toBe("Cardio");
    expect(resolveExercisePreviewMeta("Remo", "Espalda", "strength")).toMatchObject({
      label: "Espalda",
      icon: "wind",
    });
  });
});
