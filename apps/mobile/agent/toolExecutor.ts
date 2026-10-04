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
} from "../diet/nutritionContract";
import {
  ToolOperationIndeterminateError,
  type ToolOperationExecutionOutcome,
} from "./toolOperationLedger";
import { appendToolOperationReceipt, type ToolOperationReceipt } from "./toolOperationReceipts";
import { findByCatalogRef, matchFoodCatalog } from "../catalogs/matching";
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
  formatMeasurementIssues,
  measurementDuplicateDates,
  parseMeasurementToolPatch,
  upsertMeasurementByDate,
  validateMeasurementDate,
  type Measurement,
} from "../measurements/measurementContract";
import type { ExerciseSeries } from "../training/seriesContract";
import { listWorkoutExecutionUnits } from "../training/workoutExecution";
import type { WorkoutTemplate } from "../training/workoutTemplateOperations";
import { prepareRoutineCreation } from "./routineCreationContract";
import { AGENT_TOOL_DEFINITIONS, agentToolEffect, formatToolInputError, validateToolInput } from "./toolDefinitions";
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
  const data = parsed.value;
  const repository = context.foodsRepo ?? [];
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
      return toolFailure("not_found", "No se añadió el alimento: la referencia no existe en el catálogo disponible. Busca una referencia válida o pregunta al usuario.", "choose_alternative", { status: "not_found", source_id: sourceId, item_id: itemId, written: false });
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
    const match = matchFoodCatalog(repository, foodName);
    if (match.kind === "ambiguous") {
      return toolFailure("ambiguous_food", "No se añadió el alimento: hay varias coincidencias. Pide al usuario que elija antes de guardar.", "choose_alternative", {
        status: "ambiguous",
        written: false,
        candidates: match.candidates.map((candidate) => ({
          source_id: candidate.sourceId,
          item_id: candidate.id,
          name: candidate.name,
        })),
      });
    }
    if (match.kind === "exact" || match.kind === "alias") {
      catalogLink = linkedCatalog(catalogRef(match.candidate.sourceId, match.candidate.id), "tool");
    } else {
      catalogLink = unresolvedCatalog("manual");
    }
  }

  const validation = validateNutritionItem(nutritionInput);
  if (!validation.ok) {
    return toolFailure("invalid_food", `No se añadió el alimento. ${formatNutritionValidationIssues(validation.issues)}`, "correct_arguments");
  }
  const {
    name: foodName,
    grams,
    calories_kcal: caloriesKcal,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
  } = validation.value;
  const operationSuffix = context.operationId?.slice(0, 24);
  const newItem: ToolDietItem = {
    id: operationSuffix
      ? `food_op_${operationSuffix}`
      : dependencies.createId("food"),
    title: foodName,
    grams,
    calories_kcal: caloriesKcal,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    catalog_link: catalogLink,
  };
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
  if (minCalories != null) results = results.filter((food) => food.calories_per_100g >= minCalories);
  if (maxCalories != null && maxCalories > 0) results = results.filter((food) => food.calories_per_100g <= maxCalories);
  if (minProtein != null) results = results.filter((food) => food.protein_per_100g >= minProtein);
  if (maxProtein != null && maxProtein > 0) results = results.filter((food) => food.protein_per_100g <= maxProtein);
  if (minCarbs != null) results = results.filter((food) => food.carbs_per_100g >= minCarbs);
  if (maxCarbs != null && maxCarbs > 0) results = results.filter((food) => food.carbs_per_100g <= maxCarbs);
  if (minFat != null) results = results.filter((food) => food.fat_per_100g >= minFat);
  if (maxFat != null && maxFat > 0) results = results.filter((food) => food.fat_per_100g <= maxFat);

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
    results.sort((left, right) => ascending
      ? getValue(left) - getValue(right)
      : getValue(right) - getValue(left));
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
    duracion_minutos: template.duration_minutes ?? "",
    ejercicios: template.exercises.map((exercise) => ({
      nombre: exercise.name ?? "Sin nombre",
      musculo: exercise.muscle ?? "",
      source_id: exercise.catalog_link?.status === "linked" ? exercise.catalog_link.ref.sourceId : null,
      item_id: exercise.catalog_link?.status === "linked" ? exercise.catalog_link.ref.itemId : null,
      series: (exercise.series ?? []).map((series) => ({
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

const createRoutine: ToolHandler = async (args, context, dependencies) => {
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
  visit(args.data);
  const resolved = context.resolveExerciseCatalogIds && referencedIds.size > 0
    ? await context.resolveExerciseCatalogIds([...referencedIds])
    : [];
  const repository = [...(context.exercisesRepo ?? [])];
  const known = new Set(repository.map((entry) => `${entry.sourceId}:${entry.id}`));
  for (const entry of resolved) {
    const key = `${entry.sourceId}:${entry.id}`;
    if (!known.has(key)) repository.push(entry);
  }
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
  read_meal_foods: readMealFoods,
  search_foods: searchFoods,
  add_meal_food: addMealFood,
  search_exercises: searchExercises,
  read_routines: readRoutines,
  create_routine: createRoutine,
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
