import { useCallback, useMemo, useRef } from "react";

import type { CatalogSearchAvailability, FoodCatalogEntry } from "../catalogs/types";
import type { DietItem, DietMeal } from "../diet/model";
import type { DietMealCategory, NutritionValidationIssue } from "../diet/nutritionContract";
import type { ScreenController } from "./types";

export type DietResolutionModel = {
  isAndroid: boolean;
  isWeb: boolean;
  copyDateCategory: DietMealCategory | null;
  copyDate: Date;
  copyDateText: string;
  ambiguityCandidates: FoodCatalogEntry[] | null;
  copyConfirmation: {
    category: DietMealCategory;
    sourceDate: string;
    items: DietItem[];
  } | null;
  selectedDate: string;
};

export type DietResolutionActions = {
  changeCopyDate(eventType: string, date?: Date): void;
  changeCopyDateText(value: string): void;
  continueCopyDate(category: DietMealCategory, sourceDate: string): void;
  closeCopyDate(): void;
  chooseFood(candidate: FoodCatalogEntry | null): void;
  closeAmbiguity(): void;
  confirmCopy(): void;
  closeCopyConfirmation(): void;
};

export function useDietResolutionController(
  input: DietResolutionModel & DietResolutionActions,
): ScreenController<
  DietResolutionModel,
  DietResolutionActions,
  "food-catalog-ambiguity" | "diet-copy-confirmation" | "diet-copy-date-picker"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<DietResolutionModel>(() => ({
    isAndroid: input.isAndroid,
    isWeb: input.isWeb,
    copyDateCategory: input.copyDateCategory,
    copyDate: input.copyDate,
    copyDateText: input.copyDateText,
    ambiguityCandidates: input.ambiguityCandidates,
    copyConfirmation: input.copyConfirmation,
    selectedDate: input.selectedDate,
  }), [
    input.ambiguityCandidates,
    input.copyConfirmation,
    input.copyDate,
    input.copyDateCategory,
    input.copyDateText,
    input.isAndroid,
    input.isWeb,
    input.selectedDate,
  ]);
  const actions = useMemo<DietResolutionActions>(() => ({
    changeCopyDate: (eventType, date) => inputRef.current.changeCopyDate(eventType, date),
    changeCopyDateText: (value) => inputRef.current.changeCopyDateText(value),
    continueCopyDate: (category, sourceDate) => inputRef.current.continueCopyDate(category, sourceDate),
    closeCopyDate: () => inputRef.current.closeCopyDate(),
    chooseFood: (candidate) => inputRef.current.chooseFood(candidate),
    closeAmbiguity: () => inputRef.current.closeAmbiguity(),
    confirmCopy: () => inputRef.current.confirmCopy(),
    closeCopyConfirmation: () => inputRef.current.closeCopyConfirmation(),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "food-catalog-ambiguity": input.ambiguityCandidates !== null,
      "diet-copy-confirmation": input.copyConfirmation !== null,
      "diet-copy-date-picker": input.copyDateCategory !== null,
    },
    handlers: {
      "food-catalog-ambiguity": () => {
        if (!inputRef.current.ambiguityCandidates) return false;
        inputRef.current.closeAmbiguity();
        return true;
      },
      "diet-copy-confirmation": () => {
        if (!inputRef.current.copyConfirmation) return false;
        inputRef.current.closeCopyConfirmation();
        return true;
      },
      "diet-copy-date-picker": () => {
        if (!inputRef.current.copyDateCategory) return false;
        inputRef.current.closeCopyDate();
        return true;
      },
    },
  }), [input.ambiguityCandidates, input.copyConfirmation, input.copyDateCategory]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type DietMacroOverviewItem = {
  key: string;
  label: string;
  consumed: number;
  total: number;
  accent: string;
};

export type DietScreenModel = {
  dateLabel: string;
  dateContextLabel: string;
  selectedDate: string;
  datePickerOpen: boolean;
  isWeb: boolean;
  isIos: boolean;
  caloriesConsumed: number;
  caloriesTarget: number;
  caloriesProgress: number;
  caloriesPercent: number;
  macroOverview: readonly DietMacroOverviewItem[];
  exceededBudgetCalories: number | null;
  meals: readonly DietMeal[];
  expandedMeals: Readonly<Record<DietMealCategory, boolean>>;
  editorCategory: DietMealCategory | null;
  editingItem: { meal_id: string; item_id: string } | null;
  itemMenu: { meal_id: string; item_id: string } | null;
  catalogAvailability: CatalogSearchAvailability;
  foodSearch: string;
  foodSearchResults: readonly FoodCatalogEntry[];
  addMode: "search" | "form" | "ai" | "selected" | null;
  selectedFood: FoodCatalogEntry | null;
  selectedGrams: string;
  selectedFoodPreview: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  nutritionIssues: ReadonlyMap<string, NutritionValidationIssue>;
  manualFields: Readonly<Record<
    "name" | "grams" | "calories_kcal" | "protein_g" | "carbs_g" | "fat_g",
    string
  >>;
};

export type DietScreenActions = {
  captureHeaderHeight(height: number): void;
  changeDay(days: number): void;
  toggleDatePicker(): void;
  changeWebDate(value: string): void;
  changeNativeDate(eventType: string, date?: Date): void;
  closeDatePicker(): void;
  toggleMeal(category: DietMealCategory): void;
  toggleItemMenu(mealId: string, itemId: string): void;
  editItem(category: DietMealCategory, meal: DietMeal, item: DietItem): void;
  editItemWithAi(category: DietMealCategory, meal: DietMeal, item: DietItem): void;
  deleteItem(meal: DietMeal, item: DietItem): void;
  retryCatalog(): void;
  changeFoodSearch(category: DietMealCategory, value: string): void;
  focusFoodSearch(): void;
  clearFoodSearch(): void;
  selectFood(category: DietMealCategory, food: FoodCatalogEntry): void;
  changeSelectedGrams(value: string): void;
  saveSelectedFood(): void;
  returnToFoodSearch(): void;
  changeManualField(field: keyof DietScreenModel["manualFields"], value: string): void;
  saveManualFood(): void;
  cancelMealEditor(): void;
  openManualFood(category: DietMealCategory): void;
  openFoodEstimator(category: DietMealCategory): void;
  repeatPreviousDay(category: DietMealCategory): void;
  repeatFromDate(category: DietMealCategory): void;
};

type DietBackLayer =
  | "food-catalog-ambiguity"
  | "food-estimator"
  | "diet-copy-confirmation"
  | "diet-copy-date-picker"
  | "diet-date-picker"
  | "diet-item-menu"
  | "diet-meal-editor";

type DietControllerInput = DietScreenModel & {
  foodCatalogAmbiguityOpen: boolean;
  foodEstimatorOpen: boolean;
  copyConfirmationOpen: boolean;
  copyDatePickerOpen: boolean;
  itemMenuOpen: boolean;
  mealEditorOpen: boolean;
  captureHeaderHeight(height: number): void;
  changeDay(days: number): void;
  toggleDatePicker(): void;
  changeWebDate(value: string): void;
  changeNativeDate(eventType: string, date?: Date): void;
  closeFoodCatalogAmbiguity(): void;
  closeFoodEstimator(): void;
  closeCopyConfirmation(): void;
  closeCopyDatePicker(): void;
  closeDatePicker(): void;
  closeItemMenu(): void;
  closeMealEditor(): void;
  toggleMeal(category: DietMealCategory): void;
  toggleItemMenu(mealId: string, itemId: string): void;
  editItem(category: DietMealCategory, meal: DietMeal, item: DietItem): void;
  editItemWithAi(category: DietMealCategory, meal: DietMeal, item: DietItem): void;
  deleteItem(meal: DietMeal, item: DietItem): void;
  retryCatalog(): void;
  changeFoodSearch(category: DietMealCategory, value: string): void;
  focusFoodSearch(): void;
  clearFoodSearch(): void;
  selectFood(category: DietMealCategory, food: FoodCatalogEntry): void;
  changeSelectedGrams(value: string): void;
  saveSelectedFood(): void;
  returnToFoodSearch(): void;
  changeManualField(field: keyof DietScreenModel["manualFields"], value: string): void;
  saveManualFood(): void;
  cancelMealEditor(): void;
  openManualFood(category: DietMealCategory): void;
  openFoodEstimator(category: DietMealCategory): void;
  repeatPreviousDay(category: DietMealCategory): void;
  repeatFromDate(category: DietMealCategory): void;
};

export function useDietController(
  input: DietControllerInput,
): ScreenController<DietScreenModel, DietScreenActions, DietBackLayer> {
  const targetsRef = useRef(input);
  targetsRef.current = input;
  const model = useMemo<DietScreenModel>(() => ({
    dateLabel: input.dateLabel,
    dateContextLabel: input.dateContextLabel,
    selectedDate: input.selectedDate,
    datePickerOpen: input.datePickerOpen,
    isWeb: input.isWeb,
    isIos: input.isIos,
    caloriesConsumed: input.caloriesConsumed,
    caloriesTarget: input.caloriesTarget,
    caloriesProgress: input.caloriesProgress,
    caloriesPercent: input.caloriesPercent,
    macroOverview: input.macroOverview,
    exceededBudgetCalories: input.exceededBudgetCalories,
    meals: input.meals,
    expandedMeals: input.expandedMeals,
    editorCategory: input.editorCategory,
    editingItem: input.editingItem,
    itemMenu: input.itemMenu,
    catalogAvailability: input.catalogAvailability,
    foodSearch: input.foodSearch,
    foodSearchResults: input.foodSearchResults,
    addMode: input.addMode,
    selectedFood: input.selectedFood,
    selectedGrams: input.selectedGrams,
    selectedFoodPreview: input.selectedFoodPreview,
    nutritionIssues: input.nutritionIssues,
    manualFields: input.manualFields,
  }), [
    input.caloriesConsumed,
    input.caloriesPercent,
    input.caloriesProgress,
    input.caloriesTarget,
    input.dateContextLabel,
    input.dateLabel,
    input.datePickerOpen,
    input.exceededBudgetCalories,
    input.isIos,
    input.isWeb,
    input.macroOverview,
    input.selectedDate,
    input.meals,
    input.expandedMeals,
    input.editorCategory,
    input.editingItem,
    input.itemMenu,
    input.catalogAvailability,
    input.foodSearch,
    input.foodSearchResults,
    input.addMode,
    input.selectedFood,
    input.selectedGrams,
    input.selectedFoodPreview,
    input.nutritionIssues,
    input.manualFields,
  ]);
  const captureHeaderHeight = useCallback((height: number) => targetsRef.current.captureHeaderHeight(height), []);
  const changeDay = useCallback((days: number) => targetsRef.current.changeDay(days), []);
  const toggleDatePicker = useCallback(() => targetsRef.current.toggleDatePicker(), []);
  const changeWebDate = useCallback((value: string) => targetsRef.current.changeWebDate(value), []);
  const changeNativeDate = useCallback((eventType: string, date?: Date) => targetsRef.current.changeNativeDate(eventType, date), []);
  const closeDatePickerAction = useCallback(() => targetsRef.current.closeDatePicker(), []);
  const toggleMeal = useCallback((category: DietMealCategory) => targetsRef.current.toggleMeal(category), []);
  const toggleItemMenu = useCallback((mealId: string, itemId: string) => targetsRef.current.toggleItemMenu(mealId, itemId), []);
  const editItem = useCallback((category: DietMealCategory, meal: DietMeal, item: DietItem) => targetsRef.current.editItem(category, meal, item), []);
  const editItemWithAi = useCallback((category: DietMealCategory, meal: DietMeal, item: DietItem) => targetsRef.current.editItemWithAi(category, meal, item), []);
  const deleteItem = useCallback((meal: DietMeal, item: DietItem) => targetsRef.current.deleteItem(meal, item), []);
  const retryCatalog = useCallback(() => targetsRef.current.retryCatalog(), []);
  const changeFoodSearch = useCallback((category: DietMealCategory, value: string) => targetsRef.current.changeFoodSearch(category, value), []);
  const focusFoodSearch = useCallback(() => targetsRef.current.focusFoodSearch(), []);
  const clearFoodSearch = useCallback(() => targetsRef.current.clearFoodSearch(), []);
  const selectFood = useCallback((category: DietMealCategory, food: FoodCatalogEntry) => targetsRef.current.selectFood(category, food), []);
  const changeSelectedGrams = useCallback((value: string) => targetsRef.current.changeSelectedGrams(value), []);
  const saveSelectedFood = useCallback(() => targetsRef.current.saveSelectedFood(), []);
  const returnToFoodSearch = useCallback(() => targetsRef.current.returnToFoodSearch(), []);
  const changeManualField = useCallback((field: keyof DietScreenModel["manualFields"], value: string) => targetsRef.current.changeManualField(field, value), []);
  const saveManualFood = useCallback(() => targetsRef.current.saveManualFood(), []);
  const cancelMealEditor = useCallback(() => targetsRef.current.cancelMealEditor(), []);
  const openManualFood = useCallback((category: DietMealCategory) => targetsRef.current.openManualFood(category), []);
  const openFoodEstimator = useCallback((category: DietMealCategory) => targetsRef.current.openFoodEstimator(category), []);
  const repeatPreviousDay = useCallback((category: DietMealCategory) => targetsRef.current.repeatPreviousDay(category), []);
  const repeatFromDate = useCallback((category: DietMealCategory) => targetsRef.current.repeatFromDate(category), []);
  const actions = useMemo<DietScreenActions>(() => ({
    captureHeaderHeight,
    changeDay,
    toggleDatePicker,
    changeWebDate,
    changeNativeDate,
    closeDatePicker: closeDatePickerAction,
    toggleMeal,
    toggleItemMenu,
    editItem,
    editItemWithAi,
    deleteItem,
    retryCatalog,
    changeFoodSearch,
    focusFoodSearch,
    clearFoodSearch,
    selectFood,
    changeSelectedGrams,
    saveSelectedFood,
    returnToFoodSearch,
    changeManualField,
    saveManualFood,
    cancelMealEditor,
    openManualFood,
    openFoodEstimator,
    repeatPreviousDay,
    repeatFromDate,
  }), [captureHeaderHeight, cancelMealEditor, changeDay, changeFoodSearch, changeManualField, changeNativeDate, changeSelectedGrams, changeWebDate, clearFoodSearch, closeDatePickerAction, deleteItem, editItem, editItemWithAi, focusFoodSearch, openFoodEstimator, openManualFood, repeatFromDate, repeatPreviousDay, retryCatalog, returnToFoodSearch, saveManualFood, saveSelectedFood, selectFood, toggleDatePicker, toggleItemMenu, toggleMeal]);
  const makeBackHandler = useCallback((close: keyof Pick<
    DietControllerInput,
    | "closeFoodCatalogAmbiguity"
    | "closeFoodEstimator"
    | "closeCopyConfirmation"
    | "closeCopyDatePicker"
    | "closeDatePicker"
    | "closeItemMenu"
    | "closeMealEditor"
  >) => () => {
    targetsRef.current[close]();
    return true;
  }, []);
  const handlers = useMemo(() => ({
    "food-catalog-ambiguity": makeBackHandler("closeFoodCatalogAmbiguity"),
    "food-estimator": makeBackHandler("closeFoodEstimator"),
    "diet-copy-confirmation": makeBackHandler("closeCopyConfirmation"),
    "diet-copy-date-picker": makeBackHandler("closeCopyDatePicker"),
    "diet-date-picker": makeBackHandler("closeDatePicker"),
    "diet-item-menu": makeBackHandler("closeItemMenu"),
    "diet-meal-editor": makeBackHandler("closeMealEditor"),
  }), [makeBackHandler]);
  const layers = useMemo(() => ({
    "food-catalog-ambiguity": input.foodCatalogAmbiguityOpen,
    "food-estimator": input.foodEstimatorOpen,
    "diet-copy-confirmation": input.copyConfirmationOpen,
    "diet-copy-date-picker": input.copyDatePickerOpen,
    "diet-date-picker": input.datePickerOpen,
    "diet-item-menu": input.itemMenuOpen,
    "diet-meal-editor": input.mealEditorOpen,
  }), [input.copyConfirmationOpen, input.copyDatePickerOpen, input.datePickerOpen, input.foodCatalogAmbiguityOpen, input.foodEstimatorOpen, input.itemMenuOpen, input.mealEditorOpen]);
  const back = useMemo(() => ({ layers, handlers }), [handlers, layers]);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
