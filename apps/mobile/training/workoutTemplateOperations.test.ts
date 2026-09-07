import { describe, expect, it } from "vitest";
import { catalogRef, linkedCatalog, unresolvedCatalog } from "../catalogs/types";
import {
  buildWorkoutTemplateRevision,
  buildTemplateSeriesSignature,
  changeExerciseSeriesType,
  cloneWorkoutTemplateSnapshot,
  createSeriesAfter,
  duplicateExerciseSeries,
  duplicateWorkoutExercise,
  duplicateWorkoutTemplate,
  diffWorkoutTemplates,
  type WorkoutTemplate,
} from "./workoutTemplateOperations";

function deterministicIds(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `${prefix}_new_${++counter}`;
}

function fixture(): WorkoutTemplate {
  return {
    id: "tpl_original",
    series_schema_version: 1,
    name: "Rutina avanzada",
    category: "hypertrophy",
    icon: "zap",
    duration_minutes: "45",
    exercises: [
      {
        id: "exercise_press",
        name: "Press",
        sets: [8],
        catalog_link: linkedCatalog(catalogRef("gymnasia_exercises", "press"), "selection"),
        series: [
          {
            id: "set_superset",
            type: "superset",
            reps: "8",
            weight_kg: "60",
            rest_seconds: "90",
            tempo_contraction: "3",
            tempo_pause: "1",
            tempo_relaxation: "2",
            sub_series: [{
              id: "sub_fly",
              reps: "12",
              weight_kg: "16",
              rest_seconds: "30",
              exercise_name: "Aperturas",
              exercise_id: "exercise_fly",
              catalog_link: linkedCatalog(catalogRef("gymnasia_exercises", "fly"), "tool"),
            }],
          },
          {
            id: "set_backoff",
            type: "normal",
            reps: "10",
            weight_kg: "50",
            rest_seconds: "60",
          },
        ],
      },
      {
        id: "exercise_fly",
        name: "Aperturas",
        sets: [12],
        catalog_link: unresolvedCatalog("manual"),
        series: [{
          id: "set_fly",
          type: "normal",
          reps: "12",
          weight_kg: "16",
          rest_seconds: "60",
        }],
      },
    ],
  };
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

describe("operaciones de plantillas con series avanzadas", () => {
  it("crea una instantánea idéntica sin compartir ningún objeto", () => {
    const original = fixture();
    const snapshot = cloneWorkoutTemplateSnapshot(original);

    expect(snapshot).toEqual(original);
    expectNoSharedObjects(original, snapshot);
  });

  it("duplica la rutina con identidades nuevas y reasigna la superserie", () => {
    const original = fixture();
    const duplicate = duplicateWorkoutTemplate(original, deterministicIds());

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.exercises.map((exercise) => exercise.id)).not.toEqual(
      original.exercises.map((exercise) => exercise.id),
    );
    expect(duplicate.exercises[0].series?.[0].id).not.toBe(
      original.exercises[0].series?.[0].id,
    );
    expect(duplicate.exercises[0].series?.[0].sub_series?.[0].id).not.toBe(
      original.exercises[0].series?.[0].sub_series?.[0].id,
    );
    expect(duplicate.exercises[0].series?.[0].sub_series?.[0].exercise_id).toBe(
      duplicate.exercises[1].id,
    );
    expect(duplicate.exercises[0].catalog_link).toEqual(original.exercises[0].catalog_link);
    expect(duplicate.exercises[0].catalog_link).not.toBe(original.exercises[0].catalog_link);
    const originalRef = original.exercises[0].catalog_link?.status === "linked"
      ? original.exercises[0].catalog_link.ref
      : null;
    const duplicateRef = duplicate.exercises[0].catalog_link?.status === "linked"
      ? duplicate.exercises[0].catalog_link.ref
      : null;
    expect(duplicateRef).toEqual(originalRef);
    expect(duplicateRef).not.toBe(originalRef);
    expectNoSharedObjects(original, duplicate);
  });

  it("duplica ejercicios y series sin compartir IDs, mini-series ni catálogo", () => {
    const originalExercise = fixture().exercises[0];
    const duplicateExercise = duplicateWorkoutExercise(originalExercise, deterministicIds());
    const originalSeries = originalExercise.series?.[0];
    expect(originalSeries).toBeDefined();
    const duplicateSeries = duplicateExerciseSeries(originalSeries!, deterministicIds());

    expect(duplicateExercise.id).not.toBe(originalExercise.id);
    expect(duplicateExercise.series?.[0].sub_series?.[0].exercise_id).toBe("exercise_fly");
    expectNoSharedObjects(originalExercise, duplicateExercise);
    expect(duplicateSeries.id).not.toBe(originalSeries!.id);
    expect(duplicateSeries.sub_series?.[0].id).not.toBe(originalSeries!.sub_series?.[0].id);
    expectNoSharedObjects(originalSeries, duplicateSeries);
  });

  it("crea la siguiente serie copiando toda la configuración con IDs nuevos", () => {
    const source = fixture().exercises[0].series?.[0];
    expect(source).toBeDefined();

    const next = createSeriesAfter(source, deterministicIds());

    expect(next).toMatchObject({
      type: "superset",
      tempo_contraction: "3",
      tempo_pause: "1",
      tempo_relaxation: "2",
      sub_series: [{ reps: "12", weight_kg: "16", exercise_id: "exercise_fly" }],
    });
    expect(next.id).not.toBe(source!.id);
    expect(next.sub_series?.[0].id).not.toBe(source!.sub_series?.[0].id);
    expectNoSharedObjects(source, next);
  });

  it("conserva mini-series al pasar a simple y las recupera al volver a compuesto", () => {
    const source = fixture().exercises[0].series?.[0];
    expect(source).toBeDefined();
    const createId = deterministicIds();

    const simple = changeExerciseSeriesType(source!, "normal", createId);
    const restored = changeExerciseSeriesType(simple, "superset", createId);

    expect(simple.type).toBe("normal");
    expect(simple.sub_series).toEqual(source!.sub_series);
    expect(simple.sub_series).not.toBe(source!.sub_series);
    expect(restored.sub_series).toEqual(source!.sub_series);
  });

  it("crea una mini-serie inicial al entrar por primera vez en un tipo compuesto", () => {
    const source = fixture().exercises[1].series?.[0];
    expect(source).toBeDefined();

    const dropset = changeExerciseSeriesType(source!, "dropset", deterministicIds());

    expect(dropset.sub_series).toEqual([{
      id: expect.stringMatching(/^sub_new_/),
      reps: "12",
      weight_kg: "16",
      rest_seconds: "0",
    }]);
  });

  it("incluye todos los campos funcionales de series y mini-series en la firma", () => {
    const baseline = fixture();
    const baselineSignature = buildTemplateSeriesSignature(baseline);
    const mutations: Array<(template: WorkoutTemplate) => void> = [
      (template) => { template.exercises.reverse(); },
      (template) => { template.exercises[0].series?.reverse(); },
      (template) => { template.exercises[0].series![0].type = "dropset"; },
      (template) => { template.exercises[0].series![0].reps = "9"; },
      (template) => { template.exercises[0].series![0].weight_kg = "61"; },
      (template) => { template.exercises[0].series![0].rest_seconds = "91"; },
      (template) => { template.exercises[0].series![0].tempo_contraction = "4"; },
      (template) => { template.exercises[0].series![0].tempo_pause = "2"; },
      (template) => { template.exercises[0].series![0].tempo_relaxation = "1"; },
      (template) => { template.exercises[0].series![0].sub_series![0].id = "sub_other"; },
      (template) => { template.exercises[0].series![0].sub_series![0].reps = "13"; },
      (template) => { template.exercises[0].series![0].sub_series![0].weight_kg = "17"; },
      (template) => { template.exercises[0].series![0].sub_series![0].rest_seconds = "31"; },
      (template) => { template.exercises[0].series![0].sub_series![0].exercise_name = "Cruces"; },
      (template) => { template.exercises[0].series![0].sub_series![0].exercise_id = "exercise_other"; },
      (template) => {
        template.exercises[0].series![0].sub_series![0].catalog_link = unresolvedCatalog("manual");
      },
    ];

    for (const mutate of mutations) {
      const changed = cloneWorkoutTemplateSnapshot(baseline);
      mutate(changed);
      expect(buildTemplateSeriesSignature(changed)).not.toBe(baselineSignature);
    }

    const whitespaceOnly = cloneWorkoutTemplateSnapshot(baseline);
    whitespaceOnly.exercises[0].series![0].reps = " 8 ";
    expect(buildTemplateSeriesSignature(whitespaceOnly)).toBe(baselineSignature);
  });

  it("detecta cambios funcionales completos sin conflictos por campos derivados", () => {
    const baseline = fixture();
    const revision = buildWorkoutTemplateRevision(baseline);
    const functionalMutations: Array<(template: WorkoutTemplate) => void> = [
      (template) => { template.name = "Otra rutina"; },
      (template) => { template.category = "strength"; },
      (template) => { template.icon = "star"; },
      (template) => { template.duration_minutes = "60"; },
      (template) => { template.exercises.reverse(); },
      (template) => { template.exercises[0].name = "Otro ejercicio"; },
      (template) => { template.exercises[0].image_uri = "exercise.png"; },
      (template) => { template.exercises[0].muscle = "chest"; },
      (template) => { template.exercises[0].catalog_link = unresolvedCatalog("not_found"); },
      (template) => { template.exercises[0].series![0].reps = "20"; },
    ];
    for (const mutate of functionalMutations) {
      const changed = cloneWorkoutTemplateSnapshot(baseline);
      mutate(changed);
      expect(buildWorkoutTemplateRevision(changed)).not.toBe(revision);
      expect(diffWorkoutTemplates(baseline, changed).hasChanges).toBe(true);
    }

    const derivedOnly = cloneWorkoutTemplateSnapshot(baseline);
    derivedOnly.series_schema_version = 999;
    derivedOnly.exercises[0].sets = [99, 98];
    derivedOnly.exercises[0].load_kg = 999;
    derivedOnly.exercises[0].rest_seconds = 999;
    expect(buildWorkoutTemplateRevision(derivedOnly)).toBe(revision);
    expect(diffWorkoutTemplates(baseline, derivedOnly)).toEqual({
      hasChanges: false,
      changes: [],
      summaries: [],
    });
  });
});
