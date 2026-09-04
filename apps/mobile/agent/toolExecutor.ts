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
import type { ToolOperationExecutionOutcome } from "./toolOperationLedger";
import { findByCatalogRef, matchExerciseCatalog, matchFoodCatalog } from "../catalogs/matching";
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

export type ToolExerciseSeries = {
  id: string;
  type?: string;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
  tempo_contraction?: string;
  tempo_pause?: string;
  tempo_relaxation?: string;
  sub_series?: unknown[];
};

export type ToolWorkoutTemplate = {
  id: string;
  name: string;
  category?: string;
  icon?: string;
  duration_minutes?: string;
  exercises: Array<{
    id: string;
    name?: string;
    image_uri?: string | null;
    sets: number[];
    series?: ToolExerciseSeries[];
    muscle?: string;
    catalog_link?: CatalogLink;
  }>;
};

export type ToolStore = {
  templates: ToolWorkoutTemplate[];
  dietByDate: Record<string, ToolDietDay>;
  measurements: ToolMeasurement[];
};

export type ToolFoodRepoEntry = FoodCatalogEntry;

export type ToolExerciseRepoEntry = ExerciseCatalogEntry;

export type ToolExecutionContext = {
  setStore?: (updater: (previous: ToolStore) => ToolStore) => void;
  commitStore?: (updater: (previous: ToolStore) => ToolStore) => Promise<void>;
  store?: ToolStore;
  foodsRepo?: ToolFoodRepoEntry[];
  exercisesRepo?: ToolExerciseRepoEntry[];
  foodCatalogAvailability?: CatalogSearchAvailability;
  exerciseCatalogAvailability?: CatalogSearchAvailability;
  operationId?: string;
  markEffectCommitted?: () => void;
};

import {
  describeOutcomeForModel,
  sanitizeFeedbackDraft,
  type FeedbackIssueDraft,
  type FeedbackIssueOutcome,
} from "./feedbackIssues";

export type ToolExecutorDependencies = {
  loadPersonalData: () => Promise<PersonalDataField[]>;
  savePersonalData: (fields: PersonalDataField[]) => Promise<void>;
  loadMeasurements: () => Promise<ToolMeasurement[]>;
  createId: (prefix: string) => string;
  getExerciseImageUrl: (exercise: ToolExerciseRepoEntry, sex: "male" | "female") => string;
  /**
   * Envía la incidencia y devuelve el resultado REAL. A diferencia de la
   * dependencia que sustituye, no puede devolver `void`: si no hay número de
   * issue, no hay éxito que comunicar.
   */
  submitFeedbackIssue: (draft: FeedbackIssueDraft) => Promise<FeedbackIssueOutcome>;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  dependencies: ToolExecutorDependencies,
) => Promise<string>;

/** Deshace el envoltorio JSON del argumento; la validación la hace sanitizePersonalDataFields. */
function parsePersonalDataInput(input: unknown): unknown {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return [];
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
  const fields = sanitizePersonalDataFields(parsed);
  const discarded = countDiscardedPersonalDataFields(parsed);
  await dependencies.savePersonalData(fields);
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
  const key = (args.key as string) ?? "";
  const fields = await dependencies.loadPersonalData();
  const field = fields.find((item) => item.key === key);
  if (!field) return `Campo "${key}" no encontrado.`;
  return field.description || "(sin descripcion)";
};

const readFieldValue: ToolHandler = async (args, _context, dependencies) => {
  const key = (args.key as string) ?? "";
  const fields = await dependencies.loadPersonalData();
  const field = fields.find((item) => item.key === key);
  if (!field) return `Campo "${key}" no encontrado.`;
  return field.value || "(sin valor)";
};

const readMeasurement: ToolHandler = async (args, _context, dependencies) => {
  const dateResult = validateMeasurementDate(args.date);
  if (!dateResult.ok) return formatMeasurementIssues(dateResult.issues);
  const measurements = await dependencies.loadMeasurements();
  if (measurementDuplicateDates(measurements).includes(dateResult.value)) {
    return `Hay varias mediciones para ${dateResult.value}. Revísalas desde el historial para decidir cuál conservar.`;
  }
  const match = measurements.find((measurement) => measurement.measured_on === dateResult.value);
  if (!match) return `No hay registro de medidas para la fecha "${dateResult.value}".`;
  const { id: _id, photo_uri: _photoUri, measured_at: _measuredAt, ...data } = match;
  return JSON.stringify(data);
};

const writeMeasurement: ToolHandler = async (args, context, dependencies) => {
  const dateResult = validateMeasurementDate(args.date);
  if (!dateResult.ok) return formatMeasurementIssues(dateResult.issues);
  const patchResult = parseMeasurementToolPatch(args.data, args.clear_fields);
  if (!patchResult.ok) return formatMeasurementIssues(patchResult.issues);
  if (!context.commitStore) return "No se pudo acceder al almacenamiento durable.";

  const measurementId = context.operationId
    ? `measurement_op_${context.operationId.slice(0, 24)}`
    : dependencies.createId("measurement");
  let mutationError: string | null = null;
  let successMessage = `Medidas guardadas correctamente para ${dateResult.value}.`;
  await context.commitStore((previous) => {
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
    return { ...previous, measurements: result.measurements };
  });
  if (mutationError) {
    return `No se guardaron las medidas. ${mutationError}`;
  }
  context.markEffectCommitted?.();
  return successMessage;
};

const readMealFoods: ToolHandler = async (args, context) => {
  const date = (args.date as string) ?? "";
  if (!date) return "No se proporcionó una fecha.";
  const mealResult = resolveDietMealCategory(args.meal);
  if (!mealResult.ok) return formatNutritionValidationIssues(mealResult.issues);
  const meal = mealResult.value;
  if (!context.store) return "No se pudo acceder a los datos de dieta.";
  const day = context.store.dietByDate[date];
  if (!day) return `No hay datos de dieta para la fecha "${date}".`;
  const matchingMeal = day.meals.find((item) => item.title.toLowerCase() === meal.toLowerCase());
  if (!matchingMeal) return `No se encontró la comida "${meal}" para la fecha "${date}".`;
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
  if (!date) return "No se proporcionó una fecha.";
  const mealResult = resolveDietMealCategory(args.meal);
  if (!mealResult.ok) return formatNutritionValidationIssues(mealResult.issues);
  const meal = mealResult.value;
  if (!context.commitStore && !context.setStore) {
    return "No se pudo acceder al almacenamiento.";
  }
  const parsed = parseObjectArgument(
    args.data,
    "El JSON del alimento no es válido.",
    "No se proporcionaron datos del alimento.",
  );
  if (parsed.error || !parsed.value) return parsed.error ?? "No se proporcionaron datos del alimento.";
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
      return JSON.stringify({ status: "not_found", source_id: sourceId, item_id: itemId, written: false });
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
      return JSON.stringify({
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
    return `No se añadió el alimento. ${formatNutritionValidationIssues(validation.issues)}`;
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
      return previous;
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
    };
  };
  if (context.commitStore) {
    await context.commitStore(updateStore);
  } else {
    context.setStore?.(updateStore);
  }
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
  if (maxCalories != null) results = results.filter((food) => food.calories_per_100g <= maxCalories);
  if (minProtein != null) results = results.filter((food) => food.protein_per_100g >= minProtein);
  if (maxProtein != null) results = results.filter((food) => food.protein_per_100g <= maxProtein);
  if (minCarbs != null) results = results.filter((food) => food.carbs_per_100g >= minCarbs);
  if (maxCarbs != null) results = results.filter((food) => food.carbs_per_100g <= maxCarbs);
  if (minFat != null) results = results.filter((food) => food.fat_per_100g >= minFat);
  if (maxFat != null) results = results.filter((food) => food.fat_per_100g <= maxFat);

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
  if (!context.exercisesRepo || context.exercisesRepo.length === 0) {
    return serializeCatalogSearch(context.exerciseCatalogAvailability, []);
  }
  const query = (args.query as string) ?? "";
  const muscleGroup = (args.muscle_group as string) ?? "";
  const secondaryMuscle = (args.secondary_muscle as string) ?? "";
  const equipment = (args.equipment as string) ?? "";
  const difficulty = (args.difficulty as string) ?? "";
  let results = [...context.exercisesRepo];

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
  return serializeCatalogSearch(context.exerciseCatalogAvailability, results.map((exercise) => ({
    source_id: exercise.sourceId,
    item_id: exercise.id,
    nombre: exercise.name,
    musculo_principal: exercise.muscle_group,
    musculos_secundarios: exercise.secondary_muscles,
    equipamiento: exercise.equipment,
    dificultad: exercise.difficulty,
    instrucciones: exercise.instructions,
  })));
};

const readRoutines: ToolHandler = async (_args, context) => {
  if (!context.store) return "No se pudo acceder a los datos de rutinas.";
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
  if (!context.commitStore && !context.setStore) {
    return "No se pudo acceder al almacenamiento.";
  }
  const parsed = parseObjectArgument(
    args.data,
    "El JSON de la rutina no es válido.",
    "No se proporcionaron datos de la rutina.",
  );
  if (parsed.error || !parsed.value) return parsed.error ?? "No se proporcionaron datos de la rutina.";
  const data = parsed.value;
  const routineName = (data.name as string) ?? "Rutina";
  const category = (data.category as string) ?? "hypertrophy";
  const icon = (data.icon as string) ?? "activity";
  const exercisesData = (data.exercises as Array<Record<string, unknown>>) ?? [];
  if (exercisesData.length === 0) return "La rutina debe tener al menos un ejercicio.";
  const repository = context.exercisesRepo ?? [];
  const operationSuffix = context.operationId?.slice(0, 24);
  const resolvedExercises: Array<{
    input: Record<string, unknown>;
    candidate: ToolExerciseRepoEntry | null;
    catalogLink: CatalogLink;
    name: string;
    muscle: string;
  }> = [];
  for (const exercise of exercisesData) {
    const kind = typeof exercise.kind === "string" ? exercise.kind : "legacy";
    if (kind === "custom") {
      resolvedExercises.push({
        input: exercise,
        candidate: null,
        catalogLink: unresolvedCatalog("manual"),
        name: typeof exercise.name === "string" && exercise.name.trim() ? exercise.name.trim() : "Ejercicio",
        muscle: typeof exercise.muscle === "string" ? exercise.muscle : "",
      });
      continue;
    }
    if (kind === "catalog") {
      const sourceId = typeof exercise.source_id === "string" ? exercise.source_id : "";
      const itemId = typeof exercise.item_id === "string" ? exercise.item_id : "";
      const candidate = sourceId && itemId
        ? findByCatalogRef(repository, catalogRef(sourceId as ExerciseCatalogEntry["sourceId"], itemId))
        : null;
      if (!candidate) {
        return JSON.stringify({ status: "not_found", written: false, source_id: sourceId, item_id: itemId });
      }
      resolvedExercises.push({
        input: exercise,
        candidate,
        catalogLink: linkedCatalog(catalogRef(candidate.sourceId, candidate.id), "tool"),
        name: candidate.name,
        muscle: candidate.muscle_group,
      });
      continue;
    }

    const requestedName = typeof exercise.name === "string" ? exercise.name : "";
    const match = matchExerciseCatalog(repository, requestedName);
    if (match.kind === "ambiguous") {
      return JSON.stringify({
        status: "ambiguous",
        written: false,
        exercise_name: requestedName,
        candidates: match.candidates.map((candidate) => ({
          source_id: candidate.sourceId,
          item_id: candidate.id,
          name: candidate.name,
        })),
      });
    }
    if (match.kind === "not_found") {
      return JSON.stringify({ status: "not_found", written: false, exercise_name: requestedName });
    }
    resolvedExercises.push({
      input: exercise,
      candidate: match.candidate,
      catalogLink: linkedCatalog(
        catalogRef(match.candidate.sourceId, match.candidate.id),
        match.kind === "exact" ? "legacy_exact" : "legacy_alias",
      ),
      name: match.candidate.name,
      muscle: match.candidate.muscle_group,
    });
  }

  const templateExercises = resolvedExercises.map((resolved, exerciseIndex) => {
    const { input: exercise, candidate: repositoryMatch } = resolved;
    const seriesData = (exercise.series as Array<Record<string, unknown>>) ?? [];
    const series: ToolExerciseSeries[] = seriesData.map((item, seriesIndex) => ({
      id: operationSuffix
        ? `series_op_${operationSuffix}_${exerciseIndex}_${seriesIndex}`
        : dependencies.createId("series"),
      type: (item.type as string) ?? "normal",
      reps: String(item.reps ?? "10"),
      weight_kg: String(item.weight_kg ?? "0"),
      rest_seconds: String(item.rest_seconds ?? "60"),
    }));
    return {
      id: operationSuffix
        ? `exercise_op_${operationSuffix}_${exerciseIndex}`
        : dependencies.createId("exercise"),
      name: resolved.name,
      muscle: resolved.muscle,
      image_uri: repositoryMatch ? dependencies.getExerciseImageUrl(repositoryMatch, "male") : null,
      sets: series.map((_item, index) => index),
      series,
      catalog_link: resolved.catalogLink,
    };
  });
  const newTemplate: ToolWorkoutTemplate = {
    id: operationSuffix
      ? `template_op_${operationSuffix}`
      : dependencies.createId("template"),
    name: routineName,
    category,
    icon,
    exercises: templateExercises,
  };
  const updateStore = (previous: ToolStore): ToolStore => {
    if (previous.templates.some((template) => template.id === newTemplate.id)) {
      return previous;
    }
    return {
      ...previous,
      templates: [...previous.templates, newTemplate],
    };
  };
  if (context.commitStore) {
    await context.commitStore(updateStore);
  } else {
    context.setStore?.(updateStore);
  }
  context.markEffectCommitted?.();
  const exerciseSummary = templateExercises
    .map((exercise) => `${exercise.name} (${exercise.series.length} series)`)
    .join(", ");
  return `Rutina "${routineName}" creada con ${templateExercises.length} ejercicios: ${exerciseSummary}.`;
};

const createFeatureIssue: ToolHandler = async (args, _context, dependencies) => {
  const draft = sanitizeFeedbackDraft({
    kind: "feature",
    title: typeof args.title === "string" ? args.title : "",
    summary: typeof args.summary === "string" ? args.summary : "",
  });
  if (!draft) return "Falta el título o el resumen de la mejora.";
  const outcome = await dependencies.submitFeedbackIssue(draft);
  if (outcome.status === "created") _context.markEffectCommitted?.();
  return describeOutcomeForModel(outcome);
};

export const AGENT_TOOL_HANDLERS: Record<string, ToolHandler> = {
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
};

export const AGENT_TOOL_HANDLER_NAMES = Object.keys(AGENT_TOOL_HANDLERS);

export function createDetailedAgentToolExecutor(dependencies: ToolExecutorDependencies) {
  return async function executeDetailedAgentTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {},
  ): Promise<ToolOperationExecutionOutcome> {
    const handler = AGENT_TOOL_HANDLERS[name];
    if (!handler) {
      return { output: "Herramienta no reconocida.", status: "no_effect" };
    }
    let effectCommitted = false;
    try {
      const output = await handler(
        args,
        {
          ...context,
          markEffectCommitted: () => {
            effectCommitted = true;
            context.markEffectCommitted?.();
          },
        },
        dependencies,
      );
      return {
        output,
        status: effectCommitted ? "committed" : "no_effect",
      };
    } catch {
      // Sin este catch, una excepción de cualquier handler sube por
      // providerToolLoop y aborta el turno entero del chat. Con una tool que
      // hace red eso pasa de teórico a probable.
      return {
        output: "La herramienta ha fallado. Informa al usuario de que no se ha completado.",
        status: effectCommitted ? "committed" : "failed_before_commit",
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
