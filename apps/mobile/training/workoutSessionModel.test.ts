import { describe, expect, it } from "vitest";

import type { WorkoutTemplate } from "./workoutTemplateOperations";
import {
  inferTrainingCategory,
  normalizeWorkoutSession,
  templateHasRunnableSeries,
} from "./workoutSessionModel";

const template: WorkoutTemplate = {
  id: "template-1",
  name: "Fuerza",
  category: "strength",
  exercises: [
    {
      id: "exercise-1",
      name: "Sentadilla",
      muscle: "Piernas",
      sets: [],
      series: [
        {
          id: "series-1",
          type: "normal",
          reps: "8",
          weight_kg: "40",
          rest_seconds: "90",
        },
      ],
    },
  ],
};

describe("workout session model", () => {
  it("normalizes legacy progress into execution-unit keys", () => {
    const session = normalizeWorkoutSession(
      {
        template_id: template.id,
        current_exercise_index: 0,
        current_series_index: 0,
        completed_series_keys: ["0:0"],
        elapsed_seconds: 15.4,
        status: "running",
      },
      [template],
      {
        now: () => Date.parse("2026-09-12T10:00:00.000Z"),
        createId: (prefix) => `${prefix}-fixed`,
      },
    );

    expect(session).toMatchObject({
      id: "session-fixed",
      template_id: template.id,
      category: "strength",
      elapsed_seconds: 15,
      total_effort_count: 1,
    });
    expect(session?.execution_schema_version).toBeDefined();
  });

  it("rejects sessions whose template cannot execute", () => {
    expect(templateHasRunnableSeries({ ...template, exercises: [] })).toBe(false);
    expect(normalizeWorkoutSession({ template_id: "missing" }, [template])).toBeNull();
  });

  it("keeps the legacy category inference", () => {
    expect(inferTrainingCategory("Hipertrofia volumen")).toBe("hypertrophy");
    expect(inferTrainingCategory("Movilidad diaria")).toBe("flexibility");
  });
});
