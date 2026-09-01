import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  USER_PREFERENCES_CHART_METRICS,
  USER_PREFERENCES_CHART_PERIODS,
  USER_PREFERENCES_NOTIFICATION_SOUNDS,
  createDefaultUserPreferences,
  normalizeStoredUserPreferences,
  normalizeUserPreferences,
} from "./userPreferences";

describe("normalizeStoredUserPreferences", () => {
  it("uses the canonical defaults for a fresh install without reporting a repair", () => {
    expect(normalizeStoredUserPreferences(null)).toEqual({
      preferences: createDefaultUserPreferences(),
      repairs: [],
    });
  });

  it("repairs malformed JSON without retaining any source value", () => {
    expect(normalizeStoredUserPreferences('{"secret":"do-not-log"')).toEqual({
      preferences: createDefaultUserPreferences(),
      repairs: ["invalid_json"],
    });
  });
});

describe("normalizeUserPreferences", () => {
  it("preserves a fully valid current document", () => {
    const input = {
      schemaVersion: 1,
      chartPeriod: "6m",
      chartMetric: "waist",
      notifications: {
        enabled: false,
        sound: false,
        vibrate: false,
        soundKey: "bell",
      },
    };

    expect(normalizeUserPreferences(input)).toEqual({ preferences: input, repairs: [] });
  });

  it("migrates an unversioned partial document field by field", () => {
    expect(normalizeUserPreferences({
      chartPeriod: "1m",
      notifications: { enabled: false, soundKey: "beep" },
    })).toEqual({
      preferences: {
        schemaVersion: 1,
        chartPeriod: "1m",
        chartMetric: "weight",
        notifications: {
          enabled: false,
          sound: true,
          vibrate: true,
          soundKey: "beep",
        },
      },
      repairs: [
        "legacy_unversioned",
        "chart_metric_defaulted",
        "notification_sound_defaulted",
        "notification_vibrate_defaulted",
      ],
    });
  });

  it("preserves known valid fields from a future schema and drops unknown fields", () => {
    expect(normalizeUserPreferences({
      schemaVersion: 99,
      chartPeriod: "all",
      chartMetric: "calf",
      unknownRoot: "private",
      notifications: {
        enabled: true,
        sound: false,
        vibrate: true,
        soundKey: "ascending",
        unknownNested: "private",
      },
    })).toEqual({
      preferences: {
        schemaVersion: 1,
        chartPeriod: "all",
        chartMetric: "calf",
        notifications: {
          enabled: true,
          sound: false,
          vibrate: true,
          soundKey: "ascending",
        },
      },
      repairs: ["unsupported_schema_version"],
    });
  });

  it("defaults every invalid field independently without coercing values", () => {
    expect(normalizeUserPreferences({
      schemaVersion: "1",
      chartPeriod: 3,
      chartMetric: "unknown",
      notifications: {
        enabled: 1,
        sound: "false",
        vibrate: null,
        soundKey: "custom.wav",
      },
    })).toEqual({
      preferences: createDefaultUserPreferences(),
      repairs: [
        "unsupported_schema_version",
        "chart_period_defaulted",
        "chart_metric_defaulted",
        "notification_enabled_defaulted",
        "notification_sound_defaulted",
        "notification_vibrate_defaulted",
        "notification_sound_key_defaulted",
      ],
    });
  });

  it("uses one repair code when the notification object is invalid", () => {
    expect(normalizeUserPreferences({
      schemaVersion: 1,
      chartPeriod: "3m",
      chartMetric: "weight",
      notifications: [],
    })).toEqual({
      preferences: createDefaultUserPreferences(),
      repairs: ["notifications_defaulted"],
    });
  });

  it.each([undefined, null, true, 1, "prefs", []])("rejects a non-object root: %j", (input) => {
    expect(normalizeUserPreferences(input)).toEqual({
      preferences: createDefaultUserPreferences(),
      repairs: ["invalid_root"],
    });
  });

  it("is idempotent after the first normalization", () => {
    const first = normalizeUserPreferences({
      chartPeriod: "6m",
      chartMetric: false,
      notifications: { enabled: false, sound: true, vibrate: "yes", soundKey: "buzzer" },
    });

    expect(normalizeUserPreferences(first.preferences)).toEqual({
      preferences: first.preferences,
      repairs: [],
    });
  });

  it("always returns a canonical, idempotent document for arbitrary JSON", () => {
    fc.assert(fc.property(fc.jsonValue(), (input) => {
      const first = normalizeUserPreferences(input);
      const second = normalizeUserPreferences(first.preferences);

      expect(second).toEqual({ preferences: first.preferences, repairs: [] });
      expect(Object.keys(first.preferences).sort()).toEqual([
        "chartMetric",
        "chartPeriod",
        "notifications",
        "schemaVersion",
      ]);
      expect(Object.keys(first.preferences.notifications).sort()).toEqual([
        "enabled",
        "sound",
        "soundKey",
        "vibrate",
      ]);
      expect(USER_PREFERENCES_CHART_PERIODS).toContain(first.preferences.chartPeriod);
      expect(USER_PREFERENCES_CHART_METRICS).toContain(first.preferences.chartMetric);
      expect(USER_PREFERENCES_NOTIFICATION_SOUNDS).toContain(first.preferences.notifications.soundKey);
      expect(typeof first.preferences.notifications.enabled).toBe("boolean");
      expect(typeof first.preferences.notifications.sound).toBe("boolean");
      expect(typeof first.preferences.notifications.vibrate).toBe("boolean");
      expect(first.repairs.every((code) => /^[a-z_]+$/.test(code))).toBe(true);
    }), { numRuns: 500 });
  });
});
