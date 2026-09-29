import type {
  MeasuresChartMetricKey,
  MeasuresDashboardPeriodKey,
  UserPreferences,
} from "./userPreferences";

export const CHART_PERIOD_LABELS: Readonly<Record<MeasuresDashboardPeriodKey, string>> = {
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  all: "Todo",
};

export const CHART_METRIC_LABELS: Readonly<Record<MeasuresChartMetricKey, string>> = {
  weight: "Peso",
  bodyFat: "% Grasa",
  chest: "Pecho",
  waist: "Cintura",
  hips: "Cadera",
  biceps: "Brazo",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  calf: "Gemelo",
};

export type UserPreferenceRow = {
  key: keyof UserPreferences;
  label: string;
  value: string;
};

export type UserPreferencesPanelModel = {
  rows: UserPreferenceRow[];
  notes: string[];
};

type UserPreferencePresenter =
  | { kind: "row"; label: string; format: (preferences: Readonly<UserPreferences>) => string }
  // Internal data the user never needs to see.
  | { kind: "hidden" }
  // Preferences edited somewhere else in Settings: shown as a hint, never as a row.
  | { kind: "elsewhere"; note: string };

// Exhaustive by construction: adding a key to UserPreferences without deciding
// how it is presented fails `tsc` here instead of leaking a raw key on screen.
const USER_PREFERENCE_PRESENTERS: Readonly<Record<keyof UserPreferences, UserPreferencePresenter>> = {
  schemaVersion: { kind: "hidden" },
  chartPeriod: {
    kind: "row",
    label: "Vista del gráfico",
    format: (preferences) => CHART_PERIOD_LABELS[preferences.chartPeriod],
  },
  chartMetric: {
    kind: "row",
    label: "Métrica del gráfico",
    format: (preferences) => CHART_METRIC_LABELS[preferences.chartMetric],
  },
  notifications: {
    kind: "elsewhere",
    note: "Las notificaciones se configuran en la pestaña Notificaciones.",
  },
};

export const USER_PREFERENCE_PRESENTED_KEYS = Object.freeze(
  Object.keys(USER_PREFERENCE_PRESENTERS),
) as readonly (keyof UserPreferences)[];

export function buildUserPreferencesPanelModel(
  preferences: Readonly<UserPreferences>,
): UserPreferencesPanelModel {
  const rows: UserPreferenceRow[] = [];
  const notes: string[] = [];
  for (const key of USER_PREFERENCE_PRESENTED_KEYS) {
    const presenter = USER_PREFERENCE_PRESENTERS[key];
    if (presenter.kind === "row") {
      rows.push({ key, label: presenter.label, value: presenter.format(preferences) });
    } else if (presenter.kind === "elsewhere") {
      notes.push(presenter.note);
    }
  }
  return { rows, notes };
}
