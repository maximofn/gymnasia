import {
  countDiscardedPersonalDataFields,
  sanitizePersonalDataFields,
  type PersonalDataField,
} from "./personalData";

export type { PersonalDataField };

export type ToolMeasurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_uri: string | null;
  neck_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  biceps_cm: number | null;
  quadriceps_cm: number | null;
  calf_cm: number | null;
  height_cm: number | null;
};

export type ToolDietItem = {
  id: string;
  title: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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
  }>;
};

export type ToolStore = {
  templates: ToolWorkoutTemplate[];
  dietByDate: Record<string, ToolDietDay>;
  measurements: ToolMeasurement[];
};

export type ToolFoodRepoEntry = {
  id: string;
  name: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  serving_size_g: number;
  serving_description: string;
  source?: string;
};

export type ToolExerciseRepoEntry = {
  id: string;
  name: string;
  image_male: string;
  image_female: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string;
  instructions: string;
};

export type ToolExecutionContext = {
  setStore?: (updater: (previous: ToolStore) => ToolStore) => void;
  store?: ToolStore;
  foodsRepo?: ToolFoodRepoEntry[];
  exercisesRepo?: ToolExerciseRepoEntry[];
};

export type ToolExecutorDependencies = {
  loadPersonalData: () => Promise<PersonalDataField[]>;
  savePersonalData: (fields: PersonalDataField[]) => Promise<void>;
  loadMeasurements: () => Promise<ToolMeasurement[]>;
  saveMeasurements: (measurements: ToolMeasurement[]) => Promise<void>;
  sortMeasurements: (measurements: ToolMeasurement[]) => ToolMeasurement[];
  createId: (prefix: string) => string;
  getExerciseImageUrl: (exercise: ToolExerciseRepoEntry, sex: "male" | "female") => string;
  createFeatureIssue: (input: {
    title_summary: string;
    conversation_excerpt: string;
    interpretation: string;
  }) => Promise<void>;
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
  const date = (args.date as string) ?? "";
  if (!date) return "No se proporcionó una fecha.";
  const measurements = await dependencies.loadMeasurements();
  const match = measurements.find((measurement) => measurement.measured_at.startsWith(date));
  if (!match) return `No hay registro de medidas para la fecha "${date}".`;
  const { id: _id, photo_uri: _photoUri, ...data } = match;
  return JSON.stringify(data);
};

const writeMeasurement: ToolHandler = async (args, context, dependencies) => {
  const date = (args.date as string) ?? "";
  if (!date) return "No se proporcionó una fecha.";
  const parsed = parseObjectArgument(
    args.data,
    "El JSON de medidas no es válido.",
    "No se proporcionaron medidas.",
  );
  if (parsed.error || !parsed.value) return parsed.error ?? "No se proporcionaron medidas.";
  const data = parsed.value;
  const measurements = await dependencies.loadMeasurements();
  const existingIndex = measurements.findIndex((measurement) => measurement.measured_at.startsWith(date));
  const existing = existingIndex >= 0 ? measurements[existingIndex] : null;
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  const measurement: ToolMeasurement = {
    id: existing?.id ?? dependencies.createId("measurement"),
    measured_at: existing?.measured_at ?? new Date(`${date}T12:00:00`).toISOString(),
    weight_kg: data.weight_kg !== undefined ? toNumber(data.weight_kg) : (existing?.weight_kg ?? null),
    body_fat_pct: data.body_fat_pct !== undefined ? toNumber(data.body_fat_pct) : (existing?.body_fat_pct ?? null),
    photo_uri: existing?.photo_uri ?? null,
    neck_cm: data.neck_cm !== undefined ? toNumber(data.neck_cm) : (existing?.neck_cm ?? null),
    chest_cm: data.chest_cm !== undefined ? toNumber(data.chest_cm) : (existing?.chest_cm ?? null),
    waist_cm: data.waist_cm !== undefined ? toNumber(data.waist_cm) : (existing?.waist_cm ?? null),
    hips_cm: data.hips_cm !== undefined ? toNumber(data.hips_cm) : (existing?.hips_cm ?? null),
    biceps_cm: data.biceps_cm !== undefined ? toNumber(data.biceps_cm) : (existing?.biceps_cm ?? null),
    quadriceps_cm: data.quadriceps_cm !== undefined ? toNumber(data.quadriceps_cm) : (existing?.quadriceps_cm ?? null),
    calf_cm: data.calf_cm !== undefined ? toNumber(data.calf_cm) : (existing?.calf_cm ?? null),
    height_cm: data.height_cm !== undefined ? toNumber(data.height_cm) : (existing?.height_cm ?? null),
  };
  const base = existingIndex >= 0
    ? measurements.filter((_measurement, index) => index !== existingIndex)
    : measurements;
  const sorted = dependencies.sortMeasurements([measurement, ...base]).slice(0, 1826);
  await dependencies.saveMeasurements(sorted);
  context.setStore?.((previous) => ({ ...previous, measurements: sorted }));
  return `Medidas guardadas correctamente para ${date}.`;
};

const readMealFoods: ToolHandler = async (args, context) => {
  const date = (args.date as string) ?? "";
  const meal = (args.meal as string) ?? "";
  if (!date) return "No se proporcionó una fecha.";
  if (!meal) return "No se proporcionó una comida (Desayuno, Almuerzo, Comida, Merienda o Cena).";
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
  })));
};

const addMealFood: ToolHandler = async (args, context, dependencies) => {
  const date = (args.date as string) ?? "";
  const meal = (args.meal as string) ?? "";
  if (!date) return "No se proporcionó una fecha.";
  if (!meal) return "No se proporcionó una comida (Desayuno, Almuerzo, Comida, Merienda o Cena).";
  if (!context.setStore) return "No se pudo acceder al almacenamiento.";
  const parsed = parseObjectArgument(
    args.data,
    "El JSON del alimento no es válido.",
    "No se proporcionaron datos del alimento.",
  );
  if (parsed.error || !parsed.value) return parsed.error ?? "No se proporcionaron datos del alimento.";
  const data = parsed.value;
  const foodName = (data.name as string) ?? "Alimento";
  const grams = Number(data.grams) || 0;
  const caloriesKcal = Number(data.calories_kcal) || 0;
  const newItem: ToolDietItem = {
    id: dependencies.createId("food"),
    title: foodName,
    grams,
    calories_kcal: caloriesKcal,
    protein_g: Number(data.protein_g) || 0,
    carbs_g: Number(data.carbs_g) || 0,
    fat_g: Number(data.fat_g) || 0,
  };
  context.setStore((previous) => {
    const currentDay = previous.dietByDate[date] ?? { day_date: date, meals: [] };
    const existingMeal = currentDay.meals.find((item) => item.title.toLowerCase() === meal.toLowerCase());
    const mealCategories = ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena"];
    const updatedMeals = existingMeal
      ? currentDay.meals.map((item) => item.title.toLowerCase() === meal.toLowerCase()
        ? { ...item, items: [...item.items, newItem] }
        : item)
      : [...currentDay.meals, {
          id: dependencies.createId("meal"),
          title: meal,
          items: [newItem],
        }].sort((left, right) => mealCategories.indexOf(left.title) - mealCategories.indexOf(right.title));
    return {
      ...previous,
      dietByDate: {
        ...previous.dietByDate,
        [date]: { ...currentDay, meals: updatedMeals },
      },
    };
  });
  return `Alimento "${foodName}" (${grams}g, ${caloriesKcal} kcal) añadido a ${meal} del ${date}.`;
};

const searchFoods: ToolHandler = async (args, context) => {
  if (!context.foodsRepo || context.foodsRepo.length === 0) {
    return "La base de datos de alimentos no está cargada.";
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
    results = results.filter((food) => normalizeSearchText(food.source ?? "alimento") === needle);
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
  if (results.length === 0) return "No se encontraron alimentos con esos criterios.";
  return JSON.stringify(results.map((food) => ({
    id: food.id,
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
    return "La base de datos de ejercicios no está cargada.";
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
  if (results.length === 0) return "No se encontraron ejercicios con esos criterios.";
  return JSON.stringify(results.map((exercise) => ({
    id: exercise.id,
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
  if (!context.setStore) return "No se pudo acceder al almacenamiento.";
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
  const templateExercises = exercisesData.map((exercise) => {
    const exerciseName = (exercise.name as string) ?? "Ejercicio";
    const exerciseMuscle = (exercise.muscle as string) ?? "";
    const seriesData = (exercise.series as Array<Record<string, unknown>>) ?? [];
    const repositoryMatch = repository.find(
      (item) => item.name.toLowerCase() === exerciseName.toLowerCase(),
    );
    const series: ToolExerciseSeries[] = seriesData.map((item) => ({
      id: dependencies.createId("series"),
      type: (item.type as string) ?? "normal",
      reps: String(item.reps ?? "10"),
      weight_kg: String(item.weight_kg ?? "0"),
      rest_seconds: String(item.rest_seconds ?? "60"),
    }));
    return {
      id: dependencies.createId("exercise"),
      name: exerciseName,
      muscle: exerciseMuscle || (repositoryMatch?.muscle_group ?? ""),
      image_uri: repositoryMatch ? dependencies.getExerciseImageUrl(repositoryMatch, "male") : null,
      sets: series.map((_item, index) => index),
      series,
    };
  });
  const newTemplate: ToolWorkoutTemplate = {
    id: dependencies.createId("template"),
    name: routineName,
    category,
    icon,
    exercises: templateExercises,
  };
  context.setStore((previous) => ({
    ...previous,
    templates: [...previous.templates, newTemplate],
  }));
  const exerciseSummary = templateExercises
    .map((exercise) => `${exercise.name} (${exercise.series.length} series)`)
    .join(", ");
  return `Rutina "${routineName}" creada con ${templateExercises.length} ejercicios: ${exerciseSummary}.`;
};

const createFeatureIssue: ToolHandler = async (args, _context, dependencies) => {
  const titleSummary = (args.title_summary as string) ?? "";
  const conversationExcerpt = (args.conversation_excerpt as string) ?? "";
  const interpretation = (args.interpretation as string) ?? "";
  if (!titleSummary) return "Falta el título de la mejora.";
  await dependencies.createFeatureIssue({
    title_summary: titleSummary,
    conversation_excerpt: conversationExcerpt,
    interpretation,
  });
  return "Issue de mejora creada en GitHub correctamente.";
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

export function createAgentToolExecutor(dependencies: ToolExecutorDependencies) {
  return async function executeAgentTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {},
  ): Promise<string> {
    const handler = AGENT_TOOL_HANDLERS[name];
    if (!handler) return "Herramienta no reconocida.";
    return handler(args, context, dependencies);
  };
}
