import {
  catalogRef,
  linkedCatalog,
  unresolvedCatalog,
  type ExerciseCatalogEntry,
} from "../catalogs/types";
import {
  isCompoundSeriesType,
  isSeriesType,
  type ExerciseSeries,
  type SeriesType,
  type SubSeries,
} from "../training/seriesContract";
import {
  ROUTINE_ICON_NAMES,
  TRAINING_CATEGORIES,
  type RoutineIconName,
  type TrainingCategory,
  type WorkoutExercise,
  type WorkoutTemplate,
} from "../training/workoutTemplateOperations";
import {
  validateWorkoutTemplateForWrite,
  type WorkoutTemplateIssueCode,
} from "../training/workoutTemplateContract";

export type RoutineCreationIssueCode = WorkoutTemplateIssueCode
  | "invalid_type"
  | "unexpected_field"
  | "catalog_not_found"
  | "catalog_ambiguous";

export type RoutineCreationIssue = {
  field: string;
  code: RoutineCreationIssueCode;
  message: string;
  candidates?: Array<{ source_id: string; item_id: string; name: string }>;
};

export type RoutineCreationPreparation =
  | { ok: true; value: WorkoutTemplate; issues: [] }
  | { ok: false; value: null; issues: RoutineCreationIssue[] };

export type RoutineCreationDependencies = {
  createId(prefix: string): string;
  getExerciseImageUrl(exercise: ExerciseCatalogEntry, sex: "male" | "female"): string;
};

type ResolvedTarget =
  | { kind: "catalog"; candidate: ExerciseCatalogEntry }
  | { kind: "custom"; name: string };

type ValidatedSubSeries = {
  reps: number;
  weightKg?: number;
  restSeconds?: number;
  target?: ResolvedTarget;
};

type ValidatedSeries = {
  type: SeriesType;
  reps: number;
  weightKg?: number;
  restSeconds?: number;
  tempoContraction?: number;
  tempoPause?: number;
  tempoRelaxation?: number;
  subSeries: ValidatedSubSeries[];
};

type ValidatedExercise = {
  kind: "catalog" | "custom";
  candidate?: ExerciseCatalogEntry;
  name: string;
  muscle: string;
  series: ValidatedSeries[];
};

type ValidatedRoutine = {
  name: string;
  category: TrainingCategory;
  icon: RoutineIconName;
  durationMinutes?: number;
  exercises: ValidatedExercise[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushIssue(
  issues: RoutineCreationIssue[],
  field: string,
  code: RoutineCreationIssueCode,
  message: string,
  candidates?: RoutineCreationIssue["candidates"],
): void {
  issues.push({ field, code, message, ...(candidates ? { candidates } : {}) });
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  issues: RoutineCreationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      pushIssue(
        issues,
        `${field}.${key}`,
        "unexpected_field",
        `El campo "${field}.${key}" no está permitido.`,
      );
    }
  }
}

function requiredText(
  value: unknown,
  field: string,
  label: string,
  issues: RoutineCreationIssue[],
): string | undefined {
  if (value === undefined || value === null) {
    pushIssue(issues, field, "required", `${label} es obligatorio.`);
    return undefined;
  }
  if (typeof value !== "string") {
    pushIssue(issues, field, "invalid_type", `${label} debe ser texto.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    pushIssue(issues, field, "required", `${label} es obligatorio.`);
    return undefined;
  }
  return trimmed;
}

function optionalText(
  value: unknown,
  field: string,
  label: string,
  issues: RoutineCreationIssue[],
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    pushIssue(issues, field, "invalid_type", `${label} debe ser texto.`);
    return undefined;
  }
  return value.trim();
}

function numericValue(
  value: unknown,
  field: string,
  label: string,
  issues: RoutineCreationIssue[],
  options: { required: boolean; integer: boolean; positive: boolean; maximum?: number },
): number | undefined {
  if (value === undefined) {
    if (options.required) pushIssue(issues, field, "required", `${label} es obligatorio.`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    pushIssue(issues, field, "invalid_number", `${label} debe ser un número finito.`);
    return undefined;
  }
  if (options.integer && !Number.isSafeInteger(value)) {
    pushIssue(issues, field, "not_integer", `${label} debe ser un número entero.`);
  }
  if (options.positive && value <= 0) {
    pushIssue(issues, field, "not_positive", `${label} debe ser mayor que cero.`);
  } else if (!options.positive && value < 0) {
    pushIssue(issues, field, "negative", `${label} no puede ser negativo.`);
  }
  if (options.maximum !== undefined && value > options.maximum) {
    pushIssue(issues, field, "out_of_range", `${label} no puede superar ${options.maximum}.`);
  }
  return value;
}

function resolveCatalogExercise(
  sourceId: string | undefined,
  itemId: string | undefined,
  field: string,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ExerciseCatalogEntry | undefined {
  if (!sourceId || !itemId) return undefined;
  const matches = repository.filter((candidate) => (
    candidate.sourceId === sourceId && candidate.id === itemId
  ));
  if (matches.length === 0) {
    pushIssue(
      issues,
      field,
      "catalog_not_found",
      `No existe el ejercicio ${sourceId}/${itemId} en el catálogo.`,
    );
    return undefined;
  }
  if (matches.length > 1) {
    pushIssue(
      issues,
      field,
      "catalog_ambiguous",
      `La referencia ${sourceId}/${itemId} identifica más de un ejercicio.`,
      matches.map((candidate) => ({
        source_id: candidate.sourceId,
        item_id: candidate.id,
        name: candidate.name,
      })),
    );
    return undefined;
  }
  return matches[0];
}

function parseTarget(
  raw: unknown,
  field: string,
  required: boolean,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ResolvedTarget | undefined {
  if (raw === undefined) {
    if (required) {
      pushIssue(
        issues,
        field,
        "superset_target_required",
        "Cada subserie de una superserie necesita un ejercicio de catálogo o personalizado.",
      );
    }
    return undefined;
  }
  if (!isRecord(raw)) {
    pushIssue(issues, field, "invalid_type", "El objetivo de la subserie debe ser un objeto.");
    return undefined;
  }
  rejectUnknownFields(raw, ["kind", "source_id", "item_id", "name"], field, issues);
  const kind = requiredText(raw.kind, `${field}.kind`, "El tipo de objetivo", issues);
  if (kind === "catalog") {
    const sourceId = requiredText(raw.source_id, `${field}.source_id`, "source_id", issues);
    const itemId = requiredText(raw.item_id, `${field}.item_id`, "item_id", issues);
    const candidate = resolveCatalogExercise(sourceId, itemId, field, repository, issues);
    return candidate ? { kind: "catalog", candidate } : undefined;
  }
  if (kind === "custom") {
    const name = requiredText(raw.name, `${field}.name`, "El nombre del ejercicio", issues);
    return name ? { kind: "custom", name } : undefined;
  }
  if (kind !== undefined) {
    pushIssue(issues, `${field}.kind`, "unknown_value", `El tipo de objetivo "${kind}" no existe.`);
  }
  return undefined;
}

function parseSubSeries(
  raw: unknown,
  field: string,
  parentType: SeriesType,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ValidatedSubSeries | undefined {
  if (!isRecord(raw)) {
    pushIssue(issues, field, "invalid_type", "La subserie debe ser un objeto.");
    return undefined;
  }
  rejectUnknownFields(raw, ["reps", "weight_kg", "rest_seconds", "target"], field, issues);
  const reps = numericValue(raw.reps, `${field}.reps`, "Las repeticiones", issues, {
    required: true,
    integer: true,
    positive: true,
  });
  const weightKg = numericValue(raw.weight_kg, `${field}.weight_kg`, "El peso", issues, {
    required: false,
    integer: false,
    positive: false,
  });
  const restSeconds = numericValue(raw.rest_seconds, `${field}.rest_seconds`, "El descanso", issues, {
    required: false,
    integer: true,
    positive: false,
  });
  const target = parseTarget(
    raw.target,
    `${field}.target`,
    parentType === "superset",
    repository,
    issues,
  );
  if (reps === undefined) return undefined;
  return { reps, weightKg, restSeconds, target };
}

function parseSeries(
  raw: unknown,
  field: string,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ValidatedSeries | undefined {
  if (!isRecord(raw)) {
    pushIssue(issues, field, "invalid_type", "La serie debe ser un objeto.");
    return undefined;
  }
  rejectUnknownFields(raw, [
    "type",
    "reps",
    "weight_kg",
    "rest_seconds",
    "tempo_contraction",
    "tempo_pause",
    "tempo_relaxation",
    "sub_series",
  ], field, issues);
  const rawType = requiredText(raw.type, `${field}.type`, "El tipo de serie", issues);
  let type: SeriesType | undefined;
  if (rawType && isSeriesType(rawType)) type = rawType;
  else if (rawType) {
    pushIssue(issues, `${field}.type`, "unknown_value", `El tipo de serie "${rawType}" no existe.`);
  }
  const reps = numericValue(raw.reps, `${field}.reps`, "Las repeticiones", issues, {
    required: true,
    integer: true,
    positive: true,
  });
  const weightKg = numericValue(raw.weight_kg, `${field}.weight_kg`, "El peso", issues, {
    required: false,
    integer: false,
    positive: false,
  });
  const restSeconds = numericValue(raw.rest_seconds, `${field}.rest_seconds`, "El descanso", issues, {
    required: false,
    integer: true,
    positive: false,
  });
  const tempoRequired = type === "tempo";
  const tempoContraction = numericValue(
    raw.tempo_contraction,
    `${field}.tempo_contraction`,
    "La contracción del tempo",
    issues,
    { required: tempoRequired, integer: false, positive: false },
  );
  const tempoPause = numericValue(
    raw.tempo_pause,
    `${field}.tempo_pause`,
    "La pausa del tempo",
    issues,
    { required: tempoRequired, integer: false, positive: false },
  );
  const tempoRelaxation = numericValue(
    raw.tempo_relaxation,
    `${field}.tempo_relaxation`,
    "La relajación del tempo",
    issues,
    { required: tempoRequired, integer: false, positive: false },
  );

  let subSeries: ValidatedSubSeries[] = [];
  if (raw.sub_series !== undefined && !Array.isArray(raw.sub_series)) {
    pushIssue(issues, `${field}.sub_series`, "invalid_type", "Las subseries deben ser un array.");
  } else if (Array.isArray(raw.sub_series)) {
    const subSeriesParentType = type ?? "normal";
    subSeries = raw.sub_series.flatMap((item, index) => {
      const parsed = parseSubSeries(
        item,
        `${field}.sub_series[${index}]`,
        subSeriesParentType,
        repository,
        issues,
      );
      return parsed ? [parsed] : [];
    });
  }
  if (type && isCompoundSeriesType(type) && (!Array.isArray(raw.sub_series) || raw.sub_series.length === 0)) {
    pushIssue(
      issues,
      `${field}.sub_series`,
      "compound_requires_sub_series",
      `La serie ${type} necesita al menos una subserie.`,
    );
  }
  if (!type || reps === undefined) return undefined;
  return {
    type,
    reps,
    weightKg,
    restSeconds,
    tempoContraction,
    tempoPause,
    tempoRelaxation,
    subSeries,
  };
}

function parseExercise(
  raw: unknown,
  field: string,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ValidatedExercise | undefined {
  if (!isRecord(raw)) {
    pushIssue(issues, field, "invalid_type", "El ejercicio debe ser un objeto.");
    return undefined;
  }
  rejectUnknownFields(raw, ["kind", "source_id", "item_id", "name", "muscle", "series"], field, issues);
  const kind = requiredText(raw.kind, `${field}.kind`, "El tipo de ejercicio", issues);
  let candidate: ExerciseCatalogEntry | undefined;
  let name: string | undefined;
  let muscle = "";
  if (kind === "catalog") {
    const sourceId = requiredText(raw.source_id, `${field}.source_id`, "source_id", issues);
    const itemId = requiredText(raw.item_id, `${field}.item_id`, "item_id", issues);
    candidate = resolveCatalogExercise(sourceId, itemId, field, repository, issues);
    name = candidate?.name;
    muscle = candidate?.muscle_group ?? "";
  } else if (kind === "custom") {
    name = requiredText(raw.name, `${field}.name`, "El nombre del ejercicio", issues);
    muscle = optionalText(raw.muscle, `${field}.muscle`, "El músculo", issues) ?? "";
  } else if (kind !== undefined) {
    pushIssue(issues, `${field}.kind`, "unknown_value", `El tipo de ejercicio "${kind}" no existe.`);
  }

  let series: ValidatedSeries[] = [];
  if (!Array.isArray(raw.series)) {
    pushIssue(issues, `${field}.series`, "invalid_type", "Las series deben ser un array.");
  } else {
    if (raw.series.length === 0) {
      pushIssue(
        issues,
        `${field}.series`,
        "empty_collection",
        "Cada ejercicio debe tener al menos una serie ejecutable.",
      );
    }
    series = raw.series.flatMap((item, index) => {
      const parsed = parseSeries(item, `${field}.series[${index}]`, repository, issues);
      return parsed ? [parsed] : [];
    });
  }
  if ((kind !== "catalog" && kind !== "custom") || !name) return undefined;
  return { kind, candidate, name, muscle, series };
}

function parseRoutine(
  raw: unknown,
  repository: readonly ExerciseCatalogEntry[],
  issues: RoutineCreationIssue[],
): ValidatedRoutine | undefined {
  if (!isRecord(raw)) {
    pushIssue(issues, "data", "invalid_type", "data debe ser un objeto.");
    return undefined;
  }
  rejectUnknownFields(raw, ["name", "category", "icon", "duration_minutes", "exercises"], "data", issues);
  const name = requiredText(raw.name, "data.name", "El nombre de la rutina", issues);
  const rawCategory = requiredText(raw.category, "data.category", "La categoría", issues);
  const category = rawCategory && TRAINING_CATEGORIES.includes(rawCategory as TrainingCategory)
    ? rawCategory as TrainingCategory
    : undefined;
  if (rawCategory && !category) {
    pushIssue(issues, "data.category", "unknown_value", `La categoría "${rawCategory}" no existe.`);
  }
  const rawIcon = requiredText(raw.icon, "data.icon", "El icono", issues);
  const icon = rawIcon && ROUTINE_ICON_NAMES.includes(rawIcon as RoutineIconName)
    ? rawIcon as RoutineIconName
    : undefined;
  if (rawIcon && !icon) {
    pushIssue(issues, "data.icon", "unknown_value", `El icono "${rawIcon}" no existe.`);
  }
  const durationMinutes = numericValue(
    raw.duration_minutes,
    "data.duration_minutes",
    "La duración",
    issues,
    { required: false, integer: true, positive: true, maximum: 999 },
  );
  let exercises: ValidatedExercise[] = [];
  if (!Array.isArray(raw.exercises)) {
    pushIssue(issues, "data.exercises", "invalid_type", "Los ejercicios deben ser un array.");
  } else {
    if (raw.exercises.length === 0) {
      pushIssue(
        issues,
        "data.exercises",
        "empty_collection",
        "La rutina debe tener al menos un ejercicio.",
      );
    }
    exercises = raw.exercises.flatMap((item, index) => {
      const parsed = parseExercise(item, `data.exercises[${index}]`, repository, issues);
      return parsed ? [parsed] : [];
    });
  }
  if (!name || !category || !icon) return undefined;
  return { name, category, icon, durationMinutes, exercises };
}

function numericText(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function createSubSeries(
  input: ValidatedSubSeries,
  id: string,
  targetExerciseId?: string,
): SubSeries {
  const target = input.target;
  return {
    id,
    reps: numericText(input.reps),
    weight_kg: numericText(input.weightKg),
    rest_seconds: numericText(input.restSeconds),
    ...(target?.kind === "catalog" ? {
      exercise_name: target.candidate.name,
      ...(targetExerciseId ? { exercise_id: targetExerciseId } : {}),
      catalog_link: linkedCatalog(catalogRef(target.candidate.sourceId, target.candidate.id), "tool"),
    } : target?.kind === "custom" ? {
      exercise_name: target.name,
      catalog_link: unresolvedCatalog("manual"),
    } : {}),
  };
}

export function prepareRoutineCreation(
  raw: unknown,
  repository: readonly ExerciseCatalogEntry[],
  dependencies: RoutineCreationDependencies,
  operationId?: string,
): RoutineCreationPreparation {
  const issues: RoutineCreationIssue[] = [];
  const parsed = parseRoutine(raw, repository, issues);
  if (!parsed || issues.length > 0) return { ok: false, value: null, issues };

  const operationSuffix = operationId?.slice(0, 24);
  const createStableId = (prefix: string, suffix: string): string => (
    operationSuffix ? `${prefix}_op_${operationSuffix}_${suffix}` : dependencies.createId(prefix)
  );
  const exerciseIds = parsed.exercises.map((_exercise, exerciseIndex) => (
    createStableId("exercise", `${exerciseIndex}`)
  ));
  const internalExerciseIdForTarget = (target: ResolvedTarget | undefined): string | undefined => {
    if (target?.kind !== "catalog") return undefined;
    const exerciseIndex = parsed.exercises.findIndex((exercise) => (
      exercise.candidate?.sourceId === target.candidate.sourceId
      && exercise.candidate.id === target.candidate.id
    ));
    return exerciseIndex >= 0 ? exerciseIds[exerciseIndex] : undefined;
  };
  const exercises: WorkoutExercise[] = parsed.exercises.map((exercise, exerciseIndex) => {
    const series: ExerciseSeries[] = exercise.series.map((seriesItem, seriesIndex) => ({
      id: createStableId("series", `${exerciseIndex}_${seriesIndex}`),
      type: seriesItem.type,
      reps: numericText(seriesItem.reps),
      weight_kg: numericText(seriesItem.weightKg),
      rest_seconds: numericText(seriesItem.restSeconds),
      ...(seriesItem.tempoContraction !== undefined
        ? { tempo_contraction: numericText(seriesItem.tempoContraction) }
        : {}),
      ...(seriesItem.tempoPause !== undefined
        ? { tempo_pause: numericText(seriesItem.tempoPause) }
        : {}),
      ...(seriesItem.tempoRelaxation !== undefined
        ? { tempo_relaxation: numericText(seriesItem.tempoRelaxation) }
        : {}),
      ...(seriesItem.subSeries.length > 0 ? {
        sub_series: seriesItem.subSeries.map((subSeries, subSeriesIndex) => createSubSeries(
          subSeries,
          createStableId("subseries", `${exerciseIndex}_${seriesIndex}_${subSeriesIndex}`),
          internalExerciseIdForTarget(subSeries.target),
        )),
      } : {}),
    }));
    return {
      id: exerciseIds[exerciseIndex],
      name: exercise.name,
      muscle: exercise.muscle,
      image_uri: exercise.candidate
        ? dependencies.getExerciseImageUrl(exercise.candidate, "male")
        : null,
      sets: [],
      series,
      catalog_link: exercise.candidate
        ? linkedCatalog(catalogRef(exercise.candidate.sourceId, exercise.candidate.id), "tool")
        : unresolvedCatalog("manual"),
    };
  });
  const candidate: WorkoutTemplate = {
    id: operationSuffix ? `template_op_${operationSuffix}` : dependencies.createId("template"),
    name: parsed.name,
    category: parsed.category,
    icon: parsed.icon,
    ...(parsed.durationMinutes !== undefined
      ? { duration_minutes: numericText(parsed.durationMinutes) }
      : {}),
    exercises,
  };
  const validation = validateWorkoutTemplateForWrite(candidate);
  if (!validation.ok) {
    return {
      ok: false,
      value: null,
      issues: validation.issues.map((issue) => ({ ...issue, field: `data.${issue.field}` })),
    };
  }
  return { ok: true, value: validation.value, issues: [] };
}
