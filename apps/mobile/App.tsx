import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import ConfettiCannon from "react-native-confetti-cannon";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
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
type SettingsTabKey = "diet" | "provider" | "memory" | "training" | "foods" | "personalFoods" | "measures" | "preferences";

type SeriesType =
  | "normal"
  | "warmup"
  | "failure"
  | "amrap"
  | "partial"
  | "negative"
  | "forced"
  | "tempo"
  | "isometric"
  | "dropset"
  | "restpause"
  | "myoreps"
  | "cluster"
  | "superset";

type SubSeries = {
  id: string;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
  exercise_name?: string;
  exercise_id?: string;
};

type ExerciseSeries = {
  id: string;
  type?: SeriesType;
  reps: string;
  weight_kg: string;
  rest_seconds: string;
  tempo_contraction?: string;
  tempo_pause?: string;
  tempo_relaxation?: string;
  sub_series?: SubSeries[];
};

const COMPOUND_SERIES_TYPES: SeriesType[] = ["dropset", "restpause", "myoreps", "cluster", "superset"];
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
type DietGoal = "bulk" | "cut" | "maintain";
type ActivityLevel = "moderate" | "intermediate" | "high";
type UserSex = "male" | "female";
type DietSettings = {
  goal: DietGoal;
  activity_level?: ActivityLevel;
  sex?: UserSex;
  height_cm?: string;
  birth_date?: string;
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
  thinking?: string | null;
  is_streaming?: boolean;
  created_at: string;
};
type AnthropicChatResult = { content: string; thinking: string | null };
type OpenAIReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
type OpenAIReasoningSummaryPart = { type: "summary_text"; text: string };
type OpenAIReasoningOutputItem = {
  type: "reasoning";
  id?: string;
  summary?: OpenAIReasoningSummaryPart[];
};
type OpenAIMessageOutputItem = {
  type: "message";
  id?: string;
  content?: Array<{ type: "output_text"; text: string }>;
};
type OpenAIFunctionCallOutputItem = {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
  status?: string;
};
type OpenAIResponseOutputItem =
  | OpenAIReasoningOutputItem
  | OpenAIMessageOutputItem
  | OpenAIFunctionCallOutputItem;
type OpenAIStreamTurnResult = AnthropicChatResult & {
  responseId: string | null;
  outputItems: OpenAIResponseOutputItem[];
};
type Provider = "anthropic" | "openai" | "google";
type AIKey = {
  provider: Provider;
  is_active: boolean;
  api_key: string;
  model: string;
  reasoning_effort?: OpenAIReasoningEffort | null;
};
type ProviderDraft = {
  api_key: string;
  model: string;
  reasoning_effort?: OpenAIReasoningEffort | null;
};
type AnthropicModelOption = { id: string; display_name: string | null };
type StreamingHandlers = {
  onContentDelta?: (delta: string, aggregate: string) => void;
  onThinkingDelta?: (delta: string, aggregate: string) => void;
};
type ChatProviderCallOptions = StreamingHandlers & {
  setStore?: React.Dispatch<React.SetStateAction<LocalStore>>;
};
type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicThinkingBlock = { type: "thinking"; thinking: string; signature?: string };
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  partial_json?: string;
};
type AnthropicResponseBlock = AnthropicTextBlock | AnthropicThinkingBlock | AnthropicToolUseBlock;
type AnthropicStreamTurnResult = AnthropicChatResult & {
  contentBlocks: AnthropicResponseBlock[];
  stopReason: string | null;
};
type GoogleFunctionCall = { name: string; args?: Record<string, unknown> };
type GoogleResponsePart = {
  text?: string;
  functionCall?: GoogleFunctionCall;
  thought?: boolean;
  thoughtSignature?: string;
};
type GoogleStreamTurnResult = AnthropicChatResult & {
  modelParts: GoogleResponsePart[];
  finishReason: string | null;
};
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
type UserPreferences = {
  chartPeriod: MeasuresDashboardPeriodKey;
  chartMetric?: MeasuresChartMetricKey;
};
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
  chatProvider?: Provider;
  foodAIProvider?: Provider;
};

const STORAGE_KEY = "gymnasia.mobile.local.v3";
const SESSION_STORAGE_KEY = "gymnasia.mobile.training.session.v1";
const CHAT_SYSTEM_PROMPT_CACHE_KEY = "gymnasia.mobile.chat.system_prompt.v1";
const PERSONAL_DATA_STORAGE_KEY = "gymnasia.mobile.personal_data.v1";
const USER_PREFS_STORAGE_KEY = "gymnasia.mobile.user_prefs.v1";
const DEFAULT_USER_PREFS: UserPreferences = { chartPeriod: "3m" };
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
  openai: "gpt-5-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-3-flash-preview",
};
const LEGACY_OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const LEGACY_GOOGLE_DEFAULT_MODEL = "gemini-1.5-flash";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_THINKING_BUDGET = 1024;
const DEFAULT_OPENAI_REASONING_EFFORT: OpenAIReasoningEffort = "medium";
const OPENAI_REASONING_SUMMARY = "detailed";
const OPENAI_REASONING_EFFORT_OPTIONS: OpenAIReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];
const OPENAI_REASONING_EFFORT_LABELS: Record<OpenAIReasoningEffort, string> = {
  none: "Ninguno",
  minimal: "Minimo",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Muy alto",
};
const PROVIDERS: Provider[] = ["openai", "anthropic", "google"];
const FOOD_ESTIMATOR_PROVIDER_PRIORITY: Provider[] = ["google", "openai", "anthropic"];
const FOOD_ESTIMATOR_MAX_IMAGES = 6;
const EXERCISES_REPO_BASE_URL =
  "https://raw.githubusercontent.com/maximofn/gymnasia/main/ejercicios";
const EXERCISES_ALL_URL = `${EXERCISES_REPO_BASE_URL}/all.json`;
const EXERCISES_CACHE_KEY = "gymnasia.mobile.exercises_repo.v2";
const FOODS_REPO_BASE_URL =
  "https://raw.githubusercontent.com/maximofn/gymnasia/main/alimentos";
const FOODS_ALL_URL = `${FOODS_REPO_BASE_URL}/all.json`;
const FOODS_CACHE_KEY = "gymnasia.mobile.foods_repo.v1";
const PERSONAL_FOODS_STORAGE_KEY = "gymnasia.mobile.personal_foods.v1";

function normalizeProviderModel(provider: Provider, rawModel: string | null | undefined): string {
  const trimmed = (rawModel ?? "").trim();
  const model = trimmed || DEFAULT_MODELS[provider];
  if (provider === "openai" && model === LEGACY_OPENAI_DEFAULT_MODEL) {
    return DEFAULT_MODELS.openai;
  }
  if (provider === "google" && model === LEGACY_GOOGLE_DEFAULT_MODEL) {
    return DEFAULT_MODELS.google;
  }
  return model;
}

function getSupportedOpenAIReasoningEfforts(rawModel: string | null | undefined): OpenAIReasoningEffort[] {
  const model = normalizeProviderModel("openai", rawModel).trim().toLowerCase();
  if (!model) return ["minimal", "low", "medium", "high"];
  if (model.startsWith("gpt-5.4-pro")) return ["medium", "high", "xhigh"];
  if (model.startsWith("gpt-5-pro")) return ["high"];
  if (
    model.startsWith("gpt-5.4")
    || model.startsWith("gpt-5.3")
    || model.startsWith("gpt-5.2")
  ) {
    return ["none", "low", "medium", "high", "xhigh"];
  }
  if (model.startsWith("gpt-5.1")) return ["none", "low", "medium", "high"];
  if (model.startsWith("gpt-5")) return ["minimal", "low", "medium", "high"];
  if (model.startsWith("o")) return ["low", "medium", "high"];
  return [];
}

function normalizeOpenAIReasoningEffort(
  rawEffort: string | null | undefined,
  rawModel: string | null | undefined,
): OpenAIReasoningEffort | null {
  const supported = getSupportedOpenAIReasoningEfforts(rawModel);
  if (supported.length === 0) return null;
  const normalized = (rawEffort ?? "").trim().toLowerCase();
  const candidate = OPENAI_REASONING_EFFORT_OPTIONS.find((effort) => effort === normalized);
  if (candidate && supported.includes(candidate)) {
    return candidate;
  }
  if (supported.includes(DEFAULT_OPENAI_REASONING_EFFORT)) {
    return DEFAULT_OPENAI_REASONING_EFFORT;
  }
  return supported[0] ?? null;
}

// --- Dev-store file persistence (web only) ---
// Reads/writes store JSON via Metro middleware so data survives server restarts.
const DEV_STORE_ENDPOINT = "/dev-store";

async function loadDevStoreFile(): Promise<string | null> {
  if (Platform.OS !== "web" || !__DEV__) return null;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}${DEV_STORE_ENDPOINT}`);
    if (res.status === 200) {
      const text = await res.text();
      if (text && text !== "{}") return text;
    }
  } catch {}
  return null;
}

async function saveDevStoreFile(json: string): Promise<void> {
  if (Platform.OS !== "web" || !__DEV__) return;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await fetch(`${origin}${DEV_STORE_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
  } catch {}
}

const SERIES_TYPE_META: Record<SeriesType, { label: string; short: string; color?: string }> = {
  normal:    { label: "Normal",         short: "N" },
  warmup:    { label: "Calentamiento",  short: "🔥", color: "#FF4A4A" },
  failure:   { label: "Al fallo",       short: "F" },
  amrap:     { label: "AMRAP",          short: "A" },
  partial:   { label: "Parcial",        short: "P" },
  negative:  { label: "Negativa",       short: "—" },
  forced:    { label: "Forzada",        short: "F+" },
  tempo:     { label: "Tempo",          short: "T" },
  isometric: { label: "Isométrica",     short: "I" },
  dropset:   { label: "Drop set",       short: "DS" },
  restpause: { label: "Rest-Pause",     short: "RP" },
  myoreps:   { label: "Myo-Reps",       short: "MR" },
  cluster:   { label: "Cluster",        short: "CL" },
  superset:  { label: "Superserie",     short: "SS" },
};
const ALL_SERIES_TYPES = Object.keys(SERIES_TYPE_META) as SeriesType[];

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
  "IMPORTANTE: Si detectas un código de barras (EAN, UPC) en alguna de las imágenes, DEBES usar la herramienta scan_barcode para buscar el producto. " +
  "Lee los dígitos del código de barras de la imagen y pásalos como parámetro. Con los datos de OpenFoodFacts, presenta la información nutricional exacta del producto. " +
  "Si el usuario pide 'Devuelve json' o 'Devuelve el json', responde únicamente con JSON válido y sin texto adicional, " +
  "con estas claves exactas: dish_name, calories_kcal, protein_g, carbs_g, fat_g. " +
  "Cuando el usuario pregunte o debata, responde usando el contexto previo de la conversación y las fotos adjuntas.";
const FOOD_AI_SYSTEM_PROMPT =
  "Eres un nutricionista experto. El usuario te va a decir un alimento, plato o receta. " +
  "Tu objetivo es determinar los valores nutricionales exactos por unidad base (100g, 1ml, 1 unidad, etc.). " +
  "Flujo: 1) El usuario te dice un alimento, plato o receta. " +
  "2) Si necesitas más datos (ingredientes, cantidades, modo de preparación), pregúntale. " +
  "3) Cuando tengas toda la información, calcula los valores nutricionales. " +
  "4) Presenta los valores al usuario y pregúntale si son correctos. " +
  "5) Cuando el usuario confirme, devuelve EXACTAMENTE un bloque JSON con este formato:\n" +
  "```json\n" +
  '{"name":"Nombre del alimento","category":"categoría","calories_per_100g":0,"protein_per_100g":0,' +
  '"carbs_per_100g":0,"fat_per_100g":0,"fiber_per_100g":0,"serving_size_g":0,"serving_description":"descripción de ración"}\n' +
  "```\n" +
  "Categorías válidas: proteína, carbohidrato, grasa, fruta, verdura, lácteo, legumbre, fruto-seco, receta, suplemento, bebida, otro. " +
  "Responde siempre en español. Sé conciso pero preciso.";
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

type FoodRepoEntry = {
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
};

async function loadFoodsRepo(): Promise<FoodRepoEntry[]> {
  try {
    const response = await fetch(`${FOODS_ALL_URL}?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`Foods fetch error (${response.status})`);
    const foods: FoodRepoEntry[] = await response.json();
    AsyncStorage.setItem(FOODS_CACHE_KEY, JSON.stringify(foods)).catch(() => {});
    return foods;
  } catch {
    try {
      const cached = await AsyncStorage.getItem(FOODS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
      return [];
    } catch {
      return [];
    }
  }
}

async function loadPersonalFoods(): Promise<FoodRepoEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_FOODS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}

async function savePersonalFoods(foods: FoodRepoEntry[]): Promise<void> {
  await AsyncStorage.setItem(PERSONAL_FOODS_STORAGE_KEY, JSON.stringify(foods));
}

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

async function loadMeasurementsFromStorage(): Promise<Measurement[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.measurements) ? parsed.measurements : [];
  } catch {
    return [];
  }
}

async function saveMeasurementsToStorage(measurements: Measurement[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.measurements = measurements;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* silently fail — component useEffect will persist next cycle */
  }
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

const READ_MEASUREMENT_TOOL = "read_measurement";
const READ_MEASUREMENT_DESC =
  "Lee las medidas corporales del usuario para una fecha específica. " +
  "Devuelve el registro de medidas de ese día (peso, contornos, altura) si existe, o un mensaje indicando que no hay registro. " +
  "Usa esta herramienta cuando el usuario pregunte por sus medidas de un día concreto.";
const READ_MEASUREMENT_PARAM_DESC =
  "Fecha en formato YYYY-MM-DD (por ejemplo: 2026-03-30)";

const WRITE_MEASUREMENT_TOOL = "write_measurement";
const WRITE_MEASUREMENT_DESC =
  "Guarda o actualiza las medidas corporales del usuario para una fecha específica. " +
  "Usa esta herramienta cuando el usuario te diga sus medidas (peso, contornos, altura). " +
  "Solo incluye en el JSON los campos que el usuario proporcione; los demás se mantendrán como null.";
const WRITE_MEASUREMENT_DATE_PARAM_DESC =
  "Fecha en formato YYYY-MM-DD (por ejemplo: 2026-03-30)";
const WRITE_MEASUREMENT_DATA_PARAM_DESC =
  'JSON con las medidas a guardar. Campos posibles: weight_kg, neck_cm, chest_cm, waist_cm, hips_cm, biceps_cm, quadriceps_cm, calf_cm, height_cm. ' +
  'Ejemplo: {"weight_kg": 75.5, "waist_cm": 82}';

const SCAN_BARCODE_TOOL = "scan_barcode";
const SCAN_BARCODE_DESC =
  "Busca un producto alimentario por su código de barras (EAN/UPC) en OpenFoodFacts. " +
  "Usa esta herramienta cuando detectes un código de barras en la imagen del usuario. " +
  "Lee los dígitos del código de barras de la imagen y pásalos como parámetro.";
const SCAN_BARCODE_PARAM_DESC = "El número del código de barras (EAN-13, UPC-A, etc.)";

async function lookupBarcode(barcode: string): Promise<string> {
  const cleaned = barcode.replace(/\s/g, "");
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json`,
  );
  if (!response.ok) return `Error al buscar código de barras: HTTP ${response.status}`;
  const data = await response.json();
  if (data.status !== 1 || !data.product)
    return `Producto no encontrado para el código de barras "${cleaned}". Intenta estimar visualmente la comida.`;
  const p = data.product;
  const n = p.nutriments ?? {};
  return JSON.stringify({
    name: p.product_name ?? "Desconocido",
    brands: p.brands ?? "",
    quantity: p.quantity ?? "",
    serving_size: p.serving_size ?? "",
    per_100g: {
      calories_kcal: n["energy-kcal_100g"] ?? null,
      fat_g: n.fat_100g ?? null,
      saturated_fat_g: n["saturated-fat_100g"] ?? null,
      carbs_g: n.carbohydrates_100g ?? null,
      sugars_g: n.sugars_100g ?? null,
      protein_g: n.proteins_100g ?? null,
      fiber_g: n.fiber_100g ?? null,
      salt_g: n.salt_100g ?? null,
    },
    per_serving: {
      calories_kcal: n["energy-kcal_serving"] ?? null,
      fat_g: n.fat_serving ?? null,
      carbs_g: n.carbohydrates_serving ?? null,
      protein_g: n.proteins_serving ?? null,
    },
    ingredients_text: p.ingredients_text ?? "",
    nutriscore_grade: p.nutriscore_grade ?? "",
  });
}

async function handleFoodEstimatorToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === SCAN_BARCODE_TOOL) {
    const barcode = (args.barcode as string) ?? "";
    if (!barcode) return "No se proporcionó un código de barras.";
    return lookupBarcode(barcode);
  }
  return "Herramienta no reconocida.";
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  setStore?: React.Dispatch<React.SetStateAction<LocalStore>>,
): Promise<string> {
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
  if (name === READ_MEASUREMENT_TOOL) {
    const date = (args.date as string) ?? "";
    if (!date) return "No se proporcionó una fecha.";
    const measurements = await loadMeasurementsFromStorage();
    const match = measurements.find((m) => m.measured_at.startsWith(date));
    if (!match) return `No hay registro de medidas para la fecha "${date}".`;
    const { id, photo_uri, ...data } = match;
    return JSON.stringify(data);
  }
  if (name === WRITE_MEASUREMENT_TOOL) {
    const date = (args.date as string) ?? "";
    if (!date) return "No se proporcionó una fecha.";
    let data: Record<string, unknown> = {};
    if (typeof args.data === "string") {
      try { data = JSON.parse(args.data); } catch { return "El JSON de medidas no es válido."; }
    } else if (typeof args.data === "object" && args.data) {
      data = args.data as Record<string, unknown>;
    } else {
      return "No se proporcionaron medidas.";
    }
    const measurements = await loadMeasurementsFromStorage();
    const existingIdx = measurements.findIndex((m) => m.measured_at.startsWith(date));
    const existing = existingIdx >= 0 ? measurements[existingIdx] : null;
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isFinite(n) && n > 0 ? n : null;
    };
    const measurement: Measurement = {
      id: existing?.id ?? uid("measurement"),
      measured_at: existing?.measured_at ?? new Date(date + "T12:00:00").toISOString(),
      weight_kg: data.weight_kg !== undefined ? toNum(data.weight_kg) : (existing?.weight_kg ?? null),
      photo_uri: existing?.photo_uri ?? null,
      neck_cm: data.neck_cm !== undefined ? toNum(data.neck_cm) : (existing?.neck_cm ?? null),
      chest_cm: data.chest_cm !== undefined ? toNum(data.chest_cm) : (existing?.chest_cm ?? null),
      waist_cm: data.waist_cm !== undefined ? toNum(data.waist_cm) : (existing?.waist_cm ?? null),
      hips_cm: data.hips_cm !== undefined ? toNum(data.hips_cm) : (existing?.hips_cm ?? null),
      biceps_cm: data.biceps_cm !== undefined ? toNum(data.biceps_cm) : (existing?.biceps_cm ?? null),
      quadriceps_cm: data.quadriceps_cm !== undefined ? toNum(data.quadriceps_cm) : (existing?.quadriceps_cm ?? null),
      calf_cm: data.calf_cm !== undefined ? toNum(data.calf_cm) : (existing?.calf_cm ?? null),
      height_cm: data.height_cm !== undefined ? toNum(data.height_cm) : (existing?.height_cm ?? null),
    };
    const base = existingIdx >= 0 ? measurements.filter((_, i) => i !== existingIdx) : measurements;
    const sorted = sortMeasurementsDesc([measurement, ...base]).slice(0, 1826);
    await saveMeasurementsToStorage(sorted);
    if (setStore) {
      setStore((prev) => ({ ...prev, measurements: sorted }));
    }
    return "Medidas guardadas correctamente para " + date + ".";
  }
  return "Herramienta no reconocida.";
}

function resolveProviderByPriority(keys: AIKey[], priority: Provider[]): AIKey | null {
  for (const provider of priority) {
    const configured = keys.find((item) => item.provider === provider);
    if (!configured) continue;
    const apiKey = configured.api_key.trim();
    if (!apiKey) continue;
    return {
      ...configured,
      api_key: apiKey,
      model: normalizeProviderModel(provider, configured.model),
    };
  }
  return null;
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
      model: normalizeProviderModel(provider, configured.model),
    };
  }
  return null;
}

function createDefaultProviderKeys(): AIKey[] {
  return [
    {
      provider: "openai",
      is_active: true,
      api_key: "",
      model: DEFAULT_MODELS.openai,
      reasoning_effort: DEFAULT_OPENAI_REASONING_EFFORT,
    },
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
    const model = normalizeProviderModel(provider, current?.model);
    acc[provider] = {
      api_key: current?.api_key ?? "",
      model,
      reasoning_effort:
        provider === "openai"
          ? normalizeOpenAIReasoningEffort(current?.reasoning_effort, model)
          : null,
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
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "1 año" },
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
type MeasuresChartMetricKey = "weight" | "bodyFat" | "chest" | "waist" | "hips" | "biceps" | "neck" | "quadriceps" | "calf";
const MEASURES_CHART_METRIC_OPTIONS: Array<{
  key: MeasuresChartMetricKey;
  label: string;
  unit: string;
  field: keyof Measurement | null;
}> = [
  { key: "weight", label: "Peso", unit: "kg", field: "weight_kg" },
  { key: "bodyFat", label: "% Grasa", unit: "%", field: null },
  { key: "chest", label: "Pecho", unit: "cm", field: "chest_cm" },
  { key: "waist", label: "Cintura", unit: "cm", field: "waist_cm" },
  { key: "hips", label: "Cadera", unit: "cm", field: "hips_cm" },
  { key: "biceps", label: "Brazo", unit: "cm", field: "biceps_cm" },
  { key: "neck", label: "Cuello", unit: "cm", field: "neck_cm" },
  { key: "quadriceps", label: "Cuádriceps", unit: "cm", field: "quadriceps_cm" },
  { key: "calf", label: "Gemelo", unit: "cm", field: "calf_cm" },
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
  { key: "foods", label: "Alimentos" },
  { key: "personalFoods", label: "Alimentos personales" },
  { key: "measures", label: "Medidas" },
  { key: "preferences", label: "Preferencias" },
];

const DIET_GOAL_OPTIONS: Array<{ key: DietGoal; label: string }> = [
  { key: "bulk", label: "Volumen" },
  { key: "cut", label: "Definición" },
  { key: "maintain", label: "Mantenimiento" },
];

const ACTIVITY_LEVEL_OPTIONS: Array<{ key: ActivityLevel; label: string }> = [
  { key: "moderate", label: "Moderada" },
  { key: "intermediate", label: "Intermedia" },
  { key: "high", label: "Alta" },
];

function createDefaultDietSettings(): DietSettings {
  return {
    goal: "maintain",
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
      "anthropic-version": ANTHROPIC_API_VERSION,
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
): Promise<AnthropicChatResult> {
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
        max_tokens: 700 + ANTHROPIC_THINKING_BUDGET,
        thinking: { type: "enabled", budget_tokens: ANTHROPIC_THINKING_BUDGET },
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

    const result = parseAnthropicContent(payload);
    if (!result) throw new Error("Anthropic no devolvio contenido.");
    return result;
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

  const model = normalizeProviderModel(provider.provider, provider.model);
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
        "anthropic-version": ANTHROPIC_API_VERSION,
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
  const responseResult = parseOpenAIResponseResult(payload);
  if (responseResult?.content) {
    return responseResult.content;
  }
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

function normalizeOpenAIFunctionCallArguments(rawArguments: unknown): string {
  if (typeof rawArguments === "string") return rawArguments;
  if (rawArguments && typeof rawArguments === "object") {
    try {
      return JSON.stringify(rawArguments);
    } catch {
      return "";
    }
  }
  return "";
}

function normalizeOpenAIResponseOutputItem(rawItem: unknown): OpenAIResponseOutputItem | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as {
    type?: string;
    id?: string;
    summary?: Array<{ type?: string; text?: string }>;
    content?: Array<{ type?: string; text?: string }>;
    call_id?: string;
    name?: string;
    arguments?: unknown;
    status?: string;
  };

  if (item.type === "reasoning") {
    const summary = Array.isArray(item.summary)
      ? item.summary
          .filter(
            (part): part is OpenAIReasoningSummaryPart =>
              part?.type === "summary_text" && typeof part.text === "string",
          )
          .map((part) => ({ type: "summary_text" as const, text: part.text }))
      : undefined;
    return {
      type: "reasoning",
      id: typeof item.id === "string" ? item.id : undefined,
      summary,
    };
  }

  if (item.type === "message") {
    const content = Array.isArray(item.content)
      ? item.content
          .filter(
            (part): part is { type: "output_text"; text: string } =>
              part?.type === "output_text" && typeof part.text === "string",
          )
          .map((part) => ({ type: "output_text" as const, text: part.text }))
      : undefined;
    return {
      type: "message",
      id: typeof item.id === "string" ? item.id : undefined,
      content,
    };
  }

  if (
    item.type === "function_call"
    && typeof item.id === "string"
    && typeof item.call_id === "string"
    && typeof item.name === "string"
  ) {
    return {
      type: "function_call",
      id: item.id,
      call_id: item.call_id,
      name: item.name,
      arguments: normalizeOpenAIFunctionCallArguments(item.arguments),
      status: typeof item.status === "string" ? item.status : undefined,
    };
  }

  return null;
}

function parseOpenAIResponseOutputItems(payload: unknown): OpenAIResponseOutputItem[] {
  if (!payload || typeof payload !== "object") return [];
  const maybe = payload as { output?: unknown[] };
  if (!Array.isArray(maybe.output)) return [];
  return maybe.output
    .map((item) => normalizeOpenAIResponseOutputItem(item))
    .filter((item): item is OpenAIResponseOutputItem => Boolean(item));
}

function collectOpenAIOutputText(outputItems: OpenAIResponseOutputItem[]): string | null {
  const text = outputItems
    .filter((item): item is OpenAIMessageOutputItem => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

function collectOpenAIThinking(outputItems: OpenAIResponseOutputItem[]): string | null {
  const thinking = outputItems
    .filter((item): item is OpenAIReasoningOutputItem => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .filter((part) => part.type === "summary_text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return thinking || null;
}

function parseOpenAIFunctionArguments(rawArguments: string): Record<string, unknown> {
  const trimmed = rawArguments.trim();
  if (!trimmed) return {};
  const parsed = parseJsonSafely<unknown>(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function buildOpenAIReasoningConfig(
  provider: Pick<AIKey, "model" | "reasoning_effort">,
): { effort: OpenAIReasoningEffort; summary: string } | null {
  const effort = normalizeOpenAIReasoningEffort(provider.reasoning_effort, provider.model);
  if (!effort) return null;
  return {
    effort,
    summary: OPENAI_REASONING_SUMMARY,
  };
}

function parseOpenAIResponseResult(payload: unknown): AnthropicChatResult | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as { output_text?: string | null };
  const outputItems = parseOpenAIResponseOutputItems(payload);
  const content =
    collectOpenAIOutputText(outputItems)
    ?? (typeof maybe.output_text === "string" ? maybe.output_text.trim() : null);
  const thinking = collectOpenAIThinking(outputItems);
  if (!content && !thinking) return null;
  return { content: content ?? "", thinking };
}

function parseAnthropicContent(payload: unknown): AnthropicChatResult | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as {
    content?: Array<{ type?: string; text?: string; thinking?: string }>;
  };
  const blocks = maybe.content ?? [];
  const text = blocks
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n");
  const thinking = blocks
    .filter((part) => part?.type === "thinking" && typeof part.thinking === "string")
    .map((part) => part.thinking?.trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return null;
  return { content: text, thinking: thinking || null };
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseAnthropicToolInput(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = parseJsonSafely<unknown>(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

function normalizeGoogleFunctionArgs(rawArgs: unknown): Record<string, unknown> {
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }
  if (typeof rawArgs === "string") {
    const parsed = parseJsonSafely<unknown>(rawArgs);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

function mapGoogleResponsePartToRequestPart(part: GoogleResponsePart): Record<string, unknown> | null {
  const nextPart: Record<string, unknown> = {};
  if (typeof part.text === "string") {
    nextPart.text = part.text;
  }
  if (part.functionCall) {
    nextPart.functionCall = {
      name: part.functionCall.name,
      args: part.functionCall.args ?? {},
    };
  }
  if (part.thought === true) {
    nextPart.thought = true;
  }
  if (typeof part.thoughtSignature === "string" && part.thoughtSignature.trim().length > 0) {
    nextPart.thoughtSignature = part.thoughtSignature;
  }
  return Object.keys(nextPart).length > 0 ? nextPart : null;
}

function splitSSEEvents(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const boundary = normalized.indexOf("\n\n", cursor);
    if (boundary === -1) break;
    events.push(normalized.slice(cursor, boundary));
    cursor = boundary + 2;
  }
  return { events, rest: normalized.slice(cursor) };
}

function parseSSEEvent(rawEvent: string): { event: string; data: string | null } | null {
  const trimmed = rawEvent.trim();
  if (!trimmed) return null;

  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of trimmed.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value || eventName;
    if (field === "data") dataLines.push(value);
  }
  return {
    event: eventName,
    data: dataLines.length > 0 ? dataLines.join("\n") : null,
  };
}

function createAnthropicStreamParser(
  handlers?: StreamingHandlers,
): {
  push: (chunk: string) => void;
  finish: () => AnthropicStreamTurnResult;
} {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let stopReason: string | null = null;
  const blocks = new Map<number, AnthropicResponseBlock>();

  const processEvent = (parsedEvent: { event: string; data: string | null }) => {
    if (!parsedEvent.data) return;
    const payload = parseJsonSafely<{
      type?: string;
      index?: number;
      delta?: {
        type?: string;
        text?: string;
        thinking?: string;
        signature?: string;
        partial_json?: string;
      };
      content_block?: {
        type?: string;
        text?: string;
        thinking?: string;
        signature?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      };
      error?: { message?: string };
      message?: { stop_reason?: string | null };
    }>(parsedEvent.data);
    if (!payload || typeof payload !== "object") return;

    const payloadType = typeof payload.type === "string" ? payload.type : parsedEvent.event;
    if (payloadType === "error" || parsedEvent.event === "error") {
      throw new Error(extractErrorMessage(payload, "Anthropic stream error"));
    }

    if (payloadType === "content_block_start") {
      const index = typeof payload.index === "number" ? payload.index : -1;
      if (index < 0 || !payload.content_block) return;
      const block = payload.content_block;
      if (block.type === "text") {
        blocks.set(index, { type: "text", text: typeof block.text === "string" ? block.text : "" });
      } else if (block.type === "thinking") {
        blocks.set(index, {
          type: "thinking",
          thinking: typeof block.thinking === "string" ? block.thinking : "",
          signature: typeof block.signature === "string" ? block.signature : undefined,
        });
      } else if (block.type === "tool_use") {
        blocks.set(index, {
          type: "tool_use",
          id: typeof block.id === "string" ? block.id : "",
          name: typeof block.name === "string" ? block.name : "",
          input:
            block.input && typeof block.input === "object" && !Array.isArray(block.input)
              ? block.input
              : {},
          partial_json: "",
        });
      }
      return;
    }

    if (payloadType === "content_block_delta") {
      const index = typeof payload.index === "number" ? payload.index : -1;
      const block = blocks.get(index);
      if (!block || !payload.delta) return;
      if (payload.delta.type === "text_delta" && block.type === "text") {
        const nextText = typeof payload.delta.text === "string" ? payload.delta.text : "";
        if (!nextText) return;
        block.text += nextText;
        streamedContent += nextText;
        handlers?.onContentDelta?.(nextText, streamedContent);
        return;
      }
      if (payload.delta.type === "thinking_delta" && block.type === "thinking") {
        const nextThinking =
          typeof payload.delta.thinking === "string" ? payload.delta.thinking : "";
        if (!nextThinking) return;
        block.thinking += nextThinking;
        streamedThinking += nextThinking;
        handlers?.onThinkingDelta?.(nextThinking, streamedThinking);
        return;
      }
      if (payload.delta.type === "signature_delta" && block.type === "thinking") {
        block.signature =
          typeof payload.delta.signature === "string" ? payload.delta.signature : block.signature;
        return;
      }
      if (payload.delta.type === "input_json_delta" && block.type === "tool_use") {
        const partialJson =
          typeof payload.delta.partial_json === "string" ? payload.delta.partial_json : "";
        block.partial_json = (block.partial_json ?? "") + partialJson;
      }
      return;
    }

    if (payloadType === "content_block_stop") {
      const index = typeof payload.index === "number" ? payload.index : -1;
      const block = blocks.get(index);
      if (block?.type === "tool_use") {
        block.input = parseAnthropicToolInput(block.partial_json ?? "");
      }
      return;
    }

    if (payloadType === "message_delta") {
      stopReason =
        payload.message?.stop_reason ??
        (payload as { delta?: { stop_reason?: string | null } }).delta?.stop_reason ??
        stopReason;
    }
  };

  const processChunk = (chunk: string) => {
    if (!chunk) return;
    rawBuffer += chunk;
    const { events, rest } = splitSSEEvents(rawBuffer);
    rawBuffer = rest;
    events.forEach((eventChunk) => {
      const parsedEvent = parseSSEEvent(eventChunk);
      if (!parsedEvent) return;
      processEvent(parsedEvent);
    });
  };

  return {
    push: processChunk,
    finish: () => {
      if (rawBuffer.trim()) {
        const parsedEvent = parseSSEEvent(rawBuffer);
        if (parsedEvent) processEvent(parsedEvent);
        rawBuffer = "";
      }
      const contentBlocks = Array.from(blocks.entries())
        .sort(([left], [right]) => left - right)
        .map(([, block]) =>
          block.type === "tool_use"
            ? {
                type: "tool_use" as const,
                id: block.id,
                name: block.name,
                input: block.input,
              }
            : block,
        );

      return {
        content: streamedContent.trim(),
        thinking: streamedThinking.trim() || null,
        contentBlocks,
        stopReason,
      };
    },
  };
}

async function streamAnthropicRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Anthropic.",
  statusFallbackPrefix = "Anthropic error",
): Promise<AnthropicStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createAnthropicStreamParser(handlers);
    let lastOffset = 0;
    let settled = false;

    const cleanup = () => {
      xhr.onreadystatechange = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const resolveOnce = (result: AnthropicStreamTurnResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const processPendingResponseText = () => {
      const fullText = xhr.responseText ?? "";
      const nextText = fullText.slice(lastOffset);
      lastOffset = fullText.length;
      if (nextText) parser.push(nextText);
    };

    xhr.open("POST", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Anthropic."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con Anthropic."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Anthropic."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolveOnce(parser.finish());
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de Anthropic."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(
      JSON.stringify({
        ...body,
        stream: true,
      }),
    );
  });
}

function createOpenAIStreamParser(
  handlers?: StreamingHandlers,
): {
  push: (chunk: string) => void;
  finish: () => OpenAIStreamTurnResult;
} {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let responseId: string | null = null;
  const outputItemsByIndex = new Map<number, OpenAIResponseOutputItem>();
  const outputIndexesByItemId = new Map<string, number>();

  const setOutputItem = (outputIndex: number, item: OpenAIResponseOutputItem) => {
    outputItemsByIndex.set(outputIndex, item);
    if ("id" in item && typeof item.id === "string" && item.id.trim().length > 0) {
      outputIndexesByItemId.set(item.id, outputIndex);
    }
  };

  const replaceOutputItems = (items: OpenAIResponseOutputItem[]) => {
    outputItemsByIndex.clear();
    outputIndexesByItemId.clear();
    items.forEach((item, index) => {
      setOutputItem(index, item);
    });
  };

  const updateFunctionCallArguments = (
    itemId: string,
    updater: (currentArguments: string) => string,
  ) => {
    const outputIndex = outputIndexesByItemId.get(itemId);
    if (typeof outputIndex !== "number") return;
    const currentItem = outputItemsByIndex.get(outputIndex);
    if (!currentItem || currentItem.type !== "function_call") return;
    setOutputItem(outputIndex, {
      ...currentItem,
      arguments: updater(currentItem.arguments),
    });
  };

  const processEvent = (parsedEvent: { event: string; data: string | null }) => {
    if (!parsedEvent.data || parsedEvent.data.trim() === "[DONE]") return;
    const payload = parseJsonSafely<{
      type?: string;
      delta?: string;
      arguments?: string;
      item_id?: string;
      output_index?: number;
      item?: unknown;
      error?: { message?: string };
      response?: {
        id?: string;
        output?: unknown[];
        error?: { message?: string };
      };
    }>(parsedEvent.data);
    if (!payload || typeof payload !== "object") return;

    const payloadType = typeof payload.type === "string" ? payload.type : parsedEvent.event;
    if (payloadType === "error" || parsedEvent.event === "error") {
      throw new Error(extractErrorMessage(payload, "OpenAI stream error"));
    }
    if (payloadType === "response.failed") {
      throw new Error(
        payload.response?.error?.message
        ?? extractErrorMessage(payload, "OpenAI stream error"),
      );
    }

    if (payloadType === "response.created" || payloadType === "response.in_progress") {
      responseId = payload.response?.id ?? responseId;
      return;
    }

    if (payloadType === "response.output_text.delta") {
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      if (!delta) return;
      streamedContent += delta;
      handlers?.onContentDelta?.(delta, streamedContent);
      return;
    }

    if (payloadType === "response.reasoning_summary_text.delta") {
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      if (!delta) return;
      streamedThinking += delta;
      handlers?.onThinkingDelta?.(delta, streamedThinking);
      return;
    }

    if (payloadType === "response.output_item.added" || payloadType === "response.output_item.done") {
      const outputIndex = typeof payload.output_index === "number" ? payload.output_index : null;
      if (typeof outputIndex !== "number") return;
      const item = normalizeOpenAIResponseOutputItem(payload.item);
      if (!item) return;
      setOutputItem(outputIndex, item);
      return;
    }

    if (payloadType === "response.function_call_arguments.delta") {
      const itemId = typeof payload.item_id === "string" ? payload.item_id : "";
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      if (!itemId || !delta) return;
      updateFunctionCallArguments(itemId, (currentArguments) => currentArguments + delta);
      return;
    }

    if (payloadType === "response.function_call_arguments.done") {
      const itemId = typeof payload.item_id === "string" ? payload.item_id : "";
      const argumentsText = typeof payload.arguments === "string" ? payload.arguments : "";
      if (!itemId) return;
      updateFunctionCallArguments(itemId, () => argumentsText);
      return;
    }

    if (payloadType === "response.completed") {
      responseId = payload.response?.id ?? responseId;
      const finalOutputItems = parseOpenAIResponseOutputItems(payload.response);
      if (finalOutputItems.length > 0) {
        replaceOutputItems(finalOutputItems);
      }
    }
  };

  const processChunk = (chunk: string) => {
    if (!chunk) return;
    rawBuffer += chunk;
    const { events, rest } = splitSSEEvents(rawBuffer);
    rawBuffer = rest;
    events.forEach((eventChunk) => {
      const parsedEvent = parseSSEEvent(eventChunk);
      if (!parsedEvent) return;
      processEvent(parsedEvent);
    });
  };

  return {
    push: processChunk,
    finish: () => {
      if (rawBuffer.trim()) {
        const parsedEvent = parseSSEEvent(rawBuffer);
        if (parsedEvent) processEvent(parsedEvent);
        rawBuffer = "";
      }

      const outputItems = Array.from(outputItemsByIndex.entries())
        .sort(([left], [right]) => left - right)
        .map(([, item]) => item);
      const content = streamedContent.trim() || collectOpenAIOutputText(outputItems) || "";
      const thinking = streamedThinking.trim() || collectOpenAIThinking(outputItems) || null;

      return {
        responseId,
        content,
        thinking,
        outputItems,
      };
    },
  };
}

async function streamOpenAIRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con OpenAI.",
  statusFallbackPrefix = "OpenAI error",
): Promise<OpenAIStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createOpenAIStreamParser(handlers);
    let lastOffset = 0;
    let settled = false;

    const cleanup = () => {
      xhr.onreadystatechange = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const resolveOnce = (result: OpenAIStreamTurnResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const processPendingResponseText = () => {
      const fullText = xhr.responseText ?? "";
      const nextText = fullText.slice(lastOffset);
      lastOffset = fullText.length;
      if (nextText) parser.push(nextText);
    };

    xhr.open("POST", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de OpenAI."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con OpenAI."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de OpenAI."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolveOnce(parser.finish());
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de OpenAI."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(
      JSON.stringify({
        ...body,
        stream: true,
      }),
    );
  });
}

async function streamOpenAIRequestViaFetch(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con OpenAI.",
  statusFallbackPrefix = "OpenAI error",
): Promise<OpenAIStreamTurnResult> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, 120000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...body,
        stream: true,
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      const payload = parseJsonSafely<unknown>(rawText);
      throw new Error(
        extractErrorMessage(payload, rawText || `${statusFallbackPrefix} (${response.status})`),
      );
    }

    const parser = createOpenAIStreamParser(handlers);
    const reader = response.body?.getReader();
    if (!reader) {
      const rawText = await response.text().catch(() => "");
      if (rawText) parser.push(rawText);
      return parser.finish();
    }

    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      parser.push(decoder.decode(value, { stream: true }));
    }

    const remaining = decoder.decode();
    if (remaining) parser.push(remaining);
    return parser.finish();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al conectar con OpenAI.");
    }
    if (err instanceof Error && err.message.trim()) {
      throw err;
    }
    throw new Error(networkFallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

function createGoogleStreamParser(
  handlers?: StreamingHandlers,
): {
  push: (chunk: string) => void;
  finish: () => GoogleStreamTurnResult;
} {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let finishReason: string | null = null;
  const modelParts: GoogleResponsePart[] = [];

  const processEvent = (parsedEvent: { event: string; data: string | null }) => {
    if (!parsedEvent.data) return;
    if (parsedEvent.data.trim() === "[DONE]") return;
    const payload = parseJsonSafely<{
      candidates?: Array<{
        finishReason?: string;
        finish_reason?: string;
        content?: {
          parts?: Array<{
            text?: string;
            thought?: boolean;
            thoughtSignature?: string;
            thought_signature?: string;
            functionCall?: { name?: string; args?: unknown };
            function_call?: { name?: string; args?: unknown };
          }>;
        };
      }>;
      error?: { message?: string };
    }>(parsedEvent.data);
    if (!payload || typeof payload !== "object") return;
    if (payload.error) {
      throw new Error(extractErrorMessage(payload, "Google AI stream error"));
    }

    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    candidates.forEach((candidate) => {
      const candidateFinishReason = candidate?.finishReason ?? candidate?.finish_reason;
      if (typeof candidateFinishReason === "string" && candidateFinishReason.trim().length > 0) {
        finishReason = candidateFinishReason;
      }
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      parts.forEach((rawPart) => {
        if (!rawPart || typeof rawPart !== "object") return;
        const thought = rawPart.thought === true;
        const thoughtSignature =
          typeof rawPart.thoughtSignature === "string"
            ? rawPart.thoughtSignature
            : typeof rawPart.thought_signature === "string"
              ? rawPart.thought_signature
              : undefined;
        const functionCall =
          rawPart.functionCall && typeof rawPart.functionCall === "object"
            ? rawPart.functionCall
            : rawPart.function_call && typeof rawPart.function_call === "object"
              ? rawPart.function_call
              : null;
        const text = typeof rawPart.text === "string" ? rawPart.text : undefined;

        if (typeof text === "string" && text.length > 0) {
          if (thought) {
            streamedThinking += text;
            handlers?.onThinkingDelta?.(text, streamedThinking);
          } else {
            streamedContent += text;
            handlers?.onContentDelta?.(text, streamedContent);
          }
        }

        if (functionCall) {
          const name = typeof functionCall.name === "string" ? functionCall.name.trim() : "";
          if (!name) return;
          modelParts.push({
            functionCall: {
              name,
              args: normalizeGoogleFunctionArgs(functionCall.args),
            },
            thought,
            thoughtSignature,
          });
          return;
        }

        if ((typeof text === "string" && text.length > 0) || thoughtSignature) {
          const nextPart: GoogleResponsePart = {};
          if (typeof text === "string") nextPart.text = text;
          if (thought) nextPart.thought = true;
          if (thoughtSignature) nextPart.thoughtSignature = thoughtSignature;
          modelParts.push(nextPart);
        }
      });
    });
  };

  const processChunk = (chunk: string) => {
    if (!chunk) return;
    rawBuffer += chunk;
    const { events, rest } = splitSSEEvents(rawBuffer);
    rawBuffer = rest;
    events.forEach((eventChunk) => {
      const parsedEvent = parseSSEEvent(eventChunk);
      if (!parsedEvent) return;
      processEvent(parsedEvent);
    });
  };

  return {
    push: processChunk,
    finish: () => {
      if (rawBuffer.trim()) {
        const parsedEvent = parseSSEEvent(rawBuffer);
        if (parsedEvent) processEvent(parsedEvent);
        rawBuffer = "";
      }
      return {
        content: streamedContent.trim(),
        thinking: streamedThinking.trim() || null,
        modelParts,
        finishReason,
      };
    },
  };
}

async function streamGoogleRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Google AI.",
  statusFallbackPrefix = "Google AI error",
): Promise<GoogleStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createGoogleStreamParser(handlers);
    let lastOffset = 0;
    let settled = false;

    const cleanup = () => {
      xhr.onreadystatechange = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const resolveOnce = (result: GoogleStreamTurnResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const processPendingResponseText = () => {
      const fullText = xhr.responseText ?? "";
      const nextText = fullText.slice(lastOffset);
      lastOffset = fullText.length;
      if (nextText) parser.push(nextText);
    };

    xhr.open("POST", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Google AI."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con Google AI."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Google AI."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolveOnce(parser.finish());
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de Google AI."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(JSON.stringify(body));
  });
}

async function streamGoogleRequestViaFetch(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Google AI.",
  statusFallbackPrefix = "Google AI error",
): Promise<GoogleStreamTurnResult> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, 120000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      const payload = parseJsonSafely<unknown>(rawText);
      throw new Error(
        extractErrorMessage(payload, rawText || `${statusFallbackPrefix} (${response.status})`),
      );
    }

    const parser = createGoogleStreamParser(handlers);
    const reader = response.body?.getReader();
    if (!reader) {
      const rawText = await response.text().catch(() => "");
      if (rawText) parser.push(rawText);
      return parser.finish();
    }

    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      parser.push(decoder.decode(value, { stream: true }));
    }

    const remaining = decoder.decode();
    if (remaining) parser.push(remaining);
    return parser.finish();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al conectar con Google AI.");
    }
    if (err instanceof Error && err.message.trim()) {
      throw err;
    }
    throw new Error(networkFallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseGoogleContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  };
  const text = (maybe.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part?.thought !== true)
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
    const reasoning = buildOpenAIReasoningConfig(provider);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: normalizeProviderModel("openai", provider.model),
        instructions: systemPrompt,
        input: nonSystemMessages,
        ...(reasoning ? { reasoning } : {}),
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

    const result = parseOpenAIResponseResult(payload);
    if (!result?.content) throw new Error("OpenAI no devolvio contenido.");
    return result.content;
  }

  if (provider.provider === "anthropic") {
    if (Platform.OS === "web") {
      const webResult = await callAnthropicViaWebProxy(provider, systemPrompt, nonSystemMessages);
      return webResult.content;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 700 + ANTHROPIC_THINKING_BUDGET,
        thinking: { type: "enabled", budget_tokens: ANTHROPIC_THINKING_BUDGET },
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

    const result = parseAnthropicContent(payload);
    if (!result) throw new Error("Anthropic no devolvio contenido.");
    return result.content;
  }

  const googleMessages = nonSystemMessages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeProviderModel("google", provider.model))}:generateContent?key=${encodeURIComponent(provider.api_key)}`,
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
async function callProviderChatAPIWithTools(
  provider: AIKey,
  messages: ChatInputMessage[],
  options?: ChatProviderCallOptions,
): Promise<AnthropicChatResult> {
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
  const dateParam = { date: { type: "string" as const, description: READ_MEASUREMENT_PARAM_DESC } };
  const dateRequired = ["date"];
  const writeMeasurementProps = {
    date: { type: "string" as const, description: WRITE_MEASUREMENT_DATE_PARAM_DESC },
    data: { type: "string" as const, description: WRITE_MEASUREMENT_DATA_PARAM_DESC },
  };
  const writeMeasurementRequired = ["date", "data"];
  const toolStoreSetter = options?.setStore;

  const chatTools = {
    openai: [
      {
        type: "function",
        name: SAVE_PERSONAL_DATA_TOOL,
        description: SAVE_PERSONAL_DATA_DESC,
        parameters: {
          type: "object",
          properties: { personal_data: { type: "string", description: SAVE_PERSONAL_DATA_PARAM_DESC } },
          required: ["personal_data"],
        },
      },
      {
        type: "function",
        name: LIST_KEYS_TOOL,
        description: LIST_KEYS_DESC,
        parameters: { type: "object", properties: {}, required: [] },
      },
      {
        type: "function",
        name: READ_DESCRIPTION_TOOL,
        description: READ_DESCRIPTION_DESC,
        parameters: { type: "object", properties: { key: { type: "string", description: READ_DESCRIPTION_PARAM_DESC } }, required: keyRequired },
      },
      {
        type: "function",
        name: READ_VALUE_TOOL,
        description: READ_VALUE_DESC,
        parameters: { type: "object", properties: { key: { type: "string", description: READ_VALUE_PARAM_DESC } }, required: keyRequired },
      },
      {
        type: "function",
        name: READ_MEASUREMENT_TOOL,
        description: READ_MEASUREMENT_DESC,
        parameters: { type: "object", properties: dateParam, required: dateRequired },
      },
      {
        type: "function",
        name: WRITE_MEASUREMENT_TOOL,
        description: WRITE_MEASUREMENT_DESC,
        parameters: { type: "object", properties: writeMeasurementProps, required: writeMeasurementRequired },
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
      {
        name: READ_MEASUREMENT_TOOL,
        description: READ_MEASUREMENT_DESC,
        input_schema: { type: "object", properties: dateParam, required: dateRequired },
      },
      {
        name: WRITE_MEASUREMENT_TOOL,
        description: WRITE_MEASUREMENT_DESC,
        input_schema: { type: "object", properties: writeMeasurementProps, required: writeMeasurementRequired },
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
          {
            name: READ_MEASUREMENT_TOOL,
            description: READ_MEASUREMENT_DESC,
            parameters: { type: "object", properties: dateParam, required: dateRequired },
          },
          {
            name: WRITE_MEASUREMENT_TOOL,
            description: WRITE_MEASUREMENT_DESC,
            parameters: { type: "object", properties: writeMeasurementProps, required: writeMeasurementRequired },
          },
        ],
      },
    ],
  };

  // --- OPENAI ---
  if (provider.provider === "openai") {
    let streamedContent = "";
    let streamedThinking = "";
    const model = normalizeProviderModel("openai", provider.model);
    const reasoning = buildOpenAIReasoningConfig(provider);
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options?.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options?.onThinkingDelta?.(delta, streamedThinking);
      },
    };

    const makeOpenAIRequest = async (
      input: Array<Record<string, unknown>>,
      previousResponseId: string | null,
      includeTools: boolean,
    ) => {
      const body: Record<string, unknown> = {
        model,
        instructions: systemPrompt,
        input,
      };
      if (reasoning) {
        body.reasoning = reasoning;
      }
      if (previousResponseId) {
        body.previous_response_id = previousResponseId;
      }
      if (includeTools) {
        body.tools = chatTools.openai;
      }
      if (Platform.OS === "web") {
        return streamOpenAIRequestViaFetch(
          "https://api.openai.com/v1/responses",
          {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${provider.api_key}`,
          },
          body,
          streamHandlers,
          "No se pudo conectar con OpenAI.",
          "OpenAI error",
        );
      }
      return streamOpenAIRequestViaXHR(
        "https://api.openai.com/v1/responses",
        {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${provider.api_key}`,
        },
        body,
        streamHandlers,
        "No se pudo conectar con OpenAI.",
        "OpenAI error",
      );
    };

    let payload = await makeOpenAIRequest(nonSystemMessages, null, true);

    for (let round = 0; round < 10; round++) {
      const toolCalls = payload.outputItems.filter(
        (item): item is OpenAIFunctionCallOutputItem => item.type === "function_call",
      );
      if (toolCalls.length === 0) break;
      if (!payload.responseId) {
        throw new Error("OpenAI no devolvio response_id para continuar las herramientas.");
      }

      const toolOutputs: Array<Record<string, unknown>> = [];
      for (const toolCall of toolCalls) {
        const args = parseOpenAIFunctionArguments(toolCall.arguments);
        const toolResult = await handleToolCall(toolCall.name, args, toolStoreSetter);
        toolOutputs.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: toolResult,
        });
      }
      payload = await makeOpenAIRequest(toolOutputs, payload.responseId, true);
    }

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("OpenAI no devolvio contenido.");
    return { content, thinking };
  }

  // --- ANTHROPIC ---
  if (provider.provider === "anthropic") {
    let streamedContent = "";
    let streamedThinking = "";
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options?.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options?.onThinkingDelta?.(delta, streamedThinking);
      },
    };

    const makeAnthropicRequest = async (msgs: any[], includeTools: boolean) => {
      const body: any = {
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 2048 + ANTHROPIC_THINKING_BUDGET,
        thinking: { type: "enabled", budget_tokens: ANTHROPIC_THINKING_BUDGET },
        system: systemPrompt,
        messages: msgs,
      };
      if (includeTools) body.tools = chatTools.anthropic;
      if (Platform.OS === "web") {
        return streamAnthropicRequestViaXHR(
          buildWebProxyUrl("/chat/providers/anthropic/messages"),
          {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          {
            api_key: provider.api_key,
            ...body,
          },
          streamHandlers,
          ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE,
          "Proxy Anthropic error",
        );
      }

      return streamAnthropicRequestViaXHR(
        "https://api.anthropic.com/v1/messages",
        {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "x-api-key": provider.api_key,
          "anthropic-version": ANTHROPIC_API_VERSION,
        },
        body,
        streamHandlers,
        "No se pudo conectar con Anthropic.",
        "Anthropic error",
      );
    };

    let currentMessages: any[] = [...nonSystemMessages];
    let payload = await makeAnthropicRequest(currentMessages, true);

    for (let round = 0; round < 10; round++) {
      const contentBlocks = payload.contentBlocks;
      const toolUseBlocks = contentBlocks.filter(
        (block): block is AnthropicToolUseBlock => block.type === "tool_use",
      );
      if (toolUseBlocks.length === 0) break;

      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        const result = await handleToolCall(block.name, block.input ?? {}, toolStoreSetter);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: contentBlocks },
        { role: "user", content: toolResults },
      ];
      payload = await makeAnthropicRequest(currentMessages, true);
    }

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return { content, thinking };
  }

  // --- GOOGLE ---
  const googleMessages: any[] = nonSystemMessages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
  let streamedContent = "";
  let streamedThinking = "";
  const streamHandlers: StreamingHandlers = {
    onContentDelta: (delta) => {
      streamedContent += delta;
      options?.onContentDelta?.(delta, streamedContent);
    },
    onThinkingDelta: (delta) => {
      streamedThinking += delta;
      options?.onThinkingDelta?.(delta, streamedThinking);
    },
  };
  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizeProviderModel("google", provider.model))}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.api_key)}`;

  const makeGoogleRequest = async (msgs: any[], includeTools: boolean) => {
    const body: any = {
      contents: msgs,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: "high",
        },
      },
    };
    if (includeTools) body.tools = chatTools.google;
    if (Platform.OS === "web") {
      return streamGoogleRequestViaFetch(
        googleUrl,
        {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body,
        streamHandlers,
        "No se pudo conectar con Google AI.",
        "Google AI error",
      );
    }
    return streamGoogleRequestViaXHR(
      googleUrl,
      {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body,
      streamHandlers,
      "No se pudo conectar con Google AI.",
      "Google AI error",
    );
  };

  let payload = await makeGoogleRequest(googleMessages, true);

  for (let round = 0; round < 10; round++) {
    const functionCalls = payload.modelParts.filter(
      (part): part is GoogleResponsePart & { functionCall: GoogleFunctionCall } =>
        Boolean(part.functionCall?.name),
    );
    if (functionCalls.length === 0) break;

    const modelParts = payload.modelParts
      .map(mapGoogleResponsePartToRequestPart)
      .filter((part): part is Record<string, unknown> => Boolean(part));
    const responseParts: any[] = [];
    for (const part of functionCalls) {
      const functionCall = part.functionCall;
      const toolResult = await handleToolCall(
        functionCall.name,
        functionCall.args ?? {},
        toolStoreSetter,
      );
      responseParts.push({
        functionResponse: {
          name: functionCall.name,
          response: { result: toolResult },
        },
      });
    }
    googleMessages.push({ role: "model", parts: modelParts });
    googleMessages.push({ role: "user", parts: responseParts });
    payload = await makeGoogleRequest(googleMessages, true);
  }

  const content = streamedContent.trim() || payload.content;
  const thinking = streamedThinking.trim() || payload.thinking || null;
  if (!content) throw new Error("Google AI no devolvio contenido.");
  return { content, thinking };
}

const foodEstimatorTools = {
  openai: [
    {
      type: "function",
      name: SCAN_BARCODE_TOOL,
      description: SCAN_BARCODE_DESC,
      parameters: {
        type: "object",
        properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
        required: ["barcode"],
      },
    },
  ],
  anthropic: [
    {
      name: SCAN_BARCODE_TOOL,
      description: SCAN_BARCODE_DESC,
      input_schema: {
        type: "object",
        properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
        required: ["barcode"],
      },
    },
  ],
  google: [
    {
      functionDeclarations: [
        {
          name: SCAN_BARCODE_TOOL,
          description: SCAN_BARCODE_DESC,
          parameters: {
            type: "object",
            properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
            required: ["barcode"],
          },
        },
      ],
    },
  ],
};

async function callFoodEstimatorAPI(
  provider: AIKey,
  messages: ChatInputMessage[],
  images: FoodEstimatorImage[],
  onStatus?: (status: string) => void,
  skipImages?: boolean,
): Promise<string> {
  const model = normalizeProviderModel(provider.provider, provider.model);
  const normalizedImages = skipImages ? [] : images
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
    const systemPrompt = normalizeChatSystemPrompt(
      messages
        .filter((msg) => msg.role === "system")
        .map((msg) => msg.content)
        .join("\n\n"),
    );
    const openAIInputs: Array<Record<string, unknown>> = messages
      .filter((msg) => msg.role !== "system")
      .map((msg, index) => {
        const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
        if (msg.role === "assistant") {
          return {
            role: "assistant",
            content: [{ type: "output_text", text: textContent }],
          };
        }
        if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
          return {
            role: "user",
            content: [{ type: "input_text", text: textContent }],
          };
        }
        return {
          role: "user",
          content: [
            { type: "input_text", text: textContent },
            ...normalizedImages.map((image) => ({
              type: "input_image",
              image_url: `data:${image.mime_type};base64,${image.base64}`,
              detail: "auto",
            })),
          ],
        };
      });

    const makeRequest = async (
      input: Array<Record<string, unknown>>,
      previousResponseId: string | null,
    ) => {
      const body: Record<string, unknown> = {
        model,
        instructions: systemPrompt,
        input,
        tools: foodEstimatorTools.openai,
      };
      if (previousResponseId) {
        body.previous_response_id = previousResponseId;
      }
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.api_key}` },
        body: JSON.stringify(body),
      });
      let p: any = null;
      try { p = await res.json(); } catch {}
      if (!res.ok) throw new Error(extractErrorMessage(p, `OpenAI error (${res.status})`));
      return p;
    };

    onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
    let payload = await makeRequest(openAIInputs, null);
    for (let round = 0; round < 5; round++) {
      const outputItems = parseOpenAIResponseOutputItems(payload);
      const toolCalls = outputItems.filter(
        (item): item is OpenAIFunctionCallOutputItem => item.type === "function_call",
      );
      if (toolCalls.length === 0) break;
      const responseId = typeof payload?.id === "string" ? payload.id : null;
      if (!responseId) {
        throw new Error("OpenAI no devolvio response_id para continuar la estimación.");
      }
      const toolOutputs: Array<Record<string, unknown>> = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name ?? "";
        onStatus?.(toolName === SCAN_BARCODE_TOOL ? "Leyendo código de barras..." : `Usando herramienta: ${toolName}...`);
        const args = parseOpenAIFunctionArguments(toolCall.arguments);
        const result = await handleFoodEstimatorToolCall(toolName, args);
        toolOutputs.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: result,
        });
      }
      onStatus?.("Procesando resultado...");
      payload = await makeRequest(toolOutputs, responseId);
    }

    const result = parseOpenAIResponseResult(payload);
    if (!result?.content) throw new Error("OpenAI no devolvio contenido.");
    return result.content;
  }

  if (provider.provider === "anthropic") {
    if (Platform.OS === "web" && normalizedImages.length > 0) {
      throw new Error(
        "Anthropic en web no admite envío de imágenes en este flujo. Usa Google u OpenAI, o abre la app en dispositivo móvil.",
      );
    }

    const buildAnthropicMessages = (): any[] => nonSystemMessages.map((msg, index) => {
      if (msg.role === "assistant") {
        return { role: "assistant", content: msg.content.trim() || "Entendido." };
      }
      const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
      if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
        return { role: "user", content: textContent };
      }
      return {
        role: "user",
        content: [
          { type: "text", text: textContent },
          ...normalizedImages.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mime_type, data: image.base64 },
          })),
        ],
      };
    });

    if (Platform.OS === "web") {
      const textOnlyMessages = nonSystemMessages.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content.trim() || "Analiza esta comida y estima los valores solicitados.",
      })) as Array<{ role: "assistant" | "user"; content: string }>;
      const webResult = await callAnthropicViaWebProxy(provider, FOOD_ESTIMATOR_SYSTEM_PROMPT, textOnlyMessages);
      return webResult.content;
    }

    const anthropicHeaders = {
      "Content-Type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": ANTHROPIC_API_VERSION,
    };
    let currentMessages = buildAnthropicMessages();
    const makeRequest = async (msgs: any[]) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: anthropicHeaders,
        body: JSON.stringify({
          model, max_tokens: 1200, system: FOOD_ESTIMATOR_SYSTEM_PROMPT,
          messages: msgs, tools: foodEstimatorTools.anthropic,
        }),
      });
      let p: any = null;
      try { p = await res.json(); } catch {}
      if (!res.ok) throw new Error(extractErrorMessage(p, `Anthropic error (${res.status})`));
      return p;
    };

    onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
    let payload = await makeRequest(currentMessages);
    for (let round = 0; round < 5; round++) {
      const contentBlocks = payload?.content as any[] | undefined;
      const toolUseBlocks = contentBlocks?.filter((b: any) => b.type === "tool_use") ?? [];
      if (toolUseBlocks.length === 0) break;
      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        const toolName = block.name ?? "";
        onStatus?.(toolName === SCAN_BARCODE_TOOL ? "Leyendo código de barras..." : `Usando herramienta: ${toolName}...`);
        const result = await handleFoodEstimatorToolCall(toolName, block.input ?? {});
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: contentBlocks },
        { role: "user", content: toolResults },
      ];
      onStatus?.("Procesando resultado...");
      payload = await makeRequest(currentMessages);
    }

    const result = parseAnthropicContent(payload);
    if (!result) throw new Error("Anthropic no devolvio contenido.");
    return result.content;
  }

  // --- GOOGLE ---
  const googleContents: any[] = nonSystemMessages.map((msg, index) => {
    if (msg.role === "assistant") {
      return { role: "model", parts: [{ text: msg.content.trim() || "Entendido." }] };
    }
    const textContent = msg.content.trim() || "Analiza esta comida y estima los valores solicitados.";
    if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
      return { role: "user", parts: [{ text: textContent }] };
    }
    return {
      role: "user",
      parts: [
        { text: textContent },
        ...normalizedImages.map((image) => ({
          inline_data: { mime_type: image.mime_type, data: image.base64 },
        })),
      ],
    };
  });

  const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.api_key)}`;
  const makeGoogleRequest = async (contents: any[]) => {
    const res = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: FOOD_ESTIMATOR_SYSTEM_PROMPT }] },
        tools: foodEstimatorTools.google,
      }),
    });
    let p: any = null;
    try { p = await res.json(); } catch {}
    if (!res.ok) throw new Error(extractErrorMessage(p, `Google AI error (${res.status})`));
    return p;
  };

  onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
  let payload: any = await makeGoogleRequest(googleContents);
  for (let round = 0; round < 5; round++) {
    const candidate = payload?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const functionCalls = parts.filter((p: any) => p.functionCall);
    if (functionCalls.length === 0) break;
    googleContents.push({ role: "model", parts });
    const functionResponseParts: any[] = [];
    for (const fc of functionCalls) {
      const toolName = fc.functionCall.name ?? "";
      onStatus?.(toolName === SCAN_BARCODE_TOOL ? "Leyendo código de barras..." : `Usando herramienta: ${toolName}...`);
      const result = await handleFoodEstimatorToolCall(toolName, fc.functionCall.args ?? {});
      functionResponseParts.push({
        functionResponse: { name: toolName, response: { result } },
      });
    }
    googleContents.push({ role: "user", parts: functionResponseParts });
    onStatus?.("Procesando resultado...");
    payload = await makeGoogleRequest(googleContents);
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
  sex: UserSex = "male",
): number | null {
  const heightCm = measurement.height_cm ?? fallbackHeightCm;
  if (heightCm === null || measurement.waist_cm === null || measurement.neck_cm === null) {
    return null;
  }

  const heightIn = heightCm / 2.54;
  let estimate: number;

  if (sex === "female") {
    if (measurement.hips_cm === null) return null;
    const circumferenceCm = measurement.waist_cm + measurement.hips_cm - measurement.neck_cm;
    if (!(circumferenceCm > 0)) return null;
    const circumferenceIn = circumferenceCm / 2.54;
    estimate =
      163.205 * Math.log10(circumferenceIn) - 97.684 * Math.log10(heightIn) - 78.387;
  } else {
    const waistMinusNeckCm = measurement.waist_cm - measurement.neck_cm;
    if (!(waistMinusNeckCm > 0)) return null;
    const waistMinusNeckIn = waistMinusNeckCm / 2.54;
    estimate =
      86.01 * Math.log10(waistMinusNeckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  }

  if (!Number.isFinite(estimate)) return null;
  return Math.max(3, Math.min(60, Math.round(estimate * 10) / 10));
}

function buildMeasurementHistorySummary(
  measurement: Measurement,
  fallbackHeightCm: number | null,
  sex: UserSex = "male",
): string {
  const summaryParts: string[] = [];

  if (measurement.weight_kg !== null) {
    summaryParts.push(`${formatMeasurementNumber(measurement.weight_kg)} kg`);
  }

  const bodyFatPercentage = estimateMeasurementBodyFatPercentage(measurement, fallbackHeightCm, sex);
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
    const name = item.name.toLowerCase();
    const isLegPress = name.includes("prensa") || name.includes("sentadilla") || name.includes("squat") || name.includes("leg press") || name.includes("pierna");
    const execSeconds = isLegPress ? 90 : 60;
    const seriesSeconds = seriesItems.reduce((seriesAcc, seriesItem) => {
      const restSeconds = parseRestSecondsInput(seriesItem.rest_seconds);
      return seriesAcc + execSeconds + restSeconds;
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

function TabTitle({ children }: { children: string }) {
  return (
    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 30, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

function StatCard({ label, value, subtitle, subtitleColor, icon, subtitleIcon, onPress }: {
  label: string;
  value: string;
  subtitle?: string;
  subtitleColor?: string;
  icon?: React.ReactNode;
  subtitleIcon?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={{
        flex: 1,
        minHeight: 94,
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        backgroundColor: mobileTheme.color.bgSurface,
        borderRadius: 18,
        padding: 12,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ color: "#8B94A3", fontSize: 12, fontWeight: "600" }}>{label}</Text>
      </View>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" }}>{value}</Text>
      {subtitle ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: "auto" }}>
          {subtitleIcon}
          <Text style={{ color: subtitleColor ?? "#7F8896", fontSize: 11, fontWeight: subtitleColor ? "700" : "400", flex: 1 }}>
            {subtitle}
          </Text>
        </View>
      ) : null}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={{ flex: 1 }}>{content}</Pressable>;
  }
  return content;
}

function ChartCard({ title, subtitle, periodSelector, children, zIndex, footer }: {
  title: React.ReactNode;
  subtitle?: string;
  periodSelector: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
  footer?: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: mobileTheme.color.bgSurface,
        position: "relative",
        overflow: "visible",
        zIndex: zIndex ?? 1,
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
          zIndex: 2,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          {typeof title === "string" ? (
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>{title}</Text>
          ) : title}
          {subtitle ? (
            <Text style={{ color: "#8B94A3", fontSize: 12 }}>{subtitle}</Text>
          ) : null}
        </View>
        {periodSelector}
      </View>
      {children}
      {footer}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, icon, testID }: { label: string; onPress: () => void; disabled?: boolean; icon?: React.ReactNode; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={{
        height: 46,
        borderRadius: 12,
        backgroundColor: mobileTheme.color.brandPrimary,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: icon ? 10 : 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      <Text style={{ color: "#06090D", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
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

  const goal: DietGoal =
    maybe.goal === "bulk" || maybe.goal === "cut" || maybe.goal === "maintain"
      ? maybe.goal
      : defaults.goal;

  const activityLevel: ActivityLevel | undefined =
    maybe.activity_level === "moderate" || maybe.activity_level === "intermediate" || maybe.activity_level === "high"
      ? maybe.activity_level
      : undefined;

  const sex: UserSex | undefined =
    maybe.sex === "male" || maybe.sex === "female" ? maybe.sex : undefined;

  return {
    goal,
    activity_level: activityLevel,
    sex,
    height_cm: typeof maybe.height_cm === "string" ? maybe.height_cm : undefined,
    birth_date: typeof maybe.birth_date === "string" ? maybe.birth_date : undefined,
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

function createWebSeedStore(): LocalStore {
  const threadId = uid("thread");
  const today = new Date().toISOString().slice(0, 10);
  return {
    templates: [
      {
        id: uid("tpl"),
        name: "Tren Superior — Fuerza",
        category: "strength",
        icon: "activity",
        duration_minutes: "45",
        exercises: [
          {
            id: uid("ex"),
            name: "Press banca",
            muscle: "pecho",
            sets: [8, 8, 8, 6],
            series: [
              { id: uid("set"), type: "warmup", reps: "12", weight_kg: "40", rest_seconds: "60" },
              { id: uid("set"), reps: "8", weight_kg: "70", rest_seconds: "120" },
              { id: uid("set"), reps: "8", weight_kg: "70", rest_seconds: "120" },
              { id: uid("set"), reps: "6", weight_kg: "75", rest_seconds: "150" },
            ],
            load_kg: 70,
            rest_seconds: 120,
          },
          {
            id: uid("ex"),
            name: "Remo con barra",
            muscle: "espalda",
            sets: [10, 10, 10],
            series: [
              { id: uid("set"), reps: "10", weight_kg: "60", rest_seconds: "90" },
              { id: uid("set"), reps: "10", weight_kg: "60", rest_seconds: "90" },
              { id: uid("set"), reps: "10", weight_kg: "60", rest_seconds: "90" },
            ],
            load_kg: 60,
            rest_seconds: 90,
          },
          {
            id: uid("ex"),
            name: "Curl bíceps",
            muscle: "bíceps",
            sets: [12, 12, 12],
            series: [
              { id: uid("set"), reps: "12", weight_kg: "14", rest_seconds: "60" },
              { id: uid("set"), type: "dropset", reps: "12", weight_kg: "14", rest_seconds: "0",
                sub_series: [
                  { id: uid("sub"), reps: "10", weight_kg: "14", rest_seconds: "0" },
                  { id: uid("sub"), reps: "8", weight_kg: "10", rest_seconds: "0" },
                  { id: uid("sub"), reps: "6", weight_kg: "8", rest_seconds: "0" },
                ],
              },
              { id: uid("set"), reps: "12", weight_kg: "14", rest_seconds: "60" },
            ],
            load_kg: 14,
            rest_seconds: 60,
          },
        ],
      },
      {
        id: uid("tpl"),
        name: "Tren Inferior — Hipertrofia",
        category: "hypertrophy",
        icon: "zap",
        duration_minutes: "50",
        exercises: [
          {
            id: uid("ex"),
            name: "Sentadilla",
            muscle: "cuádriceps",
            sets: [10, 10, 8, 8],
            series: [
              { id: uid("set"), type: "warmup", reps: "15", weight_kg: "40", rest_seconds: "60" },
              { id: uid("set"), reps: "10", weight_kg: "80", rest_seconds: "120" },
              { id: uid("set"), reps: "8", weight_kg: "90", rest_seconds: "150" },
              { id: uid("set"), reps: "8", weight_kg: "90", rest_seconds: "150" },
            ],
            load_kg: 80,
            rest_seconds: 120,
          },
          {
            id: uid("ex"),
            name: "Peso muerto rumano",
            muscle: "isquiotibiales",
            sets: [10, 10, 10],
            series: [
              { id: uid("set"), reps: "10", weight_kg: "70", rest_seconds: "90" },
              { id: uid("set"), reps: "10", weight_kg: "70", rest_seconds: "90" },
              { id: uid("set"), reps: "10", weight_kg: "70", rest_seconds: "90" },
            ],
            load_kg: 70,
            rest_seconds: 90,
          },
          {
            id: uid("ex"),
            name: "Plancha isométrica",
            muscle: "core",
            sets: [60, 60],
            series: [
              { id: uid("set"), type: "isometric", reps: "60", weight_kg: "", rest_seconds: "60" },
              { id: uid("set"), type: "isometric", reps: "60", weight_kg: "", rest_seconds: "60" },
            ],
            load_kg: null,
            rest_seconds: 60,
          },
        ],
      },
    ],
    workoutHistory: [],
    dietByDate: {
      [today]: {
        meals: [
          {
            id: uid("meal"),
            label: "Desayuno",
            items: [
              { id: uid("fi"), name: "Avena con leche", kcal: 350, protein_g: 12, carbs_g: 55, fat_g: 8, amount_g: 300 },
              { id: uid("fi"), name: "Plátano", kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, amount_g: 120 },
            ],
          },
          {
            id: uid("meal"),
            label: "Almuerzo",
            items: [
              { id: uid("fi"), name: "Pechuga de pollo", kcal: 280, protein_g: 52, carbs_g: 0, fat_g: 6, amount_g: 200 },
              { id: uid("fi"), name: "Arroz integral", kcal: 215, protein_g: 5, carbs_g: 45, fat_g: 2, amount_g: 180 },
            ],
          },
        ],
      },
    },
    dietSettings: createDefaultDietSettings(),
    measurements: [
      { id: uid("m"), date: today, weight_kg: 78, body_fat_pct: 15, muscle_mass_kg: 35, notes: "" },
    ],
    threads: [{ id: threadId, title: "Coach 1" }],
    messagesByThread: { [threadId]: [] },
    keys: createDefaultProviderKeys(),
  };
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

function normalizeChatMessage(raw: ChatMessage, index: number): ChatMessage {
  const role =
    raw?.role === "assistant" || raw?.role === "system" || raw?.role === "user"
      ? raw.role
      : "assistant";
  const thinking = typeof raw?.thinking === "string" ? raw.thinking : null;
  return {
    id: raw?.id?.trim() || uid(`msg-${index}`),
    role,
    content: typeof raw?.content === "string" ? raw.content : "",
    thinking,
    is_streaming: false,
    created_at:
      typeof raw?.created_at === "string" && raw.created_at.trim()
        ? raw.created_at
        : new Date().toISOString(),
  };
}

function normalizeMessagesByThread(
  rawMessagesByThread: Record<string, ChatMessage[]> | null | undefined,
): Record<string, ChatMessage[]> {
  if (!rawMessagesByThread || typeof rawMessagesByThread !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawMessagesByThread).map(([threadId, threadMessages]) => [
      threadId,
      Array.isArray(threadMessages)
        ? threadMessages.map((message, index) => normalizeChatMessage(message, index))
        : [],
    ]),
  );
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
    const model = normalizeProviderModel(provider, item?.model ?? DEFAULT_MODELS[provider]);
    return {
      provider,
      is_active: item?.is_active ?? index === 0,
      api_key: (item?.api_key ?? "").trim(),
      model,
      reasoning_effort:
        provider === "openai"
          ? normalizeOpenAIReasoningEffort(item?.reasoning_effort, model)
          : null,
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

  // Migrate chatProvider / foodAIProvider
  const chatProvider: Provider = (raw as Record<string, unknown>).chatProvider as Provider
    ?? keys.find((k) => k.is_active)?.provider
    ?? "openai";
  const foodAIProvider: Provider = (raw as Record<string, unknown>).foodAIProvider as Provider ?? "google";

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
  ).slice(0, 1826);
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
    messagesByThread: normalizeMessagesByThread(raw.messagesByThread),
    keys,
    chatProvider,
    foodAIProvider,
  };
}

type MiniChatProps = {
  systemPrompt: string;
  providerKeys: AIKey[];
  providerPriority?: Provider[];
  preferredProvider?: Provider;
  onJsonResult?: (json: Record<string, unknown>) => void;
  onClose: () => void;
  visible: boolean;
  title: string;
};

function MiniChat({ systemPrompt, providerKeys, providerPriority, preferredProvider, onJsonResult, onClose, visible, title }: MiniChatProps) {
  const [mcMessages, setMcMessages] = useState<ChatMessage[]>([]);
  const [mcInput, setMcInput] = useState("");
  const [mcSending, setMcSending] = useState(false);
  const mcScrollRef = useRef<ScrollView>(null);

  if (!visible) return null;

  const resolvedProvider = (() => {
    if (preferredProvider) {
      const match = providerKeys.find((k) => k.provider === preferredProvider && k.api_key.trim());
      if (match) return { ...match, api_key: match.api_key.trim(), model: normalizeProviderModel(match.provider, match.model) };
    }
    return resolveProviderByPriority(providerKeys, providerPriority ?? FOOD_ESTIMATOR_PROVIDER_PRIORITY);
  })();
  const providerLabel = resolvedProvider
    ? `${resolvedProvider.provider.charAt(0).toUpperCase() + resolvedProvider.provider.slice(1)} · ${resolvedProvider.model}`
    : "Sin proveedor";

  function extractJson(text: string): Record<string, unknown> | null {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { return null; }
    }
    const braceMatch = text.match(/\{[\s\S]*"name"\s*:[\s\S]*\}/);
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]); } catch { return null; }
    }
    return null;
  }

  async function sendMcMessage() {
    const text = mcInput.trim();
    if (!text || mcSending) return;

    const provider = resolvedProvider;
    if (!provider) {
      setMcMessages((prev) => [...prev, { id: uid("msg"), role: "assistant", content: "No hay proveedor de IA configurado. Ve a Configuración → Proveedor IA para añadir una API key.", created_at: new Date().toISOString() }]);
      return;
    }

    const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: text, created_at: new Date().toISOString() };
    setMcMessages((prev) => [...prev, userMsg]);
    setMcInput("");
    setMcSending(true);

    try {
      const history: ChatInputMessage[] = [
        { role: "system", content: systemPrompt },
        ...mcMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const response = await callProviderChatAPI(provider, history);
      const assistantMsg: ChatMessage = { id: uid("msg"), role: "assistant", content: response, created_at: new Date().toISOString() };
      setMcMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error desconocido";
      setMcMessages((prev) => [...prev, { id: uid("msg"), role: "assistant", content: `Error: ${errMsg}`, created_at: new Date().toISOString() }]);
    } finally {
      setMcSending(false);
      setTimeout(() => mcScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const lastAssistantMsg = [...mcMessages].reverse().find((m) => m.role === "assistant");
  const detectedJson = lastAssistantMsg ? extractJson(lastAssistantMsg.content) : null;

  return (
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
      <View>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10, marginBottom: 2 }}>{providerLabel}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 16 }}>{title}</Text>
          <Pressable
            onPress={() => { setMcMessages([]); setMcInput(""); onClose(); }}
            style={{ padding: 4 }}
          >
            <Feather name="x" size={18} color={mobileTheme.color.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={mcScrollRef}
        style={{ maxHeight: 320 }}
        onContentSizeChange={() => mcScrollRef.current?.scrollToEnd({ animated: true })}
      >
        {mcMessages.length === 0 ? (
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontStyle: "italic" }}>
            Escribe un alimento, plato o receta para obtener sus macros...
          </Text>
        ) : null}
        {mcMessages.map((msg) => (
          <View
            key={msg.id}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              marginBottom: 8,
              borderRadius: 10,
              padding: 10,
              backgroundColor: msg.role === "user" ? "rgba(203,255,26,0.1)" : mobileTheme.color.cardBg,
              borderWidth: 1,
              borderColor: msg.role === "user" ? "rgba(203,255,26,0.25)" : mobileTheme.color.borderSubtle,
            }}
          >
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, lineHeight: 19 }}>
              {msg.content}
            </Text>
          </View>
        ))}
        {mcSending ? (
          <View style={{ alignSelf: "flex-start", marginBottom: 8 }}>
            <ActivityIndicator size="small" color={mobileTheme.color.brandPrimary} />
          </View>
        ) : null}
      </ScrollView>

      {detectedJson && onJsonResult ? (
        <Pressable
          onPress={() => { onJsonResult(detectedJson); setMcMessages([]); setMcInput(""); }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: mobileTheme.radius.md,
            backgroundColor: mobileTheme.color.brandPrimary,
          }}
        >
          <Feather name="plus-circle" size={16} color="#000" />
          <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>Añadir a mis alimentos</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <TextInput
          value={mcInput}
          onChangeText={setMcInput}
          placeholder="Ej: tortilla de patatas..."
          placeholderTextColor={mobileTheme.color.textSecondary}
          onSubmitEditing={sendMcMessage}
          multiline
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: mobileTheme.color.borderSubtle,
            borderRadius: mobileTheme.radius.md,
            paddingHorizontal: 10,
            paddingVertical: 8,
            color: mobileTheme.color.textPrimary,
            fontSize: 14,
            backgroundColor: mobileTheme.color.cardBg,
            maxHeight: 120,
          }}
        />
        <Pressable
          onPress={sendMcMessage}
          disabled={mcSending || !mcInput.trim()}
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 14,
            borderRadius: mobileTheme.radius.md,
            backgroundColor: mcSending || !mcInput.trim() ? "#333" : mobileTheme.color.brandPrimary,
          }}
        >
          <Feather name="send" size={16} color={mcSending || !mcInput.trim() ? "#666" : "#000"} />
        </Pressable>
      </View>
    </View>
  );
}

function SwipeableSetRow({
  children,
  onDelete,
  enabled,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  enabled: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const DELETE_THRESHOLD = -80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        enabled && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < DELETE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDelete());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={{ overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          backgroundColor: "#E53935",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather name="trash-2" size={18} color="#fff" />
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: "#171B23" }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const THINKING_VERBS = [
  "Pensando", "Reflexionando", "Analizando", "Calculando", "Procesando",
  "Masticando datos", "Consultando", "Investigando", "Conectando ideas",
  "Evaluando", "Entrenando neuronas", "Calentando motores", "Preparando",
  "Cocinando respuesta", "Mezclando ingredientes", "Levantando pesas mentales",
  "Haciendo crunches de datos", "Estirando la mente", "Sprint final",
  "Activando cerebro", "Descifrando", "Componiendo", "Elaborando",
];

function useThinkingLabel(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) { setIndex(0); return; }
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % THINKING_VERBS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [active]);
  return THINKING_VERBS[index];
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
  const chatThinkingLabel = useThinkingLabel(sendingChat);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [showByokExplain, setShowByokExplain] = useState(false);
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
  const [dietAddMode, setDietAddMode] = useState<"search" | "form" | "ai" | "selected" | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [dietFoodSearch, setDietFoodSearch] = useState("");
  const [dietSelectedFood, setDietSelectedFood] = useState<FoodRepoEntry | null>(null);
  const [dietSelectedGrams, setDietSelectedGrams] = useState("");
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
  const [foodEstimatorStatus, setFoodEstimatorStatus] = useState("");
  const foodThinkingLabel = useThinkingLabel(foodEstimatorSending);
  const [foodEstimatorHasLLMResponse, setFoodEstimatorHasLLMResponse] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [measurementPhotoUri, setMeasurementPhotoUri] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState<Date>(() => measurementDateFromSelection(new Date()));
  const [showMeasurementDatePicker, setShowMeasurementDatePicker] = useState(false);
  const [measurementDateTextInput, setMeasurementDateTextInput] = useState("");
  const [measurementEntryScreenOpen, setMeasurementEntryScreenOpen] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>({ ...DEFAULT_USER_PREFS });
  const [measuresDashboardPeriod, setMeasuresDashboardPeriod] =
    useState<MeasuresDashboardPeriodKey>("3m");
  const [measuresDashboardPeriodDropdownOpen, setMeasuresDashboardPeriodDropdownOpen] = useState(false);
  const [measuresChartMetric, setMeasuresChartMetric] = useState<MeasuresChartMetricKey>("weight");
  const [measuresChartMetricDropdownOpen, setMeasuresChartMetricDropdownOpen] = useState(false);
  const [showAllMeasurementsHistory, setShowAllMeasurementsHistory] = useState(false);
  const [expandedPhotoUri, setExpandedPhotoUri] = useState<string | null>(null);
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
  const [supersetPickerTarget, setSupersetPickerTarget] = useState<{
    exerciseId: string;
    seriesId: string;
    subSeriesId: string;
  } | null>(null);
  const [foodsRepo, setFoodsRepo] = useState<FoodRepoEntry[]>([]);
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<FoodRepoEntry | null>(null);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategoryFilter, setFoodCategoryFilter] = useState("all");
  const [personalFoods, setPersonalFoods] = useState<FoodRepoEntry[]>([]);
  const [personalFoodSearch, setPersonalFoodSearch] = useState("");
  const [selectedPersonalFoodDetail, setSelectedPersonalFoodDetail] = useState<FoodRepoEntry | null>(null);
  const [personalFoodFormVisible, setPersonalFoodFormVisible] = useState(false);
  const [personalFoodDraft, setPersonalFoodDraft] = useState<Partial<FoodRepoEntry>>({});
  const [editingPersonalFoodId, setEditingPersonalFoodId] = useState<string | null>(null);
  const [personalFoodAIChatOpen, setPersonalFoodAIChatOpen] = useState(false);
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
  const [chatProviderDropdownOpen, setChatProviderDropdownOpen] = useState(false);
  const [foodAIProviderDropdownOpen, setFoodAIProviderDropdownOpen] = useState(false);
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
  const [trainingStatsPeriodDropdownOpen, setTrainingStatsPeriodDropdownOpen] = useState(false);
  const [trainingStatsMetric, setTrainingStatsMetric] = useState<TrainingStatsMetricKey>("volume");
  const [trainingStatsMetricDropdownOpen, setTrainingStatsMetricDropdownOpen] = useState(false);
  const [trainingMenuTemplateId, setTrainingMenuTemplateId] = useState<string | null>(null);
  const [activeExerciseMenuId, setActiveExerciseMenuId] = useState<string | null>(null);
  const [activeSeriesMenuId, setActiveSeriesMenuId] = useState<string | null>(null);
  const [seriesTypePickerTarget, setSeriesTypePickerTarget] = useState<{
    exerciseId: string;
    seriesId: string;
    source: "editor" | "session";
  } | null>(null);
  const [expandedCompoundSeriesId, setExpandedCompoundSeriesId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseDetailIndex, setExerciseDetailIndex] = useState<number | null>(null);
  const [activeWorkoutSession, setActiveWorkoutSession] = useState<WorkoutSession | null>(null);
  const [lastWorkoutSessionSummary, setLastWorkoutSessionSummary] =
    useState<WorkoutSessionSummary | null>(null);
  const [workoutCompletionModal, setWorkoutCompletionModal] =
    useState<WorkoutCompletionModalState | null>(null);
  const [confirmDiscardSession, setConfirmDiscardSession] = useState(false);
  const restFinishSoundRef = useRef<Audio.Sound | null>(null);
  const bgSilenceRef = useRef<Audio.Sound | null>(null);
  const bgRestDeadlineRef = useRef<number | null>(null);
  const bgRestFiredRef = useRef(false);
  const bgHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    () => {
      if (store.chatProvider) {
        const match = store.keys.find((item) => item.provider === store.chatProvider && item.api_key.trim());
        if (match) return match;
      }
      // Fallback: first provider with API key
      return store.keys.find((item) => item.api_key.trim()) ?? store.keys[0] ?? null;
    },
    [store.keys, store.chatProvider],
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
  const openAIProviderDraft = providerDraftByProvider.openai ?? {
    api_key: "",
    model: DEFAULT_MODELS.openai,
    reasoning_effort: DEFAULT_OPENAI_REASONING_EFFORT,
  };
  const normalizedOpenAIProviderModel = useMemo(
    () => normalizeProviderModel("openai", openAIProviderDraft.model),
    [openAIProviderDraft.model],
  );
  const supportedOpenAIReasoningEfforts = useMemo(
    () => getSupportedOpenAIReasoningEfforts(normalizedOpenAIProviderModel),
    [normalizedOpenAIProviderModel],
  );
  const selectedOpenAIReasoningEffort = useMemo(
    () => normalizeOpenAIReasoningEffort(openAIProviderDraft.reasoning_effort, normalizedOpenAIProviderModel),
    [openAIProviderDraft.reasoning_effort, normalizedOpenAIProviderModel],
  );
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
  const dietHeightCm = store.dietSettings.height_cm ? parseFloat(store.dietSettings.height_cm) : null;
  const latestBodyHeightCm = latestHeightMeasurement?.height_cm ?? (Number.isFinite(dietHeightCm) && dietHeightCm! > 0 ? dietHeightCm : null);
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
        changeText: "=",
        changeColor: "#6F7785",
        changeIcon: "minus",
      };
    }

    const improved = prefersDecrease ? delta < 0 : delta > 0;
    const signedValue = `${delta > 0 ? "+" : ""}${formatMeasurementNumber(delta)}`;
    return {
      label,
      valueText: formatValue(latest),
      changeText: `${signedValue} ${unitLabel}`,
      changeColor: improved ? "#19C37D" : mobileTheme.color.brandPrimary,
      changeIcon: delta < 0 ? "trending-down" : "trending-up",
    };
  }

  const weightMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.weight_kg);
  const userSex: UserSex = store.dietSettings.sex ?? "male";
  const bodyFatMeasurementPair = resolveMeasurementMetricPair((measurement) =>
    estimateMeasurementBodyFatPercentage(measurement, latestBodyHeightCm, userSex),
  );
  const neckMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.neck_cm);
  const waistMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.waist_cm);
  const chestMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.chest_cm);
  const hipsMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.hips_cm);
  const armMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.biceps_cm);
  const quadMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.quadriceps_cm);
  const calfMeasurementPair = resolveMeasurementMetricPair((measurement) => measurement.calf_cm);
  const measuresAllStatCards = [
    buildMeasurementStatCard("Peso", weightMeasurementPair.latest, weightMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} kg`, "kg", true),
    buildMeasurementStatCard("% Grasa", bodyFatMeasurementPair.latest, bodyFatMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)}%`, "%", true),
    buildMeasurementStatCard("Pecho", chestMeasurementPair.latest, chestMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
    buildMeasurementStatCard("Cintura", waistMeasurementPair.latest, waistMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", true),
    buildMeasurementStatCard("Cadera", hipsMeasurementPair.latest, hipsMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
    buildMeasurementStatCard("Brazo", armMeasurementPair.latest, armMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
    buildMeasurementStatCard("Cuello", neckMeasurementPair.latest, neckMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
    buildMeasurementStatCard("Cuádriceps", quadMeasurementPair.latest, quadMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
    buildMeasurementStatCard("Gemelo", calfMeasurementPair.latest, calfMeasurementPair.previous, (v) => `${formatMeasurementNumber(v)} cm`, "cm", false),
  ];
  const measuresStatCardRows: (typeof measuresAllStatCards)[] = [];
  for (let i = 0; i < measuresAllStatCards.length; i += 3) {
    measuresStatCardRows.push(measuresAllStatCards.slice(i, i + 3));
  }
  const measuresChartMetricMeta = MEASURES_CHART_METRIC_OPTIONS.find((o) => o.key === measuresChartMetric) ?? MEASURES_CHART_METRIC_OPTIONS[0];

  function extractMetricValue(m: Measurement): number | null {
    if (measuresChartMetricMeta.key === "bodyFat") {
      return estimateMeasurementBodyFatPercentage(m, latestBodyHeightCm, userSex);
    }
    const field = measuresChartMetricMeta.field;
    if (!field) return null;
    const v = m[field];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  const measuresDashboardChartPoints = useMemo(() => {
    const cutoffTime =
      measuresDashboardPeriodMeta.days === null
        ? null
        : Date.now() - measuresDashboardPeriodMeta.days * 24 * 60 * 60 * 1000;

    const filtered = [...store.measurements]
      .filter((m) => extractMetricValue(m) !== null)
      .filter((m) => {
        const t = new Date(m.measured_at).getTime();
        if (Number.isNaN(t)) return false;
        if (cutoffTime === null) return true;
        return t >= cutoffTime;
      })
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());

    const points = filtered
      .map((m) => {
        const t = new Date(m.measured_at).getTime();
        const v = extractMetricValue(m);
        if (Number.isNaN(t) || v === null) return null;
        const d = new Date(t);
        return {
          key: m.id,
          label: `${d.getDate()} ${DIET_MONTH_LABELS_SHORT[d.getMonth()]}`,
          value: v,
          timestamp: t,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (points.length === 0) return [];

    const values = points.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(0.4, maxValue - minValue);

    return points.map((point, index) => ({
      ...point,
      heightPercent: 24 + ((point.value - minValue) / range) * 64,
      isLatest: index === points.length - 1,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuresDashboardPeriodMeta.days, store.measurements, measuresChartMetric, latestBodyHeightCm, userSex]);

  const allMetricValues = useMemo(() => {
    return [...store.measurements]
      .filter((m) => extractMetricValue(m) !== null && !Number.isNaN(new Date(m.measured_at).getTime()))
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .map((m) => ({ timestamp: new Date(m.measured_at).getTime(), value: extractMetricValue(m) as number }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.measurements, measuresChartMetric, latestBodyHeightCm, userSex]);

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
    const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedSearch = strip(trainingSearch.trim());
    return store.templates.filter((template) => {
      const matchesSearch =
        !normalizedSearch || strip(template.name).includes(normalizedSearch);
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
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const search = normalize(exercisePickerSearch.trim());
    return exercisesRepo.filter((entry) => {
      const matchesSearch = !search || normalize(entry.name).includes(search) || normalize(entry.muscle_group).includes(search);
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
      Vibration.vibrate([0, 300, 150, 300]);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          staysActiveInBackground: true,
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
        // best effort: vibration still notifies the user
      }
    } finally {
      setTimeout(() => {
        restAlertLockRef.current = false;
      }, 450);
    }
  }, []);

  const stopBackgroundSilence = useCallback(async () => {
    if (bgHeartbeatRef.current) {
      clearInterval(bgHeartbeatRef.current);
      bgHeartbeatRef.current = null;
    }
    bgRestDeadlineRef.current = null;
    bgRestFiredRef.current = false;
    if (bgSilenceRef.current) {
      try {
        await bgSilenceRef.current.stopAsync();
        await bgSilenceRef.current.unloadAsync();
      } catch { /* ignore */ }
      bgSilenceRef.current = null;
    }
  }, []);

  const startBackgroundSilence = useCallback(async (seconds: number) => {
    await stopBackgroundSilence();
    if (seconds <= 0) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        staysActiveInBackground: true,
      });

      bgRestDeadlineRef.current = Date.now() + seconds * 1000;
      bgRestFiredRef.current = false;

      const { sound } = await Audio.Sound.createAsync(
        require("./assets/silence.wav"),
        { isLooping: true, volume: 0, shouldPlay: true },
      );
      bgSilenceRef.current = sound;

      // setInterval as heartbeat — the background audio session keeps the
      // Android process (and JS timers) alive so the interval should fire.
      bgHeartbeatRef.current = setInterval(() => {
        if (bgRestFiredRef.current) return;
        if (bgRestDeadlineRef.current && Date.now() >= bgRestDeadlineRef.current) {
          bgRestFiredRef.current = true;
          void playRestFinishedAlert();
          void stopBackgroundSilence();
        }
      }, 1000);
    } catch {
      // best effort
    }
  }, [playRestFinishedAlert, stopBackgroundSilence]);

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
      setActiveSeriesMenuId(null);
      setExpandedExerciseId(null);
      return;
    }
    if (activeTrainingTemplate.exercises.length === 0) {
      setActiveExerciseMenuId(null);
      setActiveSeriesMenuId(null);
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

        const [rawStore, secureApiKeys, rawSession, rawPrefs] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          readProviderApiKeysFromSecureStore(secureAvailable),
          AsyncStorage.getItem(SESSION_STORAGE_KEY),
          AsyncStorage.getItem(USER_PREFS_STORAGE_KEY),
        ]);

        // On web dev, prefer file-backed store over localStorage
        const devStoreRaw = !rawStore ? await loadDevStoreFile() : null;
        const effectiveRaw = rawStore || devStoreRaw;

        const baseStore = effectiveRaw
          ? normalizeStore(JSON.parse(effectiveRaw) as LocalStore)
          : Platform.OS === "web"
            ? createWebSeedStore()
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
          const parsedPrefs: UserPreferences = rawPrefs
            ? { ...DEFAULT_USER_PREFS, ...JSON.parse(rawPrefs) }
            : { ...DEFAULT_USER_PREFS };
          setUserPrefs(parsedPrefs);
          setMeasuresDashboardPeriod(parsedPrefs.chartPeriod);
          if (parsedPrefs.chartMetric) setMeasuresChartMetric(parsedPrefs.chartMetric);
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
    loadFoodsRepo().then(setFoodsRepo);
    loadPersonalFoods().then(setPersonalFoods);
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || providerSettingsInitializedRef.current) return;
    setProviderDraftByProvider(createProviderDraftMap(store.keys));
    setProviderConnectionStatus(createProviderConnectionStatusMap(store.keys));
    providerSettingsInitializedRef.current = true;
  }, [isHydrated, store.keys]);

  useEffect(() => {
    if (!isHydrated) return;

    const serialized = JSON.stringify(serializeStoreForAsyncStorage(store, secureStoreAvailable));
    Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, serialized),
      writeProviderApiKeysToSecureStore(store.keys, secureStoreAvailable),
      saveDevStoreFile(JSON.stringify(store)),
    ]).catch(() => {
      setError("No se pudo guardar en almacenamiento local/seguro.");
    });
  }, [isHydrated, secureStoreAvailable, store]);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(userPrefs)).catch(() => {});
  }, [isHydrated, userPrefs]);

  useEffect(() => {
    if (!isHydrated) return;
    savePersonalFoods(personalFoods).catch(() => {});
  }, [isHydrated, personalFoods]);

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
        void stopBackgroundSilence();
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
        setActiveWorkoutSession((prev) => {
          if (prev?.is_resting && prev.rest_seconds_left > 0) {
            void startBackgroundSilence(prev.rest_seconds_left);
          }
          return prev;
        });
      }
      appStateLastActiveRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [startBackgroundSilence, stopBackgroundSilence]);

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
    if (endedRestThisTick) {
      void stopBackgroundSilence();
      if (!manualRestSkipRef.current) {
        void playRestFinishedAlert();
      }
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
    stopBackgroundSilence,
    playRestFinishedAlert,
  ]);

  useEffect(() => {
    return () => {
      if (restFinishSoundRef.current) {
        restFinishSoundRef.current.unloadAsync().catch(() => {});
        restFinishSoundRef.current = null;
      }
      if (bgSilenceRef.current) {
        bgSilenceRef.current.unloadAsync().catch(() => {});
        bgSilenceRef.current = null;
      }
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

  function appendMessagesToThread(threadId: string, nextMessages: ChatMessage[]) {
    setStore((prev) => {
      const current = prev.messagesByThread[threadId] ?? [];
      return {
        ...prev,
        messagesByThread: {
          ...prev.messagesByThread,
          [threadId]: [...current, ...nextMessages],
        },
      };
    });
  }

  function updateThreadMessage(
    threadId: string,
    messageId: string,
    updater: (message: ChatMessage) => ChatMessage,
  ) {
    setStore((prev) => {
      const current = prev.messagesByThread[threadId] ?? [];
      let didChange = false;
      const next = current.map((message) => {
        if (message.id !== messageId) return message;
        const updated = updater(message);
        didChange = didChange || updated !== message;
        return updated;
      });
      if (!didChange) return prev;
      return {
        ...prev,
        messagesByThread: {
          ...prev.messagesByThread,
          [threadId]: next,
        },
      };
    });
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
    const assistantMessageId = uid("msg");
    let draftFlushTimer: ReturnType<typeof setTimeout> | null = null;
    setSendingChat(true);
    setError(null);

    try {
      const userInput = chatInput.trim();
      const createdAt = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: userInput,
        created_at: createdAt,
      };
      const assistantDraft: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thinking: null,
        is_streaming: true,
        created_at: createdAt,
      };

      const threadMessages = store.messagesByThread[threadId] ?? [];
      appendMessagesToThread(threadId, [userMessage, assistantDraft]);
      setExpandedThinking((prev) => ({ ...prev, [assistantMessageId]: true }));
      setChatInput("");

      let draftContent = "";
      let draftThinking: string | null = null;

      const flushAssistantDraft = (force = false) => {
        const apply = () => {
          const nextThinking = draftThinking && draftThinking.trim().length > 0 ? draftThinking : null;
          updateThreadMessage(threadId, assistantMessageId, (current) => {
            if (
              current.content === draftContent &&
              (current.thinking ?? null) === nextThinking &&
              current.is_streaming
            ) {
              return current;
            }
            return {
              ...current,
              content: draftContent,
              thinking: nextThinking,
              is_streaming: true,
            };
          });
        };

        if (force) {
          if (draftFlushTimer) {
            clearTimeout(draftFlushTimer);
            draftFlushTimer = null;
          }
          apply();
          return;
        }

        if (draftFlushTimer) return;
        draftFlushTimer = setTimeout(() => {
          draftFlushTimer = null;
          apply();
        }, 40);
      };

      const resetAssistantDraft = () => {
        draftContent = "";
        draftThinking = null;
        flushAssistantDraft(true);
      };

      const history = [...threadMessages, userMessage]
        .slice(-20)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      const [systemPrompt, personalDataFields] = await Promise.all([loadChatSystemPrompt(), loadPersonalData()]);
      const debugField = personalDataFields.find((f) => f.key === "debug");
      const fullSystemPrompt = debugField?.value
        ? `${systemPrompt}\n\n## Instrucciones de depuracion\n\n${debugField.value}`
        : systemPrompt;
      let assistantResult: AnthropicChatResult | null = null;
      const chatMessages = [{ role: "system" as const, content: fullSystemPrompt }, ...history];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            resetAssistantDraft();
          }
          assistantResult = await callProviderChatAPIWithTools(activeProvider, chatMessages, {
            setStore,
            onContentDelta: (_delta, aggregate) => {
              draftContent = aggregate;
              flushAssistantDraft();
            },
            onThinkingDelta: (_delta, aggregate) => {
              draftThinking = aggregate;
              flushAssistantDraft();
            },
          });
          if (assistantResult && assistantResult.content.trim().length > 0) break;
          assistantResult = null;
        } catch (retryErr) {
          const errMsg = retryErr instanceof Error ? retryErr.message : "";
          const isRetryable = /failed to fetch|network|timeout|econnrefused|econnreset|overloaded|529|503|429/i.test(errMsg);
          if (!isRetryable || attempt === 2) throw retryErr;
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        }
      }
      if (!assistantResult || assistantResult.content.trim().length === 0) {
        throw new Error("El modelo no devolvió contenido.");
      }

      if (draftFlushTimer) {
        clearTimeout(draftFlushTimer);
        draftFlushTimer = null;
      }
      updateThreadMessage(threadId, assistantMessageId, (current) => ({
        ...current,
        content: assistantResult.content,
        thinking: assistantResult.thinking,
        is_streaming: false,
      }));
      if (assistantResult.thinking?.trim()) {
        setExpandedThinking((prev) => ({ ...prev, [assistantMessageId]: false }));
      }
    } catch (err) {
      if (draftFlushTimer) {
        clearTimeout(draftFlushTimer);
        draftFlushTimer = null;
      }
      const message = err instanceof Error ? err.message : "No se pudo enviar mensaje al proveedor.";
      setError(message);
      updateThreadMessage(threadId, assistantMessageId, (current) => ({
        ...current,
        content: `Error de proveedor: ${message}`,
        thinking: null,
        is_streaming: false,
      }));
      setExpandedThinking((prev) => ({ ...prev, [assistantMessageId]: false }));
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
    // Use store.foodAIProvider if set
    if (store.foodAIProvider) {
      const match = store.keys.find(
        (item) => item.provider === store.foodAIProvider && item.api_key.trim().length > 0,
      );
      if (match) {
        return {
          ...match,
          api_key: match.api_key.trim(),
          model: normalizeProviderModel(match.provider, match.model),
        };
      }
    }
    // Fallback to previous logic
    const selectedProviderFromStore =
      foodEstimatorProvider &&
      store.keys.find(
        (item) => item.provider === foodEstimatorProvider.provider && item.api_key.trim().length > 0,
      );
    if (selectedProviderFromStore) {
      return {
        ...selectedProviderFromStore,
        api_key: selectedProviderFromStore.api_key.trim(),
        model: normalizeProviderModel(selectedProviderFromStore.provider, selectedProviderFromStore.model),
      };
    }
    return resolveFoodEstimatorProvider(store.keys);
  }

  function openFoodEstimatorModal() {
    const provider = store.foodAIProvider
      ? store.keys.find((k) => k.provider === store.foodAIProvider && k.api_key.trim()) ?? resolveFoodEstimatorProvider(store.keys)
      : resolveFoodEstimatorProvider(store.keys);
    setFoodEstimatorProvider(provider);
    setFoodEstimatorImages([]);
    setFoodEstimatorInput("");
    setFoodEstimatorSending(false); setFoodEstimatorStatus("");
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
    setFoodEstimatorSending(false); setFoodEstimatorStatus("");
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
    setFoodEstimatorStatus("Enviando...");
    setError(null);

    try {
      const estimatorHistory: ChatInputMessage[] = [
        { role: "system", content: FOOD_ESTIMATOR_SYSTEM_PROMPT },
        ...nextMessages.map<ChatInputMessage>((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      ];
      const isFollowUp = foodEstimatorMessages.some((m) => m.role === "assistant");
      let assistantContent: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          assistantContent = await callFoodEstimatorAPI(
            resolvedProvider,
            estimatorHistory,
            foodEstimatorImages,
            setFoodEstimatorStatus,
            isFollowUp,
          );
          if (assistantContent && assistantContent.trim().length > 0) break;
          assistantContent = null;
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : "";
          const isRetryable = /high demand|overloaded|rate.?limit|529|503|429|failed to fetch|network|timeout|econnrefused|econnreset/i.test(msg);
          if (!isRetryable || attempt === 2) throw retryErr;
          setFoodEstimatorStatus(`Reintentando (${attempt + 2}/3)...`);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        }
      }
      if (!assistantContent || assistantContent.trim().length === 0) {
        throw new Error("El modelo no devolvió contenido. Intenta reformular tu mensaje.");
      }
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
      setFoodEstimatorSending(false); setFoodEstimatorStatus("");
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
    setFoodEstimatorStatus("Generando datos nutricionales...");
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
        setFoodEstimatorStatus,
      );
      setFoodEstimatorStatus("Interpretando datos...");
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
      setFoodEstimatorSending(false); setFoodEstimatorStatus("");
    }
  }

  function openMeasurementEntryScreen() {
    setShowMeasurementDatePicker(false);
    setMeasuresDashboardPeriodDropdownOpen(false);
    setMeasurementEntryScreenOpen(true);
    setMeasurementDateTextInput(measurementDateFromSelection(new Date()).toISOString().slice(0, 10));
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
    setUserPrefs((prev) => ({ ...prev, chartPeriod: periodKey }));
  }

  function toggleMeasuresChartMetricDropdown() {
    setMeasuresChartMetricDropdownOpen((c) => !c);
  }

  function selectMeasuresChartMetric(key: MeasuresChartMetricKey) {
    setMeasuresChartMetric(key);
    setMeasuresChartMetricDropdownOpen(false);
    setUserPrefs((prev) => ({ ...prev, chartMetric: key }));
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
    setEditingMeasurementId(null);
  }

  function openMeasurementForEdit(m: Measurement) {
    setWeightInput(m.weight_kg !== null ? String(m.weight_kg) : "");
    setHeightInput(m.height_cm !== null ? String(m.height_cm) : "");
    setNeckInput(m.neck_cm !== null ? String(m.neck_cm) : "");
    setChestInput(m.chest_cm !== null ? String(m.chest_cm) : "");
    setWaistInput(m.waist_cm !== null ? String(m.waist_cm) : "");
    setHipsInput(m.hips_cm !== null ? String(m.hips_cm) : "");
    setBicepsInput(m.biceps_cm !== null ? String(m.biceps_cm) : "");
    setQuadricepsInput(m.quadriceps_cm !== null ? String(m.quadriceps_cm) : "");
    setCalfInput(m.calf_cm !== null ? String(m.calf_cm) : "");
    setMeasurementPhotoUri(m.photo_uri ?? null);
    const editDate = new Date(m.measured_at);
    setMeasurementDate(editDate);
    setMeasurementDateTextInput(editDate.toISOString().slice(0, 10));
    setEditingMeasurementId(m.id);
    setMeasurementEntryScreenOpen(true);
    setError(null);
  }

  function deleteMeasurement(id: string) {
    setStore((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.id !== id),
    }));
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
      id: editingMeasurementId ?? uid("measurement"),
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
      const base = editingMeasurementId
        ? prev.measurements.filter((m) => m.id !== editingMeasurementId)
        : prev.measurements;
      const nextMeasurements = sortMeasurementsDesc([measurement, ...base]).slice(0, 1826);
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

  function updateDietGoal(goal: DietGoal) {
    updateDietSettings((prev) => ({
      ...prev,
      goal,
    }));
  }

  function updateActivityLevel(level: ActivityLevel) {
    updateDietSettings((prev) => ({
      ...prev,
      activity_level: level,
    }));
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
    const weight = latestBodyWeightKg;
    const calPerGram = macro === "fat" ? 9 : 4;
    const gkgKey = macro === "protein" ? "protein_grams_per_kg" : macro === "carbs" ? "carbs_grams_per_kg" : "fat_grams_per_kg";
    updateDietSettings((prev) => {
      const kcal = parseFloat(value) || 0;
      const grams = kcal / calPerGram;
      const gkg = weight ? (grams / weight).toFixed(2) : "";
      return {
        ...prev,
        manual_macro_calories: { ...prev.manual_macro_calories, [macro]: value },
        [gkgKey]: kcal > 0 && weight ? gkg : prev[gkgKey],
      };
    });
  }

  function updateProteinGramsPerKg(value: string) {
    const weight = latestBodyWeightKg;
    updateDietSettings((prev) => {
      const gkg = parseFloat(value) || 0;
      const kcal = weight ? Math.round(gkg * weight * 4) : 0;
      return {
        ...prev,
        protein_grams_per_kg: value,
        manual_macro_calories: { ...prev.manual_macro_calories, protein: gkg > 0 && weight ? String(kcal) : prev.manual_macro_calories.protein },
      };
    });
  }

  function updateCarbsGramsPerKg(value: string) {
    const weight = latestBodyWeightKg;
    updateDietSettings((prev) => {
      const gkg = parseFloat(value) || 0;
      const kcal = weight ? Math.round(gkg * weight * 4) : 0;
      return {
        ...prev,
        carbs_grams_per_kg: value,
        manual_macro_calories: { ...prev.manual_macro_calories, carbs: gkg > 0 && weight ? String(kcal) : prev.manual_macro_calories.carbs },
      };
    });
  }

  function updateFatGramsPerKg(value: string) {
    const weight = latestBodyWeightKg;
    updateDietSettings((prev) => {
      const gkg = parseFloat(value) || 0;
      const kcal = weight ? Math.round(gkg * weight * 9) : 0;
      return {
        ...prev,
        fat_grams_per_kg: value,
        manual_macro_calories: { ...prev.manual_macro_calories, fat: gkg > 0 && weight ? String(kcal) : prev.manual_macro_calories.fat },
      };
    });
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
    field: "reps" | "weight_kg" | "rest_seconds" | "type" | "tempo_contraction" | "tempo_pause" | "tempo_relaxation",
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
    field: "reps" | "weight_kg" | "rest_seconds" | "type" | "tempo_contraction" | "tempo_pause" | "tempo_relaxation",
    value: string,
  ) {
    if (!activeTrainingTemplateId) return;
    updateExerciseSeriesFieldInTemplate(activeTrainingTemplateId, exerciseId, seriesId, field, value);
  }

  function updateExerciseSeriesFieldInActiveSession(
    exerciseId: string,
    seriesId: string,
    field: "reps" | "weight_kg" | "rest_seconds" | "type" | "tempo_contraction" | "tempo_pause" | "tempo_relaxation",
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
                type: lastSeries?.type,
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

  function removeSeriesFromExercise(exerciseId: string, seriesId: string) {
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
            if (existingSeries.length <= 1) return exercise;
            const nextSeries = existingSeries.filter((s) => s.id !== seriesId);
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

  function duplicateSeriesInExercise(exerciseId: string, seriesId: string) {
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
            const sourceIndex = existingSeries.findIndex((s) => s.id === seriesId);
            if (sourceIndex < 0) return exercise;
            const source = existingSeries[sourceIndex];
            const clone = {
              ...source,
              id: uid("set"),
              sub_series: source.sub_series?.map((ss) => ({ ...ss, id: uid("sub") })),
            };
            const nextSeries = [
              ...existingSeries.slice(0, sourceIndex + 1),
              clone,
              ...existingSeries.slice(sourceIndex + 1),
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

  function changeSeriesType(exerciseId: string, seriesId: string, newType: SeriesType) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextSeries = (exercise.series ?? []).map((s) => {
              if (s.id !== seriesId) return s;
              const isCompound = COMPOUND_SERIES_TYPES.includes(newType);
              const wasCompound = COMPOUND_SERIES_TYPES.includes(s.type ?? "normal");
              return {
                ...s,
                type: newType,
                sub_series: isCompound && !wasCompound
                  ? [{ id: uid("sub"), reps: s.reps || "10", weight_kg: s.weight_kg || "", rest_seconds: newType === "dropset" ? "0" : "" }]
                  : isCompound ? s.sub_series : undefined,
              };
            });
            return { ...exercise, series: nextSeries, sets: seriesToLegacySets(nextSeries) };
          }),
        };
      }),
    }));
  }

  function addSubSeriesToSeries(exerciseId: string, seriesId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextSeries = (exercise.series ?? []).map((s) => {
              if (s.id !== seriesId || !s.sub_series) return s;
              const last = s.sub_series[s.sub_series.length - 1];
              return {
                ...s,
                sub_series: [
                  ...s.sub_series,
                  {
                    id: uid("sub"),
                    reps: last?.reps || "10",
                    weight_kg: last?.weight_kg || "",
                    rest_seconds: (s.type ?? "normal") === "dropset" ? "0" : last?.rest_seconds || "",
                  },
                ],
              };
            });
            return { ...exercise, series: nextSeries, sets: seriesToLegacySets(nextSeries) };
          }),
        };
      }),
    }));
  }

  function removeSubSeriesFromSeries(exerciseId: string, seriesId: string, subSeriesId: string) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextSeries = (exercise.series ?? []).map((s) => {
              if (s.id !== seriesId || !s.sub_series || s.sub_series.length <= 1) return s;
              return { ...s, sub_series: s.sub_series.filter((ss) => ss.id !== subSeriesId) };
            });
            return { ...exercise, series: nextSeries, sets: seriesToLegacySets(nextSeries) };
          }),
        };
      }),
    }));
  }

  function updateSubSeriesField(
    exerciseId: string,
    seriesId: string,
    subSeriesId: string,
    field: "reps" | "weight_kg" | "rest_seconds" | "exercise_name" | "exercise_id",
    value: string,
  ) {
    if (!activeTrainingTemplateId) return;
    setStore((prev) => ({
      ...prev,
      templates: prev.templates.map((template) => {
        if (template.id !== activeTrainingTemplateId) return template;
        return {
          ...template,
          exercises: template.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) return exercise;
            const nextSeries = (exercise.series ?? []).map((s) => {
              if (s.id !== seriesId || !s.sub_series) return s;
              return {
                ...s,
                sub_series: s.sub_series.map((ss) =>
                  ss.id === subSeriesId ? { ...ss, [field]: value } : ss,
                ),
              };
            });
            return { ...exercise, series: nextSeries, sets: seriesToLegacySets(nextSeries) };
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
      chatProvider: provider,
      keys: prev.keys.map((item) =>
        item.provider === provider ? { ...item, is_active: true } : { ...item, is_active: false },
      ),
    }));
    setError(null);
  }

  function updateProviderConfig(
    provider: Provider,
    updates: Partial<Pick<AIKey, "api_key" | "model" | "reasoning_effort">>,
  ) {
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
      reasoning_effort:
        provider === "openai" ? DEFAULT_OPENAI_REASONING_EFFORT : null,
    };
    const nextModel = updates.model ?? currentDraft.model;
    const nextDraft: ProviderDraft = {
      api_key: updates.api_key ?? currentDraft.api_key,
      model: nextModel,
      reasoning_effort:
        provider === "openai"
          ? normalizeOpenAIReasoningEffort(
              updates.reasoning_effort ?? currentDraft.reasoning_effort,
              nextModel,
            )
          : null,
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
    updateProviderDraft("openai", {
      model: modelId,
      reasoning_effort: normalizeOpenAIReasoningEffort(
        providerDraftByProvider.openai?.reasoning_effort,
        modelId,
      ),
    });
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
    const normalizedModel = normalizeProviderModel(provider, draft.model);
    const normalizedReasoningEffort =
      provider === "openai"
        ? normalizeOpenAIReasoningEffort(draft.reasoning_effort, normalizedModel)
        : null;

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
        reasoning_effort: normalizedReasoningEffort,
      });
      updateProviderDraft(
        provider,
        {
          api_key: "",
          model: normalizedModel,
          reasoning_effort: normalizedReasoningEffort,
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
        reasoning_effort: normalizedReasoningEffort,
      });
      updateProviderDraft(
        provider,
        {
          api_key: normalizedApiKey,
          model: normalizedModel,
          reasoning_effort: normalizedReasoningEffort,
        },
        { markPending: false },
      );
    } else {
      updateProviderDraft(
        provider,
        {
          api_key: draft.api_key,
          model: normalizedModel,
          reasoning_effort: normalizedReasoningEffort,
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
              <TabTitle>Gymnasia</TabTitle>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            </View>
          </View>
        ) : tab === "training" && (isTrainingTemplateScreenOpen || activeWorkoutSession) ? null : tab === "training" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <TabTitle>{headerTitle}</TabTitle>
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
          <TabTitle>{headerTitle}</TabTitle>
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

                <PrimaryButton
                  label={homePrimaryActionLabel}
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
                  icon={<Feather name="play" size={16} color="#06090D" />}
                  testID="home-primary-training-action"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard
                  label="Calorías"
                  value={Math.round(dashboard.calories).toLocaleString("es-ES")}
                  subtitle={dietDailyCaloriesTarget > 0
                    ? `${Math.round(dashboard.calories)}/${Math.round(dietDailyCaloriesTarget)} kcal`
                    : "Consumidas hoy"}
                  icon={<Feather name="zap" size={14} color={mobileTheme.color.brandPrimary} />}
                />
                <StatCard
                  label="Peso"
                  value={dashboard.weight !== null ? formatMeasurementNumber(dashboard.weight) : "--"}
                  subtitle={dashboard.weight !== null ? homeWeightChangeText : "Sin registro"}
                  subtitleColor="#19C37D"
                  icon={<Feather name="activity" size={14} color={mobileTheme.color.brandPrimary} />}
                />
                <StatCard
                  label="Racha"
                  value={String(homeWorkoutStreak)}
                  subtitle={homeWorkoutStreak === 1 ? "día seguido" : "días seguidos"}
                  icon={<Feather name="award" size={14} color={mobileTheme.color.brandPrimary} />}
                />
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
                    const isExpanded = true;
                    const isCurrent = sessionExercise.isCurrentExercise;
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
                          borderWidth: isCurrent ? 1.5 : 1,
                          borderColor: isCurrent
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
                                  : isCurrent
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
                                    : isCurrent
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
                            ˅
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
                                Serie
                              </Text>
                              <Text style={{ width: 32, color: "#7D8798", fontSize: 10, fontWeight: "700", textAlign: "center" }}>
                                Tipo
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                Repeticiones
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                Peso (kg)
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 10, fontWeight: "700" }}>
                                Descanso (s)
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
                                    : (seriesState.series.type ?? "normal") === "warmup"
                                      ? "rgba(255,74,74,0.06)"
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
                                <Pressable
                                  onPress={() => setSeriesTypePickerTarget({
                                    exerciseId: sessionExercise.exercise.id,
                                    seriesId: seriesState.series.id,
                                    source: "session",
                                  })}
                                  style={{
                                    width: 32,
                                    height: 24,
                                    borderRadius: 6,
                                    backgroundColor: (seriesState.series.type ?? "normal") === "warmup" ? "rgba(255,74,74,0.2)" : "#202630",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 6,
                                  }}
                                >
                                  <Text style={{
                                    color: (seriesState.series.type ?? "normal") === "warmup" ? "#FF4A4A" : "#8C95A4",
                                    fontSize: 10,
                                    fontWeight: "700",
                                  }}>
                                    {SERIES_TYPE_META[seriesState.series.type ?? "normal"].short}
                                  </Text>
                                </Pressable>
                                <>
                                  {(seriesState.series.type ?? "normal") === "tempo" ? (
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 2 }}>
                                      {(["tempo_contraction", "tempo_pause", "tempo_relaxation"] as const).map((tf, ti) => (
                                        <View key={tf} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                          {ti > 0 && <Text style={{ color: "#7D8798", fontSize: 10 }}>-</Text>}
                                          <TextInput
                                            value={seriesState.series[tf] ?? ""}
                                            onChangeText={(v) => updateExerciseSeriesFieldInActiveSession(sessionExercise.exercise.id, seriesState.series.id, tf, v)}
                                            placeholder={["C","P","R"][ti]}
                                            placeholderTextColor="#8C95A4"
                                            keyboardType="number-pad"
                                            style={{
                                              flex: 1, minHeight: 34, borderRadius: 8, borderWidth: 1,
                                              borderColor: seriesState.isCompleted ? "rgba(203,255,26,0.8)" : "rgba(255,255,255,0.16)",
                                              backgroundColor: seriesState.isCompleted ? "rgba(6,9,13,0.32)" : "rgba(10,13,18,0.5)",
                                              color: seriesState.isCompleted ? mobileTheme.color.brandPrimary : "#C7CED9",
                                              fontSize: 13, fontWeight: "700", textAlign: "center",
                                            }}
                                          />
                                        </View>
                                      ))}
                                    </View>
                                  ) : (
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
                                      placeholder={(seriesState.series.type ?? "normal") === "isometric" ? "(s)" : "-"}
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
                                  )}
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

                <PrimaryButton
                  label="Empezar rutina"
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  icon={<Feather name="play" size={14} color="#06090D" />}
                />

                <ChartCard
                  zIndex={trainingStatsMetricDropdownOpen || trainingStatsPeriodDropdownOpen ? 10 : 1}
                  title={
                    <Pressable
                      onPress={() => setTrainingStatsMetricDropdownOpen((c) => !c)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                        {activeTrainingStatsMetricMeta.label}
                      </Text>
                      <Ionicons
                        name={trainingStatsMetricDropdownOpen ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={mobileTheme.color.textSecondary}
                      />
                    </Pressable>
                  }
                  periodSelector={
                    <Pressable
                      onPress={() => setTrainingStatsPeriodDropdownOpen((c) => !c)}
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
                        {TRAINING_STATS_PERIOD_OPTIONS.find((o) => o.key === trainingStatsPeriod)?.label ?? "3M"}
                      </Text>
                      <Ionicons
                        name={trainingStatsPeriodDropdownOpen ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="#6F7785"
                      />
                    </Pressable>
                  }
                >
                  {trainingStatsPeriodDropdownOpen ? (
                    <View style={{ position: "absolute", top: 56, right: 14, zIndex: 20, elevation: 12 }}>
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
                        {TRAINING_STATS_PERIOD_OPTIONS.map((option) => {
                          const isActive = trainingStatsPeriod === option.key;
                          return (
                            <Pressable
                              key={option.key}
                              onPress={() => { setTrainingStatsPeriod(option.key); setTrainingStatsPeriodDropdownOpen(false); }}
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
                              <Text style={{ color: isActive ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                                {option.label}
                              </Text>
                              {isActive ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {trainingStatsMetricDropdownOpen ? (
                    <View style={{ position: "absolute", top: 56, left: 14, zIndex: 20, elevation: 12 }}>
                      <View
                        style={{
                          minWidth: 150,
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
                        {TRAINING_STATS_METRIC_OPTIONS.map((option) => {
                          const isActive = trainingStatsMetric === option.key;
                          return (
                            <Pressable
                              key={option.key}
                              onPress={() => { setTrainingStatsMetric(option.key); setTrainingStatsMetricDropdownOpen(false); }}
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
                              <Text style={{ color: isActive ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                                {option.label}
                              </Text>
                              {isActive ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

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

                </ChartCard>

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

                <PrimaryButton
                  label="Empezar rutina"
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  icon={<Feather name="play" size={14} color="#06090D" />}
                  testID="training-detail-start-session"
                />
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

                <PrimaryButton
                  label="Empezar rutina"
                  onPress={() => startTrainingSession(activeTrainingTemplate.id)}
                  disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                  icon={<Feather name="play" size={14} color="#06090D" />}
                  testID="training-editor-start-session"
                />

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
                                  width: 32,
                                  color: "#7D8798",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                Tipo
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                Repeticiones
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                Peso (kg)
                              </Text>
                              <Text
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: "#7D8798",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textAlign: "center",
                                }}
                              >
                                Descanso (s)
                              </Text>
                              <View style={{ width: 16 }} />
                            </View>

                            {exerciseSeries.map((seriesItem, setIndex) => {
                              const canDelete = exerciseSeries.length > 1;
                              const seriesMenuKey = `${exercise.id}:${seriesItem.id}`;
                              const isSeriesMenuOpen = activeSeriesMenuId === seriesMenuKey;
                              const handleDelete = () => {
                                if (!canDelete) return;
                                setActiveSeriesMenuId(null);
                                Vibration.vibrate(50);
                                removeSeriesFromExercise(exercise.id, seriesItem.id);
                              };
                              return (
                                <View key={seriesItem.id} style={{ position: "relative", zIndex: isSeriesMenuOpen ? 100 : 0 }}>
                                <SwipeableSetRow
                                  onDelete={handleDelete}
                                  enabled={canDelete}
                                >
                                <View
                                  style={{
                                    minHeight: 36,
                                    borderBottomWidth:
                                      setIndex === exerciseSeries.length - 1 ? 0 : 1,
                                    borderBottomColor: "rgba(255,255,255,0.08)",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 10,
                                    backgroundColor: (seriesItem.type ?? "normal") === "warmup" ? "rgba(255,74,74,0.06)" : "transparent",
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
                                  <Pressable
                                    onPress={() => setSeriesTypePickerTarget({
                                      exerciseId: exercise.id,
                                      seriesId: seriesItem.id,
                                      source: "editor",
                                    })}
                                    style={{
                                      width: 32,
                                      height: 24,
                                      borderRadius: 6,
                                      backgroundColor: (seriesItem.type ?? "normal") === "warmup" ? "rgba(255,74,74,0.2)" : "#202630",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text style={{
                                      color: (seriesItem.type ?? "normal") === "warmup" ? "#FF4A4A" : "#8C95A4",
                                      fontSize: 10,
                                      fontWeight: "700",
                                    }}>
                                      {SERIES_TYPE_META[seriesItem.type ?? "normal"].short}
                                    </Text>
                                  </Pressable>
                                  {(seriesItem.type ?? "normal") === "tempo" ? (
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 1 }}>
                                      <TextInput
                                        value={seriesItem.tempo_contraction ?? ""}
                                        onChangeText={(v) => updateExerciseSeriesFieldInActiveTemplate(exercise.id, seriesItem.id, "tempo_contraction", v)}
                                        placeholder="C"
                                        placeholderTextColor="#8C95A4"
                                        keyboardType="number-pad"
                                        style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                      />
                                      <Text style={{ color: "#7D8798", fontSize: 10 }}>-</Text>
                                      <TextInput
                                        value={seriesItem.tempo_pause ?? ""}
                                        onChangeText={(v) => updateExerciseSeriesFieldInActiveTemplate(exercise.id, seriesItem.id, "tempo_pause", v)}
                                        placeholder="P"
                                        placeholderTextColor="#8C95A4"
                                        keyboardType="number-pad"
                                        style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                      />
                                      <Text style={{ color: "#7D8798", fontSize: 10 }}>-</Text>
                                      <TextInput
                                        value={seriesItem.tempo_relaxation ?? ""}
                                        onChangeText={(v) => updateExerciseSeriesFieldInActiveTemplate(exercise.id, seriesItem.id, "tempo_relaxation", v)}
                                        placeholder="R"
                                        placeholderTextColor="#8C95A4"
                                        keyboardType="number-pad"
                                        style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                      />
                                    </View>
                                  ) : (
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
                                      placeholder={(seriesItem.type ?? "normal") === "isometric" ? "(s)" : "-"}
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
                                  )}
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
                                  <Pressable
                                    onPress={() => setActiveSeriesMenuId(isSeriesMenuOpen ? null : seriesMenuKey)}
                                    hitSlop={8}
                                    style={{ width: 16, alignItems: "center", justifyContent: "center", gap: 2 }}
                                  >
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
                                  </Pressable>
                                </View>
                                </SwipeableSetRow>
                                {isSeriesMenuOpen && (
                                  <View
                                    style={{
                                      position: "absolute",
                                      top: 36,
                                      right: 4,
                                      width: 190,
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
                                        setActiveSeriesMenuId(null);
                                        duplicateSeriesInExercise(exercise.id, seriesItem.id);
                                      }}
                                      style={{
                                        minHeight: 40,
                                        paddingHorizontal: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 10,
                                      }}
                                    >
                                      <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16 }}>
                                        Duplicar serie
                                      </Text>
                                    </Pressable>
                                    <Pressable
                                      onPress={handleDelete}
                                      style={{
                                        minHeight: 40,
                                        borderTopWidth: 1,
                                        borderTopColor: "rgba(255,255,255,0.2)",
                                        marginTop: 4,
                                        paddingTop: 8,
                                        paddingHorizontal: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 10,
                                        opacity: canDelete ? 1 : 0.35,
                                      }}
                                      disabled={!canDelete}
                                    >
                                      <Feather name="trash-2" size={14} color="#FF4A4A" />
                                      <Text style={{ color: "#FF4A4A", fontSize: 16, fontWeight: "600" }}>
                                        Eliminar serie
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}
                                {COMPOUND_SERIES_TYPES.includes(seriesItem.type ?? "normal") && (
                                  <View style={{ marginLeft: 24, borderLeftWidth: 2, borderLeftColor: "#2A3240", paddingLeft: 8, paddingVertical: 4 }}>
                                    <Pressable
                                      onPress={() => setExpandedCompoundSeriesId(expandedCompoundSeriesId === seriesItem.id ? null : seriesItem.id)}
                                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                                    >
                                      <Feather
                                        name={expandedCompoundSeriesId === seriesItem.id ? "chevron-down" : "chevron-right"}
                                        size={12}
                                        color="#7D8798"
                                      />
                                      <Text style={{ color: "#7D8798", fontSize: 11, fontWeight: "600" }}>
                                        {(seriesItem.sub_series ?? []).length} mini-series
                                      </Text>
                                    </Pressable>
                                    {expandedCompoundSeriesId === seriesItem.id && (
                                      <>
                                        {(seriesItem.sub_series ?? []).map((sub, subIdx) => (
                                          <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 30, gap: 4, paddingRight: 4 }}>
                                            <Text style={{ width: 18, color: "#7D8798", fontSize: 10, textAlign: "center" }}>
                                              {subIdx + 1}
                                            </Text>
                                            {(seriesItem.type ?? "normal") === "superset" && (
                                              <Pressable
                                                onPress={() => {
                                                  setSupersetPickerTarget({ exerciseId: exercise.id, seriesId: seriesItem.id, subSeriesId: sub.id });
                                                  setExercisePickerSearch("");
                                                  setExercisePickerMuscleFilter("all");
                                                  setExercisePickerOpen(true);
                                                }}
                                                style={{ flex: 1, minHeight: 26, borderRadius: 6, backgroundColor: "#202630", justifyContent: "center", paddingHorizontal: 6 }}
                                              >
                                                <Text style={{ color: sub.exercise_name ? "#C7CED9" : "#7D8798", fontSize: 11 }} numberOfLines={1}>
                                                  {sub.exercise_name || "Ejercicio..."}
                                                </Text>
                                              </Pressable>
                                            )}
                                            <TextInput
                                              value={sub.reps}
                                              onChangeText={(v) => updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "reps", v)}
                                              placeholder="reps"
                                              placeholderTextColor="#7D8798"
                                              keyboardType="number-pad"
                                              style={{ flex: 1, color: "#C7CED9", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                            />
                                            <TextInput
                                              value={sub.weight_kg}
                                              onChangeText={(v) => updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "weight_kg", v)}
                                              placeholder="kg"
                                              placeholderTextColor="#7D8798"
                                              keyboardType="numbers-and-punctuation"
                                              style={{ flex: 1, color: "#C7CED9", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                            />
                                            {(seriesItem.type ?? "normal") !== "dropset" && (
                                              <TextInput
                                                value={sub.rest_seconds}
                                                onChangeText={(v) => updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "rest_seconds", v)}
                                                placeholder="desc"
                                                placeholderTextColor="#7D8798"
                                                keyboardType="number-pad"
                                                style={{ flex: 1, color: "#8C95A4", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                              />
                                            )}
                                            {(seriesItem.sub_series ?? []).length > 1 && (
                                              <Pressable
                                                onPress={() => removeSubSeriesFromSeries(exercise.id, seriesItem.id, sub.id)}
                                                hitSlop={6}
                                              >
                                                <Feather name="x" size={12} color="#7D8798" />
                                              </Pressable>
                                            )}
                                          </View>
                                        ))}
                                        <Pressable
                                          onPress={() => addSubSeriesToSeries(exercise.id, seriesItem.id)}
                                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                                        >
                                          <Feather name="plus" size={11} color="#7D8798" />
                                          <Text style={{ color: "#7D8798", fontSize: 11, fontWeight: "600" }}>Mini-serie</Text>
                                        </Pressable>
                                      </>
                                    )}
                                  </View>
                                )}
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

                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
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
                </View>

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
                                  style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}
                                  numberOfLines={1}
                                >
                                  {tpl.name}
                                </Text>
                                <View
                                  style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                                >
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                    <View
                                      style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: 999,
                                        backgroundColor: categoryMeta.color,
                                      }}
                                    />
                                    <Text style={{ color: categoryMeta.color, fontSize: 12, fontWeight: "700" }}>
                                      {categoryMeta.label}
                                    </Text>
                                  </View>
                                  <Text style={{ color: "#8892A2", fontSize: 12 }}>
                                    {durationMinutes > 0 ? `${durationMinutes} min` : "-- min"}
                                  </Text>
                                  <Text style={{ color: "#8892A2", fontSize: 12 }}>
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
                  Platform.OS === "web" ? (
                    <TextInput
                      value={selectedDietDate}
                      onChangeText={(text) => {
                        const parsed = new Date(text + "T12:00:00");
                        if (!isNaN(parsed.getTime())) {
                          setSelectedDietDate(text);
                        }
                      }}
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={mobileTheme.color.textSecondary}
                      style={{
                        minHeight: 44, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle,
                        borderRadius: 12, backgroundColor: mobileTheme.color.bgApp,
                        color: mobileTheme.color.textPrimary, paddingHorizontal: 12, fontSize: 14,
                      }}
                    />
                  ) : (
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
                  )
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
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "800" }}>
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
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
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
                          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
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

                        {isEditing && dietAddMode === "search" ? (
                          <View style={{ gap: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, paddingHorizontal: 10 }}>
                              <Feather name="search" size={14} color={mobileTheme.color.textSecondary} />
                              <TextInput
                                value={dietFoodSearch}
                                onChangeText={setDietFoodSearch}
                                placeholder="Buscar alimento..."
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                autoFocus
                                style={{ flex: 1, minHeight: 42, color: mobileTheme.color.textPrimary, fontSize: 14 }}
                              />
                              {dietFoodSearch ? (
                                <Pressable onPress={() => setDietFoodSearch("")}>
                                  <Feather name="x" size={16} color={mobileTheme.color.textSecondary} />
                                </Pressable>
                              ) : null}
                            </View>
                            {dietFoodSearch.trim().length > 0 ? (
                              <ScrollView style={{ maxHeight: 240 }}>
                                {[...foodsRepo, ...personalFoods]
                                  .filter((f) => f.name.toLowerCase().includes(dietFoodSearch.trim().toLowerCase()))
                                  .slice(0, 8)
                                  .map((entry) => (
                                    <Pressable
                                      key={entry.id}
                                      onPress={() => {
                                        setDietSelectedFood(entry);
                                        setDietSelectedGrams(String(entry.serving_size_g));
                                        setDietAddMode("selected");
                                        setDietFoodSearch("");
                                      }}
                                      style={{
                                        paddingVertical: 10,
                                        paddingHorizontal: 8,
                                        borderBottomWidth: 1,
                                        borderBottomColor: mobileTheme.color.borderSubtle,
                                      }}
                                    >
                                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "600" }}>
                                        {entry.name}
                                      </Text>
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, marginTop: 2 }}>
                                        {entry.calories_per_100g} kcal/100g · {entry.serving_description || `${entry.serving_size_g}g`}
                                      </Text>
                                    </Pressable>
                                  ))}
                                {[...foodsRepo, ...personalFoods].filter((f) => f.name.toLowerCase().includes(dietFoodSearch.trim().toLowerCase())).length === 0 ? (
                                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, padding: 10, fontStyle: "italic" }}>
                                    No se encontraron alimentos.
                                  </Text>
                                ) : null}
                              </ScrollView>
                            ) : null}
                            <Pressable
                              onPress={() => {
                                setDietMealEditorCategory(null);
                                setDietAddMode(null);
                                setDietFoodSearch("");
                              }}
                              style={{
                                minHeight: 36,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: mobileTheme.color.borderSubtle,
                                backgroundColor: mobileTheme.color.bgApp,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Cancelar</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        {isEditing && dietAddMode === "selected" && dietSelectedFood ? (() => {
                          const grams = parseFloat(dietSelectedGrams) || 0;
                          const ratio = grams / 100;
                          const cal = Math.round(dietSelectedFood.calories_per_100g * ratio);
                          const prot = Math.round(dietSelectedFood.protein_per_100g * ratio * 10) / 10;
                          const carbs = Math.round(dietSelectedFood.carbs_per_100g * ratio * 10) / 10;
                          const fat = Math.round(dietSelectedFood.fat_per_100g * ratio * 10) / 10;
                          return (
                            <View style={{ gap: 10 }}>
                              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 16 }}>
                                {dietSelectedFood.name}
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>Cantidad (g):</Text>
                                <TextInput
                                  value={dietSelectedGrams}
                                  onChangeText={setDietSelectedGrams}
                                  keyboardType="decimal-pad"
                                  autoFocus
                                  style={{
                                    flex: 1,
                                    minHeight: 42,
                                    borderWidth: 1,
                                    borderColor: mobileTheme.color.brandPrimary,
                                    borderRadius: mobileTheme.radius.md,
                                    backgroundColor: mobileTheme.color.bgApp,
                                    color: mobileTheme.color.textPrimary,
                                    paddingHorizontal: 12,
                                    fontSize: 16,
                                    fontWeight: "700",
                                  }}
                                />
                              </View>
                              <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                                {[
                                  { label: "Calorías", value: `${cal} kcal`, color: "#F7A547" },
                                  { label: "Proteína", value: `${prot} g`, color: "#4ECDC4" },
                                  { label: "Carbos", value: `${carbs} g`, color: "#77A8FF" },
                                  { label: "Grasa", value: `${fat} g`, color: "#FF6B6B" },
                                ].map((m) => (
                                  <View key={m.label} style={{ alignItems: "center", minWidth: 65 }}>
                                    <Text style={{ color: m.color, fontSize: 16, fontWeight: "700" }}>{m.value}</Text>
                                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{m.label}</Text>
                                  </View>
                                ))}
                              </View>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <Pressable
                                  onPress={() => {
                                    if (grams <= 0 || !dietMealEditorCategory) return;
                                    const newItem: DietItem = {
                                      id: uid("food"),
                                      title: dietSelectedFood.name,
                                      calories_kcal: cal,
                                      protein_g: prot,
                                      carbs_g: carbs,
                                      fat_g: fat,
                                    };
                                    const activeDietDate = selectedDietDate;
                                    const cat = dietMealEditorCategory;
                                    setStore((prev) => {
                                      const currentDay = prev.dietByDate[activeDietDate] ?? { day_date: activeDietDate, meals: [] };
                                      const existingMeal = currentDay.meals.find((m) => m.title === cat);
                                      const updatedMeals = existingMeal
                                        ? currentDay.meals.map((m) => m.id === existingMeal.id ? { ...m, items: [...m.items, newItem] } : m)
                                        : [...currentDay.meals, { id: uid("meal"), title: cat, items: [newItem] }].sort((a, b) => DIET_MEAL_CATEGORIES.indexOf(a.title as DietMealCategory) - DIET_MEAL_CATEGORIES.indexOf(b.title as DietMealCategory));
                                      return { ...prev, dietByDate: { ...prev.dietByDate, [activeDietDate]: { ...currentDay, meals: updatedMeals } } };
                                    });
                                    setDietAddMode(null);
                                    setDietSelectedFood(null);
                                    setDietMealEditorCategory(null);
                                  }}
                                  style={{
                                    flex: 1,
                                    minHeight: 42,
                                    borderRadius: mobileTheme.radius.md,
                                    backgroundColor: mobileTheme.color.brandPrimary,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text style={{ color: "#000", fontWeight: "700" }}>Guardar</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => { setDietAddMode("search"); setDietSelectedFood(null); setDietSelectedGrams(""); }}
                                  style={{
                                    flex: 1,
                                    minHeight: 42,
                                    borderRadius: mobileTheme.radius.md,
                                    borderWidth: 1,
                                    borderColor: mobileTheme.color.borderSubtle,
                                    backgroundColor: mobileTheme.color.bgApp,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "700" }}>Volver</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })() : null}

                        {isEditing && (dietAddMode === "form" || dietAddMode === null) ? (
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
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, width: 110 }}>Calorías (kcal)</Text>
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
                                value={mealCaloriesInput}
                                onChangeText={setMealCaloriesInput}
                                placeholder="Calorías (kcal)"
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={{ gap: 8 }}>
                              {[
                                { label: "Proteínas (g)", value: mealProteinInput, setter: setMealProteinInput },
                                { label: "Carbohidratos (g)", value: mealCarbsInput, setter: setMealCarbsInput },
                                { label: "Grasas (g)", value: mealFatInput, setter: setMealFatInput },
                              ].map((field) => (
                                <View key={field.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, width: 110 }}>{field.label}</Text>
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
                                    value={field.value}
                                    onChangeText={field.setter}
                                    placeholder={field.label}
                                    placeholderTextColor={mobileTheme.color.textSecondary}
                                    keyboardType="decimal-pad"
                                  />
                                </View>
                              ))}
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
                                  setDietAddMode(null);
                                  setDietFoodSearch("");
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

                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <Pressable
                            onPress={() => { setDietAddMode("search"); openDietMealEditor(category); setDietFoodSearch(""); }}
                            style={{
                              flex: 1,
                              minHeight: 38,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 4,
                              backgroundColor: mobileTheme.color.bgApp,
                            }}
                          >
                            <Feather name="search" size={13} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Buscar</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { setDietAddMode("form"); openDietMealEditor(category); }}
                            style={{
                              flex: 1,
                              minHeight: 38,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 4,
                              backgroundColor: mobileTheme.color.bgApp,
                            }}
                          >
                            <Feather name="edit-3" size={13} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Formulario</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { setDietAddMode("ai"); openDietMealEditor(category); openFoodEstimatorModal(); }}
                            style={{
                              flex: 1,
                              minHeight: 38,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 4,
                              backgroundColor: mobileTheme.color.bgApp,
                            }}
                          >
                            <Feather name="cpu" size={13} color={mobileTheme.color.textSecondary} />
                            <Text style={{ color: mobileTheme.color.textSecondary, fontWeight: "600", fontSize: 12 }}>Con IA</Text>
                          </Pressable>
                        </View>
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

              {measuresStatCardRows.map((row, rowIdx) => (
                <View key={`measures-row-${rowIdx}`} style={{ flexDirection: "row", gap: 10 }}>
                  {row.map((card) => (
                    <StatCard
                      key={card.label}
                      label={card.label}
                      value={card.valueText}
                      subtitle={card.changeText}
                      subtitleColor={card.changeColor}
                      subtitleIcon={<Feather name={card.changeIcon} size={11} color={card.changeColor} style={{ marginTop: 2 }} />}
                    />
                  ))}
                </View>
              ))}

              <ChartCard
                zIndex={measuresChartMetricDropdownOpen || measuresDashboardPeriodDropdownOpen ? 10 : 1}
                title={
                  <Pressable
                    onPress={toggleMeasuresChartMetricDropdown}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                      {measuresChartMetricMeta.label}
                    </Text>
                    <Ionicons
                      name={measuresChartMetricDropdownOpen ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={mobileTheme.color.textSecondary}
                    />
                  </Pressable>
                }
                periodSelector={
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
                }
              >

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

                {measuresChartMetricDropdownOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 56,
                      left: 14,
                      zIndex: 20,
                      elevation: 12,
                    }}
                  >
                    <View
                      style={{
                        minWidth: 150,
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
                      {MEASURES_CHART_METRIC_OPTIONS.map((option) => {
                        const isActive = measuresChartMetric === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => selectMeasuresChartMetric(option.key)}
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
                        {store.measurements.some((m) => extractMetricValue(m) !== null)
                          ? `No hay registros de ${measuresChartMetricMeta.label.toLowerCase()} suficientes para este periodo.`
                          : `Registra ${measuresChartMetricMeta.label.toLowerCase()} para ver la evolución.`}
                      </Text>
                    </View>
                  ) : (
                    <>
                      {(() => {
                        const chartW = 300;
                        const chartH = 160;
                        const padL = 36;
                        const padR = 12;
                        const padT = 8;
                        const padB = 24;
                        const plotW = chartW - padL - padR;
                        const plotH = chartH - padT - padB;
                        const pts = measuresDashboardChartPoints;
                        const vals = pts.map((p) => p.value);
                        const rawMin = Math.min(...vals);
                        const rawMax = Math.max(...vals);
                        const minV = Math.floor(rawMin) - 1;
                        const maxV = Math.ceil(rawMax) + 1;
                        const rangeV = Math.max(0.4, maxV - minV);
                        const minT = pts[0].timestamp;
                        const maxT = pts[pts.length - 1].timestamp;
                        const rangeT = Math.max(1, maxT - minT);
                        const coords = pts.map((p) => ({
                          x: padL + (pts.length === 1 ? plotW / 2 : ((p.timestamp - minT) / rangeT) * plotW),
                          y: padT + plotH - ((p.value - minV) / rangeV) * plotH,
                        }));

                        // Smooth curve using cardinal spline
                        let linePath = "";
                        if (coords.length === 1) {
                          linePath = `M${coords[0].x},${coords[0].y}L${coords[0].x},${coords[0].y}`;
                        } else if (coords.length === 2) {
                          linePath = `M${coords[0].x},${coords[0].y}L${coords[1].x},${coords[1].y}`;
                        } else {
                          linePath = `M${coords[0].x},${coords[0].y}`;
                          for (let i = 0; i < coords.length - 1; i++) {
                            const p0 = coords[Math.max(0, i - 1)];
                            const p1 = coords[i];
                            const p2 = coords[i + 1];
                            const p3 = coords[Math.min(coords.length - 1, i + 2)];
                            const cp1x = p1.x + (p2.x - p0.x) / 6;
                            const cp1y = p1.y + (p2.y - p0.y) / 6;
                            const cp2x = p2.x - (p3.x - p1.x) / 6;
                            const cp2y = p2.y - (p3.y - p1.y) / 6;
                            linePath += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                          }
                        }

                        const areaPath = linePath + `L${coords[coords.length - 1].x},${padT + plotH}L${coords[0].x},${padT + plotH}Z`;

                        // Compute MA using full history (not just visible range)
                        function computeMaFromFullHistory(window: number): Array<{ x: number; y: number }> {
                          const result: Array<{ x: number; y: number }> = [];
                          for (let i = 0; i < pts.length; i++) {
                            // Find this point's index in the full history
                            const fullIdx = allMetricValues.findIndex((v) => v.timestamp === pts[i].timestamp);
                            if (fullIdx === -1) {
                              // Fallback: use only visible data
                              const start = Math.max(0, i - window + 1);
                              const w = vals.slice(start, i + 1);
                              const avg = w.reduce((s, v) => s + v, 0) / w.length;
                              result.push({ x: coords[i].x, y: padT + plotH - ((avg - minV) / rangeV) * plotH });
                            } else {
                              const start = Math.max(0, fullIdx - window + 1);
                              const w = allMetricValues.slice(start, fullIdx + 1).map((v) => v.value);
                              const avg = w.reduce((s, v) => s + v, 0) / w.length;
                              result.push({ x: coords[i].x, y: padT + plotH - ((avg - minV) / rangeV) * plotH });
                            }
                          }
                          return result;
                        }
                        const maCoords = computeMaFromFullHistory(10);
                        function buildMaPath(maCoords: Array<{ x: number; y: number }>): string {
                          if (maCoords.length === 1) return `M${maCoords[0].x},${maCoords[0].y}L${maCoords[0].x},${maCoords[0].y}`;
                          if (maCoords.length === 2) return `M${maCoords[0].x},${maCoords[0].y}L${maCoords[1].x},${maCoords[1].y}`;
                          let path = `M${maCoords[0].x},${maCoords[0].y}`;
                          for (let i = 0; i < maCoords.length - 1; i++) {
                            const p0 = maCoords[Math.max(0, i - 1)];
                            const p1 = maCoords[i];
                            const p2 = maCoords[i + 1];
                            const p3 = maCoords[Math.min(maCoords.length - 1, i + 2)];
                            const cp1x = p1.x + (p2.x - p0.x) / 6;
                            const cp1y = p1.y + (p2.y - p0.y) / 6;
                            const cp2x = p2.x - (p3.x - p1.x) / 6;
                            const cp2y = p2.y - (p3.y - p1.y) / 6;
                            path += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                          }
                          return path;
                        }
                        const maPath = buildMaPath(maCoords);

                        const ma30Coords = computeMaFromFullHistory(30);
                        const ma30Path = buildMaPath(ma30Coords);

                        // Scale labels
                        const midV = minV + rangeV / 2;
                        const gridLines = [
                          { y: padT, label: formatMeasurementNumber(maxV) },
                          { y: padT + plotH / 2, label: formatMeasurementNumber(midV) },
                          { y: padT + plotH, label: formatMeasurementNumber(minV) },
                        ];

                        // X-axis labels: show first, last, and middle
                        const labelIndices = new Set<number>();
                        labelIndices.add(0);
                        labelIndices.add(pts.length - 1);
                        if (pts.length > 2) labelIndices.add(Math.floor(pts.length / 2));
                        if (pts.length > 4) {
                          labelIndices.add(Math.floor(pts.length / 4));
                          labelIndices.add(Math.floor((3 * pts.length) / 4));
                        }

                        return (
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", gap: 12, marginBottom: 6, paddingLeft: padL }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <View style={{ width: 16, height: 0, borderTopWidth: 2, borderTopColor: "#7EC8FF", borderStyle: "dashed" }} />
                                <Text style={{ color: "#7EC8FF", fontSize: 8, fontWeight: "600" }}>Media 10 valores</Text>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <View style={{ width: 16, height: 0, borderTopWidth: 2, borderTopColor: "#2B5C8A", borderStyle: "dotted" }} />
                                <Text style={{ color: "#2B5C8A", fontSize: 8, fontWeight: "600" }}>Media 30 valores</Text>
                              </View>
                            </View>
                            <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                              <Defs>
                                <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <Stop offset="0" stopColor={mobileTheme.color.brandPrimary} stopOpacity="0.35" />
                                  <Stop offset="1" stopColor={mobileTheme.color.brandPrimary} stopOpacity="0.02" />
                                </LinearGradient>
                              </Defs>

                              {gridLines.map((gl, i) => (
                                <Path
                                  key={`grid-${i}`}
                                  d={`M${padL},${gl.y}L${chartW - padR},${gl.y}`}
                                  stroke="rgba(255,255,255,0.06)"
                                  strokeWidth={1}
                                />
                              ))}

                              <Path d={areaPath} fill="url(#areaGrad)" />
                              <Path d={linePath} fill="none" stroke={mobileTheme.color.brandPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.5} />
                              {pts.length >= 3 ? (
                                <Path d={maPath} fill="none" stroke="#7EC8FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.6} strokeDasharray="6,4" />
                              ) : null}
                              {pts.length >= 3 ? (
                                <Path d={ma30Path} fill="none" stroke="#2B5C8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} strokeDasharray="2,4" />
                              ) : null}

                              {coords.map((c, i) => (
                                <Circle
                                  key={pts[i].key}
                                  cx={c.x}
                                  cy={c.y}
                                  r={1}
                                  fill={mobileTheme.color.brandPrimary}
                                />
                              ))}
                            </Svg>

                            <View style={{ height: 16, position: "relative", marginLeft: padL, marginRight: padR }}>
                              {(() => {
                                const NUM_LABELS = 4;
                                const startD = new Date(minT);
                                const endD = new Date(maxT);
                                const labels: Array<{ label: string }> = [];
                                const period = measuresDashboardPeriod;

                                // Check if range spans multiple years
                                const startYear = startD.getFullYear();
                                const endYear = endD.getFullYear();
                                const multiYear = startYear !== endYear;

                                const fmtMonth = (d: Date) => {
                                  const m = DIET_MONTH_LABELS_SHORT[d.getMonth()];
                                  return multiYear ? `${m} '${String(d.getFullYear()).slice(2)}` : m;
                                };
                                const fmtDay = (d: Date) => {
                                  const day = d.getDate();
                                  const m = DIET_MONTH_LABELS_SHORT[d.getMonth()];
                                  return multiYear ? `${day} ${m} '${String(d.getFullYear()).slice(2)}` : `${day} ${m}`;
                                };

                                if (period === "all" || period === "6m") {
                                  for (let i = 0; i < NUM_LABELS; i++) {
                                    const t = minT + (rangeT * i) / (NUM_LABELS - 1);
                                    labels.push({ label: fmtMonth(new Date(t)) });
                                  }
                                } else {
                                  // 3m or 1m: day + month labels
                                  for (let i = 0; i < NUM_LABELS; i++) {
                                    const t = minT + (rangeT * i) / (NUM_LABELS - 1);
                                    labels.push({ label: fmtDay(new Date(t)) });
                                  }
                                }

                                return labels.map((m, i) => {
                                  const xPct = (i / (NUM_LABELS - 1)) * 100;
                                  return (
                                    <Text
                                      key={`lbl-${i}`}
                                      style={{
                                        position: "absolute",
                                        left: `${xPct}%`,
                                        transform: [{ translateX: -28 }],
                                        width: 56,
                                        textAlign: "center",
                                        color: "#7F8795",
                                        fontSize: 9,
                                        fontWeight: "600",
                                      }}
                                      numberOfLines={1}
                                    >
                                      {m.label}
                                    </Text>
                                  );
                                });
                              })()}
                            </View>

                            <View style={{ position: "absolute", top: 0, left: 0 }}>
                              {gridLines.map((gl, i) => (
                                <Text
                                  key={`label-${i}`}
                                  style={{
                                    position: "absolute",
                                    top: gl.y - 6,
                                    left: 0,
                                    color: "#4E5665",
                                    fontSize: 10,
                                  }}
                                >
                                  {gl.label}
                                </Text>
                              ))}
                            </View>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </ChartCard>

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
                      const currentMetricValue = extractMetricValue(measurement);
                      const previousMetricMeasurement =
                        currentMetricValue === null
                          ? null
                          : store.measurements
                              .slice(sourceIndex + 1)
                              .find((entry) => extractMetricValue(entry) !== null) ?? null;
                      const previousMetricValue = previousMetricMeasurement ? extractMetricValue(previousMetricMeasurement) : null;
                      const metricDelta =
                        currentMetricValue !== null && previousMetricValue !== null
                          ? Math.round((currentMetricValue - previousMetricValue) * 10) / 10
                          : null;
                      const changeIsDecrease = metricDelta !== null && metricDelta < 0;
                      const prefersDecrease = measuresChartMetricMeta.key === "weight" || measuresChartMetricMeta.key === "bodyFat" || measuresChartMetricMeta.key === "waist";
                      const changeBadgeColor =
                        metricDelta === null
                          ? "#6F7785"
                          : (prefersDecrease ? changeIsDecrease : !changeIsDecrease)
                            ? "#19C37D"
                            : mobileTheme.color.brandPrimary;
                      const changeBadgeBackground =
                        metricDelta === null
                          ? "rgba(127,135,149,0.14)"
                          : (prefersDecrease ? changeIsDecrease : !changeIsDecrease)
                            ? "rgba(25,195,125,0.14)"
                            : "rgba(203,255,26,0.12)";

                      return (
                        <Pressable
                          key={measurement.id}
                          onPress={() => openMeasurementForEdit(measurement)}
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
                              {buildMeasurementHistorySummary(measurement, latestBodyHeightCm, userSex)}
                            </Text>
                          </View>

                          {metricDelta !== null ? (
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
                                {formatMeasurementNumber(Math.abs(metricDelta))} {measuresChartMetricMeta.unit}
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

              {store.measurements.some((m) => m.photo_uri) ? (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "800", fontSize: 20 }}>
                    Fotos de progreso
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {store.measurements
                      .filter((m) => m.photo_uri)
                      .map((m) => (
                        <Pressable key={m.id} onPress={() => setExpandedPhotoUri(m.photo_uri)} style={{ width: "31%", aspectRatio: 1, borderRadius: 14, overflow: "hidden" }}>
                          <Image
                            source={{ uri: m.photo_uri! }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                              {formatMeasurementHistoryDate(m.measured_at)}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {tab === "chat" ? (
            store.keys.some((k) => k.api_key.trim()) ? (
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
                  <View key={msg.id} style={{ gap: 4 }}>
                    {msg.role === "assistant" && msg.thinking ? (
                      <Pressable
                        onPress={() => setExpandedThinking((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                        style={{
                          borderWidth: 1,
                          borderColor: "rgba(147,112,219,0.35)",
                          backgroundColor: "rgba(147,112,219,0.06)",
                          borderRadius: mobileTheme.radius.md,
                          padding: 10,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Feather name="cpu" size={12} color="rgba(147,112,219,0.8)" />
                          <Text style={{ color: "rgba(147,112,219,0.8)", fontSize: 12, fontWeight: "600", flex: 1 }}>
                            Razonamiento
                          </Text>
                          <Feather
                            name={expandedThinking[msg.id] ? "chevron-up" : "chevron-down"}
                            size={14}
                            color="rgba(147,112,219,0.6)"
                          />
                        </View>
                        {expandedThinking[msg.id] ? (
                          <ScrollView style={{ maxHeight: 200, marginTop: 8 }} nestedScrollEnabled>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 18, fontStyle: "italic" }}>
                              {msg.thinking}
                            </Text>
                          </ScrollView>
                        ) : null}
                      </Pressable>
                    ) : null}
                    <View
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
                      {msg.content.trim() ? (
                        <Text style={{ color: mobileTheme.color.textPrimary, marginTop: 4 }}>{msg.content}</Text>
                      ) : null}
                      {msg.is_streaming ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginTop: msg.content.trim() ? 8 : 4,
                          }}
                        >
                          <ActivityIndicator size="small" color={mobileTheme.color.textSecondary} />
                          <Text
                            style={{
                              color: mobileTheme.color.textSecondary,
                              fontSize: 13,
                              fontStyle: "italic",
                            }}
                          >
                            {chatThinkingLabel}...
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TextInput
                style={{
                  minHeight: 44,
                  maxHeight: 120,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgSurface,
                  color: mobileTheme.color.textPrimary,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlignVertical: "top",
                }}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Pregunta al coach (API proveedor)"
                placeholderTextColor={mobileTheme.color.textSecondary}
                multiline
                blurOnSubmit={false}
              />

              <PrimaryButton
                label={sendingChat ? "Enviando..." : "Enviar"}
                onPress={sendMessage}
                disabled={sendingChat}
              />
            </View>
            ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 }}>
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                <Feather name="key" size={40} color="rgba(255,255,255,0.25)" />
              </View>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
                API Key no configurada
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22 }}>
                Para usar el asistente IA necesitas configurar tu API Key. Obtén una API key de tu proveedor y añádela en los ajustes de la app.
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(100,149,237,0.08)", borderWidth: 1, borderColor: "rgba(100,149,237,0.25)", borderRadius: mobileTheme.radius.md, padding: 14 }}>
                <Feather name="info" size={16} color="rgba(100,149,237,0.9)" />
                <Text style={{ color: "rgba(100,149,237,0.9)", fontSize: 13, flex: 1, lineHeight: 19 }}>
                  Gymnasia guarda tus API keys solo en tu dispositivo, no las guarda en ningún otro lugar.
                </Text>
              </View>
              <Pressable
                onPress={() => { setTab("settings"); setSettingsTab("provider"); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, width: "100%", marginTop: 4 }}
              >
                <Ionicons name="settings-sharp" size={18} color="#06090D" />
                <Text style={{ color: "#06090D", fontWeight: "800", fontSize: 16 }}>Ir a Ajustes BYOK</Text>
              </Pressable>
              <Pressable onPress={() => setShowByokExplain((v) => !v)}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
                  {showByokExplain ? "Ocultar" : "¿Qué es BYOK?"}
                </Text>
              </Pressable>
              {showByokExplain ? (
                <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: mobileTheme.radius.md, padding: 14 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 20 }}>
                    BYOK significa "Bring Your Own Key" (Trae Tu Propia Clave). Gymnasia no incluye acceso a ningún proveedor de IA. Tú proporcionas tu propia API key de OpenAI, Anthropic o Google, y las conversaciones se envían directamente desde tu dispositivo al proveedor. Tu clave nunca sale de tu teléfono.
                  </Text>
                </View>
              ) : null}
            </View>
            )
          ) : null}

          {tab === "settings" ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SETTINGS_TAB_OPTIONS.map((option) => {
                  const isActive = settingsTab === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => { setSettingsTab(option.key); setSelectedExerciseDetail(null); setSelectedFoodDetail(null); setSelectedPersonalFoodDetail(null); setPersonalFoodFormVisible(false); setPersonalFoodAIChatOpen(false); }}
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
                    Define tu objetivo y las calorías diarias.
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10, alignSelf: "center" }}>Sexo</Text>
                    {(["male", "female"] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => updateDietSettings((prev) => ({ ...prev, sex: s }))}
                        style={{
                          flex: 1,
                          minHeight: 36,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: (dietSettings.sex ?? "male") === s ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
                          backgroundColor: (dietSettings.sex ?? "male") === s ? "rgba(203,255,26,0.12)" : mobileTheme.color.bgApp,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: (dietSettings.sex ?? "male") === s ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary, fontWeight: "700", fontSize: 13 }}>
                          {s === "male" ? "Hombre" : "Mujer"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                    <View style={{ flex: 0.7, gap: 2 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>Altura</Text>
                      <TextInput
                        value={dietSettings.height_cm ?? (latestBodyHeightCm ? String(latestBodyHeightCm) : "")}
                        onChangeText={(v) => updateDietSettings((prev) => ({ ...prev, height_cm: v }))}
                        placeholder="cm"
                        placeholderTextColor={mobileTheme.color.textSecondary}
                        keyboardType="decimal-pad"
                        style={{
                          minHeight: 40,
                          borderRadius: mobileTheme.radius.md,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: mobileTheme.color.bgApp,
                          color: mobileTheme.color.textPrimary,
                          paddingHorizontal: 10,
                          fontSize: 14,
                        }}
                      />
                    </View>
                    <View style={{ flex: 0.7, gap: 2 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>Peso</Text>
                      <View style={{
                        minHeight: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        justifyContent: "center",
                        paddingHorizontal: 10,
                      }}>
                        <Text style={{ color: latestBodyWeightKg ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>
                          {latestBodyWeightKg ? `${latestBodyWeightKg}` : "—"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 0.6, gap: 2 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>Edad</Text>
                      <View style={{
                        minHeight: 40,
                        borderRadius: mobileTheme.radius.md,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: mobileTheme.color.bgApp,
                        justifyContent: "center",
                        paddingHorizontal: 10,
                      }}>
                        <Text style={{ color: dietSettings.birth_date ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>
                          {dietSettings.birth_date ? `${Math.floor((Date.now() - new Date(dietSettings.birth_date).getTime()) / 31557600000)}` : "—"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1.5, gap: 2 }}>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>F. Nacimiento</Text>
                      {Platform.OS === "web" ? (
                        <TextInput
                          value={dietSettings.birth_date ?? ""}
                          onChangeText={(v) => {
                            updateDietSettings((prev) => ({ ...prev, birth_date: v }));
                          }}
                          placeholder="AAAA-MM-DD"
                          placeholderTextColor={mobileTheme.color.textSecondary}
                          style={{
                            minHeight: 40,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: mobileTheme.color.bgApp,
                            color: mobileTheme.color.textPrimary,
                            paddingHorizontal: 10,
                            fontSize: 14,
                          }}
                        />
                      ) : (
                        <>
                          <Pressable
                            onPress={() => setShowBirthDatePicker(true)}
                            style={{
                              minHeight: 40,
                              borderRadius: mobileTheme.radius.md,
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              backgroundColor: mobileTheme.color.bgApp,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingHorizontal: 10,
                            }}
                          >
                            <Text style={{ color: dietSettings.birth_date ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>
                              {dietSettings.birth_date || "Seleccionar"}
                            </Text>
                            <Feather name="calendar" size={14} color={mobileTheme.color.textSecondary} />
                          </Pressable>
                          {showBirthDatePicker ? (
                            Platform.OS === "web" ? (
                              <TextInput
                                value={dietSettings.birth_date || ""}
                                onChangeText={(text) => {
                                  updateDietSettings((prev) => ({ ...prev, birth_date: text }));
                                }}
                                placeholder="AAAA-MM-DD"
                                placeholderTextColor={mobileTheme.color.textSecondary}
                                style={{
                                  minHeight: 40, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle,
                                  borderRadius: 12, backgroundColor: mobileTheme.color.bgApp,
                                  color: mobileTheme.color.textPrimary, paddingHorizontal: 10, fontSize: 14,
                                }}
                              />
                            ) : (
                              <DateTimePicker
                                value={dietSettings.birth_date ? new Date(dietSettings.birth_date) : new Date(1990, 0, 1)}
                                mode="date"
                                display={Platform.OS === "ios" ? "spinner" : "default"}
                                maximumDate={new Date()}
                                minimumDate={new Date(1930, 0, 1)}
                                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                                  setShowBirthDatePicker(Platform.OS === "ios");
                                  if (selectedDate) {
                                    const iso = selectedDate.toISOString().slice(0, 10);
                                    updateDietSettings((prev) => ({ ...prev, birth_date: iso }));
                                  }
                                }}
                              />
                            )
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>

                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Objetivo</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {DIET_GOAL_OPTIONS.map((option) => {
                      const isActive = dietSettings.goal === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => updateDietGoal(option.key)}
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

                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Nivel de actividad</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {ACTIVITY_LEVEL_OPTIONS.map((option) => {
                      const isActive = dietSettings.activity_level === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => updateActivityLevel(option.key)}
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

                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Calorías diarias</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                    Añádelas a mano o pulsa Calcular para estimarlas automáticamente.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
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
                      value={dietSettings.daily_calories}
                      onChangeText={updateDietDailyCalories}
                      placeholder="Calorías objetivo (kcal)"
                      placeholderTextColor={mobileTheme.color.textSecondary}
                      keyboardType="decimal-pad"
                    />
                    <Pressable
                      onPress={() => {
                        const heightCm = parseFloat(dietSettings.height_cm ?? "") || (latestBodyHeightCm ?? 0);
                        const weightKg = latestBodyWeightKg ?? 0;
                        const birthDate = dietSettings.birth_date;
                        if (!weightKg || !heightCm || !birthDate) {
                          setError("Introduce altura, peso y fecha de nacimiento para calcular.");
                          return;
                        }
                        const ageYears = Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
                        // Mifflin-St Jeor BMR
                        const sexOffset = (dietSettings.sex ?? "male") === "female" ? -161 : 5;
                        const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
                        const activityMultipliers: Record<string, number> = {
                          moderate: 1.55,
                          intermediate: 1.725,
                          high: 1.9,
                        };
                        const multiplier = activityMultipliers[dietSettings.activity_level ?? "moderate"] ?? 1.55;
                        const tdee = bmr * multiplier;
                        const goalMultiplier = dietSettings.goal === "cut" ? 0.8 : dietSettings.goal === "bulk" ? 1.2 : 1;
                        updateDietDailyCalories(String(Math.round(tdee * goalMultiplier)));
                        setError(null);
                      }}
                      style={{
                        minHeight: 42,
                        borderRadius: mobileTheme.radius.md,
                        backgroundColor: mobileTheme.color.brandPrimary,
                        paddingHorizontal: 12,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>Calcular</Text>
                    </Pressable>
                  </View>



                  {([
                    { macro: "protein" as const, kcalLabel: "Proteínas", gkgLabel: "Proteína", gkgHint: proteinMaxGramsPerKgHint, gkgValue: dietSettings.protein_grams_per_kg, gkgOnChange: updateProteinGramsPerKg },
                    { macro: "carbs" as const, kcalLabel: "Carbohidratos", gkgLabel: "Carbohidratos", gkgHint: carbsMaxGramsPerKgHint, gkgValue: dietSettings.carbs_grams_per_kg, gkgOnChange: updateCarbsGramsPerKg },
                    { macro: "fat" as const, kcalLabel: "Grasas", gkgLabel: "Grasas", gkgHint: fatMaxGramsPerKgHint, gkgValue: dietSettings.fat_grams_per_kg, gkgOnChange: updateFatGramsPerKg },
                  ]).map((row, idx) => (
                    <View key={row.macro}>
                      {idx === 0 ? (
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
                          <Text style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" }}>kcal</Text>
                          <Text style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "center" }}>g/kg</Text>
                        </View>
                      ) : null}
                      <View style={{ flexDirection: "row", gap: 10, marginBottom: 2 }}>
                        <Text style={{ flex: 1, color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 12 }}>{row.kcalLabel}</Text>
                        <Text style={{ flex: 1, color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 12 }} numberOfLines={1}>
                          {row.gkgLabel}{row.gkgHint !== null ? ` · max ${row.gkgHint.toFixed(1)}` : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, minHeight: 42 }}>
                          <TextInput
                            style={{ flex: 1, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, minHeight: 42 }}
                            value={dietSettings.manual_macro_calories[row.macro]}
                            onChangeText={(value) => updateManualMacroCalories(row.macro, value)}
                            placeholder="kcal"
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            keyboardType="decimal-pad"
                          />
                          <View style={{ justifyContent: "center", paddingRight: 6 }}>
                            <Pressable onPress={() => updateManualMacroCalories(row.macro, String((parseInt(dietSettings.manual_macro_calories[row.macro]) || 0) + 1))} style={{ padding: 4 }}>
                              <Feather name="chevron-up" size={16} color={mobileTheme.color.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => updateManualMacroCalories(row.macro, String(Math.max(0, (parseInt(dietSettings.manual_macro_calories[row.macro]) || 0) - 1)))} style={{ padding: 4 }}>
                              <Feather name="chevron-down" size={16} color={mobileTheme.color.textSecondary} />
                            </Pressable>
                          </View>
                        </View>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, minHeight: 42 }}>
                          <TextInput
                            style={{ flex: 1, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, minHeight: 42 }}
                            value={row.gkgValue}
                            onChangeText={row.gkgOnChange}
                            placeholder="g/kg"
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            keyboardType="decimal-pad"
                          />
                          <View style={{ justifyContent: "center", paddingRight: 6 }}>
                            <Pressable onPress={() => row.gkgOnChange((Math.round(((parseFloat(row.gkgValue) || 0) + 0.1) * 10) / 10).toFixed(1))} style={{ padding: 4 }}>
                              <Feather name="chevron-up" size={16} color={mobileTheme.color.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => row.gkgOnChange((Math.max(0, Math.round(((parseFloat(row.gkgValue) || 0) - 0.1) * 10) / 10)).toFixed(1))} style={{ padding: 4 }}>
                              <Feather name="chevron-down" size={16} color={mobileTheme.color.textSecondary} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}

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
                      Asignadas: {configuredMacroCaloriesTotal.toFixed(0)} kcal
                    </Text>
                    <Text
                      style={{
                        color: configuredMacroCaloriesRemaining < 0 ? "#FF8D8D" : mobileTheme.color.brandPrimary,
                        fontWeight: "700",
                      }}
                    >
                      {configuredMacroCaloriesRemaining >= 0
                        ? `Restantes: ${configuredMacroCaloriesRemaining.toFixed(0)} kcal`
                        : `Excedente: ${Math.abs(configuredMacroCaloriesRemaining).toFixed(0)} kcal`}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      P: {proteinDailyTargetGrams.toFixed(1)}g ({(proteinDailyTargetGrams * 4).toFixed(0)} kcal) • C: {carbsDailyTargetGrams.toFixed(1)}g ({(carbsDailyTargetGrams * 4).toFixed(0)} kcal) • G: {fatDailyTargetGrams.toFixed(1)}g ({(fatDailyTargetGrams * 9).toFixed(0)} kcal)
                    </Text>
                  </View>

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

                  {/* Provider selector dropdowns */}
                  {[
                    {
                      label: "Agente principal",
                      value: store.chatProvider,
                      onChange: (p: Provider) => { setStore((prev) => ({ ...prev, chatProvider: p })); setChatProviderDropdownOpen(false); },
                      open: chatProviderDropdownOpen,
                      setOpen: setChatProviderDropdownOpen,
                      otherClose: () => setFoodAIProviderDropdownOpen(false),
                    },
                    {
                      label: "Buscador de alimentos",
                      value: store.foodAIProvider,
                      onChange: (p: Provider) => { setStore((prev) => ({ ...prev, foodAIProvider: p })); setFoodAIProviderDropdownOpen(false); },
                      open: foodAIProviderDropdownOpen,
                      setOpen: setFoodAIProviderDropdownOpen,
                      otherClose: () => setChatProviderDropdownOpen(false),
                    },
                  ].map((dropdown) => {
                    const selectedKey = dropdown.value
                      ? store.keys.find((k) => k.provider === dropdown.value)
                      : null;
                    const selectedLabel = selectedKey
                      ? `${PROVIDER_UI_META[selectedKey.provider].label} · ${selectedKey.model || DEFAULT_MODELS[selectedKey.provider]}`
                      : "Sin proveedor";
                    return (
                      <View key={dropdown.label} style={{ gap: 4 }}>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600" }}>
                          {dropdown.label}
                        </Text>
                        <Pressable
                          onPress={() => { dropdown.otherClose(); dropdown.setOpen(!dropdown.open); }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderWidth: 1,
                            borderColor: dropdown.open ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
                            borderRadius: mobileTheme.radius.md,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: mobileTheme.color.bgSurface,
                          }}
                        >
                          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14 }}>
                            {selectedLabel}
                          </Text>
                          <Feather name={dropdown.open ? "chevron-up" : "chevron-down"} size={16} color={mobileTheme.color.textSecondary} />
                        </Pressable>
                        {dropdown.open ? (
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              borderRadius: mobileTheme.radius.md,
                              backgroundColor: mobileTheme.color.bgSurface,
                              overflow: "hidden",
                            }}
                          >
                            {(["anthropic", "openai", "google"] as Provider[]).map((provider) => {
                              const k = store.keys.find((item) => item.provider === provider);
                              const hasKey = !!(k?.api_key.trim());
                              const isSelected = dropdown.value === provider;
                              return (
                                <Pressable
                                  key={provider}
                                  onPress={() => hasKey && dropdown.onChange(provider)}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    backgroundColor: isSelected ? "rgba(203,255,26,0.08)" : "transparent",
                                    opacity: hasKey ? 1 : 0.4,
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      backgroundColor: PROVIDER_UI_META[provider].avatar_bg,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text style={{ color: PROVIDER_UI_META[provider].avatar_text, fontSize: 14, fontWeight: "700" }}>
                                      {PROVIDER_UI_META[provider].label[0]}
                                    </Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
                                      {PROVIDER_UI_META[provider].label}
                                    </Text>
                                    {!hasKey ? (
                                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>Sin API key</Text>
                                    ) : null}
                                  </View>
                                  {isSelected ? <Feather name="check" size={16} color={mobileTheme.color.brandPrimary} /> : null}
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

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
                    const providerConnectionDetailColor = providerDetailColorBySeverity(
                      connectionStatus.severity,
                    );
                    return (
                      <View
                        key={key.provider}
                        style={{
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          borderRadius: mobileTheme.radius.lg,
                          backgroundColor: mobileTheme.color.bgSurface,
                          padding: 12,
                          gap: 10,
                        }}
                      >
                        <View
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
                        </View>

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
                            onFocus={() => {}}
                            onChangeText={(value) => updateProviderDraft(key.provider, { api_key: value })}
                            placeholder="Añade tu API Key"
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            secureTextEntry={!keyVisible}
                          />
                          <Pressable
                            onPress={() => {

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

                        <Text style={{ color: providerConnectionDetailColor, fontSize: 12 }}>
                          {connectionStatus.detail}
                        </Text>

                        {key.provider === "anthropic" ? (
                            <View style={{ gap: 8 }}>
                              <Pressable
                                onPress={() => {
    
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

                              <View style={{ gap: 8 }}>
                                <View style={{ gap: 4 }}>
                                  <Text
                                    style={{
                                      color: mobileTheme.color.textSecondary,
                                      fontSize: 12,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Esfuerzo de razonamiento
                                  </Text>
                                  <Text
                                    style={{
                                      color: mobileTheme.color.textSecondary,
                                      fontSize: 11,
                                      lineHeight: 16,
                                    }}
                                  >
                                    Se envia a OpenAI como reasoning.effort en la Responses API.
                                  </Text>
                                </View>
                                {supportedOpenAIReasoningEfforts.length > 0 ? (
                                  <>
                                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                      {supportedOpenAIReasoningEfforts.map((effort) => {
                                        const selected = effort === selectedOpenAIReasoningEffort;
                                        return (
                                          <Pressable
                                            key={effort}
                                            onPress={() => updateProviderDraft("openai", { reasoning_effort: effort })}
                                            style={{
                                              minHeight: 34,
                                              borderRadius: mobileTheme.radius.pill,
                                              borderWidth: 1,
                                              borderColor: selected
                                                ? "rgba(69,141,255,0.5)"
                                                : mobileTheme.color.borderSubtle,
                                              backgroundColor: selected
                                                ? "rgba(69,141,255,0.16)"
                                                : mobileTheme.color.bgApp,
                                              paddingHorizontal: 12,
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}
                                          >
                                            <Text
                                              style={{
                                                color: selected ? "#77A8FF" : mobileTheme.color.textPrimary,
                                                fontSize: 12,
                                                fontWeight: "700",
                                              }}
                                            >
                                              {OPENAI_REASONING_EFFORT_LABELS[effort]}
                                            </Text>
                                          </Pressable>
                                        );
                                      })}
                                    </View>
                                    {selectedOpenAIReasoningEffort ? (
                                      <Text
                                        style={{
                                          color: mobileTheme.color.textSecondary,
                                          fontSize: 11,
                                          lineHeight: 16,
                                        }}
                                      >
                                        Valor actual: {selectedOpenAIReasoningEffort} para {normalizedOpenAIProviderModel}.
                                      </Text>
                                    ) : null}
                                  </>
                                ) : (
                                  <Text
                                    style={{
                                      color: "#F5C26B",
                                      fontSize: 11,
                                      lineHeight: 16,
                                    }}
                                  >
                                    El modelo seleccionado no documenta niveles de reasoning.effort, asi que la app no enviara este campo.
                                  </Text>
                                )}
                              </View>

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
                          )}
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
                          <View style={{ flexDirection: "row", gap: 2 }}>
                            {ex.image_male ? (
                              <Image
                                source={{ uri: `${EXERCISES_REPO_BASE_URL}/${ex.image_male}` }}
                                style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }}
                              />
                            ) : (
                              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
                            )}
                            {ex.image_female ? (
                              <Image
                                source={{ uri: `${EXERCISES_REPO_BASE_URL}/${ex.image_female}` }}
                                style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }}
                              />
                            ) : (
                              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a" }} />
                            )}
                          </View>
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

              {settingsTab === "foods" ? (
                <View style={{ gap: 12 }}>
                  {/* Search bar */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.bgSurface,
                      paddingHorizontal: 10,
                      height: 40,
                    }}
                  >
                    <Feather name="search" size={16} color={mobileTheme.color.textSecondary} />
                    <TextInput
                      value={foodSearch}
                      onChangeText={setFoodSearch}
                      placeholder="Buscar alimento..."
                      placeholderTextColor={mobileTheme.color.textSecondary}
                      style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, marginLeft: 8 }}
                    />
                    {foodSearch ? (
                      <Pressable onPress={() => setFoodSearch("")} style={{ padding: 4 }}>
                        <Feather name="x" size={16} color={mobileTheme.color.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Category filter chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {["all", ...Array.from(new Set(foodsRepo.map((f) => f.category))).sort()].map((cat) => {
                        const isActive = foodCategoryFilter === cat;
                        const label = cat === "all" ? "Todos" : cat.charAt(0).toUpperCase() + cat.slice(1);
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => setFoodCategoryFilter(cat)}
                            style={{
                              borderWidth: 1,
                              borderColor: isActive ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle,
                              borderRadius: mobileTheme.radius.pill,
                              paddingHorizontal: 10,
                              minHeight: 30,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: isActive ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgSurface,
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "600" }}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* Food list */}
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
                      Alimentos ({foodsRepo.length})
                    </Text>
                    {(() => {
                      const filtered = foodsRepo.filter((f) => {
                        const matchesSearch = !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase()) || f.category.toLowerCase().includes(foodSearch.toLowerCase());
                        const matchesCategory = foodCategoryFilter === "all" || f.category === foodCategoryFilter;
                        return matchesSearch && matchesCategory;
                      });
                      if (filtered.length === 0) {
                        return (
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                            No se encontraron alimentos.
                          </Text>
                        );
                      }
                      return filtered.map((food) => (
                        <Pressable
                          key={food.id}
                          onPress={() => setSelectedFoodDetail(food)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 6,
                            borderBottomWidth: 1,
                            borderBottomColor: mobileTheme.color.borderSubtle,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: "rgba(203,255,26,0.1)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>
                              {food.category === "proteína" ? "🥩" : food.category === "carbohidrato" ? "🍚" : food.category === "grasa" ? "🫒" : food.category === "fruta" ? "🍎" : food.category === "verdura" ? "🥦" : food.category === "lácteo" ? "🥛" : food.category === "legumbre" ? "🫘" : food.category === "fruto-seco" ? "🥜" : "🍽️"}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                              {food.name}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                              {food.calories_per_100g} kcal · P:{food.protein_per_100g}g · C:{food.carbs_per_100g}g · G:{food.fat_per_100g}g
                            </Text>
                          </View>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>
                            {food.category}
                          </Text>
                        </Pressable>
                      ));
                    })()}
                  </View>

                  {/* Food detail modal */}
                  {selectedFoodDetail ? (
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
                          {selectedFoodDetail.name}
                        </Text>
                        <Pressable onPress={() => setSelectedFoodDetail(null)} style={{ padding: 4 }}>
                          <Feather name="x" size={20} color={mobileTheme.color.textSecondary} />
                        </Pressable>
                      </View>

                      {/* Category tag */}
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View
                          style={{
                            backgroundColor: mobileTheme.color.accent + "22",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: mobileTheme.color.accent, fontSize: 11, fontWeight: "600" }}>
                            {selectedFoodDetail.category}
                          </Text>
                        </View>
                      </View>

                      {/* Macros per 100g */}
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Por 100g
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { label: "Calorías", value: `${selectedFoodDetail.calories_per_100g}`, unit: "kcal", color: "#FF6B6B" },
                          { label: "Proteína", value: `${selectedFoodDetail.protein_per_100g}`, unit: "g", color: "#4ECDC4" },
                          { label: "Carbos", value: `${selectedFoodDetail.carbs_per_100g}`, unit: "g", color: "#FFE66D" },
                          { label: "Grasa", value: `${selectedFoodDetail.fat_per_100g}`, unit: "g", color: "#FF8A5C" },
                        ].map((macro) => (
                          <View
                            key={macro.label}
                            style={{
                              flex: 1,
                              backgroundColor: macro.color + "15",
                              borderRadius: 8,
                              padding: 8,
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Text style={{ color: macro.color, fontSize: 16, fontWeight: "700" }}>
                              {macro.value}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>
                              {macro.unit}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>
                              {macro.label}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Fiber */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Fibra</Text>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>
                          {selectedFoodDetail.fiber_per_100g}g
                        </Text>
                      </View>

                      {/* Serving info */}
                      <View
                        style={{
                          backgroundColor: "#ffffff08",
                          borderRadius: 8,
                          padding: 10,
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                          Ración típica
                        </Text>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13 }}>
                          {selectedFoodDetail.serving_description}
                        </Text>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                          {Math.round(selectedFoodDetail.calories_per_100g * selectedFoodDetail.serving_size_g / 100)} kcal · P:{(selectedFoodDetail.protein_per_100g * selectedFoodDetail.serving_size_g / 100).toFixed(1)}g · C:{(selectedFoodDetail.carbs_per_100g * selectedFoodDetail.serving_size_g / 100).toFixed(1)}g · G:{(selectedFoodDetail.fat_per_100g * selectedFoodDetail.serving_size_g / 100).toFixed(1)}g
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {settingsTab === "personalFoods" ? (
                <View style={{ gap: 12 }}>
                  {/* Add buttons */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setPersonalFoodDraft({});
                        setEditingPersonalFoodId(null);
                        setPersonalFoodFormVisible(true);
                        setSelectedPersonalFoodDetail(null);
                        setPersonalFoodAIChatOpen(false);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderWidth: 1,
                        borderColor: "rgba(203,255,26,0.45)",
                        borderRadius: mobileTheme.radius.md,
                        paddingVertical: 10,
                        backgroundColor: "rgba(203,255,26,0.08)",
                      }}
                    >
                      <Feather name="edit-3" size={14} color={mobileTheme.color.brandPrimary} />
                      <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>
                        Añadir con formulario
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setPersonalFoodAIChatOpen(true);
                        setPersonalFoodFormVisible(false);
                        setSelectedPersonalFoodDetail(null);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderWidth: 1,
                        borderColor: "rgba(78,205,196,0.45)",
                        borderRadius: mobileTheme.radius.md,
                        paddingVertical: 10,
                        backgroundColor: "rgba(78,205,196,0.08)",
                      }}
                    >
                      <Feather name="cpu" size={14} color="#4ECDC4" />
                      <Text style={{ color: "#4ECDC4", fontSize: 13, fontWeight: "700" }}>
                        Añadir con IA
                      </Text>
                    </Pressable>
                  </View>

                  {/* AI Chat */}
                  <MiniChat
                    visible={personalFoodAIChatOpen}
                    title="Asistente de alimentos"
                    systemPrompt={FOOD_AI_SYSTEM_PROMPT}
                    providerKeys={store.keys}
                    preferredProvider={store.foodAIProvider}
                    providerPriority={FOOD_ESTIMATOR_PROVIDER_PRIORITY}
                    onJsonResult={(json) => {
                      const entry: FoodRepoEntry = {
                        id: uid("food"),
                        name: String(json.name ?? ""),
                        category: String(json.category ?? "otro"),
                        calories_per_100g: Number(json.calories_per_100g) || 0,
                        protein_per_100g: Number(json.protein_per_100g) || 0,
                        carbs_per_100g: Number(json.carbs_per_100g) || 0,
                        fat_per_100g: Number(json.fat_per_100g) || 0,
                        fiber_per_100g: Number(json.fiber_per_100g) || 0,
                        serving_size_g: Number(json.serving_size_g) || 100,
                        serving_description: String(json.serving_description ?? ""),
                      };
                      setPersonalFoods((prev) => [...prev, entry]);
                      setPersonalFoodAIChatOpen(false);
                    }}
                    onClose={() => setPersonalFoodAIChatOpen(false)}
                  />

                  {/* Add/Edit form */}
                  {personalFoodFormVisible ? (
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
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 16 }}>
                          {editingPersonalFoodId ? "Editar alimento" : "Nuevo alimento"}
                        </Text>
                        <Pressable onPress={() => setPersonalFoodFormVisible(false)} style={{ padding: 4 }}>
                          <Feather name="x" size={18} color={mobileTheme.color.textSecondary} />
                        </Pressable>
                      </View>
                      {[
                        { key: "name", label: "Nombre", placeholder: "Ej: Batido de proteínas", keyboard: "default" as const },
                        { key: "category", label: "Categoría", placeholder: "Ej: proteína, receta, suplemento", keyboard: "default" as const },
                        { key: "calories_per_100g", label: "Calorías (por unidad base)", placeholder: "kcal", keyboard: "decimal-pad" as const },
                        { key: "protein_per_100g", label: "Proteína (g)", placeholder: "g", keyboard: "decimal-pad" as const },
                        { key: "carbs_per_100g", label: "Carbohidratos (g)", placeholder: "g", keyboard: "decimal-pad" as const },
                        { key: "fat_per_100g", label: "Grasa (g)", placeholder: "g", keyboard: "decimal-pad" as const },
                        { key: "fiber_per_100g", label: "Fibra (g)", placeholder: "g", keyboard: "decimal-pad" as const },
                        { key: "serving_size_g", label: "Tamaño de ración (g/ml)", placeholder: "Ej: 250", keyboard: "decimal-pad" as const },
                        { key: "serving_description", label: "Descripción de ración", placeholder: "Ej: 1 batido (250ml)", keyboard: "default" as const },
                      ].map((field) => (
                        <View key={field.key} style={{ gap: 2 }}>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600" }}>
                            {field.label}
                          </Text>
                          <TextInput
                            value={String(personalFoodDraft[field.key as keyof FoodRepoEntry] ?? "")}
                            onChangeText={(text) => setPersonalFoodDraft((prev) => ({ ...prev, [field.key]: text }))}
                            placeholder={field.placeholder}
                            placeholderTextColor={mobileTheme.color.textSecondary}
                            keyboardType={field.keyboard}
                            style={{
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              borderRadius: mobileTheme.radius.md,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              color: mobileTheme.color.textPrimary,
                              fontSize: 14,
                              backgroundColor: mobileTheme.color.cardBg,
                            }}
                          />
                        </View>
                      ))}
                      <Pressable
                        onPress={() => {
                          if (!personalFoodDraft.name?.trim()) return;
                          const entry: FoodRepoEntry = {
                            id: editingPersonalFoodId ?? uid("food"),
                            name: personalFoodDraft.name?.trim() ?? "",
                            category: personalFoodDraft.category?.trim() ?? "otro",
                            calories_per_100g: Number(personalFoodDraft.calories_per_100g) || 0,
                            protein_per_100g: Number(personalFoodDraft.protein_per_100g) || 0,
                            carbs_per_100g: Number(personalFoodDraft.carbs_per_100g) || 0,
                            fat_per_100g: Number(personalFoodDraft.fat_per_100g) || 0,
                            fiber_per_100g: Number(personalFoodDraft.fiber_per_100g) || 0,
                            serving_size_g: Number(personalFoodDraft.serving_size_g) || 100,
                            serving_description: personalFoodDraft.serving_description?.trim() ?? "",
                          };
                          if (editingPersonalFoodId) {
                            setPersonalFoods((prev) => prev.map((f) => (f.id === editingPersonalFoodId ? entry : f)));
                          } else {
                            setPersonalFoods((prev) => [...prev, entry]);
                          }
                          setPersonalFoodFormVisible(false);
                          setPersonalFoodDraft({});
                          setEditingPersonalFoodId(null);
                        }}
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                          paddingVertical: 10,
                          borderRadius: mobileTheme.radius.md,
                          backgroundColor: mobileTheme.color.brandPrimary,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>
                          {editingPersonalFoodId ? "Guardar cambios" : "Añadir"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Search bar */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.bgSurface,
                      paddingHorizontal: 10,
                      height: 40,
                    }}
                  >
                    <Feather name="search" size={16} color={mobileTheme.color.textSecondary} />
                    <TextInput
                      value={personalFoodSearch}
                      onChangeText={setPersonalFoodSearch}
                      placeholder="Buscar alimento personal..."
                      placeholderTextColor={mobileTheme.color.textSecondary}
                      style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, marginLeft: 8 }}
                    />
                    {personalFoodSearch ? (
                      <Pressable onPress={() => setPersonalFoodSearch("")} style={{ padding: 4 }}>
                        <Feather name="x" size={16} color={mobileTheme.color.textSecondary} />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Personal food list */}
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
                      Mis alimentos ({personalFoods.length})
                    </Text>
                    {(() => {
                      const filtered = personalFoods.filter((f) => {
                        if (!personalFoodSearch) return true;
                        return f.name.toLowerCase().includes(personalFoodSearch.toLowerCase()) || f.category.toLowerCase().includes(personalFoodSearch.toLowerCase());
                      });
                      if (filtered.length === 0) {
                        return (
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                            {personalFoods.length === 0 ? "No has añadido alimentos personales." : "No se encontraron alimentos."}
                          </Text>
                        );
                      }
                      return filtered.map((food) => (
                        <Pressable
                          key={food.id}
                          onPress={() => { setSelectedPersonalFoodDetail(food); setPersonalFoodFormVisible(false); }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 6,
                            borderBottomWidth: 1,
                            borderBottomColor: mobileTheme.color.borderSubtle,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: "rgba(78,205,196,0.1)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Feather name="user" size={16} color="#4ECDC4" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                              {food.name}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                              {food.calories_per_100g} kcal · P:{food.protein_per_100g}g · C:{food.carbs_per_100g}g · G:{food.fat_per_100g}g
                            </Text>
                          </View>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>
                            {food.category}
                          </Text>
                        </Pressable>
                      ));
                    })()}
                  </View>

                  {/* Personal food detail */}
                  {selectedPersonalFoodDetail ? (
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
                          {selectedPersonalFoodDetail.name}
                        </Text>
                        <Pressable onPress={() => setSelectedPersonalFoodDetail(null)} style={{ padding: 4 }}>
                          <Feather name="x" size={20} color={mobileTheme.color.textSecondary} />
                        </Pressable>
                      </View>

                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={{ backgroundColor: mobileTheme.color.accent + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: mobileTheme.color.accent, fontSize: 11, fontWeight: "600" }}>
                            {selectedPersonalFoodDetail.category}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        Por unidad base
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { label: "Calorías", value: `${selectedPersonalFoodDetail.calories_per_100g}`, unit: "kcal", color: "#FF6B6B" },
                          { label: "Proteína", value: `${selectedPersonalFoodDetail.protein_per_100g}`, unit: "g", color: "#4ECDC4" },
                          { label: "Carbos", value: `${selectedPersonalFoodDetail.carbs_per_100g}`, unit: "g", color: "#FFE66D" },
                          { label: "Grasa", value: `${selectedPersonalFoodDetail.fat_per_100g}`, unit: "g", color: "#FF8A5C" },
                        ].map((macro) => (
                          <View
                            key={macro.label}
                            style={{
                              flex: 1,
                              backgroundColor: macro.color + "15",
                              borderRadius: 8,
                              padding: 8,
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Text style={{ color: macro.color, fontSize: 16, fontWeight: "700" }}>{macro.value}</Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.unit}</Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.label}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Fibra</Text>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>{selectedPersonalFoodDetail.fiber_per_100g}g</Text>
                      </View>

                      {selectedPersonalFoodDetail.serving_description ? (
                        <View style={{ backgroundColor: "#ffffff08", borderRadius: 8, padding: 10, gap: 4 }}>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Ración típica</Text>
                          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13 }}>{selectedPersonalFoodDetail.serving_description}</Text>
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                            {Math.round(selectedPersonalFoodDetail.calories_per_100g * selectedPersonalFoodDetail.serving_size_g / 100)} kcal · P:{(selectedPersonalFoodDetail.protein_per_100g * selectedPersonalFoodDetail.serving_size_g / 100).toFixed(1)}g · C:{(selectedPersonalFoodDetail.carbs_per_100g * selectedPersonalFoodDetail.serving_size_g / 100).toFixed(1)}g · G:{(selectedPersonalFoodDetail.fat_per_100g * selectedPersonalFoodDetail.serving_size_g / 100).toFixed(1)}g
                          </Text>
                        </View>
                      ) : null}

                      {/* Edit / Delete buttons */}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <Pressable
                          onPress={() => {
                            setPersonalFoodDraft({
                              name: selectedPersonalFoodDetail.name,
                              category: selectedPersonalFoodDetail.category,
                              calories_per_100g: selectedPersonalFoodDetail.calories_per_100g,
                              protein_per_100g: selectedPersonalFoodDetail.protein_per_100g,
                              carbs_per_100g: selectedPersonalFoodDetail.carbs_per_100g,
                              fat_per_100g: selectedPersonalFoodDetail.fat_per_100g,
                              fiber_per_100g: selectedPersonalFoodDetail.fiber_per_100g,
                              serving_size_g: selectedPersonalFoodDetail.serving_size_g,
                              serving_description: selectedPersonalFoodDetail.serving_description,
                            });
                            setEditingPersonalFoodId(selectedPersonalFoodDetail.id);
                            setPersonalFoodFormVisible(true);
                            setSelectedPersonalFoodDetail(null);
                          }}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 10,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                          }}
                        >
                          <Feather name="edit-2" size={14} color={mobileTheme.color.textSecondary} />
                          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>Editar</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setPersonalFoods((prev) => prev.filter((f) => f.id !== selectedPersonalFoodDetail.id));
                            setSelectedPersonalFoodDetail(null);
                          }}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 10,
                            borderRadius: mobileTheme.radius.md,
                            borderWidth: 1,
                            borderColor: "#FF6B6B44",
                            backgroundColor: "#FF6B6B10",
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#FF6B6B" />
                          <Text style={{ color: "#FF6B6B", fontSize: 13, fontWeight: "600" }}>Eliminar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {settingsTab === "measures" ? (
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
                      Medidas guardadas ({store.measurements.length})
                    </Text>
                    <Pressable
                      onPress={openMeasurementEntryScreen}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderWidth: 1,
                        borderColor: "rgba(203,255,26,0.45)",
                        borderRadius: mobileTheme.radius.pill,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: "rgba(203,255,26,0.08)",
                      }}
                    >
                      <Feather name="plus" size={14} color={mobileTheme.color.brandPrimary} />
                      <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>Añadir</Text>
                    </Pressable>
                  </View>

                  {store.measurements.length === 0 ? (
                    <View
                      style={{
                        backgroundColor: mobileTheme.color.bgSurface,
                        borderRadius: mobileTheme.radius.lg,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        padding: 24,
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="activity" size={32} color={mobileTheme.color.textSecondary} />
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
                        No hay medidas guardadas. Pulsa "Añadir" para registrar tus medidas.
                      </Text>
                    </View>
                  ) : (
                    store.measurements.map((m, idx) => {
                      const date = new Date(m.measured_at);
                      const dateStr = date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
                      const fields: Array<{ label: string; value: string }> = [];
                      if (m.weight_kg !== null) fields.push({ label: "Peso", value: `${formatMeasurementNumber(m.weight_kg)} kg` });
                      if (m.height_cm !== null) fields.push({ label: "Altura", value: `${formatMeasurementNumber(m.height_cm)} cm` });
                      if (m.neck_cm !== null) fields.push({ label: "Cuello", value: `${formatMeasurementNumber(m.neck_cm)} cm` });
                      if (m.chest_cm !== null) fields.push({ label: "Pecho", value: `${formatMeasurementNumber(m.chest_cm)} cm` });
                      if (m.waist_cm !== null) fields.push({ label: "Cintura", value: `${formatMeasurementNumber(m.waist_cm)} cm` });
                      if (m.hips_cm !== null) fields.push({ label: "Cadera", value: `${formatMeasurementNumber(m.hips_cm)} cm` });
                      if (m.biceps_cm !== null) fields.push({ label: "Bíceps", value: `${formatMeasurementNumber(m.biceps_cm)} cm` });
                      if (m.quadriceps_cm !== null) fields.push({ label: "Cuádriceps", value: `${formatMeasurementNumber(m.quadriceps_cm)} cm` });
                      if (m.calf_cm !== null) fields.push({ label: "Gemelo", value: `${formatMeasurementNumber(m.calf_cm)} cm` });
                      if (m.photo_uri) fields.push({ label: "Foto", value: "Sí" });

                      return (
                        <View
                          key={m.id}
                          style={{
                            backgroundColor: mobileTheme.color.bgSurface,
                            borderRadius: mobileTheme.radius.lg,
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            padding: 12,
                            gap: 8,
                          }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>
                              {dateStr}
                            </Text>
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
                              #{store.measurements.length - idx}
                            </Text>
                          </View>

                          {fields.length > 0 ? (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {fields.map((f) => (
                                <View
                                  key={f.label}
                                  style={{
                                    backgroundColor: "#ffffff08",
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    gap: 2,
                                  }}
                                >
                                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{f.label}</Text>
                                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>{f.value}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Sin medidas numéricas</Text>
                          )}

                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Pressable
                              onPress={() => openMeasurementForEdit(m)}
                              style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                paddingVertical: 8,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: mobileTheme.color.borderSubtle,
                              }}
                            >
                              <Feather name="edit-2" size={13} color={mobileTheme.color.textSecondary} />
                              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Editar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => deleteMeasurement(m.id)}
                              style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                paddingVertical: 8,
                                borderRadius: mobileTheme.radius.md,
                                borderWidth: 1,
                                borderColor: "#FF6B6B44",
                                backgroundColor: "#FF6B6B10",
                              }}
                            >
                              <Feather name="trash-2" size={13} color="#FF6B6B" />
                              <Text style={{ color: "#FF6B6B", fontSize: 12, fontWeight: "600" }}>Eliminar</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}

              {settingsTab === "preferences" ? (
                <View style={{ gap: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
                    Preferencias del usuario
                  </Text>
                  {Object.entries(userPrefs).map(([key, value]) => {
                    let displayLabel = key;
                    let displayValue = String(value);
                    if (key === "chartPeriod") {
                      displayLabel = "Vista del gráfico";
                      const option = MEASURES_DASHBOARD_PERIOD_OPTIONS.find((o) => o.key === value);
                      displayValue = option ? option.label : String(value);
                    }
                    return (
                      <View
                        key={key}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          backgroundColor: mobileTheme.color.cardBg,
                          borderRadius: 12,
                          padding: 14,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>
                          {displayLabel}
                        </Text>
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700" }}>
                          {displayValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Exercise detail rendered as fullscreen overlay below */}
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

      {selectedExerciseDetail ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.88)",
            zIndex: 998,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "92%",
              maxHeight: "90%",
              backgroundColor: mobileTheme.color.bgSurface,
              borderRadius: 20,
              padding: 20,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "800", fontSize: 20, flex: 1 }}>
                {selectedExerciseDetail.name}
              </Text>
              <Pressable onPress={() => setSelectedExerciseDetail(null)} style={{ padding: 6 }}>
                <Feather name="x" size={22} color={mobileTheme.color.textSecondary} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {selectedExerciseDetail.image_male ? (
                <View style={{ flex: 1, gap: 4 }}>
                  <Image
                    source={{ uri: `${EXERCISES_REPO_BASE_URL}/${selectedExerciseDetail.image_male}` }}
                    style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#1a1a1a" }}
                    resizeMode="cover"
                  />
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, textAlign: "center" }}>Hombre</Text>
                </View>
              ) : null}
              {selectedExerciseDetail.image_female ? (
                <View style={{ flex: 1, gap: 4 }}>
                  <Image
                    source={{ uri: `${EXERCISES_REPO_BASE_URL}/${selectedExerciseDetail.image_female}` }}
                    style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#1a1a1a" }}
                    resizeMode="cover"
                  />
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, textAlign: "center" }}>Mujer</Text>
                </View>
              ) : null}
            </View>

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
              <View style={{ backgroundColor: "#ffffff15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{selectedExerciseDetail.equipment}</Text>
              </View>
              <View style={{ backgroundColor: "#ffffff15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{selectedExerciseDetail.difficulty}</Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 150 }}>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 20 }}>
                {selectedExerciseDetail.instructions}
              </Text>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {expandedPhotoUri ? (
        <Pressable
          onPress={() => setExpandedPhotoUri(null)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.92)",
            zIndex: 999,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: expandedPhotoUri }}
            style={{ width: "90%", height: "80%", borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 16 }}>
            Toca para cerrar
          </Text>
        </Pressable>
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
                {editingMeasurementId ? "Editar medidas" : "Registrar medidas"}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
                {editingMeasurementId ? "Modifica los valores de esta entrada." : "Guarda peso, foto y contornos sin salir de la pestaña `Medidas`."}
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
                <Text style={{ color: "#06090D", fontWeight: "700" }}>{editingMeasurementId ? "Actualizar" : "Guardar medidas"}</Text>
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
                Platform.OS === "web" ? (
                  <TextInput
                    value={measurementDateTextInput}
                    onChangeText={(text) => {
                      setMeasurementDateTextInput(text);
                      const parsed = new Date(text + "T12:00:00");
                      if (!isNaN(parsed.getTime()) && parsed <= new Date() && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
                        setMeasurementDate(parsed);
                      }
                    }}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={mobileTheme.color.textSecondary}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      borderRadius: 12,
                      backgroundColor: mobileTheme.color.bgApp,
                      color: mobileTheme.color.textPrimary,
                      paddingHorizontal: 12,
                      fontSize: 14,
                    }}
                  />
                ) : (
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
                )
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

              <View style={{ gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>Peso (kg)</Text>
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
                  placeholder="—"
                  placeholderTextColor={mobileTheme.color.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
              {[
                { label: "Cuello (cm)", value: neckInput, setter: setNeckInput },
                { label: "Pecho (cm)", value: chestInput, setter: setChestInput },
                { label: "Cintura (cm)", value: waistInput, setter: setWaistInput },
                { label: "Cadera (cm)", value: hipsInput, setter: setHipsInput },
                { label: "Bíceps (cm)", value: bicepsInput, setter: setBicepsInput },
                { label: "Cuádriceps (cm)", value: quadricepsInput, setter: setQuadricepsInput },
                { label: "Gemelo (cm)", value: calfInput, setter: setCalfInput },
                { label: "Altura (cm)", value: heightInput, setter: setHeightInput },
              ].map((field) => (
                <View key={field.label} style={{ gap: 2 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>{field.label}</Text>
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
                    value={field.value}
                    onChangeText={field.setter}
                    placeholder="—"
                    placeholderTextColor={mobileTheme.color.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}

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
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>{editingMeasurementId ? "Actualizar" : "Guardar medidas"}</Text>
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
                {foodEstimatorSending ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "92%",
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      backgroundColor: mobileTheme.color.bgSurface,
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textSecondary, lineHeight: 19, fontStyle: "italic" }}>
                      {foodEstimatorStatus || `${foodThinkingLabel}...`}
                    </Text>
                  </View>
                ) : null}
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

            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "800" }}>
              ¡Sesión completada!
            </Text>

            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>
                  {formatClock(workoutCompletionModal.summary.elapsed_seconds)}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Duración</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 22, fontWeight: "800" }}>
                  {workoutCompletionModal.summary.completed_series_count}/
                  {workoutCompletionModal.summary.total_series_count}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Series</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>
                  {workoutCompletionModal.summary.estimated_calories}
                </Text>
                <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Calorías</Text>
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
          <ConfettiCannon
            count={120}
            origin={{ x: -10, y: 0 }}
            autoStart
            fadeOut
            explosionSpeed={400}
            fallSpeed={2800}
            colors={["#CBFF1A", "#00D06E", "#4ECDC4", "#FFE66D", "#FF6B6B", "#FFFFFF"]}
          />
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
              <Pressable onPress={() => { setExercisePickerOpen(false); setSupersetPickerTarget(null); }} style={{ padding: 6 }}>
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
                  onPress={() => {
                    if (supersetPickerTarget) {
                      updateSubSeriesField(supersetPickerTarget.exerciseId, supersetPickerTarget.seriesId, supersetPickerTarget.subSeriesId, "exercise_name", entry.name);
                      updateSubSeriesField(supersetPickerTarget.exerciseId, supersetPickerTarget.seriesId, supersetPickerTarget.subSeriesId, "exercise_id", entry.id);
                      setSupersetPickerTarget(null);
                      setExercisePickerOpen(false);
                    } else {
                      addExerciseFromRepo(entry);
                    }
                  }}
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

      {seriesTypePickerTarget && (
        <Pressable
          onPress={() => setSeriesTypePickerTarget(null)}
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: "rgba(0,0,0,0.76)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 610,
            elevation: 61,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "85%",
              maxWidth: 340,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "#12151C",
              paddingVertical: 12,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700", paddingHorizontal: 12, marginBottom: 10 }}>
              Tipo de serie
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {ALL_SERIES_TYPES.map((st) => {
                const meta = SERIES_TYPE_META[st];
                const isSelected = (() => {
                  const tpl = store.templates.find((t) => t.exercises.some((e) => e.id === seriesTypePickerTarget.exerciseId));
                  const ex = tpl?.exercises.find((e) => e.id === seriesTypePickerTarget.exerciseId);
                  const s = ex?.series?.find((s) => s.id === seriesTypePickerTarget.seriesId);
                  return (s?.type ?? "normal") === st;
                })();
                return (
                  <Pressable
                    key={st}
                    onPress={() => {
                      if (COMPOUND_SERIES_TYPES.includes(st)) {
                        changeSeriesType(seriesTypePickerTarget.exerciseId, seriesTypePickerTarget.seriesId, st);
                      } else {
                        const fn = seriesTypePickerTarget.source === "session"
                          ? updateExerciseSeriesFieldInActiveSession
                          : updateExerciseSeriesFieldInActiveTemplate;
                        fn(seriesTypePickerTarget.exerciseId, seriesTypePickerTarget.seriesId, "type", st);
                      }
                      setSeriesTypePickerTarget(null);
                    }}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      backgroundColor: isSelected ? "rgba(203,255,26,0.1)" : "transparent",
                      borderRadius: 10,
                      marginHorizontal: 4,
                    }}
                  >
                    <View style={{
                      width: 32,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: st === "warmup" ? "rgba(255,74,74,0.2)" : "#202630",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Text style={{
                        color: st === "warmup" ? "#FF4A4A" : "#8C95A4",
                        fontSize: 10,
                        fontWeight: "700",
                      }}>
                        {meta.short}
                      </Text>
                    </View>
                    <Text style={{
                      flex: 1,
                      color: isSelected ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary,
                      fontSize: 15,
                      fontWeight: isSelected ? "700" : "500",
                    }}>
                      {meta.label}
                    </Text>
                    {isSelected && (
                      <Feather name="check" size={16} color={mobileTheme.color.brandPrimary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

      {activeWorkoutSession && tab !== "training" ? (() => {
        const currentExercise = activeSessionExercises.find((e) => e.isCurrentExercise);
        const currentExerciseName = currentExercise?.exercise.name || "Ejercicio";
        const currentMuscle = currentExercise?.muscle || "";
        const seriesLabel = `${activeWorkoutSession.completed_series_count}/${activeWorkoutSession.total_series_count}`;
        return (
          <Pressable
            onPress={() => setTab("training")}
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 14,
              minHeight: 64,
              borderRadius: 16,
              backgroundColor: "#1A2030",
              borderWidth: 1,
              borderColor: "rgba(203,255,26,0.25)",
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              shadowColor: "#000",
              shadowOpacity: 0.5,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 20,
              zIndex: 500,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: "rgba(203,255,26,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="activity" size={20} color={mobileTheme.color.brandPrimary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ color: mobileTheme.color.textPrimary, fontSize: 15, fontWeight: "700" }}
                numberOfLines={1}
              >
                {currentExerciseName}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {currentMuscle ? (
                  <Text style={{ color: "#8B94A3", fontSize: 12 }}>{currentMuscle}</Text>
                ) : null}
                <Text style={{ color: "#8B94A3", fontSize: 12 }}>
                  {currentMuscle ? "•" : ""} {seriesLabel} series
                </Text>
              </View>
              <View
                style={{
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  marginTop: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${activeSessionProgressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: mobileTheme.color.brandPrimary,
                  }}
                />
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={{ color: "#F2F5FA", fontSize: 16, fontWeight: "700" }}>
                {formatClock(activeWorkoutSession.elapsed_seconds)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: activeWorkoutSession.is_resting ? "#FF9500" : "#00C66B",
                  }}
                />
                <Text style={{ color: activeWorkoutSession.is_resting ? "#FF9500" : "#00C66B", fontSize: 11, fontWeight: "700" }}>
                  {activeWorkoutSession.is_resting ? "Descanso" : "Activo"}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })() : null}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
