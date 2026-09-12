import type { FoodCatalogEntry } from "../catalogs/types";
import {
  formatDietDayContext,
  formatDietDayHeader,
  sumDayCalories,
  sumDayMacroGrams,
  type DietDay,
  type DietMeal,
} from "./model";
import {
  DIET_MEAL_CATEGORIES,
  validateNutritionFormInput,
  type DietMealCategory,
  type NutritionValidationIssue,
} from "./nutritionContract";

export type DietMacroTarget = {
  protein: number;
  carbs: number;
  fat: number;
};

export type DietManualFields = Record<
  "name" | "grams" | "calories_kcal" | "protein_g" | "carbs_g" | "fat_g",
  string
>;

export type DietDailyPresentationModel = {
  dateLabel: string;
  dateContextLabel: string;
  caloriesConsumed: number;
  caloriesProgress: number;
  caloriesPercent: number;
  macroOverview: Array<{
    key: "protein" | "carbs" | "fat";
    label: string;
    consumed: number;
    total: number;
    accent: string;
  }>;
  meals: DietMeal[];
  foodSearchResults: FoodCatalogEntry[];
  selectedFoodPreview: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  nutritionIssues: ReadonlyMap<string, NutritionValidationIssue>;
  manualFields: DietManualFields;
};

export function buildDietDailyPresentationModel(input: {
  selectedDate: string;
  referenceDate: string;
  day: DietDay;
  dailyCaloriesTarget: number;
  macroTargets: DietMacroTarget;
  foods: readonly FoodCatalogEntry[];
  personalFoods: readonly FoodCatalogEntry[];
  foodSearch: string;
  selectedFood: FoodCatalogEntry | null;
  selectedGrams: string;
  nutritionIssues: readonly NutritionValidationIssue[];
  manualFields: DietManualFields;
}): DietDailyPresentationModel {
  const caloriesConsumed = sumDayCalories(input.day);
  const proteinConsumed = sumDayMacroGrams(input.day, "protein_g");
  const carbsConsumed = sumDayMacroGrams(input.day, "carbs_g");
  const fatConsumed = sumDayMacroGrams(input.day, "fat_g");
  const query = input.foodSearch.trim().toLowerCase();
  const foodSearchResults = query
    ? [...input.foods, ...input.personalFoods]
        .filter((food) => food.name.toLowerCase().includes(query))
        .slice(0, 8)
    : [];
  const selectedFoodValidation = input.selectedFood
    ? validateNutritionFormInput({
        name: input.selectedFood.name,
        grams: input.selectedGrams,
        calories_kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      })
    : null;
  const selectedFoodGrams = selectedFoodValidation?.ok
    ? selectedFoodValidation.value.grams
    : 0;
  const selectedFoodRatio = selectedFoodGrams / 100;

  return {
    dateLabel: formatDietDayHeader(input.selectedDate),
    dateContextLabel: formatDietDayContext(input.selectedDate, input.referenceDate),
    caloriesConsumed,
    caloriesProgress: input.dailyCaloriesTarget > 0
      ? caloriesConsumed / input.dailyCaloriesTarget
      : 0,
    caloriesPercent: input.dailyCaloriesTarget > 0
      ? Math.round(Math.min((caloriesConsumed / input.dailyCaloriesTarget) * 100, 999))
      : 0,
    macroOverview: [
      {
        key: "protein",
        label: "Proteína",
        consumed: proteinConsumed,
        total: input.macroTargets.protein,
        accent: "#B266FF",
      },
      {
        key: "carbs",
        label: "Carbos",
        consumed: carbsConsumed,
        total: input.macroTargets.carbs,
        accent: "#CBFF1A",
      },
      {
        key: "fat",
        label: "Grasa",
        consumed: fatConsumed,
        total: input.macroTargets.fat,
        accent: "#4D84FF",
      },
    ],
    meals: DIET_MEAL_CATEGORIES.map((category: DietMealCategory) => {
      const existing = input.day.meals.find((meal) => meal.title === category);
      return existing ?? {
        id: `meal_virtual_${input.selectedDate}_${category.toLowerCase()}`,
        title: category,
        items: [],
      };
    }),
    foodSearchResults,
    selectedFoodPreview: input.selectedFood
      ? {
          calories: Math.round(input.selectedFood.calories_per_100g * selectedFoodRatio),
          protein: Math.round(input.selectedFood.protein_per_100g * selectedFoodRatio * 10) / 10,
          carbs: Math.round(input.selectedFood.carbs_per_100g * selectedFoodRatio * 10) / 10,
          fat: Math.round(input.selectedFood.fat_per_100g * selectedFoodRatio * 10) / 10,
        }
      : null,
    nutritionIssues: new Map(input.nutritionIssues.map((issue) => [issue.field, issue])),
    manualFields: input.manualFields,
  };
}
