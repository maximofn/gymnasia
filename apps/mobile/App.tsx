import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type SettingsTabKey = "measures" | "diet" | "charts" | "provider";

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
};
type WorkoutCompletionModalState = {
  summary: WorkoutSessionSummary;
  has_template_changes: boolean;
  original_template: WorkoutTemplate | null;
};
type DietItem = { id: string; title: string; calories_kcal: number };
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
type ProviderConnectionState = "connected" | "disconnected" | "checking" | "unknown";
type ProviderConnectionStatus = { state: ProviderConnectionState; detail: string };
type ProviderConnectionCheckResult = { ok: boolean; message: string };
type ChatInputMessage = { role: "user" | "assistant" | "system"; content: string };
type TrainingFilter = "all" | "strength" | "hypertrophy" | "cardio" | "flexibility";
type TrainingCategory = Exclude<TrainingFilter, "all">;
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
  templates: number;
};

type LocalStore = {
  templates: WorkoutTemplate[];
  dietByDate: Record<string, DietDay>;
  dietSettings: DietSettings;
  measurements: Measurement[];
  threads: ChatThread[];
  messagesByThread: Record<string, ChatMessage[]>;
  keys: AIKey[];
};

const STORAGE_KEY = "gymnasia.mobile.local.v3";
const SESSION_STORAGE_KEY = "gymnasia.mobile.training.session.v1";
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
      ? { state: "unknown", detail: "Pendiente de verificación. Pulsa Guardar." }
      : { state: "disconnected", detail: "Sin API key guardada." };
    return acc;
  }, {} as Record<Provider, ProviderConnectionStatus>);
}

function createProviderBooleanMap(defaultValue: boolean): Record<Provider, boolean> {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider] = defaultValue;
    return acc;
  }, {} as Record<Provider, boolean>);
}

function providerConnectionBadge(status: ProviderConnectionStatus): {
  text: string;
  backgroundColor: string;
  dotColor: string;
  textColor: string;
} {
  if (status.state === "connected") {
    return {
      text: "Conectado",
      backgroundColor: "rgba(16,185,129,0.18)",
      dotColor: "#24D68B",
      textColor: "#24D68B",
    };
  }
  if (status.state === "checking") {
    return {
      text: "Comprobando",
      backgroundColor: "rgba(69,141,255,0.2)",
      dotColor: "#77A8FF",
      textColor: "#77A8FF",
    };
  }
  if (status.state === "unknown") {
    return {
      text: "Sin verificar",
      backgroundColor: "rgba(255,177,102,0.2)",
      dotColor: "#FFB166",
      textColor: "#FFD8A8",
    };
  }
  return {
    text: "No conectado",
    backgroundColor: "rgba(89,100,114,0.26)",
    dotColor: "#616B79",
    textColor: "#798392",
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
const DIET_MACRO_MODE_OPTIONS: Array<{ key: DietMacroMode; label: string }> = [
  { key: "manual_calories", label: "kcal" },
  { key: "protein_by_weight", label: "g/kg" },
];
const GKG_MACRO_KEYS: GkgMacroKey[] = ["protein", "carbs", "fat"];
const SETTINGS_TAB_OPTIONS: Array<{ key: SettingsTabKey; label: string }> = [
  { key: "measures", label: "Medidas" },
  { key: "diet", label: "Dieta" },
  { key: "charts", label: "Gráficas" },
  { key: "provider", label: "Proveedor IA" },
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

async function verifyProviderConnection(provider: AIKey): Promise<ProviderConnectionCheckResult> {
  const apiKey = provider.api_key.trim();
  if (!apiKey) {
    return { ok: false, message: "API key vacía." };
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
      response = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
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
        message: extractErrorMessage(payload, `Error de conexión (${response.status})`),
      };
    }

    return { ok: true, message: "Conexión verificada." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo comprobar la conexión.",
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
  const systemPrompt =
    "Eres Gymnasia Coach. Responde en espanol de forma breve, practica y orientada a entrenamiento, dieta y habitos.";

  if (provider.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODELS.openai,
        messages,
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
    const nonSystemMessages = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      }));

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

  const nonSystemMessages = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
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
        contents: nonSystemMessages,
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

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sumDayCalories(day: DietDay | null): number {
  if (!day) return 0;
  return day.meals.reduce((mealAcc, meal) => {
    return mealAcc + meal.items.reduce((itemAcc, item) => itemAcc + item.calories_kcal, 0);
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

function formatMeasurementNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function buildMeasurementHighlights(measurement: Measurement): string[] {
  const chips: string[] = [];
  if (measurement.weight_kg !== null) {
    chips.push(`Peso ${formatMeasurementNumber(measurement.weight_kg)} kg`);
  }
  if (measurement.neck_cm !== null) {
    chips.push(`Cuello ${formatMeasurementNumber(measurement.neck_cm)} cm`);
  }
  if (measurement.chest_cm !== null) {
    chips.push(`Pecho ${formatMeasurementNumber(measurement.chest_cm)} cm`);
  }
  if (measurement.waist_cm !== null) {
    chips.push(`Cintura ${formatMeasurementNumber(measurement.waist_cm)} cm`);
  }
  if (measurement.hips_cm !== null) {
    chips.push(`Cadera ${formatMeasurementNumber(measurement.hips_cm)} cm`);
  }
  if (measurement.biceps_cm !== null) {
    chips.push(`Bíceps ${formatMeasurementNumber(measurement.biceps_cm)} cm`);
  }
  if (measurement.quadriceps_cm !== null) {
    chips.push(`Cuádriceps ${formatMeasurementNumber(measurement.quadriceps_cm)} cm`);
  }
  if (measurement.calf_cm !== null) {
    chips.push(`Gemelo ${formatMeasurementNumber(measurement.calf_cm)} cm`);
  }
  if (measurement.height_cm !== null) {
    chips.push(`Altura ${formatMeasurementNumber(measurement.height_cm)} cm`);
  }
  return chips;
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

function estimateWorkoutCalories(session: WorkoutSession): number {
  const minutes = Math.max(1, session.elapsed_seconds / 60);
  const burnRateByCategory: Record<TrainingCategory, number> = {
    strength: 8.8,
    hypertrophy: 9.2,
    cardio: 10.5,
    flexibility: 4.5,
  };
  return Math.max(1, Math.round(minutes * burnRateByCategory[session.category]));
}

function formatClock(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${`${remainder}`.padStart(2, "0")}`;
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
    training: "Train",
    diet: "Dieta",
    measures: "Stats",
    chat: "Chat",
    settings: "Cfg",
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

function createInitialStore(): LocalStore {
  const firstThreadId = uid("thread");

  return {
    templates: [],
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

  return {
    templates,
    dietByDate: raw.dietByDate ?? {},
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

  const [mealTitleInput, setMealTitleInput] = useState("");
  const [mealCaloriesInput, setMealCaloriesInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [measurementPhotoUri, setMeasurementPhotoUri] = useState<string | null>(null);
  const [measurementDate, setMeasurementDate] = useState<Date>(() => measurementDateFromSelection(new Date()));
  const [showMeasurementDatePicker, setShowMeasurementDatePicker] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [neckInput, setNeckInput] = useState("");
  const [chestInput, setChestInput] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [hipsInput, setHipsInput] = useState("");
  const [bicepsInput, setBicepsInput] = useState("");
  const [quadricepsInput, setQuadricepsInput] = useState("");
  const [calfInput, setCalfInput] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTabKey>("measures");
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
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingFilter, setTrainingFilter] = useState<TrainingFilter>("all");
  const [isGlobalScreenLoading, setIsGlobalScreenLoading] = useState(false);
  const [isTrainingEditorLoading, setIsTrainingEditorLoading] = useState(false);
  const [activeTrainingTemplateId, setActiveTrainingTemplateId] = useState<string | null>(null);
  const [trainingMenuTemplateId, setTrainingMenuTemplateId] = useState<string | null>(null);
  const [activeExerciseMenuId, setActiveExerciseMenuId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
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
  const dietDay = store.dietByDate[today] ?? { day_date: today, meals: [] };
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
  const dietSettings = store.dietSettings;
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

  const dashboard = useMemo<Dashboard>(() => {
    return {
      calories: sumDayCalories(dietDay),
      weight: latestBodyWeightKg,
      templates: store.templates.length,
    };
  }, [dietDay, latestBodyWeightKg, store.templates.length]);

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
          ? "Editar Rutina"
          : "Mis Rutinas"
      : tabLabel(tab);
  const headerTitleSize = tab === "training" ? 34 : 28;
  const showGlobalScreenLoading = ENABLE_GLOBAL_SCREEN_LOAD_DELAY && isGlobalScreenLoading;
  const isTrainingEditorOpen = tab === "training" && !activeWorkoutSession && !!activeTrainingTemplateId;
  const showTrainingListSkeleton =
    tab === "training" &&
    !activeTrainingTemplate &&
    !activeWorkoutSession &&
    showGlobalScreenLoading;
  const showTrainingEditorSkeleton =
    isTrainingEditorOpen &&
    (isTrainingEditorLoading || showGlobalScreenLoading);

  useEffect(() => {
    if (heightInput.trim()) return;
    if (!latestHeightMeasurement || latestHeightMeasurement.height_cm === null) return;
    setHeightInput(formatMeasurementNumber(latestHeightMeasurement.height_cm));
  }, [heightInput, latestHeightMeasurement]);

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
  }, [activeTrainingTemplateId, store.templates]);

  useEffect(() => {
    if (!trainingMenuTemplateId) return;
    if (store.templates.some((template) => template.id === trainingMenuTemplateId)) return;
    setTrainingMenuTemplateId(null);
  }, [store.templates, trainingMenuTemplateId]);

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
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stripSensitiveStoreData(mergedStore))),
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
    if (!isHydrated || providerSettingsInitializedRef.current) return;
    setProviderDraftByProvider(createProviderDraftMap(store.keys));
    setProviderConnectionStatus(createProviderConnectionStatusMap(store.keys));
    providerSettingsInitializedRef.current = true;
  }, [isHydrated, store.keys]);

  useEffect(() => {
    if (!isHydrated) return;

    Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stripSensitiveStoreData(store))),
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
  }, [activeWorkoutSession?.id, activeWorkoutSession?.status]);

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
      const assistantContent = await callProviderChatAPI(activeProvider, [
        {
          role: "system",
          content:
            "Eres Gymnasia Coach. Responde en espanol, con consejos utiles y accionables para entrenamiento y nutricion.",
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

  function addMeal() {
    const title = mealTitleInput.trim() || "Comida";
    const calories = Number(mealCaloriesInput.replace(",", "."));

    if (!Number.isFinite(calories) || calories <= 0) {
      setError("Introduce calorías válidas para guardar la comida.");
      return;
    }

    const meal: DietMeal = {
      id: uid("meal"),
      title,
      items: [{ id: uid("food"), title, calories_kcal: calories }],
    };

    setStore((prev) => {
      const currentDay = prev.dietByDate[today] ?? { day_date: today, meals: [] };
      return {
        ...prev,
        dietByDate: {
          ...prev.dietByDate,
          [today]: {
            ...currentDay,
            meals: [...currentDay.meals, meal],
          },
        },
      };
    });

    setMealTitleInput("");
    setMealCaloriesInput("");
  }

  function addWeight() {
    const value = parsePositiveNumberInput(weightInput);
    if (value === null) {
      setError("Introduce un peso válido.");
      return;
    }

    const measurement: Measurement = {
      id: uid("measurement"),
      measured_at: measurementDateFromSelection(new Date()).toISOString(),
      weight_kg: value,
      photo_uri: null,
      neck_cm: null,
      chest_cm: null,
      waist_cm: null,
      hips_cm: null,
      biceps_cm: null,
      quadriceps_cm: null,
      calf_cm: null,
      height_cm: null,
    };

    setStore((prev) => {
      const nextMeasurements = sortMeasurementsDesc([measurement, ...prev.measurements]).slice(0, 60);
      return {
        ...prev,
        measurements: nextMeasurements,
      };
    });
    setWeightInput("");
    setError(null);
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

    resetMeasurementForm();
    setError(null);
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
    const template = store.templates.find((item) => item.id === templateId);
    setExpandedExerciseId(template?.exercises[0]?.id ?? null);
    setActiveExerciseMenuId(null);
    setError(null);
  }

  function closeTrainingTemplateEditor() {
    setActiveTrainingTemplateId(null);
    setTrainingMenuTemplateId(null);
    setExpandedExerciseId(null);
    setActiveExerciseMenuId(null);
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
    openTrainingTemplate(templateId);
  }

  function addExerciseToActiveTemplate() {
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
    const summary: WorkoutSessionSummary = {
      id: uid("session_summary"),
      template_id: session.template_id,
      template_name: session.template_name,
      finished_at: new Date().toISOString(),
      elapsed_seconds: session.elapsed_seconds,
      completed_series_count: session.completed_series_count,
      total_series_count: session.total_series_count,
      estimated_calories: estimateWorkoutCalories(session),
    };
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
      content: "Nuevo hilo creado. Este chat usa llamada directa a la API del proveedor activo.",
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

    if (options.markPending) {
      setProviderConnectionStatus((prev) => ({
        ...prev,
        [provider]: nextDraft.api_key.trim()
          ? { state: "unknown", detail: "Cambios pendientes. Pulsa Guardar para verificar." }
          : { state: "disconnected", detail: "Sin API key guardada." },
      }));
    }
  }

  async function saveProviderApiKey(provider: Provider) {
    const draft = providerDraftByProvider[provider];
    if (!draft) return;

    const normalizedApiKey = draft.api_key.trim();
    const normalizedModel = draft.model.trim() || DEFAULT_MODELS[provider];

    setActiveProvider(provider);
    setError(null);
    setProviderSaveLoading((prev) => ({ ...prev, [provider]: true }));

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
        [provider]: { state: "disconnected", detail: "Sin API key guardada." },
      }));
      setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
      setProviderKeyVisible(provider, false);
      return;
    }

    setProviderConnectionStatus((prev) => ({
      ...prev,
      [provider]: { state: "checking", detail: "Comprobando conexión..." },
    }));

    const check = await verifyProviderConnection({
      provider,
      is_active: true,
      api_key: normalizedApiKey,
      model: normalizedModel,
    });

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
    setProviderConnectionStatus((prev) => ({
      ...prev,
      [provider]: check.ok
        ? { state: "connected", detail: "Conexión verificada." }
        : { state: "disconnected", detail: check.message },
    }));
    setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
    setProviderKeyVisible(provider, false);
    if (!check.ok) {
      setError(`No se pudo conectar con ${PROVIDER_UI_META[provider].label}: ${check.message}`);
      return;
    }
    setError(null);
  }

  function deleteProviderApiKey(provider: Provider) {
    Alert.alert(
      "Eliminar key",
      `Se borrará la API key guardada para ${PROVIDER_UI_META[provider].label}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            updateProviderConfig(provider, { api_key: "" });
            updateProviderDraft(provider, { api_key: "" }, { markPending: false });
            setProviderConnectionStatus((prev) => ({
              ...prev,
              [provider]: { state: "disconnected", detail: "Sin API key guardada." },
            }));
            setProviderSaveLoading((prev) => ({ ...prev, [provider]: false }));
            setProviderKeyVisible(provider, false);
            setError(null);
          },
        },
      ],
    );
  }

  function resetLocalData() {
    const initial = createInitialStore();
    setStore(initial);
    setProviderKeyVisibility(createProviderBooleanMap(false));
    setProviderDraftByProvider(createProviderDraftMap(initial.keys));
    setProviderConnectionStatus(createProviderConnectionStatusMap(initial.keys));
    setProviderSaveLoading(createProviderBooleanMap(false));
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
        {tab === "training" && (isTrainingEditorOpen || activeWorkoutSession) ? null : tab === "training" ? (
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
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
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
                <Text
                  style={{
                    color: isActiveTab ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {tabLabel(key)}
                </Text>
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
            {Array.from({ length: tab === "chat" ? 5 : tab === "home" ? 3 : 4 }).map((_, index) => (
              <View
                key={`screen_skeleton_${tab}_${index}`}
                style={{
                  minHeight: tab === "chat" ? 72 : 92,
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: mobileTheme.spacing[4], paddingBottom: 90 }}>
          {error ? <Text style={{ color: "#ff8a8a", marginBottom: 12 }}>{error}</Text> : null}

          {tab === "home" ? (
            <View style={{ gap: 12 }}>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Calorías</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>{dashboard.calories.toFixed(0)} kcal</Text>
              </View>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Peso</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>
                  {dashboard.weight !== null ? `${dashboard.weight.toFixed(2)} kg` : "-"}
                </Text>
              </View>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 14 }}>
                <Text style={{ color: mobileTheme.color.textSecondary }}>Rutinas</Text>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "700", marginTop: 4 }}>{dashboard.templates}</Text>
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
                      style={{ color: mobileTheme.color.textPrimary, fontSize: 34, fontWeight: "700" }}
                      numberOfLines={2}
                    >
                      {activeWorkoutSession.template_name}
                    </Text>
                    <Text style={{ color: "#8892A2", fontSize: 14 }}>
                      Estado {activeWorkoutSession.status === "running" ? "Activo" : "Pausado"}
                    </Text>
	                  </View>
	                  <View style={{ alignItems: "flex-end", gap: 10 }}>
	                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
	                      <Ionicons name="timer-outline" size={20} color="#F2F5FA" />
	                      <Text style={{ color: "#F2F5FA", fontSize: 28, fontWeight: "700" }}>
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
	                      <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}>Finalizar</Text>
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
                    <Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "600" }}>
                      {activeWorkoutSession.completed_series_count}/{activeWorkoutSession.total_series_count} series
                    </Text>
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>
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
                    <Text style={{ color: "#8B94A3", fontSize: 18, textAlign: "center" }}>
                      No hay una serie activa disponible.
                    </Text>
                  </View>
                ) : (
                  activeSessionExercises.map((sessionExercise) => {
                    const isExpanded = sessionExercise.isCurrentExercise;
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
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              borderWidth: sessionExercise.isCompletedExercise ? 0 : 1,
                              borderColor: "#3B4351",
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
                                fontSize: 14,
                                fontWeight: "800",
                              }}
                            >
                              {sessionExercise.isCompletedExercise
                                ? "✓"
                                : `${sessionExercise.exerciseIndex + 1}`}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "700" }}
                              numberOfLines={1}
                            >
                              {sessionExercise.exercise.name || `Ejercicio ${sessionExercise.exerciseIndex + 1}`}
                            </Text>
                            <Text
                              style={{
                                color: sessionExercise.isCompletedExercise ? "#00C66B" : "#8B94A3",
                                fontSize: 20,
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
                              <Text style={{ width: 42, color: "#7D8798", fontSize: 14, fontWeight: "700" }}>
                                SET
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 14, fontWeight: "700" }}>
                                REPS
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 14, fontWeight: "700" }}>
                                PESO
                              </Text>
                              <Text style={{ flex: 1, color: "#7D8798", fontSize: 14, fontWeight: "700" }}>
                                DESCANSO
                              </Text>
                            </View>

                            {sessionExercise.seriesStates.map((seriesState) => (
                              <View
                                key={seriesState.key}
                                style={{
                                  minHeight: 42,
                                  borderRadius: 10,
                                  backgroundColor: seriesState.isCurrent
                                    ? "rgba(203,255,26,0.16)"
                                    : "transparent",
                                  borderWidth: seriesState.isCurrent ? 1 : 0,
                                  borderColor: seriesState.isCurrent
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
                                    markSessionSeriesAsNotDone(
                                      sessionExercise.exercise.id,
                                      seriesState.series.id,
                                    );
                                  }}
                                  disabled={!seriesState.isCompleted}
                                  hitSlop={6}
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 999,
                                    backgroundColor: seriesState.isCompleted
                                      ? "#0AAE63"
                                      : seriesState.isCurrent
                                        ? mobileTheme.color.brandPrimary
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
                                        : seriesState.isCurrent
                                          ? "#06090D"
                                          : "#9AA4B4",
                                      fontSize: 12,
                                      fontWeight: "800",
                                    }}
                                  >
                                    {seriesState.isCompleted ? "✓" : `${seriesState.seriesIndex + 1}`}
                                  </Text>
                                </Pressable>
                                {seriesState.isCurrent ? (
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
                                        borderColor: "rgba(203,255,26,0.8)",
                                        backgroundColor: "rgba(6,9,13,0.32)",
                                        color: mobileTheme.color.brandPrimary,
                                        fontSize: 22,
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
                                        fontSize: 22,
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
                                        fontSize: 22,
                                        fontWeight: "600",
                                        textAlign: "center",
                                      }}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <Text
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: "#C7CED9",
                                        fontSize: 22,
                                        fontWeight: "700",
                                        textAlign: "center",
                                      }}
                                    >
                                      {seriesState.series.reps || "-"}
                                    </Text>
                                    <Text
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: "#C7CED9",
                                        fontSize: 22,
                                        fontWeight: "600",
                                        textAlign: "center",
                                      }}
                                    >
                                      {seriesState.series.weight_kg?.trim()
                                        ? `${seriesState.series.weight_kg} kg`
                                        : "-"}
                                    </Text>
                                    <Text
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: "#8C95A4",
                                        fontSize: 22,
                                        fontWeight: "600",
                                        textAlign: "center",
                                      }}
                                    >
                                      {seriesState.series.rest_seconds || "-"}
                                    </Text>
                                  </>
                                )}
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
                                  <Text style={{ color: "#76A9FF", fontSize: 15, fontWeight: "700" }}>
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

                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Pressable
                                onPress={completeCurrentSessionSeries}
                                testID="training-session-complete-series"
                                disabled={activeWorkoutSession.is_resting}
                                style={{
                                  flex: 1.4,
                                  minHeight: 44,
                                  borderRadius: 12,
                                  backgroundColor: mobileTheme.color.brandPrimary,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: activeWorkoutSession.is_resting ? 0.55 : 1,
                                }}
                              >
                                <Text style={{ color: "#06090D", fontSize: 14, fontWeight: "800" }}>
                                  Marcar serie hecha
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={
                                  activeWorkoutSession.status === "running"
                                    ? pauseWorkoutSession
                                    : resumeWorkoutSession
                                }
                                testID="training-session-toggle-pause"
                                style={{
                                  flex: 1,
                                  minHeight: 44,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: mobileTheme.color.borderSubtle,
                                  backgroundColor: "#171B23",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "700" }}>
                                  {activeWorkoutSession.status === "running" ? "Pausar" : "Reanudar"}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={discardWorkoutSession}
                                testID="training-session-discard"
                                style={{
                                  flex: 1,
                                  minHeight: 44,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: confirmDiscardSession
                                    ? "rgba(255,74,74,0.8)"
                                    : "rgba(255,74,74,0.35)",
                                  backgroundColor: confirmDiscardSession
                                    ? "rgba(255,74,74,0.16)"
                                    : "rgba(255,74,74,0.08)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: "#FF7676", fontSize: 14, fontWeight: "700" }}>
                                  Abandonar
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => moveWorkoutSessionPointer(-1)}
                    testID="training-session-prev"
                    disabled={activeWorkoutSession.is_resting}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: activeWorkoutSession.is_resting
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: activeWorkoutSession.is_resting ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ color: "#8F98A7", fontSize: 13, fontWeight: "700" }}>Anterior</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveWorkoutSessionPointer(1)}
                    testID="training-session-next"
                    disabled={activeWorkoutSession.is_resting}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: activeWorkoutSession.is_resting
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: activeWorkoutSession.is_resting ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ color: "#8F98A7", fontSize: 13, fontWeight: "700" }}>Siguiente</Text>
                  </Pressable>
                </View>
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
                      ← Rutinas
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveTrainingTemplateChanges}
                    style={{
                      height: 50,
                      borderRadius: 16,
                      backgroundColor: mobileTheme.color.brandPrimary,
                      paddingHorizontal: 18,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#06090D", fontSize: 31, fontWeight: "800" }}>Guardar</Text>
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
                    fontSize: 40,
                    fontWeight: "700",
                    minHeight: 56,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255,255,255,0.12)",
                    paddingBottom: 6,
                  }}
                />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {activeTrainingIcon ? (
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
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
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          backgroundColor: activeTrainingCategoryMeta.color,
                        }}
                      />
                      <Text
                        style={{
                          color: activeTrainingCategoryMeta.color,
                          fontSize: 25,
                          fontWeight: "700",
                        }}
                      >
                        {activeTrainingCategoryMeta.label}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={{ color: "#8B94A3", fontSize: 25 }}>
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
                        minWidth: 56,
                        minHeight: 34,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        paddingHorizontal: 10,
                        color: mobileTheme.color.textPrimary,
                        fontSize: 20,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    />
                    <Text style={{ color: "#8B94A3", fontSize: 22 }}>min</Text>
                  </View>
                  <Text style={{ color: "#8B94A3", fontSize: 25 }}>
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
                    minHeight: 54,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? "rgba(203,255,26,0.65)"
                      : "rgba(255,255,255,0.12)",
                    backgroundColor: templateHasRunnableSeries(activeTrainingTemplate)
                      ? "rgba(203,255,26,0.14)"
                      : "rgba(255,255,255,0.04)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: templateHasRunnableSeries(activeTrainingTemplate)
                        ? mobileTheme.color.brandPrimary
                        : "#7F8896",
                      fontSize: 23,
                      fontWeight: "800",
                    }}
                  >
                    Iniciar entrenamiento
                  </Text>
                </Pressable>

                <Pressable
                  onPress={addExerciseToActiveTemplate}
                  testID="training-editor-add-exercise"
                  style={{
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
                          borderWidth: isExpanded ? 2 : 1,
                          borderColor: isExpanded
                            ? "rgba(203,255,26,0.85)"
                            : mobileTheme.color.borderSubtle,
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
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              backgroundColor: mobileTheme.color.brandPrimary,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#06090D", fontSize: 20, fontWeight: "800" }}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <TextInput
                              value={exercise.name ?? ""}
                              onChangeText={(value) => updateExerciseNameInActiveTemplate(exercise.id, value)}
                              placeholder={`Ejercicio ${index + 1}`}
                              placeholderTextColor="#8B94A3"
                              style={{
                                color: mobileTheme.color.textPrimary,
                                fontSize: 34,
                                fontWeight: "700",
                                minHeight: 42,
                              }}
                            />
                            <Text style={{ color: "#8B94A3", fontSize: 24 }}>
                              {exerciseMuscle} • {exerciseSeries.length} series
                              {firstWeight ? ` • ${firstWeight} kg` : ""}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() =>
                              setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))
                            }
                            style={{
                              width: 28,
                              height: 28,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: "#8B94A3", fontSize: 20, fontWeight: "700" }}>
                              {isExpanded ? "˅" : "˃"}
                            </Text>
                          </Pressable>
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

                        {isExpanded ? (
                          <View style={{ gap: 0 }}>
                            <View
                              style={{
                                minHeight: 36,
                                borderRadius: 10,
                                backgroundColor: "#202630",
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 12,
                                gap: 8,
                              }}
                            >
                              <Text
                                style={{
                                  width: 30,
                                  color: "#7D8798",
                                  fontSize: 15,
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
                                  fontSize: 15,
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
                                  fontSize: 15,
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
                                  fontSize: 15,
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
                                    minHeight: 50,
                                    borderBottomWidth:
                                      setIndex === exerciseSeries.length - 1 ? 0 : 1,
                                    borderBottomColor: "rgba(255,255,255,0.08)",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingHorizontal: 12,
                                    gap: 8,
                                  }}
                                >
                                  <Text
                                    style={{
                                      width: 30,
                                      color: "#8C95A4",
                                      fontSize: 18,
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
                                      fontSize: 18,
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
                                      fontSize: 18,
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
                                      fontSize: 18,
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
                                marginTop: 8,
                                minHeight: 42,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                                backgroundColor: "#171B23",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: "#7F8896", fontSize: 24, fontWeight: "600" }}>
                                + Añadir serie
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
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
                  onPress={addExerciseToActiveTemplate}
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
                    minHeight: 58,
                    borderRadius: 16,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontSize: 31, fontWeight: "800" }}>
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
                          <Pressable
                            onPress={() => startTrainingSession(tpl.id)}
                            style={{
                              borderWidth: 1,
                              borderColor: isMenuOpen
                                ? "rgba(203,255,26,0.8)"
                                : mobileTheme.color.borderSubtle,
                              backgroundColor: "#171B23",
                              borderRadius: 18,
                              minHeight: 92,
                              paddingLeft: 14,
                              paddingRight: 56,
                              paddingVertical: 14,
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
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                                onPress={() => openTrainingTemplate(tpl.id)}
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
            <View style={{ gap: 10 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Día {dietDay.day_date}</Text>
              {dietDay.meals.map((meal) => (
                <View key={meal.id} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>{meal.title}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{meal.items.length} items</Text>
                </View>
              ))}

              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Añadir comida local</Text>
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
                  placeholder="Título (ej: Cena)"
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
                <Pressable
                  onPress={addMeal}
                  style={{
                    height: 44,
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>Guardar comida</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {tab === "measures" ? (
            <View style={{ gap: 10 }}>
              <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Añadir peso</Text>
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
                  placeholder="Peso (kg)"
                  placeholderTextColor={mobileTheme.color.textSecondary}
                  keyboardType="decimal-pad"
                />
                <Pressable
                  onPress={addWeight}
                  style={{
                    height: 44,
                    borderRadius: mobileTheme.radius.md,
                    backgroundColor: mobileTheme.color.brandPrimary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#06090D", fontWeight: "700" }}>Guardar peso</Text>
                </Pressable>
              </View>

              {store.measurements.map((m) => (
                <View key={m.id} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12 }}>
                  <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>{new Date(m.measured_at).toLocaleString()}</Text>
                  <Text style={{ color: mobileTheme.color.textSecondary, marginTop: 4 }}>{m.weight_kg !== null ? `${m.weight_kg} kg` : "Sin peso"}</Text>
                </View>
              ))}
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

              <View style={{ maxHeight: 360, gap: 8 }}>
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
              </View>

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

              {settingsTab === "measures" ? (
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
                    Medidas
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary }}>
                    Registra peso, foto y contornos con fecha editable desde calendario. La fecha por defecto es hoy.
                  </Text>
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
                  <Pressable
                    onPress={addMeasurementFromSettings}
                    style={{
                      height: 44,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.brandPrimary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#06090D", fontWeight: "700" }}>Guardar medidas</Text>
                  </Pressable>

                  {store.measurements.length === 0 ? (
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Sin medidas registradas todavía.
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {store.measurements.slice(0, 10).map((measurement) => {
                        const highlights = buildMeasurementHighlights(measurement);
                        return (
                          <View
                            key={measurement.id}
                            style={{
                              borderWidth: 1,
                              borderColor: mobileTheme.color.borderSubtle,
                              borderRadius: mobileTheme.radius.md,
                              backgroundColor: mobileTheme.color.bgApp,
                              padding: 10,
                              gap: 8,
                            }}
                          >
                            <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                              {formatMeasurementDate(measurement.measured_at)}
                            </Text>
                            {measurement.photo_uri ? (
                              <Image
                                source={{ uri: measurement.photo_uri }}
                                style={{
                                  width: "100%",
                                  height: 140,
                                  borderRadius: mobileTheme.radius.md,
                                  backgroundColor: mobileTheme.color.bgSurface,
                                }}
                              />
                            ) : null}
                            {highlights.length > 0 ? (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {highlights.map((highlight, highlightIndex) => (
                                  <View
                                    key={`${measurement.id}_${highlightIndex}`}
                                    style={{
                                      borderRadius: mobileTheme.radius.pill,
                                      borderWidth: 1,
                                      borderColor: mobileTheme.color.borderSubtle,
                                      backgroundColor: mobileTheme.color.bgSurface,
                                      paddingHorizontal: 10,
                                      minHeight: 28,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12 }}>
                                      {highlight}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            ) : (
                              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                                Sin valores numéricos en este registro.
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}

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

              {settingsTab === "charts" ? (
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
                    Gráficas
                  </Text>
                  <Text style={{ color: mobileTheme.color.textSecondary }}>
                    Esta sección quedará preparada para gráficas de evolución de medidas y dieta.
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: mobileTheme.color.borderSubtle,
                      borderRadius: mobileTheme.radius.md,
                      backgroundColor: mobileTheme.color.bgApp,
                      padding: 10,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>
                      Vista previa
                    </Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Peso actual: {latestBodyWeightKg !== null ? `${latestBodyWeightKg.toFixed(2)} kg` : "Sin datos"}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Calorías objetivo: {dietDailyCaloriesTarget > 0 ? `${dietDailyCaloriesTarget.toFixed(0)} kcal` : "Sin definir"}
                    </Text>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
                      Calorías consumidas hoy: {dashboard.calories.toFixed(0)} kcal
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
                    const keyVisible = providerKeyVisibility[key.provider];
                    const connectionStatus = providerConnectionStatus[key.provider] ?? {
                      state: hasDraftApiKey ? "unknown" : "disconnected",
                      detail: hasDraftApiKey
                        ? "Pendiente de verificación. Pulsa Guardar."
                        : "Sin API key guardada.",
                    };
                    const statusMeta = providerConnectionBadge(connectionStatus);
                    const isSavingProvider = providerSaveLoading[key.provider];
                    const providerUsageHint = key.is_active
                      ? "Proveedor activo para el chat."
                      : "Toca el encabezado para usar este proveedor en el chat.";
                    const providerUsageHintColor = key.is_active ? "#24D68B" : "#656E7B";
                    const providerConnectionDetailColor = connectionStatus.detail.includes(
                      "Sin API key guardada",
                    )
                      ? "#FF8D8D"
                      : "#656E7B";
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
                            onPress={() => deleteProviderApiKey(key.provider)}
                            style={{
                              flex: 1,
                              height: 44,
                              borderRadius: mobileTheme.radius.md,
                              backgroundColor: "#FF4D4F",
                              alignItems: "center",
                              justifyContent: "center",
                              flexDirection: "row",
                              gap: 8,
                            }}
                          >
                            <Feather name="trash-2" size={14} color="#FFDDE0" />
                            <Text style={{ color: "#FFE8EB", fontWeight: "700" }}>Eliminar</Text>
                          </Pressable>
                        </View>

                        <Text style={{ color: providerUsageHintColor, fontSize: 12 }}>
                          {providerUsageHint}
                        </Text>
                        <Text style={{ color: providerConnectionDetailColor, fontSize: 12 }}>
                          {connectionStatus.detail}
                        </Text>

                        {key.is_active ? (
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
                        SecureStore no disponible en este entorno. La API key no se persistirá de forma segura.
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
            </View>
          ) : null}
        </ScrollView>
      )}

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

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
