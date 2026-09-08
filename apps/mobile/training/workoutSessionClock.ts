export const WORKOUT_CLOCK_SCHEMA_VERSION = 1 as const;
export const MAX_RECOVERABLE_WORKOUT_GAP_MS = 12 * 60 * 60 * 1000;

export type WorkoutClockStatus = "running" | "paused";

export type WorkoutRestAlertIdentity = {
  rest_cycle_id: string;
  rest_alarm_revision: number;
};

export type WorkoutClockFields = {
  clock_schema_version: typeof WORKOUT_CLOCK_SCHEMA_VERSION;
  clock_last_tick_ms: number;
  rest_cycle_id: string | null;
  rest_alarm_revision: number;
  rest_due_at_ms: number | null;
  last_handled_rest_alert: WorkoutRestAlertIdentity | null;
};

export type WorkoutClockSession = WorkoutClockFields & {
  elapsed_seconds: number;
  is_resting: boolean;
  rest_seconds_left: number;
  rest_seconds_total: number;
  status: WorkoutClockStatus;
};

export type WorkoutRestAlert = WorkoutRestAlertIdentity & {
  expected_at_ms: number;
};

export type WorkoutClockReconciliation<T extends WorkoutClockSession> = {
  session: T;
  restAlert: WorkoutRestAlert | null;
  autoPaused: boolean;
  clockMovedBackward: boolean;
};

type NormalizeWorkoutClockInput = {
  now: number;
  isResting: boolean;
  restSecondsLeft: number;
  status: WorkoutClockStatus;
  hasPendingResolution: boolean;
  createRestCycleId: () => string;
};

function finiteTimestamp(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeAlertIdentity(value: unknown): WorkoutRestAlertIdentity | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorkoutRestAlertIdentity>;
  if (typeof candidate.rest_cycle_id !== "string" || !candidate.rest_cycle_id) return null;
  const revision = nonNegativeInteger(candidate.rest_alarm_revision);
  if (revision < 1) return null;
  return {
    rest_cycle_id: candidate.rest_cycle_id,
    rest_alarm_revision: revision,
  };
}

export function sameWorkoutRestAlert(
  left: WorkoutRestAlertIdentity | null | undefined,
  right: WorkoutRestAlertIdentity | null | undefined,
): boolean {
  return !!left
    && !!right
    && left.rest_cycle_id === right.rest_cycle_id
    && left.rest_alarm_revision === right.rest_alarm_revision;
}

export function normalizeWorkoutClockFields(
  rawValue: Partial<WorkoutClockFields>,
  input: NormalizeWorkoutClockInput,
): WorkoutClockFields {
  const isCurrentSchema = rawValue.clock_schema_version === WORKOUT_CLOCK_SCHEMA_VERSION;
  const isResting = input.isResting && input.restSecondsLeft > 0;
  const status = input.hasPendingResolution ? "paused" : input.status;
  const savedCycleId = typeof rawValue.rest_cycle_id === "string" && rawValue.rest_cycle_id
    ? rawValue.rest_cycle_id
    : null;
  const restCycleId = isResting ? savedCycleId ?? input.createRestCycleId() : savedCycleId;
  const savedRevision = nonNegativeInteger(rawValue.rest_alarm_revision);
  const restAlarmRevision = isResting ? Math.max(1, savedRevision) : savedRevision;
  const savedAnchor = finiteTimestamp(rawValue.clock_last_tick_ms);
  const savedDueAt = finiteTimestamp(rawValue.rest_due_at_ms);

  return {
    clock_schema_version: WORKOUT_CLOCK_SCHEMA_VERSION,
    // A legacy session starts measuring from migration time. Counting from
    // `started_at` would fabricate time that may have been spent paused.
    clock_last_tick_ms: isCurrentSchema && savedAnchor !== null ? savedAnchor : input.now,
    rest_cycle_id: restCycleId,
    rest_alarm_revision: restAlarmRevision,
    rest_due_at_ms: status === "running" && isResting
      ? isCurrentSchema && savedDueAt !== null
        ? savedDueAt
        : input.now + input.restSecondsLeft * 1000
      : null,
    last_handled_rest_alert: normalizeAlertIdentity(rawValue.last_handled_rest_alert),
  };
}

export function reconcileWorkoutSessionClock<T extends WorkoutClockSession>(
  session: T,
  now: number,
  maxRecoverableGapMs: number = MAX_RECOVERABLE_WORKOUT_GAP_MS,
): WorkoutClockReconciliation<T> {
  const safeNow = finiteTimestamp(now) ?? session.clock_last_tick_ms;
  const elapsedMs = safeNow - session.clock_last_tick_ms;

  if (session.status !== "running") {
    return {
      session: {
        ...session,
        clock_last_tick_ms: safeNow,
        rest_due_at_ms: null,
      },
      restAlert: null,
      autoPaused: false,
      clockMovedBackward: elapsedMs < 0,
    };
  }

  if (elapsedMs < 0) {
    return {
      session: {
        ...session,
        clock_last_tick_ms: safeNow,
        rest_due_at_ms: session.is_resting && session.rest_seconds_left > 0
          ? safeNow + session.rest_seconds_left * 1000
          : null,
      },
      restAlert: null,
      autoPaused: false,
      clockMovedBackward: true,
    };
  }

  if (elapsedMs > maxRecoverableGapMs) {
    return {
      session: {
        ...session,
        status: "paused",
        clock_last_tick_ms: safeNow,
        rest_due_at_ms: null,
        rest_alarm_revision: session.is_resting
          ? session.rest_alarm_revision + 1
          : session.rest_alarm_revision,
      },
      restAlert: null,
      autoPaused: true,
      clockMovedBackward: false,
    };
  }

  const elapsedWholeSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedWholeSeconds < 1) {
    return {
      session,
      restAlert: null,
      autoPaused: false,
      clockMovedBackward: false,
    };
  }

  const nextAnchor = session.clock_last_tick_ms + elapsedWholeSeconds * 1000;
  if (!session.is_resting || session.rest_seconds_left <= 0) {
    return {
      session: {
        ...session,
        elapsed_seconds: session.elapsed_seconds + elapsedWholeSeconds,
        clock_last_tick_ms: nextAnchor,
        rest_due_at_ms: null,
      },
      restAlert: null,
      autoPaused: false,
      clockMovedBackward: false,
    };
  }

  const nextRestSeconds = Math.max(0, session.rest_seconds_left - elapsedWholeSeconds);
  if (nextRestSeconds > 0) {
    return {
      session: {
        ...session,
        elapsed_seconds: session.elapsed_seconds + elapsedWholeSeconds,
        rest_seconds_left: nextRestSeconds,
        clock_last_tick_ms: nextAnchor,
        rest_due_at_ms: session.rest_due_at_ms
          ?? session.clock_last_tick_ms + session.rest_seconds_left * 1000,
      },
      restAlert: null,
      autoPaused: false,
      clockMovedBackward: false,
    };
  }

  const identity = session.rest_cycle_id && session.rest_alarm_revision > 0
    ? {
        rest_cycle_id: session.rest_cycle_id,
        rest_alarm_revision: session.rest_alarm_revision,
      }
    : null;
  const alreadyHandled = sameWorkoutRestAlert(identity, session.last_handled_rest_alert);
  const expectedAt = session.rest_due_at_ms
    ?? session.clock_last_tick_ms + session.rest_seconds_left * 1000;

  return {
    session: {
      ...session,
      elapsed_seconds: session.elapsed_seconds + elapsedWholeSeconds,
      is_resting: false,
      rest_seconds_left: 0,
      clock_last_tick_ms: nextAnchor,
      rest_due_at_ms: expectedAt,
      last_handled_rest_alert: identity ?? session.last_handled_rest_alert,
    },
    restAlert: identity && !alreadyHandled
      ? { ...identity, expected_at_ms: expectedAt }
      : null,
    autoPaused: false,
    clockMovedBackward: false,
  };
}

export function startWorkoutRest<T extends WorkoutClockSession>(
  session: T,
  seconds: number,
  now: number,
  createRestCycleId: () => string,
): T {
  const safeSeconds = nonNegativeInteger(seconds);
  if (safeSeconds < 1) return cancelWorkoutRest(session, now);
  return {
    ...session,
    clock_last_tick_ms: now,
    is_resting: true,
    rest_seconds_left: safeSeconds,
    rest_seconds_total: safeSeconds,
    rest_cycle_id: createRestCycleId(),
    rest_alarm_revision: 1,
    rest_due_at_ms: session.status === "running" ? now + safeSeconds * 1000 : null,
  };
}

export function cancelWorkoutRest<T extends WorkoutClockSession>(session: T, now: number): T {
  return {
    ...session,
    clock_last_tick_ms: now,
    is_resting: false,
    rest_seconds_left: 0,
    rest_seconds_total: 0,
    rest_due_at_ms: null,
    rest_alarm_revision: session.is_resting
      ? session.rest_alarm_revision + 1
      : session.rest_alarm_revision,
  };
}

export function pauseWorkoutClock<T extends WorkoutClockSession>(session: T, now: number): T {
  return {
    ...session,
    status: "paused",
    clock_last_tick_ms: now,
    rest_due_at_ms: null,
    rest_alarm_revision: session.is_resting
      ? session.rest_alarm_revision + 1
      : session.rest_alarm_revision,
  };
}

export function resumeWorkoutClock<T extends WorkoutClockSession>(session: T, now: number): T {
  const hasActiveRest = session.is_resting && session.rest_seconds_left > 0;
  return {
    ...session,
    status: "running",
    clock_last_tick_ms: now,
    rest_alarm_revision: hasActiveRest
      ? Math.max(1, session.rest_alarm_revision + 1)
      : session.rest_alarm_revision,
    rest_due_at_ms: hasActiveRest ? now + session.rest_seconds_left * 1000 : null,
  };
}
