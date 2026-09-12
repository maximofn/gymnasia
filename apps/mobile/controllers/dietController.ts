import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  unresolvedCatalog,
  type CatalogSearchAvailability,
  type FoodCatalogEntry,
} from "../catalogs/types";
import { dietItemFromCatalog, findDietFoodInCatalog } from "../diet/catalogModel";
import { buildDietDailyPresentationModel } from "../diet/dailyPresentationModel";
import {
  createDietMealExpandedState,
  dateFromISO,
  formatDietDayHeader,
  formatNutritionNumber,
  isoDateFromDate,
  shiftISODateByDays,
  sortDietMealsByCategory,
  todayISO,
  type DietItem,
  type DietMeal,
} from "../diet/model";
import {
  DIET_MEAL_CATEGORIES,
  formatNutritionValidationIssues,
  validateNutritionFormInput,
  validateNutritionItem,
  type DietMealCategory,
  type NutritionValidationIssue,
} from "../diet/nutritionContract";
import type { LocalStoreRuntime } from "../persistence/localStoreRuntime";
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

type DietItemTarget = { meal_id: string; item_id: string } | null;

type PendingFoodResolution = {
  origin: "form" | "estimator";
  candidates: FoodCatalogEntry[];
  manualItem: DietItem;
  category: DietMealCategory;
  date: string;
  editing: DietItemTarget;
  proposeManual: boolean;
};

export type DietPersistTarget = {
  category: DietMealCategory;
  date: string;
  editing: DietItemTarget;
};

export function useDietRuntime(input: {
  active: boolean;
  localStore: LocalStoreRuntime;
  referenceDate: string;
  dailyCaloriesTarget: number;
  macroTargets: { protein: number; carbs: number; fat: number };
  exceededBudgetCalories: number | null;
  foods: readonly FoodCatalogEntry[];
  personalFoods: readonly FoodCatalogEntry[];
  catalogAvailability: CatalogSearchAvailability;
  foodEstimatorOpen: boolean;
  isWeb: boolean;
  isIos: boolean;
  isAndroid: boolean;
  captureHeaderHeight(height: number): void;
  retryCatalog(): void;
  openFoodEstimator(item: DietItem | null): void;
  closeFoodEstimator(): void;
  proposeManualFood(item: DietItem): void;
  setError(message: string | null): void;
  createId(prefix: "food" | "meal"): string;
}): {
  controller: ReturnType<typeof useDietController>;
  resolutionController: ReturnType<typeof useDietResolutionController>;
  persistTarget: DietPersistTarget | null;
  stageEstimatedResolution(
    target: DietPersistTarget,
    manualItem: DietItem,
    candidates: FoodCatalogEntry[],
    proposeManual: boolean,
  ): void;
  saveEstimatedItem(target: DietPersistTarget, item: DietItem): void;
} {
  const [mealTitleInput, setMealTitleInput] = useState("");
  const [mealCaloriesInput, setMealCaloriesInput] = useState("");
  const [mealProteinInput, setMealProteinInput] = useState("");
  const [mealCarbsInput, setMealCarbsInput] = useState("");
  const [mealFatInput, setMealFatInput] = useState("");
  const [mealGramsInput, setMealGramsInput] = useState("");
  const [mealNutritionIssues, setMealNutritionIssues] = useState<NutritionValidationIssue[]>([]);
  const mealPerGramRef = useRef<{ cal: number; prot: number; carbs: number; fat: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [copyPickCategory, setCopyPickCategory] = useState<DietMealCategory | null>(null);
  const [copyPickDate, setCopyPickDate] = useState(() => new Date());
  const [copyPickDateText, setCopyPickDateText] = useState("");
  const [copyConfirmation, setCopyConfirmation] = useState<{
    category: DietMealCategory;
    sourceDate: string;
    items: DietItem[];
  } | null>(null);
  const [pendingResolution, setPendingResolution] = useState<PendingFoodResolution | null>(null);
  const [editorCategory, setEditorCategory] = useState<DietMealCategory | null>(null);
  const [addMode, setAddMode] = useState<"search" | "form" | "ai" | "selected" | null>(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodCatalogEntry | null>(null);
  const [selectedGrams, setSelectedGrams] = useState("");
  const [itemMenu, setItemMenu] = useState<DietItemTarget>(null);
  const [editingItem, setEditingItem] = useState<DietItemTarget>(null);
  const [expandedMeals, setExpandedMeals] = useState<Record<DietMealCategory, boolean>>(
    () => createDietMealExpandedState(),
  );
  const inputRef = useRef(input);
  inputRef.current = input;

  function resetEditor(): void {
    setEditorCategory(null);
    setEditingItem(null);
    setItemMenu(null);
    setMealTitleInput("");
    setMealCaloriesInput("");
    setMealProteinInput("");
    setMealCarbsInput("");
    setMealFatInput("");
    setMealGramsInput("");
    mealPerGramRef.current = null;
  }

  useEffect(() => {
    if (!input.active) return;
    setSelectedDate(todayISO());
    setDatePickerOpen(false);
    resetEditor();
  }, [input.active]);

  const day = input.localStore.store.dietByDate[selectedDate]
    ?? { day_date: selectedDate, meals: [] };
  const presentation = useMemo(() => buildDietDailyPresentationModel({
    selectedDate,
    referenceDate: input.referenceDate,
    day,
    dailyCaloriesTarget: input.dailyCaloriesTarget,
    macroTargets: input.macroTargets,
    foods: input.foods,
    personalFoods: input.personalFoods,
    foodSearch,
    selectedFood,
    selectedGrams,
    nutritionIssues: mealNutritionIssues,
    manualFields: {
      name: mealTitleInput,
      grams: mealGramsInput,
      calories_kcal: mealCaloriesInput,
      protein_g: mealProteinInput,
      carbs_g: mealCarbsInput,
      fat_g: mealFatInput,
    },
  }), [
    day,
    foodSearch,
    input.dailyCaloriesTarget,
    input.foods,
    input.macroTargets,
    input.personalFoods,
    input.referenceDate,
    mealCaloriesInput,
    mealCarbsInput,
    mealFatInput,
    mealGramsInput,
    mealNutritionIssues,
    mealProteinInput,
    mealTitleInput,
    selectedDate,
    selectedFood,
    selectedGrams,
  ]);

  function itemsForDate(category: DietMealCategory, isoDate: string): DietItem[] {
    const dietDay = inputRef.current.localStore.store.dietByDate[isoDate];
    return dietDay?.meals.find((meal) => meal.title === category)?.items ?? [];
  }

  function persistItem(item: DietItem, target: DietPersistTarget): void {
    inputRef.current.localStore.update((previous) => {
      const currentDay = previous.dietByDate[target.date]
        ?? { day_date: target.date, meals: [] };
      if (target.editing) {
        const meals = currentDay.meals
          .map((meal) => meal.id !== target.editing?.meal_id ? meal : ({
            ...meal,
            items: meal.items.map((current) => current.id === target.editing?.item_id
              ? { ...item, id: current.id }
              : current),
          }))
          .filter((meal) => meal.items.length > 0);
        return {
          ...previous,
          dietByDate: {
            ...previous.dietByDate,
            [target.date]: { ...currentDay, meals: sortDietMealsByCategory(meals) },
          },
        };
      }
      const existingMealIndex = currentDay.meals.findIndex(
        (meal) => meal.title === target.category,
      );
      const meals = existingMealIndex >= 0
        ? currentDay.meals.map((meal, index) => index === existingMealIndex
          ? { ...meal, items: [...meal.items, item] }
          : meal)
        : [
            ...currentDay.meals,
            { id: inputRef.current.createId("meal"), title: target.category, items: [item] },
          ];
      return {
        ...previous,
        dietByDate: {
          ...previous.dietByDate,
          [target.date]: { ...currentDay, meals: sortDietMealsByCategory(meals) },
        },
      };
    });
  }

  function finishResolution(origin: PendingFoodResolution["origin"]): void {
    setPendingResolution(null);
    setEditingItem(null);
    setItemMenu(null);
    setEditorCategory(null);
    setAddMode(null);
    setMealNutritionIssues([]);
    inputRef.current.setError(null);
    if (origin === "form") {
      setMealTitleInput("");
      setMealCaloriesInput("");
      setMealProteinInput("");
      setMealCarbsInput("");
      setMealFatInput("");
      setMealGramsInput("");
      mealPerGramRef.current = null;
    } else {
      inputRef.current.closeFoodEstimator();
    }
  }

  function commitPendingResolution(candidate: FoodCatalogEntry | null): void {
    if (!pendingResolution) return;
    const pending = pendingResolution;
    const item = candidate
      ? dietItemFromCatalog(candidate, pending.manualItem.grams, pending.manualItem.id, "selection")
      : pending.manualItem;
    persistItem(item, pending);
    if (!candidate && pending.proposeManual) inputRef.current.proposeManualFood(item);
    finishResolution(pending.origin);
  }

  function saveManualFood(): void {
    if (!editorCategory) {
      inputRef.current.setError("Selecciona una comida (Desayuno, Almuerzo, Comida, Merienda o Cena).");
      return;
    }
    const formResult = validateNutritionFormInput({
      name: mealTitleInput,
      grams: mealGramsInput,
      calories_kcal: mealCaloriesInput,
      protein_g: mealProteinInput,
      carbs_g: mealCarbsInput,
      fat_g: mealFatInput,
    });
    if (!formResult.ok) {
      setMealNutritionIssues(formResult.issues);
      inputRef.current.setError(formatNutritionValidationIssues(formResult.issues));
      return;
    }
    setMealNutritionIssues([]);
    const value = formResult.value;
    const repoMatch = findDietFoodInCatalog(
      value.name,
      inputRef.current.foods,
      inputRef.current.personalFoods,
    );
    const manualItem: DietItem = {
      id: inputRef.current.createId("food"),
      title: value.name,
      grams: value.grams,
      calories_kcal: value.calories_kcal,
      protein_g: value.protein_g,
      carbs_g: value.carbs_g,
      fat_g: value.fat_g,
      catalog_link: unresolvedCatalog("manual"),
    };
    const target = { category: editorCategory, date: selectedDate, editing: editingItem };
    if (repoMatch.kind === "alias" || repoMatch.kind === "ambiguous") {
      setPendingResolution({
        origin: "form",
        candidates: repoMatch.kind === "alias" ? [repoMatch.candidate] : repoMatch.candidates,
        manualItem,
        ...target,
        proposeManual: true,
      });
      return;
    }
    const item = repoMatch.kind === "exact"
      ? dietItemFromCatalog(repoMatch.candidate, value.grams, manualItem.id, "selection")
      : manualItem;
    const validation = validateNutritionItem({
      name: item.title,
      grams: item.grams,
      calories_kcal: item.calories_kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    });
    if (!validation.ok) {
      setMealNutritionIssues(validation.issues);
      inputRef.current.setError(formatNutritionValidationIssues(validation.issues));
      return;
    }
    if (repoMatch.kind === "not_found") inputRef.current.proposeManualFood(item);
    persistItem(item, target);
    finishResolution("form");
  }

  function openEditor(category: DietMealCategory): void {
    setExpandedMeals((previous) => ({ ...previous, [category]: true }));
    setEditorCategory(category);
    setEditingItem(null);
    setItemMenu(null);
    setMealTitleInput("");
    setMealCaloriesInput("");
    setMealProteinInput("");
    setMealCarbsInput("");
    setMealFatInput("");
    setMealGramsInput("");
    mealPerGramRef.current = null;
    setMealNutritionIssues([]);
    inputRef.current.setError(null);
  }

  const controller = useDietController({
    dateLabel: presentation.dateLabel,
    dateContextLabel: presentation.dateContextLabel,
    selectedDate,
    datePickerOpen,
    isWeb: input.isWeb,
    isIos: input.isIos,
    caloriesConsumed: presentation.caloriesConsumed,
    caloriesTarget: input.dailyCaloriesTarget,
    caloriesProgress: presentation.caloriesProgress,
    caloriesPercent: presentation.caloriesPercent,
    macroOverview: presentation.macroOverview,
    exceededBudgetCalories: input.exceededBudgetCalories,
    meals: presentation.meals,
    expandedMeals,
    editorCategory,
    editingItem,
    itemMenu,
    catalogAvailability: input.catalogAvailability,
    foodSearch,
    foodSearchResults: presentation.foodSearchResults,
    addMode,
    selectedFood,
    selectedGrams,
    selectedFoodPreview: presentation.selectedFoodPreview,
    nutritionIssues: presentation.nutritionIssues,
    manualFields: presentation.manualFields,
    foodCatalogAmbiguityOpen: pendingResolution !== null,
    foodEstimatorOpen: input.foodEstimatorOpen,
    copyConfirmationOpen: copyConfirmation !== null,
    copyDatePickerOpen: copyPickCategory !== null,
    itemMenuOpen: itemMenu !== null,
    mealEditorOpen: editorCategory !== null,
    captureHeaderHeight: input.captureHeaderHeight,
    changeDay: (days) => {
      setDatePickerOpen(false);
      resetEditor();
      setSelectedDate((previous) => shiftISODateByDays(previous, days));
      inputRef.current.setError(null);
    },
    toggleDatePicker: () => setDatePickerOpen((previous) => !previous),
    changeWebDate: (value) => {
      const parsed = new Date(`${value}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) setSelectedDate(value);
    },
    changeNativeDate: (eventType, date) => {
      if (inputRef.current.isAndroid) setDatePickerOpen(false);
      if (eventType === "dismissed" || !date) return;
      resetEditor();
      setSelectedDate(isoDateFromDate(date));
      inputRef.current.setError(null);
    },
    closeFoodCatalogAmbiguity: () => setPendingResolution(null),
    closeFoodEstimator: input.closeFoodEstimator,
    closeCopyConfirmation: () => setCopyConfirmation(null),
    closeCopyDatePicker: () => setCopyPickCategory(null),
    closeDatePicker: () => setDatePickerOpen(false),
    closeItemMenu: () => setItemMenu(null),
    closeMealEditor: resetEditor,
    toggleMeal: (category) => {
      setExpandedMeals((previous) => ({ ...previous, [category]: !previous[category] }));
      setEditorCategory((previous) => previous === category ? null : previous);
      setEditingItem(null);
      setItemMenu(null);
    },
    toggleItemMenu: (mealId, itemId) => {
      setItemMenu((previous) => previous?.meal_id === mealId && previous.item_id === itemId
        ? null
        : { meal_id: mealId, item_id: itemId });
    },
    editItem: (category, meal, item) => {
      setExpandedMeals((previous) => ({ ...previous, [category]: true }));
      setEditorCategory(category);
      setEditingItem({ meal_id: meal.id, item_id: item.id });
      setAddMode("form");
      setItemMenu(null);
      setMealTitleInput(item.title);
      setMealCaloriesInput(formatNutritionNumber(item.calories_kcal));
      setMealProteinInput(formatNutritionNumber(item.protein_g));
      setMealCarbsInput(formatNutritionNumber(item.carbs_g));
      setMealFatInput(formatNutritionNumber(item.fat_g));
      setMealGramsInput(item.grams > 0 ? formatNutritionNumber(item.grams) : "");
      mealPerGramRef.current = item.grams > 0
        ? {
            cal: item.calories_kcal / item.grams,
            prot: item.protein_g / item.grams,
            carbs: item.carbs_g / item.grams,
            fat: item.fat_g / item.grams,
          }
        : null;
      setMealNutritionIssues([]);
      inputRef.current.setError(null);
    },
    editItemWithAi: (category, meal, item) => {
      setItemMenu(null);
      setEditorCategory(category);
      setEditingItem({ meal_id: meal.id, item_id: item.id });
      setAddMode("ai");
      inputRef.current.openFoodEstimator(item);
    },
    deleteItem: (meal, item) => {
      const activeDate = selectedDate;
      inputRef.current.localStore.update((previous) => {
        const currentDay = previous.dietByDate[activeDate]
          ?? { day_date: activeDate, meals: [] };
        const meals = currentDay.meals
          .map((currentMeal) => currentMeal.id === meal.id
            ? { ...currentMeal, items: currentMeal.items.filter((current) => current.id !== item.id) }
            : currentMeal)
          .filter((currentMeal) => currentMeal.items.length > 0);
        return {
          ...previous,
          dietByDate: {
            ...previous.dietByDate,
            [activeDate]: { ...currentDay, meals: sortDietMealsByCategory(meals) },
          },
        };
      });
      if (editingItem?.meal_id === meal.id && editingItem.item_id === item.id) {
        setEditingItem(null);
        setMealTitleInput("");
        setMealCaloriesInput("");
        setMealProteinInput("");
        setMealCarbsInput("");
        setMealFatInput("");
        setMealGramsInput("");
        mealPerGramRef.current = null;
      }
      setItemMenu(null);
      inputRef.current.setError(null);
    },
    retryCatalog: input.retryCatalog,
    changeFoodSearch: (category, value) => {
      setFoodSearch(value);
      if (value.trim()) {
        setAddMode("search");
        openEditor(category);
        setFoodSearch(value);
        return;
      }
      setAddMode(null);
      setEditorCategory(null);
    },
    focusFoodSearch: () => setFoodSearch(""),
    clearFoodSearch: () => {
      setFoodSearch("");
      setAddMode(null);
      setEditorCategory(null);
    },
    selectFood: (category, food) => {
      setSelectedFood(food);
      setSelectedGrams(String(food.serving_size_g));
      setAddMode("selected");
      setFoodSearch("");
      openEditor(category);
      setSelectedFood(food);
      setSelectedGrams(String(food.serving_size_g));
      setAddMode("selected");
    },
    changeSelectedGrams: (value) => {
      setSelectedGrams(value);
      setMealNutritionIssues((previous) => previous.filter((issue) => issue.field !== "grams"));
      inputRef.current.setError(null);
    },
    saveSelectedFood: () => {
      if (!editorCategory || !selectedFood) return;
      const result = validateNutritionFormInput({
        name: selectedFood.name,
        grams: selectedGrams,
        calories_kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      });
      if (!result.ok) {
        setMealNutritionIssues(result.issues);
        inputRef.current.setError(formatNutritionValidationIssues(result.issues));
        return;
      }
      const item = dietItemFromCatalog(
        selectedFood,
        result.value.grams,
        inputRef.current.createId("food"),
        "selection",
      );
      const validation = validateNutritionItem({
        name: item.title,
        grams: item.grams,
        calories_kcal: item.calories_kcal,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      });
      if (!validation.ok) {
        setMealNutritionIssues(validation.issues);
        inputRef.current.setError(formatNutritionValidationIssues(validation.issues));
        return;
      }
      persistItem(item, { category: editorCategory, date: selectedDate, editing: null });
      setAddMode(null);
      setSelectedFood(null);
      setEditorCategory(null);
      setMealNutritionIssues([]);
      inputRef.current.setError(null);
    },
    returnToFoodSearch: () => {
      setAddMode("search");
      setSelectedFood(null);
      setSelectedGrams("");
    },
    changeManualField: (field, value) => {
      if (field === "name") setMealTitleInput(value);
      if (field === "grams") setMealGramsInput(value);
      if (field === "calories_kcal") setMealCaloriesInput(value);
      if (field === "protein_g") setMealProteinInput(value);
      if (field === "carbs_g") setMealCarbsInput(value);
      if (field === "fat_g") setMealFatInput(value);
      setMealNutritionIssues((previous) => previous.filter((issue) => issue.field !== field));
      inputRef.current.setError(null);
      if (field !== "grams" || !mealPerGramRef.current) return;
      const grams = parseFloat(value) || 0;
      if (grams <= 0) return;
      const perGram = mealPerGramRef.current;
      setMealCaloriesInput(formatNutritionNumber(Math.round(perGram.cal * grams)));
      setMealProteinInput(formatNutritionNumber(Math.round(perGram.prot * grams * 10) / 10));
      setMealCarbsInput(formatNutritionNumber(Math.round(perGram.carbs * grams * 10) / 10));
      setMealFatInput(formatNutritionNumber(Math.round(perGram.fat * grams * 10) / 10));
    },
    saveManualFood,
    cancelMealEditor: () => {
      resetEditor();
      setAddMode(null);
      setFoodSearch("");
      setMealNutritionIssues([]);
      inputRef.current.setError(null);
    },
    openManualFood: (category) => {
      setAddMode("form");
      openEditor(category);
      setAddMode("form");
    },
    openFoodEstimator: (category) => {
      setAddMode("ai");
      openEditor(category);
      setAddMode("ai");
      inputRef.current.openFoodEstimator(null);
    },
    repeatPreviousDay: (category) => {
      const sourceDate = shiftISODateByDays(selectedDate, -1);
      const items = itemsForDate(category, sourceDate);
      if (items.length === 0) {
        inputRef.current.setError(
          `No hay alimentos en ${category} del día anterior (${formatDietDayHeader(sourceDate)}).`,
        );
        return;
      }
      inputRef.current.setError(null);
      setCopyConfirmation({ category, sourceDate, items });
    },
    repeatFromDate: (category) => {
      const defaultDate = dateFromISO(shiftISODateByDays(selectedDate, -1));
      setCopyPickDate(defaultDate);
      setCopyPickDateText(isoDateFromDate(defaultDate));
      setCopyPickCategory(category);
    },
  });

  function previewCopy(category: DietMealCategory, sourceDate: string): void {
    setCopyPickCategory(null);
    if (sourceDate === selectedDate) {
      inputRef.current.setError("Selecciona una fecha distinta a la actual.");
      return;
    }
    const items = itemsForDate(category, sourceDate);
    if (items.length === 0) {
      inputRef.current.setError(`No hay alimentos en ${category} del ${formatDietDayHeader(sourceDate)}.`);
      return;
    }
    inputRef.current.setError(null);
    setCopyConfirmation({ category, sourceDate, items });
  }

  const resolutionController = useDietResolutionController({
    isAndroid: input.isAndroid,
    isWeb: input.isWeb,
    copyDateCategory: copyPickCategory,
    copyDate: copyPickDate,
    copyDateText: copyPickDateText,
    ambiguityCandidates: pendingResolution?.candidates ?? null,
    copyConfirmation,
    selectedDate,
    changeCopyDate: (eventType, date) => {
      if (inputRef.current.isAndroid) {
        const category = copyPickCategory;
        setCopyPickCategory(null);
        if (eventType === "dismissed" || !date || !category) return;
        previewCopy(category, isoDateFromDate(date));
        return;
      }
      if (eventType === "dismissed" || !date) return;
      setCopyPickDate(date);
      setCopyPickDateText(isoDateFromDate(date));
    },
    changeCopyDateText: setCopyPickDateText,
    continueCopyDate: previewCopy,
    closeCopyDate: () => setCopyPickCategory(null),
    chooseFood: commitPendingResolution,
    closeAmbiguity: () => setPendingResolution(null),
    confirmCopy: () => {
      if (!copyConfirmation) return;
      const { category, items } = copyConfirmation;
      const clonedItems = items.map((item) => ({
        ...item,
        id: inputRef.current.createId("food"),
      }));
      inputRef.current.localStore.update((previous) => {
        const currentDay = previous.dietByDate[selectedDate]
          ?? { day_date: selectedDate, meals: [] };
        const existingMeal = currentDay.meals.find((meal) => meal.title === category);
        const meals = existingMeal
          ? currentDay.meals.map((meal) => meal.id === existingMeal.id
            ? { ...meal, items: [...meal.items, ...clonedItems] }
            : meal)
          : sortDietMealsByCategory([
              ...currentDay.meals,
              { id: inputRef.current.createId("meal"), title: category, items: clonedItems },
            ]);
        return {
          ...previous,
          dietByDate: {
            ...previous.dietByDate,
            [selectedDate]: { ...currentDay, meals },
          },
        };
      });
      setCopyConfirmation(null);
    },
    closeCopyConfirmation: () => setCopyConfirmation(null),
  });

  const persistTarget = editorCategory
    ? { category: editorCategory, date: selectedDate, editing: editingItem }
    : null;
  return {
    controller,
    resolutionController,
    persistTarget,
    stageEstimatedResolution(target, manualItem, candidates, proposeManual) {
      setPendingResolution({
        origin: "estimator",
        candidates,
        manualItem,
        ...target,
        proposeManual,
      });
    },
    saveEstimatedItem(target, item) {
      persistItem(item, target);
      finishResolution("estimator");
    },
  };
}
