import {
  sameWorkoutRestAlert,
  type WorkoutRestAlertIdentity,
} from "./workoutSessionClock";

export const REST_NOTIFICATION_KIND = "rest_end" as const;

export type RestNotificationPayload = WorkoutRestAlertIdentity & {
  kind: typeof REST_NOTIFICATION_KIND;
  session_id: string;
  expected_at_ms: number;
};

export type SchedulableRestSession = {
  id: string;
  status: "running" | "paused";
  is_resting: boolean;
  rest_seconds_left: number;
  rest_cycle_id: string | null;
  rest_alarm_revision: number;
  rest_due_at_ms: number | null;
};

export function isRestNotificationData(value: unknown): boolean {
  return !!value
    && typeof value === "object"
    && (value as { kind?: unknown }).kind === REST_NOTIFICATION_KIND;
}

export function restNotificationIdentifiers(
  entries: Array<{ identifier: string; data: unknown }>,
): string[] {
  return entries
    .filter((entry) => isRestNotificationData(entry.data))
    .map((entry) => entry.identifier);
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseRestNotificationPayload(value: unknown): RestNotificationPayload | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<RestNotificationPayload>;
  const revision = positiveInteger(candidate.rest_alarm_revision);
  const expectedAt = Number(candidate.expected_at_ms);
  if (
    candidate.kind !== REST_NOTIFICATION_KIND
    || typeof candidate.session_id !== "string"
    || !candidate.session_id
    || typeof candidate.rest_cycle_id !== "string"
    || !candidate.rest_cycle_id
    || revision === null
    || !Number.isFinite(expectedAt)
    || expectedAt <= 0
  ) {
    return null;
  }
  return {
    kind: REST_NOTIFICATION_KIND,
    session_id: candidate.session_id,
    rest_cycle_id: candidate.rest_cycle_id,
    rest_alarm_revision: revision,
    expected_at_ms: expectedAt,
  };
}

export function activeRestNotificationPayload(
  session: SchedulableRestSession | null,
  now: number,
): RestNotificationPayload | null {
  if (
    !session
    || session.status !== "running"
    || !session.is_resting
    || session.rest_seconds_left < 1
    || !session.rest_cycle_id
    || session.rest_alarm_revision < 1
    || session.rest_due_at_ms === null
    || session.rest_due_at_ms <= now
  ) {
    return null;
  }
  return restNotificationPayloadForSession(session);
}

export function restNotificationPayloadForSession(
  session: SchedulableRestSession | null,
): RestNotificationPayload | null {
  if (
    !session
    || !session.is_resting
    || session.rest_seconds_left < 1
    || !session.rest_cycle_id
    || session.rest_alarm_revision < 1
    || session.rest_due_at_ms === null
  ) {
    return null;
  }
  return {
    kind: REST_NOTIFICATION_KIND,
    session_id: session.id,
    rest_cycle_id: session.rest_cycle_id,
    rest_alarm_revision: session.rest_alarm_revision,
    expected_at_ms: session.rest_due_at_ms,
  };
}

export function sameRestNotification(
  left: RestNotificationPayload | null | undefined,
  right: RestNotificationPayload | null | undefined,
): boolean {
  return !!left
    && !!right
    && left.session_id === right.session_id
    && sameWorkoutRestAlert(left, right);
}

export function shouldPlayRecoveredRestAlert(
  expectedAt: number,
  now: number,
  wasDelivered: boolean,
  fallbackWindowMs: number,
): boolean {
  if (wasDelivered) return false;
  const overdueMs = now - expectedAt;
  return overdueMs >= 0 && overdueMs <= fallbackWindowMs;
}
