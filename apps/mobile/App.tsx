import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";

import { mobileTheme } from "./theme";

type TabKey = "home" | "training" | "diet" | "measures" | "chat" | "settings";
type SettingsTabKey = "diet" | "provider" | "memory" | "training";

type ExerciseSeries = {
  id: string;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
};
type RoutineIconName =
  | "activity"
  | "heart"
  | "zap"
  | "target"
  | "wind"
  | "shield"
  | "compass"
  | "crosshair"
  | "award"
  | "star"
  | "sun"
  | "moon"
  | "sliders"
  | "trending-up";

type WorkoutTemplate = {
  id: string;
  name: string;
  category?: TrainingCategory;
  icon?: RoutineIconName;
  duration_minutes?: string;
  exercises: Array<{
    id: string;
    name?: string;
    image_uri?: string | null;
    sets: number[];
    series?: ExerciseSeries[];
    muscle?: string;
    load_kg?: number | null;
    rest_seconds?: number | null;
  }>;
};
type WorkoutSessionStatus = "running" | "paused";
type WorkoutSession = {
  id: string;
  template_id: string;
  template_name: string;
  category: TrainingCategory;
  started_at: string;
  current_exercise_index: number;
  current_series_index: number;
  completed_series_keys: string[];
  completed_series_count: number;
  total_series_count: number;
  elapsed_seconds: number;
  is_resting: boolean;
  rest_seconds_left: number;
  status: WorkoutSessionStatus;
};
type WorkoutSessionSummary = {
  id: string;
  template_id: string;
  template_name: string;
  finished_at: string;
  elapsed_seconds: number;
  completed_series_count: number;
  total_series_count: number;
  estimated_calories: number;
  total_volume_kg: number;
  total_reps: number;
};
type WorkoutCompletionModalState = {
  summary: WorkoutSessionSummary;
  has_template_changes: boolean;
  original_template: WorkoutTemplate | null;
};
type DietItem = {
  id: string;
  title: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
type DietMeal = { id: string; title: string; items: DietItem[] };
type DietDay = { day_date: string; meals: DietMeal[] };
type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
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
type DietMacroMode = "manual_calories" | "protein_by_weight";
type GkgMacroKey = "protein" | "carbs" | "fat";
type DietMealCategory = "Desayuno" | "Almuerzo" | "Comida" | "Merienda" | "Cena";
type DietSettings = {
  daily_calories: string;
  macro_mode: DietMacroMode;
  manual_macro_calories: {
    carbs: string;
    protein: string;
    fat: string;
  };
  protein_grams_per_kg: string;
  carbs_grams_per_kg: string;
  fat_grams_per_kg: string;
};
type ChatThread = { id: string; title: string | null };
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
type Provider = "anthropic" | "openai" | "google";
type AIKey = { provider: Provider; is_active: boolean; api_key: string; model: string };
type ProviderDraft = { api_key: string; model: string };
type AnthropicModelOption = { id: string; display_name: string | null };
type OpenAIModelOption = { id: string; owned_by: string | null };
type GoogleModelOption = { id: string; display_name: string | null };
type ProviderConnectionState = "connected" | "disconnected" | "checking" | "unknown";
type ProviderStatusSeverity = "success" | "warning" | "error" | "info";
type ProviderConnectionStatus = {
  state: ProviderConnectionState;
  detail: string;
  severity: ProviderStatusSeverity;
};
type ProviderConnectionCheckResult = {
  ok: boolean;
  message: string;
  severity: Exclude<ProviderStatusSeverity, "info">;
};
type ProviderDeleteModalState = { provider: Provider; maskedApiKey: string };
type ChatInputMessage = { role: "user" | "assistant" | "system"; content: string };
type FoodEstimatorImage = {
  id: string;
  uri: string;
  base64: string;
  mime_type: string;
};
type DietItemMenuState = { meal_id: string; item_id: string } | null;
type DietEditingItemState = { meal_id: string; item_id: string } | null;
type TrainingFilter = "all" | "strength" | "hypertrophy" | "cardio" | "flexibility";
type TrainingCategory = Exclude<TrainingFilter, "all">;
type TrainingTemplateScreenMode = "detail" | "edit";
type TrainingStatsPeriodKey = "3m" | "6m" | "12m" | "all";
type TrainingStatsMetricKey = "volume" | "reps" | "duration";
type MeasuresDashboardPeriodKey = "1m" | "3m" | "6m" | "all";
type TemplateSeriesPointer = {
  exerciseIndex: number;
  seriesIndex: number;
  exerciseId: string;
  seriesId: string;
  exerciseName: string;
  series: ExerciseSeries;
};

type Dashboard = {
  calories: number;
  weight: number | null;
};

type LocalStore = {
  templates: WorkoutTemplate[];
  workoutHistory: WorkoutSessionSummary[];
  dietByDate: Record<string, DietDay>;
  dietSettings: DietSettings;
  measurements: Measurement[];
  threads: ChatThread[];
  messagesByThread: Record<string, ChatMessage[]>;
  keys: AIKey[];
};

const STORAGE_KEY = "gymnasia.mobile.local.v3";
const SESSION_STORAGE_KEY = "gymnasia.mobile.training.session.v1";
const CHAT_SYSTEM_PROMPT_CACHE_KEY = "gymnasia.mobile.chat.system_prompt.v1";
const PERSONAL_DATA_STORAGE_KEY = "gymnasia.mobile.personal_data.v1";
const SECURE_STORE_API_KEY_PREFIX = "gymnasia.mobile.v3.provider.api_key";
const LEGACY_STORAGE_KEYS = [
  "gymnasia.mobile.local.v1",
  "gymnasia.mobile.local.v2",
];
const LEGACY_SECURE_STORE_PREFIXES = [
  "gymnasia.mobile.provider.api_key",
  "gymnasia.mobile.v2.provider.api_key",
];
const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-1.5-flash",
};
const PROVIDERS: Provider[] = ["openai", "anthropic", "google"];
const FOOD_ESTIMATOR_PROVIDER_PRIORITY: Provider[] = ["google", "openai", "anthropic"];
const FOOD_ESTIMATOR_MAX_IMAGES = 6;
const EXERCISES_REPO_BASE_URL =
  "https://raw.githubusercontent.com/maximofn/gymnasia/main/ejercicios";
const EXERCISES_ALL_URL = `${EXERCISES_REPO_BASE_URL}/all.json`;
const EXERCISES_CACHE_KEY = "gymnasia.mobile.exercises_repo.v2";
const CHAT_SYSTEM_PROMPT_URL =
  "https://raw.githubusercontent.com/maximofn/gymnasia/main/prompts/AGENTS.md";
const DEFAULT_CHAT_SYSTEM_PROMPT =
  "Eres Gymnasia Coach, un asistente de gimnasio y entrenador personal. " +
  "Tu trabajo es ayudar con entrenamiento, nutricion, habitos y progreso fisico. " +
  "Responde siempre en espanol. Responde de forma breve, clara, practica y accionable. " +
  "Prioriza consejos seguros, realistas y faciles de aplicar.\n\n" +
  "## Herramientas de memoria\n\n" +
  "Tienes 4 herramientas: list_personal_data_keys, read_field_description(key), read_field_value(key), save_personal_data(personal_data).\n" +
  "- Al saludar: 1) list_personal_data_keys, 2) read_field_description de keys candidatas, 3) read_field_value del campo correcto, 4) saluda con su nombre.\n" +
  "- Al guardar datos: 1) list keys existentes, 2) lee datos actuales, 3) save_personal_data con array completo [{key,description,value}].\n" +
  "- No menciones las herramientas al usuario.";
const ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE =
  "Anthropic en navegador necesita un proxy HTTP por CORS. " +
  "Configura EXPO_PUBLIC_API_BASE_URL apuntando a tu proxy, o usa OpenAI/Google en web, " +
  "o abre la app en el movil.";
const FOOD_ESTIMATOR_SYSTEM_PROMPT =
  "Eres Gymnasia Food Estimator, un nutricionista experto en estimación visual de comidas. " +
  "Tu tarea es estimar siempre: calorías totales (kcal), gramos de proteína, gramos de carbohidratos, gramos de grasas y peso total de la comida en gramos. " +
  "Si la información es incierta, indica rangos aproximados y explica supuestos breves. " +
  "Responde en español, de forma clara y práctica. " +
  "Si el usuario pide 'Devuelve json' o 'Devuelve el json', responde únicamente con JSON válido y sin texto adicional, " +
  "con estas claves exactas: dish_name, calories_kcal, protein_g, carbs_g, fat_g. " +
  "Cuando el usuario pregunte o debata, responde usando el contexto previo de la conversación y las fotos adjuntas.";
const PROVIDER_UI_META: Record<
  Provider,
  {
    label: string;
    models_hint: string;
    avatar_bg: string;
    avatar_text: string;
  }
> = {
  anthropic: {
    label: "Anthropic",
    models_hint: "Claude Sonnet 4.5, Opus 4",
    avatar_bg: "#CFA06D",
    avatar_text: "#F8F0E5",
  },
  openai: {
    label: "OpenAI",
    models_hint: "GPT-4o, o1, o3",
    avatar_bg: "#18B894",
    avatar_text: "#E9FFF9",
  },
  google: {
    label: "Google",
    models_hint: "Gemini 2.5 Pro, Flash",
    avatar_bg: "#4D84FF",
    avatar_text: "#EFF4FF",
  },
};
const DEFAULT_WEB_API_BASE_URL = "http://127.0.0.1:8000";
const PROVIDER_STATUS_COPY = {
  success: "Conexión verificada.",
  warningNoKey: "Atención: guarda una API key para conectar el proveedor.",
  warningPending: "Atención: pendiente de verificación. Pulsa Guardar.",
  warningChecking: "Atención: comprobando conexión...",
  warningModelUnavailablePrefix: "Atención: API key verificada. Modelo no disponible: ",
  warningModelsUnavailable: "Atención: no se pudieron cargar los modelos de Anthropic.",
  errorFallback: "Error: no se pudo comprobar la conexión.",
};

function resolveWebApiBaseUrl(): string {
  const maybeProcess = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  const configured = maybeProcess.process?.env?.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
  return (configured || DEFAULT_WEB_API_BASE_URL).replace(/\/+$/, "");
}

function buildWebProxyUrl(path: string): string {
  return `${resolveWebApiBaseUrl()}${path}`;
}

function normalizeChatSystemPrompt(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return normalized || DEFAULT_CHAT_SYSTEM_PROMPT;
}

async function loadChatSystemPrompt(): Promise<string> {
  try {
    const response = await fetch(`${CHAT_SYSTEM_PROMPT_URL}?ts=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`GitHub prompt error (${response.status})`);
    }
    const remotePrompt = normalizeChatSystemPrompt(await response.text());
    AsyncStorage.setItem(CHAT_SYSTEM_PROMPT_CACHE_KEY, remotePrompt).catch(() => {
      // ignore cache write errors
    });
    return remotePrompt;
  } catch {
    try {
      const cachedPrompt = await AsyncStorage.getItem(CHAT_SYSTEM_PROMPT_CACHE_KEY);
      return normalizeChatSystemPrompt(cachedPrompt);
    } catch {
      return DEFAULT_CHAT_SYSTEM_PROMPT;
    }
  }
}

type ExerciseRepoEntry = {
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

async function loadExercisesRepo(): Promise<ExerciseRepoEntry[]> {
  try {
    const response = await fetch(`${EXERCISES_ALL_URL}?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`Exercises fetch error (${response.status})`);
    const exercises: ExerciseRepoEntry[] = await response.json();
    AsyncStorage.setItem(EXERCISES_CACHE_KEY, JSON.stringify(exercises)).catch(() => {});
    return exercises;
  } catch {
    try {
      const cached = await AsyncStorage.getItem(EXERCISES_CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    } catch {
      return [];
    }
  }
}

function getExerciseImageUrl(entry: ExerciseRepoEntry, gender: "male" | "female"): string {
  const imagePath = gender === "female" ? entry.image_female : entry.image_male;
  return `${EXERCISES_REPO_BASE_URL}/${imagePath}`;
}

type PersonalDataField = { key: string; description: string; value: string };

async function loadPersonalData(): Promise<PersonalDataField[]> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_DATA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

async function savePersonalData(fields: PersonalDataField[]): Promise<void> {
  await AsyncStorage.setItem(PERSONAL_DATA_STORAGE_KEY, JSON.stringify(fields));
}

function personalDataToJson(fields: PersonalDataField[]): string {
  return JSON.stringify(fields, null, 2);
}

function parsePersonalDataInput(input: unknown): PersonalDataField[] {
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  if (Array.isArray(input)) return input;
  return [];
}

const SAVE_PERSONAL_DATA_TOOL = "save_personal_data";
const SAVE_PERSONAL_DATA_DESC =
  "Guarda o actualiza los datos personales del usuario. " +
  "Usa esta herramienta SIEMPRE que el usuario comparta informacion personal como nombre, edad, peso, altura, objetivos de fitness, lesiones, experiencia, etc. " +
  "El campo personal_data debe contener TODOS los datos personales conocidos del usuario como un array JSON completo, no solo los nuevos. " +
  'Cada elemento del array tiene: key (nombre del campo), description (para que sirve este campo), value (el valor). ' +
  'Ejemplo: [{"key":"Nombre","description":"Nombre real del usuario","value":"Juan"}]';
const SAVE_PERSONAL_DATA_PARAM_DESC =
  'Array JSON completo con todos los datos personales. Cada objeto tiene key, description y value. ' +
  'Ejemplo: [{"key":"Nombre","description":"Nombre real del usuario","value":"Juan"},{"key":"Objetivo","description":"Objetivo principal de fitness","value":"Ganar masa muscular"}]';

const LIST_KEYS_TOOL = "list_personal_data_keys";
const LIST_KEYS_DESC =
  "Devuelve la lista de todos los campos (keys) guardados en la memoria personal del usuario. " +
  "Usa esta herramienta como primer paso para descubrir que datos hay guardados.";

const READ_DESCRIPTION_TOOL = "read_field_description";
const READ_DESCRIPTION_DESC =
  "Lee la descripcion de un campo especifico de la memoria personal. " +
  "Recibe el key del campo y devuelve su description, que explica para que sirve ese campo. " +
  "Usa esta herramienta para identificar en que campo esta la informacion que buscas.";
const READ_DESCRIPTION_PARAM_DESC = "El key (nombre) del campo cuya descripcion quieres leer";

const READ_VALUE_TOOL = "read_field_value";
const READ_VALUE_DESC =
  "Lee el valor de un campo especifico de la memoria personal. " +
  "Recibe el key del campo y devuelve su value. " +
  "Usa esta herramienta una vez que hayas identificado el campo correcto mediante su description.";
const READ_VALUE_PARAM_DESC = "El key (nombre) del campo cuyo valor quieres leer";

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === SAVE_PERSONAL_DATA_TOOL) {
    const fields = parsePersonalDataInput(args.personal_data);
    await savePersonalData(fields);
    return "Datos personales guardados correctamente.";
  }
  if (name === LIST_KEYS_TOOL) {
    const fields = await loadPersonalData();
    if (fields.length === 0) return "No hay campos guardados.";
    return JSON.stringify(fields.map((f) => f.key));
  }
  if (name === READ_DESCRIPTION_TOOL) {
    const key = (args.key as string) ?? "";
    const fields = await loadPersonalData();
    const field = fields.find((f) => f.key === key);
    if (!field) return `Campo "${key}" no encontrado.`;
    return field.description || "(sin descripcion)";
  }
  if (name === READ_VALUE_TOOL) {
    const key = (args.key as string) ?? "";
    const fields = await loadPersonalData();
    const field = fields.find((f) => f.key === key);
    if (!field) return `Campo "${key}" no encontrado.`;
    return field.value || "(sin valor)";
  }
  return "Herramienta no reconocida.";
}

function resolveFoodEstimatorProvider(keys: AIKey[]): AIKey | null {
  for (const provider of FOOD_ESTIMATOR_PROVIDER_PRIORITY) {
    const configured = keys.find((item) => item.provider === provider);
    if (!configured) continue;
    const apiKey = configured.api_key.trim();
    if (!apiKey) continue;
    return {
      ...configured,
      api_key: apiKey,
      model: configured.model.trim() || DEFAULT_MODELS[provider],
    };
  }
  return null;
}

function createDefaultProviderKeys(): AIKey[] {
  return [
    { provider: "openai", is_active: true, api_key: "", model: DEFAULT_MODELS.openai },
    { provider: "anthropic", is_active: false, api_key: "", model: DEFAULT_MODELS.anthropic },
    { provider: "google", is_active: false, api_key: "", model: DEFAULT_MODELS.google },
  ];
}

function createProviderDraftMap(keys: AIKey[]): Record<Provider, ProviderDraft> {
  const byProvider = new Map<Provider, AIKey>();
  keys.forEach((item) => {
    byProvider.set(item.provider, item);
  });
  return PROVIDERS.reduce((acc, provider) => {
    const current = byProvider.get(provider);
    acc[provider] = {
      api_key: current?.api_key ?? "",
      model: current?.model ?? DEFAULT_MODELS[provider],
    };
    return acc;
  }, {} as Record<Provider, ProviderDraft>);
}

function createProviderConnectionStatusMap(
  keys: AIKey[],
): Record<Provider, ProviderConnectionStatus> {
  const byProvider = new Map<Provider, AIKey>();
  keys.forEach((item) => {
    byProvider.set(item.provider, item);
  });

  return PROVIDERS.reduce((acc, provider) => {
    const hasApiKey = !!(byProvider.get(provider)?.api_key ?? "").trim();
    acc[provider] = hasApiKey
      ? {
          state: "unknown",
          detail: PROVIDER_STATUS_COPY.warningPending,
          severity: "warning",
        }
      : {
          state: "disconnected",
          detail: PROVIDER_STATUS_COPY.warningNoKey,
          severity: "warning",
        };
    return acc;
  }, {} as Record<Provider, ProviderConnectionStatus>);
}

function createProviderBooleanMap(defaultValue: boolean): Record<Provider, boolean> {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider] = defaultValue;
    return acc;
  }, {} as Record<Provider, boolean>);
}

function providerStatusPalette(
  severity: ProviderStatusSeverity,
): { backgroundColor: string; dotColor: string; textColor: string } {
  if (severity === "success") {
    return {
      backgroundColor: "rgba(16,185,129,0.18)",
      dotColor: "#24D68B",
      textColor: "#24D68B",
    };
  }
  if (severity === "warning") {
    return {
      backgroundColor: "rgba(255,205,77,0.2)",
      dotColor: "#FFCD4D",
      textColor: "#FFCD4D",
    };
  }
  if (severity === "error") {
    return {
      backgroundColor: "rgba(255,110,110,0.2)",
      dotColor: "#FF6E6E",
      textColor: "#FF6E6E",
    };
  }
  return {
    backgroundColor: "rgba(69,141,255,0.2)",
    dotColor: "#77A8FF",
    textColor: "#77A8FF",
  };
}

function providerDetailColorBySeverity(severity: ProviderStatusSeverity): string {
  if (severity === "success") return "#24D68B";
  if (severity === "warning") return "#FFCD4D";
  if (severity === "error") return "#FF6E6E";
  return "#77A8FF";
}

function toSevereProviderDetail(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return PROVIDER_STATUS_COPY.errorFallback;
  if (trimmed.toLowerCase().startsWith("error grave:")) return trimmed;
  return `Error grave: ${trimmed}`;
}

function toMediumProviderDetail(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Atención media: revisa la configuración del proveedor.";
  if (trimmed.toLowerCase().startsWith("atención media:")) return trimmed;
  return `Atención media: ${trimmed}`;
}

function providerDeleteWarningText(provider: Provider): string {
  if (provider === "anthropic") {
    return "El asistente IA dejará de funcionar con modelos de Anthropic hasta que añadas una nueva clave.";
  }
  return `El asistente IA dejará de funcionar con ${PROVIDER_UI_META[provider].label} hasta que añadas una nueva clave.`;
}

function providerConnectionBadge(status: ProviderConnectionStatus): {
  text: string;
  backgroundColor: string;
  dotColor: string;
  textColor: string;
} {
  const palette = providerStatusPalette(status.severity);
  let text = "Sin estado";
  if (status.state === "checking") text = "Comprobando";
  else if (status.severity === "success") text = "Conectado";
  else if (status.severity === "warning") text = "Atención";
  else if (status.severity === "error") text = "Error";
  else if (status.state === "unknown") text = "Sin verificar";
  else text = "No conectado";
  return {
    text,
    backgroundColor: palette.backgroundColor,
    dotColor: palette.dotColor,
    textColor: palette.textColor,
  };
}
const TRAINING_FILTER_OPTIONS: Array<{ key: TrainingFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "strength", label: "Fuerza" },
  { key: "hypertrophy", label: "Hipertrofia" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Flexibilidad" },
];
const TRAINING_CATEGORY_EDIT_OPTIONS: Array<{ key: TrainingCategory; label: string }> = [
  { key: "strength", label: "Fuerza" },
  { key: "hypertrophy", label: "Hipertrofia" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Flexibilidad" },
];
const TRAINING_STATS_PERIOD_OPTIONS: Array<{ key: TrainingStatsPeriodKey; label: string }> = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "1A" },
  { key: "all", label: "Todo" },
];
const MEASURES_DASHBOARD_PERIOD_OPTIONS: Array<{
  key: MeasuresDashboardPeriodKey;
  label: string;
  days: number | null;
}> = [
  { key: "1m", label: "1 mes", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "all", label: "Todo", days: null },
];
const TRAINING_STATS_METRIC_OPTIONS: Array<{
  key: TrainingStatsMetricKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "volume", label: "Volumen", shortLabel: "kg" },
  { key: "reps", label: "Repeticiones", shortLabel: "reps" },
  { key: "duration", label: "Duración", shortLabel: "min" },
];
const ROUTINE_ICON_OPTIONS: RoutineIconName[] = [
  "activity",
  "heart",
  "zap",
  "target",
  "wind",
  "shield",
  "compass",
  "crosshair",
  "award",
  "star",
  "sun",
  "moon",
  "sliders",
  "trending-up",
];
const ROUTINE_ICON_BY_CATEGORY: Record<TrainingCategory, RoutineIconName[]> = {
  strength: ["activity", "shield", "crosshair", "award", "target"],
  hypertrophy: ["award", "target", "crosshair", "activity", "shield"],
  cardio: ["heart", "zap", "trending-up", "activity", "wind"],
  flexibility: ["wind", "sun", "moon", "compass", "sliders"],
};
const ENABLE_GLOBAL_SCREEN_LOAD_DELAY = false;
const GLOBAL_SCREEN_LOAD_DELAY_MS = 1200;
const TRAINING_LOADING_SKELETON_ROWS = 4;
const TRAINING_EDITOR_LOADING_SKELETON_ROWS = 2;
const MAX_WORKOUT_HISTORY_ITEMS = 180;
const DIET_MACRO_MODE_OPTIONS: Array<{ key: DietMacroMode; label: string }> = [
  { key: "manual_calories", label: "kcal" },
  { key: "protein_by_weight", label: "g/kg" },
];
const DIET_MEAL_CATEGORIES: DietMealCategory[] = [
  "Desayuno",
  "Almuerzo",
  "Comida",
  "Merienda",
  "Cena",
];
const DIET_MEAL_META: Record<
  DietMealCategory,
  { icon: keyof typeof Feather.glyphMap; accent: string; dot: string }
> = {
  Desayuno: { icon: "sunrise", accent: "#F7A547", dot: "#FF6E6E" },
  Almuerzo: { icon: "sun", accent: "#FFD84D", dot: "#FF8D8D" },
  Comida: { icon: "sun", accent: "#CBFF1A", dot: "#FF6E6E" },
  Merienda: { icon: "coffee", accent: "#4D84FF", dot: "#6E8DFF" },
  Cena: { icon: "moon", accent: "#7D6DFF", dot: "#9C8DFF" },
};
const DIET_WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const DIET_MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const GKG_MACRO_KEYS: GkgMacroKey[] = ["protein", "carbs", "fat"];
const SETTINGS_TAB_OPTIONS: Array<{ key: SettingsTabKey; label: string }> = [
  { key: "diet", label: "Dieta" },
  { key: "provider", label: "Proveedor IA" },
  { key: "memory", label: "Memoria" },
  { key: "training", label: "Entreno" },
];

function createDefaultDietSettings(): DietSettings {
  return {
    daily_calories: "",
    macro_mode: "manual_calories",
    manual_macro_calories: {
      carbs: "",
      protein: "",
      fat: "",
    },
    protein_grams_per_kg: "1.5",
    carbs_grams_per_kg: "",
    fat_grams_per_kg: "",
  };
}

function isDietMealCategory(value: string): value is DietMealCategory {
  return DIET_MEAL_CATEGORIES.includes(value as DietMealCategory);
}

function createDietMealExpandedState(): Record<DietMealCategory, boolean> {
  return {
    Desayuno: true,
    Almuerzo: false,
    Comida: false,
    Merienda: false,
    Cena: false,
  };
}

function sortDietMealsByCategory(meals: DietMeal[]): DietMeal[] {
  const order = new Map(DIET_MEAL_CATEGORIES.map((category, index) => [category, index]));
  return [...meals].sort((a, b) => {
    const aOrder = isDietMealCategory(a.title) ? (order.get(a.title) ?? 999) : 999;
    const bOrder = isDietMealCategory(b.title) ? (order.get(b.title) ?? 999) : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  });
}

function secureStoreKey(provider: Provider): string {
  return `${SECURE_STORE_API_KEY_PREFIX}.${provider}`;
}

function emptyProviderApiKeys(): Record<Provider, string> {
  return { openai: "", anthropic: "", google: "" };
}

function stripSensitiveStoreData(store: LocalStore): LocalStore {
  return {
    ...store,
    keys: store.keys.map((item) => ({ ...item, api_key: "" })),
  };
}

function serializeStoreForAsyncStorage(
  store: LocalStore,
  secureStoreAvailable: boolean,
): LocalStore {
  if (!secureStoreAvailable) return store;
  return stripSensitiveStoreData(store);
}

function mergeStoreWithSecureApiKeys(
  store: LocalStore,
  secureApiKeys: Record<Provider, string>,
): LocalStore {
  return {
    ...store,
    keys: store.keys.map((item) => {
      const secureValue = secureApiKeys[item.provider]?.trim() ?? "";
      return {
        ...item,
        api_key: secureValue || item.api_key,
      };
    }),
  };
}

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readProviderApiKeysFromSecureStore(
  secureStoreAvailable: boolean,
): Promise<Record<Provider, string>> {
  if (!secureStoreAvailable) return emptyProviderApiKeys();

  const entries = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const value = await SecureStore.getItemAsync(secureStoreKey(provider));
      return [provider, (value ?? "").trim()] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Provider, string>;
}

async function writeProviderApiKeysToSecureStore(
  keys: AIKey[],
  secureStoreAvailable: boolean,
): Promise<void> {
  if (!secureStoreAvailable) return;

  await Promise.all(
    keys.map(async (item) => {
      const key = secureStoreKey(item.provider);
      const value = item.api_key.trim();
      if (!value) {
        await SecureStore.deleteItemAsync(key);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    }),
  );
}

async function clearLegacyStorageData(secureStoreAvailable: boolean): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS);
  if (!secureStoreAvailable) return;

  await Promise.all(
    LEGACY_SECURE_STORE_PREFIXES.flatMap((prefix) =>
      PROVIDERS.map((provider) => SecureStore.deleteItemAsync(`${prefix}.${provider}`)),
    ),
  );
}

function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Sin API key";
  if (trimmed.length < 10) return `${trimmed.slice(0, 2)}***`;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as {
    error?: { message?: string };
    detail?: string;
    message?: string;
  };
  return candidate.error?.message ?? candidate.detail ?? candidate.message ?? fallback;
}

function parseAnthropicModelOptions(payload: unknown): AnthropicModelOption[] {
  if (!payload || typeof payload !== "object") return [];

  const maybeDirect = payload as {
    data?: Array<{ id?: string; display_name?: string }>;
    models?: Array<{ id?: string; display_name?: string }>;
  };
  const rawItems = Array.isArray(maybeDirect.models)
    ? maybeDirect.models
    : Array.isArray(maybeDirect.data)
      ? maybeDirect.data
      : [];

  const dedup = new Map<string, AnthropicModelOption>();
  rawItems.forEach((item) => {
    const modelId = item?.id?.trim();
    if (!modelId) return;
    dedup.set(modelId, {
      id: modelId,
      display_name: item?.display_name?.trim() || null,
    });
  });
  return Array.from(dedup.values());
}

function parseOpenAIModelOptions(payload: unknown): OpenAIModelOption[] {
  if (!payload || typeof payload !== "object") return [];

  const maybeDirect = payload as {
    data?: Array<{ id?: string; owned_by?: string }>;
    models?: Array<{ id?: string; owned_by?: string }>;
  };
  const rawItems = Array.isArray(maybeDirect.models)
    ? maybeDirect.models
    : Array.isArray(maybeDirect.data)
      ? maybeDirect.data
      : [];

  const dedup = new Map<string, OpenAIModelOption>();
  rawItems.forEach((item) => {
    const modelId = item?.id?.trim();
    if (!modelId) return;
    dedup.set(modelId, {
      id: modelId,
      owned_by: item?.owned_by?.trim() || null,
    });
  });
  return Array.from(dedup.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function parseGoogleModelOptions(payload: unknown): GoogleModelOption[] {
  if (!payload || typeof payload !== "object") return [];

  const maybeDirect = payload as {
    models?: Array<{
      name?: string;
      displayName?: string;
      display_name?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  const rawItems = Array.isArray(maybeDirect.models) ? maybeDirect.models : [];

  const dedup = new Map<string, GoogleModelOption>();
  rawItems.forEach((item) => {
    const rawName = item?.name?.trim();
    if (!rawName) return;
    const modelId = rawName.replace(/^models\//, "").trim();
    if (!modelId) return;

    const methods = Array.isArray(item?.supportedGenerationMethods)
      ? item.supportedGenerationMethods
      : null;
    if (methods && methods.length > 0 && !methods.includes("generateContent")) return;

    const displayName = item?.displayName?.trim() || item?.display_name?.trim() || null;
    dedup.set(modelId, {
      id: modelId,
      display_name: displayName,
    });
  });

  return Array.from(dedup.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchAnthropicModelsViaWebProxy(apiKey: string): Promise<AnthropicModelOption[]> {
  try {
    const response = await fetch(buildWebProxyUrl("/chat/providers/anthropic/models"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Proxy Anthropic error (${response.status})`));
    }

    return parseAnthropicModelOptions(payload);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message.trim() : "";
    if (rawMessage.toLowerCase().includes("failed to fetch")) {
      throw new Error(ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE);
    }
    throw new Error(rawMessage || ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE);
  }
}

async function fetchAnthropicModelsDirect(apiKey: string): Promise<AnthropicModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Anthropic error (${response.status})`));
  }

  return parseAnthropicModelOptions(payload);
}

async function fetchOpenAIModelsDirect(apiKey: string): Promise<OpenAIModelOption[]> {
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OpenAI error (${response.status})`));
  }

  return parseOpenAIModelOptions(payload);
}

async function fetchGoogleModelsDirect(apiKey: string): Promise<GoogleModelOption[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET",
    },
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Google AI error (${response.status})`));
  }

  return parseGoogleModelOptions(payload);
}

async function verifyAnthropicViaWebProxy(
  apiKey: string,
  model: string,
): Promise<ProviderConnectionCheckResult> {
  const proxyUrl = buildWebProxyUrl("/chat/providers/anthropic/verify");
  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        model,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      return {
        ok: false,
        severity: "error",
        message: toSevereProviderDetail(
          extractErrorMessage(payload, `Proxy API error (${response.status})`),
        ),
      };
    }

    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        severity: "error",
        message: toSevereProviderDetail("Respuesta inválida del proxy API."),
      };
    }

    const candidate = payload as { ok?: boolean; message?: string };
    const normalizedMessage = (candidate.message ?? "").trim();
    const isModelWarning = normalizedMessage.toLowerCase().includes("modelo no disponible");
    if (candidate.ok === false) {
      return {
        ok: false,
        severity: "error",
        message: toSevereProviderDetail(normalizedMessage || "No se pudo verificar la conexión."),
      };
    }
    return {
      ok: true,
      severity: isModelWarning ? "warning" : "success",
      message: isModelWarning
        ? toMediumProviderDetail(normalizedMessage)
        : PROVIDER_STATUS_COPY.success,
    };
  } catch (err) {
    if (err instanceof Error && err.message.trim()) {
      const normalized = err.message.toLowerCase().includes("failed to fetch")
        ? ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE
        : err.message;
      return { ok: false, severity: "error", message: toSevereProviderDetail(normalized) };
    }
    return {
      ok: false,
      severity: "error",
      message: toSevereProviderDetail(ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE),
    };
  }
}

async function callAnthropicViaWebProxy(
  provider: AIKey,
  systemPrompt: string,
  messages: Array<{ role: "assistant" | "user"; content: string }>,
): Promise<string> {
  const proxyUrl = buildWebProxyUrl("/chat/providers/anthropic/messages");
  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: provider.api_key,
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 700,
        system: systemPrompt,
        messages,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Proxy Anthropic error (${response.status})`));
    }

    const content = parseAnthropicContent(payload);
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return content;
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "No se pudo conectar con Anthropic.";
    if (rawMessage.toLowerCase().includes("failed to fetch")) {
      throw new Error(ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE);
    }
    throw new Error(rawMessage);
  }
}

async function verifyProviderConnection(provider: AIKey): Promise<ProviderConnectionCheckResult> {
  const apiKey = provider.api_key.trim();
  if (!apiKey) {
    return { ok: false, severity: "warning", message: PROVIDER_STATUS_COPY.warningNoKey };
  }

  const model = provider.model.trim() || DEFAULT_MODELS[provider.provider];
  try {
    let response: Response;
    if (provider.provider === "openai") {
      response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
    } else if (provider.provider === "anthropic") {
      if (Platform.OS === "web") {
        return verifyAnthropicViaWebProxy(apiKey, model);
      }
      const anthropicHeaders = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders,
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "Ping de verificación." }],
        }),
      });

      let verifyPayload: unknown = null;
      try {
        verifyPayload = await response.json();
      } catch {
        // ignore json parse errors
      }

      if (!response.ok) {
        if (response.status === 404) {
          return {
            ok: true,
            severity: "warning",
            message: `${PROVIDER_STATUS_COPY.warningModelUnavailablePrefix}${model}.`,
          };
        }
        return {
          ok: false,
          severity: "error",
          message: toSevereProviderDetail(
            extractErrorMessage(verifyPayload, `Error de conexión (${response.status})`),
          ),
        };
      }

      return { ok: true, severity: "success", message: PROVIDER_STATUS_COPY.success };
    } else {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`,
        { method: "GET" },
      );
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      return {
        ok: false,
        severity: "error",
        message: toSevereProviderDetail(
          extractErrorMessage(payload, `Error de conexión (${response.status})`),
        ),
      };
    }

    return { ok: true, severity: "success", message: PROVIDER_STATUS_COPY.success };
  } catch (err) {
    return {
      ok: false,
      severity: "error",
      message: toSevereProviderDetail(
        err instanceof Error ? err.message : "No se pudo comprobar la conexión.",
      ),
    };
  }
}

function parseOpenAIContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = maybe.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim())
      .filter(Boolean)
      .join("\n");
    return text || null;
  }
  return null;
}

function parseAnthropicContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (maybe.content ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

function parseGoogleContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (maybe.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

async function callProviderChatAPI(provider: AIKey, messages: ChatInputMessage[]): Promise<string> {
  const systemPrompt = normalizeChatSystemPrompt(
    messages
      .filter((msg) => msg.role === "system")
      .map((msg) => msg.content)
      .join("\n\n"),
  );
  const nonSystemMessages: Array<{ role: "assistant" | "user"; content: string }> = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

  if (provider.provider === "openai") {
    const openAIMessages = [{ role: "system" as const, content: systemPrompt }, ...nonSystemMessages];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODELS.openai,
        messages: openAIMessages,
        temperature: 0.7,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `OpenAI error (${response.status})`));
    }

    const content = parseOpenAIContent(payload);
    if (!content) throw new Error("OpenAI no devolvio contenido.");
    return content;
  }

  if (provider.provider === "anthropic") {
    if (Platform.OS === "web") {
      return callAnthropicViaWebProxy(provider, systemPrompt, nonSystemMessages);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 700,
        system: systemPrompt,
        messages: nonSystemMessages,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Anthropic error (${response.status})`));
    }

    const content = parseAnthropicContent(payload);
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return content;
  }

  const googleMessages = nonSystemMessages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model || DEFAULT_MODELS.google)}:generateContent?key=${encodeURIComponent(provider.api_key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: googleMessages,
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    },
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Google AI error (${response.status})`));
  }

  const content = parseGoogleContent(payload);
  if (!content) throw new Error("Google AI no devolvio contenido.");
  return content;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callProviderChatAPIWithTools(provider: AIKey, messages: ChatInputMessage[]): Promise<string> {
  const systemPrompt = normalizeChatSystemPrompt(
    messages
      .filter((msg) => msg.role === "system")
      .map((msg) => msg.content)
      .join("\n\n"),
  );
  const nonSystemMessages: Array<{ role: "assistant" | "user"; content: string }> = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

  const keyParam = { key: { type: "string" as const } };
  const keyRequired = ["key"];

  const chatTools = {
    openai: [
      {
        type: "function",
        function: {
          name: SAVE_PERSONAL_DATA_TOOL,
          description: SAVE_PERSONAL_DATA_DESC,
          parameters: {
            type: "object",
            properties: { personal_data: { type: "string", description: SAVE_PERSONAL_DATA_PARAM_DESC } },
            required: ["personal_data"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: LIST_KEYS_TOOL,
          description: LIST_KEYS_DESC,
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      {
        type: "function",
        function: {
          name: READ_DESCRIPTION_TOOL,
          description: READ_DESCRIPTION_DESC,
          parameters: { type: "object", properties: { key: { type: "string", description: READ_DESCRIPTION_PARAM_DESC } }, required: keyRequired },
        },
      },
      {
        type: "function",
        function: {
          name: READ_VALUE_TOOL,
          description: READ_VALUE_DESC,
          parameters: { type: "object", properties: { key: { type: "string", description: READ_VALUE_PARAM_DESC } }, required: keyRequired },
        },
      },
    ],
    anthropic: [
      {
        name: SAVE_PERSONAL_DATA_TOOL,
        description: SAVE_PERSONAL_DATA_DESC,
        input_schema: {
          type: "object",
          properties: { personal_data: { type: "string", description: SAVE_PERSONAL_DATA_PARAM_DESC } },
          required: ["personal_data"],
        },
      },
      {
        name: LIST_KEYS_TOOL,
        description: LIST_KEYS_DESC,
        input_schema: { type: "object", properties: {} },
      },
      {
        name: READ_DESCRIPTION_TOOL,
        description: READ_DESCRIPTION_DESC,
        input_schema: { type: "object", properties: keyParam, required: keyRequired },
      },
      {
        name: READ_VALUE_TOOL,
        description: READ_VALUE_DESC,
        input_schema: { type: "object", properties: keyParam, required: keyRequired },
      },
    ],
    google: [
      {
        functionDeclarations: [
          {
            name: SAVE_PERSONAL_DATA_TOOL,
            description: SAVE_PERSONAL_DATA_DESC,
            parameters: {
              type: "object",
              properties: { personal_data: { type: "string", description: SAVE_PERSONAL_DATA_PARAM_DESC } },
              required: ["personal_data"],
            },
          },
          {
            name: LIST_KEYS_TOOL,
            description: LIST_KEYS_DESC,
            parameters: { type: "object", properties: {} },
          },
          {
            name: READ_DESCRIPTION_TOOL,
            description: READ_DESCRIPTION_DESC,
            parameters: { type: "object", properties: keyParam, required: keyRequired },
          },
          {
            name: READ_VALUE_TOOL,
            description: READ_VALUE_DESC,
            parameters: { type: "object", properties: keyParam, required: keyRequired },
          },
        ],
      },
    ],
  };

  // --- OPENAI ---
  if (provider.provider === "openai") {
    const openAIMessages: any[] = [{ role: "system", content: systemPrompt }, ...nonSystemMessages];

    const makeOpenAIRequest = async (includeTools: boolean) => {
      const body: any = { model: provider.model || DEFAULT_MODELS.openai, messages: openAIMessages, temperature: 0.7 };
      if (includeTools) body.tools = chatTools.openai;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.api_key}` },
        body: JSON.stringify(body),
      });
      let p: any = null;
      try { p = await res.json(); } catch {}
      if (!res.ok) throw new Error(extractErrorMessage(p, `OpenAI error (${res.status})`));
      return p;
    };

    let payload = await makeOpenAIRequest(true);

    for (let round = 0; round < 10; round++) {
      const choice = payload?.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;
      if (!toolCalls?.length) break;

      openAIMessages.push(choice.message);
      for (const tc of toolCalls) {
        const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        const toolResult = await handleToolCall(tc.function?.name, args);
        openAIMessages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
      }
      payload = await makeOpenAIRequest(true);
    }

    const content = parseOpenAIContent(payload);
    if (!content) throw new Error("OpenAI no devolvio contenido.");
    return content;
  }

  // --- ANTHROPIC ---
  if (provider.provider === "anthropic") {
    if (Platform.OS === "web") {
      return callAnthropicViaWebProxy(provider, systemPrompt, nonSystemMessages);
    }

    const anthropicHeaders = {
      "Content-Type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": "2023-06-01",
    };

    const makeAnthropicRequest = async (msgs: any[], includeTools: boolean) => {
      const body: any = {
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 2048,
        system: systemPrompt,
        messages: msgs,
      };
      if (includeTools) body.tools = chatTools.anthropic;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders,
        body: JSON.stringify(body),
      });
      let p: any = null;
      try { p = await res.json(); } catch {}
      if (!res.ok) throw new Error(extractErrorMessage(p, `Anthropic error (${res.status})`));
      return p;
    };

    let currentMessages: any[] = [...nonSystemMessages];
    let payload = await makeAnthropicRequest(currentMessages, true);

    for (let round = 0; round < 10; round++) {
      const contentBlocks = payload?.content as any[] | undefined;
      const toolUseBlocks = contentBlocks?.filter((b: any) => b.type === "tool_use") ?? [];
      if (toolUseBlocks.length === 0) break;

      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        const result = await handleToolCall(block.name, block.input ?? {});
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: contentBlocks },
        { role: "user", content: toolResults },
      ];
      payload = await makeAnthropicRequest(currentMessages, true);
    }

    const content = parseAnthropicContent(payload);
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return content;
  }

  // --- GOOGLE ---
  const googleMessages: any[] = nonSystemMessages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model || DEFAULT_MODELS.google)}:generateContent?key=${encodeURIComponent(provider.api_key)}`;

  const makeGoogleRequest = async (msgs: any[], includeTools: boolean) => {
    const body: any = {
      contents: msgs,
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    if (includeTools) body.tools = chatTools.google;
    const res = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let p: any = null;
    try { p = await res.json(); } catch {}
    if (!res.ok) throw new Error(extractErrorMessage(p, `Google AI error (${res.status})`));
    return p;
  };

  let payload = await makeGoogleRequest(googleMessages, true);

  for (let round = 0; round < 10; round++) {
    const parts = payload?.candidates?.[0]?.content?.parts as any[] | undefined;
    const functionCalls = parts?.filter((p: any) => p.functionCall) ?? [];
    if (functionCalls.length === 0) break;

    const modelParts = functionCalls.map((fc: any) => ({ functionCall: fc.functionCall }));
    const responseParts: any[] = [];
    for (const fc of functionCalls) {
      const toolResult = await handleToolCall(fc.functionCall.name, fc.functionCall.args ?? {});
      responseParts.push({ functionResponse: { name: fc.functionCall.name, response: { result: toolResult } } });
    }
    googleMessages.push({ role: "model", parts: modelParts });
    googleMessages.push({ role: "user", parts: responseParts });
    payload = await makeGoogleRequest(googleMessages, true);
  }

  const content = parseGoogleContent(payload);
  if (!content) throw new Error("Google AI no devolvio contenido.");
  return content;
}

async function callFoodEstimatorAPI(
  provider: AIKey,
  messages: ChatInputMessage[],
  images: FoodEstimatorImage[],
): Promise<string> {
  const model = provider.model.trim() || DEFAULT_MODELS[provider.provider];
  const normalizedImages = images
    .filter((image) => image.base64.trim().length > 0)
    .map((image) => ({
      ...image,
      mime_type: image.mime_type.trim() || "image/jpeg",
    }));
  const lastUserMessageIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return index;
    }
    return -1;
  })();
  const nonSystemMessages = messages.filter((msg) => msg.role !== "system");
  const lastNonSystemUserMessageIndex = (() => {
    for (let index = nonSystemMessages.length - 1; index >= 0; index -= 1) {
      if (nonSystemMessages[index].role === "user") return index;
    }
    return -1;
  })();

  if (provider.provider === "openai") {
    const openAIMessages = messages.map((msg, index) => {
      if (msg.role === "system") return { role: "system", content: msg.content };
      if (msg.role === "assistant") return { role: "assistant", content: msg.content };
      const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
      if (index !== lastUserMessageIndex || normalizedImages.length === 0) {
        return { role: "user", content: textContent };
      }
      return {
        role: "user",
        content: [
          { type: "text", text: textContent },
          ...normalizedImages.map((image) => ({
            type: "image_url",
            image_url: {
              url: `data:${image.mime_type};base64,${image.base64}`,
            },
          })),
        ],
      };
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        temperature: 0.2,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `OpenAI error (${response.status})`));
    }

    const content = parseOpenAIContent(payload);
    if (!content) throw new Error("OpenAI no devolvio contenido.");
    return content;
  }

  if (provider.provider === "anthropic") {
    if (Platform.OS === "web" && normalizedImages.length > 0) {
      throw new Error(
        "Anthropic en web no admite envío de imágenes en este flujo. Usa Google u OpenAI, o abre la app en dispositivo móvil.",
      );
    }

    const anthropicMessages = nonSystemMessages.map((msg, index) => {
      if (msg.role === "assistant") {
        return {
          role: "assistant",
          content: msg.content.trim() || "Entendido.",
        };
      }
      const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
      if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
        return {
          role: "user",
          content: textContent,
        };
      }
      return {
        role: "user",
        content: [
          { type: "text", text: textContent },
          ...normalizedImages.map((image) => ({
            type: "image",
            source: {
              type: "base64",
              media_type: image.mime_type,
              data: image.base64,
            },
          })),
        ],
      };
    });

    if (Platform.OS === "web") {
      const textOnlyMessages = nonSystemMessages.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.trim() || "Analiza esta comida y estima los valores solicitados.",
      })) as Array<{ role: "assistant" | "user"; content: string }>;
      return callAnthropicViaWebProxy(provider, FOOD_ESTIMATOR_SYSTEM_PROMPT, textOnlyMessages);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system: FOOD_ESTIMATOR_SYSTEM_PROMPT,
        messages: anthropicMessages,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // ignore json parse errors
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Anthropic error (${response.status})`));
    }

    const content = parseAnthropicContent(payload);
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return content;
  }

  const googleContents = nonSystemMessages.map((msg, index) => {
    if (msg.role === "assistant") {
      return {
        role: "model",
        parts: [{ text: msg.content.trim() || "Entendido." }],
      };
    }
    const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
    if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
      return {
        role: "user",
        parts: [{ text: textContent }],
      };
    }
    return {
      role: "user",
      parts: [
        { text: textContent },
        ...normalizedImages.map((image) => ({
          inline_data: {
            mime_type: image.mime_type,
            data: image.base64,
          },
        })),
      ],
    };
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.api_key)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: googleContents,
        systemInstruction: {
          parts: [{ text: FOOD_ESTIMATOR_SYSTEM_PROMPT }],
        },
      }),
    },
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore json parse errors
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Google AI error (${response.status})`));
  }

  const content = parseGoogleContent(payload);
  if (!content) throw new Error("Google AI no devolvio contenido.");
  return content;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isoDateFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO(): string {
  return isoDateFromDate(new Date());
}

function dateFromISO(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return measurementDateFromSelection(new Date());
  return measurementDateFromSelection(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

function shiftISODateByDays(isoDate: string, days: number): string {
  const next = dateFromISO(isoDate);
  next.setDate(next.getDate() + days);
  return isoDateFromDate(next);
}

function formatDietDayHeader(isoDate: string): string {
  const parsed = dateFromISO(isoDate);
  return `${DIET_WEEKDAY_LABELS[parsed.getDay()]}, ${parsed.getDate()} ${DIET_MONTH_LABELS_SHORT[parsed.getMonth()]}`;
}

function formatDietDayContext(isoDate: string, referenceIsoDate: string): string {
  const selected = dateFromISO(isoDate);
  const reference = dateFromISO(referenceIsoDate);
  const diffInDays = Math.round((selected.getTime() - reference.getTime()) / 86400000);
  if (diffInDays === 0) return "Hoy";
  if (diffInDays === -1) return "Ayer";
  if (diffInDays === 1) return "Mañana";
  return selected
    .toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");
}

function sumDayCalories(day: DietDay | null): number {
  if (!day) return 0;
  return day.meals.reduce((mealAcc, meal) => {
    return mealAcc + meal.items.reduce((itemAcc, item) => itemAcc + item.calories_kcal, 0);
  }, 0);
}

function sumDayMacroGrams(day: DietDay | null, macro: "protein_g" | "carbs_g" | "fat_g"): number {
  if (!day) return 0;
  return day.meals.reduce((mealAcc, meal) => {
    return mealAcc + meal.items.reduce((itemAcc, item) => itemAcc + item[macro], 0);
  }, 0);
}

function inferTrainingCategory(templateName: string): TrainingCategory {
  const normalized = templateName.trim().toLowerCase();
  if (
    normalized.includes("hipertrof") ||
    normalized.includes("hypertroph") ||
    normalized.includes("volumen") ||
    normalized.includes("masa muscular")
  ) {
    return "hypertrophy";
  }
  if (normalized.includes("cardio") || normalized.includes("hiit") || normalized.includes("running")) {
    return "cardio";
  }
  if (
    normalized.includes("flex") ||
    normalized.includes("movilidad") ||
    normalized.includes("mobility") ||
    normalized.includes("estir")
  ) {
    return "flexibility";
  }
  return "strength";
}

function resolveTrainingCategory(template: WorkoutTemplate): TrainingCategory {
  if (
    template.category === "strength" ||
    template.category === "hypertrophy" ||
    template.category === "cardio" ||
    template.category === "flexibility"
  ) {
    return template.category;
  }
  return inferTrainingCategory(template.name);
}

function parseRestSecondsInput(rawValue: string): number {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return 0;

  if (normalized.includes(":")) {
    const [minutesRaw, secondsRaw] = normalized.split(":");
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.max(0, Math.round(minutes * 60 + seconds));
    }
  }

  if (normalized.endsWith("m")) {
    const parsed = Number(normalized.slice(0, -1));
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 60);
    }
  }

  if (normalized.endsWith("s")) {
    const parsed = Number(normalized.slice(0, -1));
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  const numeric = Number(normalized.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric <= 10) return Math.round(numeric * 60);
  return Math.round(numeric);
}

function extractFirstPositiveInt(rawValue: string): number | null {
  const match = rawValue.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeDurationText(rawValue: string): string {
  return rawValue.replace(/[^\d]/g, "").slice(0, 3);
}

function inferDurationFromText(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeNumberInputText(rawValue: unknown): string {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return `${rawValue}`;
  }
  if (typeof rawValue === "string") {
    return rawValue.trim().replace(",", ".");
  }
  return "";
}

function parseNonNegativeNumberInput(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parsePositiveNumberInput(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseOptionalPositiveMetricInput(rawValue: string): {
  value: number | null;
  invalid: boolean;
} {
  const trimmed = rawValue.trim();
  if (!trimmed) return { value: null, invalid: false };
  const parsed = parsePositiveNumberInput(trimmed);
  return {
    value: parsed,
    invalid: parsed === null,
  };
}

function normalizePositiveNumber(rawValue: unknown): number | null {
  if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0) {
    return Math.round(rawValue * 100) / 100;
  }
  if (typeof rawValue === "string") {
    return parsePositiveNumberInput(rawValue);
  }
  return null;
}

function normalizeMeasuredAt(rawValue: unknown): string {
  if (typeof rawValue === "string") {
    const parsed = new Date(rawValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeWorkoutSessionSummary(rawValue: unknown, index: number): WorkoutSessionSummary {
  const maybe =
    rawValue && typeof rawValue === "object" ? (rawValue as Partial<WorkoutSessionSummary>) : {};
  return {
    id:
      typeof maybe.id === "string" && maybe.id ? maybe.id : uid(`session_summary_${index}`),
    template_id:
      typeof maybe.template_id === "string" && maybe.template_id.trim()
        ? maybe.template_id.trim()
        : "",
    template_name:
      typeof maybe.template_name === "string" && maybe.template_name.trim()
        ? maybe.template_name.trim()
        : "Rutina",
    finished_at: normalizeMeasuredAt(maybe.finished_at),
    elapsed_seconds: Math.max(0, Math.round(normalizeDietNonNegativeNumber(maybe.elapsed_seconds))),
    completed_series_count: Math.max(
      0,
      Math.round(normalizeDietNonNegativeNumber(maybe.completed_series_count)),
    ),
    total_series_count: Math.max(
      0,
      Math.round(normalizeDietNonNegativeNumber(maybe.total_series_count)),
    ),
    estimated_calories: Math.max(
      0,
      Math.round(normalizeDietNonNegativeNumber(maybe.estimated_calories)),
    ),
    total_volume_kg: normalizeDietNonNegativeNumber(maybe.total_volume_kg),
    total_reps: Math.max(0, Math.round(normalizeDietNonNegativeNumber(maybe.total_reps))),
  };
}

function normalizeMeasurement(rawValue: unknown, index: number): Measurement {
  const maybe = rawValue && typeof rawValue === "object" ? (rawValue as Partial<Measurement>) : {};
  const parsedDate = normalizeMeasuredAt(maybe.measured_at);
  return {
    id: typeof maybe.id === "string" && maybe.id ? maybe.id : uid(`measurement_${index}`),
    measured_at: parsedDate,
    weight_kg: normalizePositiveNumber(maybe.weight_kg),
    photo_uri:
      typeof maybe.photo_uri === "string" && maybe.photo_uri.trim() ? maybe.photo_uri.trim() : null,
    neck_cm: normalizePositiveNumber(maybe.neck_cm),
    chest_cm: normalizePositiveNumber(maybe.chest_cm),
    waist_cm: normalizePositiveNumber(maybe.waist_cm),
    hips_cm: normalizePositiveNumber(maybe.hips_cm),
    biceps_cm: normalizePositiveNumber(maybe.biceps_cm),
    quadriceps_cm: normalizePositiveNumber(maybe.quadriceps_cm),
    calf_cm: normalizePositiveNumber(maybe.calf_cm),
    height_cm: normalizePositiveNumber(maybe.height_cm),
  };
}

function sortMeasurementsDesc(measurements: Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) => {
    const aTime = new Date(a.measured_at).getTime();
    const bTime = new Date(b.measured_at).getTime();
    return bTime - aTime;
  });
}

function sortWorkoutHistoryDesc(summaries: WorkoutSessionSummary[]): WorkoutSessionSummary[] {
  return [...summaries].sort((a, b) => {
    const aTime = new Date(a.finished_at).getTime();
    const bTime = new Date(b.finished_at).getTime();
    return bTime - aTime;
  });
}

function measurementDateFromSelection(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function formatMeasurementDate(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "Fecha inválida";
  return parsed.toLocaleDateString();
}

function formatMeasurementHistoryDate(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "Fecha inválida";
  return `${parsed.getDate()} ${DIET_MONTH_LABELS_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function formatMeasurementNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function estimateMeasurementBodyFatPercentage(
  measurement: Measurement,
  fallbackHeightCm: number | null,
): number | null {
  const heightCm = measurement.height_cm ?? fallbackHeightCm;
  if (heightCm === null || measurement.waist_cm === null || measurement.neck_cm === null) {
    return null;
  }

  const waistMinusNeckCm = measurement.waist_cm - measurement.neck_cm;
  if (!(waistMinusNeckCm > 0)) return null;

  const waistMinusNeckIn = waistMinusNeckCm / 2.54;
  const heightIn = heightCm / 2.54;
  const estimate =
    86.01 * Math.log10(waistMinusNeckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  if (!Number.isFinite(estimate)) return null;

  return Math.max(3, Math.min(60, Math.round(estimate * 10) / 10));
}

function buildMeasurementHistorySummary(
  measurement: Measurement,
  fallbackHeightCm: number | null,
): string {
  const summaryParts: string[] = [];

  if (measurement.weight_kg !== null) {
    summaryParts.push(`${formatMeasurementNumber(measurement.weight_kg)} kg`);
  }

  const bodyFatPercentage = estimateMeasurementBodyFatPercentage(measurement, fallbackHeightCm);
  if (bodyFatPercentage !== null) {
    summaryParts.push(`${formatMeasurementNumber(bodyFatPercentage)}% grasa`);
  }

  if (measurement.waist_cm !== null) {
    summaryParts.push(`Cintura ${formatMeasurementNumber(measurement.waist_cm)} cm`);
  } else if (measurement.chest_cm !== null) {
    summaryParts.push(`Pecho ${formatMeasurementNumber(measurement.chest_cm)} cm`);
  } else if (measurement.biceps_cm !== null) {
    summaryParts.push(`Brazo ${formatMeasurementNumber(measurement.biceps_cm)} cm`);
  } else if (measurement.photo_uri) {
    summaryParts.push("Foto de progreso");
  }

  return summaryParts.join(" · ") || "Sin medidas numéricas";
}

function formatNutritionNumber(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function parseFoodEstimatorNutritionJSON(rawValue: string): {
  dish_name: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} | null {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  const candidatePayloads: string[] = [normalized];
  const withoutFences = normalized
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (withoutFences && withoutFences !== normalized) {
    candidatePayloads.push(withoutFences);
  }
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = normalized.slice(start, end + 1).trim();
    if (sliced) candidatePayloads.push(sliced);
  }

  for (const payload of candidatePayloads) {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const calories = normalizeDietNonNegativeNumber(parsed.calories_kcal);
      const protein = normalizeDietNonNegativeNumber(parsed.protein_g);
      const carbs = normalizeDietNonNegativeNumber(parsed.carbs_g);
      const fat = normalizeDietNonNegativeNumber(parsed.fat_g);
      const dishName = typeof parsed.dish_name === "string" ? parsed.dish_name.trim() : "";
      const hasAllKeys =
        Object.prototype.hasOwnProperty.call(parsed, "dish_name") &&
        Object.prototype.hasOwnProperty.call(parsed, "calories_kcal") &&
        Object.prototype.hasOwnProperty.call(parsed, "protein_g") &&
        Object.prototype.hasOwnProperty.call(parsed, "carbs_g") &&
        Object.prototype.hasOwnProperty.call(parsed, "fat_g");
      if (!hasAllKeys || !dishName) continue;
      return {
        dish_name: dishName,
        calories_kcal: calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      };
    } catch {
      // continue trying alternative payloads
    }
  }

  return null;
}

function gkgMacroCaloriesPerGram(macro: GkgMacroKey): number {
  return macro === "fat" ? 9 : 4;
}

function buildSeriesFromLegacyExercise(exercise: {
  sets?: number[];
  load_kg?: number | null;
  rest_seconds?: number | null;
  series?: ExerciseSeries[];
}): ExerciseSeries[] {
  if (Array.isArray(exercise.series) && exercise.series.length > 0) {
    return exercise.series.map((item, index) => ({
      id: item.id || uid("set"),
      reps: item.reps?.trim() || `${index + 1}`,
      weight_kg: item.weight_kg?.trim() ?? "",
      rest_seconds: item.rest_seconds?.trim() ?? "",
    }));
  }

  const legacyWeight = exercise.load_kg;
  const legacyRest = exercise.rest_seconds;
  return (exercise.sets ?? []).map((setValue, setIndex) => {
    const reps = Number.isFinite(setValue) ? `${Math.round(setValue)}` : "";
    const weight =
      typeof legacyWeight === "number" && Number.isFinite(legacyWeight)
        ? `${Math.max(0, Math.round((legacyWeight - setIndex * 2) * 10) / 10)}`
        : "";
    const rest =
      typeof legacyRest === "number" && Number.isFinite(legacyRest)
        ? `${Math.max(0, Math.round(legacyRest))}`
        : "";
    return {
      id: uid("set"),
      reps,
      weight_kg: weight,
      rest_seconds: rest,
    };
  });
}

function seriesToLegacySets(series: ExerciseSeries[]): number[] {
  return series
    .map((item) => extractFirstPositiveInt(item.reps))
    .filter((value): value is number => value !== null);
}

function defaultTemplateIcon(category: TrainingCategory, index: number): RoutineIconName {
  const options = ROUTINE_ICON_BY_CATEGORY[category];
  if (options.length === 0) return "activity";
  const normalizedIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return options[normalizedIndex % options.length];
}

function normalizeTemplateIcon(
  maybeIcon: unknown,
  category: TrainingCategory,
  templateIndex: number,
): RoutineIconName {
  if (typeof maybeIcon === "string") {
    const normalized = maybeIcon.trim() as RoutineIconName;
    if (ROUTINE_ICON_OPTIONS.includes(normalized)) {
      return normalized;
    }
  }
  return defaultTemplateIcon(category, templateIndex);
}

function trainingCategoryMeta(category: TrainingCategory): {
  label: string;
  color: string;
  iconBg: string;
} {
  if (category === "hypertrophy") {
    return {
      label: "Hipertrofia",
      color: "#7C5CFF",
      iconBg: "rgba(124,92,255,0.2)",
    };
  }
  if (category === "cardio") {
    return {
      label: "Cardio",
      color: "#FF8A3D",
      iconBg: "rgba(255,138,61,0.2)",
    };
  }
  if (category === "flexibility") {
    return {
      label: "Flexibilidad",
      color: "#00D2FF",
      iconBg: "rgba(0,210,255,0.2)",
    };
  }
  return {
    label: "Fuerza",
    color: "#CBFF1A",
    iconBg: "rgba(203,255,26,0.2)",
  };
}

function inferTemplateDurationMinutes(template: WorkoutTemplate): number {
  const fixedDuration = inferDurationFromText(template.duration_minutes);
  if (fixedDuration !== null) return fixedDuration;

  const totalSeconds = template.exercises.reduce((acc, item) => {
    const seriesItems = item.series ?? [];
    if (seriesItems.length === 0) return acc;
    const seriesSeconds = seriesItems.reduce((seriesAcc, seriesItem) => {
      const restSeconds = parseRestSecondsInput(seriesItem.rest_seconds);
      return seriesAcc + 30 + restSeconds;
    }, 0);
    return acc + seriesSeconds;
  }, 0);
  if (totalSeconds <= 0) return 0;
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

function inferExerciseMuscle(exerciseName: string, category: TrainingCategory): string {
  const normalized = exerciseName.toLowerCase();
  if (normalized.includes("pierna") || normalized.includes("squat") || normalized.includes("sentadilla")) {
    return "Piernas";
  }
  if (normalized.includes("hombro") || normalized.includes("militar") || normalized.includes("lateral")) {
    return "Hombros";
  }
  if (normalized.includes("tricep") || normalized.includes("fondo")) {
    return "Tríceps";
  }
  if (normalized.includes("espalda") || normalized.includes("remo") || normalized.includes("jalón")) {
    return "Espalda";
  }
  if (normalized.includes("core") || normalized.includes("abdominal")) {
    return "Core";
  }
  if (category === "cardio") return "Cardio";
  if (category === "flexibility") return "Movilidad";
  return "Pecho";
}

function normalizeExerciseImageUri(rawValue: string | null | undefined): string | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  return trimmed ? trimmed : null;
}

function resolveExercisePreviewMeta(
  exerciseName: string,
  muscle: string,
  category: TrainingCategory,
): {
  backgroundColor: string;
  accentColor: string;
  label: string;
  icon: RoutineIconName;
} {
  const normalized = `${exerciseName} ${muscle}`.trim().toLowerCase();

  if (
    normalized.includes("pierna") ||
    normalized.includes("squat") ||
    normalized.includes("sentadilla") ||
    normalized.includes("zancada") ||
    normalized.includes("lunge")
  ) {
    return {
      backgroundColor: "#232A17",
      accentColor: "#CBFF1A",
      label: "Piernas",
      icon: "shield",
    };
  }

  if (
    normalized.includes("espalda") ||
    normalized.includes("remo") ||
    normalized.includes("jalon") ||
    normalized.includes("jalón") ||
    normalized.includes("pull")
  ) {
    return {
      backgroundColor: "#162331",
      accentColor: "#76A9FF",
      label: "Espalda",
      icon: "wind",
    };
  }

  if (
    normalized.includes("hombro") ||
    normalized.includes("militar") ||
    normalized.includes("lateral") ||
    normalized.includes("press")
  ) {
    return {
      backgroundColor: "#2A2116",
      accentColor: "#FFB166",
      label: "Hombros",
      icon: "target",
    };
  }

  if (
    normalized.includes("tricep") ||
    normalized.includes("trícep") ||
    normalized.includes("fondo") ||
    normalized.includes("pecho") ||
    normalized.includes("push")
  ) {
    return {
      backgroundColor: "#2A1C1C",
      accentColor: "#FF8D8D",
      label: "Pecho",
      icon: "award",
    };
  }

  if (normalized.includes("core") || normalized.includes("abdominal") || normalized.includes("planch")) {
    return {
      backgroundColor: "#182824",
      accentColor: "#55D6BE",
      label: "Core",
      icon: "crosshair",
    };
  }

  if (category === "cardio") {
    return {
      backgroundColor: "#2A2015",
      accentColor: "#FF9F4D",
      label: "Cardio",
      icon: "heart",
    };
  }

  if (category === "flexibility") {
    return {
      backgroundColor: "#16272A",
      accentColor: "#74D7F7",
      label: "Movilidad",
      icon: "compass",
    };
  }

  return {
    backgroundColor: "#1D2430",
    accentColor: "#A5B0C2",
    label: "General",
    icon: "activity",
  };
}

function defaultTemplateName(category: TrainingCategory, index: number): string {
  if (category === "hypertrophy") return `Hipertrofia — Volumen ${index}`;
  if (category === "cardio") return `Cardio — Resistencia ${index}`;
  if (category === "flexibility") return `Movilidad y Estiramiento ${index}`;
  return `Tren Superior — Fuerza ${index}`;
}

function totalSeriesCount(template: WorkoutTemplate): number {
  return template.exercises.reduce((acc, exercise) => {
    const seriesCount = exercise.series?.length ?? 0;
    if (seriesCount > 0) return acc + seriesCount;
    return acc + exercise.sets.length;
  }, 0);
}

function cloneWorkoutTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      sets: [...exercise.sets],
      series: (exercise.series ?? []).map((seriesItem) => ({ ...seriesItem })),
    })),
  };
}

function buildTemplateSeriesSignature(template: WorkoutTemplate): string {
  return JSON.stringify(
    template.exercises.map((exercise) => ({
      id: exercise.id,
      series: (exercise.series ?? []).map((seriesItem) => ({
        id: seriesItem.id,
        reps: seriesItem.reps.trim(),
        weight_kg: seriesItem.weight_kg.trim(),
        rest_seconds: seriesItem.rest_seconds.trim(),
      })),
    })),
  );
}

function estimateTrainingCalories(minutes: number, category: TrainingCategory): number {
  const safeMinutes = Math.max(1, minutes);
  const burnRateByCategory: Record<TrainingCategory, number> = {
    strength: 8.8,
    hypertrophy: 9.2,
    cardio: 10.5,
    flexibility: 4.5,
  };
  return Math.max(1, Math.round(safeMinutes * burnRateByCategory[category]));
}

function estimateWorkoutCalories(session: WorkoutSession): number {
  return estimateTrainingCalories(session.elapsed_seconds / 60, session.category);
}

function estimateTemplateCalories(template: WorkoutTemplate): number {
  return estimateTrainingCalories(
    inferTemplateDurationMinutes(template),
    resolveTrainingCategory(template),
  );
}

function formatSpanishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${`${remainder}`.padStart(2, "0")}`;
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function calculateWorkoutStreak(summaries: WorkoutSessionSummary[]): number {
  const completedDayKeys = new Set(
    summaries
      .map((summary) => {
        const parsed = new Date(summary.finished_at);
        if (Number.isNaN(parsed.getTime())) return null;
        return isoDateFromDate(startOfLocalDay(parsed));
      })
      .filter((value): value is string => value !== null),
  );
  if (completedDayKeys.size === 0) return 0;

  const cursor = startOfLocalDay(new Date());
  if (!completedDayKeys.has(isoDateFromDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDayKeys.has(isoDateFromDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function buildHomeWeekProgress(
  summaries: WorkoutSessionSummary[],
): Array<{ key: string; label: string; completed: boolean; isToday: boolean }> {
  const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];
  const today = startOfLocalDay(new Date());
  const monday = new Date(today);
  const dayIndex = today.getDay();
  const daysSinceMonday = dayIndex === 0 ? 6 : dayIndex - 1;
  monday.setDate(monday.getDate() - daysSinceMonday);

  const completedDayKeys = new Set(
    summaries
      .map((summary) => {
        const parsed = new Date(summary.finished_at);
        if (Number.isNaN(parsed.getTime())) return null;
        return isoDateFromDate(startOfLocalDay(parsed));
      })
      .filter((value): value is string => value !== null),
  );
  const todayKey = isoDateFromDate(today);

  return weekdayLabels.map((label, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    const key = isoDateFromDate(current);
    return {
      key,
      label,
      completed: completedDayKeys.has(key),
      isToday: key === todayKey,
    };
  });
}

function formatHomeExerciseVolume(series: ExerciseSeries[]): string {
  if (series.length === 0) return "Sin series configuradas";
  const repsLabel = series.find((item) => item.reps.trim())?.reps.trim() || "--";
  const weightLabel = series.find((item) => item.weight_kg.trim())?.weight_kg.trim() || "";
  return `${series.length} x ${repsLabel} reps${weightLabel ? ` • ${weightLabel} kg` : ""}`;
}

function summarizeWorkoutSessionPerformance(
  session: WorkoutSession,
  template: WorkoutTemplate | null,
): { totalVolumeKg: number; totalReps: number } {
  if (!template) {
    return { totalVolumeKg: 0, totalReps: 0 };
  }

  const completedKeys = new Set(session.completed_series_keys);
  let totalVolumeKg = 0;
  let totalReps = 0;

  template.exercises.forEach((exercise) => {
    (exercise.series ?? []).forEach((seriesItem) => {
      if (!completedKeys.has(`${exercise.id}:${seriesItem.id}`)) return;
      const reps = Math.max(0, Math.round(parseNonNegativeNumberInput(seriesItem.reps) ?? 0));
      const weightKg = Math.max(0, parseNonNegativeNumberInput(seriesItem.weight_kg) ?? 0);
      totalReps += reps;
      totalVolumeKg += reps * weightKg;
    });
  });

  return {
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    totalReps,
  };
}

function resolveTrainingStatsPeriodStart(period: TrainingStatsPeriodKey): number | null {
  if (period === "all") return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (period === "12m") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    return cutoff.getTime();
  }
  cutoff.setMonth(cutoff.getMonth() - (period === "6m" ? 6 : 3));
  return cutoff.getTime();
}

function formatTrainingStatsHistoryLabel(rawValue: string): string {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatTrainingStatsMetricValue(metric: TrainingStatsMetricKey, value: number): string {
  if (metric === "duration") {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} min` : `${rounded.toFixed(1)} min`;
  }
  if (metric === "volume") {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} kg` : `${rounded.toFixed(1)} kg`;
  }
  return `${Math.round(value)} reps`;
}

function templateHasRunnableSeries(template: WorkoutTemplate): boolean {
  return template.exercises.some((exercise) => (exercise.series ?? []).length > 0);
}

function listTemplateSeriesPointers(template: WorkoutTemplate): TemplateSeriesPointer[] {
  const pointers: TemplateSeriesPointer[] = [];
  template.exercises.forEach((exercise, exerciseIndex) => {
    (exercise.series ?? []).forEach((series, seriesIndex) => {
      pointers.push({
        exerciseIndex,
        seriesIndex,
        exerciseId: exercise.id,
        seriesId: series.id,
        exerciseName: exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`,
        series,
      });
    });
  });
  return pointers;
}

function pointerKey(pointer: TemplateSeriesPointer): string {
  return `${pointer.exerciseId}:${pointer.seriesId}`;
}

function normalizeWorkoutSession(
  rawValue: unknown,
  templates: WorkoutTemplate[],
): WorkoutSession | null {
  if (!rawValue || typeof rawValue !== "object") return null;
  const maybe = rawValue as Partial<WorkoutSession>;
  if (!maybe.template_id || typeof maybe.template_id !== "string") return null;

  const template = templates.find((item) => item.id === maybe.template_id);
  if (!template || !templateHasRunnableSeries(template)) return null;

  const pointers = listTemplateSeriesPointers(template);
  if (pointers.length === 0) return null;

  const requestedExerciseIndex = Number(maybe.current_exercise_index);
  const requestedSeriesIndex = Number(maybe.current_series_index);
  const currentIndex = pointers.findIndex(
    (item) =>
      item.exerciseIndex === requestedExerciseIndex &&
      item.seriesIndex === requestedSeriesIndex,
  );
  const fallbackPointer = pointers[Math.max(0, currentIndex)];
  const knownKeys = new Set(pointers.map((item) => pointerKey(item)));
  const completedKeys = Array.isArray(maybe.completed_series_keys)
    ? maybe.completed_series_keys
        .filter((item): item is string => typeof item === "string")
        .filter((item) => knownKeys.has(item))
    : [];
  const elapsedSeconds = Number.isFinite(Number(maybe.elapsed_seconds))
    ? Math.max(0, Math.round(Number(maybe.elapsed_seconds)))
    : 0;
  const restSecondsLeft = Number.isFinite(Number(maybe.rest_seconds_left))
    ? Math.max(0, Math.round(Number(maybe.rest_seconds_left)))
    : 0;
  const completedCountRaw = Number(maybe.completed_series_count);
  const completedCount = Number.isFinite(completedCountRaw)
    ? Math.max(0, Math.min(pointers.length, Math.round(completedCountRaw)))
    : completedKeys.length;
  const status = maybe.status === "paused" ? "paused" : "running";
  const isResting = Boolean(maybe.is_resting) && restSecondsLeft > 0;
  return {
    id: typeof maybe.id === "string" && maybe.id ? maybe.id : uid("session"),
    template_id: template.id,
    template_name: template.name,
    category: resolveTrainingCategory(template),
    started_at:
      typeof maybe.started_at === "string" && maybe.started_at
        ? maybe.started_at
        : new Date().toISOString(),
    current_exercise_index: fallbackPointer.exerciseIndex,
    current_series_index: fallbackPointer.seriesIndex,
    completed_series_keys: completedKeys,
    completed_series_count: completedCount,
    total_series_count: pointers.length,
    elapsed_seconds: elapsedSeconds,
    is_resting: isResting,
    rest_seconds_left: restSecondsLeft,
    status,
  };
}

function tabLabel(tab: TabKey): string {
  const map: Record<TabKey, string> = {
    home: "Home",
    training: "Rutinas",
    diet: "Dieta",
    measures: "Medidas",
    chat: "Chat",
    settings: "Configuración",
  };
  return map[tab];
}

function normalizeDietSettings(rawValue: unknown): DietSettings {
  const defaults = createDefaultDietSettings();
  if (!rawValue || typeof rawValue !== "object") return defaults;

  const maybe = rawValue as Partial<DietSettings>;
  const maybeManual = maybe.manual_macro_calories as
    | Partial<DietSettings["manual_macro_calories"]>
    | undefined;
  const mode: DietMacroMode =
    maybe.macro_mode === "protein_by_weight" ? "protein_by_weight" : "manual_calories";

  const normalizedProteinPerKg = normalizeNumberInputText(maybe.protein_grams_per_kg);
  const normalizedCarbsPerKg = normalizeNumberInputText(maybe.carbs_grams_per_kg);
  const normalizedFatPerKg = normalizeNumberInputText(maybe.fat_grams_per_kg);

  return {
    daily_calories: normalizeNumberInputText(maybe.daily_calories),
    macro_mode: mode,
    manual_macro_calories: {
      carbs: normalizeNumberInputText(maybeManual?.carbs),
      protein: normalizeNumberInputText(maybeManual?.protein),
      fat: normalizeNumberInputText(maybeManual?.fat),
    },
    protein_grams_per_kg: normalizedProteinPerKg || defaults.protein_grams_per_kg,
    carbs_grams_per_kg: normalizedCarbsPerKg || defaults.carbs_grams_per_kg,
    fat_grams_per_kg: normalizedFatPerKg || defaults.fat_grams_per_kg,
  };
}

function normalizeDietNonNegativeNumber(rawValue: unknown): number {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.max(0, Math.round(rawValue * 10) / 10);
  }
  if (typeof rawValue === "string") {
    const parsed = parseNonNegativeNumberInput(rawValue);
    return parsed === null ? 0 : Math.round(parsed * 10) / 10;
  }
  return 0;
}

function normalizeDietByDate(rawValue: unknown): Record<string, DietDay> {
  if (!rawValue || typeof rawValue !== "object") return {};

  const normalized: Record<string, DietDay> = {};
  Object.entries(rawValue as Record<string, unknown>).forEach(([dayKey, dayValue], dayIndex) => {
    const maybeDay = dayValue && typeof dayValue === "object" ? (dayValue as Partial<DietDay>) : {};
    const dayDate =
      typeof maybeDay.day_date === "string" && maybeDay.day_date.trim() ? maybeDay.day_date : dayKey;
    const meals: DietMeal[] = (Array.isArray(maybeDay.meals) ? maybeDay.meals : []).map(
      (mealRaw, mealIndex) => {
        const maybeMeal = mealRaw && typeof mealRaw === "object" ? (mealRaw as Partial<DietMeal>) : {};
        const items: DietItem[] = (Array.isArray(maybeMeal.items) ? maybeMeal.items : []).map(
          (itemRaw, itemIndex) => {
            const maybeItem = itemRaw && typeof itemRaw === "object" ? (itemRaw as Partial<DietItem>) : {};
            return {
              id:
                typeof maybeItem.id === "string" && maybeItem.id
                  ? maybeItem.id
                  : uid(`food_${dayIndex}_${mealIndex}_${itemIndex}`),
              title:
                typeof maybeItem.title === "string" && maybeItem.title.trim()
                  ? maybeItem.title.trim()
                  : "Comida",
              calories_kcal: normalizeDietNonNegativeNumber(maybeItem.calories_kcal),
              protein_g: normalizeDietNonNegativeNumber(maybeItem.protein_g),
              carbs_g: normalizeDietNonNegativeNumber(maybeItem.carbs_g),
              fat_g: normalizeDietNonNegativeNumber(maybeItem.fat_g),
            };
          },
        );

        return {
          id:
            typeof maybeMeal.id === "string" && maybeMeal.id
              ? maybeMeal.id
              : uid(`meal_${dayIndex}_${mealIndex}`),
          title:
            typeof maybeMeal.title === "string" && maybeMeal.title.trim()
              ? maybeMeal.title.trim()
              : `Comida ${mealIndex + 1}`,
          items,
        };
      },
    );

    normalized[dayDate] = { day_date: dayDate, meals };
  });

  return normalized;
}

function createInitialStore(): LocalStore {
  const firstThreadId = uid("thread");

  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: createDefaultDietSettings(),
    measurements: [],
    threads: [{ id: firstThreadId, title: "Coach 1" }],
    messagesByThread: {
      [firstThreadId]: [],
    },
    keys: createDefaultProviderKeys(),
  };
}

function normalizeStore(raw: LocalStore): LocalStore {
  const normalizedDietSettings = normalizeDietSettings(raw.dietSettings);
  const rawByProvider = new Map<Provider, Partial<AIKey>>();
  (raw.keys ?? []).forEach((item) => {
    if (item?.provider === "openai" || item?.provider === "anthropic" || item?.provider === "google") {
      rawByProvider.set(item.provider, item);
    }
  });

  const keys: AIKey[] = (["openai", "anthropic", "google"] as Provider[]).map((provider, index) => {
    const item = rawByProvider.get(provider);
    return {
      provider,
      is_active: item?.is_active ?? index === 0,
      api_key: (item?.api_key ?? "").trim(),
      model: (item?.model ?? DEFAULT_MODELS[provider]).trim(),
    };
  });

  if (!keys.some((item) => item.is_active)) {
    keys[0].is_active = true;
  } else {
    const firstActiveIndex = keys.findIndex((item) => item.is_active);
    keys.forEach((item, index) => {
      item.is_active = index === firstActiveIndex;
    });
  }

  const templates: WorkoutTemplate[] = (raw.templates ?? []).map((template, templateIndex) => {
    const normalizedExercises = (template.exercises ?? []).map((exercise, exerciseIndex) => {
      const normalizedSeries = buildSeriesFromLegacyExercise(exercise);
      const nextSets = seriesToLegacySets(normalizedSeries);
      const firstWeightText = normalizedSeries.find((item) => item.weight_kg.trim())?.weight_kg ?? "";
      const firstRestText = normalizedSeries.find((item) => item.rest_seconds.trim())?.rest_seconds ?? "";
      const parsedLoad = Number(firstWeightText);
      const parsedRest = Number(firstRestText);
      return {
        ...exercise,
        name: exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`,
        image_uri: normalizeExerciseImageUri(exercise.image_uri),
        series: normalizedSeries,
        sets: nextSets,
        load_kg:
          Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : exercise.load_kg ?? null,
        rest_seconds:
          Number.isFinite(parsedRest) && parsedRest > 0 ? parsedRest : exercise.rest_seconds ?? null,
      };
    });

    const normalizedDuration = normalizeDurationText(template.duration_minutes ?? "");
    const normalizedCategory =
      template.category === "strength" ||
      template.category === "hypertrophy" ||
      template.category === "cardio" ||
      template.category === "flexibility"
        ? template.category
        : inferTrainingCategory(template.name?.trim() || "");
    const normalizedIcon = normalizeTemplateIcon(template.icon, normalizedCategory, templateIndex);
    return {
      ...template,
      name: template.name?.trim() || `Rutina ${templateIndex + 1}`,
      category: normalizedCategory,
      icon: normalizedIcon,
      duration_minutes: normalizedDuration,
      exercises: normalizedExercises,
    };
  });

  const normalizedMeasurements = sortMeasurementsDesc(
    (Array.isArray(raw.measurements) ? raw.measurements : []).map((measurement, index) =>
      normalizeMeasurement(measurement, index),
    ),
  ).slice(0, 60);
  const normalizedWorkoutHistory = sortWorkoutHistoryDesc(
    (Array.isArray(raw.workoutHistory) ? raw.workoutHistory : []).map((summary, index) =>
      normalizeWorkoutSessionSummary(summary, index),
    ),
  ).slice(0, MAX_WORKOUT_HISTORY_ITEMS);

  return {
    templates,
    workoutHistory: normalizedWorkoutHistory,
    dietByDate: normalizeDietByDate(raw.dietByDate),
    dietSettings: normalizedDietSettings,
    measurements: normalizedMeasurements,
    threads: raw.threads ?? [],
    messagesByThread: raw.messagesByThread ?? {},
    keys,
  };
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [secureStoreAvailable, setSecureStoreAvailable] = useState(true);

  const [store, setStore] = useState<LocalStore>(() => createInitialStore());
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  const [mealTitleInput, setMealTitleInput] = useState("");
  const [mealCaloriesInput, setMealCaloriesInput] = useState("");
  const [mealProteinInput, setMealProteinInput] = useState("");
  const [mealCarbsInput, setMealCarbsInput] = useState("");
  const [mealFatInput, setMealFatInput] = useState("");
  const [selectedDietDate, setSelectedDietDate] = useState<string>(() => todayISO());
  const [showDietDatePicker, setShowDietDatePicker] = useState(false);
  const [dietMealEditorCategory, setDietMealEditorCategory] = useState<DietMealCategory | null>(null);
  const [dietItemMenu, setDietItemMenu] = useState<DietItemMenuState>(null);
  const [dietEditingItem, setDietEditingItem] = useState<DietEditingItemState>(null);
  const [dietMealExpanded, setDietMealExpanded] = useState<Record<DietMealCategory, boolean>>(
    () => createDietMealExpandedState(),
  );
  const [foodEstimatorModalOpen, setFoodEstimatorModalOpen] = useState(false);
  const [foodEstimatorProvider, setFoodEstimatorProvider] = useState<AIKey | null>(null);
  const [foodEstimatorImages, setFoodEstimatorImages] = useState<FoodEstimatorImage[]>([]);
  const [foodEstimatorMessages, setFoodEstimatorMessages] = useState<ChatMessage[]>([]);
  const [foodEstimatorInput, setFoodEstimatorInput] = useState("");
  const [foodEstimatorSending, setFoodEstimatorSending] = useState(false);
  const [foodEstimatorHasLLMResponse, setFoodEstimatorHasLLMResponse] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [measurementPhotoUri, setMeasurementPhotoUri] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState<Date>(() => measurementDateFromSelection(new Date()));
  const [showMeasurementDatePicker, setShowMeasurementDatePicker] = useState(false);
  const [measurementEntryScreenOpen, setMeasurementEntryScreenOpen] = useState(false);
  const [measuresDashboardPeriod, setMeasuresDashboardPeriod] =
    useState<MeasuresDashboardPeriodKey>("3m");
  const [measuresDashboardPeriodDropdownOpen, setMeasuresDashboardPeriodDropdownOpen] = useState(false);
  const [showAllMeasurementsHistory, setShowAllMeasurementsHistory] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [neckInput, setNeckInput] = useState("");
  const [chestInput, setChestInput] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [hipsInput, setHipsInput] = useState("");
  const [bicepsInput, setBicepsInput] = useState("");
  const [quadricepsInput, setQuadricepsInput] = useState("");
  const [calfInput, setCalfInput] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>("diet");
  const [selectedExerciseDetail, setSelectedExerciseDetail] = useState<ExerciseRepoEntry | null>(null);
  const [exercisesRepo, setExercisesRepo] = useState<ExerciseRepoEntry[]>([]);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerSearch, setExercisePickerSearch] = useState("");
  const [exercisePickerMuscleFilter, setExercisePickerMuscleFilter] = useState("all");
  const [memoryFields, setMemoryFields] = useState<PersonalDataField[]>([]);
  const [memoryNewKey, setMemoryNewKey] = useState("");
  const [memoryNewDesc, setMemoryNewDesc] = useState("");
  const [memoryNewValue, setMemoryNewValue] = useState("");
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [providerKeyVisibility, setProviderKeyVisibility] = useState<Record<Provider, boolean>>(() =>
    createProviderBooleanMap(false),
  );
  const [providerDraftByProvider, setProviderDraftByProvider] = useState<
    Record<Provider, ProviderDraft>
  >(() => createProviderDraftMap(createDefaultProviderKeys()));
  const [providerConnectionStatus, setProviderConnectionStatus] = useState<
    Record<Provider, ProviderConnectionStatus>
  >(() => createProviderConnectionStatusMap(createDefaultProviderKeys()));
  const [providerSaveLoading, setProviderSaveLoading] = useState<Record<Provider, boolean>>(() =>
    createProviderBooleanMap(false),
  );
  const [anthropicModelDropdownOpen, setAnthropicModelDropdownOpen] = useState(false);
  const [anthropicModelOptions, setAnthropicModelOptions] = useState<AnthropicModelOption[]>([]);
  const [anthropicModelOptionsLoading, setAnthropicModelOptionsLoading] = useState(false);
  const [anthropicModelOptionsMessage, setAnthropicModelOptionsMessage] = useState<{
    text: string;
    severity: ProviderStatusSeverity;
  } | null>(null);
  const [anthropicModelFilter, setAnthropicModelFilter] = useState("");
  const [openAIModelDropdownOpen, setOpenAIModelDropdownOpen] = useState(false);
  const [openAIModelOptions, setOpenAIModelOptions] = useState<OpenAIModelOption[]>([]);
  const [openAIModelOptionsLoading, setOpenAIModelOptionsLoading] = useState(false);
  const [openAIModelOptionsMessage, setOpenAIModelOptionsMessage] = useState<{
    text: string;
    severity: ProviderStatusSeverity;
  } | null>(null);
  const [openAIModelFilter, setOpenAIModelFilter] = useState("");
  const [googleModelDropdownOpen, setGoogleModelDropdownOpen] = useState(false);
  const [googleModelOptions, setGoogleModelOptions] = useState<GoogleModelOption[]>([]);
  const [googleModelOptionsLoading, setGoogleModelOptionsLoading] = useState(false);
  const [googleModelOptionsMessage, setGoogleModelOptionsMessage] = useState<{
    text: string;
    severity: ProviderStatusSeverity;
  } | null>(null);
  const [googleModelFilter, setGoogleModelFilter] = useState("");
  const [providerDeleteModal, setProviderDeleteModal] = useState<ProviderDeleteModalState | null>(null);
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingFilter, setTrainingFilter] = useState<TrainingFilter>("all");
  const [isGlobalScreenLoading, setIsGlobalScreenLoading] = useState(false);
  const [isTrainingEditorLoading, setIsTrainingEditorLoading] = useState(false);
  const [activeTrainingTemplateId, setActiveTrainingTemplateId] = useState<string | null>(null);
  const [activeTrainingTemplateMode, setActiveTrainingTemplateMode] =
    useState<TrainingTemplateScreenMode>("detail");
  const [trainingDetailMuscleFilter, setTrainingDetailMuscleFilter] = useState("all");
  const [trainingStatsPeriod, setTrainingStatsPeriod] = useState<TrainingStatsPeriodKey>("3m");
  const [trainingStatsMetric, setTrainingStatsMetric] = useState<TrainingStatsMetricKey>("volume");
  const [trainingMenuTemplateId, setTrainingMenuTemplateId] = useState<string | null>(null);
  const [activeExerciseMenuId, setActiveExerciseMenuId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseDetailIndex, setExerciseDetailIndex] = useState<number | null>(null);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);
  const [lastWorkoutSessionSummary, setLastWorkoutSessionSummary] =
    useState<WorkoutSessionSummary | null>(null);
  const [workoutCompletionModal, setWorkoutCompletionModal] =
    useState<WorkoutCompletionModalState | null>(null);
  const [confirmDiscardSession, setConfirmDiscardSession] = useState(false);
  const restFinishSoundRef = useRef<Audio.Sound | null>(null);
  const workoutTemplateBeforeSessionRef = useRef<WorkoutTemplate | null>(null);
  const globalScreenLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trainingEditorLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restTransitionRef = useRef<{ wasResting: boolean; restLeft: number }>({
    wasResting: false,
    restLeft: 0,
  });
  const manualRestSkipRef = useRef(false);
  const restAlertLockRef = useRef(false);
  const providerSettingsInitializedRef = useRef(false);

  const today = todayISO();
  const dietDateLabel = formatDietDayHeader(selectedDietDate);
  const dietDateContextLabel = formatDietDayContext(selectedDietDate, today);
  const todayDietDay = store.dietByDate[today] ?? { day_date: today, meals: [] };
  const dietDay = store.dietByDate[selectedDietDate] ?? { day_date: selectedDietDate, meals: [] };
  const activeProvider = useMemo(
    () => store.keys.find((item) => item.is_active) ?? null,
    [store.keys],
  );
  const orderedProviderKeys = useMemo(
    () =>
      (["anthropic", "openai", "google"] as Provider[])
        .map((provider) => store.keys.find((item) => item.provider === provider))
        .filter((item): item is AIKey => !!item),
    [store.keys],
  );
  const filteredAnthropicModelOptions = useMemo(() => {
    const query = anthropicModelFilter.trim().toLowerCase();
    if (!query) return anthropicModelOptions;
    return anthropicModelOptions.filter((option) =>
      `${option.id} ${option.display_name ?? ""}`.toLowerCase().includes(query),
    );
  }, [anthropicModelFilter, anthropicModelOptions]);
  const filteredOpenAIModelOptions = useMemo(() => {
    const query = openAIModelFilter.trim().toLowerCase();
    if (!query) return openAIModelOptions;
    return openAIModelOptions.filter((option) =>
      `${option.id} ${option.owned_by ?? ""}`.toLowerCase().includes(query),
    );
  }, [openAIModelFilter, openAIModelOptions]);
  const filteredGoogleModelOptions = useMemo(() => {
    const query = googleModelFilter.trim().toLowerCase();
    if (!query) return googleModelOptions;
    return googleModelOptions.filter((option) =>
      `${option.id} ${option.display_name ?? ""}`.toLowerCase().includes(query),
    );
  }, [googleModelFilter, googleModelOptions]);
  const latestWeightMeasurement = useMemo(
    () => store.measurements.find((measurement) => measurement.weight_kg !== null) ?? null,
    [store.measurements],
  );
  const latestHeightMeasurement = useMemo(
    () => store.measurements.find((measurement) => measurement.height_cm !== null) ?? null,
    [store.measurements],
  );
  const latestBodyWeightKg = latestWeightMeasurement?.weight_kg ?? null;
  const latestBodyHeightCm = latestHeightMeasurement?.height_cm ?? null;
  const measuresDashboardPeriodMeta = useMemo(
    () =>
      MEASURES_DASHBOARD_PERIOD_OPTIONS.find((option) => option.key === measuresDashboardPeriod) ??
      MEASURES_DASHBOARD_PERIOD_OPTIONS[1],
    [measuresDashboardPeriod],
  );
  const canExpandMeasurementHistory = store.measurements.length > 4;
  const dietSettings = store.dietSettings;

  function resolveMeasurementMetricPair(
    selector: (measurement: Measurement) => number | null,
  ): { latest: number | null; previous: number | null } {
    let latest: number | null = null;
    let previous: number | null = null;

    for (const measurement of store.measurements) {
      const value = selector(measurement);
      if (value === null || !Number.isFinite(value)) continue;
      if (latest === null) {
        latest = value;
        continue;
      }
      previous = value;
      break;
    }

    return { latest, previous };
  }

  function buildMeasurementStatCard(
    label: string,
    latest: number | null,
    previous: number | null,
    formatValue: (value: number) => string,
    unitLabel: string,
    prefersDecrease: boolean,
  ): {
    label: string;
    valueText: string;
    changeText: string;
    changeColor: string;
    changeIcon: keyof typeof Feather.glyphMap;
  } {
    if (latest === null) {
      return {
        label,
        valueText: "Sin datos",
        changeText: "Registra tu primera medición",
        changeColor: "#6F7785",
        changeIcon: "minus",
      };
    }

    if (previous === null) {
      return {
        label,
        valueText: formatValue(latest),
        changeText: "Primer registro",
        changeColor: "#19C37D",
        changeIcon: "arrow-right",
      };
    }

    const delta = Math.round((latest - previous) * 10) / 10;
    if (Math.abs(delta) < 0.05) {
      return {
        label,
        valueText: formatValue(latest),
        changeText: "Sin cambio",
        changeColor: "#6F7785",
        changeIcon: "minus",
      };
    }

    const improved = prefersDecrease ? delta < 0 : delta > 0;
    const signedValue = `${delta > 0 ? "+" : "-"}${formatMeasurementNumber(Math.abs(delta))}`;
    return {
      label,
      valueText: formatValue(latest),
      changeText: `${signedValue} ${unitLabel} vs registro ant.`,
      changeColor: improved ? "#19C37D" : mobileTheme.color.brandPrimary,
      changeIcon: delta < 0 ? "trending-down" : "trending-up",
    };
  }

  const weightMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.weight_kg);
  const bodyFatMeasurementPair = resolveMeasurementMetricPair((measurement) =>
    estimateMeasurementBodyFatPercentage(measurement, latestBodyHeightCm),
  );
  const waistMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.waist_cm);
  const chestMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.chest_cm);
  const armMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.biceps_cm);
  const measuresPrimaryStatCards = [
    buildMeasurementStatCard(
      "Peso actual",
      weightMeasurementPair.latest,
      weightMeasurementPair.previous,
      (value) => `${formatMeasurementNumber(value)} kg`,
      "kg",
      true,
    ),
    buildMeasurementStatCard(
      "% Grasa",
      bodyFatMeasurementPair.latest,
      bodyFatMeasurementPair.previous,
      (value) => `${formatMeasurementNumber(value)}%`,
      "%",
      true,
    ),
  ];
  const measuresSecondaryStatCards = [
    buildMeasurementStatCard(
      "Cintura",
      waistMeasurementPair.latest,
      waistMeasurementPair.previous,
      (value) => `${formatMeasurementNumber(value)} cm`,
      "cm",
      true,
    ),
    buildMeasurementStatCard(
      "Pecho",
      chestMeasurementPair.latest,
      chestMeasurementPair.previous,
      (value) => `${formatMeasurementNumber(value)} cm`,
      "cm",
      false,
    ),
    buildMeasurementStatCard(
      "Brazo",
      armMeasurementPair.latest,
      armMeasurementPair.previous,
      (value) => `${formatMeasurementNumber(value)} cm`,
      "cm",
      false,
    ),
  ];
  const measuresDashboardChartPoints = useMemo(() => {
    const cutoffTime =
      measuresDashboardPeriodMeta.days === null
        ? null
        : Date.now() - measuresDashboardPeriodMeta.days * 24 * 60 * 60 * 1000;
    const monthBuckets = new Map<
      string,
      { key: string; label: string; value: number; timestamp: number }
    >();

    const filteredWeightMeasurements = [...store.measurements]
      .filter((measurement) => measurement.weight_kg !== null)
      .filter((measurement) => {
        const measurementTime = new Date(measurement.measured_at).getTime();
        if (Number.isNaN(measurementTime)) return false;
        if (cutoffTime === null) return true;
        return measurementTime >= cutoffTime;
      })
      .sort(
        (a, b) =>
          new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
      );

    filteredWeightMeasurements.forEach((measurement) => {
      const measurementTime = new Date(measurement.measured_at).getTime();
      if (Number.isNaN(measurementTime) || measurement.weight_kg === null) return;
      const parsedDate = new Date(measurementTime);
      const bucketKey = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
      monthBuckets.set(bucketKey, {
        key: bucketKey,
        label: DIET_MONTH_LABELS_SHORT[parsedDate.getMonth()],
        value: measurement.weight_kg,
        timestamp: measurementTime,
      });
    });

    const points = Array.from(monthBuckets.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6);
    if (points.length === 0) return [];

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(0.4, maxValue - minValue);

    return points.map((point, index) => ({
      ...point,
      heightPercent: 24 + ((point.value - minValue) / range) * 64,
      isLatest: index === points.length - 1,
    }));
  }, [measuresDashboardPeriodMeta.days, store.measurements]);
  const measuresDashboardScaleLabels = useMemo(() => {
    if (measuresDashboardChartPoints.length === 0) {
      return { top: null, mid: null, bottom: null };
    }

    const values = measuresDashboardChartPoints.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const middleValue = minValue + (maxValue - minValue) / 2;

    return {
      top: formatMeasurementNumber(maxValue),
      mid: formatMeasurementNumber(middleValue),
      bottom: formatMeasurementNumber(minValue),
    };
  }, [measuresDashboardChartPoints]);
  const measurementHistoryEntries = useMemo(
    () =>
      (showAllMeasurementsHistory
        ? store.measurements
        : store.measurements.slice(0, 4)
      ).map((measurement, sourceIndex) => ({
        measurement,
        sourceIndex,
      })),
    [showAllMeasurementsHistory, store.measurements],
  );
  const dietDailyCaloriesTarget = parseNonNegativeNumberInput(dietSettings.daily_calories) ?? 0;
  const manualCarbsCalories =
    parseNonNegativeNumberInput(dietSettings.manual_macro_calories.carbs) ?? 0;
  const manualProteinCalories =
    parseNonNegativeNumberInput(dietSettings.manual_macro_calories.protein) ?? 0;
  const manualFatCalories =
    parseNonNegativeNumberInput(dietSettings.manual_macro_calories.fat) ?? 0;
  const manualAssignedCalories =
    manualCarbsCalories + manualProteinCalories + manualFatCalories;
  const manualRemainingCalories = dietDailyCaloriesTarget - manualAssignedCalories;
  const manualCarbsGrams = manualCarbsCalories / 4;
  const manualProteinGrams = manualProteinCalories / 4;
  const manualFatGrams = manualFatCalories / 9;
  const proteinGramsPerKgTarget =
    parseNonNegativeNumberInput(dietSettings.protein_grams_per_kg) ?? 0;
  const carbsGramsPerKgTarget =
    parseNonNegativeNumberInput(dietSettings.carbs_grams_per_kg) ?? 0;
  const fatGramsPerKgTarget =
    parseNonNegativeNumberInput(dietSettings.fat_grams_per_kg) ?? 0;
  const gkgMacroTargets: Record<GkgMacroKey, number> = {
    protein: proteinGramsPerKgTarget,
    carbs: carbsGramsPerKgTarget,
    fat: fatGramsPerKgTarget,
  };
  const proteinGramsFromWeightPlan =
    latestBodyWeightKg !== null ? latestBodyWeightKg * proteinGramsPerKgTarget : 0;
  const carbsGramsFromWeightPlan =
    latestBodyWeightKg !== null ? latestBodyWeightKg * carbsGramsPerKgTarget : 0;
  const fatGramsFromWeightPlan =
    latestBodyWeightKg !== null ? latestBodyWeightKg * fatGramsPerKgTarget : 0;
  const proteinCaloriesFromWeightPlan = proteinGramsFromWeightPlan * 4;
  const carbsCaloriesFromWeightPlan = carbsGramsFromWeightPlan * 4;
  const fatCaloriesFromWeightPlan = fatGramsFromWeightPlan * 9;
  const caloriesRemainingAfterWeightPlan =
    dietDailyCaloriesTarget -
    (proteinCaloriesFromWeightPlan + carbsCaloriesFromWeightPlan + fatCaloriesFromWeightPlan);
  const hasWeightForGkgPlanning =
    latestBodyWeightKg !== null && Number.isFinite(latestBodyWeightKg) && latestBodyWeightKg > 0;
  const gkgConfiguredMacroCount = GKG_MACRO_KEYS.filter(
    (macro) => gkgMacroTargets[macro] > 0,
  ).length;
  const autocompleteGkgMacroKey: GkgMacroKey | null =
    gkgConfiguredMacroCount === 2
      ? GKG_MACRO_KEYS.find((macro) => gkgMacroTargets[macro] <= 0) ?? null
      : null;
  const canAutocompleteGkgMacro =
    autocompleteGkgMacroKey !== null && hasWeightForGkgPlanning && dietDailyCaloriesTarget > 0;
  const autocompleteGkgMacroPerKgValue =
    canAutocompleteGkgMacro && autocompleteGkgMacroKey
      ? Math.max(
          0,
          (dietDailyCaloriesTarget -
            GKG_MACRO_KEYS.reduce((acc, macro) => {
              if (macro === autocompleteGkgMacroKey) return acc;
              return (
                acc +
                gkgMacroTargets[macro] *
                  (latestBodyWeightKg ?? 0) *
                  gkgMacroCaloriesPerGram(macro)
              );
            }, 0)) /
            (gkgMacroCaloriesPerGram(autocompleteGkgMacroKey) * (latestBodyWeightKg ?? 1)),
        )
      : null;
  const autocompleteGkgMacroPerKgText =
    autocompleteGkgMacroPerKgValue !== null && Number.isFinite(autocompleteGkgMacroPerKgValue)
      ? autocompleteGkgMacroPerKgValue.toFixed(2).replace(/\.?0+$/, "")
      : null;
  const hasAnyGkgMacroConfigured =
    proteinGramsPerKgTarget > 0 || carbsGramsPerKgTarget > 0 || fatGramsPerKgTarget > 0;
  const shouldShowGkgMaxHints =
    hasWeightForGkgPlanning && dietDailyCaloriesTarget > 0 && hasAnyGkgMacroConfigured;
  const proteinMaxGramsPerKgHint = shouldShowGkgMaxHints
    ? Math.max(0, (dietDailyCaloriesTarget - (carbsCaloriesFromWeightPlan + fatCaloriesFromWeightPlan)) / 4)
        / (latestBodyWeightKg ?? 1)
    : null;
  const carbsMaxGramsPerKgHint = shouldShowGkgMaxHints
    ? Math.max(0, (dietDailyCaloriesTarget - (proteinCaloriesFromWeightPlan + fatCaloriesFromWeightPlan)) / 4)
        / (latestBodyWeightKg ?? 1)
    : null;
  const fatMaxGramsPerKgHint = shouldShowGkgMaxHints
    ? Math.max(0, (dietDailyCaloriesTarget - (proteinCaloriesFromWeightPlan + carbsCaloriesFromWeightPlan)) / 9)
        / (latestBodyWeightKg ?? 1)
    : null;
  const proteinGkgPlaceholder =
    proteinMaxGramsPerKgHint !== null
      ? `Proteína (g por kg corporal) (${proteinMaxGramsPerKgHint.toFixed(2)} g/kg max)`
      : "Proteína (g por kg corporal)";
  const carbsGkgPlaceholder =
    carbsMaxGramsPerKgHint !== null
      ? `Carbohidratos (g por kg corporal) (${carbsMaxGramsPerKgHint.toFixed(2)} g/kg max)`
      : "Carbohidratos (g por kg corporal)";
  const fatGkgPlaceholder =
    fatMaxGramsPerKgHint !== null
      ? `Grasas (g por kg corporal) (${fatMaxGramsPerKgHint.toFixed(2)} g/kg max)`
      : "Grasas (g por kg corporal)";
  const configuredMacroCaloriesTotal =
    dietSettings.macro_mode === "manual_calories"
      ? manualAssignedCalories
      : proteinCaloriesFromWeightPlan + carbsCaloriesFromWeightPlan + fatCaloriesFromWeightPlan;
  const configuredMacroCaloriesRemaining = dietDailyCaloriesTarget - configuredMacroCaloriesTotal;
  const dayCaloriesConsumed = sumDayCalories(dietDay);
  const dayProteinConsumed = sumDayMacroGrams(dietDay, "protein_g");
  const dayCarbsConsumed = sumDayMacroGrams(dietDay, "carbs_g");
  const dayFatConsumed = sumDayMacroGrams(dietDay, "fat_g");
  const proteinDailyTargetGrams =
    dietSettings.macro_mode === "manual_calories" ? manualProteinGrams : proteinGramsFromWeightPlan;
  const carbsDailyTargetGrams =
    dietSettings.macro_mode === "manual_calories" ? manualCarbsGrams : carbsGramsFromWeightPlan;
  const fatDailyTargetGrams =
    dietSettings.macro_mode === "manual_calories" ? manualFatGrams : fatGramsFromWeightPlan;
  const dayCaloriesProgress =
    dietDailyCaloriesTarget > 0 ? Math.min(dayCaloriesConsumed / dietDailyCaloriesTarget, 1) : 0;
  const dayCaloriesPercent =
    dietDailyCaloriesTarget > 0 ? Math.round(Math.min((dayCaloriesConsumed / dietDailyCaloriesTarget) * 100, 999)) : 0;
  const dietMacroOverview = [
    {
      key: "protein",
      label: "Proteína",
      consumed: dayProteinConsumed,
      total: proteinDailyTargetGrams,
      accent: "#FF6E6E",
    },
    {
      key: "carbs",
      label: "Carbos",
      consumed: dayCarbsConsumed,
      total: carbsDailyTargetGrams,
      accent: mobileTheme.color.brandPrimary,
    },
    {
      key: "fat",
      label: "Grasa",
      consumed: dayFatConsumed,
      total: fatDailyTargetGrams,
      accent: "#4D84FF",
    },
  ];
  const orderedDietMeals = DIET_MEAL_CATEGORIES.map((category) => {
    const existing = dietDay.meals.find((meal) => meal.title === category);
    return (
      existing ?? {
        id: `meal_virtual_${selectedDietDate}_${category.toLowerCase()}`,
        title: category,
        items: [],
      }
    );
  });

  const todayCaloriesConsumed = sumDayCalories(todayDietDay);
  const dashboard = useMemo<Dashboard>(() => {
    return {
      calories: todayCaloriesConsumed,
      weight: latestBodyWeightKg,
    };
  }, [latestBodyWeightKg, todayCaloriesConsumed]);
  const homeFeaturedTemplate = useMemo(() => {
    if (activeWorkoutSession) {
      const activeTemplate =
        store.templates.find((template) => template.id === activeWorkoutSession.template_id) ?? null;
      if (activeTemplate) return activeTemplate;
    }
    return store.templates.find((template) => templateHasRunnableSeries(template)) ?? store.templates[0] ?? null;
  }, [activeWorkoutSession, store.templates]);
  const homeFeaturedCategory = useMemo(
    () => (homeFeaturedTemplate ? resolveTrainingCategory(homeFeaturedTemplate) : null),
    [homeFeaturedTemplate],
  );
  const homeFeaturedCategoryMeta = useMemo(
    () => (homeFeaturedCategory ? trainingCategoryMeta(homeFeaturedCategory) : null),
    [homeFeaturedCategory],
  );
  const homeFeaturedIcon = useMemo(() => {
    if (!homeFeaturedTemplate || !homeFeaturedCategory) return null;
    const templateIndex = Math.max(
      0,
      store.templates.findIndex((template) => template.id === homeFeaturedTemplate.id),
    );
    return normalizeTemplateIcon(homeFeaturedTemplate.icon, homeFeaturedCategory, templateIndex);
  }, [homeFeaturedCategory, homeFeaturedTemplate, store.templates]);
  const homeFeaturedDurationMinutes = useMemo(
    () => (homeFeaturedTemplate ? inferTemplateDurationMinutes(homeFeaturedTemplate) : 0),
    [homeFeaturedTemplate],
  );
  const homeFeaturedExercises = useMemo(() => {
    if (!homeFeaturedTemplate || !homeFeaturedCategory) return [];
    return homeFeaturedTemplate.exercises.slice(0, 3).map((exercise, exerciseIndex) => {
      const exerciseName = exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`;
      const muscle =
        exercise.muscle?.trim() ||
        inferExerciseMuscle(exerciseName, homeFeaturedCategory);
      return {
        id: exercise.id,
        exerciseName,
        imageUri: normalizeExerciseImageUri(exercise.image_uri),
        volumeLabel: formatHomeExerciseVolume(exercise.series ?? []),
        previewMeta: resolveExercisePreviewMeta(exerciseName, muscle, homeFeaturedCategory),
      };
    });
  }, [homeFeaturedCategory, homeFeaturedTemplate]);
  const homeFeaturedHeroImageUri = useMemo(
    () => homeFeaturedExercises.find((exercise) => exercise.imageUri)?.imageUri ?? null,
    [homeFeaturedExercises],
  );
  const homeWorkoutStreak = useMemo(
    () => calculateWorkoutStreak(store.workoutHistory),
    [store.workoutHistory],
  );
  const homeWeekProgress = useMemo(
    () => buildHomeWeekProgress(store.workoutHistory),
    [store.workoutHistory],
  );
  const homeWeekCompletedCount = useMemo(
    () => homeWeekProgress.filter((day) => day.completed).length,
    [homeWeekProgress],
  );
  const homeWeightChangeText = useMemo(() => {
    if (weightMeasurementPair.latest === null || weightMeasurementPair.previous === null) {
      return "Sin histórico";
    }
    const delta = Math.round((weightMeasurementPair.latest - weightMeasurementPair.previous) * 10) / 10;
    if (Math.abs(delta) < 0.05) return "Sin cambios";
    return `${delta > 0 ? "+" : "-"}${formatMeasurementNumber(Math.abs(delta))} kg`;
  }, [weightMeasurementPair.latest, weightMeasurementPair.previous]);
  const homeCurrentHour = new Date().getHours();
  const homeGreetingLabel =
    homeCurrentHour < 12
      ? "Buenos días"
      : homeCurrentHour < 20
        ? "Buenas tardes"
        : "Buenas noches";
  const canStartHomeFeaturedTemplate =
    !!homeFeaturedTemplate && templateHasRunnableSeries(homeFeaturedTemplate);
  const homePrimaryActionLabel = activeWorkoutSession
    ? "Continuar entrenamiento"
    : canStartHomeFeaturedTemplate
      ? "Iniciar entrenamiento"
      : "Crear rutina";

  const filteredTrainingTemplates = useMemo(() => {
    const normalizedSearch = trainingSearch.trim().toLowerCase();
    return store.templates.filter((template) => {
      const matchesSearch =
        !normalizedSearch || template.name.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        trainingFilter === "all" ||
        resolveTrainingCategory(template) === trainingFilter;
      return matchesSearch && matchesFilter;
    });
  }, [store.templates, trainingFilter, trainingSearch]);
  const activeTrainingTemplate = useMemo(
    () => store.templates.find((template) => template.id === activeTrainingTemplateId) ?? null,
    [activeTrainingTemplateId, store.templates],
  );
  const activeTrainingCategory = useMemo(
    () => (activeTrainingTemplate ? resolveTrainingCategory(activeTrainingTemplate) : null),
    [activeTrainingTemplate],
  );
  const activeTrainingCategoryMeta = useMemo(
    () => (activeTrainingCategory ? trainingCategoryMeta(activeTrainingCategory) : null),
    [activeTrainingCategory],
  );
  const activeTrainingIcon = useMemo(() => {
    if (!activeTrainingTemplate || !activeTrainingCategory) return null;
    return normalizeTemplateIcon(activeTrainingTemplate.icon, activeTrainingCategory, 0);
  }, [activeTrainingCategory, activeTrainingTemplate]);
  const activeTrainingDurationMinutes = useMemo(
    () => (activeTrainingTemplate ? inferTemplateDurationMinutes(activeTrainingTemplate) : 0),
    [activeTrainingTemplate],
  );
  const activeTrainingSeriesTotal = useMemo(
    () => (activeTrainingTemplate ? totalSeriesCount(activeTrainingTemplate) : 0),
    [activeTrainingTemplate],
  );
  const activeTrainingPreviewExercises = useMemo(() => {
    if (!activeTrainingTemplate || !activeTrainingCategory) return [];
    return activeTrainingTemplate.exercises.map((exercise, exerciseIndex) => {
      const exerciseName = exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`;
      const seriesItems = exercise.series ?? [];
      const muscle =
        exercise.muscle?.trim() ||
        inferExerciseMuscle(exerciseName, activeTrainingCategory);
      const firstSeries = seriesItems[0] ?? null;
      const firstWeight =
        seriesItems.find((seriesItem) => seriesItem.weight_kg.trim())?.weight_kg.trim() ?? "";
      const repsLabel = firstSeries?.reps.trim() || "--";
      const firstRest =
        seriesItems.find((seriesItem) => seriesItem.rest_seconds.trim())?.rest_seconds.trim() ?? "";
      const repoMatch = exercisesRepo.find(
        (r) => r.name.toLowerCase() === exerciseName.toLowerCase(),
      );
      return {
        exercise,
        exerciseIndex,
        exerciseName,
        imageUri: normalizeExerciseImageUri(exercise.image_uri),
        muscle,
        previewMeta: resolveExercisePreviewMeta(exerciseName, muscle, activeTrainingCategory),
        instructions: repoMatch?.instructions ?? "",
        seriesItems,
        setsCount: seriesItems.length,
        repsLabel,
        weightLabel: firstWeight,
        restLabel: firstRest,
        volumeLabel:
          seriesItems.length > 0
            ? `${seriesItems.length} x ${repsLabel} reps${firstWeight ? ` • ${firstWeight}kg` : ""}`
            : "Sin series configuradas",
      };
    });
  }, [activeTrainingCategory, activeTrainingTemplate, exercisesRepo]);
  const activeTrainingMuscleFilters = useMemo(
    () => Array.from(new Set(activeTrainingPreviewExercises.map((exercise) => exercise.muscle))),
    [activeTrainingPreviewExercises],
  );
  const activeTrainingDetailExercises = useMemo(
    () =>
      activeTrainingPreviewExercises.filter(
        (exercise) =>
          trainingDetailMuscleFilter === "all" || exercise.muscle === trainingDetailMuscleFilter,
      ),
    [activeTrainingPreviewExercises, trainingDetailMuscleFilter],
  );
  const exercisePickerMuscleGroups = useMemo(
    () => Array.from(new Set(exercisesRepo.map((e) => e.muscle_group))),
    [exercisesRepo],
  );
  const filteredExercisePickerEntries = useMemo(() => {
    const search = exercisePickerSearch.trim().toLowerCase();
    return exercisesRepo.filter((entry) => {
      const matchesSearch = !search || entry.name.toLowerCase().includes(search) || entry.muscle_group.toLowerCase().includes(search);
      const matchesMuscle = exercisePickerMuscleFilter === "all" || entry.muscle_group === exercisePickerMuscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [exercisesRepo, exercisePickerSearch, exercisePickerMuscleFilter]);

  const activeTrainingPreviewImageUri = useMemo(
    () => activeTrainingPreviewExercises.find((exercise) => exercise.imageUri)?.imageUri ?? null,
    [activeTrainingPreviewExercises],
  );
  const activeTrainingEstimatedCalories = useMemo(
    () => (activeTrainingTemplate ? estimateTemplateCalories(activeTrainingTemplate) : 0),
    [activeTrainingTemplate],
  );
  const activeTrainingSummary = useMemo(() => {
    if (activeTrainingMuscleFilters.length === 0) {
      return "Configura los ejercicios y prepara tu próxima sesión.";
    }
    const focus = formatSpanishList(
      activeTrainingMuscleFilters.slice(0, 3).map((muscle) => muscle.toLowerCase()),
    );
    return `Trabaja ${focus} con una sesión estructurada y lista para empezar.`;
  }, [activeTrainingMuscleFilters]);
  const activeTrainingStatsMetricMeta = useMemo(
    () =>
      TRAINING_STATS_METRIC_OPTIONS.find((option) => option.key === trainingStatsMetric) ??
      TRAINING_STATS_METRIC_OPTIONS[0],
    [trainingStatsMetric],
  );
  const activeTrainingHistory = useMemo(() => {
    if (!activeTrainingTemplate) return [];
    return [...store.workoutHistory]
      .filter((summary) => summary.template_id === activeTrainingTemplate.id)
      .sort((a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime());
  }, [activeTrainingTemplate, store.workoutHistory]);
  const activeTrainingFilteredHistory = useMemo(() => {
    const cutoff = resolveTrainingStatsPeriodStart(trainingStatsPeriod);
    if (cutoff === null) return activeTrainingHistory;
    return activeTrainingHistory.filter(
      (summary) => new Date(summary.finished_at).getTime() >= cutoff,
    );
  }, [activeTrainingHistory, trainingStatsPeriod]);
  const activeTrainingChartBars = useMemo(() => {
    const points = activeTrainingFilteredHistory.map((summary) => {
      const metricValue =
        trainingStatsMetric === "volume"
          ? summary.total_volume_kg
          : trainingStatsMetric === "reps"
            ? summary.total_reps
            : Math.round((summary.elapsed_seconds / 60) * 10) / 10;
      return {
        id: summary.id,
        label: formatTrainingStatsHistoryLabel(summary.finished_at),
        metricValue,
        metricValueLabel: formatTrainingStatsMetricValue(trainingStatsMetric, metricValue),
      };
    });

    const maxValue = points.reduce((acc, point) => Math.max(acc, point.metricValue), 0);
    return points.map((point, index) => ({
      ...point,
      isLatest: index === points.length - 1,
      heightPercent: maxValue > 0 ? Math.max(10, (point.metricValue / maxValue) * 100) : 10,
    }));
  }, [activeTrainingFilteredHistory, trainingStatsMetric]);
  const activeTrainingLatestChartBar = useMemo(
    () =>
      activeTrainingChartBars.length > 0
        ? activeTrainingChartBars[activeTrainingChartBars.length - 1]
        : null,
    [activeTrainingChartBars],
  );
  const activeSessionTemplate = useMemo(() => {
    if (!activeWorkoutSession) return null;
    return store.templates.find((template) => template.id === activeWorkoutSession.template_id) ?? null;
  }, [activeWorkoutSession, store.templates]);
  const activeSessionPointers = useMemo(
    () => (activeSessionTemplate ? listTemplateSeriesPointers(activeSessionTemplate) : []),
    [activeSessionTemplate],
  );
  const activeSessionCurrentPointerIndex = useMemo(() => {
    if (!activeWorkoutSession) return -1;
    return activeSessionPointers.findIndex(
      (item) =>
        item.exerciseIndex === activeWorkoutSession.current_exercise_index &&
        item.seriesIndex === activeWorkoutSession.current_series_index,
    );
  }, [activeWorkoutSession, activeSessionPointers]);
  const activeSessionCurrentPointer = useMemo(() => {
    if (activeSessionPointers.length === 0) return null;
    if (activeSessionCurrentPointerIndex < 0) return activeSessionPointers[0];
    return activeSessionPointers[activeSessionCurrentPointerIndex];
  }, [activeSessionCurrentPointerIndex, activeSessionPointers]);
  const activeSessionProgressRatio = useMemo(() => {
    if (!activeWorkoutSession) return 0;
    if (activeWorkoutSession.total_series_count <= 0) return 0;
    return Math.max(
      0,
      Math.min(1, activeWorkoutSession.completed_series_count / activeWorkoutSession.total_series_count),
    );
  }, [activeWorkoutSession]);
  const activeSessionCategoryMeta = useMemo(
    () => (activeWorkoutSession ? trainingCategoryMeta(activeWorkoutSession.category) : null),
    [activeWorkoutSession],
  );
  const activeSessionProgressPercent = useMemo(
    () => Math.max(0, Math.min(100, Math.round(activeSessionProgressRatio * 100))),
    [activeSessionProgressRatio],
  );
  const activeSessionCompletedKeySet = useMemo(
    () => new Set(activeWorkoutSession?.completed_series_keys ?? []),
    [activeWorkoutSession?.completed_series_keys],
  );
  const activeSessionExercises = useMemo(() => {
    if (!activeWorkoutSession || !activeSessionTemplate) return [];
    return activeSessionTemplate.exercises.map((exercise, exerciseIndex) => {
      const seriesStates = (exercise.series ?? []).map((series, seriesIndex) => {
        const key = `${exercise.id}:${series.id}`;
        const isCompleted = activeSessionCompletedKeySet.has(key);
        const isCurrent =
          activeSessionCurrentPointer?.exerciseId === exercise.id &&
          activeSessionCurrentPointer?.seriesId === series.id;
        return {
          key,
          series,
          seriesIndex,
          isCompleted,
          isCurrent,
        };
      });
      const completedSeriesCount = seriesStates.filter((item) => item.isCompleted).length;
      const totalSeriesCount = seriesStates.length;
      const isCurrentExercise = activeSessionCurrentPointer?.exerciseId === exercise.id;
      const isCompletedExercise = totalSeriesCount > 0 && completedSeriesCount === totalSeriesCount;
      const muscle =
        exercise.muscle?.trim() ||
        inferExerciseMuscle(exercise.name ?? "", activeWorkoutSession.category);
      return {
        exercise,
        exerciseIndex,
        seriesStates,
        completedSeriesCount,
        totalSeriesCount,
        isCurrentExercise,
        isCompletedExercise,
        muscle,
      };
    });
  }, [
    activeSessionCompletedKeySet,
    activeSessionCurrentPointer?.exerciseId,
    activeSessionCurrentPointer?.seriesId,
    activeSessionTemplate,
    activeWorkoutSession,
  ]);
  const activeSessionRestTargetSeconds = useMemo(
    () => parseRestSecondsInput(activeSessionCurrentPointer?.series.rest_seconds ?? ""),
    [activeSessionCurrentPointer?.series.rest_seconds],
  );
  const activeSessionRestProgressRatio = useMemo(() => {
    if (!activeWorkoutSession?.is_resting) return 0;
    const total = Math.max(1, activeSessionRestTargetSeconds);
    return Math.max(
      0,
      Math.min(1, (total - activeWorkoutSession.rest_seconds_left) / total),
    );
  }, [
    activeSessionRestTargetSeconds,
    activeWorkoutSession?.is_resting,
    activeWorkoutSession?.rest_seconds_left,
  ]);
  const headerTitle =
    tab === "training"
      ? activeWorkoutSession
        ? "Sesión Activa"
        : activeTrainingTemplate
          ? activeTrainingTemplateMode === "edit"
            ? "Editar Rutina"
            : "Detalle Rutina"
          : "Mis Rutinas"
      : tabLabel(tab);
  const headerTitleSize = tab === "training" ? 34 : 28;
  const showGlobalScreenLoading = ENABLE_GLOBAL_SCREEN_LOAD_DELAY && isGlobalScreenLoading;
  const isTrainingTemplateScreenOpen =
    tab === "training" && !activeWorkoutSession && !!activeTrainingTemplateId;
  const isTrainingDetailOpen =
    isTrainingTemplateScreenOpen && activeTrainingTemplateMode === "detail";
  const isTrainingEditorOpen =
    isTrainingTemplateScreenOpen && activeTrainingTemplateMode === "edit";
  const showTrainingListSkeleton =
    tab === "training" &&
    !activeTrainingTemplate &&
    !activeWorkoutSession &&
    showGlobalScreenLoading;
  const showTrainingEditorSkeleton =
    isTrainingTemplateScreenOpen &&
    (isTrainingEditorLoading || showGlobalScreenLoading);

  useEffect(() => {
    if (tab !== "chat") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        mainScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, [tab]);

  useEffect(() => {
    if (settingsTab === "memory" && !memoryLoaded) {
      loadMemoryFields();
    }
  }, [settingsTab, memoryLoaded]);

  useEffect(() => {
    if (heightInput.trim()) return;
    if (!latestHeightMeasurement || latestHeightMeasurement.height_cm === null) return;
    setHeightInput(formatMeasurementNumber(latestHeightMeasurement.height_cm));
  }, [heightInput, latestHeightMeasurement]);

  useEffect(() => {
    if (tab !== "diet") return;
    setSelectedDietDate(todayISO());
    setShowDietDatePicker(false);
    resetDietMealEditorState();
  }, [tab]);

  const playRestFinishedAlert = useCallback(async () => {
    if (restAlertLockRef.current) return;
    restAlertLockRef.current = true;
    try {
      Vibration.vibrate(180);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          staysActiveInBackground: false,
        });

        if (!restFinishSoundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            require("./assets/rest-finished.wav"),
            { shouldPlay: false, volume: 1 },
          );
          restFinishSoundRef.current = sound;
        }

        await restFinishSoundRef.current.setPositionAsync(0);
        await restFinishSoundRef.current.playAsync();
      } catch {
        // best effort: vibration + alert still notify the user
      }

      Alert.alert("Descanso terminado", "Empieza la siguiente serie.");
    } finally {
      setTimeout(() => {
        restAlertLockRef.current = false;
      }, 450);
    }
  }, []);

  useEffect(() => {
    if (globalScreenLoadTimeoutRef.current) {
      clearTimeout(globalScreenLoadTimeoutRef.current);
      globalScreenLoadTimeoutRef.current = null;
    }

    if (!ENABLE_GLOBAL_SCREEN_LOAD_DELAY || !isHydrated) {
      setIsGlobalScreenLoading(false);
      return;
    }

    setIsGlobalScreenLoading(true);
    globalScreenLoadTimeoutRef.current = setTimeout(() => {
      setIsGlobalScreenLoading(false);
      globalScreenLoadTimeoutRef.current = null;
    }, GLOBAL_SCREEN_LOAD_DELAY_MS);

    return () => {
      if (!globalScreenLoadTimeoutRef.current) return;
      clearTimeout(globalScreenLoadTimeoutRef.current);
      globalScreenLoadTimeoutRef.current = null;
    };
  }, [isHydrated, tab]);

  useEffect(() => {
    if (trainingEditorLoadTimeoutRef.current) {
      clearTimeout(trainingEditorLoadTimeoutRef.current);
      trainingEditorLoadTimeoutRef.current = null;
    }

    if (
      !ENABLE_GLOBAL_SCREEN_LOAD_DELAY ||
      !isHydrated ||
      tab !== "training" ||
      !activeTrainingTemplateId ||
      !!activeWorkoutSession
    ) {
      setIsTrainingEditorLoading(false);
      return;
    }

    setIsTrainingEditorLoading(true);
    trainingEditorLoadTimeoutRef.current = setTimeout(() => {
      setIsTrainingEditorLoading(false);
      trainingEditorLoadTimeoutRef.current = null;
    }, GLOBAL_SCREEN_LOAD_DELAY_MS);

    return () => {
      if (!trainingEditorLoadTimeoutRef.current) return;
      clearTimeout(trainingEditorLoadTimeoutRef.current);
      trainingEditorLoadTimeoutRef.current = null;
    };
  }, [activeTrainingTemplateId, activeWorkoutSession, isHydrated, tab]);

  useEffect(() => {
    if (!activeTrainingTemplateId) return;
    if (store.templates.some((template) => template.id === activeTrainingTemplateId)) return;
    setActiveTrainingTemplateId(null);
    setActiveTrainingTemplateMode("detail");
    setTrainingDetailMuscleFilter("all");
    setTrainingStatsPeriod("3m");
    setTrainingStatsMetric("volume");
  }, [activeTrainingTemplateId, store.templates]);

  useEffect(() => {
    if (!trainingMenuTemplateId) return;
    if (store.templates.some((template) => template.id === trainingMenuTemplateId)) return;
    setTrainingMenuTemplateId(null);
  }, [store.templates, trainingMenuTemplateId]);

  useEffect(() => {
    if (trainingDetailMuscleFilter === "all") return;
    if (activeTrainingMuscleFilters.includes(trainingDetailMuscleFilter)) return;
    setTrainingDetailMuscleFilter("all");
  }, [activeTrainingMuscleFilters, trainingDetailMuscleFilter]);

  useEffect(() => {
    if (!activeTrainingTemplate) {
      setActiveExerciseMenuId(null);
      setExpandedExerciseId(null);
      return;
    }
    if (activeTrainingTemplate.exercises.length === 0) {
      setActiveExerciseMenuId(null);
      setExpandedExerciseId(null);
      return;
    }

    if (
      expandedExerciseId &&
      activeTrainingTemplate.exercises.some((exercise) => exercise.id === expandedExerciseId)
    ) {
      // keep current expanded exercise
    } else {
      setExpandedExerciseId(activeTrainingTemplate.exercises[0].id);
    }

    if (
      activeExerciseMenuId &&
      activeTrainingTemplate.exercises.some((exercise) => exercise.id === activeExerciseMenuId)
    ) {
      return;
    }
    setActiveExerciseMenuId(null);
  }, [activeExerciseMenuId, activeTrainingTemplate, expandedExerciseId]);

  useEffect(() => {
    let ignore = false;
    async function hydrate() {
      setLoading(true);
      setError(null);
      try {
        const secureAvailable = await isSecureStoreAvailable();
        if (!ignore) {
          setSecureStoreAvailable(secureAvailable);
        }

        await clearLegacyStorageData(secureAvailable);

        const [rawStore, secureApiKeys, rawSession] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          readProviderApiKeysFromSecureStore(secureAvailable),
          AsyncStorage.getItem(SESSION_STORAGE_KEY),
        ]);

        const baseStore = rawStore
          ? normalizeStore(JSON.parse(rawStore) as LocalStore)
          : createInitialStore();

        const mergedStore = mergeStoreWithSecureApiKeys(baseStore, secureApiKeys);
        const hydratedSession = rawSession
          ? normalizeWorkoutSession(JSON.parse(rawSession) as unknown, mergedStore.templates)
          : null;

        await Promise.all([
          AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(serializeStoreForAsyncStorage(mergedStore, secureAvailable)),
          ),
          writeProviderApiKeysToSecureStore(mergedStore.keys, secureAvailable),
        ]);

        if (!ignore) {
          setStore(mergedStore);
          setActiveWorkoutSession(hydratedSession);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "No se pudo cargar almacenamiento local.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setIsHydrated(true);
        }
      }
    }
    hydrate();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    loadExercisesRepo().then(setExercisesRepo);
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || providerSettingsInitializedRef.current) return;
    setProviderDraftByProvider(createProviderDraftMap(store.keys));
    setProviderConnectionStatus(createProviderConnectionStatusMap(store.keys));
    providerSettingsInitializedRef.current = true;
  }, [isHydrated, store.keys]);

  useEffect(() => {
    if (!isHydrated) return;

    Promise.all([
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(serializeStoreForAsyncStorage(store, secureStoreAvailable)),
      ),
      writeProviderApiKeysToSecureStore(store.keys, secureStoreAvailable),
    ]).catch(() => {
      setError("No se pudo guardar en almacenamiento local/seguro.");
    });
  }, [isHydrated, secureStoreAvailable, store]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!activeWorkoutSession) {
      AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {
        setError("No se pudo limpiar la sesión de entrenamiento.");
      });
      return;
    }
    AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeWorkoutSession)).catch(() => {
      setError("No se pudo guardar la sesión de entrenamiento.");
    });
  }, [activeWorkoutSession, isHydrated]);

  useEffect(() => {
    if (!activeWorkoutSession) return;
    const normalized = normalizeWorkoutSession(activeWorkoutSession, store.templates);
    if (!normalized) {
      setActiveWorkoutSession(null);
      setError("La sesión activa ya no es válida. Se ha cerrado automáticamente.");
      return;
    }
    if (JSON.stringify(normalized) !== JSON.stringify(activeWorkoutSession)) {
      setActiveWorkoutSession(normalized);
    }
  }, [activeWorkoutSession, store.templates]);

  useEffect(() => {
    if (!activeWorkoutSession || activeWorkoutSession.status !== "running") return;
    const interval = setInterval(() => {
      setActiveWorkoutSession((prev) => {
        if (!prev || prev.status !== "running") return prev;
        const nextElapsed = prev.elapsed_seconds + 1;
        if (!prev.is_resting || prev.rest_seconds_left <= 0) {
          return {
            ...prev,
            elapsed_seconds: nextElapsed,
          };
        }
        const nextRest = Math.max(0, prev.rest_seconds_left - 1);
        return {
          ...prev,
          elapsed_seconds: nextElapsed,
          rest_seconds_left: nextRest,
          is_resting: nextRest > 0,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWorkoutSession?.id, activeWorkoutSession?.status]);  // AppState effect: recalculate timer when app comes to foreground
  const appStateLastActiveRef = useRef<string | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && backgroundTimestampRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - backgroundTimestampRef.current) / 1000);
        backgroundTimestampRef.current = null;
        setActiveWorkoutSession((prev) => {
          if (!prev || prev.status !== "running") return prev;
          const nextElapsed = prev.elapsed_seconds + elapsedSeconds;
          if (!prev.is_resting || prev.rest_seconds_left <= 0) {
            return { ...prev, elapsed_seconds: nextElapsed };
          }
          const nextRest = Math.max(0, prev.rest_seconds_left - elapsedSeconds);
          return {
            ...prev,
            elapsed_seconds: nextElapsed,
            rest_seconds_left: nextRest,
            is_resting: nextRest > 0,
          };
        });
      }
      if (/inactive|background/.test(nextAppState)) {
        backgroundTimestampRef.current = Date.now();
      }
      appStateLastActiveRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!activeWorkoutSession) {
      restTransitionRef.current = { wasResting: false, restLeft: 0 };
      manualRestSkipRef.current = false;
      return;
    }

    const previous = restTransitionRef.current;
    const endedRestThisTick =
      previous.wasResting &&
      previous.restLeft > 0 &&
      !activeWorkoutSession.is_resting &&
      activeWorkoutSession.rest_seconds_left === 0;
    if (endedRestThisTick && !manualRestSkipRef.current) {
      void playRestFinishedAlert();
    }
    if (endedRestThisTick) {
      manualRestSkipRef.current = false;
    }

    restTransitionRef.current = {
      wasResting: activeWorkoutSession.is_resting,
      restLeft: activeWorkoutSession.rest_seconds_left,
    };
  }, [
    activeWorkoutSession?.id,
    activeWorkoutSession?.is_resting,
    activeWorkoutSession?.rest_seconds_left,
    playRestFinishedAlert,
  ]);

  useEffect(() => {
    return () => {
      if (!restFinishSoundRef.current) return;
      restFinishSoundRef.current.unloadAsync().catch(() => {
        // ignore unload failures
      });
      restFinishSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (activeWorkoutSession) return;
    setConfirmDiscardSession(false);
  }, [activeWorkoutSession]);

  useEffect(() => {
    setThreads(store.threads);
    if (!activeThreadId && store.threads.length > 0) {
      setActiveThreadId(store.threads[0].id);
    }
  }, [store.threads, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    setMessages(store.messagesByThread[activeThreadId] ?? []);
  }, [activeThreadId, store.messagesByThread]);

  useEffect(() => {
    if (tab === "measures") return;
    setMeasuresDashboardPeriodDropdownOpen(false);
  }, [tab]);

  async function loadMemoryFields() {
    const fields = await loadPersonalData();
    setMemoryFields(fields);
    setMemoryLoaded(true);
  }

  async function saveMemoryFields(fields: PersonalDataField[]) {
    setMemoryFields(fields);
    await savePersonalData(fields);
  }

  function updateMemoryField(index: number, field: "key" | "description" | "value", text: string) {
    const updated = [...memoryFields];
    updated[index] = { ...updated[index], [field]: text };
    setMemoryFields(updated);
  }

  async function commitMemoryField() {
    await savePersonalData(memoryFields);
  }

  async function deleteMemoryField(index: number) {
    const updated = memoryFields.filter((_, i) => i !== index);
    await saveMemoryFields(updated);
  }

  async function addMemoryField() {
    if (!memoryNewKey.trim()) return;
    const updated = [...memoryFields, { key: memoryNewKey.trim(), description: memoryNewDesc.trim(), value: memoryNewValue.trim() }];
    await saveMemoryFields(updated);
    setMemoryNewKey("");
    setMemoryNewDesc("");
    setMemoryNewValue("");
  }

  async function sendMessage() {
    if (!activeThreadId || !chatInput.trim()) {
      return;
    }

    if (!activeProvider) {
      setError("Selecciona un proveedor activo en Ajustes.");
      return;
    }
    if (!activeProvider.api_key.trim()) {
      setError(`Configura la API key de ${activeProvider.provider} en Ajustes.`);
      return;
    }

    const threadId = activeThreadId;
    setSendingChat(true);
    setError(null);

    try {
      const userInput = chatInput.trim();
      const userMessage: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: userInput,
        created_at: new Date().toISOString(),
      };

      const threadMessages = store.messagesByThread[threadId] ?? [];
      setStore((prev) => {
        const current = prev.messagesByThread[threadId] ?? [];
        return {
          ...prev,
          messagesByThread: {
            ...prev.messagesByThread,
            [threadId]: [...current, userMessage],
          },
        };
      });
      setChatInput("");

      const history = [...threadMessages, userMessage]
        .slice(-20)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      const [systemPrompt, personalDataFields] = await Promise.all([loadChatSystemPrompt(), loadPersonalData()]);
      const debugField = personalDataFields.find((f) => f.key === "debug");
      const fullSystemPrompt = debugField?.value
        ? `${systemPrompt}\n\n## Instrucciones de depuracion\n\n${debugField.value}`
        : systemPrompt;
      const assistantContent = await callProviderChatAPIWithTools(activeProvider, [
        {
          role: "system",
          content: fullSystemPrompt,
        },
        ...history,
      ]);

      const assistantMessage: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: assistantContent,
        created_at: new Date().toISOString(),
      };

      setStore((prev) => {
        const current = prev.messagesByThread[threadId] ?? [];
        return {
          ...prev,
          messagesByThread: {
            ...prev.messagesByThread,
            [threadId]: [...current, assistantMessage],
          },
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo enviar mensaje al proveedor.";
      setError(message);
      const errorBubble: ChatMessage = {
        id: uid("msg"),
        role: "assistant",
        content: `Error de proveedor: ${message}`,
        created_at: new Date().toISOString(),
      };
      setStore((prev) => {
        const current = prev.messagesByThread[threadId] ?? [];
        return {
          ...prev,
          messagesByThread: {
            ...prev.messagesByThread,
            [threadId]: [...current, errorBubble],
          },
        };
      });
    } finally {
      setSendingChat(false);
    }
  }

  function resetDietMealEditorState() {
    setDietMealEditorCategory(null);
    setDietEditingItem(null);
    setDietItemMenu(null);
    setMealTitleInput("");
    setMealCaloriesInput("");
    setMealProteinInput("");
    setMealCarbsInput("");
    setMealFatInput("");
  }

  function changeDietDateBy(days: number) {
    setShowDietDatePicker(false);
    resetDietMealEditorState();
    setSelectedDietDate((prev) => shiftISODateByDays(prev, days));
    setError(null);
  }

  function onDietDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowDietDatePicker(false);
    }
    if (event.type === "dismissed" || !selectedDate) return;
    resetDietMealEditorState();
    setSelectedDietDate(isoDateFromDate(selectedDate));
    setError(null);
  }

  function addMeal() {
    if (!dietMealEditorCategory) {
      setError("Selecciona una comida (Desayuno, Almuerzo, Comida, Merienda o Cena).");
      return;
    }
    const title = mealTitleInput.trim() || "Alimento";
    const calories = parsePositiveNumberInput(mealCaloriesInput);
    const hasProteinInput = mealProteinInput.trim().length > 0;
    const hasCarbsInput = mealCarbsInput.trim().length > 0;
    const hasFatInput = mealFatInput.trim().length > 0;
    const protein = parseNonNegativeNumberInput(mealProteinInput);
    const carbs = parseNonNegativeNumberInput(mealCarbsInput);
    const fat = parseNonNegativeNumberInput(mealFatInput);

    if (calories === null) {
      setError("Introduce calorías válidas para guardar la comida.");
      return;
    }
    if ((hasProteinInput && protein === null) || (hasCarbsInput && carbs === null) || (hasFatInput && fat === null)) {
      setError("Introduce macros válidos (0 o mayor) para guardar la comida.");
      return;
    }

    const newItem: DietItem = {
      id: uid("food"),
      title,
      calories_kcal: calories,
      protein_g: protein ?? 0,
      carbs_g: carbs ?? 0,
      fat_g: fat ?? 0,
    };

    const activeDietDate = selectedDietDate;
    setStore((prev) => {
      const currentDay = prev.dietByDate[activeDietDate] ?? { day_date: activeDietDate, meals: [] };
      if (dietEditingItem) {
        const meals = currentDay.meals
          .map((meal) => {
            if (meal.id !== dietEditingItem.meal_id) return meal;
            return {
              ...meal,
              items: meal.items.map((item) =>
                item.id === dietEditingItem.item_id
                  ? {
                      ...item,
                      title: newItem.title,
                      calories_kcal: newItem.calories_kcal,
                      protein_g: newItem.protein_g,
                      carbs_g: newItem.carbs_g,
                      fat_g: newItem.fat_g,
                    }
                  : item,
              ),
            };
          })
          .filter((meal) => meal.items.length > 0);
        return {
          ...prev,
          dietByDate: {
            ...prev.dietByDate,
            [activeDietDate]: {
              ...currentDay,
              meals: sortDietMealsByCategory(meals),
            },
          },
        };
      }
      const existingMealIndex = currentDay.meals.findIndex(
        (meal) => meal.title === dietMealEditorCategory,
      );
      const meals =
        existingMealIndex >= 0
          ? currentDay.meals.map((meal, index) =>
              index === existingMealIndex
                ? {
                    ...meal,
                    items: [...meal.items, newItem],
                  }
                : meal,
            )
          : [
              ...currentDay.meals,
              {
                id: uid("meal"),
                title: dietMealEditorCategory,
                items: [newItem],
              },
            ];
      return {
        ...prev,
        dietByDate: {
          ...prev.dietByDate,
          [activeDietDate]: {
            ...currentDay,
            meals: sortDietMealsByCategory(meals),
          },
        },
      };
    });

    setMealTitleInput("");
    setMealCaloriesInput("");
    setMealProteinInput("");
    setMealCarbsInput("");
    setMealFatInput("");
    setDietEditingItem(null);
    setDietItemMenu(null);
    setError(null);
  }

  function toggleDietMealCategory(category: DietMealCategory) {
    setDietMealExpanded((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
    setDietMealEditorCategory((prev) => (prev === category ? null : prev));
    setDietEditingItem(null);
    setDietItemMenu(null);
  }

  function openDietMealEditor(category: DietMealCategory) {
    setDietMealExpanded((prev) => ({ ...prev, [category]: true }));
    setDietMealEditorCategory(category);
    setDietEditingItem(null);
    setDietItemMenu(null);
    setMealTitleInput("");
    setMealCaloriesInput("");
    setMealProteinInput("");
    setMealCarbsInput("");
    setMealFatInput("");
    setError(null);
  }

  function startEditDietItem(
    category: DietMealCategory,
    meal: DietMeal,
    item: DietItem,
  ) {
    setDietMealExpanded((prev) => ({ ...prev, [category]: true }));
    setDietMealEditorCategory(category);
    setDietEditingItem({ meal_id: meal.id, item_id: item.id });
    setDietItemMenu(null);
    setMealTitleInput(item.title);
    setMealCaloriesInput(formatNutritionNumber(item.calories_kcal));
    setMealProteinInput(formatNutritionNumber(item.protein_g));
    setMealCarbsInput(formatNutritionNumber(item.carbs_g));
    setMealFatInput(formatNutritionNumber(item.fat_g));
    setError(null);
  }

  function deleteDietItem(meal: DietMeal, item: DietItem) {
    const activeDietDate = selectedDietDate;
    setStore((prev) => {
      const currentDay = prev.dietByDate[activeDietDate] ?? { day_date: activeDietDate, meals: [] };
      const meals = currentDay.meals
        .map((currentMeal) => {
          if (currentMeal.id !== meal.id) return currentMeal;
          return {
            ...currentMeal,
            items: currentMeal.items.filter((currentItem) => currentItem.id !== item.id),
          };
        })
        .filter((currentMeal) => currentMeal.items.length > 0);
      return {
        ...prev,
        dietByDate: {
          ...prev.dietByDate,
          [activeDietDate]: {
            ...currentDay,
            meals: sortDietMealsByCategory(meals),
          },
        },
      };
    });
    if (dietEditingItem?.meal_id === meal.id && dietEditingItem?.item_id === item.id) {
      setDietEditingItem(null);
      setMealTitleInput("");
      setMealCaloriesInput("");
      setMealProteinInput("");
      setMealCarbsInput("");
      setMealFatInput("");
    }
    setDietItemMenu(null);
    setError(null);
  }

  function resolveFoodEstimatorProviderFromState(): AIKey | null {
    const selectedProviderFromStore =
      foodEstimatorProvider &&
      store.keys.find(
        (item) => item.provider === foodEstimatorProvider.provider && item.api_key.trim().length > 0,
      );
    if (selectedProviderFromStore) {
      return {
        ...selectedProviderFromStore,
        api_key: selectedProviderFromStore.api_key.trim(),
        model: selectedProviderFromStore.model.trim() || DEFAULT_MODELS[selectedProviderFromStore.provider],
      };
    }
    return resolveFoodEstimatorProvider(store.keys);
  }

  function openFoodEstimatorModal() {
    const provider = resolveFoodEstimatorProvider(store.keys);
    setFoodEstimatorProvider(provider);
    setFoodEstimatorImages([]);
    setFoodEstimatorInput("");
    setFoodEstimatorSending(false);
    setFoodEstimatorHasLLMResponse(false);
    setFoodEstimatorMessages([
      {
        id: uid("food_est_msg"),
        role: "assistant",
        content: provider
          ? "Sube fotos o describe la comida para comenzar la estimación."
          : "No hay API key disponible para estimar. Configura Google, OpenAI o Anthropic en Configuración > Proveedor IA.",
        created_at: new Date().toISOString(),
      },
    ]);
    setFoodEstimatorModalOpen(true);
    setError(null);
  }

  function closeFoodEstimatorModal() {
    setFoodEstimatorModalOpen(false);
    setFoodEstimatorSending(false);
  }

  function removeFoodEstimatorImage(imageId: string) {
    setFoodEstimatorImages((prev) => prev.filter((image) => image.id !== imageId));
  }

  async function addFoodEstimatorImageFromLibrary() {
    if (foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES) {
      setError(`Puedes adjuntar hasta ${FOOD_ESTIMATOR_MAX_IMAGES} fotos por estimación.`);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Necesitas permitir acceso a la galería para adjuntar fotos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || !asset.base64) {
        setError("No se pudo leer la foto seleccionada.");
        return;
      }
      const base64 = asset.base64;
      const mimeType = asset.mimeType?.trim() || "image/jpeg";
      setFoodEstimatorImages((prev) => {
        if (prev.length >= FOOD_ESTIMATOR_MAX_IMAGES) return prev;
        return [
          ...prev,
          {
            id: uid("food_est_img"),
            uri: asset.uri,
            base64,
            mime_type: mimeType,
          },
        ];
      });
      setError(null);
    } catch {
      setError("No se pudo abrir la galería para adjuntar foto.");
    }
  }

  async function addFoodEstimatorImageFromCamera() {
    if (foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES) {
      setError(`Puedes adjuntar hasta ${FOOD_ESTIMATOR_MAX_IMAGES} fotos por estimación.`);
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Necesitas permitir acceso a la cámara para capturar fotos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || !asset.base64) {
        setError("No se pudo leer la foto capturada.");
        return;
      }
      const base64 = asset.base64;
      const mimeType = asset.mimeType?.trim() || "image/jpeg";
      setFoodEstimatorImages((prev) => {
        if (prev.length >= FOOD_ESTIMATOR_MAX_IMAGES) return prev;
        return [
          ...prev,
          {
            id: uid("food_est_img"),
            uri: asset.uri,
            base64,
            mime_type: mimeType,
          },
        ];
      });
      setError(null);
    } catch {
      setError("No se pudo abrir la cámara.");
    }
  }

  async function sendFoodEstimatorMessage(forcedMessage?: string) {
    if (foodEstimatorSending) return;
    const userInput = (forcedMessage ?? foodEstimatorInput).trim();
    if (!userInput && foodEstimatorImages.length === 0) {
      setError("Escribe un mensaje o adjunta al menos una foto para estimar.");
      return;
    }

    const resolvedProvider = resolveFoodEstimatorProviderFromState();

    if (!resolvedProvider) {
      setError("Configura una API key en Proveedor IA (Google, OpenAI o Anthropic) para usar esta función.");
      return;
    }

    const userMessage: ChatMessage = {
      id: uid("food_est_msg"),
      role: "user",
      content: userInput || "Analiza las fotos y dame una estimación nutricional.",
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...foodEstimatorMessages, userMessage];
    setFoodEstimatorProvider(resolvedProvider);
    setFoodEstimatorMessages(nextMessages);
    if (!forcedMessage) {
      setFoodEstimatorInput("");
    }
    setFoodEstimatorSending(true);
    setError(null);

    try {
      const estimatorHistory: ChatInputMessage[] = [
        { role: "system", content: FOOD_ESTIMATOR_SYSTEM_PROMPT },
        ...nextMessages.map<ChatInputMessage>((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      ];
      const assistantContent = await callFoodEstimatorAPI(
        resolvedProvider,
        estimatorHistory,
        foodEstimatorImages,
      );
      const assistantMessage: ChatMessage = {
        id: uid("food_est_msg"),
        role: "assistant",
        content: assistantContent,
        created_at: new Date().toISOString(),
      };
      setFoodEstimatorHasLLMResponse(true);
      setFoodEstimatorMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo estimar la comida con IA. Revisa tu API key y vuelve a intentarlo.";
      setError(message);
      setFoodEstimatorMessages((prev) => [
        ...prev,
        {
          id: uid("food_est_msg"),
          role: "assistant",
          content: `Error de estimación: ${message}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setFoodEstimatorSending(false);
    }
  }

  async function addFoodFromEstimatorJSON() {
    if (foodEstimatorSending) return;
    if (!dietMealEditorCategory) {
      setError("Abre primero 'Añadir alimento' en una comida para rellenar los campos.");
      return;
    }
    const resolvedProvider = resolveFoodEstimatorProviderFromState();
    if (!resolvedProvider) {
      setError("Configura una API key en Proveedor IA (Google, OpenAI o Anthropic) para usar esta función.");
      return;
    }

    setFoodEstimatorSending(true);
    setError(null);
    try {
      const estimatorHistory: ChatInputMessage[] = [
        { role: "system", content: FOOD_ESTIMATOR_SYSTEM_PROMPT },
        ...foodEstimatorMessages.map<ChatInputMessage>((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        { role: "user", content: "Devuelve json" },
      ];
      const assistantContent = await callFoodEstimatorAPI(
        resolvedProvider,
        estimatorHistory,
        foodEstimatorImages,
      );
      const parsed = parseFoodEstimatorNutritionJSON(assistantContent);
      if (!parsed) {
        setError("No se pudo interpretar JSON del modelo. Repite la estimación y vuelve a intentar.");
        return;
      }

      setMealCaloriesInput(formatNutritionNumber(parsed.calories_kcal));
      setMealProteinInput(formatNutritionNumber(parsed.protein_g));
      setMealCarbsInput(formatNutritionNumber(parsed.carbs_g));
      setMealFatInput(formatNutritionNumber(parsed.fat_g));
      setMealTitleInput(parsed.dish_name || "Alimento estimado IA");
      setFoodEstimatorProvider(resolvedProvider);
      closeFoodEstimatorModal();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo solicitar JSON al modelo para rellenar el alimento.";
      setError(message);
    } finally {
      setFoodEstimatorSending(false);
    }
  }

  function openMeasurementEntryScreen() {
    setShowMeasurementDatePicker(false);
    setMeasuresDashboardPeriodDropdownOpen(false);
    setMeasurementEntryScreenOpen(true);
    setError(null);
  }

  function closeMeasurementEntryScreen() {
    setShowMeasurementDatePicker(false);
    setMeasurementEntryScreenOpen(false);
    resetMeasurementForm();
    setError(null);
  }

  function toggleMeasuresDashboardPeriodDropdown() {
    setMeasuresDashboardPeriodDropdownOpen((current) => !current);
  }

  function selectMeasuresDashboardPeriod(periodKey: MeasuresDashboardPeriodKey) {
    setMeasuresDashboardPeriod(periodKey);
    setMeasuresDashboardPeriodDropdownOpen(false);
  }

  async function pickMeasurementPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Necesitas permitir acceso a fotos para adjuntar una imagen.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError("No se pudo leer la foto seleccionada.");
        return;
      }
      setMeasurementPhotoUri(asset.uri);
      setError(null);
    } catch {
      setError("No se pudo abrir la galería para seleccionar foto.");
    }
  }

  function onMeasurementDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowMeasurementDatePicker(false);
    }
    if (event.type === "dismissed" || !selectedDate) return;
    setMeasurementDate(measurementDateFromSelection(selectedDate));
  }

  function resetMeasurementForm() {
    setWeightInput("");
    setMeasurementPhotoUri(null);
    setHeightInput("");
    setNeckInput("");
    setChestInput("");
    setWaistInput("");
    setHipsInput("");
    setBicepsInput("");
    setQuadricepsInput("");
    setCalfInput("");
    setMeasurementDate(measurementDateFromSelection(new Date()));
  }

  function addMeasurementFromSettings() {
    const weightResult = parseOptionalPositiveMetricInput(weightInput);
    if (weightResult.invalid) {
      setError("Introduce un valor válido para peso.");
      return;
    }
    const neckResult = parseOptionalPositiveMetricInput(neckInput);
    if (neckResult.invalid) {
      setError("Introduce un valor válido para contorno de cuello.");
      return;
    }
    const chestResult = parseOptionalPositiveMetricInput(chestInput);
    if (chestResult.invalid) {
      setError("Introduce un valor válido para contorno de pecho.");
      return;
    }
    const waistResult = parseOptionalPositiveMetricInput(waistInput);
    if (waistResult.invalid) {
      setError("Introduce un valor válido para contorno de cintura.");
      return;
    }
    const hipsResult = parseOptionalPositiveMetricInput(hipsInput);
    if (hipsResult.invalid) {
      setError("Introduce un valor válido para contorno de cadera.");
      return;
    }
    const bicepsResult = parseOptionalPositiveMetricInput(bicepsInput);
    if (bicepsResult.invalid) {
      setError("Introduce un valor válido para bíceps.");
      return;
    }
    const quadricepsResult = parseOptionalPositiveMetricInput(quadricepsInput);
    if (quadricepsResult.invalid) {
      setError("Introduce un valor válido para cuádriceps.");
      return;
    }
    const calfResult = parseOptionalPositiveMetricInput(calfInput);
    if (calfResult.invalid) {
      setError("Introduce un valor válido para gemelo.");
      return;
    }
    const heightResult = parseOptionalPositiveMetricInput(heightInput);
    if (heightResult.invalid) {
      setError("Introduce un valor válido para altura.");
      return;
    }

    const hasAnyMetric =
      weightResult.value !== null ||
      neckResult.value !== null ||
      chestResult.value !== null ||
      waistResult.value !== null ||
      hipsResult.value !== null ||
      bicepsResult.value !== null ||
      quadricepsResult.value !== null ||
      calfResult.value !== null ||
      heightResult.value !== null ||
      !!measurementPhotoUri;

    if (!hasAnyMetric) {
      setError("Añade al menos un dato de medida o una foto.");
      return;
    }

    const measurement: Measurement = {
      id: uid("measurement"),
      measured_at: measurementDateFromSelection(measurementDate).toISOString(),
      weight_kg: weightResult.value,
      photo_uri: measurementPhotoUri,
      neck_cm: neckResult.value,
      chest_cm: chestResult.value,
      waist_cm: waistResult.value,
      hips_cm: hipsResult.value,
      biceps_cm: bicepsResult.value,
      quadriceps_cm: quadricepsResult.value,
      calf_cm: calfResult.value,
      height_cm: heightResult.value,
    };

    setStore((prev) => {
      const nextMeasurements = sortMeasurementsDesc([measurement, ...prev.measurements]).slice(0, 60);
      return {
        ...prev,
        measurements: nextMeasurements,
      };
    });
    closeMeasurementEntryScreen();
  }

  function updateDietSettings(updater: (settings: DietSettings) => DietSettings) {
    setStore((prev) => ({
      ...prev,
      dietSettings: updater(prev.dietSettings),
    }));
  }

  function setDietMacroMode(mode: DietMacroMode) {
    updateDietSettings((prev) => {
      if (prev.macro_mode === mode) return prev;
      if (mode !== "manual_calories" || prev.macro_mode !== "protein_by_weight") {
        return {
          ...prev,
          macro_mode: mode,
        };
      }

      const bodyWeightKg = latestBodyWeightKg;
      if (bodyWeightKg === null || !Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) {
        return {
          ...prev,
          macro_mode: mode,
        };
      }

      const proteinPerKg = parseNonNegativeNumberInput(prev.protein_grams_per_kg) ?? 0;
      const carbsPerKg = parseNonNegativeNumberInput(prev.carbs_grams_per_kg) ?? 0;
      const fatPerKg = parseNonNegativeNumberInput(prev.fat_grams_per_kg) ?? 0;
      const hasAnyGkgValue = proteinPerKg > 0 || carbsPerKg > 0 || fatPerKg > 0;
      if (!hasAnyGkgValue) {
        return {
          ...prev,
          macro_mode: mode,
        };
      }

      const proteinCalories = Math.max(0, Math.round(bodyWeightKg * proteinPerKg * 4));
      const carbsCalories = Math.max(0, Math.round(bodyWeightKg * carbsPerKg * 4));
      const fatCalories = Math.max(0, Math.round(bodyWeightKg * fatPerKg * 9));

      return {
        ...prev,
        macro_mode: mode,
        manual_macro_calories: {
          protein: `${proteinCalories}`,
          carbs: `${carbsCalories}`,
          fat: `${fatCalories}`,
        },
      };
    });
  }

  function updateDietDailyCalories(value: string) {
    updateDietSettings((prev) => ({
      ...prev,
      daily_calories: value,
    }));
  }

  function updateManualMacroCalories(
    macro: keyof DietSettings["manual_macro_calories"],
    value: string,
  ) {
    updateDietSettings((prev) => ({
      ...prev,
      manual_macro_calories: {
        ...prev.manual_macro_calories,
        [macro]: value,
      },
    }));
  }

  function updateProteinGramsPerKg(value: string) {
    updateDietSettings((prev) => ({
      ...prev,
      protein_grams_per_kg: value,
    }));
  }

  function updateCarbsGramsPerKg(value: string) {
    updateDietSettings((prev) => ({
      ...prev,
      carbs_grams_per_kg: value,
    }));
  }

  function updateFatGramsPerKg(value: string) {
    updateDietSettings((prev) => ({
      ...prev,
      fat_grams_per_kg: value,
    }));
  }

  function autocompleteMissingGkgMacro() {
    if (!canAutocompleteGkgMacro || !autocompleteGkgMacroKey || !autocompleteGkgMacroPerKgText) {
      return;
    }
    updateDietSettings((prev) => {
      if (autocompleteGkgMacroKey === "protein") {
        return { ...prev, protein_grams_per_kg: autocompleteGkgMacroPerKgText };
      }
      if (autocompleteGkgMacroKey === "carbs") {
        return { ...prev, carbs_grams_per_kg: autocompleteGkgMacroPerKgText };
      }
      return { ...prev, fat_grams_per_kg: autocompleteGkgMacroPerKgText };
    });
  }

  function openTrainingTemplate(templateId: string) {
    setTrainingMenuTemplateId(null);
    setActiveTrainingTemplateId(templateId);
    setActiveTrainingTemplateMode("detail");
    setTrainingDetailMuscleFilter("all");
    setTrainingStatsPeriod("3m");
    setTrainingStatsMetric("volume");
    setExpandedExerciseId(null);
    setActiveExerciseMenuId(null);
    setError(null);
  }

  function openTrainingTemplateEditor(templateId: string) {
    setTrainingMenuTemplateId(null);
    setActiveTrainingTemplateId(templateId);
    setActiveTrainingTemplateMode("edit");
    setTrainingDetailMuscleFilter("all");
    const template = store.templates.find((item) => item.id === templateId);
    setExpandedExerciseId(template?.exercises[0]?.id ?? null);
    setActiveExerciseMenuId(null);
    setError(null);
  }

  function closeTrainingTemplateDetails() {
    setActiveTrainingTemplateId(null);
    setActiveTrainingTemplateMode("detail");
    setTrainingDetailMuscleFilter("all");
    setTrainingStatsPeriod("3m");
    setTrainingStatsMetric("volume");
    setTrainingMenuTemplateId(null);
    setExpandedExerciseId(null);
    setActiveExerciseMenuId(null);
    setError(null);
  }

  function closeTrainingTemplateEditor() {
    setActiveTrainingTemplateMode("detail");
    setTrainingMenuTemplateId(null);
    setExpandedExerciseId(null);
    setActiveExerciseMenuId(null);
    setError(null);
  }

  function updateActiveTrainingTemplate(
    updater: (template: WorkoutTemplate) => WorkoutTemplate,
  ) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return updater(template);
      }),
    }));
  }

  function updateExerciseSeriesFieldInTemplate(
    templateId: string,
    exerciseId: string,
    seriesId: string,
    field: "reps" | "weight_kg" | "rest_seconds",
    value: string,
  ) {
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== templateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextSeries = (exercise.series ?? []).map((seriesItem) =>
              seriesItem.id === seriesId ? { ...seriesItem, [field]: value } : seriesItem,
            );
            const nextSets = seriesToLegacySets(nextSeries);
            const firstWeightText = nextSeries.find((item) => item.weight_kg.trim())?.weight_kg ?? "";
            const firstRestText = nextSeries.find((item) => item.rest_seconds.trim())?.rest_seconds ?? "";
            const parsedLoad = Number(firstWeightText);
            const parsedRest = Number(firstRestText);
            return {
              ...exercise,
              series: nextSeries,
              sets: nextSets,
              load_kg:
                Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : null,
              rest_seconds:
                Number.isFinite(parsedRest) && parsedRest > 0 ? parsedRest : null,
            };
          }),
        };
      }),
    }));
  }

  function updateActiveTrainingName(name: string) {
    updateActiveTrainingTemplate((template) => ({
      ...template,
      name: name,
    }));
  }

  function updateActiveTrainingDuration(durationText: string) {
    updateActiveTrainingTemplate((template) => ({
      ...template,
      duration_minutes: normalizeDurationText(durationText),
    }));
  }

  function updateActiveTrainingCategory(category: TrainingCategory) {
    updateActiveTrainingTemplate((template) => ({
      ...template,
      category,
    }));
  }

  function updateActiveTrainingIcon(icon: RoutineIconName) {
    updateActiveTrainingTemplate((template) => ({
      ...template,
      icon,
    }));
  }

  function updateExerciseNameInActiveTemplate(exerciseId: string, name: string) {
    updateActiveTrainingTemplate((template) => ({
      ...template,
      exercises: template.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, name } : exercise,
      ),
    }));
  }

  function updateExerciseSeriesFieldInActiveTemplate(
    exerciseId: string,
    seriesId: string,
    field: "reps" | "weight_kg" | "rest_seconds",
    value: string,
  ) {
    if (!activeTrainingTemplateId) return;
    updateExerciseSeriesFieldInTemplate(activeTrainingTemplateId, exerciseId, seriesId, field, value);
  }

  function updateExerciseSeriesFieldInActiveSession(
    exerciseId: string,
    seriesId: string,
    field: "reps" | "weight_kg" | "rest_seconds",
    value: string,
  ) {
    if (!activeWorkoutSession) return;
    updateExerciseSeriesFieldInTemplate(activeWorkoutSession.template_id, exerciseId, seriesId, field, value);
  }

  function createTrainingTemplate() {
    if (activeWorkoutSession) {
      setError("Finaliza o descarta la sesión activa antes de crear otra rutina.");
      return;
    }
    const nextIndex = store.templates.length + 1;
    const templateId = uid("tpl");
    const category: TrainingCategory =
      trainingFilter === "all" ? "strength" : trainingFilter;
    const name = defaultTemplateName(category, nextIndex);
    const template: WorkoutTemplate = {
      id: templateId,
      name,
      category,
      icon: defaultTemplateIcon(category, nextIndex - 1),
      duration_minutes: "",
      exercises: [],
    };

    setStore((prev) => ({
      ...prev,
      templates: [...prev.templates, template],
    }));
    setTrainingMenuTemplateId(null);
    setTrainingSearch("");
    setTrainingFilter("all");
    openTrainingTemplateEditor(templateId);
  }

  function openExercisePicker() {
    setExercisePickerSearch("");
    setExercisePickerMuscleFilter("all");
    setExercisePickerOpen(true);
  }

  function addExerciseFromRepo(entry: ExerciseRepoEntry) {
    if (!activeTrainingTemplateId) return;

    const exerciseId = uid("exercise");
    const category = activeTrainingCategory ?? "strength";
    const isLoadFocusedCategory = category === "strength" || category === "hypertrophy";
    const imageUri = getExerciseImageUrl(entry, "male");
    const firstSeries: ExerciseSeries = {
      id: uid("set"),
      reps: category === "cardio" ? "12" : "10",
      weight_kg: isLoadFocusedCategory ? "20" : "",
      rest_seconds: isLoadFocusedCategory ? "120" : "75",
    };

    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: [
            ...template.exercises,
            {
              id: exerciseId,
              name: entry.name,
              image_uri: imageUri,
              sets: seriesToLegacySets([firstSeries]),
              series: [firstSeries],
              muscle: entry.muscle_group,
              load_kg: isLoadFocusedCategory ? 20 : null,
              rest_seconds: isLoadFocusedCategory ? 120 : 75,
            },
          ],
        };
      }),
    }));
    setExpandedExerciseId(exerciseId);
    setActiveExerciseMenuId(null);
    setExercisePickerOpen(false);
    setError(null);
  }

  function addBlankExerciseToActiveTemplate() {
    if (!activeTrainingTemplateId) return;

    const exerciseId = uid("exercise");
    const category = activeTrainingCategory ?? "strength";
    const isLoadFocusedCategory = category === "strength" || category === "hypertrophy";
    const nextIndex = (activeTrainingTemplate?.exercises.length ?? 0) + 1;
    const exerciseName =
      category === "cardio"
        ? `Bloque Cardio ${nextIndex}`
        : category === "flexibility"
          ? `Bloque Movilidad ${nextIndex}`
          : category === "hypertrophy"
            ? `Bloque Hipertrofia ${nextIndex}`
          : `Ejercicio ${nextIndex}`;
    const firstSeries: ExerciseSeries = {
      id: uid("set"),
      reps: category === "cardio" ? "12" : "10",
      weight_kg: isLoadFocusedCategory ? "20" : "",
      rest_seconds: isLoadFocusedCategory ? "120" : "75",
    };

    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: [
            ...template.exercises,
            {
              id: exerciseId,
              name: exerciseName,
              image_uri: null,
              sets: seriesToLegacySets([firstSeries]),
              series: [firstSeries],
              muscle: inferExerciseMuscle(exerciseName, category),
              load_kg: isLoadFocusedCategory ? 20 : null,
              rest_seconds: isLoadFocusedCategory ? 120 : 75,
            },
          ],
        };
      }),
    }));
    setExpandedExerciseId(exerciseId);
    setActiveExerciseMenuId(null);
    setExercisePickerOpen(false);
    setError(null);
  }

  function addSeriesToExercise(exerciseId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const existingSeries = exercise.series ?? [];
            const lastSeries = existingSeries[existingSeries.length - 1];
            const nextSeries = [
              ...existingSeries,
              {
                id: uid("set"),
                reps: lastSeries?.reps || "10",
                weight_kg: lastSeries?.weight_kg || "",
                rest_seconds: lastSeries?.rest_seconds || "",
              },
            ];
            return {
              ...exercise,
              series: nextSeries,
              sets: seriesToLegacySets(nextSeries),
            };
          }),
        };
      }),
    }));
  }

  function cloneExerciseInActiveTemplate(exerciseId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        const sourceIndex = template.exercises.findIndex((exercise) => exercise.id === exerciseId);
        if (sourceIndex < 0) return template;
        const source = template.exercises[sourceIndex];
        const clone = {
          ...source,
          id: uid("exercise"),
          name: `${source.name ?? "Ejercicio"} (copia)`,
          series: (source.series ?? []).map((seriesItem) => ({
            ...seriesItem,
            id: uid("set"),
          })),
        };
        const next = [...template.exercises];
        next.splice(sourceIndex + 1, 0, clone);
        return {
          ...template,
          exercises: next,
        };
      }),
    }));
    setActiveExerciseMenuId(null);
  }

  function moveExerciseUpInActiveTemplate(exerciseId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        const index = template.exercises.findIndex((exercise) => exercise.id === exerciseId);
        if (index <= 0) return template;
        const next = [...template.exercises];
        const current = next[index];
        next[index] = next[index - 1];
        next[index - 1] = current;
        return {
          ...template,
          exercises: next,
        };
      }),
    }));
    setActiveExerciseMenuId(null);
  }

  function deleteExerciseInActiveTemplate(exerciseId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.filter((exercise) => exercise.id !== exerciseId),
        };
      }),
    }));
    if (expandedExerciseId === exerciseId) {
      const nextExercise = activeTrainingTemplate?.exercises.find((item) => item.id !== exerciseId) ?? null;
      setExpandedExerciseId(nextExercise?.id ?? null);
    }
    setActiveExerciseMenuId(null);
  }

  function saveTrainingTemplateChanges() {
    setError(null);
    closeTrainingTemplateEditor();
  }

  function cloneTrainingTemplate(templateId: string) {
    setStore((prev) => {
      const source = prev.templates.find((template) => template.id === templateId);
      if (!source) return prev;
      const sourceIndex = prev.templates.findIndex((template) => template.id === templateId);
      const clone: WorkoutTemplate = {
        ...source,
        id: uid("tpl"),
        name: `${source.name} (copia)`,
        exercises: source.exercises.map((exercise) => ({
          ...exercise,
          id: uid("exercise"),
          series: (exercise.series ?? []).map((seriesItem) => ({
            ...seriesItem,
            id: uid("set"),
          })),
        })),
      };
      const next = [...prev.templates];
      next.splice(sourceIndex + 1, 0, clone);
      return {
        ...prev,
        templates: next,
      };
    });
    setTrainingMenuTemplateId(null);
  }

  function moveTrainingTemplateUp(templateId: string) {
    setStore((prev) => {
      const index = prev.templates.findIndex((template) => template.id === templateId);
      if (index <= 0) return prev;
      const next = [...prev.templates];
      const current = next[index];
      next[index] = next[index - 1];
      next[index - 1] = current;
      return {
        ...prev,
        templates: next,
      };
    });
    setTrainingMenuTemplateId(null);
  }

  function deleteTrainingTemplate(templateId: string) {
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.filter((template) => template.id !== templateId),
    }));
    if (activeTrainingTemplateId === templateId) {
      setActiveTrainingTemplateId(null);
      setActiveTrainingTemplateMode("detail");
      setTrainingDetailMuscleFilter("all");
      setTrainingStatsPeriod("3m");
      setTrainingStatsMetric("volume");
    }
    setTrainingMenuTemplateId(null);
  }

  function resolveSessionRuntime(session: WorkoutSession) {
    const template = store.templates.find((item) => item.id === session.template_id);
    if (!template) return null;
    const pointers = listTemplateSeriesPointers(template);
    if (pointers.length === 0) return null;
    const currentIndex = pointers.findIndex(
      (item) =>
        item.exerciseIndex === session.current_exercise_index &&
        item.seriesIndex === session.current_series_index,
    );
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    return {
      template,
      pointers,
      currentIndex: safeIndex,
      currentPointer: pointers[safeIndex],
    };
  }

  function finishWorkoutSession(session: WorkoutSession) {
    const currentTemplate =
      store.templates.find((item) => item.id === session.template_id) ?? null;
    const originalTemplate = workoutTemplateBeforeSessionRef.current;
    const hasTemplateChanges = !!(
      currentTemplate &&
      originalTemplate &&
      buildTemplateSeriesSignature(currentTemplate) !== buildTemplateSeriesSignature(originalTemplate)
    );
    const sessionPerformance = summarizeWorkoutSessionPerformance(session, currentTemplate);
    const summary: WorkoutSessionSummary = {
      id: uid("session_summary"),
      template_id: session.template_id,
      template_name: session.template_name,
      finished_at: new Date().toISOString(),
      elapsed_seconds: session.elapsed_seconds,
      completed_series_count: session.completed_series_count,
      total_series_count: session.total_series_count,
      estimated_calories: estimateWorkoutCalories(session),
      total_volume_kg: sessionPerformance.totalVolumeKg,
      total_reps: sessionPerformance.totalReps,
    };
    setStore((prev) => ({
      ...prev,
      workoutHistory: [summary, ...prev.workoutHistory].slice(0, MAX_WORKOUT_HISTORY_ITEMS),
    }));
    setLastWorkoutSessionSummary(summary);
    setWorkoutCompletionModal({
      summary,
      has_template_changes: hasTemplateChanges,
      original_template: originalTemplate ? cloneWorkoutTemplate(originalTemplate) : null,
    });
    setActiveWorkoutSession(null);
    setConfirmDiscardSession(false);
    workoutTemplateBeforeSessionRef.current = null;
    setError(null);
  }

  function startTrainingSession(templateId: string) {
    if (activeWorkoutSession) {
      setError("Ya tienes una sesión activa. Finalízala o descártala antes de iniciar otra.");
      return;
    }
    const template = store.templates.find((item) => item.id === templateId);
    if (!template) {
      setError("No se encontró la rutina seleccionada.");
      return;
    }
    const pointers = listTemplateSeriesPointers(template);
    if (pointers.length === 0) {
      setError("Añade al menos una serie en la rutina antes de iniciar el entrenamiento.");
      return;
    }

    workoutTemplateBeforeSessionRef.current = cloneWorkoutTemplate(template);

    const firstPointer = pointers[0];
    const session: WorkoutSession = {
      id: uid("session"),
      template_id: template.id,
      template_name: template.name,
      category: resolveTrainingCategory(template),
      started_at: new Date().toISOString(),
      current_exercise_index: firstPointer.exerciseIndex,
      current_series_index: firstPointer.seriesIndex,
      completed_series_keys: [],
      completed_series_count: 0,
      total_series_count: pointers.length,
      elapsed_seconds: 0,
      is_resting: false,
      rest_seconds_left: 0,
      status: "running",
    };
    setActiveWorkoutSession(session);
    setActiveTrainingTemplateId(null);
    setActiveTrainingTemplateMode("detail");
    setTrainingDetailMuscleFilter("all");
    setTrainingStatsPeriod("3m");
    setTrainingStatsMetric("volume");
    setTrainingMenuTemplateId(null);
    setActiveExerciseMenuId(null);
    setExpandedExerciseId(null);
    setConfirmDiscardSession(false);
    setWorkoutCompletionModal(null);
    setError(null);
  }

  function moveWorkoutSessionPointer(step: 1 | -1) {
    if (!activeWorkoutSession) return;
    if (activeWorkoutSession.is_resting) return;
    const runtime = resolveSessionRuntime(activeWorkoutSession);
    if (!runtime) {
      setError("No se pudo actualizar la sesión activa.");
      return;
    }
    const nextIndex = Math.max(0, Math.min(runtime.pointers.length - 1, runtime.currentIndex + step));
    const nextPointer = runtime.pointers[nextIndex];
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      current_exercise_index: nextPointer.exerciseIndex,
      current_series_index: nextPointer.seriesIndex,
      is_resting: false,
      rest_seconds_left: 0,
    });
    setConfirmDiscardSession(false);
    setError(null);
  }

  function focusWorkoutSessionExercise(exerciseId: string) {
    if (!activeWorkoutSession) return;
    if (activeWorkoutSession.is_resting) return;
    const runtime = resolveSessionRuntime(activeWorkoutSession);
    if (!runtime) {
      setError("No se pudo actualizar la sesión activa.");
      return;
    }
    const nextPointer =
      runtime.pointers.find(
        (item) =>
          item.exerciseId === exerciseId &&
          !activeWorkoutSession.completed_series_keys.includes(pointerKey(item)),
      ) ?? runtime.pointers.find((item) => item.exerciseId === exerciseId);
    if (!nextPointer) return;

    setActiveWorkoutSession({
      ...activeWorkoutSession,
      current_exercise_index: nextPointer.exerciseIndex,
      current_series_index: nextPointer.seriesIndex,
      is_resting: false,
      rest_seconds_left: 0,
    });
    setConfirmDiscardSession(false);
    setError(null);
  }

  function completeCurrentSessionSeries() {
    if (!activeWorkoutSession) return;
    if (activeWorkoutSession.is_resting) return;
    const runtime = resolveSessionRuntime(activeWorkoutSession);
    if (!runtime) {
      setError("No se pudo avanzar en la sesión. Revisa la rutina.");
      return;
    }
    const currentPointer = runtime.currentPointer;
    const currentKey = pointerKey(currentPointer);
    const alreadyCompleted = activeWorkoutSession.completed_series_keys.includes(currentKey);
    const completedSeriesKeys = alreadyCompleted
      ? activeWorkoutSession.completed_series_keys
      : [...activeWorkoutSession.completed_series_keys, currentKey];
    const completedSeriesCount = alreadyCompleted
      ? activeWorkoutSession.completed_series_count
      : Math.min(
          activeWorkoutSession.total_series_count,
          activeWorkoutSession.completed_series_count + 1,
        );

    const nextIndex = runtime.currentIndex + 1;
    if (nextIndex >= runtime.pointers.length) {
      finishWorkoutSession({
        ...activeWorkoutSession,
        completed_series_keys: completedSeriesKeys,
        completed_series_count: completedSeriesCount,
        current_exercise_index: currentPointer.exerciseIndex,
        current_series_index: currentPointer.seriesIndex,
      });
      return;
    }

    const restSeconds = parseRestSecondsInput(currentPointer.series.rest_seconds);
    const nextPointer = runtime.pointers[nextIndex];
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      completed_series_keys: completedSeriesKeys,
      completed_series_count: completedSeriesCount,
      current_exercise_index: nextPointer.exerciseIndex,
      current_series_index: nextPointer.seriesIndex,
      is_resting: restSeconds > 0,
      rest_seconds_left: restSeconds,
    });
    setConfirmDiscardSession(false);
    setError(null);
  }

  function markSessionSeriesAsDone(exerciseId: string, seriesId: string) {
    if (!activeWorkoutSession) return;
    const session = activeWorkoutSession;
    const runtime = resolveSessionRuntime(session);
    if (!runtime) {
      setError("No se pudo actualizar la sesión activa.");
      return;
    }
    const targetPointer = runtime.pointers.find(
      (item) => item.exerciseId === exerciseId && item.seriesId === seriesId,
    );
    if (!targetPointer) return;

    const targetKey = pointerKey(targetPointer);
    if (session.completed_series_keys.includes(targetKey)) return;

    const restSeconds = parseRestSecondsInput(targetPointer.series.rest_seconds);
    manualRestSkipRef.current = session.is_resting && restSeconds <= 0;

    const completedSeriesKeys = [...session.completed_series_keys, targetKey];
    const completedSeriesCount = Math.min(
      session.total_series_count,
      completedSeriesKeys.length,
    );

    if (completedSeriesCount >= session.total_series_count) {
      finishWorkoutSession({
        ...session,
        completed_series_keys: completedSeriesKeys,
        completed_series_count: completedSeriesCount,
        current_exercise_index: targetPointer.exerciseIndex,
        current_series_index: targetPointer.seriesIndex,
        is_resting: restSeconds > 0,
        rest_seconds_left: restSeconds,
      });
      return;
    }

    const currentKey = pointerKey(runtime.currentPointer);
    const nextPointer =
      !completedSeriesKeys.includes(currentKey)
        ? runtime.currentPointer
        : runtime.pointers
            .slice(runtime.currentIndex + 1)
            .find((item) => !completedSeriesKeys.includes(pointerKey(item))) ??
          runtime.pointers.find((item) => !completedSeriesKeys.includes(pointerKey(item)));
    if (!nextPointer) return;

    setActiveWorkoutSession({
      ...session,
      completed_series_keys: completedSeriesKeys,
      completed_series_count: completedSeriesCount,
      current_exercise_index: nextPointer.exerciseIndex,
      current_series_index: nextPointer.seriesIndex,
      is_resting: restSeconds > 0,
      rest_seconds_left: restSeconds,
    });
    setConfirmDiscardSession(false);
    setError(null);
  }

  function markSessionSeriesAsNotDone(exerciseId: string, seriesId: string) {
    if (!activeWorkoutSession) return;
    const runtime = resolveSessionRuntime(activeWorkoutSession);
    if (!runtime) {
      setError("No se pudo actualizar la sesión activa.");
      return;
    }
    const targetPointer = runtime.pointers.find(
      (item) => item.exerciseId === exerciseId && item.seriesId === seriesId,
    );
    if (!targetPointer) return;

    const targetKey = pointerKey(targetPointer);
    if (!activeWorkoutSession.completed_series_keys.includes(targetKey)) return;

    if (activeWorkoutSession.is_resting) {
      manualRestSkipRef.current = true;
    }

    const completedSeriesKeys = activeWorkoutSession.completed_series_keys.filter(
      (key) => key !== targetKey,
    );
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      completed_series_keys: completedSeriesKeys,
      completed_series_count: completedSeriesKeys.length,
      current_exercise_index: targetPointer.exerciseIndex,
      current_series_index: targetPointer.seriesIndex,
      is_resting: false,
      rest_seconds_left: 0,
    });
    setConfirmDiscardSession(false);
    setError(null);
  }

  function pauseWorkoutSession() {
    if (!activeWorkoutSession) return;
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      status: "paused",
    });
    setConfirmDiscardSession(false);
  }

  function resumeWorkoutSession() {
    if (!activeWorkoutSession) return;
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      status: "running",
    });
    setConfirmDiscardSession(false);
  }

  function skipSessionRest() {
    if (!activeWorkoutSession) return;
    manualRestSkipRef.current = true;
    setActiveWorkoutSession({
      ...activeWorkoutSession,
      is_resting: false,
      rest_seconds_left: 0,
    });
    setConfirmDiscardSession(false);
  }

  function finishActiveWorkoutSession() {
    if (!activeWorkoutSession) return;
    finishWorkoutSession(activeWorkoutSession);
  }

  function discardWorkoutSession() {
    if (!activeWorkoutSession) return;
    if (!confirmDiscardSession) {
      setConfirmDiscardSession(true);
      setError("Pulsa \"Abandonar\" de nuevo para confirmar.");
      return;
    }
    setActiveWorkoutSession(null);
    setLastWorkoutSessionSummary(null);
    setConfirmDiscardSession(false);
    workoutTemplateBeforeSessionRef.current = null;
    setError("Entrenamiento descartado.");
  }

  function closeWorkoutCompletionModal() {
    setWorkoutCompletionModal(null);
  }

  function revertWorkoutTemplateChangesAfterSession() {
    const originalTemplate = workoutCompletionModal?.original_template;
    if (!originalTemplate) {
      setWorkoutCompletionModal(null);
      return;
    }
    const restored = cloneWorkoutTemplate(originalTemplate);
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) =>
        template.id === restored.id ? restored : template,
      ),
    }));
    setWorkoutCompletionModal(null);
  }

  function createThread() {
    const id = uid("thread");
    const thread: ChatThread = { id, title: `Coach ${threads.length + 1}` };
    const firstMessage: ChatMessage = {
      id: uid("msg"),
      role: "assistant",
      content:
        "Nuevo hilo creado. Este chat usa el proveedor activo; en web, Anthropic requiere un proxy propio y OpenAI/Google pueden usarse directos.",
      created_at: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      threads: [...prev.threads, thread],
      messagesByThread: {
        ...prev.messagesByThread,
        [id]: [firstMessage],
      },
    }));
    setActiveThreadId(id);
    void loadChatSystemPrompt();
  }

  function setActiveProvider(provider: Provider) {
    setStore((prev) => ({
      ...prev,
      keys: prev.keys.map((item) =>
        item.provider === provider ? { ...item, is_active: true } : { ...item, is_active: false },
      ),
    }));
    setError(null);
  }

  function updateProviderConfig(provider: Provider, updates: Partial<Pick<AIKey, "api_key" | "model">>) {
    setStore((prev) => ({
      ...prev,
      keys: prev.keys.map((item) =>
        item.provider === provider ? { ...item, ...updates } : item,
      ),
    }));
  }

  function setProviderKeyVisible(provider: Provider, visible: boolean) {
    setProviderKeyVisibility((prev) => ({
      ...prev,
      [provider]: visible,
    }));
  }

  function toggleProviderKeyVisibility(provider: Provider) {
    setProviderKeyVisibility((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  }

  function updateProviderDraft(
    provider: Provider,
    updates: Partial<ProviderDraft>,
    options: { markPending?: boolean } = { markPending: true },
  ) {
    const currentDraft = providerDraftByProvider[provider] ?? {
      api_key: "",
      model: DEFAULT_MODELS[provider],
    };
    const nextDraft: ProviderDraft = {
      api_key: updates.api_key ?? currentDraft.api_key,
      model: updates.model ?? currentDraft.model,
    };

    setProviderDraftByProvider((prev) => ({
      ...prev,
      [provider]: nextDraft,
    }));

    if (provider === "anthropic" && updates.api_key !== undefined) {
      setAnthropicModelDropdownOpen(false);
      setAnthropicModelOptions([]);
      setAnthropicModelOptionsMessage(null);
      setAnthropicModelFilter("");
    }
    if (provider === "openai" && updates.api_key !== undefined) {
      setOpenAIModelDropdownOpen(false);
      setOpenAIModelOptions([]);
      setOpenAIModelOptionsMessage(null);
      setOpenAIModelFilter("");
    }
    if (provider === "google" && updates.api_key !== undefined) {
      setGoogleModelDropdownOpen(false);
      setGoogleModelOptions([]);
      setGoogleModelOptionsMessage(null);
      setGoogleModelFilter("");
    }

    if (options.markPending) {
      setProviderConnectionStatus((prev) => ({
        ...prev,
        [provider]: nextDraft.api_key.trim()
          ? {
              state: "unknown",
              detail: PROVIDER_STATUS_COPY.warningPending,
              severity: "warning",
            }
          : {
              state: "disconnected",
              detail: PROVIDER_STATUS_COPY.warningNoKey,
              severity: "warning",
            },
      }));
    }
  }

  async function loadAnthropicModelOptions(apiKey: string) {
    setAnthropicModelOptionsLoading(true);
    setAnthropicModelOptionsMessage(null);
    try {
      const options =
        Platform.OS === "web"
          ? await fetchAnthropicModelsViaWebProxy(apiKey)
          : await fetchAnthropicModelsDirect(apiKey);

      setAnthropicModelOptions(options);
      if (options.length === 0) {
        setAnthropicModelOptionsMessage({
          text: toMediumProviderDetail("No hay modelos disponibles para esta API key."),
          severity: "warning",
        });
      }
    } catch (err) {
      const rawMessage =
        err instanceof Error ? err.message : PROVIDER_STATUS_COPY.warningModelsUnavailable;
      setAnthropicModelOptions([]);
      setAnthropicModelOptionsMessage({
        text: toSevereProviderDetail(rawMessage),
        severity: "error",
      });
    } finally {
      setAnthropicModelOptionsLoading(false);
    }
  }

  async function loadOpenAIModelOptions(apiKey: string) {
    setOpenAIModelOptionsLoading(true);
    setOpenAIModelOptionsMessage(null);
    try {
      const options = await fetchOpenAIModelsDirect(apiKey);

      setOpenAIModelOptions(options);
      if (options.length === 0) {
        setOpenAIModelOptionsMessage({
          text: toMediumProviderDetail("No hay modelos disponibles para esta API key."),
          severity: "warning",
        });
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "No se pudieron cargar los modelos de OpenAI.";
      setOpenAIModelOptions([]);
      setOpenAIModelOptionsMessage({
        text: toSevereProviderDetail(rawMessage),
        severity: "error",
      });
    } finally {
      setOpenAIModelOptionsLoading(false);
    }
  }

  async function loadGoogleModelOptions(apiKey: string) {
    setGoogleModelOptionsLoading(true);
    setGoogleModelOptionsMessage(null);
    try {
      const options = await fetchGoogleModelsDirect(apiKey);

      setGoogleModelOptions(options);
      if (options.length === 0) {
        setGoogleModelOptionsMessage({
          text: toMediumProviderDetail("No hay modelos disponibles para esta API key."),
          severity: "warning",
        });
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "No se pudieron cargar los modelos de Google.";
      setGoogleModelOptions([]);
      setGoogleModelOptionsMessage({
        text: toSevereProviderDetail(rawMessage),
        severity: "error",
      });
    } finally {
      setGoogleModelOptionsLoading(false);
    }
  }

  async function toggleAnthropicModelDropdown() {
    const nextOpen = !anthropicModelDropdownOpen;
    setAnthropicModelDropdownOpen(nextOpen);
    if (!nextOpen) return;
    setAnthropicModelFilter("");

    const draft = providerDraftByProvider.anthropic ?? {
      api_key: "",
      model: DEFAULT_MODELS.anthropic,
    };
    const apiKey = draft.api_key.trim();
    if (!apiKey) {
      setAnthropicModelOptions([]);
      setAnthropicModelOptionsMessage({
        text: PROVIDER_STATUS_COPY.warningNoKey,
        severity: "warning",
      });
      return;
    }

    await loadAnthropicModelOptions(apiKey);
  }

  async function toggleOpenAIModelDropdown() {
    const nextOpen = !openAIModelDropdownOpen;
    setOpenAIModelDropdownOpen(nextOpen);
    if (!nextOpen) return;
    setOpenAIModelFilter("");

    const draft = providerDraftByProvider.openai ?? {
      api_key: "",
      model: DEFAULT_MODELS.openai,
    };
    const apiKey = draft.api_key.trim();
    if (!apiKey) {
      setOpenAIModelOptions([]);
      setOpenAIModelOptionsMessage({
        text: PROVIDER_STATUS_COPY.warningNoKey,
        severity: "warning",
      });
      return;
    }

    await loadOpenAIModelOptions(apiKey);
  }

  async function toggleGoogleModelDropdown() {
    const nextOpen = !googleModelDropdownOpen;
    setGoogleModelDropdownOpen(nextOpen);
    if (!nextOpen) return;
    setGoogleModelFilter("");

    const draft = providerDraftByProvider.google ?? {
      api_key: "",
      model: DEFAULT_MODELS.google,
    };
    const apiKey = draft.api_key.trim();
    if (!apiKey) {
      setGoogleModelOptions([]);
      setGoogleModelOptionsMessage({
        text: PROVIDER_STATUS_COPY.warningNoKey,
        severity: "warning",
      });
      return;
    }

    await loadGoogleModelOptions(apiKey);
  }

  function selectAnthropicModel(modelId: string) {
    updateProviderDraft("anthropic", { model: modelId });
    setAnthropicModelDropdownOpen(false);
    setAnthropicModelOptionsMessage(null);
    setAnthropicModelFilter("");
  }

  function selectOpenAIModel(modelId: string) {
    updateProviderDraft("openai", { model: modelId });
    setOpenAIModelDropdownOpen(false);
    setOpenAIModelOptionsMessage(null);
    setOpenAIModelFilter("");
  }

  function selectGoogleModel(modelId: string) {
    updateProviderDraft("google", { model: modelId });
    setGoogleModelDropdownOpen(false);
    setGoogleModelOptionsMessage(null);
    setGoogleModelFilter("");
  }

  async function saveProviderApiKey(provider: Provider) {
    const draft = providerDraftByProvider[provider];
    if (!draft) return;

    const normalizedApiKey = draft.api_key.trim();
    const normalizedModel = draft.model.trim() || DEFAULT_MODELS[provider];

    setActiveProvider(provider);
    setError(null);
    setProviderSaveLoading((prev) => ({ ...prev, [provider]: true }));
    if (provider === "anthropic") {
      setAnthropicModelDropdownOpen(false);
      setAnthropicModelOptionsMessage(null);
      setAnthropicModelFilter("");
    }
    if (provider === "openai") {
      setOpenAIModelDropdownOpen(false);
      setOpenAIModelOptionsMessage(null);
      setOpenAIModelFilter("");
    }
    if (provider === "google") {
      setGoogleModelDropdownOpen(false);
      setGoogleModelOptionsMessage(null);
      setGoogleModelFilter("");
    }

    if (!normalizedApiKey) {
      updateProviderConfig(provider, {
        api_key: "",
        model: normalizedModel,
      });
      updateProviderDraft(
        provider,
        {
          api_key: "",
          model: normalizedModel,
        },
        { markPending: false },
      );
      setProviderConnectionStatus((prev) => ({
        ...prev,
        [provider]: {
          state: "disconnected",
          detail: PROVIDER_STATUS_COPY.warningNoKey,
          severity: "warning",
        },
      }));
      setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
      setProviderKeyVisible(provider, false);
      if (provider === "anthropic") {
        setAnthropicModelOptions([]);
      }
      if (provider === "openai") {
        setOpenAIModelOptions([]);
      }
      if (provider === "google") {
        setGoogleModelOptions([]);
      }
      return;
    }

    setProviderConnectionStatus((prev) => ({
      ...prev,
      [provider]: {
        state: "checking",
        detail: PROVIDER_STATUS_COPY.warningChecking,
        severity: "warning",
      },
    }));

    const check = await verifyProviderConnection({
      provider,
      is_active: true,
      api_key: normalizedApiKey,
      model: normalizedModel,
    });

    if (check.ok) {
      updateProviderConfig(provider, {
        api_key: normalizedApiKey,
        model: normalizedModel,
      });
      updateProviderDraft(
        provider,
        {
          api_key: normalizedApiKey,
          model: normalizedModel,
        },
        { markPending: false },
      );
    } else {
      updateProviderDraft(
        provider,
        {
          api_key: draft.api_key,
          model: normalizedModel,
        },
        { markPending: false },
      );
    }
    setProviderConnectionStatus((prev) => ({
      ...prev,
      [provider]: check.ok
        ? { state: "connected", detail: check.message, severity: check.severity }
        : { state: "disconnected", detail: check.message, severity: check.severity },
    }));
    setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
    setProviderKeyVisible(provider, false);
    if (!check.ok) {
      setError(`No se pudo conectar con ${PROVIDER_UI_META[provider].label}: ${check.message}`);
      return;
    }
    setError(null);
  }

  function openDeleteProviderApiKeyModal(provider: Provider) {
    const persisted = store.keys.find((item) => item.provider === provider)?.api_key ?? "";
    const persistedApiKey = persisted.trim();
    if (!persistedApiKey) return;
    const maskedApiKey = maskApiKey(persistedApiKey);
    setProviderDeleteModal({ provider, maskedApiKey });
  }

  function confirmDeleteProviderApiKey() {
    const modal = providerDeleteModal;
    if (!modal) return;
    const provider = modal.provider;

    updateProviderConfig(provider, { api_key: "" });
    updateProviderDraft(provider, { api_key: "" }, { markPending: false });
    setProviderConnectionStatus((prev) => ({
      ...prev,
      [provider]: {
        state: "disconnected",
        detail: PROVIDER_STATUS_COPY.warningNoKey,
        severity: "warning",
      },
    }));
    setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
    setProviderKeyVisible(provider, false);
    if (provider === "anthropic") {
      setAnthropicModelDropdownOpen(false);
      setAnthropicModelOptions([]);
      setAnthropicModelOptionsMessage(null);
      setAnthropicModelFilter("");
    }
    if (provider === "openai") {
      setOpenAIModelDropdownOpen(false);
      setOpenAIModelOptions([]);
      setOpenAIModelOptionsMessage(null);
      setOpenAIModelFilter("");
    }
    if (provider === "google") {
      setGoogleModelDropdownOpen(false);
      setGoogleModelOptions([]);
      setGoogleModelOptionsMessage(null);
      setGoogleModelFilter("");
    }
    setProviderDeleteModal(null);
    setError(null);
  }

  function closeProviderDeleteModal() {
    setProviderDeleteModal(null);
  }

  function resetLocalData() {
    const initial = createInitialStore();
    setStore(initial);
    setProviderKeyVisibility(createProviderBooleanMap(false));
    setProviderDraftByProvider(createProviderDraftMap(initial.keys));
    setProviderConnectionStatus(createProviderConnectionStatusMap(initial.keys));
    setProviderSaveLoading(createProviderBooleanMap(false));
    setAnthropicModelDropdownOpen(false);
    setAnthropicModelOptions([]);
    setAnthropicModelOptionsMessage(null);
    setAnthropicModelFilter("");
    setOpenAIModelDropdownOpen(false);
    setOpenAIModelOptions([]);
    setOpenAIModelOptionsMessage(null);
    setOpenAIModelFilter("");
    setGoogleModelDropdownOpen(false);
    setGoogleModelOptions([]);
    setGoogleModelOptionsMessage(null);
    setGoogleModelFilter("");
    setProviderDeleteModal(null);
    setTab("home");
    setActiveThreadId(initial.threads[0]?.id ?? null);
    setActiveWorkoutSession(null);
    setLastWorkoutSessionSummary(null);
    setConfirmDiscardSession(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: mobileTheme.color.bgApp }}>
      <View
        style={{
          paddingHorizontal: mobileTheme.spacing[4],
          paddingTop: mobileTheme.spacing[4],
          paddingBottom: 10,
          gap: 12,
        }}
      >
        {tab === "home" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "600" }}>
                {homeGreetingLabel}
              </Text>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 30, fontWeight: "700" }}>
                Gymnasia
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable
                onPress={() => setTab("chat")}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="bell" size={18} color={mobileTheme.color.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => setTab("settings")}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  backgroundColor: mobileTheme.color.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#06090D", fontSize: 16, fontWeight: "800" }}>G</Text>
              </Pressable>
            </View>
          </View>
        ) : tab === "training" && (isTrainingTemplateScreenOpen || activeWorkoutSession) ? null : tab === "training" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: headerTitleSize, fontWeight: "700" }}>
              {headerTitle}
            </Text>
            {store.templates.length > 0 && !showTrainingListSkeleton ? (
              <View
                style={{
                  minHeight: 32,
                  borderRadius: mobileTheme.radius.pill,
                  backgroundColor: "rgba(123,170,0,0.26)",
                  paddingHorizontal: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>
                  {store.templates.length} {store.templates.length === 1 ? "rutina" : "rutinas"}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: headerTitleSize, fontWeight: "700" }}>
            {headerTitle}
          </Text>
        )}
        <View
          style={{
            minHeight: 54,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: mobileTheme.color.borderSubtle,
            backgroundColor: mobileTheme.color.bgSurface,
            flexDirection: "row",
            padding: 4,
            gap: 4,
          }}
        >
          {(["home", "training", "diet", "measures", "chat", "settings"] as TabKey[]).map((key) => {
            const isActiveTab = tab === key;
            const tabTextColor = isActiveTab
              ? mobileTheme.color.brandPrimary
              : mobileTheme.color.textSecondary;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                testID={`nav-tab-${key}`}
                accessibilityLabel={tabLabel(key)}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isActiveTab ? "rgba(203,255,26,0.14)" : "transparent",
                  borderWidth: isActiveTab ? 1 : 0,
                  borderColor: isActiveTab ? "rgba(203,255,26,0.5)" : "transparent",
                }}
              >
                {key === "settings" ? (
                  <Ionicons color={tabTextColor} name="settings-sharp" size={18} />
                ) : (
                  <Text
                    style={{
                      color: tabTextColor,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {tabLabel(key)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={mobileTheme.color.brandPrimary} />
        </View>
      ) : showGlobalScreenLoading && tab !== "training" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingBottom: 90 }}>
          <View testID={`screen-loading-skeleton-${tab}`} style={{ gap: 12, paddingBottom: 110 }}>
            <View
              style={{
                minHeight: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.04)",
                backgroundColor: "#131923",
                width: tab === "chat" ? "72%" : "48%",
              }}
            />
            {Array.from({ length: tab === "chat" ? 5 : tab === "home" ? 5 : 4 }).map((_, index) => (
              <View
                key={`screen_skeleton_${tab}_${index}`}
                style={{
                  minHeight: tab === "chat" ? 72 : tab === "home" ? 116 : 92,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.04)",
                  backgroundColor: "#131923",
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  gap: 10,
                  opacity: index === 3 ? 0.66 : 1,
                }}
              >
                <View
                  style={{
                    height: 12,
                    width: index % 2 === 0 ? "74%" : "62%",
                    borderRadius: 999,
                    backgroundColor: "#242D3A",
                  }}
                />
                <View
                  style={{
                    height: 10,
                    width: index % 2 === 0 ? "52%" : "70%",
                    borderRadius: 999,
                    backgroundColor: "#202837",
                  }}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        <ScrollView ref={mainScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
          {error ? <Text style={{ color: "#ff8a8a", marginBottom: 12 }}>{error}</Text> : null}

          {tab === "home" ? (
            <View style={{ gap: 16, paddingBottom: 8 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: "#10151D",
                  borderRadius: 28,
                  padding: 14,
                  gap: 14,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 196,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                    backgroundColor: "#091219",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {homeFeaturedHeroImageUri ? (
                    <Image
                      source={{ uri: homeFeaturedHeroImageUri }}
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        opacity: 0.18,
                      }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View
                    style={{
                      position: "absolute",
                      top: -46,
                      right: -18,
                      width: 170,
                      height: 170,
                      borderRadius: 999,
                      backgroundColor: "rgba(54,132,121,0.22)",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: -34,
                      left: -12,
                      width: 140,
                      height: 140,
                      borderRadius: 999,
                      backgroundColor: "rgba(8,84,101,0.22)",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 22,
                      right: 22,
                      width: 88,
                      height: 88,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: "rgba(203,255,26,0.22)",
                      backgroundColor: "rgba(8,14,20,0.78)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={homeFeaturedIcon ?? "activity"}
                      size={32}
                      color={mobileTheme.color.brandPrimary}
                    />
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      right: 122,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {homeFeaturedCategoryMeta ? (
                      <View
                        style={{
                          minHeight: 30,
                          borderRadius: mobileTheme.radius.pill,
                          backgroundColor: "rgba(6,9,13,0.5)",
                          paddingHorizontal: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: homeFeaturedCategoryMeta.color,
                          }}
                        />
                        <Text
                          style={{
                            color: "#E8EDF5",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {homeFeaturedCategoryMeta.label}
                        </Text>
                      </View>
                    ) : null}
                    {homeFeaturedDurationMinutes > 0 ? (
                      <View
                        style={{
                          minHeight: 30,
                          borderRadius: mobileTheme.radius.pill,
                          backgroundColor: "rgba(6,9,13,0.5)",
                          paddingHorizontal: 10,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#BFC8D6", fontSize: 12, fontWeight: "600" }}>
                          {homeFeaturedDurationMinutes} min
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      left: 0,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      backgroundColor: "rgba(6,9,13,0.58)",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{ color: "#F4F7FB", fontSize: 24, fontWeight: "700" }}
                      numberOfLines={2}
                    >
                      {homeFeaturedTemplate?.name ?? "Prepara tu próximo entrenamiento"}
                    </Text>
                    <Text style={{ color: "#B9C3D1", fontSize: 13, lineHeight: 18 }}>
                      {homeFeaturedTemplate
                        ? `${homeFeaturedExercises.length} ejercicios listos para hoy${homeFeaturedDurationMinutes > 0 ? ` • ${homeFeaturedDurationMinutes} min aprox.` : ""}`
                        : "Crea tu primera rutina para tener un inicio rápido desde la Home."}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    if (activeWorkoutSession) {
                      setTab("training");
                      return;
                    }
                    if (canStartHomeFeaturedTemplate && homeFeaturedTemplate) {
                      startTrainingSession(homeFeaturedTemplate.id);
                      return;
                    }
                    setTab("training");
                  }}
                  testID="home-primary-training-action"
                  style={{
                    minHeight: 54,
                    borderRadius: 16,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Feather name="play" size={16} color="#06090D" />
                  <Text style={{ color: "#06090D", fontSize: 16, fontWeight: "800" }}>
                    {homePrimaryActionLabel}
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    borderRadius: 20,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="zap" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>
                      Calorías
                    </Text>
                  </View>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700" }}>
                    {Math.round(dashboard.calories).toLocaleString("es-ES")}
                  </Text>
                  <Text style={{ color: "#7F8896", fontSize: 11 }}>
                    {dietDailyCaloriesTarget > 0
                      ? `${Math.round(dashboard.calories)}/${Math.round(dietDailyCaloriesTarget)} kcal`
                      : "Consumidas hoy"}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    borderRadius: 20,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="activity" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>
                      Peso
                    </Text>
                  </View>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700" }}>
                    {dashboard.weight !== null ? formatMeasurementNumber(dashboard.weight) : "--"}
                  </Text>
                  <Text style={{ color: "#19C37D", fontSize: 11, fontWeight: "600" }}>
                    {dashboard.weight !== null ? homeWeightChangeText : "Sin registro"}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    borderRadius: 20,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="award" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>
                      Racha
                    </Text>
                  </View>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700" }}>
                    {homeWorkoutStreak}
                  </Text>
                  <Text style={{ color: "#7F8896", fontSize: 11 }}>
                    {homeWorkoutStreak === 1 ? "día seguido" : "días seguidos"}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  borderRadius: 24,
                  padding: 14,
                  gap: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
                    Progreso semanal
                  </Text>
                  <Text style={{ color: "#7F8896", fontSize: 13, fontWeight: "700" }}>
                    {homeWeekCompletedCount}/7
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {homeWeekProgress.map((day) => (
                    <View key={day.key} style={{ flex: 1, alignItems: "center", gap: 8 }}>
                      <Text
                        style={{
                          color: day.isToday ? mobileTheme.color.brandPrimary : "#8B94A3",
                          fontSize: 12,
                          fontWeight: day.isToday ? "800" : "700",
                        }}
                      >
                        {day.label}
                      </Text>
                      <View
                        style={{
                          width: "100%",
                          minHeight: 40,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: day.isToday
                            ? "rgba(203,255,26,0.42)"
                            : day.completed
                              ? "rgba(203,255,26,0.2)"
                              : "rgba(255,255,255,0.06)",
                          backgroundColor: day.isToday
                            ? "rgba(203,255,26,0.12)"
                            : day.completed
                              ? "rgba(203,255,26,0.06)"
                              : "#11161D",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: day.completed ? 10 : 7,
                            height: day.completed ? 10 : 7,
                            borderRadius: 999,
                            backgroundColor: day.completed
                              ? mobileTheme.color.brandPrimary
                              : "rgba(255,255,255,0.18)",
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
                      Ejercicios de hoy
                    </Text>
                    <Text
                      style={{ color: "#7F8896", fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {homeFeaturedTemplate?.name ?? "Sin rutina seleccionada"}
                    </Text>
                  </View>
                  <Pressable onPress={() => setTab("training")}>
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
                      Ver todo
                    </Text>
                  </Pressable>
                </View>

                {homeFeaturedExercises.length === 0 ? (
                  <View
                    style={{
                      minHeight: 128,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgSurface,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 20,
                    }}
                  >
                    <Text
                      style={{
                        color: "#8B94A3",
                        fontSize: 14,
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      Añade una rutina en Entrenamiento para ver tu selección del día aquí.
                    </Text>
                  </View>
                ) : (
                  homeFeaturedExercises.map((exercise) => (
                    <View
                      key={exercise.id}
                      style={{
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgSurface,
                        borderRadius: 18,
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 58,
                          height: 58,
                          borderRadius: 16,
                          overflow: "hidden",
                          backgroundColor: exercise.previewMeta.backgroundColor,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.08)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {exercise.imageUri ? (
                          <Image
                            source={{ uri: exercise.imageUri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <Feather
                              name={exercise.previewMeta.icon}
                              size={16}
                              color={exercise.previewMeta.accentColor}
                            />
                            <Text
                              style={{
                                color: "#E8EDF5",
                                fontSize: 9,
                                fontWeight: "700",
                              }}
                            >
                              {exercise.previewMeta.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={{
                            color: mobileTheme.color.textPrimary,
                            fontSize: 16,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {exercise.exerciseName}
                        </Text>
                        <Text style={{ color: "#8B94A3", fontSize: 12 }} numberOfLines={1}>
                          {exercise.volumeLabel}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          if (activeWorkoutSession) {
                            setTab("training");
                            return;
                          }
                          if (canStartHomeFeaturedTemplate && homeFeaturedTemplate) {
                            startTrainingSession(homeFeaturedTemplate.id);
                            return;
                          }
                          setTab("training");
                        }}
                        testID={`home-exercise-start-${exercise.id}`}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          backgroundColor: mobileTheme.color.brandPrimary,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name="play" size={15} color="#06090D" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null}

          {tab === "training" ? (
            showTrainingListSkeleton ? (
              <View testID="training-list-loading-skeleton" style={{ gap: 12, paddingBottom: 110 }}>
                <View
                  style={{
                    minHeight: 48,
                    borderRadius: mobileTheme.radius.pill,
                    backgroundColor: "#131923",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.04)",
                  }}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[74, 78, 88].map((chipWidth, index) => (
                    <View
                      key={`skeleton_chip_${index}`}
                      style={{
                        height: 38,
                        width: chipWidth,
                        borderRadius: mobileTheme.radius.pill,
                        backgroundColor: "#131923",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.04)",
                      }}
                    />
                  ))}
                </View>

                <View style={{ gap: 10, paddingTop: 4 }}>
                  {Array.from({ length: TRAINING_LOADING_SKELETON_ROWS }).map((_, index) => (
                    <View
                      key={`skeleton_card_${index}`}
                      style={{
                        minHeight: 92,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.04)",
                        backgroundColor: "#131923",
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        opacity: index === TRAINING_LOADING_SKELETON_ROWS - 1 ? 0.64 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 4,
                          backgroundColor: "#1C2330",
                        }}
                      />
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          backgroundColor: "#202837",
                        }}
                      />
                      <View style={{ flex: 1, gap: 10 }}>
                        <View
                          style={{
                            height: 12,
                            width: "88%",
                            borderRadius: 999,
                            backgroundColor: "#242D3A",
                          }}
                        />
                        <View
                          style={{
                            height: 10,
                            width: "62%",
                            borderRadius: 999,
                            backgroundColor: "#202837",
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : showTrainingEditorSkeleton ? (
              <View testID="training-editor-loading-skeleton" style={{ gap: 12, paddingBottom: 110 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View
                    style={{
                      width: 96,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: "#131923",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.04)",
                    }}
                  />
                  <View
                    style={{
                      width: 116,
                      height: 42,
                      borderRadius: 14,
                      backgroundColor: "#202837",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.05)",
                    }}
                  />
                </View>

                <View
                  style={{
                    height: 48,
                    width: "82%",
                    borderRadius: 12,
                    backgroundColor: "#1C2330",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.04)",
                  }}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[88, 74, 104].map((chipWidth, index) => (
                    <View
                      key={`editor_skeleton_chip_${index}`}
                      style={{
                        height: 36,
                        width: chipWidth,
                        borderRadius: mobileTheme.radius.pill,
                        backgroundColor: "#131923",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.04)",
                      }}
                    />
                  ))}
                </View>

                <View
                  style={{
                    minHeight: 54,
                    borderRadius: 16,
                    backgroundColor: "#1A2B08",
                    borderWidth: 1,
                    borderColor: "rgba(203,255,26,0.15)",
                  }}
                />
                <View
                  style={{
                    minHeight: 54,
                    borderRadius: 16,
                    backgroundColor: "#1A2B08",
                    borderWidth: 1,
                    borderColor: "rgba(203,255,26,0.15)",
                  }}
                />

                <View style={{ gap: 10 }}>
                  {Array.from({ length: TRAINING_EDITOR_LOADING_SKELETON_ROWS }).map((_, index) => (
                    <View
                      key={`editor_skeleton_card_${index}`}
                      style={{
                        minHeight: 128,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.04)",
                        backgroundColor: "#131923",
                        padding: 14,
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            backgroundColor: "#202837",
                          }}
                        />
                        <View style={{ flex: 1, gap: 8 }}>
                          <View
                            style={{
                              height: 12,
                              width: "72%",
                              borderRadius: 999,
                              backgroundColor: "#242D3A",
                            }}
                          />
                          <View
                            style={{
                              height: 10,
                              width: "54%",
                              borderRadius: 999,
                              backgroundColor: "#202837",
                            }}
                          />
                        </View>
                      </View>
                      <View
                        style={{
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: "#202630",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.04)",
                        }}
                      />
                      <View
                        style={{
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: "#171B23",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.05)",
                        }}
                      />
                    </View>
                  ))}
                </View>

                <View
                  style={{
                    minHeight: 58,
                    borderRadius: 16,
                    backgroundColor: "#1A2B08",
                    borderWidth: 1,
                    borderColor: "rgba(203,255,26,0.15)",
                  }}
                />
              </View>
            ) : activeWorkoutSession ? (
              <View style={{ gap: 12, paddingBottom: 110 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, gap: 10, paddingRight: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: "#00C66B",
                        }}
                      />
                      <Text
                        style={{
                          color: "#00C66B",
                          fontSize: 14,
                          fontWeight: "800",
                          letterSpacing: 0.8,
                        }}
                      >
                        Sesión activa
                      </Text>
                    </View>
                    <Text
                      style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700" }}
                      numberOfLines={2}
                    >
                      {activeWorkoutSession.template_name}
                    </Text>
                    <Text style={{ color: "#8892A2", fontSize: 13 }}>
                      Estado {activeWorkoutSession.status === "running" ? "Activo" : "Pausado"}
                    </Text>
	                  </View>
	                  <View style={{ alignItems: "flex-end", gap: 10 }}>
	                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
	                      <Ionicons name="timer-outline" size={20} color="#F2F5FA" />
	                      <Text style={{ color: "#F2F5FA", fontSize: 26, fontWeight: "700" }}>
	                        {formatClock(activeWorkoutSession.elapsed_seconds)}
	                      </Text>
	                    </View>
	                    <Pressable
	                      onPress={finishActiveWorkoutSession}
	                      testID="training-session-finish"
	                      style={{
	                        minHeight: 44,
	                        borderRadius: 14,
	                        backgroundColor: "#FF4B4B",
	                        paddingHorizontal: 18,
	                        flexDirection: "row",
	                        alignItems: "center",
	                        justifyContent: "center",
	                        gap: 8,
	                      }}
	                    >
	                      <Feather name="flag" size={14} color="#FFFFFF" />
	                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>Finalizar</Text>
	                    </Pressable>
	                  </View>
	                </View>

                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${activeSessionProgressPercent}%`,
                        height: "100%",
                        backgroundColor: mobileTheme.color.brandPrimary,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>
                      {activeWorkoutSession.completed_series_count}/{activeWorkoutSession.total_series_count} series
                    </Text>
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
                      {activeSessionProgressPercent}%
                    </Text>
                  </View>
                </View>

                {activeSessionExercises.length === 0 ? (
                  <View
                    style={{
                      minHeight: 140,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: "#171B23",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 18,
                    }}
                  >
                    <Text style={{ color: "#8B94A3", fontSize: 16, textAlign: "center" }}>
                      No hay una serie activa disponible.
                    </Text>
                  </View>
                ) : (
                  activeSessionExercises.map((sessionExercise) => {
                    const isExpanded = sessionExercise.isCurrentExercise;
                    const exercisePreview = resolveExercisePreviewMeta(
                      sessionExercise.exercise.name ?? "",
                      sessionExercise.muscle,
                      activeWorkoutSession.category,
                    );
                    return (
                      <Pressable
                        key={sessionExercise.exercise.id}
                        onPress={() => focusWorkoutSessionExercise(sessionExercise.exercise.id)}
                        disabled={activeWorkoutSession.is_resting}
                        style={{
                          borderWidth: isExpanded ? 1.5 : 1,
                          borderColor: isExpanded
                            ? "rgba(203,255,26,0.78)"
                            : mobileTheme.color.borderSubtle,
                          backgroundColor: "#171B23",
                          borderRadius: 20,
                          padding: 12,
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 58,
                              height: 58,
                              borderRadius: 16,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: sessionExercise.isCompletedExercise
                                ? "rgba(0,198,107,0.3)"
                                : "rgba(255,255,255,0.08)",
                              backgroundColor: exercisePreview.backgroundColor,
                              position: "relative",
                              flexShrink: 0,
                            }}
                          >
                            {sessionExercise.exercise.image_uri ? (
                              <Image
                                source={{ uri: sessionExercise.exercise.image_uri }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  flex: 1,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  paddingHorizontal: 4,
                                  backgroundColor: exercisePreview.backgroundColor,
                                }}
                              >
                                <Feather name={exercisePreview.icon} size={18} color={exercisePreview.accentColor} />
                                <Text
                                  style={{
                                    color: "#E8EDF5",
                                    fontSize: 9,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                  numberOfLines={1}
                                >
                                  {exercisePreview.label}
                                </Text>
                              </View>
                            )}
                            <View
                              style={{
                                position: "absolute",
                                top: 5,
                                right: 5,
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                borderWidth: sessionExercise.isCompletedExercise ? 0 : 1,
                                borderColor: "rgba(255,255,255,0.12)",
                                backgroundColor: sessionExercise.isCompletedExercise
                                  ? "#00A75A"
                                  : isExpanded
                                    ? mobileTheme.color.brandPrimary
                                    : "#222834",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: sessionExercise.isCompletedExercise
                                    ? "#FFFFFF"
                                    : isExpanded
                                      ? "#06090D"
                                      : "#9FA7B5",
                                  fontSize: 10,
                                  fontWeight: "800",
                                }}
                              >
                                {sessionExercise.isCompletedExercise
                                  ? "✓"
                                  : `${sessionExercise.exerciseIndex + 1}`}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "700" }}
                              numberOfLines={1}
                            >
                              {sessionExercise.exercise.name || `Ejercicio ${sessionExercise.exerciseIndex + 1}`}
                            </Text>
                            <Text
                              style={{
                                color: sessionExercise.isCompletedExercise ? "#00C66B" : "#8B94A3",
                                fontSize: 14,
                              }}
                            >
                              {sessionExercise.muscle} • {sessionExercise.completedSeriesCount}/
                              {sessionExercise.totalSeriesCount} series
                            </Text>
                          </View>
                          <Text style={{ color: "#8C94A5", fontSize: 20, fontWeight: "700" }}>
                            {isExpanded ? "˅" : "˃"}
                          </Text>
                        </View>

                        {isExpanded ? (
                          <View style={{ gap: 8 }}>
                            <View
                              style={{
                                minHeight: 30,
                                borderRadius: 10,
                                backgroundColor: "#202630",
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 12,
                              }}
                            >
                              <Text style={{ width: 42, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                SET
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                REPS
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                PESO
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                DESCANSO
                              </Text>
                            </View>

                            {sessionExercise.seriesStates.map((seriesState) => (
                              <View
                                key={seriesState.key}
                                style={{
                                  minHeight: 42,
                                  borderRadius: 10,
                                  backgroundColor: seriesState.isCompleted
                                    ? "rgba(203,255,26,0.16)"
                                    : "transparent",
                                  borderWidth: seriesState.isCompleted ? 1 : 0,
                                  borderColor: seriesState.isCompleted
                                    ? "rgba(203,255,26,0.6)"
                                    : "transparent",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  paddingHorizontal: 10,
                                }}
                              >
                                <Pressable
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    if (seriesState.isCompleted) {
                                      markSessionSeriesAsNotDone(
                                        sessionExercise.exercise.id,
                                        seriesState.series.id,
                                      );
                                      return;
                                    }
                                    markSessionSeriesAsDone(
                                      sessionExercise.exercise.id,
                                      seriesState.series.id,
                                    );
                                  }}
                                  disabled={false}
                                  hitSlop={6}
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 999,
                                    backgroundColor: seriesState.isCompleted
                                      ? "#0AAE63"
                                      : "#2A3240",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 10,
                                    opacity: seriesState.isCompleted ? 1 : 0.9,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: seriesState.isCompleted
                                        ? "#FFFFFF"
                                        : "#9AA4B4",
                                      fontSize: 12,
                                      fontWeight: "800",
                                    }}
                                  >
                                    {seriesState.isCompleted ? "✓" : `${seriesState.seriesIndex + 1}`}
                                  </Text>
                                </Pressable>
                                <>
                                  <TextInput
                                    value={seriesState.series.reps}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveSession(
                                        sessionExercise.exercise.id,
                                        seriesState.series.id,
                                        "reps",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    keyboardType="number-pad"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      minHeight: 34,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: seriesState.isCompleted
                                        ? "rgba(203,255,26,0.8)"
                                        : "rgba(255,255,255,0.16)",
                                      backgroundColor: seriesState.isCompleted
                                        ? "rgba(6,9,13,0.32)"
                                        : "rgba(10,13,18,0.5)",
                                      color: seriesState.isCompleted
                                        ? mobileTheme.color.brandPrimary
                                        : "#C7CED9",
                                      fontSize: 16,
                                      fontWeight: "700",
                                      textAlign: "center",
                                    }}
                                  />
                                  <TextInput
                                    value={seriesState.series.weight_kg}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveSession(
                                        sessionExercise.exercise.id,
                                        seriesState.series.id,
                                        "weight_kg",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    keyboardType="numbers-and-punctuation"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      minHeight: 34,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: "rgba(255,255,255,0.16)",
                                      backgroundColor: "rgba(10,13,18,0.5)",
                                      color: "#C7CED9",
                                      fontSize: 16,
                                      fontWeight: "600",
                                      textAlign: "center",
                                    }}
                                  />
                                  <TextInput
                                    value={seriesState.series.rest_seconds}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveSession(
                                        sessionExercise.exercise.id,
                                        seriesState.series.id,
                                        "rest_seconds",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    keyboardType="numbers-and-punctuation"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      minHeight: 34,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: "rgba(255,255,255,0.16)",
                                      backgroundColor: "rgba(10,13,18,0.5)",
                                      color: "#C7CED9",
                                      fontSize: 16,
                                      fontWeight: "600",
                                      textAlign: "center",
                                    }}
                                  />
                                </>
                                <Pressable
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    if (seriesState.isCompleted) {
                                      markSessionSeriesAsNotDone(
                                        sessionExercise.exercise.id,
                                        seriesState.series.id,
                                      );
                                      return;
                                    }
                                    markSessionSeriesAsDone(
                                      sessionExercise.exercise.id,
                                      seriesState.series.id,
                                    );
                                  }}
                                  disabled={false}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 999,
                                    backgroundColor: seriesState.isCompleted ? mobileTheme.color.brandPrimary : "#202630",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginLeft: 10,
                                  }}
                                >
                                  <Feather
                                    name="check"
                                    size={16}
                                    color={seriesState.isCompleted ? "#06090D" : "#6E7787"}
                                  />
                                </Pressable>
                              </View>
                            ))}

                            {activeWorkoutSession.is_resting ? (
                              <View
                                style={{
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: "rgba(72,144,255,0.45)",
                                  backgroundColor: "rgba(45,78,130,0.18)",
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  gap: 6,
                                }}
                              >
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <Text style={{ color: "#76A9FF", fontSize: 14, fontWeight: "700" }}>
                                    Descanso {formatClock(activeWorkoutSession.rest_seconds_left)}/
                                    {formatClock(activeSessionRestTargetSeconds)}
                                  </Text>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                    <Pressable
                                      onPress={
                                        activeWorkoutSession.status === "running"
                                          ? pauseWorkoutSession
                                          : resumeWorkoutSession
                                      }
                                      testID="training-session-rest-toggle-pause"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: "rgba(118,169,255,0.65)",
                                        backgroundColor: "rgba(15,36,66,0.45)",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Feather
                                        name={activeWorkoutSession.status === "running" ? "pause" : "play"}
                                        size={16}
                                        color="#76A9FF"
                                      />
                                    </Pressable>
                                    <Pressable
                                      onPress={skipSessionRest}
                                      testID="training-session-skip-rest"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: "rgba(118,169,255,0.65)",
                                        backgroundColor: "rgba(15,36,66,0.45)",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Ionicons
                                        name="arrow-redo-circle-outline"
                                        size={18}
                                        color="#76A9FF"
                                      />
                                    </Pressable>
                                  </View>
                                </View>
                                <View
                                  style={{
                                    height: 4,
                                    borderRadius: 999,
                                    backgroundColor: "rgba(118,169,255,0.28)",
                                    overflow: "hidden",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: `${Math.round(activeSessionRestProgressRatio * 100)}%`,
                                      height: "100%",
                                      backgroundColor: "#4A90FF",
                                    }}
                                  />
                                </View>
                              </View>
                            ) : null}

                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}

                <Pressable
                  onPress={finishActiveWorkoutSession}
                  testID="training-session-finish-bottom"
                  style={{
                    minHeight: 44,
                    borderRadius: 14,
                    backgroundColor: "#FF4B4B",
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Feather name="flag" size={14} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>Finalizar</Text>
                </Pressable>
              </View>
            ) : isTrainingDetailOpen && activeTrainingTemplate ? (
              <View style={{ gap: 16, paddingBottom: 110 }}>
                <View
                  style={{
                    height: 228,
                    borderRadius: 26,
                    overflow: "hidden",
                    backgroundColor: "#0F141B",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  {activeTrainingPreviewImageUri ? (
                    <Image
                      source={{ uri: activeTrainingPreviewImageUri }}
                      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        backgroundColor: "#10161F",
                        justifyContent: "flex-end",
                        padding: 20,
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          top: 26,
                          right: 24,
                          width: 84,
                          height: 84,
                          borderRadius: 999,
                          backgroundColor:
                            activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.12)",
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          top: 58,
                          left: 24,
                          width: 120,
                          height: 120,
                          borderRadius: 30,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.05)",
                          backgroundColor: "rgba(255,255,255,0.03)",
                          transform: [{ rotate: "-12deg" }],
                        }}
                      />
                      <View
                        style={{
                          width: 82,
                          height: 82,
                          borderRadius: 24,
                          backgroundColor:
                            activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.12)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather
                          name={activeTrainingIcon ?? "activity"}
                          size={34}
                          color={activeTrainingCategoryMeta?.color ?? mobileTheme.color.brandPrimary}
                        />
                      </View>
                    </View>
                  )}

                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      backgroundColor: activeTrainingPreviewImageUri
                        ? "rgba(6,9,13,0.42)"
                        : "rgba(6,9,13,0.18)",
                    }}
                  />

                  <View
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      right: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Pressable
                      onPress={closeTrainingTemplateDetails}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        backgroundColor: "rgba(8,11,16,0.48)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="arrow-left" size={18} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      onPress={() => openTrainingTemplateEditor(activeTrainingTemplate.id)}
                      testID="training-detail-edit"
                      style={{
                        minHeight: 40,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        backgroundColor: "rgba(8,11,16,0.48)",
                        paddingHorizontal: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="edit-2" size={14} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                        {"Editar\nrutina"}
                      </Text>
                    </Pressable>
                  </View>

                  <View
                    style={{
                      position: "absolute",
                      left: 16,
                      right: 16,
                      bottom: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor:
                          activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.14)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather
                        name={activeTrainingIcon ?? "activity"}
                        size={18}
                        color={activeTrainingCategoryMeta?.color ?? mobileTheme.color.brandPrimary}
                      />
                    </View>
                    <View
                      style={{
                        minHeight: 34,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                        backgroundColor: "rgba(8,11,16,0.46)",
                        paddingHorizontal: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                        {activeTrainingCategoryMeta?.label ?? "Rutina"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 34, fontWeight: "700" }}>
                    {activeTrainingTemplate.name}
                  </Text>
                  <Text style={{ color: "#8B94A3", fontSize: 16, lineHeight: 22 }}>
                    {activeTrainingSummary}
                  </Text>
                </View>

                <Pressable
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? "rgba(203,255,26,0.75)"
                      : "rgba(255,255,255,0.08)",
                    backgroundColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? mobileTheme.color.brandPrimary
                      : "rgba(255,255,255,0.04)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Feather
                    name="play"
                    size={14}
                    color={
                      templateHasRunnableSeries(activeTrainingTemplate) ? "#06090D" : "#7F8896"
                    }
                  />
                  <Text
                    style={{
                      color: templateHasRunnableSeries(activeTrainingTemplate)
                        ? "#06090D"
                        : "#7F8896",
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    Empezar rutina
                  </Text>
                </Pressable>

                <View
                  style={{
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                    backgroundColor: "#171B23",
                    padding: 14,
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
                        Estadísticas
                      </Text>
                      <Text style={{ color: "#8B94A3", fontSize: 12 }}>
                        {activeTrainingLatestChartBar
                          ? `${activeTrainingStatsMetricMeta.label}: ${activeTrainingLatestChartBar.metricValueLabel}`
                          : activeTrainingHistory.length > 0
                            ? "No hay registros en el periodo seleccionado."
                            : "Completa la rutina para empezar a ver progreso."}
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingLeft: 8 }}
                    >
                      {TRAINING_STATS_PERIOD_OPTIONS.map((option) => {
                        const isActive = trainingStatsPeriod === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => setTrainingStatsPeriod(option.key)}
                            style={{
                              minHeight: 30,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: isActive
                                ? "rgba(203,255,26,0.78)"
                                : "rgba(255,255,255,0.08)",
                              backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#10151D",
                              paddingHorizontal: 10,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View
                    style={{
                      minHeight: 196,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.04)",
                      backgroundColor: "#121720",
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }}
                  >
                    {activeTrainingChartBars.length === 0 ? (
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: "#8B94A3",
                            fontSize: 14,
                            textAlign: "center",
                            lineHeight: 20,
                          }}
                        >
                          {activeTrainingHistory.length > 0
                            ? "No hay sesiones de esta rutina en el periodo seleccionado."
                            : "Todavía no hay ejecuciones guardadas de esta rutina."}
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                          gap: 12,
                          alignItems: "flex-end",
                          paddingRight: 10,
                          minHeight: 172,
                        }}
                      >
                        {activeTrainingChartBars.map((bar) => (
                          <View
                            key={bar.id}
                            style={{
                              width: 42,
                              alignItems: "center",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Text
                              style={{
                                color: bar.isLatest ? mobileTheme.color.brandPrimary : "#8B94A3",
                                fontSize: 10,
                                fontWeight: "700",
                                textAlign: "center",
                                minHeight: 28,
                              }}
                              numberOfLines={2}
                            >
                              {bar.metricValueLabel}
                            </Text>
                            <View
                              style={{
                                marginTop: 6,
                                width: "100%",
                                height: 108,
                                justifyContent: "flex-end",
                                alignItems: "center",
                              }}
                            >
                              <View
                                style={{
                                  width: 18,
                                  height: `${bar.heightPercent}%`,
                                  minHeight: 10,
                                  borderRadius: 999,
                                  backgroundColor: bar.isLatest
                                    ? mobileTheme.color.brandPrimary
                                    : "rgba(203,255,26,0.38)",
                                }}
                              />
                            </View>
                            <Text
                              style={{
                                marginTop: 8,
                                color: "#8B94A3",
                                fontSize: 10,
                                fontWeight: bar.isLatest ? "700" : "500",
                                textAlign: "center",
                              }}
                              numberOfLines={1}
                            >
                              {bar.label}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {TRAINING_STATS_METRIC_OPTIONS.map((option) => {
                      const isActive = trainingStatsMetric === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => setTrainingStatsMetric(option.key)}
                          style={{
                            minHeight: 38,
                            borderRadius: mobileTheme.radius.pill,
                            borderWidth: 1,
                            borderColor: isActive
                              ? "rgba(203,255,26,0.82)"
                              : mobileTheme.color.borderSubtle,
                            backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <View
                    style={{
                      minHeight: 44,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      backgroundColor: "#171B23",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="clock" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                      {activeTrainingDurationMinutes > 0 ? `${activeTrainingDurationMinutes} min` : "-- min"}
                    </Text>
                  </View>
                  <View
                    style={{
                      minHeight: 44,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      backgroundColor: "#171B23",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="repeat" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                      {activeTrainingTemplate.exercises.length} ejercicios
                    </Text>
                  </View>
                  <View
                    style={{
                      minHeight: 44,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      backgroundColor: "#171B23",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="zap" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                      ~{activeTrainingEstimatedCalories} kcal
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                >
                  <Pressable
                    onPress={() => setTrainingDetailMuscleFilter("all")}
                    style={{
                      minHeight: 38,
                      borderRadius: mobileTheme.radius.pill,
                      borderWidth: 1,
                      borderColor:
                        trainingDetailMuscleFilter === "all"
                          ? "rgba(203,255,26,0.82)"
                          : mobileTheme.color.borderSubtle,
                      backgroundColor:
                        trainingDetailMuscleFilter === "all"
                          ? "rgba(160,204,0,0.12)"
                          : "#0D1117",
                      paddingHorizontal: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          trainingDetailMuscleFilter === "all"
                            ? mobileTheme.color.brandPrimary
                            : "#9EA6B3",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Todas
                    </Text>
                  </Pressable>
                  {activeTrainingMuscleFilters.map((muscle) => {
                    const isActive = trainingDetailMuscleFilter === muscle;
                    return (
                      <Pressable
                        key={muscle}
                        onPress={() => setTrainingDetailMuscleFilter(muscle)}
                        style={{
                          minHeight: 38,
                          borderRadius: mobileTheme.radius.pill,
                          borderWidth: 1,
                          borderColor: isActive
                            ? "rgba(203,255,26,0.82)"
                            : mobileTheme.color.borderSubtle,
                          backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          {muscle}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={{ gap: 10 }}>
                  {activeTrainingDetailExercises.length === 0 ? (
                    <View
                      style={{
                        minHeight: 140,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: "#171B23",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 18,
                      }}
                    >
                      <Text style={{ color: "#8B94A3", fontSize: 16, textAlign: "center", lineHeight: 22 }}>
                        No hay ejercicios para este grupo muscular en la rutina.
                      </Text>
                    </View>
                  ) : (
                    activeTrainingDetailExercises.map((exercise, cardIndex) => (
                      <Pressable
                        key={exercise.exercise.id}
                        onPress={() => setExerciseDetailIndex(cardIndex)}
                        style={{
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.06)",
                          backgroundColor: "#171B23",
                          borderRadius: 20,
                          padding: 12,
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View
                            style={{
                              width: 58,
                              height: 58,
                              borderRadius: 16,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: "rgba(255,255,255,0.08)",
                              backgroundColor: exercise.previewMeta.backgroundColor,
                              flexShrink: 0,
                            }}
                          >
                            {exercise.imageUri ? (
                              <Image
                                source={{ uri: exercise.imageUri }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  flex: 1,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  paddingHorizontal: 4,
                                }}
                              >
                                <Feather
                                  name={exercise.previewMeta.icon}
                                  size={18}
                                  color={exercise.previewMeta.accentColor}
                                />
                                <Text
                                  style={{
                                    color: "#E8EDF5",
                                    fontSize: 9,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                  numberOfLines={1}
                                >
                                  {exercise.previewMeta.label}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "700" }}
                              numberOfLines={1}
                            >
                              {exercise.exerciseName}
                            </Text>
                            <Text style={{ color: "#8B94A3", fontSize: 13, marginTop: 2 }}>
                              {exercise.volumeLabel}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={18} color="#636B78" />
                        </View>
                        {exercise.seriesItems.length > 0 && (
                          <View style={{ gap: 0 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                paddingVertical: 4,
                                borderBottomWidth: 1,
                                borderBottomColor: "rgba(255,255,255,0.06)",
                              }}
                            >
                              <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", width: 40, textAlign: "center" }}>Serie</Text>
                              <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Reps</Text>
                              <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Peso</Text>
                              <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Descanso</Text>
                            </View>
                            {exercise.seriesItems.map((s: ExerciseSeries, sIdx: number) => (
                              <View
                                key={s.id}
                                style={{
                                  flexDirection: "row",
                                  paddingVertical: 4,
                                  borderBottomWidth: sIdx < exercise.seriesItems.length - 1 ? 1 : 0,
                                  borderBottomColor: "rgba(255,255,255,0.04)",
                                }}
                              >
                                <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700", width: 40, textAlign: "center" }}>
                                  {sIdx + 1}
                                </Text>
                                <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                  {s.reps.trim() || "--"}
                                </Text>
                                <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                  {s.weight_kg.trim() ? `${s.weight_kg.trim()} kg` : "--"}
                                </Text>
                                <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                  {s.rest_seconds.trim() ? `${s.rest_seconds.trim()}s` : "--"}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </Pressable>
                    ))
                  )}
                </View>

                <Pressable
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  testID="training-detail-start-session"
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? "rgba(203,255,26,0.75)"
                      : "rgba(255,255,255,0.08)",
                    backgroundColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? mobileTheme.color.brandPrimary
                      : "rgba(255,255,255,0.04)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Feather
                    name="play"
                    size={14}
                    color={
                      templateHasRunnableSeries(activeTrainingTemplate) ? "#06090D" : "#7F8896"
                    }
                  />
                  <Text
                    style={{
                      color: templateHasRunnableSeries(activeTrainingTemplate)
                        ? "#06090D"
                        : "#7F8896",
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    Empezar rutina
                  </Text>
                </Pressable>
              </View>
            ) : activeTrainingTemplate ? (
              <View style={{ gap: 12, paddingBottom: 110 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Pressable
                    onPress={closeTrainingTemplateEditor}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 2,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "600" }}>
                      ← Detalles
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveTrainingTemplateChanges}
                    style={{
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(203,255,26,0.75)",
                      backgroundColor: mobileTheme.color.brandPrimary,
                      paddingHorizontal: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="check" size={14} color="#06090D" />
                    <Text style={{ color: "#06090D", fontSize: 16, fontWeight: "800" }}>Guardar</Text>
                  </Pressable>
                </View>

                <TextInput
                  value={activeTrainingTemplate.name}
                  onChangeText={updateActiveTrainingName}
                  placeholder="Nombre de rutina"
                  placeholderTextColor="#7D8798"
                  style={{
                    marginTop: 4,
                    color: mobileTheme.color.textPrimary,
                    fontSize: 28,
                    fontWeight: "700",
                    minHeight: 42,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255,255,255,0.12)",
                    paddingBottom: 6,
                  }}
                />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {activeTrainingIcon ? (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name={activeTrainingIcon} size={16} color={mobileTheme.color.brandPrimary} />
                    </View>
                  ) : null}
                  {activeTrainingCategoryMeta ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          backgroundColor: activeTrainingCategoryMeta.color,
                        }}
                      />
                      <Text
                        style={{
                          color: activeTrainingCategoryMeta.color,
                          fontSize: 17,
                          fontWeight: "700",
                        }}
                      >
                        {activeTrainingCategoryMeta.label}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: "#8B94A3", fontSize: 15 }}>
                    {activeTrainingTemplate.exercises.length} ejercicios
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={activeTrainingTemplate.duration_minutes ?? ""}
                      onChangeText={updateActiveTrainingDuration}
                      placeholder={activeTrainingDurationMinutes > 0 ? `${activeTrainingDurationMinutes}` : "min"}
                      placeholderTextColor="#8B94A3"
                      keyboardType="number-pad"
                      style={{
                        minWidth: 44,
                        minHeight: 30,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        paddingHorizontal: 10,
                        color: mobileTheme.color.textPrimary,
                        fontSize: 15,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    />
                    <Text style={{ color: "#8B94A3", fontSize: 15 }}>min</Text>
                  </View>
                  <Text style={{ color: "#8B94A3", fontSize: 15 }}>
                    {activeTrainingSeriesTotal} series
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {TRAINING_CATEGORY_EDIT_OPTIONS.map((option) => {
                    const isActive = activeTrainingCategory === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => updateActiveTrainingCategory(option.key)}
                        style={{
                          minHeight: 38,
                          borderRadius: mobileTheme.radius.pill,
                          borderWidth: 1,
                          borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                          backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                          paddingHorizontal: 14,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "700" }}>Icono de la rutina</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                    testID="training-icon-picker"
                  >
                    {ROUTINE_ICON_OPTIONS.map((iconName) => {
                      const isActive = activeTrainingIcon === iconName;
                      return (
                        <Pressable
                          key={iconName}
                          onPress={() => updateActiveTrainingIcon(iconName)}
                          testID={`training-icon-option-${iconName}`}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                            backgroundColor: isActive ? "rgba(160,204,0,0.14)" : "#0D1117",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather
                            name={iconName}
                            size={16}
                            color={isActive ? mobileTheme.color.brandPrimary : "#96A0B0"}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <Pressable
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  testID="training-editor-start-session"
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? "rgba(203,255,26,0.75)"
                      : "rgba(255,255,255,0.08)",
                    backgroundColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? mobileTheme.color.brandPrimary
                      : "rgba(255,255,255,0.04)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Feather
                    name="play"
                    size={14}
                    color={
                      templateHasRunnableSeries(activeTrainingTemplate) ? "#06090D" : "#7F8896"
                    }
                  />
                  <Text
                    style={{
                      color: templateHasRunnableSeries(activeTrainingTemplate)
                        ? "#06090D"
                        : "#7F8896",
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    Empezar rutina
                  </Text>
                </Pressable>

                <Pressable
                  onPress={openExercisePicker}
                  testID="training-editor-add-exercise"
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(203,255,26,0.75)",
                    backgroundColor: "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Feather name="plus" size={14} color={mobileTheme.color.brandPrimary} />
                  <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 16, fontWeight: "800" }}>
                    Agregar ejercicio
                  </Text>
                </Pressable>

                {activeTrainingTemplate.exercises.length === 0 ? (
                  <View
                    style={{
                      minHeight: 140,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: "#171B23",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 18,
                    }}
                  >
                    <Text style={{ color: "#8B94A3", fontSize: 22, textAlign: "center", lineHeight: 28 }}>
                      Esta rutina aún no tiene ejercicios.
                    </Text>
                    <Text style={{ color: "#8B94A3", fontSize: 22, textAlign: "center", lineHeight: 28 }}>
                      Pulsa en "Agregar ejercicio" para empezar.
                    </Text>
                  </View>
                ) : (
                  activeTrainingTemplate.exercises.map((exercise, index) => {
                  const isExpanded = expandedExerciseId === exercise.id;
                  const isMenuOpen = activeExerciseMenuId === exercise.id;
                  const exerciseSeries = exercise.series ?? [];
                  const firstWeight = exerciseSeries.find((seriesItem) => seriesItem.weight_kg.trim())
                    ?.weight_kg;
                  const exerciseMuscle = exercise.muscle?.trim()
                    ? exercise.muscle
                    : inferExerciseMuscle(exercise.name ?? "", activeTrainingCategory ?? "strength");
                  return (
                    <View
                      key={exercise.id}
                      style={{
                        position: "relative",
                        zIndex: isMenuOpen ? 120 : 1,
                        elevation: isMenuOpen ? 20 : 0,
                      }}
                    >
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: "#171B23",
                          borderRadius: 20,
                          paddingHorizontal: 12,
                          paddingTop: 12,
                          paddingBottom: 10,
                          gap: 10,
                          overflow: "visible",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 8, alignItems: "center", gap: 3 }}>
                            {Array.from({ length: 6 }).map((_, dotIndex) => (
                              <View
                                key={`${exercise.id}_drag_${dotIndex}`}
                                style={{
                                  width: 2,
                                  height: 2,
                                  borderRadius: 999,
                                  backgroundColor: "#6F7786",
                                }}
                              />
                            ))}
                          </View>
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              backgroundColor: mobileTheme.color.brandPrimary,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#06090D", fontSize: 14, fontWeight: "800" }}>
                              {index + 1}
                            </Text>
                          </View>
                          {exercise.image_uri ? (
                            <Image
                              source={{ uri: normalizeExerciseImageUri(exercise.image_uri) ?? undefined }}
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                              }}
                              resizeMode="cover"
                            />
                          ) : null}
                          <View style={{ flex: 1, gap: 1 }}>
                            <TextInput
                              value={exercise.name ?? ""}
                              onChangeText={(value) => updateExerciseNameInActiveTemplate(exercise.id, value)}
                              placeholder={`Ejercicio ${index + 1}`}
                              placeholderTextColor="#8B94A3"
                              style={{
                                color: mobileTheme.color.textPrimary,
                                fontSize: 18,
                                fontWeight: "700",
                                minHeight: 30,
                              }}
                            />
                            <Text style={{ color: "#8B94A3", fontSize: 13 }}>
                              {exerciseMuscle} • {exerciseSeries.length} series
                              {firstWeight ? ` • ${firstWeight} kg` : ""}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() =>
                              setActiveExerciseMenuId((prev) => (prev === exercise.id ? null : exercise.id))
                            }
                            testID={`training-exercise-menu-${exercise.id}`}
                            style={{
                              width: 28,
                              height: 28,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <View style={{ alignItems: "center", gap: 3 }}>
                              {Array.from({ length: 3 }).map((_, dotIndex) => (
                                <View
                                  key={`${exercise.id}_menu_${dotIndex}`}
                                  style={{
                                    width: 3,
                                    height: 3,
                                    borderRadius: 999,
                                    backgroundColor: "#98A2B3",
                                  }}
                                />
                              ))}
                            </View>
                          </Pressable>
                        </View>

                        <View style={{ gap: 0 }}>
                            <View
                              style={{
                                minHeight: 28,
                                borderRadius: 8,
                                backgroundColor: "#202630",
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 10,
                                gap: 6,
                              }}
                            >
                              <Text
                                style={{
                                  width: 24,
                                  color: "#7D8798",
                                  fontSize: 11,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                #
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 11,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                REPS
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 11,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                KG
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 11,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                DESC
                              </Text>
                              <View style={{ width: 16 }} />
                            </View>

                            {exerciseSeries.map((seriesItem, setIndex) => {
                              return (
                                <View
                                  key={seriesItem.id}
                                  style={{
                                    minHeight: 36,
                                    borderBottomWidth:
                                      setIndex === exerciseSeries.length - 1 ? 0 : 1,
                                    borderBottomColor: "rgba(255,255,255,0.08)",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 10,
                                    gap: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      width: 24,
                                      color: "#8C95A4",
                                      fontSize: 13,
                                      fontWeight: "700",
                                      textAlign: "center",
                                    }}
                                  >
                                    {setIndex + 1}
                                  </Text>
                                  <TextInput
                                    value={seriesItem.reps}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveTemplate(
                                        exercise.id,
                                        seriesItem.id,
                                        "reps",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      color: mobileTheme.color.textPrimary,
                                      fontSize: 13,
                                      fontWeight: "700",
                                      paddingVertical: 0,
                                      paddingHorizontal: 0,
                                      textAlign: "center",
                                    }}
                                  />
                                  <TextInput
                                    value={seriesItem.weight_kg}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveTemplate(
                                        exercise.id,
                                        seriesItem.id,
                                        "weight_kg",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    keyboardType="numbers-and-punctuation"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      color: mobileTheme.color.textPrimary,
                                      fontSize: 13,
                                      fontWeight: "600",
                                      paddingVertical: 0,
                                      paddingHorizontal: 0,
                                      textAlign: "center",
                                    }}
                                  />
                                  <TextInput
                                    value={seriesItem.rest_seconds}
                                    onChangeText={(value) =>
                                      updateExerciseSeriesFieldInActiveTemplate(
                                        exercise.id,
                                        seriesItem.id,
                                        "rest_seconds",
                                        value,
                                      )
                                    }
                                    placeholder="-"
                                    placeholderTextColor="#8C95A4"
                                    keyboardType="number-pad"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      color: "#8C95A4",
                                      fontSize: 13,
                                      fontWeight: "600",
                                      paddingVertical: 0,
                                      paddingHorizontal: 0,
                                      textAlign: "center",
                                    }}
                                  />
                                  <View style={{ width: 16, alignItems: "center", justifyContent: "center", gap: 2 }}>
                                    {Array.from({ length: 3 }).map((_, rowIndex) => (
                                      <View
                                        key={`${seriesItem.id}_drag_row_${rowIndex}`}
                                        style={{ flexDirection: "row", gap: 2 }}
                                      >
                                        <View
                                          style={{
                                            width: 3,
                                            height: 3,
                                            borderRadius: 999,
                                            backgroundColor: "#7D8798",
                                          }}
                                        />
                                        <View
                                          style={{
                                            width: 3,
                                            height: 3,
                                            borderRadius: 999,
                                            backgroundColor: "#7D8798",
                                          }}
                                        />
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              );
                            })}

                            <Pressable
                              onPress={() => addSeriesToExercise(exercise.id)}
                              style={{
                                marginTop: 6,
                                minHeight: 36,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                                backgroundColor: "#171B23",
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                              }}
                            >
                              <Feather name="plus" size={13} color="#7F8896" />
                              <Text style={{ color: "#7F8896", fontSize: 14, fontWeight: "700" }}>
                                Añadir serie
                              </Text>
                            </Pressable>
                          </View>
                      </View>

                      {isMenuOpen ? (
                        <View
                          style={{
                            position: "absolute",
                            top: 56,
                            right: 12,
                            width: 216,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.1)",
                            backgroundColor: "rgba(12,14,19,0.98)",
                            paddingVertical: 8,
                            zIndex: 240,
                            elevation: 24,
                            shadowColor: "#000",
                            shadowOpacity: 0.36,
                            shadowRadius: 10,
                            shadowOffset: { width: 0, height: 6 },
                          }}
                        >
                          <Pressable
                            onPress={() => {
                              setExpandedExerciseId(exercise.id);
                              setActiveExerciseMenuId(null);
                            }}
                            testID={`training-exercise-edit-${exercise.id}`}
                            style={{
                              minHeight: 40,
                              paddingHorizontal: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <Feather name="edit-2" size={14} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                              Editar ejercicio
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => cloneExerciseInActiveTemplate(exercise.id)}
                            testID={`training-exercise-clone-${exercise.id}`}
                            style={{
                              minHeight: 40,
                              paddingHorizontal: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                              Clonar ejercicio
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => moveExerciseUpInActiveTemplate(exercise.id)}
                            testID={`training-exercise-move-${exercise.id}`}
                            style={{
                              minHeight: 40,
                              paddingHorizontal: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <Feather name="move" size={14} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                              Mover posición
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => deleteExerciseInActiveTemplate(exercise.id)}
                            testID={`training-exercise-delete-${exercise.id}`}
                            style={{
                              minHeight: 40,
                              borderTopWidth: 1,
                              borderTopColor: "rgba(255,255,255,0.2)",
                              marginTop: 6,
                              paddingTop: 10,
                              paddingHorizontal: 12,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <Feather name="trash-2" size={14} color="#FF4A4A" />
                            <Text style={{ color: "#FF4A4A", fontSize: 18, fontWeight: "600" }}>
                              Eliminar ejercicio
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                }))} 

                <Pressable
                  onPress={openExercisePicker}
                  testID="training-editor-add-exercise-bottom"
                  style={{
                    marginTop: 6,
                    minHeight: 54,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: "rgba(203,255,26,0.75)",
                    backgroundColor: "rgba(203,255,26,0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 25, fontWeight: "800" }}>
                    + Agregar ejercicio
                  </Text>
                </Pressable>

                <Pressable
                  onPress={saveTrainingTemplateChanges}
                  style={{
                    marginTop: 6,
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(203,255,26,0.75)",
                    backgroundColor: mobileTheme.color.brandPrimary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Feather name="check" size={14} color="#06090D" />
                  <Text style={{ color: "#06090D", fontSize: 16, fontWeight: "800" }}>
                    Guardar cambios
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                {lastWorkoutSessionSummary ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(203,255,26,0.35)",
                      backgroundColor: "#171B23",
                      borderRadius: 16,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "800" }}>
                      Último entrenamiento completado
                    </Text>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" }}>
                      {lastWorkoutSessionSummary.template_name}
                    </Text>
                    <Text style={{ color: "#8B94A3", fontSize: 13 }}>
                      {lastWorkoutSessionSummary.completed_series_count}/
                      {lastWorkoutSessionSummary.total_series_count} series ·{" "}
                      {formatClock(lastWorkoutSessionSummary.elapsed_seconds)}
                    </Text>
                    <Pressable
                      onPress={() => setLastWorkoutSessionSummary(null)}
                      style={{
                        marginTop: 4,
                        minHeight: 32,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#D7DEE8", fontSize: 13, fontWeight: "700" }}>
                        Cerrar resumen
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View
                  style={{
                    minHeight: 48,
                    borderRadius: mobileTheme.radius.pill,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                    backgroundColor: "#12151C",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                  }}
                >
                  <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
                    <View
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 999,
                        borderWidth: 1.8,
                        borderColor: mobileTheme.color.textSecondary,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        right: 0.5,
                        bottom: 2,
                        width: 6,
                        height: 1.8,
                        borderRadius: 999,
                        backgroundColor: mobileTheme.color.textSecondary,
                        transform: [{ rotate: "45deg" }],
                      }}
                    />
                  </View>
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      color: mobileTheme.color.textPrimary,
                      paddingVertical: 0,
                    }}
                    value={trainingSearch}
                    onChangeText={setTrainingSearch}
                    placeholder="Buscar rutinas..."
                    placeholderTextColor="#717985"
                  />
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 24 }}
                >
                  {TRAINING_FILTER_OPTIONS.map((option) => {
                    const isActive = trainingFilter === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setTrainingFilter(option.key)}
                        style={{
                          height: 38,
                          borderRadius: mobileTheme.radius.pill,
                          borderWidth: 1,
                          borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                          backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                            fontSize: 14,
                            fontWeight: "600",
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {filteredTrainingTemplates.length === 0 ? (
                  <View
                    style={{
                      minHeight: 430,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 18,
                      paddingTop: 16,
                    }}
                  >
                    <View
                      style={{
                        width: 74,
                        height: 74,
                        borderRadius: 22,
                        backgroundColor: "rgba(133,170,6,0.24)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View style={{ width: 32, gap: 5 }}>
                        {[0, 1, 2].map((row) => (
                          <View
                            key={row}
                            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                          >
                            <View
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: mobileTheme.color.brandPrimary,
                              }}
                            />
                            <View
                              style={{
                                flex: 1,
                                height: 3,
                                borderRadius: 2,
                                backgroundColor: mobileTheme.color.brandPrimary,
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                    <Text
                      style={{
                        marginTop: 24,
                        color: mobileTheme.color.textPrimary,
                        fontSize: 32,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      {store.templates.length === 0 ? "Sin rutinas aún" : "Sin resultados"}
                    </Text>
                    <Text
                      style={{
                        marginTop: 10,
                        color: "#8B94A3",
                        fontSize: 20,
                        textAlign: "center",
                        lineHeight: 26,
                      }}
                    >
                      {store.templates.length === 0
                        ? "Crea tu primera rutina personalizada\ny empieza a entrenar"
                        : "Prueba con otro texto de búsqueda\no cambia los filtros"}
                    </Text>

                    <Pressable
                      onPress={createTrainingTemplate}
                      style={{
                        marginTop: 30,
                        minHeight: 58,
                        borderRadius: 16,
                        backgroundColor: mobileTheme.color.brandPrimary,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        paddingHorizontal: 24,
                      }}
                    >
                      <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "700", lineHeight: 24 }}>
                        +
                      </Text>
                      <Text style={{ color: "#06090D", fontSize: 19, fontWeight: "800" }}>
                        CREAR RUTINA
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 10, paddingBottom: 110 }}>
                    {filteredTrainingTemplates.map((tpl, tplIndex) => {
                      const category = resolveTrainingCategory(tpl);
                      const categoryMeta = trainingCategoryMeta(category);
                      const routineIcon = normalizeTemplateIcon(tpl.icon, category, tplIndex);
                      const durationMinutes = inferTemplateDurationMinutes(tpl);
                      const canStartTemplate = templateHasRunnableSeries(tpl);
                      const isMenuOpen = trainingMenuTemplateId === tpl.id;
                      return (
                        <View
                          key={tpl.id}
                          style={{
                            position: "relative",
                            zIndex: isMenuOpen ? 140 : 1,
                            elevation: isMenuOpen ? 22 : 0,
                          }}
                        >
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: isMenuOpen
                                ? "rgba(203,255,26,0.8)"
                                : mobileTheme.color.borderSubtle,
                              backgroundColor: "#171B23",
                              borderRadius: 18,
                            }}
                          >
                            <Pressable
                              onPress={() => openTrainingTemplate(tpl.id)}
                              testID={`training-template-open-${tpl.id}`}
                              style={{
                                minHeight: 92,
                                paddingLeft: 14,
                                paddingRight: 56,
                                paddingTop: 14,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <View style={{ width: 10, alignItems: "center", justifyContent: "center", gap: 2 }}>
                                {Array.from({ length: 3 }).map((_, rowIndex) => (
                                  <View
                                    key={`${tpl.id}_dot_row_${rowIndex}`}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                                  >
                                    <View
                                      style={{
                                        width: 2,
                                        height: 2,
                                        borderRadius: 999,
                                        backgroundColor: "#707887",
                                      }}
                                    />
                                    <View
                                      style={{
                                        width: 2,
                                        height: 2,
                                        borderRadius: 999,
                                        backgroundColor: "#707887",
                                      }}
                                    />
                                  </View>
                                ))}
                              </View>
                              <View
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 12,
                                  backgroundColor: categoryMeta.iconBg,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Feather name={routineIcon} size={20} color={mobileTheme.color.brandPrimary} />
                              </View>
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text
                                  style={{ color: mobileTheme.color.textPrimary, fontSize: 24, fontWeight: "700" }}
                                  numberOfLines={1}
                                >
                                  {tpl.name}
                                </Text>
                                <View
                                  style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <View
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        backgroundColor: categoryMeta.color,
                                      }}
                                    />
                                    <Text style={{ color: categoryMeta.color, fontSize: 15, fontWeight: "700" }}>
                                      {categoryMeta.label}
                                    </Text>
                                  </View>
                                  <Text style={{ color: "#8892A2", fontSize: 15 }}>
                                    {durationMinutes > 0 ? `${durationMinutes} min` : "-- min"}
                                  </Text>
                                  <Text style={{ color: "#8892A2", fontSize: 15 }}>
                                    {tpl.exercises.length} ejercicios
                                  </Text>
                                </View>
                              </View>
                            </Pressable>

                            <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
                              <Pressable
                                onPress={() => startTrainingSession(tpl.id)}
                                disabled={!canStartTemplate}
                                testID={`training-template-inline-start-${tpl.id}`}
                                style={{
                                  minHeight: 44,
                                  borderRadius: 14,
                                  borderWidth: 1,
                                  borderColor: canStartTemplate
                                    ? "rgba(203,255,26,0.55)"
                                    : "rgba(255,255,255,0.1)",
                                  backgroundColor: canStartTemplate
                                    ? "rgba(203,255,26,0.1)"
                                    : "rgba(255,255,255,0.04)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    color: canStartTemplate
                                      ? mobileTheme.color.brandPrimary
                                      : "#7F8896",
                                    fontSize: 16,
                                    fontWeight: "800",
                                  }}
                                >
                                  Empezar rutina
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          <Pressable
                            onPress={() =>
                              setTrainingMenuTemplateId((prev) => (prev === tpl.id ? null : tpl.id))
                            }
                            testID={`training-template-menu-${tpl.id}`}
                            style={{
                              position: "absolute",
                              right: 14,
                              top: 14,
                              width: 30,
                              height: 30,
                              borderRadius: 10,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <View style={{ alignItems: "center", gap: 3 }}>
                              {Array.from({ length: 3 }).map((_, dotIndex) => (
                                <View
                                  key={`${tpl.id}_kebab_${dotIndex}`}
                                  style={{
                                    width: 3,
                                    height: 3,
                                    borderRadius: 999,
                                    backgroundColor: "#98A2B3",
                                  }}
                                />
                              ))}
                            </View>
                          </Pressable>

                          {isMenuOpen ? (
                            <View
                              style={{
                                position: "absolute",
                                top: 56,
                                right: 10,
                                width: 192,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                                backgroundColor: "rgba(12,14,19,0.98)",
                                paddingVertical: 8,
                                zIndex: 280,
                                elevation: 28,
                                shadowColor: "#000",
                                shadowOpacity: 0.36,
                                shadowRadius: 10,
                                shadowOffset: { width: 0, height: 6 },
                              }}
                            >
                              <Pressable
                                onPress={() => startTrainingSession(tpl.id)}
                                testID={`training-template-start-${tpl.id}`}
                                style={{
                                  minHeight: 40,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather name="play" size={14} color={mobileTheme.color.brandPrimary} />
                                <Text
                                  style={{
                                    color: mobileTheme.color.brandPrimary,
                                    fontSize: 17,
                                    fontWeight: "700",
                                  }}
                                >
                                  Iniciar entrenamiento
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => openTrainingTemplateEditor(tpl.id)}
                                testID={`training-template-edit-${tpl.id}`}
                                style={{
                                  minHeight: 40,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather name="edit-2" size={14} color={mobileTheme.color.textSecondary} />
                                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                  Editar rutina
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => cloneTrainingTemplate(tpl.id)}
                                testID={`training-template-clone-${tpl.id}`}
                                style={{
                                  minHeight: 40,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                  Clonar rutina
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => moveTrainingTemplateUp(tpl.id)}
                                testID={`training-template-move-${tpl.id}`}
                                style={{
                                  minHeight: 40,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather name="move" size={14} color={mobileTheme.color.textSecondary} />
                                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                  Mover posición
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => deleteTrainingTemplate(tpl.id)}
                                testID={`training-template-delete-${tpl.id}`}
                                style={{
                                  minHeight: 40,
                                  borderTopWidth: 1,
                                  borderTopColor: "rgba(255,255,255,0.2)",
                                  marginTop: 6,
                                  paddingTop: 10,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <Feather name="trash-2" size={14} color="#FF4A4A" />
                                <Text style={{ color: "#FF4A4A", fontSize: 17, fontWeight: "600" }}>
                                  Eliminar rutina
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )
          ) : null}

          {tab === "diet" ? (
            <View style={{ gap: 12, paddingBottom: 86 }}>
              <View style={{ gap: 8 }}>
                <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Pressable
                    onPress={() => changeDietDateBy(-1)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="chevron-left" size={20} color={mobileTheme.color.textSecondary} />
                  </Pressable>

                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 15, fontWeight: "700" }}>
                      {dietDateLabel}
                    </Text>
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700" }}>
                      {dietDateContextLabel}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Pressable
                      onPress={() => changeDietDateBy(1)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="chevron-right" size={20} color={mobileTheme.color.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowDietDatePicker((prev) => !prev)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="calendar-outline" size={18} color={mobileTheme.color.textSecondary} />
                    </Pressable>
                  </View>
                </View>

                {showDietDatePicker ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.bgSurface,
                      padding: 8,
                      gap: 8,
                    }}
                  >
                    <DateTimePicker
                      value={dateFromISO(selectedDietDate)}
                      mode="date"
                      display={Platform.OS === "ios" ? "inline" : "default"}
                      onChange={onDietDateChange}
                    />
                    {Platform.OS === "ios" ? (
                      <Pressable
                        onPress={() => setShowDietDatePicker(false)}
                        style={{
                          height: 38,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgApp,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                          Cerrar calendario
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 39, fontWeight: "800" }}>
                      {formatNutritionNumber(dayCaloriesConsumed)}/{formatNutritionNumber(dietDailyCaloriesTarget)}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, marginTop: -2 }}>
                      kcal consumidas
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      backgroundColor: "rgba(203,255,26,0.2)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "800", fontSize: 14 }}>
                      {dayCaloriesPercent}%
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    height: 8,
                    borderRadius: mobileTheme.radius.pill,
                    backgroundColor: "rgba(255,255,255,0.09)",
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.max(0, Math.min(dayCaloriesProgress * 100, 100))}%`,
                      backgroundColor: mobileTheme.color.brandPrimary,
                      borderRadius: mobileTheme.radius.pill,
                    }}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {dietMacroOverview.map((macro) => {
                    const progress =
                      macro.total > 0 ? Math.max(0, Math.min(macro.consumed / macro.total, 1)) : 0;
                    return (
                      <View key={macro.key} style={{ flex: 1, gap: 3 }}>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 32, fontWeight: "800" }}>
                          {formatNutritionNumber(macro.consumed)}g
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{macro.label}</Text>
                        <View
                          style={{
                            height: 5,
                            borderRadius: mobileTheme.radius.pill,
                            backgroundColor: "rgba(255,255,255,0.09)",
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${Math.max(0, Math.min(progress * 100, 100))}%`,
                              backgroundColor: macro.accent,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {orderedDietMeals.map((meal) => {
                const category = meal.title as DietMealCategory;
                const meta = DIET_MEAL_META[category];
                const isExpanded = dietMealExpanded[category];
                const isEditing = dietMealEditorCategory === category;
                const isEditingExistingItem = isEditing && dietEditingItem?.meal_id === meal.id;
                const mealCalories = meal.items.reduce((acc, item) => acc + item.calories_kcal, 0);
                const mealProtein = meal.items.reduce((acc, item) => acc + item.protein_g, 0);
                const mealCarbs = meal.items.reduce((acc, item) => acc + item.carbs_g, 0);
                const mealFat = meal.items.reduce((acc, item) => acc + item.fat_g, 0);
                return (
                  <View
                    key={meal.id}
                    style={{
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgSurface,
                      borderRadius: 18,
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => toggleDietMealCategory(category)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 4,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: `${meta.accent}22`,
                            }}
                          >
                            <Feather name={meta.icon} size={15} color={meta.accent} />
                          </View>
                          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 30, fontWeight: "800" }}>
                            {category}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                            P:{formatNutritionNumber(mealProtein)} C:{formatNutritionNumber(mealCarbs)} G:
                            {formatNutritionNumber(mealFat)}
                          </Text>
                          <Feather
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={mobileTheme.color.textSecondary}
                          />
                        </View>
                      </View>
                      <Text style={{ color: mobileTheme.color.textSecondary }}>
                        {formatNutritionNumber(mealCalories)} kcal · {meal.items.length} {meal.items.length === 1 ? "item" : "items"}
                      </Text>
                    </Pressable>

                    {isExpanded ? (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: mobileTheme.color.borderSubtle,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          gap: 10,
                        }}
                      >
                        {meal.items.length === 0 ? (
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                            Sin alimentos registrados.
                          </Text>
                        ) : (
                          meal.items.map((item) => {
                            const isItemMenuOpen =
                              dietItemMenu?.meal_id === meal.id && dietItemMenu?.item_id === item.id;
                            return (
                              <View
                                key={item.id}
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 10,
                                }}
                              >
                                <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
                                  <View
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: 999,
                                      backgroundColor: meta.dot,
                                      marginTop: 8,
                                    }}
                                  />
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                                      {item.title}
                                    </Text>
                                    <Text
                                      style={{ color: mobileTheme.color.textSecondary, fontSize: 12, marginTop: 1 }}
                                    >
                                      P:{formatNutritionNumber(item.protein_g)} C:{formatNutritionNumber(item.carbs_g)}{" "}
                                      G:{formatNutritionNumber(item.fat_g)}
                                    </Text>
                                  </View>
                                </View>
                                <View style={{ alignItems: "flex-end", gap: 4 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                    <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600" }}>
                                      {formatNutritionNumber(item.calories_kcal)} kcal
                                    </Text>
                                    <Pressable
                                      onPress={() =>
                                        setDietItemMenu((prev) =>
                                          prev?.meal_id === meal.id && prev?.item_id === item.id
                                            ? null
                                            : { meal_id: meal.id, item_id: item.id },
                                        )
                                      }
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 8,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Feather
                                        name="more-vertical"
                                        size={14}
                                        color={mobileTheme.color.textSecondary}
                                      />
                                    </Pressable>
                                  </View>
                                  {isItemMenuOpen ? (
                                    <View
                                      style={{
                                        minWidth: 124,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.09)",
                                        borderRadius: 12,
                                        backgroundColor: "rgba(12,14,19,0.96)",
                                        paddingVertical: 4,
                                      }}
                                    >
                                      <Pressable
                                        onPress={() => startEditDietItem(category, meal, item)}
                                        style={{
                                          minHeight: 36,
                                          paddingHorizontal: 12,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 8,
                                        }}
                                      >
                                        <Feather name="edit-3" size={13} color={mobileTheme.color.textPrimary} />
                                        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                                          Editar
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() => deleteDietItem(meal, item)}
                                        style={{
                                          minHeight: 36,
                                          paddingHorizontal: 12,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 8,
                                        }}
                                      >
                                        <Feather name="trash-2" size={13} color="#FF7B7B" />
                                        <Text style={{ color: "#FF7B7B", fontWeight: "600" }}>Eliminar</Text>
                                      </Pressable>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })
                        )}

                        {isEditing ? (
                          <View style={{ gap: 8 }}>
                            <TextInput
                              style={{
                                minHeight: 42,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: mobileTheme.color.borderSubtle,
                                backgroundColor: mobileTheme.color.bgApp,
                                color: mobileTheme.color.textPrimary,
                                paddingHorizontal: 12,
                              }}
                              value={mealTitleInput}
                              onChangeText={setMealTitleInput}
                              placeholder="Nombre del alimento"
                              placeholderTextColor={mobileTheme.color.textSecondary}
                            />
                            <TextInput
                              style={{
                                minHeight: 42,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: mobileTheme.color.borderSubtle,
                                backgroundColor: mobileTheme.color.bgApp,
                                color: mobileTheme.color.textPrimary,
                                paddingHorizontal: 12,
                              }}
                              value={mealCaloriesInput}
                              onChangeText={setMealCaloriesInput}
                              placeholder="Calorías"
                              placeholderTextColor={mobileTheme.color.textSecondary}
                              keyboardType="decimal-pad"
                            />
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={{
                                  width: "100%",
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  color: mobileTheme.color.textPrimary,
                                  paddingHorizontal: 12,
                                }}
                                value={mealProteinInput}
                                onChangeText={setMealProteinInput}
                                placeholder="P (g)"
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                keyboardType="decimal-pad"
                              />
                              <TextInput
                                style={{
                                  width: "100%",
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  color: mobileTheme.color.textPrimary,
                                  paddingHorizontal: 12,
                                }}
                                value={mealCarbsInput}
                                onChangeText={setMealCarbsInput}
                                placeholder="C (g)"
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                keyboardType="decimal-pad"
                              />
                              <TextInput
                                style={{
                                  width: "100%",
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  color: mobileTheme.color.textPrimary,
                                  paddingHorizontal: 12,
                                }}
                                value={mealFatInput}
                                onChangeText={setMealFatInput}
                                placeholder="G (g)"
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Pressable
                                onPress={addMeal}
                                style={{
                                  flex: 1,
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  backgroundColor: mobileTheme.color.brandPrimary,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: "#06090D", fontWeight: "700" }}>
                                  {isEditingExistingItem ? "Guardar cambios" : "Guardar alimento"}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={openFoodEstimatorModal}
                                style={{
                                  flex: 1,
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: "rgba(203,255,26,0.45)",
                                  backgroundColor: "rgba(203,255,26,0.12)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  paddingHorizontal: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    color: mobileTheme.color.brandPrimary,
                                    fontWeight: "700",
                                    fontSize: 12,
                                    textAlign: "center",
                                  }}
                                >
                                  Estimar con IA
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setDietMealEditorCategory(null);
                                  setDietEditingItem(null);
                                  setDietItemMenu(null);
                                  setMealTitleInput("");
                                  setMealCaloriesInput("");
                                  setMealProteinInput("");
                                  setMealCarbsInput("");
                                  setMealFatInput("");
                                }}
                                style={{
                                  flex: 1,
                                  minHeight: 42,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>
                                  Cancelar
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        <Pressable
                          onPress={() => openDietMealEditor(category)}
                          style={{
                            minHeight: 38,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "row",
                            gap: 6,
                            backgroundColor: mobileTheme.color.bgApp,
                          }}
                        >
                          <Feather name="plus-circle" size={14} color={mobileTheme.color.textSecondary} />
                          <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600" }}>
                            Añadir alimento
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {tab === "measures" ? (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <Pressable
                  onPress={openMeasurementEntryScreen}
                  style={{
                    minHeight: 44,
                    borderRadius: 14,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#06090D" />
                  <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 14 }}>
                    Registrar
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {measuresPrimaryStatCards.map((card) => (
                  <View
                    key={card.label}
                    style={{
                      flex: 1,
                      minHeight: 118,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.04)",
                      backgroundColor: mobileTheme.color.bgSurface,
                      padding: 14,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: "#7F8795", fontSize: 12, fontWeight: "600" }}>
                      {card.label}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>
                      {card.valueText}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" }}>
                      <Feather name={card.changeIcon} size={12} color={card.changeColor} />
                      <Text
                        style={{
                          color: card.changeColor,
                          fontSize: 12,
                          fontWeight: "700",
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {card.changeText}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {measuresSecondaryStatCards.map((card) => (
                  <View
                    key={card.label}
                    style={{
                      flex: 1,
                      minHeight: 94,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.04)",
                      backgroundColor: mobileTheme.color.bgSurface,
                      padding: 12,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: "#7F8795", fontSize: 12, fontWeight: "600" }}>
                      {card.label}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                      {card.valueText}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: "auto" }}>
                      <Feather name={card.changeIcon} size={11} color={card.changeColor} />
                      <Text
                        style={{
                          color: card.changeColor,
                          fontSize: 11,
                          fontWeight: "700",
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {card.changeText}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.04)",
                  backgroundColor: mobileTheme.color.bgSurface,
                  position: "relative",
                  overflow: "visible",
                  padding: 14,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    zIndex: 2,
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                    Evolución de peso
                  </Text>
                  <Pressable
                    onPress={toggleMeasuresDashboardPeriodDropdown}
                    style={{
                      minHeight: 34,
                      borderRadius: mobileTheme.radius.pill,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      backgroundColor: "#1B2029",
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: "#9EA6B3", fontSize: 12, fontWeight: "700" }}>
                      {measuresDashboardPeriodMeta.label}
                    </Text>
                    <Ionicons
                      name={measuresDashboardPeriodDropdownOpen ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#6F7785"
                    />
                  </Pressable>
                </View>

                {measuresDashboardPeriodDropdownOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 56,
                      right: 14,
                      zIndex: 20,
                      elevation: 12,
                    }}
                  >
                    <View
                      style={{
                        minWidth: 128,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        backgroundColor: "#1B2029",
                        shadowColor: "#000000",
                        shadowOpacity: 0.28,
                        shadowRadius: 14,
                        shadowOffset: { width: 0, height: 8 },
                        padding: 6,
                        gap: 4,
                      }}
                    >
                      {MEASURES_DASHBOARD_PERIOD_OPTIONS.map((option) => {
                        const isActive = measuresDashboardPeriod === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => selectMeasuresDashboardPeriod(option.key)}
                            style={{
                              minHeight: 34,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: isActive ? "rgba(203,255,26,0.12)" : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                color: isActive ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary,
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              {option.label}
                            </Text>
                            {isActive ? (
                              <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View
                  style={{
                    minHeight: 214,
                    borderRadius: 18,
                    backgroundColor: "#11161E",
                    zIndex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  {measuresDashboardChartPoints.length === 0 ? (
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text
                        style={{
                          color: "#8B94A3",
                          fontSize: 13,
                          lineHeight: 18,
                          textAlign: "center",
                        }}
                      >
                        {store.measurements.some((measurement) => measurement.weight_kg !== null)
                          ? "No hay registros de peso suficientes para este periodo."
                          : "Registra tu peso para empezar a ver la evolución."}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View
                        style={{
                          width: 28,
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: "#4E5665", fontSize: 11 }}>
                          {measuresDashboardScaleLabels.top}
                        </Text>
                        <Text style={{ color: "#4E5665", fontSize: 11 }}>
                          {measuresDashboardScaleLabels.mid}
                        </Text>
                        <Text style={{ color: "#4E5665", fontSize: 11 }}>
                          {measuresDashboardScaleLabels.bottom}
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          minHeight: 190,
                          borderRadius: 16,
                          overflow: "hidden",
                          paddingTop: 6,
                        }}
                      >
                        {[0, 1, 2, 3].map((lineIndex) => (
                          <View
                            key={`measure-chart-line-${lineIndex}`}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: `${lineIndex * 28}%`,
                              borderTopWidth: 1,
                              borderTopColor: "rgba(255,255,255,0.05)",
                            }}
                          />
                        ))}

                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "flex-end",
                            gap: 8,
                          }}
                        >
                          {measuresDashboardChartPoints.map((point) => (
                            <View
                              key={point.key}
                              style={{
                                flex: 1,
                                minWidth: 34,
                                height: "100%",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  flex: 1,
                                  width: "100%",
                                  justifyContent: "flex-end",
                                  alignItems: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: "72%",
                                    height: `${point.heightPercent}%`,
                                    minHeight: 22,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: point.isLatest
                                      ? "rgba(203,255,26,0.42)"
                                      : "rgba(203,255,26,0.12)",
                                    backgroundColor: point.isLatest
                                      ? "rgba(203,255,26,0.16)"
                                      : "rgba(203,255,26,0.08)",
                                    justifyContent: "flex-start",
                                    alignItems: "center",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 999,
                                      backgroundColor: mobileTheme.color.brandPrimary,
                                      marginTop: -4,
                                    }}
                                  />
                                </View>
                              </View>

                              <Text
                                style={{
                                  color: point.isLatest ? mobileTheme.color.brandPrimary : "#7F8795",
                                  fontSize: 11,
                                  fontWeight: point.isLatest ? "800" : "600",
                                }}
                              >
                                {point.label}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
                    Historial de registros
                  </Text>
                  {canExpandMeasurementHistory ? (
                    <Pressable
                      onPress={() => setShowAllMeasurementsHistory((current) => !current)}
                    >
                      <Text
                        style={{
                          color: mobileTheme.color.brandPrimary,
                          fontSize: 13,
                          fontWeight: "800",
                        }}
                      >
                        {showAllMeasurementsHistory ? "Ver menos" : "Ver todo"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {measurementHistoryEntries.length === 0 ? (
                  <View
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.04)",
                      backgroundColor: mobileTheme.color.bgSurface,
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
                      Todavía no hay registros
                    </Text>
                    <Text style={{ color: "#8B94A3", fontSize: 13, lineHeight: 18 }}>
                      Usa `Registrar` para guardar tu primer peso, foto o perímetro corporal.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {measurementHistoryEntries.map(({ measurement, sourceIndex }) => {
                      const previousWeightMeasurement =
                        measurement.weight_kg === null
                          ? null
                          : store.measurements
                              .slice(sourceIndex + 1)
                              .find((entry) => entry.weight_kg !== null) ?? null;
                      const previousWeightValue = previousWeightMeasurement?.weight_kg ?? null;
                      const weightDelta =
                        measurement.weight_kg !== null && previousWeightValue !== null
                          ? Math.round(
                              (measurement.weight_kg - previousWeightValue) * 10,
                            ) / 10
                          : null;
                      const changeIsDecrease = weightDelta !== null && weightDelta < 0;
                      const changeBadgeColor =
                        weightDelta === null
                          ? "#6F7785"
                          : changeIsDecrease
                            ? "#19C37D"
                            : mobileTheme.color.brandPrimary;
                      const changeBadgeBackground =
                        weightDelta === null
                          ? "rgba(127,135,149,0.14)"
                          : changeIsDecrease
                            ? "rgba(25,195,125,0.14)"
                            : "rgba(203,255,26,0.12)";

                      return (
                        <Pressable
                          key={measurement.id}
                          onPress={openMeasurementEntryScreen}
                          style={{
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.04)",
                            backgroundColor: mobileTheme.color.bgSurface,
                            padding: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "800" }}>
                              {formatMeasurementHistoryDate(measurement.measured_at)}
                            </Text>
                            <Text
                              style={{ color: "#7F8795", fontSize: 12, lineHeight: 17 }}
                              numberOfLines={1}
                            >
                              {buildMeasurementHistorySummary(measurement, latestBodyHeightCm)}
                            </Text>
                          </View>

                          {weightDelta !== null ? (
                            <View
                              style={{
                                minHeight: 30,
                                borderRadius: mobileTheme.radius.pill,
                                backgroundColor: changeBadgeBackground,
                                paddingHorizontal: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              <Feather
                                name={changeIsDecrease ? "trending-down" : "trending-up"}
                                size={11}
                                color={changeBadgeColor}
                              />
                              <Text style={{ color: changeBadgeColor, fontSize: 12, fontWeight: "800" }}>
                                {formatMeasurementNumber(Math.abs(weightDelta))}
                              </Text>
                            </View>
                          ) : null}

                          <Ionicons name="chevron-forward" size={18} color="#5D6675" />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {tab === "chat" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {threads.map((thread) => (
                  <Pressable
                    key={thread.id}
                    onPress={() => setActiveThreadId(thread.id)}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        activeThreadId === thread.id ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle,
                      backgroundColor:
                        activeThreadId === thread.id ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgSurface,
                      paddingHorizontal: 10,
                      height: 34,
                      borderRadius: mobileTheme.radius.pill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12 }}>{thread.title ?? "Hilo"}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={createThread}
                  style={{
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    paddingHorizontal: 10,
                    height: 34,
                    borderRadius: mobileTheme.radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>+ hilo</Text>
                </Pressable>
              </View>

              <ScrollView
                ref={chatScrollRef}
                style={{ maxHeight: 360 }}
                contentContainerStyle={{ gap: 8 }}
                nestedScrollEnabled
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        msg.role === "assistant"
                          ? "rgba(203,255,26,0.45)"
                          : mobileTheme.color.borderSubtle,
                      backgroundColor:
                        msg.role === "assistant"
                          ? "rgba(203,255,26,0.08)"
                          : mobileTheme.color.bgSurface,
                      borderRadius: mobileTheme.radius.md,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>{msg.role}</Text>
                    <Text style={{ color: mobileTheme.color.textPrimary, marginTop: 4 }}>{msg.content}</Text>
                  </View>
                ))}
              </ScrollView>

              <TextInput
                style={{
                  minHeight: 44,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Pregunta al coach (API proveedor)"
                placeholderTextColor={mobileTheme.color.textSecondary}
              />

              <Pressable
                onPress={sendMessage}
                disabled={sendingChat}
                style={{
                  height: 46,
                  borderRadius: mobileTheme.radius.md,
                  backgroundColor: mobileTheme.color.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#06090D", fontWeight: "700" }}>{sendingChat ? "Enviando..." : "Enviar"}</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === "settings" ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SETTINGS_TAB_OPTIONS.map((option) => {
                  const isActive = settingsTab === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setSettingsTab(option.key)}
                      style={{
                        borderWidth: 1,
                        borderColor: isActive ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle,
                        borderRadius: mobileTheme.radius.pill,
                        paddingHorizontal: 12,
                        minHeight: 34,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isActive ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgSurface,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {settingsTab === "diet" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    borderRadius: mobileTheme.radius.lg,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>
                    Plan de dieta
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary }}>
                    Define calorías diarias y cómo repartirlas entre carbohidratos, proteínas y grasas.
                  </Text>
                  <TextInput
                    style={{
                      minHeight: 42,
                      borderRadius: mobileTheme.radius.md,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgApp,
                      color: mobileTheme.color.textPrimary,
                      paddingHorizontal: 12,
                    }}
                    value={dietSettings.daily_calories}
                    onChangeText={updateDietDailyCalories}
                    placeholder="Calorías diarias objetivo (kcal)"
                    placeholderTextColor={mobileTheme.color.textSecondary}
                    keyboardType="decimal-pad"
                  />

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {DIET_MACRO_MODE_OPTIONS.map((option) => {
                      const isActive = dietSettings.macro_mode === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => setDietMacroMode(option.key)}
                          style={{
                            borderWidth: 1,
                            borderColor: isActive ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle,
                            borderRadius: mobileTheme.radius.pill,
                            paddingHorizontal: 12,
                            minHeight: 34,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isActive ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgApp,
                          }}
                        >
                          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {dietSettings.macro_mode === "manual_calories" ? (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        style={{
                          minHeight: 42,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgApp,
                          color: mobileTheme.color.textPrimary,
                          paddingHorizontal: 12,
                        }}
                        value={dietSettings.manual_macro_calories.carbs}
                        onChangeText={(value) => updateManualMacroCalories("carbs", value)}
                        placeholder="Carbohidratos (kcal)"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                        keyboardType="decimal-pad"
                      />
                      <TextInput
                        style={{
                          minHeight: 42,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgApp,
                          color: mobileTheme.color.textPrimary,
                          paddingHorizontal: 12,
                        }}
                        value={dietSettings.manual_macro_calories.protein}
                        onChangeText={(value) => updateManualMacroCalories("protein", value)}
                        placeholder="Proteínas (kcal)"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                        keyboardType="decimal-pad"
                      />
                      <TextInput
                        style={{
                          minHeight: 42,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgApp,
                          color: mobileTheme.color.textPrimary,
                          paddingHorizontal: 12,
                        }}
                        value={dietSettings.manual_macro_calories.fat}
                        onChangeText={(value) => updateManualMacroCalories("fat", value)}
                        placeholder="Grasas (kcal)"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                        keyboardType="decimal-pad"
                      />
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          borderRadius: mobileTheme.radius.md,
                          backgroundColor: mobileTheme.color.bgApp,
                          padding: 10,
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                          Asignadas: {manualAssignedCalories.toFixed(0)} kcal
                        </Text>
                        <Text
                          style={{
                            color: manualRemainingCalories < 0 ? "#FF8D8D" : mobileTheme.color.brandPrimary,
                            fontWeight: "700",
                          }}
                        >
                          {manualRemainingCalories >= 0
                            ? `Restantes: ${manualRemainingCalories.toFixed(0)} kcal`
                            : `Excedente: ${Math.abs(manualRemainingCalories).toFixed(0)} kcal`}
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                          Carbos: {manualCarbsGrams.toFixed(1)} g • Proteínas: {manualProteinGrams.toFixed(1)} g • Grasas: {manualFatGrams.toFixed(1)} g
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                        Peso actual usado: {latestBodyWeightKg !== null ? `${latestBodyWeightKg.toFixed(2)} kg` : "Sin definir"}
                      </Text>
                      {latestBodyWeightKg === null ? (
                        <Text style={{ color: "#ffd7a8", fontSize: 12 }}>
                          Guarda tu peso corporal para calcular macros por kg.
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            minHeight: 42,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: mobileTheme.color.bgApp,
                            color: mobileTheme.color.textPrimary,
                            paddingHorizontal: 12,
                          }}
                          value={dietSettings.protein_grams_per_kg}
                          onChangeText={updateProteinGramsPerKg}
                          placeholder={proteinGkgPlaceholder}
                          placeholderTextColor={mobileTheme.color.textSecondary}
                          keyboardType="decimal-pad"
                        />
                        {canAutocompleteGkgMacro && autocompleteGkgMacroKey === "protein" ? (
                          <Pressable
                            onPress={autocompleteMissingGkgMacro}
                            style={{
                              minWidth: 62,
                              height: 42,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: "rgba(203,255,26,0.45)",
                              backgroundColor: "rgba(203,255,26,0.12)",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
                              Auto
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            minHeight: 42,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: mobileTheme.color.bgApp,
                            color: mobileTheme.color.textPrimary,
                            paddingHorizontal: 12,
                          }}
                          value={dietSettings.carbs_grams_per_kg}
                          onChangeText={updateCarbsGramsPerKg}
                          placeholder={carbsGkgPlaceholder}
                          placeholderTextColor={mobileTheme.color.textSecondary}
                          keyboardType="decimal-pad"
                        />
                        {canAutocompleteGkgMacro && autocompleteGkgMacroKey === "carbs" ? (
                          <Pressable
                            onPress={autocompleteMissingGkgMacro}
                            style={{
                              minWidth: 62,
                              height: 42,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: "rgba(203,255,26,0.45)",
                              backgroundColor: "rgba(203,255,26,0.12)",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
                              Auto
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            minHeight: 42,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: mobileTheme.color.bgApp,
                            color: mobileTheme.color.textPrimary,
                            paddingHorizontal: 12,
                          }}
                          value={dietSettings.fat_grams_per_kg}
                          onChangeText={updateFatGramsPerKg}
                          placeholder={fatGkgPlaceholder}
                          placeholderTextColor={mobileTheme.color.textSecondary}
                          keyboardType="decimal-pad"
                        />
                        {canAutocompleteGkgMacro && autocompleteGkgMacroKey === "fat" ? (
                          <Pressable
                            onPress={autocompleteMissingGkgMacro}
                            style={{
                              minWidth: 62,
                              height: 42,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: "rgba(203,255,26,0.45)",
                              backgroundColor: "rgba(203,255,26,0.12)",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
                              Auto
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          borderRadius: mobileTheme.radius.md,
                          backgroundColor: mobileTheme.color.bgApp,
                          padding: 10,
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                          Proteínas: {proteinCaloriesFromWeightPlan.toFixed(0)} kcal ({proteinGramsFromWeightPlan.toFixed(1)} g)
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                          Carbos: {carbsCaloriesFromWeightPlan.toFixed(0)} kcal ({carbsGramsFromWeightPlan.toFixed(1)} g)
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                          Grasas: {fatCaloriesFromWeightPlan.toFixed(0)} kcal ({fatGramsFromWeightPlan.toFixed(1)} g)
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                          Objetivo por kg: P {proteinGramsPerKgTarget.toFixed(2)} • C {carbsGramsPerKgTarget.toFixed(2)} • G {fatGramsPerKgTarget.toFixed(2)}
                        </Text>
                        <Text
                          style={{
                            color:
                              caloriesRemainingAfterWeightPlan < 0 ? "#FF8D8D" : mobileTheme.color.brandPrimary,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {caloriesRemainingAfterWeightPlan >= 0
                            ? `Calorías por repartir: ${caloriesRemainingAfterWeightPlan.toFixed(0)} kcal`
                            : `El plan excede el objetivo en ${Math.abs(caloriesRemainingAfterWeightPlan).toFixed(0)} kcal`}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text
                    style={{
                      color: configuredMacroCaloriesRemaining < 0 ? "#FF8D8D" : mobileTheme.color.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Resumen plan: {configuredMacroCaloriesTotal.toFixed(0)} kcal asignadas •{" "}
                    {configuredMacroCaloriesRemaining >= 0
                      ? `${configuredMacroCaloriesRemaining.toFixed(0)} kcal por repartir`
                      : `${Math.abs(configuredMacroCaloriesRemaining).toFixed(0)} kcal excedidas`}
                  </Text>
                </View>
              ) : null}

              {settingsTab === "provider" ? (
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: "rgba(69,141,255,0.45)",
                      borderRadius: mobileTheme.radius.lg,
                      backgroundColor: "rgba(17,58,130,0.24)",
                      padding: 12,
                      flexDirection: "row",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        alignItems: "center",
                        justifyContent: "flex-start",
                        paddingTop: 1,
                      }}
                    >
                      <Feather name="shield" size={16} color="#77A8FF" />
                    </View>
                    <Text style={{ color: "#77A8FF", flex: 1, lineHeight: 19 }}>
                      Tus API Keys se almacenan cifradas localmente en tu dispositivo. GYMNASIA nunca las envía a nuestros servidores.
                    </Text>
                  </View>

                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 26 }}>
                    API Keys (BYOK)
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: -4 }}>
                    Configura tus propias claves para usar el asistente IA. Cada proveedor ofrece diferentes modelos y capacidades.
                  </Text>

                  {orderedProviderKeys.map((key) => {
                    const providerMeta = PROVIDER_UI_META[key.provider];
                    const draft = providerDraftByProvider[key.provider] ?? {
                      api_key: key.api_key,
                      model: key.model,
                    };
                    const hasDraftApiKey = !!draft.api_key.trim();
                    const hasPersistedProviderApiKey = !!key.api_key.trim();
                    const keyVisible = providerKeyVisibility[key.provider];
                    const connectionStatus = providerConnectionStatus[key.provider] ?? {
                      state: hasDraftApiKey ? "unknown" : "disconnected",
                      detail: hasDraftApiKey
                        ? PROVIDER_STATUS_COPY.warningPending
                        : PROVIDER_STATUS_COPY.warningNoKey,
                      severity: "warning",
                    };
                    const statusMeta = providerConnectionBadge(connectionStatus);
                    const isSavingProvider = providerSaveLoading[key.provider];
                    const providerUsageHint = key.is_active
                      ? "Proveedor activo para el chat."
                      : "Toca el encabezado para usar este proveedor en el chat.";
                    const providerUsageHintColor = key.is_active ? "#24D68B" : "#656E7B";
                    const providerConnectionDetailColor = providerDetailColorBySeverity(
                      connectionStatus.severity,
                    );
                    return (
                      <View
                        key={key.provider}
                        style={{
                          borderWidth: 1,
                          borderColor: key.is_active ? "rgba(69,141,255,0.45)" : mobileTheme.color.borderSubtle,
                          borderRadius: mobileTheme.radius.lg,
                          backgroundColor: mobileTheme.color.bgSurface,
                          padding: 12,
                          gap: 10,
                        }}
                      >
                        <Pressable
                          onPress={() => setActiveProvider(key.provider)}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 12,
                                backgroundColor: providerMeta.avatar_bg,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: providerMeta.avatar_text, fontSize: 22, fontWeight: "700" }}>
                                {providerMeta.label.charAt(0)}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 29 }}>
                                {providerMeta.label}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={{ color: mobileTheme.color.textSecondary, marginTop: -2 }}
                              >
                                {draft.model.trim() || providerMeta.models_hint}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={{
                              borderRadius: mobileTheme.radius.pill,
                              paddingHorizontal: 10,
                              minHeight: 28,
                              backgroundColor: statusMeta.backgroundColor,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 6,
                            }}
                          >
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 99,
                                backgroundColor: statusMeta.dotColor,
                              }}
                            />
                            <Text
                              style={{
                                color: statusMeta.textColor,
                                fontWeight: "700",
                                fontSize: 12,
                              }}
                            >
                              {statusMeta.text}
                            </Text>
                          </View>
                        </Pressable>

                        <View
                          style={{
                            minHeight: 48,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: "rgba(61,70,82,0.9)",
                            backgroundColor: "#1A1E25",
                            flexDirection: "row",
                            alignItems: "center",
                            paddingLeft: 12,
                            paddingRight: 8,
                            gap: 8,
                          }}
                        >
                          <Feather name="key" size={14} color="#778091" />
                          <TextInput
                            style={{
                              flex: 1,
                              minHeight: 40,
                              color: hasDraftApiKey ? mobileTheme.color.textSecondary : "#7E8795",
                              paddingHorizontal: 0,
                            }}
                            value={draft.api_key}
                            onFocus={() => setActiveProvider(key.provider)}
                            onChangeText={(value) => updateProviderDraft(key.provider, { api_key: value })}
                            placeholder="Añade tu API Key"
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            secureTextEntry={!keyVisible}
                          />
                          <Pressable
                            onPress={() => {
                              setActiveProvider(key.provider);
                              toggleProviderKeyVisibility(key.provider);
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor: "#222833",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Feather
                              name={keyVisible ? "eye-off" : "eye"}
                              size={16}
                              color={mobileTheme.color.textSecondary}
                            />
                          </Pressable>
                        </View>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => saveProviderApiKey(key.provider)}
                            disabled={isSavingProvider}
                            style={{
                              flex: 1,
                              height: 44,
                              borderRadius: mobileTheme.radius.md,
                              backgroundColor: mobileTheme.color.brandPrimary,
                              alignItems: "center",
                              justifyContent: "center",
                              opacity: isSavingProvider ? 0.7 : 1,
                            }}
                          >
                            <Text style={{ color: "#06090D", fontWeight: "700" }}>
                              {isSavingProvider ? "Guardando..." : "Guardar"}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              if (!hasPersistedProviderApiKey) return;
                              openDeleteProviderApiKeyModal(key.provider);
                            }}
                            disabled={!hasPersistedProviderApiKey}
                            style={{
                              flex: 1,
                              height: 44,
                              borderRadius: mobileTheme.radius.md,
                              backgroundColor: hasPersistedProviderApiKey ? "#FF4D4F" : "#2F3440",
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 8,
                              opacity: hasPersistedProviderApiKey ? 1 : 0.6,
                            }}
                          >
                            <Feather
                              name="trash-2"
                              size={14}
                              color={hasPersistedProviderApiKey ? "#FFDDE0" : "#9AA2AE"}
                            />
                            <Text
                              style={{
                                color: hasPersistedProviderApiKey ? "#FFE8EB" : "#9AA2AE",
                                fontWeight: "700",
                              }}
                            >
                              Eliminar
                            </Text>
                          </Pressable>
                        </View>

                        <Text style={{ color: providerUsageHintColor, fontSize: 12 }}>
                          {providerUsageHint}
                        </Text>
                        <Text style={{ color: providerConnectionDetailColor, fontSize: 12 }}>
                          {connectionStatus.detail}
                        </Text>

                        {key.is_active ? (
                          key.provider === "anthropic" ? (
                            <View style={{ gap: 8 }}>
                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  toggleAnthropicModelDropdown();
                                }}
                                style={{
                                  minHeight: 44,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                                  <Feather name="list" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: mobileTheme.color.textPrimary, flex: 1 }}
                                  >
                                    {draft.model.trim() || DEFAULT_MODELS.anthropic}
                                  </Text>
                                </View>
                                {anthropicModelOptionsLoading && anthropicModelDropdownOpen ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather
                                    name={anthropicModelDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={mobileTheme.color.textSecondary}
                                  />
                                )}
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  const anthropicApiKey = draft.api_key.trim();
                                  if (!anthropicApiKey) {
                                    setAnthropicModelOptionsMessage({
                                      text: PROVIDER_STATUS_COPY.warningNoKey,
                                      severity: "warning",
                                    });
                                    return;
                                  }
                                  loadAnthropicModelOptions(anthropicApiKey);
                                }}
                                style={{
                                  minHeight: 34,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: "rgba(69,141,255,0.35)",
                                  backgroundColor: "rgba(69,141,255,0.12)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexDirection: "row",
                                  gap: 6,
                                  paddingHorizontal: 10,
                                  alignSelf: "flex-start",
                                }}
                              >
                                {anthropicModelOptionsLoading ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather name="refresh-cw" size={12} color="#77A8FF" />
                                )}
                                <Text style={{ color: "#77A8FF", fontSize: 12, fontWeight: "700" }}>
                                  Actualizar modelos
                                </Text>
                              </Pressable>

                              {anthropicModelDropdownOpen ? (
                                <View
                                  style={{
                                    borderWidth: 1,
                                    borderColor: mobileTheme.color.borderSubtle,
                                    borderRadius: mobileTheme.radius.md,
                                    backgroundColor: mobileTheme.color.bgApp,
                                    maxHeight: 210,
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingTop: 10,
                                      paddingBottom: 8,
                                      borderBottomWidth: 1,
                                      borderBottomColor: "rgba(61,70,82,0.5)",
                                    }}
                                  >
                                    <View
                                      style={{
                                        minHeight: 36,
                                        borderRadius: mobileTheme.radius.md,
                                        borderWidth: 1,
                                        borderColor: "rgba(61,70,82,0.8)",
                                        backgroundColor: "#1A1E25",
                                        paddingHorizontal: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <Feather name="search" size={13} color={mobileTheme.color.textSecondary} />
                                      <TextInput
                                        style={{
                                          flex: 1,
                                          minHeight: 34,
                                          color: mobileTheme.color.textPrimary,
                                          paddingHorizontal: 0,
                                          fontSize: 12,
                                        }}
                                        value={anthropicModelFilter}
                                        onChangeText={setAnthropicModelFilter}
                                        placeholder="Filtrar modelos..."
                                        placeholderTextColor={mobileTheme.color.textSecondary}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                      />
                                    </View>
                                  </View>
                                  {anthropicModelOptionsLoading ? (
                                    <View
                                      style={{
                                        minHeight: 64,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <ActivityIndicator size="small" color="#77A8FF" />
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        Cargando modelos de Anthropic...
                                      </Text>
                                    </View>
                                  ) : filteredAnthropicModelOptions.length === 0 ? (
                                    <View style={{ padding: 12 }}>
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        No hay modelos disponibles para mostrar.
                                      </Text>
                                    </View>
                                  ) : (
                                    <ScrollView nestedScrollEnabled>
                                      {filteredAnthropicModelOptions.map((modelOption) => {
                                        const selected = modelOption.id === draft.model.trim();
                                        return (
                                          <Pressable
                                            key={modelOption.id}
                                            onPress={() => {
                                              setActiveProvider(key.provider);
                                              selectAnthropicModel(modelOption.id);
                                            }}
                                            style={{
                                              minHeight: 46,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              borderBottomWidth: 1,
                                              borderBottomColor: "rgba(61,70,82,0.5)",
                                              backgroundColor: selected ? "rgba(69,141,255,0.16)" : "transparent",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                                              {modelOption.id}
                                            </Text>
                                            {modelOption.display_name ? (
                                              <Text
                                                numberOfLines={1}
                                                style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}
                                              >
                                                {modelOption.display_name}
                                              </Text>
                                            ) : null}
                                          </Pressable>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>
                              ) : null}

                              {anthropicModelOptionsMessage ? (
                                <Text
                                  style={{
                                    color: providerDetailColorBySeverity(anthropicModelOptionsMessage.severity),
                                    fontSize: 12,
                                  }}
                                >
                                  {anthropicModelOptionsMessage.text}
                                </Text>
                              ) : null}
                            </View>
                          ) : key.provider === "openai" ? (
                            <View style={{ gap: 8 }}>
                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  toggleOpenAIModelDropdown();
                                }}
                                style={{
                                  minHeight: 44,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                                  <Feather name="list" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: mobileTheme.color.textPrimary, flex: 1 }}
                                  >
                                    {draft.model.trim() || DEFAULT_MODELS.openai}
                                  </Text>
                                </View>
                                {openAIModelOptionsLoading && openAIModelDropdownOpen ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather
                                    name={openAIModelDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={mobileTheme.color.textSecondary}
                                  />
                                )}
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  const openAIApiKey = draft.api_key.trim();
                                  if (!openAIApiKey) {
                                    setOpenAIModelOptionsMessage({
                                      text: PROVIDER_STATUS_COPY.warningNoKey,
                                      severity: "warning",
                                    });
                                    return;
                                  }
                                  loadOpenAIModelOptions(openAIApiKey);
                                }}
                                style={{
                                  minHeight: 34,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: "rgba(69,141,255,0.35)",
                                  backgroundColor: "rgba(69,141,255,0.12)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexDirection: "row",
                                  gap: 6,
                                  paddingHorizontal: 10,
                                  alignSelf: "flex-start",
                                }}
                              >
                                {openAIModelOptionsLoading ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather name="refresh-cw" size={12} color="#77A8FF" />
                                )}
                                <Text style={{ color: "#77A8FF", fontSize: 12, fontWeight: "700" }}>
                                  Actualizar modelos
                                </Text>
                              </Pressable>

                              {openAIModelDropdownOpen ? (
                                <View
                                  style={{
                                    borderWidth: 1,
                                    borderColor: mobileTheme.color.borderSubtle,
                                    borderRadius: mobileTheme.radius.md,
                                    backgroundColor: mobileTheme.color.bgApp,
                                    maxHeight: 210,
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingTop: 10,
                                      paddingBottom: 8,
                                      borderBottomWidth: 1,
                                      borderBottomColor: "rgba(61,70,82,0.5)",
                                    }}
                                  >
                                    <View
                                      style={{
                                        minHeight: 36,
                                        borderRadius: mobileTheme.radius.md,
                                        borderWidth: 1,
                                        borderColor: "rgba(61,70,82,0.8)",
                                        backgroundColor: "#1A1E25",
                                        paddingHorizontal: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <Feather name="search" size={13} color={mobileTheme.color.textSecondary} />
                                      <TextInput
                                        style={{
                                          flex: 1,
                                          minHeight: 34,
                                          color: mobileTheme.color.textPrimary,
                                          paddingHorizontal: 0,
                                          fontSize: 12,
                                        }}
                                        value={openAIModelFilter}
                                        onChangeText={setOpenAIModelFilter}
                                        placeholder="Filtrar modelos..."
                                        placeholderTextColor={mobileTheme.color.textSecondary}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                      />
                                    </View>
                                  </View>
                                  {openAIModelOptionsLoading ? (
                                    <View
                                      style={{
                                        minHeight: 64,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <ActivityIndicator size="small" color="#77A8FF" />
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        Cargando modelos de OpenAI...
                                      </Text>
                                    </View>
                                  ) : filteredOpenAIModelOptions.length === 0 ? (
                                    <View style={{ padding: 12 }}>
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        No hay modelos disponibles para mostrar.
                                      </Text>
                                    </View>
                                  ) : (
                                    <ScrollView nestedScrollEnabled>
                                      {filteredOpenAIModelOptions.map((modelOption) => {
                                        const selected = modelOption.id === draft.model.trim();
                                        return (
                                          <Pressable
                                            key={modelOption.id}
                                            onPress={() => {
                                              setActiveProvider(key.provider);
                                              selectOpenAIModel(modelOption.id);
                                            }}
                                            style={{
                                              minHeight: 46,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              borderBottomWidth: 1,
                                              borderBottomColor: "rgba(61,70,82,0.5)",
                                              backgroundColor: selected ? "rgba(69,141,255,0.16)" : "transparent",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                                              {modelOption.id}
                                            </Text>
                                            {modelOption.owned_by ? (
                                              <Text
                                                numberOfLines={1}
                                                style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}
                                              >
                                                {modelOption.owned_by}
                                              </Text>
                                            ) : null}
                                          </Pressable>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>
                              ) : null}

                              {openAIModelOptionsMessage ? (
                                <Text
                                  style={{
                                    color: providerDetailColorBySeverity(openAIModelOptionsMessage.severity),
                                    fontSize: 12,
                                  }}
                                >
                                  {openAIModelOptionsMessage.text}
                                </Text>
                              ) : null}
                            </View>
                          ) : key.provider === "google" ? (
                            <View style={{ gap: 8 }}>
                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  toggleGoogleModelDropdown();
                                }}
                                style={{
                                  minHeight: 44,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: mobileTheme.color.bgApp,
                                  paddingHorizontal: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                                  <Feather name="list" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text
                                    numberOfLines={1}
                                    style={{ color: mobileTheme.color.textPrimary, flex: 1 }}
                                  >
                                    {draft.model.trim() || DEFAULT_MODELS.google}
                                  </Text>
                                </View>
                                {googleModelOptionsLoading && googleModelDropdownOpen ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather
                                    name={googleModelDropdownOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={mobileTheme.color.textSecondary}
                                  />
                                )}
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setActiveProvider(key.provider);
                                  const googleApiKey = draft.api_key.trim();
                                  if (!googleApiKey) {
                                    setGoogleModelOptionsMessage({
                                      text: PROVIDER_STATUS_COPY.warningNoKey,
                                      severity: "warning",
                                    });
                                    return;
                                  }
                                  loadGoogleModelOptions(googleApiKey);
                                }}
                                style={{
                                  minHeight: 34,
                                  borderRadius: mobileTheme.radius.md,
                                  borderWidth: 1,
                                  borderColor: "rgba(69,141,255,0.35)",
                                  backgroundColor: "rgba(69,141,255,0.12)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexDirection: "row",
                                  gap: 6,
                                  paddingHorizontal: 10,
                                  alignSelf: "flex-start",
                                }}
                              >
                                {googleModelOptionsLoading ? (
                                  <ActivityIndicator size="small" color="#77A8FF" />
                                ) : (
                                  <Feather name="refresh-cw" size={12} color="#77A8FF" />
                                )}
                                <Text style={{ color: "#77A8FF", fontSize: 12, fontWeight: "700" }}>
                                  Actualizar modelos
                                </Text>
                              </Pressable>

                              {googleModelDropdownOpen ? (
                                <View
                                  style={{
                                    borderWidth: 1,
                                    borderColor: mobileTheme.color.borderSubtle,
                                    borderRadius: mobileTheme.radius.md,
                                    backgroundColor: mobileTheme.color.bgApp,
                                    maxHeight: 210,
                                  }}
                                >
                                  <View
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingTop: 10,
                                      paddingBottom: 8,
                                      borderBottomWidth: 1,
                                      borderBottomColor: "rgba(61,70,82,0.5)",
                                    }}
                                  >
                                    <View
                                      style={{
                                        minHeight: 36,
                                        borderRadius: mobileTheme.radius.md,
                                        borderWidth: 1,
                                        borderColor: "rgba(61,70,82,0.8)",
                                        backgroundColor: "#1A1E25",
                                        paddingHorizontal: 10,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <Feather name="search" size={13} color={mobileTheme.color.textSecondary} />
                                      <TextInput
                                        style={{
                                          flex: 1,
                                          minHeight: 34,
                                          color: mobileTheme.color.textPrimary,
                                          paddingHorizontal: 0,
                                          fontSize: 12,
                                        }}
                                        value={googleModelFilter}
                                        onChangeText={setGoogleModelFilter}
                                        placeholder="Filtrar modelos..."
                                        placeholderTextColor={mobileTheme.color.textSecondary}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                      />
                                    </View>
                                  </View>
                                  {googleModelOptionsLoading ? (
                                    <View
                                      style={{
                                        minHeight: 64,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                      }}
                                    >
                                      <ActivityIndicator size="small" color="#77A8FF" />
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        Cargando modelos de Google...
                                      </Text>
                                    </View>
                                  ) : filteredGoogleModelOptions.length === 0 ? (
                                    <View style={{ padding: 12 }}>
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                        No hay modelos disponibles para mostrar.
                                      </Text>
                                    </View>
                                  ) : (
                                    <ScrollView nestedScrollEnabled>
                                      {filteredGoogleModelOptions.map((modelOption) => {
                                        const selected = modelOption.id === draft.model.trim();
                                        return (
                                          <Pressable
                                            key={modelOption.id}
                                            onPress={() => {
                                              setActiveProvider(key.provider);
                                              selectGoogleModel(modelOption.id);
                                            }}
                                            style={{
                                              minHeight: 46,
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              borderBottomWidth: 1,
                                              borderBottomColor: "rgba(61,70,82,0.5)",
                                              backgroundColor: selected ? "rgba(69,141,255,0.16)" : "transparent",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                                              {modelOption.id}
                                            </Text>
                                            {modelOption.display_name ? (
                                              <Text
                                                numberOfLines={1}
                                                style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}
                                              >
                                                {modelOption.display_name}
                                              </Text>
                                            ) : null}
                                          </Pressable>
                                        );
                                      })}
                                    </ScrollView>
                                  )}
                                </View>
                              ) : null}

                              {googleModelOptionsMessage ? (
                                <Text
                                  style={{
                                    color: providerDetailColorBySeverity(googleModelOptionsMessage.severity),
                                    fontSize: 12,
                                  }}
                                >
                                  {googleModelOptionsMessage.text}
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            <TextInput
                              style={{
                                minHeight: 42,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: mobileTheme.color.borderSubtle,
                                backgroundColor: mobileTheme.color.bgApp,
                                color: mobileTheme.color.textPrimary,
                                paddingHorizontal: 12,
                              }}
                              value={draft.model}
                              onChangeText={(value) => updateProviderDraft(key.provider, { model: value })}
                              placeholder={`Modelo (default: ${DEFAULT_MODELS[key.provider]})`}
                              placeholderTextColor={mobileTheme.color.textSecondary}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          )
                        ) : null}
                      </View>
                    );
                  })}

                  {!secureStoreAvailable ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: "rgba(255,177,102,0.45)",
                        borderRadius: mobileTheme.radius.md,
                        backgroundColor: "rgba(255,177,102,0.08)",
                        padding: 10,
                      }}
                    >
                      <Text style={{ color: "#ffd7a8", fontSize: 12 }}>
                        SecureStore no disponible en este entorno. La API key se guardará en almacenamiento local
                        (AsyncStorage), sin cifrado seguro.
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={resetLocalData}
                    style={{
                      marginTop: 4,
                      height: 44,
                      borderRadius: mobileTheme.radius.md,
                      borderWidth: 1,
                      borderColor: "rgba(255,100,100,0.4)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#ffb5b5", fontWeight: "700" }}>Restablecer datos locales</Text>
                  </Pressable>
                </View>
              ) : null}

              {settingsTab === "memory" ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgSurface,
                    borderRadius: mobileTheme.radius.lg,
                    padding: 12,
                    gap: 12,
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>
                    Memoria del coach
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                    Datos personales que el coach recuerda entre conversaciones. Puedes editarlos o dejar que el coach los guarde cuando le compartas información.
                  </Text>

                  {memoryFields.map((field, index) => (
                    <View
                      key={`mem_${index}`}
                      style={{
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        borderRadius: mobileTheme.radius.md,
                        padding: 10,
                        gap: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <TextInput
                          style={{
                            flex: 1,
                            minHeight: 36,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: mobileTheme.color.bgSurface,
                            color: mobileTheme.color.textPrimary,
                            paddingHorizontal: 10,
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                          value={field.key}
                          onChangeText={(text) => updateMemoryField(index, "key", text)}
                          onBlur={commitMemoryField}
                          placeholder="Campo"
                          placeholderTextColor={mobileTheme.color.textSecondary}
                        />
                        <Pressable
                          onPress={() => deleteMemoryField(index)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: "rgba(255,77,79,0.15)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather name="trash-2" size={13} color="#FF4D4F" />
                        </Pressable>
                      </View>
                      <TextInput
                        style={{
                          minHeight: 36,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgSurface,
                          color: mobileTheme.color.textSecondary,
                          paddingHorizontal: 10,
                          fontSize: 12,
                        }}
                        value={field.description}
                        onChangeText={(text) => updateMemoryField(index, "description", text)}
                        onBlur={commitMemoryField}
                        placeholder="Descripción (para qué sirve este campo)"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                      />
                      <TextInput
                        style={{
                          minHeight: 36,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgSurface,
                          color: mobileTheme.color.textPrimary,
                          paddingHorizontal: 10,
                          fontSize: 13,
                        }}
                        value={field.value}
                        onChangeText={(text) => updateMemoryField(index, "value", text)}
                        onBlur={commitMemoryField}
                        placeholder="Valor"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                      />
                    </View>
                  ))}

                  <View style={{ borderTopWidth: 1, borderTopColor: mobileTheme.color.borderSubtle, paddingTop: 12, gap: 8 }}>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                      Añadir campo
                    </Text>
                    <TextInput
                      style={{
                        minHeight: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        color: mobileTheme.color.textPrimary,
                        paddingHorizontal: 10,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                      value={memoryNewKey}
                      onChangeText={setMemoryNewKey}
                      placeholder="Campo (ej: Nombre)"
                      placeholderTextColor={mobileTheme.color.textSecondary}
                    />
                    <TextInput
                      style={{
                        minHeight: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        color: mobileTheme.color.textSecondary,
                        paddingHorizontal: 10,
                        fontSize: 12,
                      }}
                      value={memoryNewDesc}
                      onChangeText={setMemoryNewDesc}
                      placeholder="Descripción (ej: Nombre real del usuario)"
                      placeholderTextColor={mobileTheme.color.textSecondary}
                    />
                    <TextInput
                      style={{
                        minHeight: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        color: mobileTheme.color.textPrimary,
                        paddingHorizontal: 10,
                        fontSize: 13,
                      }}
                      value={memoryNewValue}
                      onChangeText={setMemoryNewValue}
                      placeholder="Valor (ej: Juan)"
                      placeholderTextColor={mobileTheme.color.textSecondary}
                    />
                    <Pressable
                      onPress={addMemoryField}
                      disabled={!memoryNewKey.trim()}
                      style={{
                        height: 44,
                        borderRadius: mobileTheme.radius.md,
                        backgroundColor: memoryNewKey.trim() ? mobileTheme.color.brandPrimary : "#2F3440",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: memoryNewKey.trim() ? 1 : 0.5,
                      }}
                    >
                      <Text style={{ color: memoryNewKey.trim() ? "#06090D" : "#9AA2AE", fontWeight: "700" }}>
                        Añadir
                      </Text>
                    </Pressable>
                  </View>

                  {memoryFields.length > 0 ? (
                    <Pressable
                      onPress={() => {
                        Alert.alert("Borrar memoria", "¿Seguro que quieres eliminar todos los datos personales?", [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Eliminar todo",
                            style: "destructive",
                            onPress: async () => {
                              await saveMemoryFields([]);
                            },
                          },
                        ]);
                      }}
                      style={{
                        marginTop: 4,
                        height: 44,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: "rgba(255,100,100,0.4)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#ffb5b5", fontWeight: "700" }}>Borrar toda la memoria</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {settingsTab === "training" ? (
                <View style={{ gap: 16 }}>
                  {/* Routines section */}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgSurface,
                      borderRadius: mobileTheme.radius.lg,
                      padding: 12,
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>
                      Rutinas ({store.templates.length})
                    </Text>
                    {store.templates.length === 0 ? (
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                        No hay rutinas creadas.
                      </Text>
                    ) : (
                      store.templates.map((tpl) => {
                        const catLabel = TRAINING_CATEGORY_EDIT_OPTIONS.find((o) => o.key === tpl.category)?.label ?? "Sin categoría";
                        return (
                          <View
                            key={tpl.id}
                            style={{
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              borderRadius: mobileTheme.radius.md,
                              padding: 10,
                              gap: 6,
                            }}
                          >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 14 }}>
                                {tpl.name}
                              </Text>
                              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                                {catLabel}
                              </Text>
                            </View>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                              {tpl.exercises.length} ejercicio{tpl.exercises.length !== 1 ? "s" : ""}
                              {tpl.duration_minutes ? ` · ${tpl.duration_minutes} min` : ""}
                            </Text>
                            {tpl.exercises.length > 0 ? (
                              <View style={{ gap: 4, marginTop: 2 }}>
                                {tpl.exercises.map((ex, i) => {
                                  const totalSeries = ex.series?.length ?? ex.sets?.length ?? 0;
                                  return (
                                    <View key={ex.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                      {ex.image_uri ? (
                                        <Image
                                          source={{ uri: ex.image_uri }}
                                          style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#1a1a1a" }}
                                        />
                                      ) : (
                                        <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }}>
                                          <Text style={{ color: "#555", fontSize: 10 }}>{i + 1}</Text>
                                        </View>
                                      )}
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, flex: 1 }} numberOfLines={1}>
                                        {ex.name ?? `Ejercicio ${i + 1}`}
                                      </Text>
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                                        {totalSeries}×
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* Exercises repository section */}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgSurface,
                      borderRadius: mobileTheme.radius.lg,
                      padding: 12,
                      gap: 10,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>
                      Ejercicios ({exercisesRepo.length})
                    </Text>
                    {exercisesRepo.length === 0 ? (
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                        No se han cargado ejercicios del repositorio.
                      </Text>
                    ) : (
                      exercisesRepo.map((ex) => (
                        <Pressable
                          key={ex.id}
                          activeOpacity={0.7}
                          onPress={() => setSelectedExerciseDetail(ex)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 4,
                            borderBottomWidth: 1,
                            borderBottomColor: mobileTheme.color.borderSubtle,
                          }}
                        >
                          {ex.image_male ? (
                            <Image
                              source={{ uri: `${EXERCISES_REPO_BASE_URL}/${ex.image_male}` }}
                              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }}
                            />
                          ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                              {ex.name}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                              {ex.equipment || ""}
                            </Text>
                          </View>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>
                            {ex.muscle_group}
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                </View>
              ) : null}

              {/* Exercise detail overlay */}
              {selectedExerciseDetail ? (
                <View
                  style={{
                    backgroundColor: mobileTheme.color.cardBg,
                    borderRadius: 12,
                    padding: 16,
                    gap: 12,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18, flex: 1 }}>
                      {selectedExerciseDetail.name}
                    </Text>
                    <Pressable onPress={() => setSelectedExerciseDetail(null)} style={{ padding: 4 }}>
                      <Feather name="x" size={20} color={mobileTheme.color.textSecondary} />
                    </Pressable>
                  </View>

                  {selectedExerciseDetail.image_male ? (
                    <Image
                      source={{ uri: `${EXERCISES_REPO_BASE_URL}/${selectedExerciseDetail.image_male}` }}
                      style={{ width: "100%", height: 180, borderRadius: 10, backgroundColor: "#1a1a1a" }}
                      resizeMode="cover"
                    />
                  ) : null}

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[
                      selectedExerciseDetail.muscle_group,
                      ...(selectedExerciseDetail.secondary_muscles || []),
                    ].map((m) => (
                      <View
                        key={m}
                        style={{
                          backgroundColor: mobileTheme.color.accent + "22",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.accent, fontSize: 11, fontWeight: "600" }}>{m}</Text>
                      </View>
                    ))}
                    <View
                      style={{
                        backgroundColor: "#ffffff15",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                        {selectedExerciseDetail.equipment}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "#ffffff15",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                        {selectedExerciseDetail.difficulty}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 20 }}>
                    {selectedExerciseDetail.instructions}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {tab === "diet" ? (
        <View
          style={{
            position: "absolute",
            right: 20,
            bottom: 86,
          }}
        >
          <Pressable
            onPress={openFoodEstimatorModal}
            style={{
              width: 66,
              height: 66,
              borderRadius: 999,
              backgroundColor: mobileTheme.color.brandPrimary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: mobileTheme.color.brandPrimary,
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 9,
            }}
          >
            <Ionicons name="camera-outline" size={30} color="#06090D" />
          </Pressable>
        </View>
      ) : null}

      {tab === "training" &&
      !activeTrainingTemplate &&
      !activeWorkoutSession &&
      !showTrainingListSkeleton &&
      !showTrainingEditorSkeleton &&
      store.templates.length > 0 ? (
        <View
          style={{
            position: "absolute",
            right: mobileTheme.spacing[4],
            bottom: 74,
          }}
        >
          <Pressable
            onPress={createTrainingTemplate}
            style={{
              minHeight: 56,
              borderRadius: mobileTheme.radius.pill,
              backgroundColor: mobileTheme.color.brandPrimary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
              gap: 8,
              shadowColor: mobileTheme.color.brandPrimary,
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <Text style={{ color: "#06090D", fontSize: 24, fontWeight: "700", lineHeight: 26 }}>+</Text>
            <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "800" }}>Nueva rutina</Text>
          </Pressable>
        </View>
      ) : null}

      {measurementEntryScreenOpen ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: mobileTheme.color.bgApp,
            zIndex: 520,
            elevation: 52,
          }}
        >
          <View
            style={{
              paddingHorizontal: mobileTheme.spacing[4],
              paddingTop: mobileTheme.spacing[4],
              paddingBottom: 12,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgApp,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "800" }}>
                Registrar medidas
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                Guarda peso, foto y contornos sin salir de la pestaña `Medidas`.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={closeMeasurementEntryScreen}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={addMeasurementFromSettings}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: mobileTheme.radius.md,
                  backgroundColor: mobileTheme.color.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#06090D", fontWeight: "700" }}>Guardar medidas</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: mobileTheme.spacing[4],
              paddingTop: 14,
              paddingBottom: 36,
              gap: 12,
            }}
          >
            {error ? <Text style={{ color: "#ff8a8a" }}>{error}</Text> : null}

            <View
              style={{
                borderWidth: 1,
                borderColor: mobileTheme.color.borderSubtle,
                backgroundColor: mobileTheme.color.bgSurface,
                borderRadius: mobileTheme.radius.lg,
                padding: 12,
                gap: 12,
              }}
            >
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                Peso actual: {latestBodyWeightKg !== null ? `${latestBodyWeightKg.toFixed(2)} kg` : "Sin registrar"}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                Altura base:{" "}
                {latestBodyHeightCm !== null
                  ? `${formatMeasurementNumber(latestBodyHeightCm)} cm`
                  : "Sin registrar"}
              </Text>
              {latestWeightMeasurement ? (
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                  Última actualización: {formatMeasurementDate(latestWeightMeasurement.measured_at)}
                </Text>
              ) : null}

              <Pressable
                onPress={() => setShowMeasurementDatePicker(true)}
                style={{
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  borderRadius: mobileTheme.radius.md,
                  backgroundColor: mobileTheme.color.bgApp,
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                  Fecha: {formatMeasurementDate(measurementDate.toISOString())}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={mobileTheme.color.textSecondary} />
              </Pressable>

              {showMeasurementDatePicker ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: mobileTheme.color.bgApp,
                    padding: 8,
                    gap: 8,
                  }}
                >
                  <DateTimePicker
                    value={measurementDate}
                    mode="date"
                    maximumDate={new Date()}
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onMeasurementDateChange}
                  />
                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => setShowMeasurementDatePicker(false)}
                      style={{
                        height: 38,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgSurface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                        Cerrar calendario
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                  Foto de progreso
                </Text>
                {measurementPhotoUri ? (
                  <Image
                    source={{ uri: measurementPhotoUri }}
                    style={{
                      width: "100%",
                      height: 180,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.bgApp,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      minHeight: 92,
                      borderRadius: mobileTheme.radius.md,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgApp,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Sin foto seleccionada
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={pickMeasurementPhoto}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: mobileTheme.radius.md,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgApp,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "600" }}>
                      Seleccionar foto
                    </Text>
                  </Pressable>
                  {measurementPhotoUri ? (
                    <Pressable
                      onPress={() => setMeasurementPhotoUri(null)}
                      style={{
                        height: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600" }}>
                        Quitar
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="Peso corporal (kg)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={neckInput}
                onChangeText={setNeckInput}
                placeholder="Contorno cuello (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={chestInput}
                onChangeText={setChestInput}
                placeholder="Contorno pecho (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={waistInput}
                onChangeText={setWaistInput}
                placeholder="Contorno cintura (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={hipsInput}
                onChangeText={setHipsInput}
                placeholder="Contorno cadera (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={bicepsInput}
                onChangeText={setBicepsInput}
                placeholder="Contorno bíceps (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={quadricepsInput}
                onChangeText={setQuadricepsInput}
                placeholder="Contorno cuádriceps (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={calfInput}
                onChangeText={setCalfInput}
                placeholder="Contorno gemelo (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={{
                  minHeight: 42,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                }}
                value={heightInput}
                onChangeText={setHeightInput}
                placeholder="Altura (cm)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                keyboardType="decimal-pad"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={closeMeasurementEntryScreen}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgApp,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={addMeasurementFromSettings}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>Guardar medidas</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      ) : null}

      {foodEstimatorModalOpen ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.76)",
            paddingHorizontal: 14,
            paddingVertical: 18,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 610,
            elevation: 61,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "95%",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "#12151C",
              paddingHorizontal: 12,
              paddingTop: 12,
              paddingBottom: 10,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
                Estimar con IA
              </Text>
              <Pressable
                onPress={closeFoodEstimatorModal}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="x" size={16} color={mobileTheme.color.textSecondary} />
              </Pressable>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: mobileTheme.color.borderSubtle,
                borderRadius: mobileTheme.radius.md,
                backgroundColor: mobileTheme.color.bgApp,
                padding: 10,
                gap: 4,
              }}
            >
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                Proveedor estimador:{" "}
                {foodEstimatorProvider
                  ? PROVIDER_UI_META[foodEstimatorProvider.provider].label
                  : "Sin API key disponible"}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                Cada vez que abres este panel se inicia una conversación nueva.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={addFoodEstimatorImageFromLibrary}
                disabled={foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                  opacity: foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES ? 0.6 : 1,
                }}
              >
                <Ionicons name="image-outline" size={16} color={mobileTheme.color.textPrimary} />
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Subir foto</Text>
              </Pressable>
              <Pressable
                onPress={addFoodEstimatorImageFromCamera}
                disabled={foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES}
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                  opacity: foodEstimatorImages.length >= FOOD_ESTIMATOR_MAX_IMAGES ? 0.6 : 1,
                }}
              >
                <Ionicons name="camera-outline" size={16} color={mobileTheme.color.textPrimary} />
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Cámara</Text>
              </Pressable>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                Fotos adjuntas: {foodEstimatorImages.length}/{FOOD_ESTIMATOR_MAX_IMAGES}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {foodEstimatorImages.length === 0 ? (
                  <View
                    style={{
                      minHeight: 74,
                      minWidth: 210,
                      borderRadius: mobileTheme.radius.md,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgApp,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Añade fotos para mejorar la estimación.
                    </Text>
                  </View>
                ) : (
                  foodEstimatorImages.map((image) => (
                    <View
                      key={image.id}
                      style={{
                        width: 78,
                        height: 78,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        overflow: "hidden",
                        backgroundColor: mobileTheme.color.bgApp,
                      }}
                    >
                      <Image source={{ uri: image.uri }} style={{ width: "100%", height: "100%" }} />
                      <Pressable
                        onPress={() => removeFoodEstimatorImage(image.id)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          backgroundColor: "rgba(0,0,0,0.65)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name="x" size={11} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: mobileTheme.color.borderSubtle,
                borderRadius: mobileTheme.radius.md,
                backgroundColor: mobileTheme.color.bgApp,
                minHeight: 180,
                maxHeight: 260,
                padding: 8,
              }}
            >
              <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
                {foodEstimatorMessages.map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  return (
                    <View
                      key={msg.id}
                      style={{
                        alignSelf: isAssistant ? "flex-start" : "flex-end",
                        maxWidth: "92%",
                        borderWidth: 1,
                        borderColor: isAssistant
                          ? mobileTheme.color.borderSubtle
                          : "rgba(203,255,26,0.45)",
                        backgroundColor: isAssistant
                          ? mobileTheme.color.bgSurface
                          : "rgba(203,255,26,0.08)",
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, lineHeight: 19 }}>
                        {msg.content}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <TextInput
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
                value={foodEstimatorInput}
                onChangeText={setFoodEstimatorInput}
                placeholder="Describe la comida o pide ajustes..."
                placeholderTextColor={mobileTheme.color.textSecondary}
                multiline
              />
              <Pressable
                onPress={() => {
                  void sendFoodEstimatorMessage();
                }}
                disabled={foodEstimatorSending}
                style={{
                  minWidth: 92,
                  height: 44,
                  borderRadius: mobileTheme.radius.md,
                  backgroundColor: mobileTheme.color.brandPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: foodEstimatorSending ? 0.7 : 1,
                }}
              >
                <Text style={{ color: "#06090D", fontWeight: "800" }}>
                  {foodEstimatorSending ? "Enviando..." : "Enviar"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                void addFoodFromEstimatorJSON();
              }}
              disabled={!foodEstimatorHasLLMResponse || foodEstimatorSending || !dietMealEditorCategory}
              style={{
                minHeight: 42,
                borderRadius: mobileTheme.radius.md,
                borderWidth: 1,
                borderColor: foodEstimatorHasLLMResponse && dietMealEditorCategory
                  ? "rgba(203,255,26,0.45)"
                  : mobileTheme.color.borderSubtle,
                backgroundColor: foodEstimatorHasLLMResponse && dietMealEditorCategory
                  ? "rgba(203,255,26,0.12)"
                  : mobileTheme.color.bgApp,
                alignItems: "center",
                justifyContent: "center",
                opacity:
                  !foodEstimatorHasLLMResponse || foodEstimatorSending || !dietMealEditorCategory
                    ? 0.65
                    : 1,
              }}
            >
              <Text
                style={{
                  color: foodEstimatorHasLLMResponse && dietMealEditorCategory
                    ? mobileTheme.color.brandPrimary
                    : mobileTheme.color.textSecondary,
                  fontWeight: "700",
                }}
              >
                Añadir alimento
              </Text>
            </Pressable>
            {!dietMealEditorCategory ? (
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                Abre primero "Añadir alimento" en una comida para rellenar los campos desde IA.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {providerDeleteModal ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.78)",
            paddingHorizontal: 24,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 620,
            elevation: 62,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "#12151C",
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 16,
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: "rgba(255,77,79,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="alert-triangle" size={22} color="#FF4D4F" />
            </View>

            <Text
              style={{
                color: mobileTheme.color.textPrimary,
                fontSize: 40,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              ¿Eliminar API Key?
            </Text>

            <Text
              style={{
                color: "#A1AAB8",
                fontSize: 14,
                lineHeight: 21,
                textAlign: "center",
              }}
            >
              Estás a punto de eliminar la API Key de {PROVIDER_UI_META[providerDeleteModal.provider].label}. Esta
              acción no se puede deshacer.
            </Text>

            <View
              style={{
                width: "100%",
                borderWidth: 1,
                borderColor: "rgba(255,77,79,0.45)",
                borderRadius: 12,
                backgroundColor: "rgba(255,77,79,0.14)",
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <Feather name="alert-circle" size={14} color="#FF6E6E" style={{ marginTop: 2 }} />
              <Text
                style={{
                  flex: 1,
                  color: "#FF6E6E",
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {providerDeleteWarningText(providerDeleteModal.provider)}
              </Text>
            </View>

            <View
              style={{
                width: "100%",
                minHeight: 38,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(61,70,82,0.9)",
                backgroundColor: "#1A1E25",
                paddingHorizontal: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Feather name="key" size={13} color="#778091" />
              <Text style={{ color: "#9EA7B6", fontSize: 13, fontWeight: "600" }}>
                {providerDeleteModal.maskedApiKey}
              </Text>
            </View>

            <Pressable
              onPress={confirmDeleteProviderApiKey}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 14,
                backgroundColor: "#FF4D4F",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Feather name="trash-2" size={14} color="#FFE8EB" />
              <Text style={{ color: "#FFE8EB", fontWeight: "800", fontSize: 16 }}>
                Sí, eliminar clave
              </Text>
            </Pressable>

            <Pressable
              onPress={closeProviderDeleteModal}
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
                backgroundColor: "#1B1F27",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#E7EBF3", fontSize: 16, fontWeight: "700" }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {workoutCompletionModal ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.72)",
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 600,
            elevation: 60,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 370,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "#12151C",
              paddingHorizontal: 20,
              paddingTop: 22,
              paddingBottom: 16,
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 70,
                height: 70,
                borderRadius: 999,
                backgroundColor: "rgba(0,198,107,0.22)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trophy-outline" size={30} color="#00D06E" />
            </View>

            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 42, fontWeight: "800" }}>
              ¡Sesión completada!
            </Text>

            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 42, fontWeight: "800" }}>
                  {formatClock(workoutCompletionModal.summary.elapsed_seconds)}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 25, fontWeight: "600" }}>Duración</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 42, fontWeight: "800" }}>
                  {workoutCompletionModal.summary.completed_series_count}/
                  {workoutCompletionModal.summary.total_series_count}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 25, fontWeight: "600" }}>Series</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 42, fontWeight: "800" }}>
                  {workoutCompletionModal.summary.estimated_calories}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 25, fontWeight: "600" }}>Calorías</Text>
              </View>
            </View>

            <View
              style={{
                width: "100%",
                height: 1,
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            />

            {workoutCompletionModal.has_template_changes ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="sync-outline" size={20} color="#F5C542" />
                  <Text style={{ color: "#F5C542", fontSize: 20, fontWeight: "700" }}>
                    Cambios detectados
                  </Text>
                </View>
                <Text
                  style={{
                    color: "#9CA6B5",
                    fontSize: 16,
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  Has modificado reps y peso en algunas series. ¿Aplicar esos cambios a la rutina futura?
                </Text>

                <Pressable
                  onPress={closeWorkoutCompletionModal}
                  testID="training-complete-apply-changes"
                  style={{
                    width: "100%",
                    minHeight: 52,
                    borderRadius: 14,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Feather name="check" size={16} color="#06090D" />
                  <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "800" }}>
                    Sí, actualizar rutina
                  </Text>
                </Pressable>

                <Pressable
                  onPress={revertWorkoutTemplateChangesAfterSession}
                  testID="training-complete-revert-changes"
                  style={{
                    width: "100%",
                    minHeight: 52,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    backgroundColor: "#1A1F28",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#E5EAF3", fontSize: 22, fontWeight: "700" }}>
                    No, mantener la original
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: "#9CA6B5",
                    fontSize: 16,
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  Buen trabajo. La sesión quedó registrada correctamente.
                </Text>
                <Pressable
                  onPress={closeWorkoutCompletionModal}
                  testID="training-complete-close"
                  style={{
                    width: "100%",
                    minHeight: 52,
                    borderRadius: 14,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "800" }}>Cerrar</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      ) : null}

      {exerciseDetailIndex !== null && (() => {
        const ex = activeTrainingDetailExercises[exerciseDetailIndex];
        if (!ex) return null;
        return (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#06090D",
              zIndex: 200,
            }}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ position: "relative" }}>
                  {ex.imageUri ? (
                    <Image
                      source={{ uri: ex.imageUri }}
                      style={{ width: "100%", aspectRatio: 16 / 10 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        aspectRatio: 16 / 10,
                        backgroundColor: ex.previewMeta.backgroundColor,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name={ex.previewMeta.icon} size={64} color={ex.previewMeta.accentColor} />
                    </View>
                  )}
                  <Pressable
                    onPress={() => setExerciseDetailIndex(null)}
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.14)",
                      backgroundColor: "rgba(8,11,16,0.48)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="arrow-left" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={{ padding: 20, gap: 16 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "700" }}>
                    {ex.exerciseName}
                  </Text>
                  {ex.muscle ? (
                    <View style={{ flexDirection: "row" }}>
                      <View
                        style={{
                          minHeight: 44,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.06)",
                          backgroundColor: "#171B23",
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Feather name="target" size={14} color={mobileTheme.color.brandPrimary} />
                        <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                          {ex.muscle}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {ex.instructions ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
                        Instrucciones
                      </Text>
                      <Text style={{ color: "#8B94A3", fontSize: 15, lineHeight: 22 }}>
                        {ex.instructions}
                      </Text>
                    </View>
                  ) : null}
                  {ex.seriesItems.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>
                        Series
                      </Text>
                      <View
                        style={{
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.06)",
                          backgroundColor: "#171B23",
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.06)",
                            backgroundColor: "#1C212A",
                          }}
                        >
                          <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", width: 40, textAlign: "center" }}>#</Text>
                          <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Reps</Text>
                          <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Peso</Text>
                          <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Descanso</Text>
                        </View>
                        {ex.seriesItems.map((s: ExerciseSeries, sIdx: number) => (
                          <View
                            key={s.id}
                            style={{
                              flexDirection: "row",
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderBottomWidth: sIdx < ex.seriesItems.length - 1 ? 1 : 0,
                              borderBottomColor: "rgba(255,255,255,0.04)",
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700", width: 40, textAlign: "center" }}>
                              {sIdx + 1}
                            </Text>
                            <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>
                              {s.reps.trim() || "--"}
                            </Text>
                            <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>
                              {s.weight_kg.trim() ? `${s.weight_kg.trim()} kg` : "--"}
                            </Text>
                            <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>
                              {s.rest_seconds.trim() ? `${s.rest_seconds.trim()}s` : "--"}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
          </View>
        );
      })()}

      {exercisePickerOpen ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "#0D1117",
            zIndex: 700,
            elevation: 70,
          }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
              <Pressable onPress={() => setExercisePickerOpen(false)} style={{ padding: 6 }}>
                <Feather name="arrow-left" size={24} color={mobileTheme.color.textPrimary} />
              </Pressable>
              <Text style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
                Seleccionar ejercicio
              </Text>
            </View>

            <View style={{ paddingHorizontal: 14, marginBottom: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#171B23",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  paddingHorizontal: 12,
                  minHeight: 44,
                  gap: 8,
                }}
              >
                <Feather name="search" size={16} color="#778091" />
                <TextInput
                  style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 16 }}
                  placeholder="Buscar ejercicio..."
                  placeholderTextColor="#5A6270"
                  value={exercisePickerSearch}
                  onChangeText={setExercisePickerSearch}
                  autoCapitalize="none"
                />
                {exercisePickerSearch ? (
                  <Pressable onPress={() => setExercisePickerSearch("")}>
                    <Feather name="x" size={16} color="#778091" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 42, marginBottom: 8, paddingHorizontal: 14 }} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
              <Pressable
                onPress={() => setExercisePickerMuscleFilter("all")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: mobileTheme.radius.pill,
                  borderWidth: 1,
                  borderColor: exercisePickerMuscleFilter === "all" ? "rgba(203,255,26,0.82)" : mobileTheme.color.borderSubtle,
                  backgroundColor: exercisePickerMuscleFilter === "all" ? "rgba(160,204,0,0.12)" : "#0D1117",
                }}
              >
                <Text style={{ color: exercisePickerMuscleFilter === "all" ? mobileTheme.color.brandPrimary : "#9EA6B3", fontSize: 14, fontWeight: "600" }}>
                  Todos
                </Text>
              </Pressable>
              {exercisePickerMuscleGroups.map((muscle) => {
                const isActive = exercisePickerMuscleFilter === muscle;
                return (
                  <Pressable
                    key={muscle}
                    onPress={() => setExercisePickerMuscleFilter(isActive ? "all" : muscle)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: mobileTheme.radius.pill,
                      borderWidth: 1,
                      borderColor: isActive ? "rgba(203,255,26,0.82)" : mobileTheme.color.borderSubtle,
                      backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                    }}
                  >
                    <Text style={{ color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3", fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>
                      {muscle}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView style={{ flex: 1, paddingHorizontal: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              {filteredExercisePickerEntries.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => addExerciseFromRepo(entry)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#171B23",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <Image
                    source={{ uri: getExerciseImageUrl(entry, "male") }}
                    style={{ width: 90, height: 70, backgroundColor: "#091219" }}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
                      {entry.name}
                    </Text>
                    <Text style={{ color: "#778091", fontSize: 13, textTransform: "capitalize" }}>
                      {entry.muscle_group}{entry.equipment ? ` · ${entry.equipment}` : ""}
                    </Text>
                  </View>
                  <Feather name="plus" size={20} color={mobileTheme.color.brandPrimary} style={{ marginRight: 14 }} />
                </Pressable>
              ))}

              {filteredExercisePickerEntries.length === 0 && exercisesRepo.length > 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 30 }}>
                  <Text style={{ color: "#5A6270", fontSize: 15 }}>No se encontraron ejercicios</Text>
                </View>
              ) : null}

              {exercisesRepo.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 30 }}>
                  <ActivityIndicator color={mobileTheme.color.brandPrimary} size="small" />
                  <Text style={{ color: "#5A6270", fontSize: 14, marginTop: 8 }}>Cargando ejercicios...</Text>
                </View>
              ) : null}

              <Pressable
                onPress={addBlankExerciseToActiveTemplate}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(203,255,26,0.08)",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(203,255,26,0.3)",
                  minHeight: 54,
                  gap: 8,
                }}
              >
                <Feather name="edit-3" size={18} color={mobileTheme.color.brandPrimary} />
                <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 16, fontWeight: "700" }}>
                  Crear ejercicio personalizado
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      ) : null}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
