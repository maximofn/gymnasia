export const USER_PREFERENCES_SCHEMA_VERSION = 1 as const;

export const USER_PREFERENCES_CHART_PERIODS = ["1m", "3m", "6m", "all"] as const;
export const USER_PREFERENCES_CHART_METRICS = [
  "weight",
  "bodyFat",
  "chest",
  "waist",
  "hips",
  "biceps",
  "neck",
  "quadriceps",
  "calf",
] as const;
export const USER_PREFERENCES_NOTIFICATION_SOUNDS = [
  "rest_finished",
  "beep",
  "bell",
  "ascending",
  "buzzer",
] as const;

export type MeasuresDashboardPeriodKey = typeof USER_PREFERENCES_CHART_PERIODS[number];
export type MeasuresChartMetricKey = typeof USER_PREFERENCES_CHART_METRICS[number];
export type NotificationSoundKey = typeof USER_PREFERENCES_NOTIFICATION_SOUNDS[number];

export type NotificationSettings = {
  enabled: boolean;
  sound: boolean;
  vibrate: boolean;
  soundKey: NotificationSoundKey;
};

export type UserPreferences = {
  schemaVersion: typeof USER_PREFERENCES_SCHEMA_VERSION;
  chartPeriod: MeasuresDashboardPeriodKey;
  chartMetric: MeasuresChartMetricKey;
  notifications: NotificationSettings;
};

export type UserPreferencesRepairCode =
  | "invalid_json"
  | "invalid_root"
  | "legacy_unversioned"
  | "unsupported_schema_version"
  | "chart_period_defaulted"
  | "chart_metric_defaulted"
  | "notifications_defaulted"
  | "notification_enabled_defaulted"
  | "notification_sound_defaulted"
  | "notification_vibrate_defaulted"
  | "notification_sound_key_defaulted";

export type UserPreferencesNormalization = {
  preferences: UserPreferences;
  repairs: UserPreferencesRepairCode[];
};

export function createDefaultUserPreferences(): UserPreferences {
  return {
    schemaVersion: USER_PREFERENCES_SCHEMA_VERSION,
    chartPeriod: "3m",
    chartMetric: "weight",
    notifications: {
      enabled: true,
      sound: true,
      vibrate: true,
      soundKey: "rest_finished",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function includesValue<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function normalizeUserPreferences(input: unknown): UserPreferencesNormalization {
  const defaults = createDefaultUserPreferences();
  if (!isRecord(input)) {
    return { preferences: defaults, repairs: ["invalid_root"] };
  }

  const repairs: UserPreferencesRepairCode[] = [];
  if (!("schemaVersion" in input)) {
    repairs.push("legacy_unversioned");
  } else if (input.schemaVersion !== USER_PREFERENCES_SCHEMA_VERSION) {
    repairs.push("unsupported_schema_version");
  }

  const chartPeriod = includesValue(USER_PREFERENCES_CHART_PERIODS, input.chartPeriod)
    ? input.chartPeriod
    : defaults.chartPeriod;
  if (chartPeriod !== input.chartPeriod) repairs.push("chart_period_defaulted");

  const chartMetric = includesValue(USER_PREFERENCES_CHART_METRICS, input.chartMetric)
    ? input.chartMetric
    : defaults.chartMetric;
  if (chartMetric !== input.chartMetric) repairs.push("chart_metric_defaulted");

  let notifications = defaults.notifications;
  if (!isRecord(input.notifications)) {
    repairs.push("notifications_defaulted");
  } else {
    const enabled = typeof input.notifications.enabled === "boolean"
      ? input.notifications.enabled
      : defaults.notifications.enabled;
    if (enabled !== input.notifications.enabled) repairs.push("notification_enabled_defaulted");

    const sound = typeof input.notifications.sound === "boolean"
      ? input.notifications.sound
      : defaults.notifications.sound;
    if (sound !== input.notifications.sound) repairs.push("notification_sound_defaulted");

    const vibrate = typeof input.notifications.vibrate === "boolean"
      ? input.notifications.vibrate
      : defaults.notifications.vibrate;
    if (vibrate !== input.notifications.vibrate) repairs.push("notification_vibrate_defaulted");

    const soundKey = includesValue(USER_PREFERENCES_NOTIFICATION_SOUNDS, input.notifications.soundKey)
      ? input.notifications.soundKey
      : defaults.notifications.soundKey;
    if (soundKey !== input.notifications.soundKey) repairs.push("notification_sound_key_defaulted");

    notifications = { enabled, sound, vibrate, soundKey };
  }

  return {
    preferences: {
      schemaVersion: USER_PREFERENCES_SCHEMA_VERSION,
      chartPeriod,
      chartMetric,
      notifications,
    },
    repairs,
  };
}

export function normalizeStoredUserPreferences(raw: string | null): UserPreferencesNormalization {
  if (raw === null) return { preferences: createDefaultUserPreferences(), repairs: [] };
  try {
    return normalizeUserPreferences(JSON.parse(raw) as unknown);
  } catch {
    return { preferences: createDefaultUserPreferences(), repairs: ["invalid_json"] };
  }
}
