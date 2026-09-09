import { describe, expect, it } from "vitest";

import type { WorkoutTemplate } from "./workoutTemplateOperations";
import {
  formatWorkoutTemplateIssues,
  validateWorkoutTemplateForWrite,
} from "./workoutTemplateContract";

function fixture(): WorkoutTemplate {
  return {
    id: "template",
    name: "Fuerza",
    category: "strength",
    icon: "activity",
    duration_minutes: "45",
    exercises: [{
      id: "exercise",
      name: "Press",
      sets: [999],
      load_kg: 999,
      rest_seconds: 999,
      series: [{
        id: "series",
        reps: "10",
        weight_kg: "20.5",
        rest_seconds: "60",
      }],
    }],
  };
}

describe("contrato de escritura de rutinas", () => {
  it("sella el esquema y deriva los espejos heredados de las series", () => {
    const result = validateWorkoutTemplateForWrite(fixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      series_schema_version: 1,
      exercises: [{ sets: [10], load_kg: 20.5, rest_seconds: 60 }],
    });
    expect(fixture().exercises[0].sets).toEqual([999]);
  });

  it("rechaza todos los errores numéricos y el tempo incompleto", () => {
    const template = fixture();
    template.duration_minutes = "1000";
    template.exercises[0].series = [{
      id: "series",
      type: "tempo",
      reps: "1.5",
      weight_kg: "-1",
      rest_seconds: "2.5",
      tempo_contraction: "1",
    }];
    const result = validateWorkoutTemplateForWrite(template);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => [issue.field, issue.code])).toEqual(expect.arrayContaining([
      ["duration_minutes", "out_of_range"],
      ["exercises[0].series[0].reps", "not_integer"],
      ["exercises[0].series[0].weight_kg", "negative"],
      ["exercises[0].series[0].rest_seconds", "not_integer"],
      ["exercises[0].series[0].tempo_pause", "required"],
      ["exercises[0].series[0].tempo_relaxation", "required"],
    ]));
  });

  it("exige series por ejercicio y subseries para todos los tipos compuestos", () => {
    const withoutSeries = fixture();
    withoutSeries.exercises[0].series = [];
    expect(validateWorkoutTemplateForWrite(withoutSeries)).toMatchObject({
      ok: false,
      issues: [{ field: "exercises[0].series", code: "empty_collection" }],
    });

    for (const type of ["dropset", "restpause", "myoreps", "cluster", "superset"] as const) {
      const compound = fixture();
      compound.exercises[0].series![0].type = type;
      expect(validateWorkoutTemplateForWrite(compound)).toMatchObject({
        ok: false,
        issues: [expect.objectContaining({ code: "compound_requires_sub_series" })],
      });
    }
  });

  it("exige objetivo en superseries y conserva subseries válidas ocultas", () => {
    const superset = fixture();
    superset.exercises[0].series![0] = {
      ...superset.exercises[0].series![0],
      type: "superset",
      sub_series: [{ id: "sub", reps: "8", weight_kg: "", rest_seconds: "0" }],
    };
    expect(validateWorkoutTemplateForWrite(superset)).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "superset_target_required" })],
    });

    superset.exercises[0].series![0].type = undefined;
    const hidden = validateWorkoutTemplateForWrite(superset);
    expect(hidden.ok).toBe(true);
    if (hidden.ok) expect(hidden.value.exercises[0].series![0].sub_series).toHaveLength(1);
  });

  it("formatea el primer error y cuenta los restantes", () => {
    expect(formatWorkoutTemplateIssues([
      { field: "name", code: "required", message: "Falta el nombre." },
      { field: "exercises", code: "empty_collection", message: "Falta un ejercicio." },
    ])).toBe("Falta el nombre. Queda 1 error por corregir.");
  });
});
