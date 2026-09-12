import { useMemo, useRef } from "react";

import type { PersonalDataField } from "../agent/personalData";
import type {
  ActivityLevel,
  DietGoal,
  DietSettings,
  GkgMacroKey,
} from "../diet/model";
import type { DietMacroMode, NutritionValidationIssue } from "../diet/nutritionContract";
import type { Measurement } from "../measurements/measurementContract";
import type { CatalogSearchAvailability, FoodCatalogEntry } from "../catalogs/types";
import type { WorkoutTemplate } from "../training/workoutTemplateOperations";
import type { NotificationSoundKey } from "../notifications/notificationSounds";
import type { NotificationSettings } from "../storage/userPreferences";
import type { ScreenController } from "./types";

export type SettingsTabKey =
  | "diet"
  | "provider"
  | "memory"
  | "training"
  | "foods"
  | "products"
  | "personalFoods"
  | "measures"
  | "preferences"
  | "notifications"
  | "data"
  | "traces";

export const SETTINGS_TAB_OPTIONS: ReadonlyArray<{
  key: SettingsTabKey;
  label: string;
}> = [
  { key: "diet", label: "Dieta" },
  { key: "provider", label: "Proveedor IA" },
  { key: "memory", label: "Memoria" },
  { key: "training", label: "Entreno" },
  { key: "foods", label: "Alimentos" },
  { key: "products", label: "Productos comerciales" },
  { key: "personalFoods", label: "Alimentos personales" },
  { key: "measures", label: "Medidas" },
  { key: "preferences", label: "Preferencias" },
  { key: "notifications", label: "Notificaciones" },
  { key: "data", label: "Datos" },
  { key: "traces", label: "Trazas" },
];

export type SettingsTabsModel = {
  activeTab: SettingsTabKey;
};

export type SettingsTabsActions = {
  selectTab(tab: SettingsTabKey): void;
};

export type SettingsTabsControllerInput = {
  activeTab: SettingsTabKey;
  selectTab(tab: SettingsTabKey): void;
};

export function useSettingsTabsController(
  input: SettingsTabsControllerInput,
): ScreenController<SettingsTabsModel, SettingsTabsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;

  const model = useMemo<SettingsTabsModel>(
    () => ({ activeTab: input.activeTab }),
    [input.activeTab],
  );
  const actions = useMemo<SettingsTabsActions>(
    () => ({ selectTab: (tab) => inputRef.current.selectTab(tab) }),
    [],
  );
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type AlarmPunctuality = {
  status: "unknown" | "ontime" | "late";
  badge: string;
  detail: string;
};

export type NotificationSettingsModel = {
  isAndroid: boolean;
  alarmPunctuality: AlarmPunctuality;
  showBatteryGuidance: boolean;
  batteryGuidance: { brand: string; path: string } | null;
  permissionGranted: boolean | null;
  restChannelImportance: number | null;
  settings: NotificationSettings;
  soundOptions: ReadonlyArray<{ key: NotificationSoundKey; label: string }>;
};

export type NotificationSettingsActions = {
  openExactAlarmSettings(): void;
  openApplicationSettings(): void;
  toggleEnabled(): void;
  toggleSound(): void;
  toggleVibration(): void;
  selectSound(sound: NotificationSoundKey): void;
};

export type NotificationSettingsControllerInput = NotificationSettingsModel & NotificationSettingsActions;

export function useNotificationSettingsController(
  input: NotificationSettingsControllerInput,
): ScreenController<NotificationSettingsModel, NotificationSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<NotificationSettingsModel>(() => ({
    isAndroid: input.isAndroid,
    alarmPunctuality: input.alarmPunctuality,
    showBatteryGuidance: input.showBatteryGuidance,
    batteryGuidance: input.batteryGuidance,
    permissionGranted: input.permissionGranted,
    restChannelImportance: input.restChannelImportance,
    settings: input.settings,
    soundOptions: input.soundOptions,
  }), [
    input.alarmPunctuality,
    input.batteryGuidance,
    input.isAndroid,
    input.permissionGranted,
    input.restChannelImportance,
    input.settings,
    input.showBatteryGuidance,
    input.soundOptions,
  ]);
  const actions = useMemo<NotificationSettingsActions>(() => ({
    openExactAlarmSettings: () => inputRef.current.openExactAlarmSettings(),
    openApplicationSettings: () => inputRef.current.openApplicationSettings(),
    toggleEnabled: () => inputRef.current.toggleEnabled(),
    toggleSound: () => inputRef.current.toggleSound(),
    toggleVibration: () => inputRef.current.toggleVibration(),
    selectSound: (sound) => inputRef.current.selectSound(sound),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type DataDeletionScope = "activity" | "all-personal";

export type DataSettingsModel = {
  lastBackupLabel: string;
  backupBusy: "export" | "import" | null;
  backupResult: {
    status: "ok" | "warning" | "error";
    message: string;
    details: ReadonlyArray<string>;
    remainingDetailCount: number;
  } | null;
  deletionReport: {
    status: "complete" | "incomplete";
    scope: DataDeletionScope;
    failures: ReadonlyArray<{ id: string; label: string; message: string }>;
  } | null;
  deletionBusy: boolean;
  deletionBlocked: boolean;
};

export type DataSettingsActions = {
  exportBackup(): void;
  importBackup(): void;
  openBackupPolicy(): void;
  retryDeletion(scope: DataDeletionScope): void;
  openDeletion(scope: DataDeletionScope): void;
  openDeletionPolicy(): void;
};

export type DataSettingsControllerInput = DataSettingsModel & DataSettingsActions;

export function useDataSettingsController(
  input: DataSettingsControllerInput,
): ScreenController<DataSettingsModel, DataSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<DataSettingsModel>(() => ({
    lastBackupLabel: input.lastBackupLabel,
    backupBusy: input.backupBusy,
    backupResult: input.backupResult,
    deletionReport: input.deletionReport,
    deletionBusy: input.deletionBusy,
    deletionBlocked: input.deletionBlocked,
  }), [
    input.backupBusy,
    input.backupResult,
    input.deletionBlocked,
    input.deletionBusy,
    input.deletionReport,
    input.lastBackupLabel,
  ]);
  const actions = useMemo<DataSettingsActions>(() => ({
    exportBackup: () => inputRef.current.exportBackup(),
    importBackup: () => inputRef.current.importBackup(),
    openBackupPolicy: () => inputRef.current.openBackupPolicy(),
    retryDeletion: (scope) => inputRef.current.retryDeletion(scope),
    openDeletion: (scope) => inputRef.current.openDeletion(scope),
    openDeletionPolicy: () => inputRef.current.openDeletionPolicy(),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type MemorySettingsModel = {
  fields: ReadonlyArray<PersonalDataField>;
  newKey: string;
  newDescription: string;
  newValue: string;
};

export type MemorySettingsActions = {
  updateField(index: number, field: keyof PersonalDataField, value: string): void;
  commitField(): void;
  deleteField(index: number): void;
  changeNewKey(value: string): void;
  changeNewDescription(value: string): void;
  changeNewValue(value: string): void;
  addField(): void;
  clearAll(): void;
};

export type MemorySettingsControllerInput = MemorySettingsModel & MemorySettingsActions;

export function useMemorySettingsController(
  input: MemorySettingsControllerInput,
): ScreenController<MemorySettingsModel, MemorySettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<MemorySettingsModel>(() => ({
    fields: input.fields,
    newKey: input.newKey,
    newDescription: input.newDescription,
    newValue: input.newValue,
  }), [input.fields, input.newDescription, input.newKey, input.newValue]);
  const actions = useMemo<MemorySettingsActions>(() => ({
    updateField: (index, field, value) => inputRef.current.updateField(index, field, value),
    commitField: () => inputRef.current.commitField(),
    deleteField: (index) => inputRef.current.deleteField(index),
    changeNewKey: (value) => inputRef.current.changeNewKey(value),
    changeNewDescription: (value) => inputRef.current.changeNewDescription(value),
    changeNewValue: (value) => inputRef.current.changeNewValue(value),
    addField: () => inputRef.current.addField(),
    clearAll: () => inputRef.current.clearAll(),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type DietSettingsModel = {
  draft: DietSettings;
  issues: ReadonlyMap<string, NutritionValidationIssue>;
  latestHeightCm: number | null;
  latestWeightKg: number | null;
  birthDatePickerVisible: boolean;
  isWeb: boolean;
  isIos: boolean;
  proteinMaxGramsPerKgHint: number | null;
  carbsMaxGramsPerKgHint: number | null;
  fatMaxGramsPerKgHint: number | null;
  configuredMacroCaloriesTotal: number;
  configuredMacroCaloriesExcess: number;
  configuredMacroCaloriesRemaining: number;
  draftProteinTargetGrams: number;
  draftCarbsTargetGrams: number;
  draftFatTargetGrams: number;
  dirty: boolean;
  saveResult: string | null;
};

export type DietSettingsActions = {
  changeSex(value: "male" | "female"): void;
  changeHeight(value: string): void;
  changeBirthDate(value: string): void;
  showBirthDatePicker(): void;
  closeBirthDatePicker(): void;
  selectBirthDate(value: Date): void;
  changeGoal(value: DietGoal): void;
  changeActivityLevel(value: ActivityLevel): void;
  changeDailyCalories(value: string): void;
  calculateDailyCalories(): void;
  changeMacroMode(value: DietMacroMode): void;
  changeManualMacroCalories(macro: GkgMacroKey, value: string): void;
  changeMacroGramsPerKg(macro: GkgMacroKey, value: string): void;
  save(): void;
};

export type DietSettingsControllerInput = DietSettingsModel & DietSettingsActions;

export function useDietSettingsController(
  input: DietSettingsControllerInput,
): ScreenController<DietSettingsModel, DietSettingsActions, "birth-date-picker"> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<DietSettingsModel>(() => ({
    draft: input.draft,
    issues: input.issues,
    latestHeightCm: input.latestHeightCm,
    latestWeightKg: input.latestWeightKg,
    birthDatePickerVisible: input.birthDatePickerVisible,
    isWeb: input.isWeb,
    isIos: input.isIos,
    proteinMaxGramsPerKgHint: input.proteinMaxGramsPerKgHint,
    carbsMaxGramsPerKgHint: input.carbsMaxGramsPerKgHint,
    fatMaxGramsPerKgHint: input.fatMaxGramsPerKgHint,
    configuredMacroCaloriesTotal: input.configuredMacroCaloriesTotal,
    configuredMacroCaloriesExcess: input.configuredMacroCaloriesExcess,
    configuredMacroCaloriesRemaining: input.configuredMacroCaloriesRemaining,
    draftProteinTargetGrams: input.draftProteinTargetGrams,
    draftCarbsTargetGrams: input.draftCarbsTargetGrams,
    draftFatTargetGrams: input.draftFatTargetGrams,
    dirty: input.dirty,
    saveResult: input.saveResult,
  }), [
    input.birthDatePickerVisible,
    input.carbsMaxGramsPerKgHint,
    input.configuredMacroCaloriesExcess,
    input.configuredMacroCaloriesRemaining,
    input.configuredMacroCaloriesTotal,
    input.dirty,
    input.draft,
    input.draftCarbsTargetGrams,
    input.draftFatTargetGrams,
    input.draftProteinTargetGrams,
    input.fatMaxGramsPerKgHint,
    input.isWeb,
    input.isIos,
    input.issues,
    input.latestHeightCm,
    input.latestWeightKg,
    input.proteinMaxGramsPerKgHint,
    input.saveResult,
  ]);
  const actions = useMemo<DietSettingsActions>(() => ({
    changeSex: (value) => inputRef.current.changeSex(value),
    changeHeight: (value) => inputRef.current.changeHeight(value),
    changeBirthDate: (value) => inputRef.current.changeBirthDate(value),
    showBirthDatePicker: () => inputRef.current.showBirthDatePicker(),
    closeBirthDatePicker: () => inputRef.current.closeBirthDatePicker(),
    selectBirthDate: (value) => inputRef.current.selectBirthDate(value),
    changeGoal: (value) => inputRef.current.changeGoal(value),
    changeActivityLevel: (value) => inputRef.current.changeActivityLevel(value),
    changeDailyCalories: (value) => inputRef.current.changeDailyCalories(value),
    calculateDailyCalories: () => inputRef.current.calculateDailyCalories(),
    changeMacroMode: (value) => inputRef.current.changeMacroMode(value),
    changeManualMacroCalories: (macro, value) => inputRef.current.changeManualMacroCalories(macro, value),
    changeMacroGramsPerKg: (macro, value) => inputRef.current.changeMacroGramsPerKg(macro, value),
    save: () => inputRef.current.save(),
  }), []);
  const back = useMemo(() => ({
    layers: { "birth-date-picker": input.birthDatePickerVisible },
    handlers: {
      "birth-date-picker": () => {
        if (!inputRef.current.birthDatePickerVisible) return false;
        inputRef.current.closeBirthDatePicker();
        return true;
      },
    },
  }), [input.birthDatePickerVisible]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type MeasurementsSettingsModel = {
  measurements: ReadonlyArray<Measurement>;
  duplicateDateCount: number;
};

export type MeasurementsSettingsActions = {
  addMeasurement(): void;
  editMeasurement(measurement: Measurement): void;
  deleteMeasurement(id: string): void;
};

export type MeasurementsSettingsControllerInput = MeasurementsSettingsModel & MeasurementsSettingsActions;

export function useMeasurementsSettingsController(
  input: MeasurementsSettingsControllerInput,
): ScreenController<MeasurementsSettingsModel, MeasurementsSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<MeasurementsSettingsModel>(() => ({
    measurements: input.measurements,
    duplicateDateCount: input.duplicateDateCount,
  }), [input.duplicateDateCount, input.measurements]);
  const actions = useMemo<MeasurementsSettingsActions>(() => ({
    addMeasurement: () => inputRef.current.addMeasurement(),
    editMeasurement: (measurement) => inputRef.current.editMeasurement(measurement),
    deleteMeasurement: (id) => inputRef.current.deleteMeasurement(id),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingSettingsModel = {
  templates: ReadonlyArray<WorkoutTemplate>;
  catalogAvailability: CatalogSearchAvailability;
  catalogSummary: string;
  localOnlyExercises: ReadonlyArray<{ name: string; muscle: string }>;
};

export type TrainingSettingsActions = {
  retryCatalog(): void;
  openCatalog(): void;
};

export type TrainingSettingsControllerInput = TrainingSettingsModel & TrainingSettingsActions;

export function useTrainingSettingsController(
  input: TrainingSettingsControllerInput,
): ScreenController<TrainingSettingsModel, TrainingSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingSettingsModel>(() => ({
    templates: input.templates,
    catalogAvailability: input.catalogAvailability,
    catalogSummary: input.catalogSummary,
    localOnlyExercises: input.localOnlyExercises,
  }), [input.catalogAvailability, input.catalogSummary, input.localOnlyExercises, input.templates]);
  const actions = useMemo<TrainingSettingsActions>(() => ({
    retryCatalog: () => inputRef.current.retryCatalog(),
    openCatalog: () => inputRef.current.openCatalog(),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type FoodCatalogSettingsModel = {
  foods: ReadonlyArray<FoodCatalogEntry>;
  availability: CatalogSearchAvailability;
  foodSearch: string;
  foodCategory: string;
  selectedFood: FoodCatalogEntry | null;
  productSearch: string;
  selectedProduct: FoodCatalogEntry | null;
};

export type FoodCatalogSettingsActions = {
  retry(): void;
  changeFoodSearch(value: string): void;
  changeFoodCategory(value: string): void;
  selectFood(food: FoodCatalogEntry | null): void;
  changeProductSearch(value: string): void;
  selectProduct(food: FoodCatalogEntry | null): void;
};

export type FoodCatalogSettingsControllerInput = FoodCatalogSettingsModel & FoodCatalogSettingsActions;

export function useFoodCatalogSettingsController(
  input: FoodCatalogSettingsControllerInput,
): ScreenController<
  FoodCatalogSettingsModel,
  FoodCatalogSettingsActions,
  "settings-food-detail" | "settings-product-detail"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<FoodCatalogSettingsModel>(() => ({
    foods: input.foods,
    availability: input.availability,
    foodSearch: input.foodSearch,
    foodCategory: input.foodCategory,
    selectedFood: input.selectedFood,
    productSearch: input.productSearch,
    selectedProduct: input.selectedProduct,
  }), [input.availability, input.foodCategory, input.foodSearch, input.foods, input.productSearch, input.selectedFood, input.selectedProduct]);
  const actions = useMemo<FoodCatalogSettingsActions>(() => ({
    retry: () => inputRef.current.retry(),
    changeFoodSearch: (value) => inputRef.current.changeFoodSearch(value),
    changeFoodCategory: (value) => inputRef.current.changeFoodCategory(value),
    selectFood: (food) => inputRef.current.selectFood(food),
    changeProductSearch: (value) => inputRef.current.changeProductSearch(value),
    selectProduct: (food) => inputRef.current.selectProduct(food),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "settings-food-detail": input.selectedFood !== null,
      "settings-product-detail": input.selectedProduct !== null,
    },
    handlers: {
      "settings-food-detail": () => {
        if (!inputRef.current.selectedFood) return false;
        inputRef.current.selectFood(null);
        return true;
      },
      "settings-product-detail": () => {
        if (!inputRef.current.selectedProduct) return false;
        inputRef.current.selectProduct(null);
        return true;
      },
    },
  }), [input.selectedFood, input.selectedProduct]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
