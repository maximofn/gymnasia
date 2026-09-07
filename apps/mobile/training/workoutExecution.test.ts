import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { SeriesType } from "./seriesContract";
import {
  expandLegacyCompletedSeriesKeys,
  listWorkoutExecutionUnits,
  parseWorkoutRestSeconds,
  resolveWorkoutExecutionCurrentKey,
  resolveWorkoutExecutionRest,
  summarizeWorkoutExecution,
} from "./workoutExecution";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

const compoundTypes: SeriesType[] = ["dropset", "restpause", "myoreps", "cluster", "superset"];

function templateFor(type: SeriesType): WorkoutTemplate {
  return {
    id: "template",
    name: "Compuesta",
    exercises: [{
      id: "exercise",
      name: "Press banca",
      sets: [8],
      series: [{
        id: "series",
        type,
        reps: "8",
        weight_kg: "100",
        rest_seconds: "90",
        sub_series: [
          { id: "sub-1", reps: "4", weight_kg: "80", rest_seconds: "15" },
          {
            id: "sub-2",
            reps: "3",
            weight_kg: "60",
            rest_seconds: "0",
            exercise_name: "Aperturas",
          },
        ],
      }],
    }],
  };
}

describe("workoutExecution", () => {
  it.each(compoundTypes)("aplana principal y mini-series de %s", (type) => {
    const units = listWorkoutExecutionUnits(templateFor(type));
    expect(units.map((unit) => unit.kind)).toEqual(["primary", "sub_series", "sub_series"]);
    expect(units.map((unit) => unit.key)).toEqual([
      "exercise:series",
      "exercise:series:sub-1",
      "exercise:series:sub-2",
    ]);
    expect(units[2].exerciseName).toBe(type === "superset" ? "Aperturas" : "Press banca");
    expect(summarizeWorkoutExecution(units, units.map((unit) => unit.key))).toMatchObject({
      completedEffortCount: 3,
      totalEffortCount: 3,
      totalVolumeKg: 1300,
      totalReps: 15,
    });
  });

  it("ignora mini-series ocultas cuando el tipo es simple", () => {
    const units = listWorkoutExecutionUnits(templateFor("normal"));
    expect(units).toHaveLength(1);
    expect(units[0].key).toBe("exercise:series");
  });

  it("usa la pausa de la siguiente mini-serie y el descanso final del bloque", () => {
    const template = templateFor("restpause");
    template.exercises.push({
      id: "exercise-2",
      name: "Remo",
      sets: [10],
      series: [{ id: "series-2", reps: "10", weight_kg: "50", rest_seconds: "30" }],
    });
    const units = listWorkoutExecutionUnits(template);

    expect(resolveWorkoutExecutionRest(units[0], units[1])).toBe(15);
    expect(resolveWorkoutExecutionRest(units[1], units[2])).toBe(0);
    expect(resolveWorkoutExecutionRest(units[2], units[3])).toBe(90);
    expect(resolveWorkoutExecutionRest(units[3], null)).toBe(0);
  });

  it("mantiene los formatos de descanso válidos y trata vacíos o inválidos como cero", () => {
    expect(parseWorkoutRestSeconds("90")).toBe(90);
    expect(parseWorkoutRestSeconds("1:30")).toBe(90);
    expect(parseWorkoutRestSeconds("1.5m")).toBe(90);
    expect(parseWorkoutRestSeconds("90s")).toBe(90);
    expect(parseWorkoutRestSeconds("")).toBe(0);
    expect(parseWorkoutRestSeconds("-10")).toBe(0);
    expect(parseWorkoutRestSeconds("1:mal")).toBe(0);
  });

  it("cuenta cada esfuerzo completado una vez", () => {
    const units = listWorkoutExecutionUnits(templateFor("dropset"));
    const summary = summarizeWorkoutExecution(units, [units[0].key, units[1].key, units[1].key]);

    expect(summary).toEqual({
      completedEffortCount: 2,
      totalEffortCount: 3,
      totalVolumeKg: 1120,
      totalReps: 12,
      effortBreakdown: {
        completed_primary: 1,
        completed_sub_series: 1,
        total_primary: 1,
        total_sub_series: 2,
      },
    });
  });

  it("aporta cero con repeticiones o pesos inválidos", () => {
    const template = templateFor("dropset");
    const series = template.exercises[0]?.series?.[0];
    const subSeries = series?.sub_series?.[0];
    if (!series || !subSeries) throw new Error("La fixture compuesta está incompleta.");
    series.reps = "sin dato";
    series.weight_kg = "-20";
    subSeries.reps = "4";
    subSeries.weight_kg = "peso";
    const units = listWorkoutExecutionUnits(template);

    expect(summarizeWorkoutExecution(units, units.map((unit) => unit.key))).toMatchObject({
      totalReps: 7,
      totalVolumeKg: 180,
    });
  });

  it("expande una serie completada heredada a todo su bloque y mantiene la raíz actual", () => {
    const units = listWorkoutExecutionUnits(templateFor("cluster"));
    const completed = expandLegacyCompletedSeriesKeys(units, ["exercise:series"]);

    expect(completed).toEqual(units.map((unit) => unit.key));
    expect(resolveWorkoutExecutionCurrentKey(units, "exercise:series", [])).toBe("exercise:series");
    expect(resolveWorkoutExecutionCurrentKey(units, "exercise:series", completed)).toBe(
      "exercise:series",
    );
  });

  it("mantiene claves únicas, totales finitos y migración idempotente en listas acotadas", () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        reps: fc.integer({ min: 0, max: 100 }),
        weight: fc.integer({ min: 0, max: 500 }),
        subs: fc.array(fc.record({
          reps: fc.integer({ min: 0, max: 100 }),
          weight: fc.integer({ min: 0, max: 500 }),
        }), { maxLength: 8 }),
      }), { minLength: 1, maxLength: 12 }),
      (seriesItems) => {
        const template: WorkoutTemplate = {
          id: "property",
          name: "Propiedad",
          exercises: [{
            id: "exercise",
            name: "Ejercicio",
            sets: seriesItems.map((item) => item.reps),
            series: seriesItems.map((item, seriesIndex) => ({
              id: `series-${seriesIndex}`,
              type: "myoreps",
              reps: `${item.reps}`,
              weight_kg: `${item.weight}`,
              rest_seconds: "60",
              sub_series: item.subs.map((sub, subIndex) => ({
                id: `sub-${seriesIndex}-${subIndex}`,
                reps: `${sub.reps}`,
                weight_kg: `${sub.weight}`,
                rest_seconds: "10",
              })),
            })),
          }],
        };
        const units = listWorkoutExecutionUnits(template);
        const keys = units.map((unit) => unit.key);
        const completed = keys.filter((_, index) => index % 2 === 0);
        const summary = summarizeWorkoutExecution(units, completed);
        const legacyRoots = units.filter((unit) => unit.kind === "primary").map((unit) => unit.key);
        const firstMigration = expandLegacyCompletedSeriesKeys(units, legacyRoots);
        const secondMigration = expandLegacyCompletedSeriesKeys(units, firstMigration);

        expect(new Set(keys).size).toBe(keys.length);
        expect(summary.completedEffortCount).toBe(new Set(completed).size);
        expect(Number.isFinite(summary.totalReps)).toBe(true);
        expect(Number.isFinite(summary.totalVolumeKg)).toBe(true);
        expect(secondMigration).toEqual(firstMigration);
      },
    ));
  });
});
