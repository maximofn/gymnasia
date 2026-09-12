import { useCallback, useMemo, useRef } from "react";

import type { ScreenController } from "./types";

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
};

export type DietScreenActions = {
  captureHeaderHeight(height: number): void;
  changeDay(days: number): void;
  toggleDatePicker(): void;
  changeWebDate(value: string): void;
  changeNativeDate(eventType: string, date?: Date): void;
  closeDatePicker(): void;
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
  ]);
  const captureHeaderHeight = useCallback((height: number) => targetsRef.current.captureHeaderHeight(height), []);
  const changeDay = useCallback((days: number) => targetsRef.current.changeDay(days), []);
  const toggleDatePicker = useCallback(() => targetsRef.current.toggleDatePicker(), []);
  const changeWebDate = useCallback((value: string) => targetsRef.current.changeWebDate(value), []);
  const changeNativeDate = useCallback((eventType: string, date?: Date) => targetsRef.current.changeNativeDate(eventType, date), []);
  const closeDatePickerAction = useCallback(() => targetsRef.current.closeDatePicker(), []);
  const actions = useMemo<DietScreenActions>(() => ({
    captureHeaderHeight,
    changeDay,
    toggleDatePicker,
    changeWebDate,
    changeNativeDate,
    closeDatePicker: closeDatePickerAction,
  }), [captureHeaderHeight, changeDay, changeNativeDate, changeWebDate, closeDatePickerAction, toggleDatePicker]);
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
