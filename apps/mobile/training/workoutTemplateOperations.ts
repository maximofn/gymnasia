import type { CatalogLink } from "../catalogs/types";
import {
  isCompoundSeriesType,
  type CreateId,
  type ExerciseSeries,
  type SeriesType,
  type SubSeries,
} from "./seriesContract";

export type TrainingCategory = "strength" | "hypertrophy" | "cardio" | "flexibility";

export type RoutineIconName =
  | "activity"
  | "heart"
  | "zap"
  | "target"
  | "wind"
  | "shield"
  | "compass"
  | "crosshair"
  | "award"
  | "star"
  | "sun"
  | "moon"
  | "sliders"
  | "trending-up";

export type WorkoutExercise = {
  id: string;
  name?: string;
  image_uri?: string | null;
  sets: number[];
  series?: ExerciseSeries[];
  muscle?: string;
  load_kg?: number | null;
  rest_seconds?: number | null;
  catalog_link?: CatalogLink;
};

export type WorkoutTemplate = {
  id: string;
  /** Versión del esquema de series sellada por la normalización. */
  series_schema_version?: number;
  name: string;
  category?: TrainingCategory;
  icon?: RoutineIconName;
  duration_minutes?: string;
  exercises: WorkoutExercise[];
};

type CloneIdentity = "preserve" | "regenerate";

type CloneOptions = {
  identity: CloneIdentity;
  createId?: CreateId;
  exerciseIds?: ReadonlyMap<string, string>;
};

function requiredCreateId(options: CloneOptions): CreateId {
  if (options.createId) return options.createId;
  throw new Error("La duplicación de una rutina necesita un generador de identificadores.");
}

function cloneCatalogLink(link: CatalogLink | undefined): CatalogLink | undefined {
  if (!link) return undefined;
  if (link.status === "unresolved") return { ...link };
  return { ...link, ref: { ...link.ref } };
}

function cloneSubSeries(subSeries: SubSeries, options: CloneOptions): SubSeries {
  const clone: SubSeries = {
    ...subSeries,
    id: options.identity === "regenerate"
      ? requiredCreateId(options)("sub")
      : subSeries.id,
  };
  if (subSeries.catalog_link) clone.catalog_link = cloneCatalogLink(subSeries.catalog_link);
  if (subSeries.exercise_id && options.exerciseIds?.has(subSeries.exercise_id)) {
    clone.exercise_id = options.exerciseIds.get(subSeries.exercise_id);
  }
  return clone;
}

function cloneExerciseSeries(
  series: ExerciseSeries,
  options: CloneOptions,
): ExerciseSeries {
  const clone: ExerciseSeries = {
    ...series,
    id: options.identity === "regenerate"
      ? requiredCreateId(options)("set")
      : series.id,
  };
  if (series.sub_series) {
    clone.sub_series = series.sub_series.map((subSeries) => cloneSubSeries(subSeries, options));
  }
  return clone;
}

function cloneWorkoutExercise(
  exercise: WorkoutExercise,
  options: CloneOptions,
  regeneratedId?: string,
): WorkoutExercise {
  const clone: WorkoutExercise = {
    ...exercise,
    id: options.identity === "regenerate"
      ? regeneratedId ?? requiredCreateId(options)("exercise")
      : exercise.id,
    sets: [...exercise.sets],
  };
  if (exercise.series) {
    clone.series = exercise.series.map((series) => cloneExerciseSeries(series, options));
  }
  if (exercise.catalog_link) clone.catalog_link = cloneCatalogLink(exercise.catalog_link);
  return clone;
}

/** Copia profunda para instantáneas y restauraciones, sin cambiar identidades. */
export function cloneWorkoutTemplateSnapshot(template: WorkoutTemplate): WorkoutTemplate {
  const options: CloneOptions = { identity: "preserve" };
  return {
    ...template,
    exercises: template.exercises.map((exercise) => cloneWorkoutExercise(exercise, options)),
  };
}

/** Duplica una rutina y reasigna también las referencias internas de superseries. */
export function duplicateWorkoutTemplate(
  template: WorkoutTemplate,
  createId: CreateId,
): WorkoutTemplate {
  const exerciseIds = new Map(
    template.exercises.map((exercise) => [exercise.id, createId("exercise")]),
  );
  const options: CloneOptions = { identity: "regenerate", createId, exerciseIds };
  return {
    ...template,
    id: createId("tpl"),
    exercises: template.exercises.map((exercise) =>
      cloneWorkoutExercise(exercise, options, exerciseIds.get(exercise.id)),
    ),
  };
}

/** Duplica un ejercicio dentro de la misma rutina y regenera sus series anidadas. */
export function duplicateWorkoutExercise(
  exercise: WorkoutExercise,
  createId: CreateId,
): WorkoutExercise {
  const exerciseId = createId("exercise");
  const options: CloneOptions = {
    identity: "regenerate",
    createId,
    exerciseIds: new Map([[exercise.id, exerciseId]]),
  };
  return cloneWorkoutExercise(exercise, options, exerciseId);
}

/** Duplica una serie y todas sus mini-series, incluidos los enlaces de catálogo. */
export function duplicateExerciseSeries(
  series: ExerciseSeries,
  createId: CreateId,
): ExerciseSeries {
  return cloneExerciseSeries(series, { identity: "regenerate", createId });
}

/** Crea la siguiente serie copiando por completo la configuración de la anterior. */
export function createSeriesAfter(
  previous: ExerciseSeries | undefined,
  createId: CreateId,
): ExerciseSeries {
  if (previous) return duplicateExerciseSeries(previous, createId);
  return {
    id: createId("set"),
    reps: "10",
    weight_kg: "",
    rest_seconds: "",
  };
}

/**
 * Cambia el tipo sin destruir mini-series ocultas. Si se entra por primera vez
 * en un tipo compuesto, crea una mini-serie a partir de los valores visibles.
 */
export function changeExerciseSeriesType(
  series: ExerciseSeries,
  newType: SeriesType,
  createId: CreateId,
): ExerciseSeries {
  const clone = cloneExerciseSeries(series, { identity: "preserve" });
  clone.type = newType;
  if (isCompoundSeriesType(newType) && (!clone.sub_series || clone.sub_series.length === 0)) {
    clone.sub_series = [{
      id: createId("sub"),
      reps: series.reps || "10",
      weight_kg: series.weight_kg || "",
      rest_seconds: newType === "dropset" ? "0" : series.rest_seconds || "",
    }];
  }
  return clone;
}

function signatureText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function catalogLinkSignature(link: CatalogLink | undefined): unknown {
  if (!link) return null;
  if (link.status === "unresolved") {
    return {
      schemaVersion: link.schemaVersion,
      status: link.status,
      reason: link.reason,
    };
  }
  return {
    schemaVersion: link.schemaVersion,
    status: link.status,
    ref: {
      schemaVersion: link.ref.schemaVersion,
      sourceId: link.ref.sourceId,
      itemId: link.ref.itemId,
    },
    linkedBy: link.linkedBy,
  };
}

type FunctionalTemplateProjection = {
  id: string;
  name: string;
  category: TrainingCategory | null;
  icon: RoutineIconName | null;
  duration_minutes: string;
  exercises: Array<{
    id: string;
    name: string;
    image_uri: string;
    muscle: string;
    catalog_link: unknown;
    series: Array<{
      id: string;
      type: SeriesType;
      reps: string;
      weight_kg: string;
      rest_seconds: string;
      tempo_contraction: string;
      tempo_pause: string;
      tempo_relaxation: string;
      sub_series: Array<{
        id: string;
        reps: string;
        weight_kg: string;
        rest_seconds: string;
        exercise_name: string;
        exercise_id: string;
        catalog_link: unknown;
      }>;
    }>;
  }>;
};

function functionalTemplateProjection(template: WorkoutTemplate): FunctionalTemplateProjection {
  return {
    id: template.id,
    name: signatureText(template.name),
    category: template.category ?? null,
    icon: template.icon ?? null,
    duration_minutes: signatureText(template.duration_minutes),
    exercises: template.exercises.map((exercise) => ({
      id: exercise.id,
      name: signatureText(exercise.name),
      image_uri: signatureText(exercise.image_uri ?? undefined),
      muscle: signatureText(exercise.muscle),
      catalog_link: catalogLinkSignature(exercise.catalog_link),
      series: (exercise.series ?? []).map((series) => ({
        id: series.id,
        type: series.type ?? "normal",
        reps: signatureText(series.reps),
        weight_kg: signatureText(series.weight_kg),
        rest_seconds: signatureText(series.rest_seconds),
        tempo_contraction: signatureText(series.tempo_contraction),
        tempo_pause: signatureText(series.tempo_pause),
        tempo_relaxation: signatureText(series.tempo_relaxation),
        sub_series: (series.sub_series ?? []).map((subSeries) => ({
          id: subSeries.id,
          reps: signatureText(subSeries.reps),
          weight_kg: signatureText(subSeries.weight_kg),
          rest_seconds: signatureText(subSeries.rest_seconds),
          exercise_name: signatureText(subSeries.exercise_name),
          exercise_id: signatureText(subSeries.exercise_id),
          catalog_link: catalogLinkSignature(subSeries.catalog_link),
        })),
      })),
    })),
  };
}

/**
 * Revisión estable de todo el contenido funcional de una rutina.
 *
 * Omite deliberadamente el sello técnico `series_schema_version` y los espejos
 * heredados `sets`, `load_kg` y `rest_seconds`: todos ellos se derivan de las
 * series y no deben provocar conflictos falsos.
 */
export function buildWorkoutTemplateRevision(template: WorkoutTemplate): string {
  return JSON.stringify(functionalTemplateProjection(template));
}

export type WorkoutTemplateDiffChange = {
  scope: "routine" | "exercise" | "series" | "sub_series";
  path: string;
  label: string;
};

export type WorkoutTemplateDiff = {
  hasChanges: boolean;
  changes: WorkoutTemplateDiffChange[];
  summaries: string[];
};

function pushChange(
  changes: WorkoutTemplateDiffChange[],
  scope: WorkoutTemplateDiffChange["scope"],
  path: string,
  label: string,
): void {
  changes.push({ scope, path, label });
}

/** Diferencias funcionales legibles para las pantallas de confirmación. */
export function diffWorkoutTemplates(
  base: WorkoutTemplate,
  candidate: WorkoutTemplate,
): WorkoutTemplateDiff {
  const before = functionalTemplateProjection(base);
  const after = functionalTemplateProjection(candidate);
  const changes: WorkoutTemplateDiffChange[] = [];

  const routineFields = ["name", "category", "icon", "duration_minutes"] as const;
  for (const field of routineFields) {
    if (before[field] !== after[field]) {
      const labels: Record<(typeof routineFields)[number], string> = {
        name: "Nombre de la rutina",
        category: "Categoría",
        icon: "Icono",
        duration_minutes: "Duración",
      };
      pushChange(changes, "routine", field, labels[field]);
    }
  }

  const beforeExercises = new Map(before.exercises.map((exercise) => [exercise.id, exercise]));
  if (before.exercises.map(({ id }) => id).join("\u0000") !== after.exercises.map(({ id }) => id).join("\u0000")) {
    pushChange(changes, "exercise", "exercises", "Ejercicios añadidos, eliminados o reordenados");
  }

  for (const exercise of after.exercises) {
    const previous = beforeExercises.get(exercise.id);
    if (!previous) continue;
    const exerciseLabel = exercise.name || previous.name || "Ejercicio";
    for (const field of ["name", "image_uri", "muscle", "catalog_link"] as const) {
      if (JSON.stringify(previous[field]) !== JSON.stringify(exercise[field])) {
        pushChange(changes, "exercise", `exercises.${exercise.id}.${field}`, `${exerciseLabel}: datos del ejercicio`);
        break;
      }
    }

    const previousSeries = new Map(previous.series.map((series) => [series.id, series]));
    if (previous.series.map(({ id }) => id).join("\u0000") !== exercise.series.map(({ id }) => id).join("\u0000")) {
      pushChange(changes, "series", `exercises.${exercise.id}.series`, `${exerciseLabel}: series añadidas, eliminadas o reordenadas`);
    }
    for (const series of exercise.series) {
      const oldSeries = previousSeries.get(series.id);
      if (!oldSeries) continue;
      const seriesIndex = exercise.series.findIndex((item) => item.id === series.id) + 1;
      const seriesLabel = `${exerciseLabel}: serie ${seriesIndex}`;
      for (const field of [
        "type", "reps", "weight_kg", "rest_seconds",
        "tempo_contraction", "tempo_pause", "tempo_relaxation",
      ] as const) {
        if (oldSeries[field] !== series[field]) {
          pushChange(changes, "series", `exercises.${exercise.id}.series.${series.id}.${field}`, seriesLabel);
          break;
        }
      }
      if (JSON.stringify(oldSeries.sub_series) !== JSON.stringify(series.sub_series)) {
        pushChange(changes, "sub_series", `exercises.${exercise.id}.series.${series.id}.sub_series`, `${seriesLabel}: mini-series`);
      }
    }
  }

  const summaries = [...new Set(changes.map((change) => change.label))];
  return { hasChanges: changes.length > 0, changes, summaries };
}

/** Huella estable del contenido funcional de las series, sin metadatos de rutina. */
export function buildTemplateSeriesSignature(template: WorkoutTemplate): string {
  return JSON.stringify(
    template.exercises.map((exercise) => ({
      id: exercise.id,
      series: (exercise.series ?? []).map((series) => ({
        id: series.id,
        type: series.type ?? "normal",
        reps: signatureText(series.reps),
        weight_kg: signatureText(series.weight_kg),
        rest_seconds: signatureText(series.rest_seconds),
        tempo_contraction: signatureText(series.tempo_contraction),
        tempo_pause: signatureText(series.tempo_pause),
        tempo_relaxation: signatureText(series.tempo_relaxation),
        sub_series: (series.sub_series ?? []).map((subSeries) => ({
          id: subSeries.id,
          reps: signatureText(subSeries.reps),
          weight_kg: signatureText(subSeries.weight_kg),
          rest_seconds: signatureText(subSeries.rest_seconds),
          exercise_name: signatureText(subSeries.exercise_name),
          exercise_id: signatureText(subSeries.exercise_id),
          catalog_link: catalogLinkSignature(subSeries.catalog_link),
        })),
      })),
    })),
  );
}
