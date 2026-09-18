import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  USER_PREFERENCES_CHART_METRICS,
  USER_PREFERENCES_CHART_PERIODS,
  USER_PREFERENCES_NOTIFICATION_SOUNDS,
  createDefaultUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "./userPreferences";
import {
  USER_PREFERENCE_PRESENTED_KEYS,
  buildUserPreferencesPanelModel,
} from "./userPreferencesPresentation";

const userPreferencesArbitrary: fc.Arbitrary<UserPreferences> = fc.record({
  schemaVersion: fc.constant(createDefaultUserPreferences().schemaVersion),
  chartPeriod: fc.constantFrom(...USER_PREFERENCES_CHART_PERIODS),
  chartMetric: fc.constantFrom(...USER_PREFERENCES_CHART_METRICS),
  notifications: fc.record({
    enabled: fc.boolean(),
    sound: fc.boolean(),
    vibrate: fc.boolean(),
    soundKey: fc.constantFrom(...USER_PREFERENCES_NOTIFICATION_SOUNDS),
  }),
});

function expectHumanReadable(preferences: UserPreferences): void {
  const { rows, notes } = buildUserPreferencesPanelModel(preferences);
  const printed = [...rows.flatMap((row) => [row.label, row.value]), ...notes];
  for (const text of printed) {
    expect(text).not.toContain("[object");
    expect(text).not.toBe("");
    expect(text).not.toBe("undefined");
  }
  for (const row of rows) {
    // The internal key must never be what the user reads.
    expect(row.label).not.toBe(row.key);
    expect(row.value).not.toBe(row.key);
  }
}

describe("buildUserPreferencesPanelModel", () => {
  it("presents the default preferences with readable labels and values", () => {
    const model = buildUserPreferencesPanelModel(createDefaultUserPreferences());

    expect(model.rows).toEqual([
      { key: "chartPeriod", label: "Vista del gráfico", value: "3 meses" },
      { key: "chartMetric", label: "Métrica del gráfico", value: "Peso" },
    ]);
    expect(model.notes).toEqual(["Las notificaciones se configuran en la pestaña Notificaciones."]);
    expectHumanReadable(createDefaultUserPreferences());
  });

  it("never renders schemaVersion or notifications as rows", () => {
    const { rows } = buildUserPreferencesPanelModel(createDefaultUserPreferences());
    const keys = rows.map((row) => row.key);

    expect(keys).not.toContain("schemaVersion");
    expect(keys).not.toContain("notifications");
  });

  it("contract: every UserPreferences key has a presentation decision", () => {
    const modelKeys = Object.keys(createDefaultUserPreferences()).sort();
    const presentedKeys = [...USER_PREFERENCE_PRESENTED_KEYS].sort();

    expect(presentedKeys).toEqual(modelKeys);
  });

  it("regression: preferences as stored by 1.20.0 (no schemaVersion, no chartMetric) render without raw rows", () => {
    const stored = {
      chartPeriod: "3m",
      notifications: { enabled: true, sound: true, vibrate: true, soundKey: "rest_finished" },
    };
    const { preferences, repairs } = normalizeUserPreferences(stored);

    expect(repairs).toContain("legacy_unversioned");
    expect(repairs).toContain("chart_metric_defaulted");
    expectHumanReadable(preferences);
    expect(buildUserPreferencesPanelModel(preferences).rows.map((row) => row.value)).toEqual([
      "3 meses",
      "Peso",
    ]);
  });

  it("property: any valid preferences produce readable rows only", () => {
    fc.assert(
      fc.property(userPreferencesArbitrary, (preferences) => {
        expectHumanReadable(preferences);
        const { rows } = buildUserPreferencesPanelModel(preferences);
        expect(rows).toHaveLength(2);
      }),
      { numRuns: 200 },
    );
  });
});
