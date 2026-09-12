import { useMemo, useRef, useState } from "react";

import type { PersonalDataField } from "../agent/personalData";
import type {
  OpenAIReasoningEffort,
  Provider,
  ProviderConfiguration,
  ProviderDraft,
} from "../agent/providerConfiguration";
import type {
  ProviderConnectionStatus,
  ProviderStatusSeverity,
} from "../agent/providerPresentation";
import type {
  ActivityLevel,
  DietGoal,
  DietSettings,
  GkgMacroKey,
} from "../diet/model";
import type { DietMacroMode, NutritionValidationIssue } from "../diet/nutritionContract";
import type { Measurement } from "../measurements/measurementContract";
import { normalizePersonalFood } from "../catalogs/sources";
import type { CatalogSearchAvailability, FoodCatalogEntry } from "../catalogs/types";
import type { WorkoutTemplate } from "../training/workoutTemplateOperations";
import type { NotificationSoundKey } from "../notifications/notificationSounds";
import type { NotificationSettings } from "../storage/userPreferences";
import type { ScreenController } from "./types";

export type ProviderModelOption = {
  id: string;
  display_name?: string | null;
  owned_by?: string | null;
};
export type ProviderModelMessage = { text: string; severity: ProviderStatusSeverity } | null;

export type ProviderSettingsModel = {
  keys: ReadonlyArray<ProviderConfiguration>;
  chatProvider: Provider | null;
  foodProvider: Provider | null;
  healthSafetyProviders: Readonly<Record<Provider, boolean>>;
  secureStoreAvailable: boolean;
  isWeb: boolean;
  chatDropdownOpen: boolean;
  foodDropdownOpen: boolean;
  drafts: Readonly<Partial<Record<Provider, ProviderDraft>>>;
  keyVisibility: Readonly<Record<Provider, boolean>>;
  connectionStatus: Readonly<Record<Provider, ProviderConnectionStatus>>;
  saveLoading: Readonly<Record<Provider, boolean>>;
  anthropic: {
    dropdownOpen: boolean;
    filter: string;
    loading: boolean;
    message: ProviderModelMessage;
    options: ReadonlyArray<ProviderModelOption>;
  };
  openai: {
    dropdownOpen: boolean;
    filter: string;
    loading: boolean;
    message: ProviderModelMessage;
    options: ReadonlyArray<ProviderModelOption>;
    selectedEffort: OpenAIReasoningEffort | null;
    supportedEfforts: ReadonlyArray<OpenAIReasoningEffort>;
    normalizedModel: string;
  };
  google: {
    dropdownOpen: boolean;
    filter: string;
    loading: boolean;
    message: ProviderModelMessage;
    options: ReadonlyArray<ProviderModelOption>;
  };
};

export type ProviderSettingsActions = {
  updateHealthSafetyConsent(provider: Provider, enabled: boolean): void;
  selectChatProvider(provider: Provider): void;
  selectFoodProvider(provider: Provider): void;
  setChatDropdownOpen(open: boolean): void;
  setFoodDropdownOpen(open: boolean): void;
  updateDraft(provider: Provider, patch: Partial<ProviderDraft>): void;
  toggleKeyVisibility(provider: Provider): void;
  save(provider: Provider): void;
  openDelete(provider: Provider): void;
  toggleAnthropicDropdown(): void;
  toggleOpenAIDropdown(): void;
  toggleGoogleDropdown(): void;
  setAnthropicFilter(value: string): void;
  setOpenAIFilter(value: string): void;
  setGoogleFilter(value: string): void;
  setAnthropicMessage(message: NonNullable<ProviderModelMessage>): void;
  setOpenAIMessage(message: NonNullable<ProviderModelMessage>): void;
  setGoogleMessage(message: NonNullable<ProviderModelMessage>): void;
  loadAnthropicModels(apiKey: string, workspaceId?: string): void;
  loadOpenAIModels(apiKey: string): void;
  loadGoogleModels(apiKey: string): void;
  selectAnthropicModel(id: string): void;
  selectOpenAIModel(id: string): void;
  selectGoogleModel(id: string): void;
};

export type ProviderSettingsControllerInput = ProviderSettingsModel & ProviderSettingsActions;

export function useProviderSettingsController(
  input: ProviderSettingsControllerInput,
): ScreenController<
  ProviderSettingsModel,
  ProviderSettingsActions,
  "chat-provider-dropdown" | "food-provider-dropdown" | "anthropic-model-dropdown" | "openai-model-dropdown" | "google-model-dropdown"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<ProviderSettingsModel>(() => ({
    keys: input.keys,
    chatProvider: input.chatProvider,
    foodProvider: input.foodProvider,
    healthSafetyProviders: input.healthSafetyProviders,
    secureStoreAvailable: input.secureStoreAvailable,
    isWeb: input.isWeb,
    chatDropdownOpen: input.chatDropdownOpen,
    foodDropdownOpen: input.foodDropdownOpen,
    drafts: input.drafts,
    keyVisibility: input.keyVisibility,
    connectionStatus: input.connectionStatus,
    saveLoading: input.saveLoading,
    anthropic: {
      dropdownOpen: input.anthropic.dropdownOpen,
      filter: input.anthropic.filter,
      loading: input.anthropic.loading,
      message: input.anthropic.message,
      options: input.anthropic.options,
    },
    openai: {
      dropdownOpen: input.openai.dropdownOpen,
      filter: input.openai.filter,
      loading: input.openai.loading,
      message: input.openai.message,
      options: input.openai.options,
      selectedEffort: input.openai.selectedEffort,
      supportedEfforts: input.openai.supportedEfforts,
      normalizedModel: input.openai.normalizedModel,
    },
    google: {
      dropdownOpen: input.google.dropdownOpen,
      filter: input.google.filter,
      loading: input.google.loading,
      message: input.google.message,
      options: input.google.options,
    },
  }), [
    input.anthropic.dropdownOpen,
    input.anthropic.filter,
    input.anthropic.loading,
    input.anthropic.message,
    input.anthropic.options,
    input.chatDropdownOpen,
    input.chatProvider,
    input.connectionStatus,
    input.drafts,
    input.foodDropdownOpen,
    input.foodProvider,
    input.google.dropdownOpen,
    input.google.filter,
    input.google.loading,
    input.google.message,
    input.google.options,
    input.healthSafetyProviders,
    input.isWeb,
    input.keyVisibility,
    input.keys,
    input.openai.dropdownOpen,
    input.openai.filter,
    input.openai.loading,
    input.openai.message,
    input.openai.normalizedModel,
    input.openai.options,
    input.openai.selectedEffort,
    input.openai.supportedEfforts,
    input.saveLoading,
    input.secureStoreAvailable,
  ]);
  const actions = useMemo<ProviderSettingsActions>(() => ({
    updateHealthSafetyConsent: (provider, enabled) => inputRef.current.updateHealthSafetyConsent(provider, enabled),
    selectChatProvider: (provider) => inputRef.current.selectChatProvider(provider),
    selectFoodProvider: (provider) => inputRef.current.selectFoodProvider(provider),
    setChatDropdownOpen: (open) => inputRef.current.setChatDropdownOpen(open),
    setFoodDropdownOpen: (open) => inputRef.current.setFoodDropdownOpen(open),
    updateDraft: (provider, patch) => inputRef.current.updateDraft(provider, patch),
    toggleKeyVisibility: (provider) => inputRef.current.toggleKeyVisibility(provider),
    save: (provider) => inputRef.current.save(provider),
    openDelete: (provider) => inputRef.current.openDelete(provider),
    toggleAnthropicDropdown: () => inputRef.current.toggleAnthropicDropdown(),
    toggleOpenAIDropdown: () => inputRef.current.toggleOpenAIDropdown(),
    toggleGoogleDropdown: () => inputRef.current.toggleGoogleDropdown(),
    setAnthropicFilter: (value) => inputRef.current.setAnthropicFilter(value),
    setOpenAIFilter: (value) => inputRef.current.setOpenAIFilter(value),
    setGoogleFilter: (value) => inputRef.current.setGoogleFilter(value),
    setAnthropicMessage: (message) => inputRef.current.setAnthropicMessage(message),
    setOpenAIMessage: (message) => inputRef.current.setOpenAIMessage(message),
    setGoogleMessage: (message) => inputRef.current.setGoogleMessage(message),
    loadAnthropicModels: (apiKey, workspaceId) => inputRef.current.loadAnthropicModels(apiKey, workspaceId),
    loadOpenAIModels: (apiKey) => inputRef.current.loadOpenAIModels(apiKey),
    loadGoogleModels: (apiKey) => inputRef.current.loadGoogleModels(apiKey),
    selectAnthropicModel: (id) => inputRef.current.selectAnthropicModel(id),
    selectOpenAIModel: (id) => inputRef.current.selectOpenAIModel(id),
    selectGoogleModel: (id) => inputRef.current.selectGoogleModel(id),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "chat-provider-dropdown": input.chatDropdownOpen,
      "food-provider-dropdown": input.foodDropdownOpen,
      "anthropic-model-dropdown": input.anthropic.dropdownOpen,
      "openai-model-dropdown": input.openai.dropdownOpen,
      "google-model-dropdown": input.google.dropdownOpen,
    },
    handlers: {
      "chat-provider-dropdown": () => { inputRef.current.setChatDropdownOpen(false); return true; },
      "food-provider-dropdown": () => { inputRef.current.setFoodDropdownOpen(false); return true; },
      "anthropic-model-dropdown": () => { inputRef.current.toggleAnthropicDropdown(); return true; },
      "openai-model-dropdown": () => { inputRef.current.toggleOpenAIDropdown(); return true; },
      "google-model-dropdown": () => { inputRef.current.toggleGoogleDropdown(); return true; },
    },
  }), [
    input.anthropic.dropdownOpen,
    input.chatDropdownOpen,
    input.foodDropdownOpen,
    input.google.dropdownOpen,
    input.openai.dropdownOpen,
  ]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

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

export type PersonalFoodsSettingsModel = {
  foods: ReadonlyArray<FoodCatalogEntry>;
  filteredFoods: ReadonlyArray<FoodCatalogEntry>;
  search: string;
  formVisible: boolean;
  draft: Readonly<Partial<FoodCatalogEntry>>;
  editingFoodId: string | null;
  assistantVisible: boolean;
  selectedFood: Readonly<FoodCatalogEntry> | null;
};

export type PersonalFoodsSettingsActions = {
  openForm(): void;
  openAssistant(): void;
  closeAssistant(): void;
  addFromAssistant(result: Record<string, unknown>): void;
  closeForm(): void;
  updateDraft(field: keyof FoodCatalogEntry, value: string): void;
  saveDraft(): void;
  setSearch(value: string): void;
  selectFood(food: FoodCatalogEntry): void;
  closeDetail(): void;
  editSelectedFood(): void;
  deleteSelectedFood(): void;
  closeAll(): void;
};

export type PersonalFoodsSettingsControllerInput = {
  foods: ReadonlyArray<FoodCatalogEntry>;
  updateFoods(updater: (previous: FoodCatalogEntry[]) => FoodCatalogEntry[]): void;
  createFoodId(): string;
};

export function usePersonalFoodsSettingsController(
  input: PersonalFoodsSettingsControllerInput,
): ScreenController<
  PersonalFoodsSettingsModel,
  PersonalFoodsSettingsActions,
  "personal-food-ai-chat" | "personal-food-form" | "settings-personal-food-detail"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const [search, setSearch] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [draft, setDraft] = useState<Partial<FoodCatalogEntry>>({});
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodCatalogEntry | null>(null);
  const selectedFoodRef = useRef(selectedFood);
  selectedFoodRef.current = selectedFood;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const editingFoodIdRef = useRef(editingFoodId);
  editingFoodIdRef.current = editingFoodId;

  const filteredFoods = useMemo(() => {
    if (!search) return input.foods;
    const normalizedSearch = search.toLowerCase();
    return input.foods.filter((food) => (
      food.name.toLowerCase().includes(normalizedSearch)
      || food.category.toLowerCase().includes(normalizedSearch)
    ));
  }, [input.foods, search]);

  const actions = useMemo<PersonalFoodsSettingsActions>(() => ({
    openForm: () => {
      setDraft({});
      setEditingFoodId(null);
      setFormVisible(true);
      setSelectedFood(null);
      setAssistantVisible(false);
    },
    openAssistant: () => {
      setAssistantVisible(true);
      setFormVisible(false);
      setSelectedFood(null);
    },
    closeAssistant: () => setAssistantVisible(false),
    addFromAssistant: (result) => {
      const entry = normalizePersonalFood({
        id: inputRef.current.createFoodId(),
        name: String(result.name ?? ""),
        category: String(result.category ?? "otro"),
        calories_per_100g: Number(result.calories_per_100g) || 0,
        protein_per_100g: Number(result.protein_per_100g) || 0,
        carbs_per_100g: Number(result.carbs_per_100g) || 0,
        fat_per_100g: Number(result.fat_per_100g) || 0,
        fiber_per_100g: Number(result.fiber_per_100g) || 0,
        serving_size_g: Number(result.serving_size_g) || 100,
        serving_description: String(result.serving_description ?? ""),
      });
      inputRef.current.updateFoods((previous) => [...previous, entry]);
      setAssistantVisible(false);
    },
    closeForm: () => setFormVisible(false),
    updateDraft: (field, value) => setDraft((previous) => ({ ...previous, [field]: value })),
    saveDraft: () => {
      const currentDraft = draftRef.current;
      if (!currentDraft.name?.trim()) return;
      const currentEditingId = editingFoodIdRef.current;
      const entry = normalizePersonalFood({
        id: currentEditingId ?? inputRef.current.createFoodId(),
        name: currentDraft.name.trim(),
        category: currentDraft.category?.trim() ?? "otro",
        calories_per_100g: Number(currentDraft.calories_per_100g) || 0,
        protein_per_100g: Number(currentDraft.protein_per_100g) || 0,
        carbs_per_100g: Number(currentDraft.carbs_per_100g) || 0,
        fat_per_100g: Number(currentDraft.fat_per_100g) || 0,
        fiber_per_100g: Number(currentDraft.fiber_per_100g) || 0,
        serving_size_g: Number(currentDraft.serving_size_g) || 100,
        serving_description: currentDraft.serving_description?.trim() ?? "",
      });
      inputRef.current.updateFoods((previous) => currentEditingId
        ? previous.map((food) => (food.id === currentEditingId ? entry : food))
        : [...previous, entry]);
      setFormVisible(false);
      setDraft({});
      setEditingFoodId(null);
    },
    setSearch,
    selectFood: (food) => {
      setSelectedFood(food);
      setFormVisible(false);
    },
    closeDetail: () => setSelectedFood(null),
    editSelectedFood: () => {
      const food = selectedFoodRef.current;
      if (!food) return;
      setDraft({
        name: food.name,
        category: food.category,
        calories_per_100g: food.calories_per_100g,
        protein_per_100g: food.protein_per_100g,
        carbs_per_100g: food.carbs_per_100g,
        fat_per_100g: food.fat_per_100g,
        fiber_per_100g: food.fiber_per_100g,
        serving_size_g: food.serving_size_g,
        serving_description: food.serving_description,
      });
      setEditingFoodId(food.id);
      setFormVisible(true);
      setSelectedFood(null);
    },
    deleteSelectedFood: () => {
      const food = selectedFoodRef.current;
      if (!food) return;
      inputRef.current.updateFoods((previous) => previous.filter((entry) => entry.id !== food.id));
      setSelectedFood(null);
    },
    closeAll: () => {
      setSelectedFood(null);
      setFormVisible(false);
      setAssistantVisible(false);
    },
  }), []);
  const model = useMemo<PersonalFoodsSettingsModel>(() => ({
    foods: input.foods,
    filteredFoods,
    search,
    formVisible,
    draft,
    editingFoodId,
    assistantVisible,
    selectedFood,
  }), [
    assistantVisible,
    draft,
    editingFoodId,
    filteredFoods,
    formVisible,
    input.foods,
    search,
    selectedFood,
  ]);
  const back = useMemo(() => ({
    layers: {
      "personal-food-ai-chat": assistantVisible,
      "personal-food-form": formVisible,
      "settings-personal-food-detail": selectedFood !== null,
    },
    handlers: {
      "personal-food-ai-chat": () => { setAssistantVisible(false); return true; },
      "personal-food-form": () => { setFormVisible(false); return true; },
      "settings-personal-food-detail": () => { setSelectedFood(null); return true; },
    },
  }), [assistantVisible, formVisible, selectedFood]);
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
