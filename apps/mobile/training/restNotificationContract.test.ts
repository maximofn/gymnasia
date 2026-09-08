import { describe, expect, it } from "vitest";

import {
  activeRestNotificationPayload,
  parseRestNotificationPayload,
  restNotificationIdentifiers,
  sameRestNotification,
  shouldPlayRecoveredRestAlert,
} from "./restNotificationContract";

const NOW = 2_000_000_000_000;

describe("restNotificationContract", () => {
  const active = {
    id: "session-1",
    status: "running" as const,
    is_resting: true,
    rest_seconds_left: 30,
    rest_cycle_id: "rest-1",
    rest_alarm_revision: 2,
    rest_due_at_ms: NOW + 30_000,
  };

  it("solo crea payload para un descanso vigente y en ejecución", () => {
    expect(activeRestNotificationPayload(active, NOW)).toEqual({
      kind: "rest_end",
      session_id: "session-1",
      rest_cycle_id: "rest-1",
      rest_alarm_revision: 2,
      expected_at_ms: NOW + 30_000,
    });
    expect(activeRestNotificationPayload({ ...active, status: "paused" }, NOW)).toBeNull();
    expect(activeRestNotificationPayload({ ...active, rest_due_at_ms: NOW }, NOW)).toBeNull();
  });

  it("valida toda la identidad e ignora revisiones obsoletas", () => {
    const payload = activeRestNotificationPayload(active, NOW);
    expect(parseRestNotificationPayload(payload)).toEqual(payload);
    expect(parseRestNotificationPayload({ kind: "rest_end" })).toBeNull();
    expect(sameRestNotification(payload, payload)).toBe(true);
    expect(sameRestNotification(payload, payload && {
      ...payload,
      rest_alarm_revision: payload.rest_alarm_revision + 1,
    })).toBe(false);
  });

  it("selecciona solo avisos de descanso y conserva notificaciones ajenas", () => {
    expect(restNotificationIdentifiers([
      { identifier: "rest-current", data: { kind: "rest_end" } },
      { identifier: "other", data: { kind: "meal_reminder" } },
      { identifier: "empty", data: null },
    ])).toEqual(["rest-current"]);
  });

  it("solo recupera una alerta reciente que el sistema no entregó", () => {
    expect(shouldPlayRecoveredRestAlert(NOW - 60_000, NOW, false, 120_000)).toBe(true);
    expect(shouldPlayRecoveredRestAlert(NOW - 121_000, NOW, false, 120_000)).toBe(false);
    expect(shouldPlayRecoveredRestAlert(NOW - 60_000, NOW, true, 120_000)).toBe(false);
    expect(shouldPlayRecoveredRestAlert(NOW + 1_000, NOW, false, 120_000)).toBe(false);
  });
});
