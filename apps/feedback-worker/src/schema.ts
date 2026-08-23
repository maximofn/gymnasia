import {
  ALLOWED_REQUEST_KEYS,
  FEEDBACK_ISSUE_KINDS,
  FEEDBACK_SCHEMA_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
  REPORT_SUMMARY_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type FeedbackIssueKind,
  type FeedbackIssueRequest,
  type FeedbackRejectionReason,
} from "./contract";
import { normalizeBlock, normalizeLine, redactSecrets, truncate } from "./sanitize";

export type ValidationResult =
  | { ok: true; value: FeedbackIssueRequest }
  | { ok: false; reason: FeedbackRejectionReason };

/**
 * Valida y sanea el cuerpo de `POST /feedback/issues`.
 *
 * El esquema es **cerrado**: cualquier clave que no esté en
 * `ALLOWED_REQUEST_KEYS` se rechaza en vez de ignorarse. Ignorarla dejaría un
 * canal encubierto por el que enviar datos que el usuario no ha confirmado.
 *
 * Nunca lanza: cualquier entrada produce un resultado.
 */
export function validateFeedbackRequest(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "invalid_schema" };
  }

  const candidate = input as Record<string, unknown>;

  const allowed = new Set<string>(ALLOWED_REQUEST_KEYS);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return { ok: false, reason: "unknown_fields" };
  }

  if (candidate.schema_version !== FEEDBACK_SCHEMA_VERSION) {
    return { ok: false, reason: "invalid_schema" };
  }

  const kind = candidate.kind;
  if (typeof kind !== "string" || !isFeedbackIssueKind(kind)) {
    return { ok: false, reason: "invalid_schema" };
  }

  if (typeof candidate.title !== "string" || typeof candidate.summary !== "string") {
    return { ok: false, reason: "invalid_schema" };
  }

  const idempotencyKey = candidate.idempotency_key;
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return { ok: false, reason: "invalid_schema" };
  }
  // La clave se deriva del tipo en el cliente; si no coinciden, el payload es
  // incoherente y podría intentar colar una incidencia bajo otras etiquetas.
  if (!idempotencyKey.startsWith(`v1:${kind}:`)) {
    return { ok: false, reason: "invalid_schema" };
  }

  const summaryMaxLength = kind === "report" ? REPORT_SUMMARY_MAX_LENGTH : SUMMARY_MAX_LENGTH;

  // Se rechaza en vez de truncar lo que llega desmesurado: un cuerpo enorme es
  // una señal de abuso, no un usuario escribiendo de más.
  if (
    candidate.title.length > TITLE_MAX_LENGTH * 4
    || candidate.summary.length > summaryMaxLength * 4
  ) {
    return { ok: false, reason: "too_long" };
  }

  const title = truncate(redactSecrets(normalizeLine(candidate.title)), TITLE_MAX_LENGTH);
  const summary = truncate(
    redactSecrets(normalizeBlock(candidate.summary)),
    summaryMaxLength,
  );

  if (!title || !summary) return { ok: false, reason: "empty" };

  return {
    ok: true,
    value: {
      schema_version: FEEDBACK_SCHEMA_VERSION,
      kind,
      title,
      summary,
      idempotency_key: idempotencyKey,
    },
  };
}

function isFeedbackIssueKind(value: string): value is FeedbackIssueKind {
  return (FEEDBACK_ISSUE_KINDS as readonly string[]).includes(value);
}
