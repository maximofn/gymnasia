/**
 * Contrato del endpoint de incidencias.
 *
 * Este fichero es la fuente de verdad de los límites y del esquema cerrado.
 * `apps/mobile/agent/feedbackIssues.ts` replica estos valores y
 * `apps/mobile/agent/feedbackContract.contract.test.ts` falla si divergen.
 */

export const FEEDBACK_SCHEMA_VERSION = 1 as const;
export const FEEDBACK_ISSUE_PATH = "/feedback/issues" as const;

export const FEEDBACK_ISSUE_KINDS = ["feature", "food", "exercise"] as const;
export type FeedbackIssueKind = (typeof FEEDBACK_ISSUE_KINDS)[number];

export const TITLE_MAX_LENGTH = 120;
export const SUMMARY_MAX_LENGTH = 4000;
export const IDEMPOTENCY_KEY_PATTERN = /^v1:(feature|food|exercise):[0-9a-f]{16}$/;

/** Las cinco únicas claves que el cliente puede enviar. Cualquier otra se rechaza. */
export const ALLOWED_REQUEST_KEYS = [
  "schema_version",
  "kind",
  "title",
  "summary",
  "idempotency_key",
] as const;

export type FeedbackIssueRequest = {
  schema_version: typeof FEEDBACK_SCHEMA_VERSION;
  kind: FeedbackIssueKind;
  title: string;
  summary: string;
  idempotency_key: string;
};

export type FeedbackRejectionReason =
  | "invalid_schema"
  | "unknown_fields"
  | "too_long"
  | "empty"
  | "rate_limited";

export type FeedbackIssueResponse =
  | { status: "created"; number: number; url: string; deduplicated: boolean }
  | { status: "rejected"; reason: FeedbackRejectionReason; retry_after_seconds?: number }
  | { status: "unavailable" }
  | { status: "error"; reason: "upstream_failed" | "internal" };

/**
 * Traducción tipo -> prefijo de título y etiquetas. Vive SOLO en el servidor:
 * el cliente no puede elegir etiquetas ni repositorio (GYM-54).
 */
export const ISSUE_PRESENTATION: Record<
  FeedbackIssueKind,
  { titlePrefix: string; labels: string[] }
> = {
  feature: { titlePrefix: "[FEATURE]", labels: ["enhancement"] },
  food: { titlePrefix: "[Nuevo alimento]", labels: ["alimento"] },
  exercise: { titlePrefix: "[Nuevo ejercicio]", labels: ["ejercicio"] },
};
