import {
  countDiscardedPersonalDataFields,
  sanitizePersonalDataFields,
  type PersonalDataField,
} from "./personalData";
import {
  DIET_MEAL_CATEGORIES,
  formatNutritionValidationIssues,
  resolveDietMealCategory,
  validateNutritionItem,
  type DietMealCategory,
} from "../diet/nutritionContract";
import {
  clearDietMeal,
  copyDietMeal,
  locateDietItem,
  moveDietItem,
  moveDietMeal,
  placeItemsInMeal,
  removeDietItem,
  rescaleDietItem,
  type DietMealPlacement,
  type MealOperationError,
} from "../diet/mealItemOperations";
import {
  ToolOperationIndeterminateError,
  type ToolOperationExecutionOutcome,
} from "./toolOperationLedger";
import { appendToolOperationReceipt, hasToolOperationReceipt, type ToolOperationReceipt } from "./toolOperationReceipts";
import { findByCatalogRef, matchFoodCatalog } from "../catalogs/matching";
import { hasCompleteFoodNutrition } from "../catalogs/foodNutrition";
import {
  catalogRef,
  linkedCatalog,
  unresolvedCatalog,
  type CatalogLink,
  type CatalogSearchAvailability,
  type ExerciseCatalogEntry,
  type FoodCatalogEntry,
} from "../catalogs/types";
import {
  deleteMeasurementById,
  formatMeasurementIssues,
  measurementDuplicateDates,
  parseMeasurementToolPatch,
  upsertMeasurementByDate,
  validateMeasurementDate,
  type Measurement,
} from "../measurements/measurementContract";
import { isSeriesType, type ExerciseSeries, type SeriesType } from "../training/seriesContract";
import type { WorkoutSessionSummary } from "../training/workoutHistory";
import {
  buildDietPeriod,
  buildMeasurementPeriod,
  buildWorkoutPeriod,
  isCalendarDateKey,
  PERIOD_READ_MAX_DAYS,
  serializePeriodResult,
  validatePeriod,
  type PeriodReadError,
} from "./periodReads";
import { listWorkoutExecutionUnits } from "../training/workoutExecution";
import {
  buildWorkoutTemplateRevision,
  changeExerciseSeriesType,
  findSupersetReferences,
  insertWorkoutExercise,
  moveWorkoutExercise,
  removeWorkoutExercise,
  type WorkoutExercise,
  type WorkoutTemplate,
} from "../training/workoutTemplateOperations";
import {
  prepareRoutineCreation,
  prepareRoutineExerciseAddition,
  prepareRoutineSeriesAddition,
} from "./routineCreationContract";
import { validateWorkoutTemplateForWrite } from "../training/workoutTemplateContract";
import { AGENT_TOOL_DEFINITIONS, MEAL_FOODS_BATCH_MAX, agentToolEffect, formatToolInputError, validateToolInput } from "./toolDefinitions";
import { toolFailure, type ToolResult } from "./toolErrors";

export type { PersonalDataField };

export type ToolMeasurement = Measurement;

export type ToolDietItem = {
  id: string;
  title: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_uri?: string | null;
  catalog_link?: CatalogLink;
};

export type ToolDietDay = {
  day_date: string;
  meals: Array<{
    id: string;
    title: string;
    items: ToolDietItem[];
  }>;
};

export type ToolExerciseSeries = ExerciseSeries;

export type ToolWorkoutTemplate = WorkoutTemplate;

export type ToolStore = {
  templates: ToolWorkoutTemplate[];
  dietByDate: Record<string, ToolDietDay>;
  measurements: ToolMeasurement[];
  /** Historial de sesiones terminadas; opcional para almacenes antiguos y tests. */
  workoutHistory?: WorkoutSessionSummary[];
  toolOperationReceipts?: ToolOperationReceipt[];
};

export type ToolFoodRepoEntry = FoodCatalogEntry;

export type ToolExerciseRepoEntry = ExerciseCatalogEntry;

export type ToolExecutionContext = {
  setStore?: (updater: (previous: ToolStore) => ToolStore) => void;
  commitStore?: (updater: (previous: ToolStore) => ToolStore) => Promise<void>;
  store?: ToolStore;
  foodsRepo?: ToolFoodRepoEntry[];
  exercisesRepo?: ToolExerciseRepoEntry[];
  searchExerciseCatalog?: (criteria: {
    query: string;
    muscleGroup: string;
    secondaryMuscle: string;
    equipment: string;
    difficulty: string;
  }) => Promise<ToolExerciseRepoEntry[]>;
  resolveExerciseCatalogIds?: (ids: string[]) => Promise<ToolExerciseRepoEntry[]>;
  foodCatalogAvailability?: CatalogSearchAvailability;
  exerciseCatalogAvailability?: CatalogSearchAvailability;
  getExerciseCatalogAvailability?: () => CatalogSearchAvailability;
  /**
   * Rutina del entrenamiento en curso, o null si no hay ninguno. Se consulta
   * en el momento de guardar, no antes, para que un entrenamiento que empiece
   * entre medias no se cuele. Opcional porque los tests no tienen sesiones.
   */
  getActiveWorkoutTemplateId?: () => string | null;
  operationId?: string;
  markEffectCommitted?: () => void;
  markEffectIndeterminate?: () => void;
};

import {
  describeOutcomeForModel,
  sanitizeFeedbackDraft,
  type FeedbackIssueDraft,
  type FeedbackIssueOutcome,
} from "./feedbackIssues";

export type ToolExecutorDependencies = {
  loadPersonalData: () => Promise<PersonalDataField[]>;
  savePersonalData: (fields: PersonalDataField[], operationId?: string) => Promise<void>;
  loadMeasurements: () => Promise<ToolMeasurement[]>;
  createId: (prefix: string) => string;
  getExerciseImageUrl: (exercise: ToolExerciseRepoEntry, sex: "male" | "female") => string;
  /**
   * Envía la incidencia y devuelve el resultado REAL. A diferencia de la
   * dependencia que sustituye, no puede devolver `void`: si no hay número de
   * issue, no hay éxito que comunicar.
   */
  submitFeedbackIssue: (
    draft: FeedbackIssueDraft,
    operationId?: string,
  ) => Promise<FeedbackIssueOutcome>;
  /**
   * Retira la foto de una medición borrada con la misma política que el
   * historial: solo si es de la app y ninguna medición restante la usa.
   * Opcional porque los tests no tienen sistema de ficheros; si falta, la
   * limpieza de huérfanos del siguiente arranque la recoge.
   */
  releaseMeasurementPhoto?: (
    photoUri: string | null,
    remainingPhotoUris: ReadonlyArray<string | null>,
  ) => void;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  dependencies: ToolExecutorDependencies,
) => Promise<string | ToolResult>;

async function commitToolStore(
  context: ToolExecutionContext,
  updater: (previous: ToolStore) => ToolStore,
): Promise<void> {
  if (!context.commitStore) return;
  try {
    await context.commitStore(updater);
  } catch {
    throw new ToolOperationIndeterminateError();
  }
}

/** Invalid JSON is not an empty memory replacement. */
function parsePersonalDataInput(input: unknown): unknown {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unavailableCatalogMetadata(): CatalogSearchAvailability {
  return { availability: "unavailable", fetchedAt: null, sources: [], warnings: ["Catálogo no disponible."] };
}

function serializeCatalogSearch<T>(
  metadata: CatalogSearchAvailability | undefined,
  results: T[],
): string {
  const availability = metadata ?? unavailableCatalogMetadata();
  return JSON.stringify({
    availability: availability.availability,
    fetched_at: availability.fetchedAt,
    sources: availability.sources.map((source) => ({
      source_id: source.sourceId,
      label: source.label,
      availability: source.availability,
      fetched_at: source.fetchedAt,
      warning: source.warning,
    })),
    warnings: availability.warnings,
    results,
  });
}

function parseObjectArgument(
  rawValue: unknown,
  invalidMessage: string,
  missingMessage: string,
): { value: Record<string, unknown> | null; error: string | null } {
  if (typeof rawValue === "string") {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { value: parsed as Record<string, unknown>, error: null };
      }
      return { value: {}, error: null };
    } catch {
      return { value: null, error: invalidMessage };
    }
  }
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return { value: rawValue as Record<string, unknown>, error: null };
  }
  return { value: null, error: missingMessage };
}

const savePersonalData: ToolHandler = async (args, _context, dependencies) => {
  const parsed = parsePersonalDataInput(args.personal_data);
  if (!Array.isArray(parsed)) {
    return toolFailure("invalid_personal_data", "No se guardaron los datos personales. Envía un array JSON válido; la memoria existente no se ha modificado.", "correct_arguments");
  }
  const fields = sanitizePersonalDataFields(parsed);
  const discarded = countDiscardedPersonalDataFields(parsed);
  try {
    if (_context.operationId) {
      await dependencies.savePersonalData(fields, _context.operationId);
    } else {
      await dependencies.savePersonalData(fields);
    }
  } catch {
    throw new ToolOperationIndeterminateError();
  }
  _context.markEffectCommitted?.();
  // La tool reescribe el array entero: un descarte silencioso le haría creer al
  // modelo que guardó un campo que luego list_personal_data_keys no devuelve.
  if (discarded > 0) {
    return `Datos personales guardados correctamente. Se descartaron ${discarded} campo(s) mal formado(s) o sin nombre.`;
  }
  return "Datos personales guardados correctamente.";
};

const listPersonalDataKeys: ToolHandler = async (_args, _context, dependencies) => {
  const fields = await dependencies.loadPersonalData();
  if (fields.length === 0) return "No hay campos guardados.";
  return JSON.stringify(fields.map((field) => field.key));
};

const readFieldDescription: ToolHandler = async (args, _context, dependencies) => {
  const key = args.key as string;
  const fields = await dependencies.loadPersonalData();
  const field = fields.find((item) => item.key === key);
  if (!field) return toolFailure("not_found", `Campo "${key}" no encontrado. Consulta las claves disponibles antes de elegir otro campo.`, "choose_alternative");
  return field.description || "(sin descripcion)";
};

const readFieldValue: ToolHandler = async (args, _context, dependencies) => {
  const key = args.key as string;
  const fields = await dependencies.loadPersonalData();
  const field = fields.find((item) => item.key === key);
  if (!field) return toolFailure("not_found", `Campo "${key}" no encontrado. Consulta las claves disponibles antes de elegir otro campo.`, "choose_alternative");
  return field.value || "(sin valor)";
};

const readMeasurement: ToolHandler = async (args, _context, dependencies) => {
  const dateResult = validateMeasurementDate(args.date);
  if (!dateResult.ok) return toolFailure("invalid_measurement", formatMeasurementIssues(dateResult.issues), "correct_arguments");
  const measurements = await dependencies.loadMeasurements();
  if (measurementDuplicateDates(measurements).includes(dateResult.value)) {
    return toolFailure("ambiguous_measurement", `Hay varias mediciones para ${dateResult.value}. Revísalas desde el historial para decidir cuál conservar.`, "stop_turn");
  }
  const match = measurements.find((measurement) => measurement.measured_on === dateResult.value);
  if (!match) return toolFailure("not_found", `No hay registro de medidas para la fecha "${dateResult.value}". No implica que no haya registros en otras fechas. Consulta otra fecha solo si tienes información para elegirla.`, "choose_alternative");
  const { id: _id, photo_uri: _photoUri, measured_at: _measuredAt, ...data } = match;
  return JSON.stringify(data);
};

const writeMeasurement: ToolHandler = async (args, context, dependencies) => {
  const dateResult = validateMeasurementDate(args.date);
  if (!dateResult.ok) return toolFailure("invalid_measurement", formatMeasurementIssues(dateResult.issues), "correct_arguments");
  const patchResult = parseMeasurementToolPatch(args.data, args.clear_fields);
  if (!patchResult.ok) return toolFailure("invalid_measurement", formatMeasurementIssues(patchResult.issues), "correct_arguments");
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se guardó la medición.", "stop_turn");

  const measurementId = context.operationId
    ? `measurement_op_${context.operationId.slice(0, 24)}`
    : dependencies.createId("measurement");
  let mutationError: string | null = null;
  let successMessage = `Medidas guardadas correctamente para ${dateResult.value}.`;
  await commitToolStore(context, (previous) => {
    const result = upsertMeasurementByDate(previous.measurements, {
      date: dateResult.value,
      patch: patchResult.value,
      createId: () => measurementId,
    });
    if (!result.ok) {
      mutationError = formatMeasurementIssues(result.issues);
      return previous;
    }
    if (result.action === "updated") {
      successMessage = `Medidas actualizadas correctamente para ${dateResult.value}.`;
    }
    return {
      ...previous,
      measurements: result.measurements,
      toolOperationReceipts: appendToolOperationReceipt(
        previous.toolOperationReceipts,
        context.operationId,
        "write_measurement",
      ),
    };
  });
  if (mutationError) {
    return toolFailure("measurement_conflict", `No se guardaron las medidas. ${mutationError}`, "stop_turn");
  }
  context.markEffectCommitted?.();
  return successMessage;
};

const deleteMeasurement: ToolHandler = async (args, context, dependencies) => {
  const dateResult = validateMeasurementDate(args.date);
  if (!dateResult.ok) return toolFailure("invalid_measurement", formatMeasurementIssues(dateResult.issues), "correct_arguments");
  const date = dateResult.value;
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se borró la medición.", "stop_turn");

  type DeleteOutcome =
    | { kind: "replayed" }
    | { kind: "missing" }
    | { kind: "ambiguous" }
    | { kind: "failed"; message: string }
    | { kind: "deleted"; removed: ToolMeasurement; remaining: ToolMeasurement[] };
  let outcome: DeleteOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "delete_measurement")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const matches = previous.measurements.filter((measurement) => measurement.measured_on === date);
    if (matches.length === 0) {
      outcome = { kind: "missing" };
      return previous;
    }
    if (matches.length > 1) {
      outcome = { kind: "ambiguous" };
      return previous;
    }
    const result = deleteMeasurementById(previous.measurements, matches[0].id);
    if (!result.ok) {
      outcome = { kind: "failed", message: formatMeasurementIssues(result.issues) };
      return previous;
    }
    outcome = { kind: "deleted", removed: matches[0], remaining: result.measurements };
    return {
      ...previous,
      measurements: result.measurements,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "delete_measurement"),
    };
  });
  const final = outcome as DeleteOutcome;
  if (final.kind === "missing") {
    return toolFailure(
      "not_found",
      `No se ha borrado nada: no hay ninguna medición el ${date}. No borres otra fecha por tu cuenta; si dudas del día, pregunta al usuario.`,
      "choose_alternative",
      { status: "not_found", written: false },
    );
  }
  if (final.kind === "ambiguous") {
    return toolFailure(
      "ambiguous_measurement",
      `No se ha borrado nada: hay varias mediciones para ${date}. Revísalas desde el historial para decidir cuál conservar.`,
      "stop_turn",
      { status: "ambiguous", written: false },
    );
  }
  if (final.kind === "failed") {
    return toolFailure("measurement_conflict", `No se borró la medición. ${final.message}`, "stop_turn", { written: false });
  }
  context.markEffectCommitted?.();
  if (final.kind === "replayed") return ALREADY_APPLIED_OUTPUT;
  try {
    dependencies.releaseMeasurementPhoto?.(
      final.removed.photo_uri,
      final.remaining.map((measurement) => measurement.photo_uri),
    );
  } catch {
    // El borrado ya es durable; la limpieza de huérfanos del arranque recoge la foto.
  }
  const { id: _id, photo_uri: photoUri, measured_at: _measuredAt, measured_on: _measuredOn, ...values } = final.removed;
  return JSON.stringify({
    status: "deleted",
    written: true,
    fecha: date,
    medidas_borradas: values,
    tenia_foto: Boolean(photoUri),
  });
};

const readMealFoods: ToolHandler = async (args, context) => {
  const date = (args.date as string) ?? "";
  if (!date) return toolFailure("invalid_date", "No se proporcionó una fecha.", "correct_arguments");
  const mealResult = resolveDietMealCategory(args.meal);
  if (!mealResult.ok) return toolFailure("invalid_meal", formatNutritionValidationIssues(mealResult.issues), "correct_arguments");
  const meal = mealResult.value;
  if (!context.store) return toolFailure("storage_unavailable", "No se pudo acceder a los datos de dieta.", "stop_turn");
  const day = context.store.dietByDate[date];
  if (!day) return toolFailure("not_found", `No hay datos de dieta para la fecha "${date}". Puedes consultar otra fecha conocida o preguntar al usuario.`, "choose_alternative");
  const matchingMeal = day.meals.find((item) => item.title.toLowerCase() === meal.toLowerCase());
  if (!matchingMeal) return toolFailure("not_found", `No se encontró la comida "${meal}" para la fecha "${date}". Puedes consultar otra comida conocida o preguntar al usuario.`, "choose_alternative");
  if (matchingMeal.items.length === 0) return `La comida "${meal}" del ${date} no tiene alimentos registrados.`;
  return JSON.stringify(matchingMeal.items.map((item) => ({
    entrada_id: item.id,
    nombre: item.title,
    gramos: item.grams,
    calorias_kcal: item.calories_kcal,
    proteina_g: item.protein_g,
    carbohidratos_g: item.carbs_g,
    grasa_g: item.fat_g,
    source_id: item.catalog_link?.status === "linked" ? item.catalog_link.ref.sourceId : null,
    item_id: item.catalog_link?.status === "linked" ? item.catalog_link.ref.itemId : null,
  })));
};

function periodFailure(error: PeriodReadError): ToolResult {
  return toolFailure(error.code, error.message, "correct_arguments", error.details ?? {});
}

function periodOutput(value: unknown): string | ToolResult {
  const serialized = serializePeriodResult(value);
  return serialized.ok ? serialized.output : periodFailure(serialized.error);
}

const readMeasurementsPeriod: ToolHandler = async (args, _context, dependencies) => {
  const period = validatePeriod(args.from, args.to, PERIOD_READ_MAX_DAYS.measurements);
  if (!period.ok) return periodFailure(period.error);
  const measurements = await dependencies.loadMeasurements();
  return periodOutput(buildMeasurementPeriod(measurements, period.value));
};

const readDietPeriod: ToolHandler = async (args, context) => {
  const includeFoods = args.include_foods === true;
  const period = validatePeriod(
    args.from,
    args.to,
    includeFoods ? PERIOD_READ_MAX_DAYS.dietWithFoods : PERIOD_READ_MAX_DAYS.diet,
  );
  if (!period.ok) return periodFailure(period.error);
  if (!context.store) return toolFailure("storage_unavailable", "No se pudo acceder a los datos de dieta.", "stop_turn");
  return periodOutput(buildDietPeriod(context.store.dietByDate, period.value, { includeFoods }));
};

const readWorkoutHistory: ToolHandler = async (args, context) => {
  const period = validatePeriod(args.from, args.to, PERIOD_READ_MAX_DAYS.workouts);
  if (!period.ok) return periodFailure(period.error);
  if (!context.store) return toolFailure("storage_unavailable", "No se pudo acceder al historial de entrenamientos.", "stop_turn");
  return periodOutput(buildWorkoutPeriod(context.store.workoutHistory ?? [], period.value));
};

type MealFoodInputFailure = {
  code: string;
  message: string;
  recovery: "correct_arguments" | "choose_alternative";
  details?: Record<string, unknown>;
};

type ResolvedMealFood = {
  name: string;
  grams: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  catalogLink: CatalogLink;
};

/**
 * Comprueba un alimento de add_meal_food o de add_meal_foods y calcula sus
 * valores sin escribir nada. Del catálogo se toman siempre las calorías y los
 * macros de la ficha; los manuales se validan tal cual.
 */
function resolveMealFoodInput(
  data: Record<string, unknown>,
  repository: ToolFoodRepoEntry[],
): { ok: true; value: ResolvedMealFood } | { ok: false; failure: MealFoodInputFailure } {
  const kind = typeof data.kind === "string" ? data.kind : "legacy";
  let catalogLink: CatalogLink;
  let nutritionInput: Record<string, unknown> = data;

  if (kind === "catalog") {
    const sourceId = typeof data.source_id === "string" ? data.source_id : "";
    const itemId = typeof data.item_id === "string" ? data.item_id : "";
    const grams = Number(data.grams);
    const candidate = sourceId && itemId
      ? findByCatalogRef(repository, catalogRef(sourceId as FoodCatalogEntry["sourceId"], itemId))
      : null;
    if (!candidate) {
      return { ok: false, failure: { code: "not_found", message: "No se añadió el alimento: la referencia no existe en el catálogo disponible. Busca una referencia válida o pregunta al usuario.", recovery: "choose_alternative", details: { status: "not_found", source_id: sourceId, item_id: itemId, written: false } } };
    }
    if (!hasCompleteFoodNutrition(candidate)) {
      return { ok: false, failure: { code: "incomplete_nutrition", message: "No se añadió el alimento: faltan calorías o macronutrientes exactos. Los valores desconocidos, las trazas y los límites no son ceros. Pide datos al usuario o elige otra ficha; no los inventes.", recovery: "choose_alternative", details: { source_id: sourceId, item_id: itemId, written: false } } };
    }
    const ratio = grams / 100;
    nutritionInput = {
      name: candidate.name,
      grams,
      calories_kcal: Math.round(candidate.calories_per_100g * ratio * 10) / 10,
      protein_g: Math.round(candidate.protein_per_100g * ratio * 10) / 10,
      carbs_g: Math.round(candidate.carbs_per_100g * ratio * 10) / 10,
      fat_g: Math.round(candidate.fat_per_100g * ratio * 10) / 10,
    };
    catalogLink = linkedCatalog(catalogRef(candidate.sourceId, candidate.id), "tool");
  } else if (kind === "manual") {
    catalogLink = unresolvedCatalog("manual");
  } else {
    const foodName = typeof data.name === "string" ? data.name : "";
    const match = matchFoodCatalog(repository.filter(hasCompleteFoodNutrition), foodName);
    if (match.kind === "ambiguous") {
      return { ok: false, failure: { code: "ambiguous_food", message: "No se añadió el alimento: hay varias coincidencias. Pide al usuario que elija antes de guardar.", recovery: "choose_alternative", details: {
        status: "ambiguous",
        written: false,
        candidates: match.candidates.map((candidate) => ({
          source_id: candidate.sourceId,
          item_id: candidate.id,
          name: candidate.name,
        })),
      } } };
    }
    if (match.kind === "exact" || match.kind === "alias") {
      catalogLink = linkedCatalog(catalogRef(match.candidate.sourceId, match.candidate.id), "tool");
    } else {
      catalogLink = unresolvedCatalog("manual");
    }
  }

  const validation = validateNutritionItem(nutritionInput);
  if (!validation.ok) {
    return { ok: false, failure: { code: "invalid_food", message: `No se añadió el alimento. ${formatNutritionValidationIssues(validation.issues)}`, recovery: "correct_arguments" } };
  }
  return {
    ok: true,
    value: {
      name: validation.value.name,
      grams: validation.value.grams,
      caloriesKcal: validation.value.calories_kcal,
      proteinG: validation.value.protein_g,
      carbsG: validation.value.carbs_g,
      fatG: validation.value.fat_g,
      catalogLink,
    },
  };
}

function resolvedMealFoodItem(food: ResolvedMealFood, id: string): ToolDietItem {
  return {
    id,
    title: food.name,
    grams: food.grams,
    calories_kcal: food.caloriesKcal,
    protein_g: food.proteinG,
    carbs_g: food.carbsG,
    fat_g: food.fatG,
    catalog_link: food.catalogLink,
  };
}

const addMealFood: ToolHandler = async (args, context, dependencies) => {
  const date = (args.date as string) ?? "";
  if (!date) return toolFailure("invalid_date", "No se proporcionó una fecha.", "correct_arguments");
  const mealResult = resolveDietMealCategory(args.meal);
  if (!mealResult.ok) return toolFailure("invalid_meal", formatNutritionValidationIssues(mealResult.issues), "correct_arguments");
  const meal = mealResult.value;
  const parsed = parseObjectArgument(
    args.data,
    "El JSON del alimento no es válido.",
    "No se proporcionaron datos del alimento.",
  );
  if (parsed.error || !parsed.value) return toolFailure("invalid_food", parsed.error ?? "No se proporcionaron datos del alimento.", "correct_arguments");
  const resolved = resolveMealFoodInput(parsed.value, context.foodsRepo ?? []);
  if (!resolved.ok) {
    const { code, message, recovery, details } = resolved.failure;
    return toolFailure(code, message, recovery, details);
  }
  const {
    name: foodName,
    grams,
    caloriesKcal,
  } = resolved.value;
  const operationSuffix = context.operationId?.slice(0, 24);
  const newItem = resolvedMealFoodItem(
    resolved.value,
    operationSuffix ? `food_op_${operationSuffix}` : dependencies.createId("food"),
  );
  const updateStore = (previous: ToolStore): ToolStore => {
    const currentDay = previous.dietByDate[date] ?? { day_date: date, meals: [] };
    if (
      currentDay.meals.some((currentMeal) =>
        currentMeal.items.some((item) => item.id === newItem.id),
      )
    ) {
      return {
        ...previous,
        toolOperationReceipts: appendToolOperationReceipt(
          previous.toolOperationReceipts,
          context.operationId,
          "add_meal_food",
        ),
      };
    }
    const existingMeal = currentDay.meals.find((item) => item.title.toLowerCase() === meal.toLowerCase());
    const updatedMeals = existingMeal
      ? currentDay.meals.map((item) => item.title.toLowerCase() === meal.toLowerCase()
        ? { ...item, items: [...item.items, newItem] }
        : item)
      : [...currentDay.meals, {
          id: operationSuffix
            ? `meal_op_${operationSuffix}`
            : dependencies.createId("meal"),
          title: meal,
          items: [newItem],
        }].sort((left, right) => (
          DIET_MEAL_CATEGORIES.indexOf(left.title as (typeof DIET_MEAL_CATEGORIES)[number])
          - DIET_MEAL_CATEGORIES.indexOf(right.title as (typeof DIET_MEAL_CATEGORIES)[number])
        ));
    return {
      ...previous,
      dietByDate: {
        ...previous.dietByDate,
        [date]: { ...currentDay, meals: updatedMeals },
      },
      toolOperationReceipts: appendToolOperationReceipt(
        previous.toolOperationReceipts,
        context.operationId,
        "add_meal_food",
      ),
    };
  };
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se añadió el alimento.", "stop_turn");
  await commitToolStore(context, updateStore);
  context.markEffectCommitted?.();
  return `Alimento "${foodName}" (${grams}g, ${caloriesKcal} kcal) añadido a ${meal} del ${date}.`;
};

type MealEntryTarget = { date: string; meal: DietMealCategory; entryId: string };

function parseMealEntryTarget(args: Record<string, unknown>): { ok: true; value: MealEntryTarget } | { ok: false; failure: ToolResult } {
  if (!isCalendarDateKey(args.date)) {
    return { ok: false, failure: toolFailure("invalid_date", "La fecha debe tener el formato YYYY-MM-DD y ser un día real. No se ha cambiado nada.", "correct_arguments") };
  }
  const mealResult = resolveDietMealCategory(args.meal);
  if (!mealResult.ok) {
    return { ok: false, failure: toolFailure("invalid_meal", formatNutritionValidationIssues(mealResult.issues), "correct_arguments") };
  }
  const entryId = typeof args.entry_id === "string" ? args.entry_id.trim() : "";
  if (!entryId) {
    return { ok: false, failure: toolFailure("invalid_entry", "Falta el entrada_id. Obtenlo con read_meal_foods. No se ha cambiado nada.", "correct_arguments") };
  }
  return { ok: true, value: { date: args.date, meal: mealResult.value, entryId } };
}

function mealEntryNotFound(target: MealEntryTarget): ToolResult {
  return toolFailure(
    "not_found",
    `No se ha cambiado nada: la entrada "${target.entryId}" no está en ${target.meal} del ${target.date}. ` +
      "Puede que el usuario la haya cambiado o que el id sea de otra comida. Vuelve a leer la comida con read_meal_foods; no elijas otra entrada parecida por tu cuenta.",
    "choose_alternative",
    { status: "not_found", written: false, entry_id: target.entryId },
  );
}

const ALREADY_APPLIED_OUTPUT = JSON.stringify({ status: "already_applied", written: true });

/** Resumen de una entrada para los resultados de las herramientas de comida entera. */
function mealFoodSummary(item: ToolDietItem) {
  return {
    entrada_id: item.id,
    nombre: item.title,
    gramos: item.grams,
    calorias_kcal: item.calories_kcal,
    proteina_g: item.protein_g,
    carbohidratos_g: item.carbs_g,
    grasa_g: item.fat_g,
  };
}

function totalKcal(items: readonly ToolDietItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.calories_kcal, 0) * 10) / 10;
}

/** Ids deterministas por operación: un reintento reconstruye exactamente las mismas entradas. */
function operationIds(context: ToolExecutionContext, dependencies: ToolExecutorDependencies) {
  const suffix = context.operationId?.slice(0, 24);
  return {
    createItemId: (index: number) => suffix ? `food_op_${suffix}_${index}` : dependencies.createId("food"),
    createMealId: () => suffix ? `meal_op_${suffix}` : dependencies.createId("meal"),
  };
}

function parseMealLocator(
  dateValue: unknown,
  mealValue: unknown,
  dateField: string,
): { ok: true; value: { date: string; category: DietMealCategory } } | { ok: false; failure: ToolResult } {
  if (!isCalendarDateKey(dateValue)) {
    return { ok: false, failure: toolFailure("invalid_date", `${dateField} debe tener el formato YYYY-MM-DD y ser un día real. No se ha cambiado nada.`, "correct_arguments") };
  }
  const meal = resolveDietMealCategory(mealValue);
  if (!meal.ok) {
    return { ok: false, failure: toolFailure("invalid_meal", formatNutritionValidationIssues(meal.issues), "correct_arguments") };
  }
  return { ok: true, value: { date: dateValue, category: meal.value } };
}

function mealOperationFailure(error: MealOperationError): ToolResult {
  if (error.code === "destination_not_empty") {
    return toolFailure(
      "destination_not_empty",
      `${error.message} Pregunta al usuario si quiere sustituir lo que hay o sumarlo y repite la llamada con if_destination_has_foods. No lo decidas tú.`,
      "choose_alternative",
      { written: false, alimentos_en_destino: (error.existing ?? []).map(mealFoodSummary) },
    );
  }
  return toolFailure(error.code, error.message, error.code === "same_meal" ? "correct_arguments" : "choose_alternative", { written: false });
}

const addMealFoods: ToolHandler = async (args, context, dependencies) => {
  const target = parseMealLocator(args.date, args.meal, "La fecha");
  if (!target.ok) return target.failure;
  const foods = Array.isArray(args.foods) ? args.foods : [];
  if (foods.length === 0) {
    return toolFailure("invalid_food", "Falta la lista de alimentos. No se ha guardado nada.", "correct_arguments");
  }
  if (foods.length > MEAL_FOODS_BATCH_MAX) {
    return toolFailure("too_many_foods", `Como máximo ${MEAL_FOODS_BATCH_MAX} alimentos por llamada. Divide la lista. No se ha guardado nada.`, "correct_arguments");
  }
  const resolved: ResolvedMealFood[] = [];
  for (const [index, food] of foods.entries()) {
    const result = resolveMealFoodInput(food as Record<string, unknown>, context.foodsRepo ?? []);
    if (!result.ok) {
      const { code, message, recovery, details } = result.failure;
      return toolFailure(
        code,
        `Alimento ${index + 1} de ${foods.length}: ${message} No se ha guardado ninguno de los alimentos; corrige ese y repite la llamada con la lista completa.`,
        recovery,
        { ...details, posicion: index + 1, written: false },
      );
    }
    resolved.push(result.value);
  }
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se añadieron los alimentos.", "stop_turn");
  const ids = operationIds(context, dependencies);
  const items = resolved.map((food, index) => resolvedMealFoodItem(food, ids.createItemId(index)));
  let replayed = false;
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "add_meal_foods")) {
      replayed = true;
      return previous;
    }
    return {
      ...previous,
      dietByDate: placeItemsInMeal(previous.dietByDate, target.value, items, "append", ids.createMealId).dietByDate,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "add_meal_foods"),
    };
  });
  context.markEffectCommitted?.();
  if (replayed) return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: "added",
    written: true,
    fecha: target.value.date,
    comida: target.value.category,
    alimentos: items.map(mealFoodSummary),
    total_kcal_anadidas: totalKcal(items),
  });
};

const copyMeal: ToolHandler = async (args, context, dependencies) => {
  const source = parseMealLocator(args.from_date, args.from_meal, "from_date");
  if (!source.ok) return source.failure;
  const target = parseMealLocator(args.to_date, args.to_meal, "to_date");
  if (!target.ok) return target.failure;
  const mode = args.mode === "move" ? "move" : "copy";
  const placement = args.if_destination_has_foods as DietMealPlacement | undefined;
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se cambió nada.", "stop_turn");
  const ids = operationIds(context, dependencies);
  type CopyOutcome =
    | { kind: "replayed" }
    | { kind: "failed"; error: MealOperationError }
    | { kind: "done"; items: ToolDietItem[]; replaced: ToolDietItem[] };
  let outcome: CopyOutcome = { kind: "replayed" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "copy_meal")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const result = mode === "move"
      ? moveDietMeal(previous.dietByDate, source.value, target.value, { placement, createMealId: ids.createMealId })
      : copyDietMeal(previous.dietByDate, source.value, target.value, { placement, ...ids });
    if (!result.ok) {
      outcome = { kind: "failed", error: result.error };
      return previous;
    }
    outcome = {
      kind: "done",
      items: "moved" in result.value ? result.value.moved : result.value.copied,
      replaced: result.value.replaced,
    };
    return {
      ...previous,
      dietByDate: result.value.dietByDate,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "copy_meal"),
    };
  });
  const final = outcome as CopyOutcome;
  if (final.kind === "failed") return mealOperationFailure(final.error);
  context.markEffectCommitted?.();
  if (final.kind === "replayed") return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: mode === "move" ? "moved" : "copied",
    written: true,
    origen: { fecha: source.value.date, comida: source.value.category, queda_vacia: mode === "move" },
    destino: { fecha: target.value.date, comida: target.value.category },
    alimentos: final.items.map(mealFoodSummary),
    total_kcal: totalKcal(final.items),
    sustituidos: final.replaced.map(mealFoodSummary),
  });
};

const clearMeal: ToolHandler = async (args, context) => {
  const target = parseMealLocator(args.date, args.meal, "La fecha");
  if (!target.ok) return target.failure;
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se vació la comida.", "stop_turn");
  type ClearOutcome = { kind: "replayed" } | { kind: "failed"; error: MealOperationError } | { kind: "cleared"; items: ToolDietItem[] };
  let outcome: ClearOutcome = { kind: "replayed" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "clear_meal")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const result = clearDietMeal(previous.dietByDate, target.value);
    if (!result.ok) {
      outcome = { kind: "failed", error: result.error };
      return previous;
    }
    outcome = { kind: "cleared", items: result.value.cleared };
    return {
      ...previous,
      dietByDate: result.value.dietByDate,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "clear_meal"),
    };
  });
  const final = outcome as ClearOutcome;
  if (final.kind === "failed") return mealOperationFailure(final.error);
  context.markEffectCommitted?.();
  if (final.kind === "replayed") return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: "cleared",
    written: true,
    fecha: target.value.date,
    comida: target.value.category,
    quitados: final.items.map(mealFoodSummary),
    total_kcal_quitadas: totalKcal(final.items),
  });
};


const removeMealFood: ToolHandler = async (args, context) => {
  const parsed = parseMealEntryTarget(args);
  if (!parsed.ok) return parsed.failure;
  const target = parsed.value;
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se quitó el alimento.", "stop_turn");
  const locator = { date: target.date, meal: { category: target.meal }, itemId: target.entryId };
  type RemoveOutcome = { kind: "replayed" } | { kind: "missing" } | { kind: "removed"; item: ToolDietItem };
  let outcome: RemoveOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "remove_meal_food")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const result = removeDietItem(previous.dietByDate, locator);
    if (!result.ok) {
      outcome = { kind: "missing" };
      return previous;
    }
    outcome = { kind: "removed", item: result.value.removed };
    return {
      ...previous,
      dietByDate: result.value.dietByDate,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "remove_meal_food"),
    };
  });
  const final = outcome as RemoveOutcome;
  if (final.kind === "missing") return mealEntryNotFound(target);
  context.markEffectCommitted?.();
  if (final.kind === "replayed") return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: "removed",
    written: true,
    entrada_id: final.item.id,
    nombre: final.item.title,
    gramos: final.item.grams,
    fecha: target.date,
    comida: target.meal,
  });
};

const updateMealFood: ToolHandler = async (args, context, dependencies) => {
  const parsed = parseMealEntryTarget(args);
  if (!parsed.ok) return parsed.failure;
  const target = parsed.value;
  const hasGrams = args.grams !== undefined;
  const grams = Number(args.grams);
  if (hasGrams && !(Number.isFinite(grams) && grams > 0)) {
    return toolFailure("invalid_grams", "Los gramos deben ser un número mayor que 0. No se ha cambiado nada.", "correct_arguments");
  }
  let toMeal: DietMealCategory = target.meal;
  if (args.to_meal !== undefined) {
    const resolved = resolveDietMealCategory(args.to_meal);
    if (!resolved.ok) return toolFailure("invalid_meal", formatNutritionValidationIssues(resolved.issues), "correct_arguments");
    toMeal = resolved.value;
  }
  if (args.to_date !== undefined && !isCalendarDateKey(args.to_date)) {
    return toolFailure("invalid_date", "to_date debe tener el formato YYYY-MM-DD y ser un día real. No se ha cambiado nada.", "correct_arguments");
  }
  const toDate = (args.to_date as string | undefined) ?? target.date;
  if (!hasGrams && args.to_meal === undefined && args.to_date === undefined) {
    return toolFailure("no_change", "Indica qué cambiar: grams, to_meal o to_date. No se ha cambiado nada.", "correct_arguments");
  }
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se cambió el alimento.", "stop_turn");
  const locator = { date: target.date, meal: { category: target.meal }, itemId: target.entryId };
  const operationSuffix = context.operationId?.slice(0, 24);
  const createMealId = () => operationSuffix ? `meal_op_${operationSuffix}` : dependencies.createId("meal");
  type UpdateOutcome =
    | { kind: "replayed" }
    | { kind: "missing" }
    | { kind: "failed"; failure: ToolResult }
    | { kind: "unchanged"; item: ToolDietItem }
    | { kind: "updated"; previous: ToolDietItem; item: ToolDietItem };
  let outcome: UpdateOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "update_meal_food")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const located = locateDietItem(previous.dietByDate, locator);
    if (!located) {
      outcome = { kind: "missing" };
      return previous;
    }
    let replacement: ToolDietItem = located.item;
    if (hasGrams) {
      const rescaled = rescaleDietItem(located.item, grams, context.foodsRepo ?? []);
      if (!rescaled.ok) {
        outcome = { kind: "failed", failure: toolFailure(rescaled.error.code, rescaled.error.message, "choose_alternative", { written: false }) };
        return previous;
      }
      replacement = rescaled.value;
    }
    const moves = toDate !== target.date || toMeal !== target.meal;
    if (!moves && replacement.grams === located.item.grams) {
      outcome = { kind: "unchanged", item: located.item };
      return previous;
    }
    const result = moveDietItem(previous.dietByDate, locator, { date: toDate, category: toMeal }, createMealId, replacement);
    if (!result.ok) {
      outcome = { kind: "missing" };
      return previous;
    }
    outcome = { kind: "updated", previous: result.value.previous, item: result.value.item };
    return {
      ...previous,
      dietByDate: result.value.dietByDate,
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "update_meal_food"),
    };
  });
  const final = outcome as UpdateOutcome;
  if (final.kind === "missing") return mealEntryNotFound(target);
  if (final.kind === "failed") return final.failure;
  if (final.kind === "unchanged") {
    return JSON.stringify({
      status: "unchanged",
      written: false,
      message: "La entrada ya estaba así; no se ha cambiado nada.",
      entrada_id: final.item.id,
      nombre: final.item.title,
      gramos: final.item.grams,
      fecha: target.date,
      comida: target.meal,
    });
  }
  context.markEffectCommitted?.();
  if (final.kind === "replayed") return ALREADY_APPLIED_OUTPUT;
  const snapshot = (item: ToolDietItem, date: string, meal: DietMealCategory) => ({
    fecha: date,
    comida: meal,
    gramos: item.grams,
    calorias_kcal: item.calories_kcal,
    proteina_g: item.protein_g,
    carbohidratos_g: item.carbs_g,
    grasa_g: item.fat_g,
  });
  return JSON.stringify({
    status: "updated",
    written: true,
    entrada_id: final.item.id,
    nombre: final.item.title,
    antes: snapshot(final.previous, target.date, target.meal),
    ahora: snapshot(final.item, toDate, toMeal),
  });
};

const searchFoods: ToolHandler = async (args, context) => {
  if (!context.foodsRepo || context.foodsRepo.length === 0) {
    return serializeCatalogSearch(context.foodCatalogAvailability, []);
  }
  const query = (args.query as string) ?? "";
  const category = (args.category as string) ?? "";
  const source = (args.source as string) ?? "";
  const minCalories = args.min_calories != null ? Number(args.min_calories) : null;
  const maxCalories = args.max_calories != null ? Number(args.max_calories) : null;
  const minProtein = args.min_protein != null ? Number(args.min_protein) : null;
  const maxProtein = args.max_protein != null ? Number(args.max_protein) : null;
  const minCarbs = args.min_carbs != null ? Number(args.min_carbs) : null;
  const maxCarbs = args.max_carbs != null ? Number(args.max_carbs) : null;
  const minFat = args.min_fat != null ? Number(args.min_fat) : null;
  const maxFat = args.max_fat != null ? Number(args.max_fat) : null;
  const sortBy = (args.sort_by as string) ?? "";
  let results = [...context.foodsRepo];

  if (query.trim()) {
    const needle = normalizeSearchText(query);
    results = results.filter((food) => {
      const haystack = normalizeSearchText(food.name);
      return haystack.includes(needle) || needle.includes(haystack);
    });
  }
  if (category.trim()) {
    const needle = normalizeSearchText(category);
    results = results.filter((food) => normalizeSearchText(food.category).includes(needle));
  }
  if (source.trim()) {
    const needle = normalizeSearchText(source);
    results = results.filter((food) => (
      normalizeSearchText(food.source) === needle || normalizeSearchText(food.sourceId) === needle
    ));
  }
  if (minCalories != null) results = results.filter((food) => food.calories_per_100g !== null && food.calories_per_100g >= minCalories);
  if (maxCalories != null && maxCalories > 0) results = results.filter((food) => food.calories_per_100g !== null && food.calories_per_100g <= maxCalories);
  if (minProtein != null) results = results.filter((food) => food.protein_per_100g !== null && food.protein_per_100g >= minProtein);
  if (maxProtein != null && maxProtein > 0) results = results.filter((food) => food.protein_per_100g !== null && food.protein_per_100g <= maxProtein);
  if (minCarbs != null) results = results.filter((food) => food.carbs_per_100g !== null && food.carbs_per_100g >= minCarbs);
  if (maxCarbs != null && maxCarbs > 0) results = results.filter((food) => food.carbs_per_100g !== null && food.carbs_per_100g <= maxCarbs);
  if (minFat != null) results = results.filter((food) => food.fat_per_100g !== null && food.fat_per_100g >= minFat);
  if (maxFat != null && maxFat > 0) results = results.filter((food) => food.fat_per_100g !== null && food.fat_per_100g <= maxFat);

  if (sortBy) {
    const [field, direction] = sortBy.split("_");
    const ascending = direction === "asc";
    const getValue = (food: ToolFoodRepoEntry) => field === "calories"
      ? food.calories_per_100g
      : field === "protein"
        ? food.protein_per_100g
        : field === "carbs"
          ? food.carbs_per_100g
          : field === "fat"
            ? food.fat_per_100g
            : 0;
    results.sort((left, right) => {
      const a = getValue(left), b = getValue(right);
      if (a === null) return b === null ? 0 : 1;
      if (b === null) return -1;
      return ascending ? a - b : b - a;
    });
  }

  results = results.slice(0, 15);
  return serializeCatalogSearch(context.foodCatalogAvailability, results.map((food) => ({
    source_id: food.sourceId,
    item_id: food.id,
    nombre: food.name,
    categoria: food.category,
    tipo: food.source ?? "alimento",
    calorias_por_100g: food.calories_per_100g,
    proteina_por_100g: food.protein_per_100g,
    carbohidratos_por_100g: food.carbs_per_100g,
    grasa_por_100g: food.fat_per_100g,
    fibra_por_100g: food.fiber_per_100g,
    racion_g: food.serving_size_g,
    descripcion_racion: food.serving_description,
    ...(food.ciqual ? { fuente: "ANSES-CIQUAL 2025", calificadores: food.ciqual.qualifiers, nutricion_completa: hasCompleteFoodNutrition(food) } : {}),
  })));
};

const searchExercises: ToolHandler = async (args, context) => {
  const query = (args.query as string) ?? "";
  const muscleGroup = (args.muscle_group as string) ?? "";
  const secondaryMuscle = (args.secondary_muscle as string) ?? "";
  const equipment = (args.equipment as string) ?? "";
  const difficulty = (args.difficulty as string) ?? "";
  let results = context.searchExerciseCatalog
    ? await context.searchExerciseCatalog({ query, muscleGroup, secondaryMuscle, equipment, difficulty })
    : [...(context.exercisesRepo ?? [])];

  if (query.trim()) {
    const needle = normalizeSearchText(query);
    results = results.filter((exercise) => normalizeSearchText(exercise.name).includes(needle));
  }
  if (muscleGroup.trim()) {
    const needle = normalizeSearchText(muscleGroup);
    results = results.filter((exercise) => normalizeSearchText(exercise.muscle_group).includes(needle));
  }
  if (secondaryMuscle.trim()) {
    const needle = normalizeSearchText(secondaryMuscle);
    results = results.filter((exercise) => exercise.secondary_muscles.some(
      (muscle) => normalizeSearchText(muscle).includes(needle),
    ));
  }
  if (equipment.trim()) {
    const needle = normalizeSearchText(equipment);
    results = results.filter((exercise) => normalizeSearchText(exercise.equipment).includes(needle));
  }
  if (difficulty.trim()) {
    const needle = normalizeSearchText(difficulty);
    results = results.filter((exercise) => normalizeSearchText(exercise.difficulty).includes(needle));
  }

  results = results.slice(0, 15);
  return serializeCatalogSearch(
    context.getExerciseCatalogAvailability?.() ?? context.exerciseCatalogAvailability,
    results.map((exercise) => ({
    source_id: exercise.sourceId,
    item_id: exercise.id,
    nombre: exercise.name,
    musculo_principal: exercise.muscle_group,
    musculos_secundarios: exercise.secondary_muscles,
    equipamiento: exercise.equipment,
    dificultad: exercise.difficulty,
    instrucciones: exercise.instructions,
    })),
  );
};

const readRoutines: ToolHandler = async (_args, context) => {
  if (!context.store) return toolFailure("storage_unavailable", "No se pudo acceder a los datos de rutinas.", "stop_turn");
  if (context.store.templates.length === 0) return "No hay rutinas de entrenamiento creadas.";
  return JSON.stringify(context.store.templates.map((template) => ({
    id: template.id,
    nombre: template.name,
    categoria: template.category ?? "",
    icono: template.icon ?? "",
    duracion_minutos: template.duration_minutes ?? "",
    ejercicios: template.exercises.map((exercise) => ({
      ejercicio_id: exercise.id,
      nombre: exercise.name ?? "Sin nombre",
      musculo: exercise.muscle ?? "",
      source_id: exercise.catalog_link?.status === "linked" ? exercise.catalog_link.ref.sourceId : null,
      item_id: exercise.catalog_link?.status === "linked" ? exercise.catalog_link.ref.itemId : null,
      series: (exercise.series ?? []).map((series) => ({
        serie_id: series.id,
        tipo: series.type ?? "normal",
        repeticiones: series.reps,
        peso_kg: series.weight_kg,
        descanso_segundos: series.rest_seconds,
        tempo_contraccion: series.tempo_contraction ?? "",
        tempo_pausa: series.tempo_pause ?? "",
        tempo_relajacion: series.tempo_relaxation ?? "",
        sub_series: series.sub_series ?? [],
      })),
    })),
  })));
};

/**
 * Catálogo local más los ejercicios de gymnasia_exercises que cite `value`,
 * resueltos por id: el modelo puede citar ejercicios que search_exercises
 * encontró fuera del repositorio cargado en memoria.
 */
async function exerciseRepositoryFor(
  value: unknown,
  context: ToolExecutionContext,
): Promise<ToolExerciseRepoEntry[]> {
  const referencedIds = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.source_id === "gymnasia_exercises" && typeof record.item_id === "string") {
      referencedIds.add(record.item_id);
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  const resolved = context.resolveExerciseCatalogIds && referencedIds.size > 0
    ? await context.resolveExerciseCatalogIds([...referencedIds])
    : [];
  const repository = [...(context.exercisesRepo ?? [])];
  const known = new Set(repository.map((entry) => `${entry.sourceId}:${entry.id}`));
  for (const entry of resolved) {
    const key = `${entry.sourceId}:${entry.id}`;
    if (!known.has(key)) repository.push(entry);
  }
  return repository;
}

const createRoutine: ToolHandler = async (args, context, dependencies) => {
  const repository = await exerciseRepositoryFor(args.data, context);
  const preparation = prepareRoutineCreation(
    args.data,
    repository,
    dependencies,
    context.operationId,
  );
  if (!preparation.ok) {
    return toolFailure("invalid_routine", "No se creó la rutina. Corrige los problemas indicados antes de volver a intentarlo.", "correct_arguments", {
      status: "invalid_input",
      written: false,
      issues: preparation.issues,
    });
  }
  const newTemplate = preparation.value;
  if (!context.commitStore) {
    return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se creó la rutina.", "stop_turn", {
      status: "storage_unavailable",
      written: false,
    });
  }
  const updateStore = (previous: ToolStore): ToolStore => {
    if (previous.templates.some((template) => template.id === newTemplate.id)) {
      return {
        ...previous,
        toolOperationReceipts: appendToolOperationReceipt(
          previous.toolOperationReceipts,
          context.operationId,
          "create_routine",
        ),
      };
    }
    return {
      ...previous,
      templates: [...previous.templates, newTemplate],
      toolOperationReceipts: appendToolOperationReceipt(
        previous.toolOperationReceipts,
        context.operationId,
        "create_routine",
      ),
    };
  };
  await commitToolStore(context, updateStore);
  context.markEffectCommitted?.();
  return JSON.stringify({
    status: "created",
    written: true,
    template_id: newTemplate.id,
    name: newTemplate.name,
    exercise_count: newTemplate.exercises.length,
    execution_unit_count: listWorkoutExecutionUnits(newTemplate).length,
  });
};

const ROUTINE_EDITABLE_FIELDS = ["name", "category", "icon", "duration_minutes"] as const;
type RoutineEditableField = (typeof ROUTINE_EDITABLE_FIELDS)[number];

type RoutineWriteOutcome =
  | { kind: "replayed" }
  | { kind: "missing" }
  | { kind: "in_session"; name: string }
  | { kind: "invalid"; issues: ReadonlyArray<{ field: string; code: string; message: string }> }
  | { kind: "unchanged"; template: ToolWorkoutTemplate }
  | { kind: "updated"; before: ToolWorkoutTemplate; after: ToolWorkoutTemplate }
  | { kind: "deleted"; removed: ToolWorkoutTemplate };

function parseRoutineId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function routineSummaryFields(template: ToolWorkoutTemplate) {
  return {
    nombre: template.name,
    categoria: template.category ?? "",
    icono: template.icon ?? "",
    duracion_minutos: template.duration_minutes ?? "",
  };
}

function routineNotFound(routineId: string): ToolResult {
  return toolFailure(
    "not_found",
    `No se ha cambiado nada: no existe ninguna rutina con id ${routineId}. Consulta read_routines y, si dudas de cuál es, pregunta al usuario.`,
    "choose_alternative",
    { status: "not_found", written: false },
  );
}

function routineInSession(name: string): ToolResult {
  return toolFailure(
    "routine_in_active_session",
    // stop_turn: este texto se muestra tal cual al usuario, no al modelo.
    `No he cambiado la rutina "${name}" porque la estás entrenando ahora mismo. Podrás cambiarla o borrarla cuando termines o abandones el entrenamiento.`,
    "stop_turn",
    { status: "in_active_session", written: false },
  );
}

const updateRoutine: ToolHandler = async (args, context) => {
  const routineId = parseRoutineId(args.routine_id);
  if (!routineId) return toolFailure("invalid_routine", "Falta routine_id. Obtenlo con read_routines. No se ha cambiado nada.", "correct_arguments");
  const data = (args.data && typeof args.data === "object" ? args.data : {}) as Record<string, unknown>;
  const clearFields = Array.isArray(args.clear_fields) ? args.clear_fields : [];
  const clearDuration = clearFields.includes("duration_minutes");
  if (clearDuration && data.duration_minutes !== undefined) {
    return toolFailure("invalid_routine", "No se puede cambiar y borrar la duración a la vez. No se ha cambiado nada.", "correct_arguments");
  }
  const requested = ROUTINE_EDITABLE_FIELDS.filter((field) => data[field] !== undefined);
  if (requested.length === 0 && !clearDuration) {
    return toolFailure("invalid_routine", "No se indicó ningún cambio. No se ha cambiado nada.", "correct_arguments");
  }
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se modificó la rutina.", "stop_turn");

  let outcome: RoutineWriteOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "update_routine")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const current = previous.templates.find((template) => template.id === routineId);
    if (!current) {
      outcome = { kind: "missing" };
      return previous;
    }
    if (context.getActiveWorkoutTemplateId?.() === routineId) {
      outcome = { kind: "in_session", name: current.name };
      return previous;
    }
    const candidate: ToolWorkoutTemplate = { ...current };
    if (typeof data.name === "string") candidate.name = data.name.trim();
    if (data.category !== undefined) candidate.category = data.category as ToolWorkoutTemplate["category"];
    if (data.icon !== undefined) candidate.icon = data.icon as ToolWorkoutTemplate["icon"];
    if (data.duration_minutes !== undefined) candidate.duration_minutes = String(data.duration_minutes);
    if (clearDuration) delete candidate.duration_minutes;
    const validation = validateWorkoutTemplateForWrite(candidate);
    if (!validation.ok) {
      outcome = { kind: "invalid", issues: validation.issues };
      return previous;
    }
    const after = validation.value;
    const changed = ROUTINE_EDITABLE_FIELDS.some((field: RoutineEditableField) => after[field] !== current[field]);
    if (!changed) {
      outcome = { kind: "unchanged", template: current };
      return previous;
    }
    outcome = { kind: "updated", before: current, after };
    return {
      ...previous,
      templates: previous.templates.map((template) => (template.id === routineId ? after : template)),
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "update_routine"),
    };
  });
  const final = outcome as RoutineWriteOutcome;
  if (final.kind === "missing") return routineNotFound(routineId);
  if (final.kind === "in_session") return routineInSession(final.name);
  if (final.kind === "invalid") {
    return toolFailure("invalid_routine", "No se modificó la rutina. Corrige los problemas indicados antes de volver a intentarlo.", "correct_arguments", {
      status: "invalid_input",
      written: false,
      issues: final.issues,
    });
  }
  if (final.kind === "unchanged") {
    return JSON.stringify({ status: "unchanged", written: false, routine_id: routineId, ...routineSummaryFields(final.template) });
  }
  context.markEffectCommitted?.();
  if (final.kind !== "updated") return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: "updated",
    written: true,
    routine_id: routineId,
    antes: routineSummaryFields(final.before),
    despues: routineSummaryFields(final.after),
    ejercicios: final.after.exercises.length,
  });
};

const deleteRoutine: ToolHandler = async (args, context) => {
  const routineId = parseRoutineId(args.routine_id);
  if (!routineId) return toolFailure("invalid_routine", "Falta routine_id. Obtenlo con read_routines. No se ha borrado nada.", "correct_arguments");
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se borró la rutina.", "stop_turn");

  let outcome: RoutineWriteOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "delete_routine")) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const current = previous.templates.find((template) => template.id === routineId);
    if (!current) {
      outcome = { kind: "missing" };
      return previous;
    }
    if (context.getActiveWorkoutTemplateId?.() === routineId) {
      outcome = { kind: "in_session", name: current.name };
      return previous;
    }
    outcome = { kind: "deleted", removed: current };
    // El historial guarda su propia copia de nombre y series: no se toca.
    return {
      ...previous,
      templates: previous.templates.filter((template) => template.id !== routineId),
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, "delete_routine"),
    };
  });
  const final = outcome as RoutineWriteOutcome;
  if (final.kind === "missing") return routineNotFound(routineId);
  if (final.kind === "in_session") return routineInSession(final.name);
  context.markEffectCommitted?.();
  if (final.kind !== "deleted") return ALREADY_APPLIED_OUTPUT;
  return JSON.stringify({
    status: "deleted",
    written: true,
    routine_id: routineId,
    nombre: final.removed.name,
    ejercicios: final.removed.exercises.length,
    historial_conservado: true,
  });
};

type RoutineExerciseEdit =
  | { kind: "failure"; failure: ToolResult }
  | { kind: "edited"; template: ToolWorkoutTemplate; exerciseId: string | null; removed?: WorkoutExercise };

type RoutineExerciseOutcome =
  | { kind: "replayed" }
  | { kind: "missing" }
  | { kind: "in_session"; name: string }
  | { kind: "failure"; failure: ToolResult }
  | { kind: "invalid"; issues: ReadonlyArray<{ field: string; code: string; message: string }> }
  | { kind: "unchanged"; template: ToolWorkoutTemplate; exerciseId: string | null }
  | {
    kind: "updated";
    before: ToolWorkoutTemplate;
    after: ToolWorkoutTemplate;
    exerciseId: string | null;
    removed?: WorkoutExercise;
  };

/**
 * Flujo común de las herramientas que cambian ejercicios de una rutina: recibo
 * de idempotencia, rutina inexistente, rutina en entrenamiento y validación de
 * la rutina completa, todo dentro de la misma escritura para que nada se cuele
 * entre la comprobación y el guardado. `edit` es pura: devuelve la rutina
 * candidata o un fallo, y el almacén no cambia hasta que la candidata valida.
 */
async function commitRoutineExerciseEdit(
  context: ToolExecutionContext,
  toolName: string,
  routineId: string,
  edit: (current: ToolWorkoutTemplate) => RoutineExerciseEdit,
): Promise<RoutineExerciseOutcome> {
  let outcome: RoutineExerciseOutcome = { kind: "missing" };
  await commitToolStore(context, (previous) => {
    if (context.operationId && hasToolOperationReceipt(previous.toolOperationReceipts, context.operationId, toolName)) {
      outcome = { kind: "replayed" };
      return previous;
    }
    const current = previous.templates.find((template) => template.id === routineId);
    if (!current) {
      outcome = { kind: "missing" };
      return previous;
    }
    if (context.getActiveWorkoutTemplateId?.() === routineId) {
      outcome = { kind: "in_session", name: current.name };
      return previous;
    }
    const result = edit(current);
    if (result.kind === "failure") {
      outcome = result;
      return previous;
    }
    const validation = validateWorkoutTemplateForWrite(result.template);
    if (!validation.ok) {
      outcome = { kind: "invalid", issues: validation.issues };
      return previous;
    }
    const after = validation.value;
    if (buildWorkoutTemplateRevision(after) === buildWorkoutTemplateRevision(current)) {
      outcome = { kind: "unchanged", template: current, exerciseId: result.exerciseId };
      return previous;
    }
    outcome = { kind: "updated", before: current, after, exerciseId: result.exerciseId, removed: result.removed };
    return {
      ...previous,
      templates: previous.templates.map((template) => (template.id === routineId ? after : template)),
      toolOperationReceipts: appendToolOperationReceipt(previous.toolOperationReceipts, context.operationId, toolName),
    };
  });
  return outcome as RoutineExerciseOutcome;
}

function routineExerciseSummary(template: ToolWorkoutTemplate, exerciseId: string | null) {
  const index = exerciseId ? template.exercises.findIndex((exercise) => exercise.id === exerciseId) : -1;
  if (index < 0) return null;
  const exercise = template.exercises[index];
  return {
    ejercicio_id: exercise.id,
    nombre: exercise.name ?? "Sin nombre",
    posicion: index + 1,
    series: (exercise.series ?? []).map((series) => ({
      serie_id: series.id,
      tipo: series.type ?? "normal",
      repeticiones: series.reps,
      peso_kg: series.weight_kg,
      descanso_segundos: series.rest_seconds,
      ...(series.tempo_contraction || series.tempo_pause || series.tempo_relaxation ? {
        tempo_contraccion: series.tempo_contraction ?? "",
        tempo_pausa: series.tempo_pause ?? "",
        tempo_relajacion: series.tempo_relaxation ?? "",
      } : {}),
    })),
  };
}

function routineExerciseResult(
  outcome: RoutineExerciseOutcome,
  routineId: string,
  context: ToolExecutionContext,
  failureMessage: string,
): string | ToolResult {
  if (outcome.kind === "missing") return routineNotFound(routineId);
  if (outcome.kind === "in_session") return routineInSession(outcome.name);
  if (outcome.kind === "failure") return outcome.failure;
  if (outcome.kind === "invalid") {
    return toolFailure("invalid_routine", failureMessage, "correct_arguments", {
      status: "invalid_input",
      written: false,
      issues: outcome.issues,
    });
  }
  if (outcome.kind === "unchanged") {
    return JSON.stringify({
      status: "unchanged",
      written: false,
      routine_id: routineId,
      ejercicio: routineExerciseSummary(outcome.template, outcome.exerciseId),
    });
  }
  context.markEffectCommitted?.();
  if (outcome.kind !== "updated") return ALREADY_APPLIED_OUTPUT;
  const antes = routineExerciseSummary(outcome.before, outcome.exerciseId);
  const despues = routineExerciseSummary(outcome.after, outcome.exerciseId);
  return JSON.stringify({
    status: "updated",
    written: true,
    routine_id: routineId,
    rutina: outcome.after.name,
    ...(antes ? { antes } : {}),
    ...(despues ? { despues } : {}),
    ...(outcome.removed ? { quitado: { ejercicio_id: outcome.removed.id, nombre: outcome.removed.name ?? "Sin nombre" } } : {}),
    orden: outcome.after.exercises.map((exercise) => exercise.name ?? "Sin nombre"),
  });
}

function routineArgumentFailure(message: string): ToolResult {
  return toolFailure("invalid_routine", `${message} No se ha cambiado nada.`, "correct_arguments", {
    status: "invalid_input",
    written: false,
  });
}

function routineChildNotFound(message: string): ToolResult {
  return toolFailure(
    "not_found",
    `No se ha cambiado nada: ${message} Vuelve a consultar read_routines y, si dudas, pregunta al usuario.`,
    "choose_alternative",
    { status: "not_found", written: false },
  );
}

/** Convierte una posición «humana» (desde 1) en índice; undefined si no viene. */
function parsePosition(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 ? value - 1 : undefined;
}

const ADD_EXERCISE_FAILURE = "No se añadió el ejercicio. Corrige los problemas indicados antes de volver a intentarlo.";
const UPDATE_EXERCISE_FAILURE = "No se modificó el ejercicio. Corrige los problemas indicados antes de volver a intentarlo.";

const addRoutineExercise: ToolHandler = async (args, context, dependencies) => {
  const routineId = parseRoutineId(args.routine_id);
  if (!routineId) return routineArgumentFailure("Falta routine_id. Obtenlo con read_routines.");
  if (!args.exercise || typeof args.exercise !== "object") return routineArgumentFailure("Falta el ejercicio.");
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se modificó la rutina.", "stop_turn");
  const repository = await exerciseRepositoryFor(args.exercise, context);
  const position = parsePosition(args.position);

  const outcome = await commitRoutineExerciseEdit(context, "add_routine_exercise", routineId, (current) => {
    const preparation = prepareRoutineExerciseAddition(args.exercise, current, repository, dependencies, context.operationId);
    if (!preparation.ok) {
      return {
        kind: "failure",
        failure: toolFailure("invalid_routine", ADD_EXERCISE_FAILURE, "correct_arguments", {
          status: "invalid_input",
          written: false,
          issues: preparation.issues,
        }),
      };
    }
    const exercise = preparation.value;
    if (current.exercises.some((item) => item.id === exercise.id)) {
      // Mismo id derivado de la operación pero sin recibo: ya estaba aplicado.
      return { kind: "edited", template: current, exerciseId: exercise.id };
    }
    return { kind: "edited", template: insertWorkoutExercise(current, exercise, position), exerciseId: exercise.id };
  });
  return routineExerciseResult(outcome, routineId, context, ADD_EXERCISE_FAILURE);
};

type SeriesPatch = {
  type?: SeriesType;
  reps?: number;
  weight_kg?: number;
  rest_seconds?: number;
  tempo_contraction?: number;
  tempo_pause?: number;
  tempo_relaxation?: number;
};

const SERIES_PATCH_NUMBER_FIELDS = [
  "reps",
  "weight_kg",
  "rest_seconds",
  "tempo_contraction",
  "tempo_pause",
  "tempo_relaxation",
] as const;

function readSeriesPatch(value: unknown): SeriesPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patch: SeriesPatch = {};
  if (isSeriesType(record.type)) patch.type = record.type;
  for (const field of SERIES_PATCH_NUMBER_FIELDS) {
    const raw = record[field];
    if (typeof raw === "number" && Number.isFinite(raw)) patch[field] = raw;
  }
  return patch;
}

function isEmptySeriesPatch(patch: SeriesPatch): boolean {
  return patch.type === undefined && SERIES_PATCH_NUMBER_FIELDS.every((field) => patch[field] === undefined);
}

function applySeriesPatch(
  series: ExerciseSeries,
  patch: SeriesPatch,
  createId: (prefix: string) => string,
): ExerciseSeries {
  const next: ExerciseSeries = patch.type !== undefined && patch.type !== (series.type ?? "normal")
    ? changeExerciseSeriesType(series, patch.type, createId)
    : { ...series };
  for (const field of SERIES_PATCH_NUMBER_FIELDS) {
    const value = patch[field];
    if (value !== undefined) next[field] = String(value);
  }
  return next;
}

const updateRoutineExercise: ToolHandler = async (args, context, dependencies) => {
  const routineId = parseRoutineId(args.routine_id);
  if (!routineId) return routineArgumentFailure("Falta routine_id. Obtenlo con read_routines.");
  const exerciseId = parseRoutineId(args.exercise_id);
  if (!exerciseId) return routineArgumentFailure("Falta exercise_id. Obtenlo (ejercicio_id) con read_routines.");

  const allSeries = readSeriesPatch(args.all_series);
  const rawUpdates = Array.isArray(args.series_updates) ? args.series_updates : [];
  const seriesUpdates = rawUpdates.map((raw) => {
    const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return { seriesId: parseRoutineId(record.series_id), patch: readSeriesPatch(record) };
  });
  const rawRemovals = (Array.isArray(args.remove_series_ids) ? args.remove_series_ids : []).map(parseRoutineId);
  const addSeries = Array.isArray(args.add_series) ? args.add_series : [];
  const position = parsePosition(args.position);

  if (seriesUpdates.some((update) => !update.seriesId) || rawRemovals.some((id) => !id)) {
    return routineArgumentFailure("Cada serie se indica con su serie_id de read_routines.");
  }
  const updateIds = seriesUpdates.map((update) => update.seriesId as string);
  const removeIds = rawRemovals as string[];
  if (new Set(updateIds).size !== updateIds.length) {
    return routineArgumentFailure("series_updates repite la misma serie: junta sus cambios en una sola entrada.");
  }
  if (updateIds.some((id) => removeIds.includes(id))) {
    return routineArgumentFailure("Una misma serie no se puede cambiar y quitar a la vez.");
  }
  if (seriesUpdates.some((update) => isEmptySeriesPatch(update.patch))) {
    return routineArgumentFailure("Cada entrada de series_updates debe incluir al menos un campo que cambiar.");
  }
  if (
    isEmptySeriesPatch(allSeries)
    && seriesUpdates.length === 0
    && removeIds.length === 0
    && addSeries.length === 0
    && position === undefined
  ) {
    return routineArgumentFailure("No se indicó ningún cambio.");
  }
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se modificó la rutina.", "stop_turn");
  const repository = addSeries.length > 0 ? await exerciseRepositoryFor(addSeries, context) : [];
  const operationSuffix = context.operationId?.slice(0, 24);
  const createIdFor = (tag: string) => (prefix: string): string => (
    operationSuffix ? `${prefix}_op_${operationSuffix}_${tag}` : dependencies.createId(prefix)
  );

  const outcome = await commitRoutineExerciseEdit(context, "update_routine_exercise", routineId, (current) => {
    const exercise = current.exercises.find((item) => item.id === exerciseId);
    if (!exercise) {
      return { kind: "failure", failure: routineChildNotFound(`la rutina "${current.name}" no tiene ningún ejercicio con id ${exerciseId}.`) };
    }
    const seriesList = exercise.series ?? [];
    const knownSeries = new Set(seriesList.map((series) => series.id));
    const missingSeries = [...updateIds, ...removeIds].filter((id) => !knownSeries.has(id));
    if (missingSeries.length > 0) {
      return {
        kind: "failure",
        failure: routineChildNotFound(`el ejercicio "${exercise.name ?? "Sin nombre"}" no tiene ninguna serie con id ${missingSeries.join(", ")}.`),
      };
    }
    let nextSeries = seriesList.map((series, index) => {
      let next = isEmptySeriesPatch(allSeries) ? series : applySeriesPatch(series, allSeries, createIdFor(`all_${index}`));
      const update = seriesUpdates.find((item) => item.seriesId === series.id);
      if (update) next = applySeriesPatch(next, update.patch, createIdFor(`set_${index}`));
      return next;
    });
    nextSeries = nextSeries.filter((series) => !removeIds.includes(series.id));
    if (addSeries.length > 0) {
      const preparation = prepareRoutineSeriesAddition(addSeries, current, repository, dependencies, context.operationId);
      if (!preparation.ok) {
        return {
          kind: "failure",
          failure: toolFailure("invalid_routine", UPDATE_EXERCISE_FAILURE, "correct_arguments", {
            status: "invalid_input",
            written: false,
            issues: preparation.issues,
          }),
        };
      }
      nextSeries = [...nextSeries, ...preparation.value];
    }
    let template: ToolWorkoutTemplate = {
      ...current,
      exercises: current.exercises.map((item) => (item.id === exerciseId ? { ...item, series: nextSeries } : item)),
    };
    if (position !== undefined) template = moveWorkoutExercise(template, exerciseId, position) ?? template;
    return { kind: "edited", template, exerciseId };
  });
  return routineExerciseResult(outcome, routineId, context, UPDATE_EXERCISE_FAILURE);
};

const removeRoutineExercise: ToolHandler = async (args, context) => {
  const routineId = parseRoutineId(args.routine_id);
  if (!routineId) return routineArgumentFailure("Falta routine_id. Obtenlo con read_routines.");
  const exerciseId = parseRoutineId(args.exercise_id);
  if (!exerciseId) return routineArgumentFailure("Falta exercise_id. Obtenlo (ejercicio_id) con read_routines.");
  if (!context.commitStore) return toolFailure("storage_unavailable", "No se pudo acceder al almacenamiento durable. No se modificó la rutina.", "stop_turn");

  const outcome = await commitRoutineExerciseEdit(context, "remove_routine_exercise", routineId, (current) => {
    const exercise = current.exercises.find((item) => item.id === exerciseId);
    if (!exercise) {
      return { kind: "failure", failure: routineChildNotFound(`la rutina "${current.name}" no tiene ningún ejercicio con id ${exerciseId}.`) };
    }
    const name = exercise.name ?? "Sin nombre";
    if (current.exercises.length === 1) {
      return {
        kind: "failure",
        failure: toolFailure(
          "invalid_routine",
          `No se ha cambiado nada: "${name}" es el único ejercicio de la rutina "${current.name}" y una rutina necesita al menos uno. Si el usuario quiere quitar la rutina entera, confírmalo con él y usa delete_routine.`,
          "choose_alternative",
          { status: "last_exercise", written: false },
        ),
      };
    }
    const references = findSupersetReferences(current, exerciseId);
    if (references.length > 0) {
      const names = references.map((item) => `"${item.name ?? "Sin nombre"}"`).join(", ");
      return {
        kind: "failure",
        failure: toolFailure(
          "exercise_in_superset",
          `No se ha cambiado nada: "${name}" forma parte de una superserie de ${names}, que se quedaría apuntando a un ejercicio que ya no está. Explícaselo al usuario: puede quitar antes esa superserie desde la pantalla de la rutina, o pedirte que quites también ${names}.`,
          "choose_alternative",
          { status: "in_superset", written: false, referenciado_por: references.map((item) => item.id) },
        ),
      };
    }
    const template = removeWorkoutExercise(current, exerciseId) ?? current;
    return { kind: "edited", template, exerciseId: null, removed: exercise };
  });
  return routineExerciseResult(outcome, routineId, context, "No se quitó el ejercicio. Corrige los problemas indicados antes de volver a intentarlo.");
};

const createFeatureIssue: ToolHandler = async (args, _context, dependencies) => {
  const draft = sanitizeFeedbackDraft({
    kind: "feature",
    title: args.title as string,
    summary: args.summary as string,
  });
  if (!draft) return toolFailure("invalid_feedback", "Falta el título o el resumen de la mejora.", "correct_arguments");
  const outcome = await dependencies.submitFeedbackIssue(draft, _context.operationId);
  if (outcome.status === "created") _context.markEffectCommitted?.();
  if (outcome.status === "error") _context.markEffectIndeterminate?.();
  if (outcome.status === "unavailable" || outcome.status === "rejected") {
    return toolFailure("feedback_unavailable", "No se pudo enviar la propuesta. No se ha registrado ninguna incidencia; puedes intentarlo más adelante.", "stop_turn");
  }
  return describeOutcomeForModel(outcome);
};

export const AGENT_TOOL_HANDLERS: Readonly<Record<string, ToolHandler>> = Object.freeze({
  save_personal_data: savePersonalData,
  list_personal_data_keys: listPersonalDataKeys,
  read_field_description: readFieldDescription,
  read_field_value: readFieldValue,
  read_measurement: readMeasurement,
  write_measurement: writeMeasurement,
  delete_measurement: deleteMeasurement,
  read_meal_foods: readMealFoods,
  read_measurements_period: readMeasurementsPeriod,
  read_diet_period: readDietPeriod,
  read_workout_history: readWorkoutHistory,
  search_foods: searchFoods,
  add_meal_food: addMealFood,
  remove_meal_food: removeMealFood,
  update_meal_food: updateMealFood,
  add_meal_foods: addMealFoods,
  copy_meal: copyMeal,
  clear_meal: clearMeal,
  search_exercises: searchExercises,
  read_routines: readRoutines,
  create_routine: createRoutine,
  update_routine: updateRoutine,
  delete_routine: deleteRoutine,
  add_routine_exercise: addRoutineExercise,
  update_routine_exercise: updateRoutineExercise,
  remove_routine_exercise: removeRoutineExercise,
  create_feature_issue: createFeatureIssue,
});

export const AGENT_TOOL_HANDLER_NAMES = Object.keys(AGENT_TOOL_HANDLERS);

const TOOL_INPUT_SCHEMAS = new Map(
  AGENT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool.inputSchema]),
);

export function createDetailedAgentToolExecutor(dependencies: ToolExecutorDependencies) {
  return async function executeDetailedAgentTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {},
  ): Promise<ToolOperationExecutionOutcome> {
    const handler = Object.hasOwn(AGENT_TOOL_HANDLERS, name)
      ? AGENT_TOOL_HANDLERS[name]
      : undefined;
    const schema = TOOL_INPUT_SCHEMAS.get(name);
    if (!handler || !schema) {
      return { ...toolFailure("unknown_tool", "Herramienta no reconocida. Elige una herramienta del catálogo disponible.", "correct_arguments"), status: "no_effect" };
    }
    let effectCommitted = false;
    let effectIndeterminate = false;
    try {
      const validation = validateToolInput(schema, args);
      if (!validation.valid) {
        return { output: formatToolInputError(validation.errors), isError: true, status: "no_effect" };
      }
      const result = await handler(
        args,
        {
          ...context,
          markEffectCommitted: () => {
            effectCommitted = true;
            context.markEffectCommitted?.();
          },
          markEffectIndeterminate: () => {
            effectIndeterminate = true;
            context.markEffectIndeterminate?.();
          },
        },
        dependencies,
      );
      return {
        ...(typeof result === "string" ? { output: result } : result),
        status: effectCommitted
          ? "committed"
          : effectIndeterminate
            ? "indeterminate"
            : "no_effect",
      };
    } catch (error) {
      // Sin este catch, una excepción de cualquier handler sube por
      // providerToolLoop y aborta el turno entero del chat. Con una tool que
      // hace red eso pasa de teórico a probable.
      return {
        ...toolFailure("tool_execution_failed",
          effectCommitted ? "La acción se guardó, pero no se pudo obtener su resultado. Revisa tus datos antes de solicitarla de nuevo."
            : effectIndeterminate || error instanceof ToolOperationIndeterminateError
              ? "No se puede confirmar si la acción se completó. Revisa tus datos antes de solicitarla de nuevo."
              : "La herramienta ha fallado. No se pudo completar la consulta.",
          agentToolEffect(name) === "read" ? "choose_alternative" : "stop_turn"),
        status: effectCommitted
          ? "committed"
          : effectIndeterminate
            || error instanceof ToolOperationIndeterminateError
            ? "indeterminate"
            : "failed_before_commit",
      };
    }
  };
}

export function createAgentToolExecutor(dependencies: ToolExecutorDependencies) {
  const detailedExecutor = createDetailedAgentToolExecutor(dependencies);
  return async function executeAgentTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {},
  ): Promise<string> {
    return (await detailedExecutor(name, args, context)).output;
  };
}
