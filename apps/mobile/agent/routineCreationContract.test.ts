import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import type { ExerciseCatalogEntry } from "../catalogs/types";
import { listWorkoutExecutionUnits } from "../training/workoutExecution";
import { prepareRoutineCreation } from "./routineCreationContract";

const exercise: ExerciseCatalogEntry = {
  id: "sentadilla",
  sourceId: "gymnasia_exercises",
  name: "Sentadilla",
  image_male: "images/sentadilla-male.webp",
  image_female: "images/sentadilla-female.webp",
  muscle_group: "Cuádriceps",
  secondary_muscles: ["Glúteos"],
  equipment: "Barra",
  difficulty: "Intermedio",
  instructions: "Baja con control.",
};

function dependencies(createId = vi.fn((prefix: string) => `${prefix}_test`)) {
  return {
    createId,
    getExerciseImageUrl: (entry: ExerciseCatalogEntry, sex: "male" | "female") => (
      `${sex}/${entry.image_male}`
    ),
  };
}

function validInput() {
  return {
    name: "Pierna completa",
    category: "strength",
    icon: "activity",
    duration_minutes: 50,
    exercises: [{
      kind: "catalog",
      source_id: "gymnasia_exercises",
      item_id: "sentadilla",
      series: [{
        type: "tempo",
        reps: 8,
        weight_kg: 60.5,
        rest_seconds: 90,
        tempo_contraction: 3,
        tempo_pause: 1,
        tempo_relaxation: 2,
      }, {
        type: "superset",
        reps: 5,
        sub_series: [{
          reps: 12,
          target: { kind: "catalog", source_id: "gymnasia_exercises", item_id: "sentadilla" },
        }, {
          reps: 10,
          target: { kind: "custom", name: "Zancadas caminando" },
        }],
      }],
    }],
  };
}

describe("creación canónica de rutinas por el agente", () => {
  it("resuelve catálogo, conserva campos avanzados y crea unidades ejecutables", () => {
    const result = prepareRoutineCreation(validInput(), [exercise], dependencies(), "a".repeat(64));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: `template_op_${"a".repeat(24)}`,
      series_schema_version: 1,
      duration_minutes: "50",
      exercises: [{
        id: `exercise_op_${"a".repeat(24)}_0`,
        name: "Sentadilla",
        sets: [8, 5],
        load_kg: 60.5,
        rest_seconds: 90,
        catalog_link: { status: "linked" },
        series: [{
          type: "tempo",
          reps: "8",
          tempo_contraction: "3",
          tempo_pause: "1",
          tempo_relaxation: "2",
        }, {
          type: "superset",
          sub_series: [{
            exercise_name: "Sentadilla",
            exercise_id: `exercise_op_${"a".repeat(24)}_0`,
            catalog_link: { status: "linked" },
          }, {
            exercise_name: "Zancadas caminando",
            catalog_link: { status: "unresolved", reason: "manual" },
          }],
        }],
      }],
    });
    expect(listWorkoutExecutionUnits(result.value)).toHaveLength(4);
  });

  it("rechaza el antiguo JSON textual y no crea identificadores", () => {
    const createId = vi.fn((prefix: string) => `${prefix}_test`);
    const result = prepareRoutineCreation(
      JSON.stringify(validInput()),
      [exercise],
      dependencies(createId),
    );
    expect(result).toMatchObject({
      ok: false,
      issues: [{ field: "data", code: "invalid_type" }],
    });
    expect(createId).not.toHaveBeenCalled();
  });

  it.each([
    ["enum", { ...validInput(), category: "power" }, "unknown_value"],
    ["duración", { ...validInput(), duration_minutes: 1000 }, "out_of_range"],
    ["nulo explícito", { ...validInput(), duration_minutes: null }, "invalid_number"],
    ["ejercicios", { ...validInput(), exercises: [] }, "empty_collection"],
    ["campo desconocido", { ...validInput(), extra: true }, "unexpected_field"],
  ])("rechaza %s sin construir la rutina", (_label, input, expectedCode) => {
    const createId = vi.fn((prefix: string) => `${prefix}_test`);
    const result = prepareRoutineCreation(input, [exercise], dependencies(createId));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
    expect(createId).not.toHaveBeenCalled();
  });

  it("distingue referencias inexistentes y referencias duplicadas", () => {
    const missing = prepareRoutineCreation(validInput(), [], dependencies());
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.issues.map((issue) => issue.code)).toContain("catalog_not_found");
    const duplicate = prepareRoutineCreation(validInput(), [exercise, { ...exercise }], dependencies());
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "catalog_ambiguous", candidates: expect.any(Array) }),
    ]));
  });

  it("no lanza ni crea ids con entradas arbitrarias inválidas", () => {
    fc.assert(fc.property(fc.anything(), (input) => {
      const createId = vi.fn((prefix: string) => `${prefix}_test`);
      const result = prepareRoutineCreation(input, [exercise], dependencies(createId));
      return typeof result.ok === "boolean"
        && (result.ok || createId.mock.calls.length === 0);
    }), { numRuns: 1000, seed: 178 });
  });

  it("conserva sin pérdidas las rutinas válidas generadas", () => {
    fc.assert(fc.property(
      fc.record({
        reps: fc.integer({ min: 1, max: 1000 }),
        weightTenths: fc.integer({ min: 0, max: 5000 }),
        restSeconds: fc.integer({ min: 0, max: 3600 }),
        durationMinutes: fc.integer({ min: 1, max: 999 }),
        contractionTenths: fc.integer({ min: 0, max: 100 }),
        pauseTenths: fc.integer({ min: 0, max: 100 }),
        relaxationTenths: fc.integer({ min: 0, max: 100 }),
      }),
      (generated) => {
        const weight = generated.weightTenths / 10;
        const contraction = generated.contractionTenths / 10;
        const pause = generated.pauseTenths / 10;
        const relaxation = generated.relaxationTenths / 10;
        const result = prepareRoutineCreation({
          name: "Tempo generado",
          category: "hypertrophy",
          icon: "target",
          duration_minutes: generated.durationMinutes,
          exercises: [{
            kind: "custom",
            name: "Ejercicio generado",
            series: [{
              type: "tempo",
              reps: generated.reps,
              weight_kg: weight,
              rest_seconds: generated.restSeconds,
              tempo_contraction: contraction,
              tempo_pause: pause,
              tempo_relaxation: relaxation,
            }],
          }],
        }, [], dependencies());
        if (!result.ok) return false;
        const series = result.value.exercises[0].series![0];
        return result.value.duration_minutes === String(generated.durationMinutes)
          && series.reps === String(generated.reps)
          && series.weight_kg === String(weight)
          && series.rest_seconds === String(generated.restSeconds)
          && series.tempo_contraction === String(contraction)
          && series.tempo_pause === String(pause)
          && series.tempo_relaxation === String(relaxation);
      },
    ), { numRuns: 500, seed: 178178 });
  });
});
