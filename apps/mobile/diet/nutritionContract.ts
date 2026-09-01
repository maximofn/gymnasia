export const DIET_MEAL_CATEGORIES = [
  "Desayuno",
  "Almuerzo",
  "Comida",
  "Merienda",
  "Cena",
] as const;

export type DietMealCategory = (typeof DIET_MEAL_CATEGORIES)[number];

export const NUTRITION_FOOD_TYPES = [
  "producto_comercial",
  "receta",
  "alimento",
] as const;

export type NutritionFoodType = (typeof NUTRITION_FOOD_TYPES)[number];
export type NutritionMacroKey = "protein" | "carbs" | "fat";
export type DietMacroMode = "manual_calories" | "protein_by_weight";

export type NutritionValidationIssue = {
  field: string;
  code:
    | "required"
    | "invalid_type"
    | "not_finite"
    | "negative"
    | "not_positive"
    | "unknown_value";
  message: string;
};

export type NutritionValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; value: null; issues: NutritionValidationIssue[] };

export type ValidatedNutritionItem = {
  name: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type ValidatedStructuredNutrition = ValidatedNutritionItem & {
  food_type: NutritionFoodType;
};

export type DietPlanInput = {
  daily_calories: unknown;
  macro_mode: DietMacroMode;
  manual_macro_calories: {
    carbs: unknown;
    protein: unknown;
    fat: unknown;
  };
  protein_grams_per_kg: unknown;
  carbs_grams_per_kg: unknown;
  fat_grams_per_kg: unknown;
};

export type DietPlanEvaluation = {
  issues: NutritionValidationIssue[];
  dailyCaloriesTarget: number | null;
  macroCalories: Record<NutritionMacroKey, number>;
  macroGrams: Record<NutritionMacroKey, number>;
  assignedCalories: number;
  remainingCalories: number;
  excessCalories: number;
  budgetStatus: "unconfigured" | "valid" | "exceeded";
};

const NUTRITION_NUMBER_FIELDS = [
  ["grams", "Los gramos"],
  ["calories_kcal", "Las calorías"],
  ["protein_g", "Las proteínas"],
  ["carbs_g", "Los carbohidratos"],
  ["fat_g", "Las grasas"],
] as const;

const GKG_FIELD_BY_MACRO: Record<NutritionMacroKey, keyof DietPlanInput> = {
  protein: "protein_grams_per_kg",
  carbs: "carbs_grams_per_kg",
  fat: "fat_grams_per_kg",
};

const CALORIES_PER_GRAM: Record<NutritionMacroKey, number> = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

function failed<T>(issues: NutritionValidationIssue[]): NutritionValidationResult<T> {
  return { ok: false, value: null, issues };
}

function succeeded<T>(value: T): NutritionValidationResult<T> {
  return { ok: true, value, issues: [] };
}

function normalizeCategoryText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function resolveDietMealCategory(
  rawValue: unknown,
): NutritionValidationResult<DietMealCategory> {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return failed([{
      field: "meal",
      code: "required",
      message: "Selecciona una comida: Desayuno, Almuerzo, Comida, Merienda o Cena.",
    }]);
  }

  const normalized = normalizeCategoryText(rawValue);
  const category = DIET_MEAL_CATEGORIES.find(
    (candidate) => normalizeCategoryText(candidate) === normalized,
  );
  if (!category) {
    return failed([{
      field: "meal",
      code: "unknown_value",
      message: `La comida “${rawValue.trim()}” no es una categoría reconocida.`,
    }]);
  }
  return succeeded(category);
}

function validateNutritionNumber(
  field: string,
  label: string,
  value: unknown,
  issues: NutritionValidationIssue[],
): number | null {
  if (typeof value !== "number") {
    issues.push({
      field,
      code: "invalid_type",
      message: `${label} deben ser un número.`,
    });
    return null;
  }
  if (!Number.isFinite(value)) {
    issues.push({
      field,
      code: "not_finite",
      message: `${label} deben ser un número finito.`,
    });
    return null;
  }
  if (value < 0) {
    issues.push({
      field,
      code: "negative",
      message: `${label} deben ser 0 o más.`,
    });
    return null;
  }
  return value;
}

export function validateNutritionItem(
  rawValue: unknown,
): NutritionValidationResult<ValidatedNutritionItem> {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return failed([{
      field: "item",
      code: "invalid_type",
      message: "Los datos del alimento deben formar un objeto.",
    }]);
  }

  const value = rawValue as Record<string, unknown>;
  const issues: NutritionValidationIssue[] = [];
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) {
    issues.push({
      field: "name",
      code: "required",
      message: "Escribe el nombre del alimento.",
    });
  }

  const parsedNumbers = Object.fromEntries(
    NUTRITION_NUMBER_FIELDS.map(([field, label]) => [
      field,
      validateNutritionNumber(field, label, value[field], issues),
    ]),
  ) as Record<(typeof NUTRITION_NUMBER_FIELDS)[number][0], number | null>;

  if (issues.length > 0) return failed(issues);
  return succeeded({
    name,
    grams: parsedNumbers.grams as number,
    calories_kcal: parsedNumbers.calories_kcal as number,
    protein_g: parsedNumbers.protein_g as number,
    carbs_g: parsedNumbers.carbs_g as number,
    fat_g: parsedNumbers.fat_g as number,
  });
}

function parseFormNumber(
  field: string,
  label: string,
  rawValue: unknown,
  issues: NutritionValidationIssue[],
): number | null {
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    issues.push({
      field,
      code: "invalid_type",
      message: `${label} deben ser un número.`,
    });
    return null;
  }
  const normalized = typeof rawValue === "string"
    ? rawValue.trim().replace(",", ".")
    : `${rawValue}`;
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return validateNutritionNumber(field, label, parsed, issues);
}

export function validateNutritionFormInput(rawValue: {
  name: unknown;
  grams: unknown;
  calories_kcal: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
}): NutritionValidationResult<ValidatedNutritionItem> {
  const issues: NutritionValidationIssue[] = [];
  const name = typeof rawValue.name === "string" ? rawValue.name.trim() : "";
  if (!name) {
    issues.push({
      field: "name",
      code: "required",
      message: "Escribe el nombre del alimento.",
    });
  }

  const parsedNumbers = Object.fromEntries(
    NUTRITION_NUMBER_FIELDS.map(([field, label]) => [
      field,
      parseFormNumber(field, label, rawValue[field], issues),
    ]),
  ) as Record<(typeof NUTRITION_NUMBER_FIELDS)[number][0], number | null>;

  if (issues.length > 0) return failed(issues);
  return succeeded({
    name,
    grams: parsedNumbers.grams as number,
    calories_kcal: parsedNumbers.calories_kcal as number,
    protein_g: parsedNumbers.protein_g as number,
    carbs_g: parsedNumbers.carbs_g as number,
    fat_g: parsedNumbers.fat_g as number,
  });
}

export function validateStructuredNutrition(
  rawValue: unknown,
): NutritionValidationResult<ValidatedStructuredNutrition> {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return failed([{
      field: "item",
      code: "invalid_type",
      message: "La estimación nutricional debe formar un objeto.",
    }]);
  }

  const value = rawValue as Record<string, unknown>;
  const itemResult = validateNutritionItem({
    name: value.dish_name,
    grams: value.grams,
    calories_kcal: value.calories_kcal,
    protein_g: value.protein_g,
    carbs_g: value.carbs_g,
    fat_g: value.fat_g,
  });
  const issues = itemResult.ok ? [] : [...itemResult.issues];
  const foodType = typeof value.food_type === "string"
    ? NUTRITION_FOOD_TYPES.find((candidate) => candidate === value.food_type)
    : undefined;
  if (!foodType) {
    issues.push({
      field: "food_type",
      code: value.food_type === undefined || value.food_type === null ? "required" : "unknown_value",
      message: "El tipo debe ser alimento, producto_comercial o receta.",
    });
  }
  if (issues.length > 0 || !itemResult.ok || !foodType) return failed(issues);
  return succeeded({ ...itemResult.value, food_type: foodType });
}

function parseDietPlanNumber(
  field: string,
  label: string,
  rawValue: unknown,
  issues: NutritionValidationIssue[],
  options: { emptyValue: number | null; positive?: boolean },
): number | null {
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    issues.push({
      field,
      code: "invalid_type",
      message: `${label} debe ser un número.`,
    });
    return null;
  }
  const normalized = typeof rawValue === "string"
    ? rawValue.trim().replace(",", ".")
    : `${rawValue}`;
  if (!normalized) return options.emptyValue;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    issues.push({
      field,
      code: "not_finite",
      message: `${label} debe ser un número finito.`,
    });
    return null;
  }
  if (options.positive ? parsed <= 0 : parsed < 0) {
    issues.push({
      field,
      code: options.positive ? "not_positive" : "negative",
      message: options.positive
        ? `${label} debe ser mayor que 0.`
        : `${label} debe ser 0 o más.`,
    });
    return null;
  }
  return parsed;
}

export function evaluateDietPlan(
  input: DietPlanInput,
  bodyWeightKg: number | null,
): DietPlanEvaluation {
  const issues: NutritionValidationIssue[] = [];
  const dailyCaloriesTarget = parseDietPlanNumber(
    "daily_calories",
    "El objetivo diario",
    input.daily_calories,
    issues,
    { emptyValue: null, positive: true },
  );
  const macroCalories: Record<NutritionMacroKey, number> = {
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  const macroGrams: Record<NutritionMacroKey, number> = {
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  (["protein", "carbs", "fat"] as NutritionMacroKey[]).forEach((macro) => {
    const calories = parseDietPlanNumber(
      `manual_macro_calories.${macro}`,
      macro === "protein" ? "Las calorías de proteínas" : macro === "carbs" ? "Las calorías de carbohidratos" : "Las calorías de grasas",
      input.manual_macro_calories[macro],
      issues,
      { emptyValue: 0 },
    );
    const field = GKG_FIELD_BY_MACRO[macro];
    const gramsPerKg = parseDietPlanNumber(
      field,
      macro === "protein" ? "Las proteínas por kg" : macro === "carbs" ? "Los carbohidratos por kg" : "Las grasas por kg",
      input[field],
      issues,
      { emptyValue: 0 },
    );

    if (input.macro_mode === "manual_calories") {
      if (calories !== null) {
        macroCalories[macro] = calories;
        macroGrams[macro] = calories / CALORIES_PER_GRAM[macro];
      }
      return;
    }

    if (
      gramsPerKg !== null
      && bodyWeightKg !== null
      && Number.isFinite(bodyWeightKg)
      && bodyWeightKg > 0
    ) {
      macroGrams[macro] = gramsPerKg * bodyWeightKg;
      macroCalories[macro] = macroGrams[macro] * CALORIES_PER_GRAM[macro];
    }
  });

  const assignedCalories = Object.values(macroCalories).reduce((sum, value) => sum + value, 0);
  const comparableTarget = dailyCaloriesTarget ?? 0;
  const excessCalories = dailyCaloriesTarget === null
    ? 0
    : Math.max(0, assignedCalories - comparableTarget);
  const remainingCalories = dailyCaloriesTarget === null
    ? 0
    : Math.max(0, comparableTarget - assignedCalories);
  const budgetStatus = dailyCaloriesTarget === null
    ? "unconfigured"
    : excessCalories > 0
      ? "exceeded"
      : "valid";

  return {
    issues,
    dailyCaloriesTarget,
    macroCalories,
    macroGrams,
    assignedCalories,
    remainingCalories,
    excessCalories,
    budgetStatus,
  };
}

export function formatNutritionValidationIssues(
  issues: NutritionValidationIssue[],
): string {
  return issues.map((issue) => issue.message).join(" ");
}
