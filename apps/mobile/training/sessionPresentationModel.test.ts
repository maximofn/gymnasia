import { describe, expect, it } from "vitest";

import { buildActiveSessionPresentation } from "./sessionPresentationModel";
import type { WorkoutTemplate } from "./workoutTemplateOperations";
import { normalizeWorkoutSession } from "./workoutSessionModel";

const template: WorkoutTemplate = {
  id: "template",
  name: "Fuerza",
  category: "strength",
  exercises: [{
    id: "exercise",
    name: "Sentadilla",
    muscle: "Piernas",
    sets: [],
    series: [{
      id: "series",
      type: "normal",
      reps: "8",
      weight_kg: "40",
      rest_seconds: "90",
    }],
  }],
};

describe("buildActiveSessionPresentation", () => {
  it("resuelve unidades, ejercicio actual, progreso y descanso", () => {
    const session = normalizeWorkoutSession(
      { template_id: template.id, status: "running" },
      [template],
      { now: () => 1_000, createId: () => "session" },
    )!;

    const model = buildActiveSessionPresentation(session, null, [template]);

    expect(model.template).toBe(template);
    expect(model.performance.totalEffortCount).toBe(1);
    expect(model.currentUnit?.exerciseName).toBe("Sentadilla");
    expect(model.exercises).toHaveLength(1);
    expect(model.exercises[0]).toMatchObject({
      completedEffortCount: 0,
      totalEffortCount: 1,
      isCurrentExercise: true,
    });
    expect(model.restTargetSeconds).toBe(0);
    expect(model.progressPercent).toBe(0);
  });

  it("calcula el avance del descanso y acepta una sesión ausente", () => {
    const session = normalizeWorkoutSession(
      { template_id: template.id, status: "running" },
      [template],
      { now: () => 1_000, createId: () => "session" },
    )!;
    const resting = {
      ...session,
      is_resting: true,
      rest_seconds_total: 90,
      rest_seconds_left: 45,
    };

    expect(buildActiveSessionPresentation(resting, null, [template]).restProgressRatio).toBe(0.5);
    expect(buildActiveSessionPresentation(null, null, [template])).toMatchObject({
      template: null,
      currentUnit: null,
      progressPercent: 0,
      exercises: [],
    });
  });
});
