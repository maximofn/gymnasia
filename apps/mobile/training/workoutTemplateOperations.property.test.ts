import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { catalogRef, linkedCatalog, unresolvedCatalog } from "../catalogs/types";
import { SERIES_TYPES, type ExerciseSeries } from "./seriesContract";
import {
  buildTemplateSeriesSignature,
  cloneWorkoutTemplateSnapshot,
  duplicateWorkoutTemplate,
  type WorkoutTemplate,
} from "./workoutTemplateOperations";

const RUNS = { numRuns: 500, seed: 227 } as const;
const PROPERTY_TEST_TIMEOUT_MS = 15_000;

function generatedIds(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `generated_${prefix}_${++counter}`;
}

function objectReferences(value: unknown, result = new Set<object>()): Set<object> {
  if (!value || typeof value !== "object" || result.has(value)) return result;
  result.add(value);
  for (const child of Object.values(value)) objectReferences(child, result);
  return result;
}

function expectNoSharedObjects(left: unknown, right: unknown): void {
  const leftObjects = objectReferences(left);
  const rightObjects = objectReferences(right);
  for (const object of leftObjects) expect(rightObjects.has(object)).toBe(false);
}

function structuralIds(template: WorkoutTemplate): Set<string> {
  const ids = new Set([template.id]);
  for (const exercise of template.exercises) {
    ids.add(exercise.id);
    for (const series of exercise.series ?? []) {
      ids.add(series.id);
      for (const subSeries of series.sub_series ?? []) ids.add(subSeries.id);
    }
  }
  return ids;
}

const subSeriesArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }).map((value) => `old_sub_${value}`),
  reps: fc.string({ maxLength: 6 }),
  weight_kg: fc.string({ maxLength: 6 }),
  rest_seconds: fc.string({ maxLength: 6 }),
  exercise_name: fc.string({ maxLength: 20 }),
}).map((subSeries) => ({
  ...subSeries,
  catalog_link: linkedCatalog(catalogRef("gymnasia_exercises", subSeries.id), "selection"),
}));

const seriesArbitrary: fc.Arbitrary<ExerciseSeries> = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }).map((value) => `old_set_${value}`),
  type: fc.constantFrom(...SERIES_TYPES),
  reps: fc.string({ maxLength: 6 }),
  weight_kg: fc.string({ maxLength: 6 }),
  rest_seconds: fc.string({ maxLength: 6 }),
  tempo_contraction: fc.string({ maxLength: 3 }),
  tempo_pause: fc.string({ maxLength: 3 }),
  tempo_relaxation: fc.string({ maxLength: 3 }),
  sub_series: fc.uniqueArray(subSeriesArbitrary, { maxLength: 4, selector: (item) => item.id }),
});

const exerciseArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }).map((value) => `old_exercise_${value}`),
  name: fc.string({ maxLength: 20 }),
  sets: fc.array(fc.integer({ min: 1, max: 50 }), { maxLength: 6 }),
  series: fc.uniqueArray(seriesArbitrary, { maxLength: 5, selector: (item) => item.id }),
}).map((exercise) => ({
  ...exercise,
  catalog_link: linkedCatalog(catalogRef("gymnasia_exercises", exercise.id), "tool"),
}));

const templateArbitrary: fc.Arbitrary<WorkoutTemplate> = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }).map((value) => `old_template_${value}`),
  name: fc.string({ maxLength: 30 }),
  exercises: fc.uniqueArray(exerciseArbitrary, { maxLength: 5, selector: (item) => item.id }),
});

describe("propiedades de las operaciones de plantillas", () => {
  it("una instantánea conserva el valor y no comparte ninguna referencia", () => {
    fc.assert(
      fc.property(templateArbitrary, (template) => {
        const snapshot = cloneWorkoutTemplateSnapshot(template);
        expect(snapshot).toEqual(template);
        expectNoSharedObjects(template, snapshot);
      }),
      RUNS,
    );
  }, PROPERTY_TEST_TIMEOUT_MS);

  it("una duplicación no comparte objetos ni reutiliza identificadores", () => {
    fc.assert(
      fc.property(templateArbitrary, (template) => {
        const duplicate = duplicateWorkoutTemplate(template, generatedIds());
        const sourceIds = structuralIds(template);
        const duplicateIds = structuralIds(duplicate);
        for (const id of sourceIds) expect(duplicateIds.has(id)).toBe(false);
        expectNoSharedObjects(template, duplicate);
      }),
      RUNS,
    );
  }, PROPERTY_TEST_TIMEOUT_MS);

  it("reasigna referencias entre ejercicios al duplicar cualquier rutina", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 2, maxLength: 8 }),
        (numbers) => {
          const exerciseIds = numbers.map((value) => `old_exercise_${value}`);
          const template: WorkoutTemplate = {
            id: "old_template_cross_refs",
            name: "Referencias",
            exercises: exerciseIds.map((id, index) => ({
              id,
              sets: [10],
              series: [{
                id: `old_set_${index}`,
                type: "superset",
                reps: "10",
                weight_kg: "20",
                rest_seconds: "60",
                sub_series: [{
                  id: `old_sub_${index}`,
                  reps: "10",
                  weight_kg: "10",
                  rest_seconds: "30",
                  exercise_id: exerciseIds[(index + 1) % exerciseIds.length],
                }],
              }],
            })),
          };

          const duplicate = duplicateWorkoutTemplate(template, generatedIds());
          duplicate.exercises.forEach((exercise, index) => {
            expect(exercise.series?.[0].sub_series?.[0].exercise_id).toBe(
              duplicate.exercises[(index + 1) % duplicate.exercises.length].id,
            );
          });
        },
      ),
      RUNS,
    );
  });

  it("cambiar cualquier campo de una mini-serie cambia la firma", () => {
    const fields = [
      "id",
      "reps",
      "weight_kg",
      "rest_seconds",
      "exercise_name",
      "exercise_id",
      "catalog_link",
    ] as const;
    fc.assert(
      fc.property(fc.constantFrom(...fields), fc.string({ minLength: 1 }), (field, value) => {
        const template: WorkoutTemplate = {
          id: "tpl",
          name: "Firma",
          exercises: [{
            id: "exercise",
            sets: [10],
            series: [{
              id: "set",
              type: "superset",
              reps: "10",
              weight_kg: "20",
              rest_seconds: "60",
              sub_series: [{
                id: "sub",
                reps: "8",
                weight_kg: "15",
                rest_seconds: "30",
                exercise_name: "Original",
                exercise_id: "target",
                catalog_link: linkedCatalog(catalogRef("gymnasia_exercises", "target"), "selection"),
              }],
            }],
          }],
        };
        const baseline = buildTemplateSeriesSignature(template);
        const changed = cloneWorkoutTemplateSnapshot(template);
        const subSeries = changed.exercises[0].series![0].sub_series![0];
        if (field === "catalog_link") subSeries.catalog_link = unresolvedCatalog("manual");
        else subSeries[field] = `${value.trim() || "changed"}_changed`;
        expect(buildTemplateSeriesSignature(changed)).not.toBe(baseline);
      }),
      RUNS,
    );
  });
});
