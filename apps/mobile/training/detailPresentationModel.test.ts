import { describe, expect, it } from "vitest";

import type { ExerciseCatalogEntry } from "../catalogs/types";
import { buildTrainingDetailPresentation } from "./detailPresentationModel";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

const template: WorkoutTemplate = {
  id: "template",
  name: "Fuerza",
  category: "strength",
  duration_minutes: "45",
  exercises: [{
    id: "exercise",
    name: "Press banca",
    sets: [],
    series: [{ id: "series", type: "normal", reps: "8", weight_kg: "40", rest_seconds: "90" }],
  }],
};

const unrelatedCatalogExercise: ExerciseCatalogEntry = {
  sourceId: "gymnasia_exercises",
  id: "squat",
  name: "Sentadilla",
  image_male: "squat-male.png",
  image_female: "squat-female.png",
  muscle_group: "Piernas",
  secondary_muscles: [],
  equipment: "Barra",
  difficulty: "Intermedio",
  instructions: "Flexiona las rodillas.",
};

describe("buildTrainingDetailPresentation", () => {
  it("agrega la rutina activa y detecta ejercicios locales sin duplicarlos", () => {
    const model = buildTrainingDetailPresentation({
      activeTemplateId: template.id,
      activeTemplateMode: "detail",
      templateDraft: null,
      templates: [template, { ...template, id: "copy" }],
      exercisesRepo: [unrelatedCatalogExercise],
      exerciseImageBaseUrl: "https://example.test/ejercicios/",
      workoutHistory: [],
      muscleFilter: "all",
      statsPeriod: "3m",
      statsMetric: "volume",
      showAllHistory: false,
      selectedHistoryId: null,
    });

    expect(model.activeTemplate).toBe(template);
    expect(model.durationMinutes).toBe(45);
    expect(model.seriesTotal).toBe(1);
    expect(model.previewExercises[0]).toMatchObject({ exerciseName: "Press banca", muscle: "Pecho" });
    expect(model.localOnlyExercises).toEqual([{ name: "Press banca", muscle: "" }]);
    expect(model.selectedHistoryRecalculation).toEqual({ status: "unavailable" });
  });

  it("devuelve un modelo vacío cuando no hay una rutina seleccionada", () => {
    const model = buildTrainingDetailPresentation({
      activeTemplateId: null,
      activeTemplateMode: "detail",
      templateDraft: null,
      templates: [],
      exercisesRepo: [],
      exerciseImageBaseUrl: "https://example.test/ejercicios/",
      workoutHistory: [],
      muscleFilter: "all",
      statsPeriod: "all",
      statsMetric: "reps",
      showAllHistory: false,
      selectedHistoryId: null,
    });

    expect(model).toMatchObject({
      activeTemplate: null,
      previewExercises: [],
      historyEntries: [],
      chartBars: [],
    });
  });
});
