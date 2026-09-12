import {
  createAiIdentityChatMessage,
  normalizeMessagesByThread,
  normalizeThreadTitle,
  type ChatMessage,
  type ChatThread,
} from "../agent/chatModel";
import {
  createDefaultProviderConfigurations,
  normalizeProviderConfigurations,
  type Provider,
  type ProviderConfiguration,
} from "../agent/providerConfiguration";
import { stripProviderApiKeys } from "../agent/providerCredentials";
import { normalizeCatalogLink } from "../catalogs/migrations";
import {
  createDefaultDietSettings,
  normalizeDietByDate,
  normalizeDietSettings,
  type DietDay,
  type DietSettings,
} from "../diet/model";
import {
  formatMeasurementIssues,
  normalizeMeasurements,
  type Measurement,
} from "../measurements/measurementContract";
import {
  buildSeriesFromLegacyExercise,
  createIssueSink,
  formatTrainingIssues,
  readSeriesSchemaVersion,
  resolveTrainingIssues,
  sealedSeriesSchemaVersion,
  seriesToLegacySets,
  TRAINING_SERIES_SCHEMA_VERSION,
  type TrainingNormalizationMode,
  type TrainingValidationIssue,
} from "../training/seriesContract";
import {
  normalizeWorkoutSessionSummary,
  sortWorkoutHistoryDesc,
  type WorkoutSessionSummary,
} from "../training/workoutHistory";
import {
  inferTrainingCategory,
} from "../training/workoutSessionModel";
import {
  normalizeDurationText,
  normalizeExerciseImageUri,
  normalizeTemplateIcon,
} from "../training/presentationModel";
import type { WorkoutTemplate } from "../training/workoutTemplateOperations";

export const MAX_WORKOUT_HISTORY_ITEMS = 180;

export type LocalStore = {
  templates: WorkoutTemplate[];
  workoutHistory: WorkoutSessionSummary[];
  dietByDate: Record<string, DietDay>;
  dietSettings: DietSettings;
  measurements: Measurement[];
  threads: ChatThread[];
  messagesByThread: Record<string, ChatMessage[]>;
  keys: ProviderConfiguration[];
  chatProvider?: Provider;
  foodAIProvider?: Provider;
};

export type LocalStoreModelRuntime = {
  now(): number;
  createId(prefix: string): string;
};

const defaultRuntime: LocalStoreModelRuntime = {
  now: () => Date.now(),
  createId: (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

export function serializeStoreForAsyncStorage(store: LocalStore): LocalStore {
  return stripProviderApiKeys(store);
}

export function mergeStoreWithSecureApiKeys(
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

export function createInitialStore(
  runtime: LocalStoreModelRuntime = defaultRuntime,
): LocalStore {
  const firstThreadId = runtime.createId("thread");
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: createDefaultDietSettings(),
    measurements: [],
    threads: [{ id: firstThreadId, title: "Gymnasia Coach 1" }],
    messagesByThread: {
      [firstThreadId]: [createAiIdentityChatMessage("msg", "main-chat", runtime)],
    },
    keys: createDefaultProviderConfigurations(),
  };
}

export function createActivityResetStore(
  store: LocalStore,
  runtime: LocalStoreModelRuntime = defaultRuntime,
): LocalStore {
  const initial = createInitialStore(runtime);
  return {
    ...initial,
    dietSettings: { ...store.dietSettings },
    keys: store.keys.map((key) => ({ ...key })),
    chatProvider: store.chatProvider,
    foodAIProvider: store.foodAIProvider,
  };
}

export function normalizeStore(
  raw: LocalStore,
  options: {
    training?: TrainingNormalizationMode;
    onTrainingIssues?: (issues: TrainingValidationIssue[]) => void;
  } = {},
  runtime: LocalStoreModelRuntime = defaultRuntime,
): LocalStore {
  const normalizedDietSettings = normalizeDietSettings(raw.dietSettings);
  const keys = normalizeProviderConfigurations(raw.keys);
  const trainingSink = createIssueSink(options.training ?? "repair");

  const chatProvider: Provider =
    ((raw as unknown as Record<string, unknown>).chatProvider as Provider) ??
    keys.find((key) => key.is_active)?.provider ??
    "openai";
  const foodAIProvider: Provider =
    ((raw as unknown as Record<string, unknown>).foodAIProvider as Provider) ??
    "google";

  const templates: WorkoutTemplate[] = (raw.templates ?? []).map(
    (template, templateIndex) => {
      const templateField = `templates[${templateIndex}]`;
      const templateSchemaVersion = readSeriesSchemaVersion(template);
      if (
        templateSchemaVersion !== null &&
        templateSchemaVersion > TRAINING_SERIES_SCHEMA_VERSION
      ) {
        trainingSink.push(
          `${templateField}.series_schema_version`,
          "unknown_schema_version",
          "Una rutina se guardó con una versión posterior de la app y se ha leído lo mejor posible.",
        );
      }
      const normalizedExercises = (template.exercises ?? []).map(
        (exercise, exerciseIndex) => {
          const normalizedSeries = buildSeriesFromLegacyExercise(
            exercise,
            `${templateField}.exercises[${exerciseIndex}]`,
            runtime.createId,
            trainingSink,
          );
          const nextSets = seriesToLegacySets(normalizedSeries);
          const firstWeightText =
            normalizedSeries.find((item) => item.weight_kg.trim())?.weight_kg ?? "";
          const firstRestText =
            normalizedSeries.find((item) => item.rest_seconds.trim())?.rest_seconds ?? "";
          const parsedLoad = Number(firstWeightText);
          const parsedRest = Number(firstRestText);
          return {
            ...exercise,
            name: exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`,
            image_uri: normalizeExerciseImageUri(exercise.image_uri),
            catalog_link: normalizeCatalogLink(exercise.catalog_link),
            series: normalizedSeries,
            sets: nextSets,
            load_kg:
              Number.isFinite(parsedLoad) && parsedLoad > 0
                ? parsedLoad
                : exercise.load_kg ?? null,
            rest_seconds:
              Number.isFinite(parsedRest) && parsedRest > 0
                ? parsedRest
                : exercise.rest_seconds ?? null,
          };
        },
      );

      const normalizedDuration = normalizeDurationText(template.duration_minutes ?? "");
      const normalizedCategory =
        template.category === "strength" ||
        template.category === "hypertrophy" ||
        template.category === "cardio" ||
        template.category === "flexibility"
          ? template.category
          : inferTrainingCategory(template.name?.trim() || "");
      const normalizedIcon = normalizeTemplateIcon(
        template.icon,
        normalizedCategory,
        templateIndex,
      );
      return {
        ...template,
        series_schema_version: sealedSeriesSchemaVersion(template),
        name: template.name?.trim() || `Rutina ${templateIndex + 1}`,
        category: normalizedCategory,
        icon: normalizedIcon,
        duration_minutes: normalizedDuration,
        exercises: normalizedExercises,
      };
    },
  );

  const normalizedMeasurementsResult = normalizeMeasurements(
    Array.isArray(raw.measurements) ? raw.measurements : [],
    runtime.createId,
  );
  if (!normalizedMeasurementsResult.ok) {
    throw new Error(formatMeasurementIssues(normalizedMeasurementsResult.issues));
  }
  const normalizedWorkoutHistory = sortWorkoutHistoryDesc(
    (Array.isArray(raw.workoutHistory) ? raw.workoutHistory : []).map(
      (summary, index) =>
        normalizeWorkoutSessionSummary(
          summary,
          index,
          runtime.createId(`session_summary_${index}`),
          undefined,
          {
            mode: options.training ?? "repair",
            onSnapshotIssue: (message) =>
              trainingSink.push(
                `workoutHistory[${index}].prescription_snapshot`,
                "unknown_schema_version",
                message,
              ),
          },
        ),
    ),
  ).slice(0, MAX_WORKOUT_HISTORY_ITEMS);
  const trainingResult = resolveTrainingIssues(templates, trainingSink);
  if (!trainingResult.ok) {
    throw new Error(formatTrainingIssues(trainingResult.issues));
  }
  if (trainingResult.issues.length > 0) {
    options.onTrainingIssues?.(trainingResult.issues);
  }

  return {
    templates,
    workoutHistory: normalizedWorkoutHistory,
    dietByDate: normalizeDietByDate(raw.dietByDate, runtime.createId),
    dietSettings: normalizedDietSettings,
    measurements: normalizedMeasurementsResult.value,
    threads: (raw.threads ?? []).map((thread, index) => ({
      ...thread,
      title: normalizeThreadTitle(thread.title, index),
    })),
    messagesByThread: normalizeMessagesByThread(raw.messagesByThread, runtime),
    keys,
    chatProvider,
    foodAIProvider,
  };
}
