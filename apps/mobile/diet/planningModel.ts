import {
  GKG_MACRO_KEYS,
  gkgMacroCaloriesPerGram,
  parseNonNegativeNumberInput,
  type DietSettings,
  type GkgMacroKey,
} from "./model";
import {
  evaluateDietPlan,
  type DietPlanEvaluation,
  type NutritionValidationIssue,
} from "./nutritionContract";

export type DietPlanningModel = {
  savedEvaluation: DietPlanEvaluation;
  draftEvaluation: DietPlanEvaluation;
  dailyCaloriesTarget: number;
  draftDailyCaloriesTarget: number;
  issueByField: ReadonlyMap<string, NutritionValidationIssue>;
  proteinMaxGramsPerKgHint: number | null;
  carbsMaxGramsPerKgHint: number | null;
  fatMaxGramsPerKgHint: number | null;
  configuredMacroCaloriesTotal: number;
  configuredMacroCaloriesRemaining: number;
  configuredMacroCaloriesExcess: number;
  draftProteinTargetGrams: number;
  draftCarbsTargetGrams: number;
  draftFatTargetGrams: number;
  autocomplete: {
    enabled: boolean;
    macro: GkgMacroKey | null;
    gramsPerKgText: string | null;
  };
};

export function buildDietPlanningModel(
  saved: DietSettings,
  draft: DietSettings,
  bodyWeightKg: number | null,
): DietPlanningModel {
  const savedEvaluation = evaluateDietPlan(saved, bodyWeightKg);
  const draftEvaluation = evaluateDietPlan(draft, bodyWeightKg);
  const dailyCaloriesTarget = savedEvaluation.dailyCaloriesTarget ?? 0;
  const draftDailyCaloriesTarget = draftEvaluation.dailyCaloriesTarget ?? 0;
  const macroTargets: Record<GkgMacroKey, number> = {
    protein: parseNonNegativeNumberInput(draft.protein_grams_per_kg) ?? 0,
    carbs: parseNonNegativeNumberInput(draft.carbs_grams_per_kg) ?? 0,
    fat: parseNonNegativeNumberInput(draft.fat_grams_per_kg) ?? 0,
  };
  const macroCalories = {
    protein: (bodyWeightKg ?? 0) * macroTargets.protein * 4,
    carbs: (bodyWeightKg ?? 0) * macroTargets.carbs * 4,
    fat: (bodyWeightKg ?? 0) * macroTargets.fat * 9,
  };
  const hasBodyWeight = bodyWeightKg !== null
    && Number.isFinite(bodyWeightKg)
    && bodyWeightKg > 0;
  const configuredCount = GKG_MACRO_KEYS.filter((macro) => macroTargets[macro] > 0).length;
  const autocompleteMacro = configuredCount === 2
    ? GKG_MACRO_KEYS.find((macro) => macroTargets[macro] <= 0) ?? null
    : null;
  const canAutocomplete = autocompleteMacro !== null
    && hasBodyWeight
    && draftDailyCaloriesTarget > 0;
  const autocompleteValue = canAutocomplete && autocompleteMacro
    ? Math.max(
        0,
        (draftDailyCaloriesTarget - GKG_MACRO_KEYS.reduce((total, macro) => {
          if (macro === autocompleteMacro) return total;
          return total
            + macroTargets[macro]
              * (bodyWeightKg ?? 0)
              * gkgMacroCaloriesPerGram(macro);
        }, 0))
          / (gkgMacroCaloriesPerGram(autocompleteMacro) * (bodyWeightKg ?? 1)),
      )
    : null;
  const hasConfiguredMacro = GKG_MACRO_KEYS.some((macro) => macroTargets[macro] > 0);
  const showMaximumHints = hasBodyWeight
    && draftDailyCaloriesTarget > 0
    && hasConfiguredMacro;
  const safeWeight = bodyWeightKg ?? 1;

  return {
    savedEvaluation,
    draftEvaluation,
    dailyCaloriesTarget,
    draftDailyCaloriesTarget,
    issueByField: new Map(draftEvaluation.issues.map((issue) => [issue.field, issue])),
    proteinMaxGramsPerKgHint: showMaximumHints
      ? Math.max(0, (draftDailyCaloriesTarget - (macroCalories.carbs + macroCalories.fat)) / 4)
        / safeWeight
      : null,
    carbsMaxGramsPerKgHint: showMaximumHints
      ? Math.max(0, (draftDailyCaloriesTarget - (macroCalories.protein + macroCalories.fat)) / 4)
        / safeWeight
      : null,
    fatMaxGramsPerKgHint: showMaximumHints
      ? Math.max(0, (draftDailyCaloriesTarget - (macroCalories.protein + macroCalories.carbs)) / 9)
        / safeWeight
      : null,
    configuredMacroCaloriesTotal: draftEvaluation.assignedCalories,
    configuredMacroCaloriesRemaining: draftEvaluation.remainingCalories,
    configuredMacroCaloriesExcess: draftEvaluation.excessCalories,
    draftProteinTargetGrams: draftEvaluation.macroGrams.protein,
    draftCarbsTargetGrams: draftEvaluation.macroGrams.carbs,
    draftFatTargetGrams: draftEvaluation.macroGrams.fat,
    autocomplete: {
      enabled: canAutocomplete,
      macro: autocompleteMacro,
      gramsPerKgText: autocompleteValue !== null && Number.isFinite(autocompleteValue)
        ? autocompleteValue.toFixed(2).replace(/\.?0+$/, "")
        : null,
    },
  };
}
