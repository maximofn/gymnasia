import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_RECOVERABLE_WORKOUT_GAP_MS,
  WORKOUT_CLOCK_SCHEMA_VERSION,
  cancelWorkoutRest,
  normalizeWorkoutClockFields,
  pauseWorkoutClock,
  reconcileWorkoutSessionClock,
  resumeWorkoutClock,
  startWorkoutRest,
  type WorkoutClockSession,
} from "./workoutSessionClock";

const NOW = 2_000_000_000_000;

function session(overrides: Partial<WorkoutClockSession> = {}): WorkoutClockSession {
  return {
    clock_schema_version: WORKOUT_CLOCK_SCHEMA_VERSION,
    clock_last_tick_ms: NOW,
    elapsed_seconds: 30,
    is_resting: false,
    rest_seconds_left: 0,
    rest_seconds_total: 0,
    rest_cycle_id: null,
    rest_alarm_revision: 0,
    rest_due_at_ms: null,
    last_handled_rest_alert: null,
    status: "running",
    ...overrides,
  };
}

describe("workoutSessionClock", () => {
  it("migra una sesión heredada sin inventar tiempo transcurrido", () => {
    const fields = normalizeWorkoutClockFields({}, {
      now: NOW,
      isResting: true,
      restSecondsLeft: 45,
      status: "running",
      hasPendingResolution: false,
      createRestCycleId: () => "rest-legacy",
    });

    expect(fields).toMatchObject({
      clock_last_tick_ms: NOW,
      rest_cycle_id: "rest-legacy",
      rest_alarm_revision: 1,
      rest_due_at_ms: NOW + 45_000,
    });
  });

  it("trata una resolución pendiente como pausa aunque el dato heredado diga running", () => {
    const fields = normalizeWorkoutClockFields({}, {
      now: NOW,
      isResting: true,
      restSecondsLeft: 45,
      status: "running",
      hasPendingResolution: true,
      createRestCycleId: () => "rest-pending",
    });

    expect(fields.rest_due_at_ms).toBeNull();
    const reconciled = reconcileWorkoutSessionClock(session({
      ...fields,
      status: "paused",
      is_resting: true,
      rest_seconds_left: 45,
      rest_seconds_total: 45,
    }), NOW + 60_000);
    expect(reconciled.session.elapsed_seconds).toBe(30);
    expect(reconciled.session.rest_seconds_left).toBe(45);
  });

  it("cuenta una diferencia de exactamente doce horas y pausa si la supera", () => {
    const exact = reconcileWorkoutSessionClock(
      session(),
      NOW + MAX_RECOVERABLE_WORKOUT_GAP_MS,
    );
    const exceeded = reconcileWorkoutSessionClock(
      session({
        is_resting: true,
        rest_seconds_left: 20,
        rest_seconds_total: 20,
        rest_cycle_id: "rest-old",
        rest_alarm_revision: 2,
        rest_due_at_ms: NOW + 20_000,
      }),
      NOW + MAX_RECOVERABLE_WORKOUT_GAP_MS + 1,
    );

    expect(exact.session.elapsed_seconds).toBe(30 + 12 * 60 * 60);
    expect(exact.session.status).toBe("running");
    expect(exceeded.session.elapsed_seconds).toBe(30);
    expect(exceeded.session.status).toBe("paused");
    expect(exceeded.session.rest_seconds_left).toBe(20);
    expect(exceeded.session.rest_alarm_revision).toBe(3);
    expect(exceeded.session.rest_due_at_ms).toBeNull();
    expect(exceeded.autoPaused).toBe(true);
  });

  it("congela la pausa y rebasa un reloj que retrocede", () => {
    const paused = reconcileWorkoutSessionClock(
      session({ status: "paused", is_resting: true, rest_seconds_left: 20 }),
      NOW + 60_000,
    );
    const backwards = reconcileWorkoutSessionClock(session({
      is_resting: true,
      rest_seconds_left: 20,
      rest_due_at_ms: NOW + 20_000,
      rest_cycle_id: "rest",
      rest_alarm_revision: 1,
    }), NOW - 1_000);

    expect(paused.session.elapsed_seconds).toBe(30);
    expect(paused.session.rest_seconds_left).toBe(20);
    expect(paused.session.rest_due_at_ms).toBeNull();
    expect(backwards.clockMovedBackward).toBe(true);
    expect(backwards.session.elapsed_seconds).toBe(30);
    expect(backwards.session.rest_due_at_ms).toBe(NOW + 19_000);
  });

  it("conserva el resto subsegundo para no acumular deriva", () => {
    const first = reconcileWorkoutSessionClock(session(), NOW + 1_500).session;
    const second = reconcileWorkoutSessionClock(first, NOW + 2_100).session;

    expect(first.clock_last_tick_ms).toBe(NOW + 1_000);
    expect(second.elapsed_seconds).toBe(32);
    expect(second.clock_last_tick_ms).toBe(NOW + 2_000);
  });

  it("termina un descanso y emite una sola identidad persistible", () => {
    const resting = session({
      is_resting: true,
      rest_seconds_left: 5,
      rest_seconds_total: 5,
      rest_cycle_id: "rest-1",
      rest_alarm_revision: 2,
      rest_due_at_ms: NOW + 5_000,
    });
    const ended = reconcileWorkoutSessionClock(resting, NOW + 5_000);
    const repeated = reconcileWorkoutSessionClock(ended.session, NOW + 6_000);

    expect(ended.session.is_resting).toBe(false);
    expect(ended.restAlert).toEqual({
      rest_cycle_id: "rest-1",
      rest_alarm_revision: 2,
      expected_at_ms: NOW + 5_000,
    });
    expect(ended.session.last_handled_rest_alert).toEqual({
      rest_cycle_id: "rest-1",
      rest_alarm_revision: 2,
    });
    expect(repeated.restAlert).toBeNull();
  });

  it("invalida la alarma al pausar, crea otra al reanudar y cancela el descanso", () => {
    const resting = startWorkoutRest(session(), 30, NOW, () => "rest-1");
    const paused = pauseWorkoutClock(resting, NOW + 5_000);
    const resumed = resumeWorkoutClock(paused, NOW + 20_000);
    const cancelled = cancelWorkoutRest(resumed, NOW + 21_000);

    expect(resting.rest_alarm_revision).toBe(1);
    expect(paused.rest_alarm_revision).toBe(2);
    expect(paused.rest_due_at_ms).toBeNull();
    expect(resumed.rest_alarm_revision).toBe(3);
    expect(resumed.rest_due_at_ms).toBe(NOW + 50_000);
    expect(cancelled.is_resting).toBe(false);
    expect(cancelled.rest_alarm_revision).toBe(4);
  });

  it("mantiene tiempo y descanso dentro de sus invariantes para secuencias arbitrarias", () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: -5_000, max: 60_000 }), { minLength: 1, maxLength: 100 }),
      (deltas) => {
        let current = startWorkoutRest(session(), 120, NOW, () => "rest-property");
        let now = NOW;
        let previousElapsed = current.elapsed_seconds;
        for (const delta of deltas) {
          now += delta;
          const result = reconcileWorkoutSessionClock(current, now);
          current = result.session;
          expect(current.elapsed_seconds).toBeGreaterThanOrEqual(previousElapsed);
          expect(current.rest_seconds_left).toBeGreaterThanOrEqual(0);
          previousElapsed = current.elapsed_seconds;
        }
      },
    ));
  });
});
