/**
 * Dominio de las incidencias que la app propone al backend de recepción.
 *
 * Módulo puro: sin React, sin Expo, sin `fetch`. Todo lo que decide qué se
 * envía vive aquí para que Vitest pueda cubrirlo, porque `App.tsx` no es
 * testeable (ver GYM-202, ticket para estudiar cómo testear App.tsx).
 *
 * Los límites replican `apps/feedback-worker/src/contract.ts`;
 * `feedbackContract.contract.test.ts` falla si divergen.
 */

export const FEEDBACK_SCHEMA_VERSION = 1 as const;
export const FEEDBACK_ISSUE_PATH = "/feedback/issues" as const;

export const FEEDBACK_ISSUE_KINDS = ["feature", "food", "exercise"] as const;
export type FeedbackIssueKind = (typeof FEEDBACK_ISSUE_KINDS)[number];

export const TITLE_MAX_LENGTH = 120;
export const SUMMARY_MAX_LENGTH = 4000;

/** Lo único que el cliente decide. Ni repositorio, ni etiquetas, ni ruta. */
export type FeedbackIssueDraft = {
  kind: FeedbackIssueKind;
  title: string;
  summary: string;
};

export type FeedbackIssueOutcome =
  | { status: "created"; issueNumber: number; issueUrl: string; deduplicated: boolean }
  | { status: "canceled" }
  | { status: "unavailable"; reason: "not_configured" | "invalid_config" | "disabled" }
  | {
      status: "rejected";
      reason: "invalid_input" | "too_long" | "rate_limited" | "forbidden";
    }
  | { status: "error"; reason: "timeout" | "transport" | "server" | "malformed_response" };

const LINE_FEED = 0x0a;
const UNIT_SEPARATOR = 0x1f;
const DELETE_CHARACTER = 0x7f;

function isControlCharacter(codePoint: number, keepNewlines: boolean): boolean {
  if (keepNewlines && codePoint === LINE_FEED) return false;
  return codePoint <= UNIT_SEPARATOR || codePoint === DELETE_CHARACTER;
}

function stripControlCharacters(input: string, keepNewlines: boolean): string {
  let output = "";
  for (const character of input.normalize("NFC")) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && isControlCharacter(codePoint, keepNewlines)) continue;
    output += character;
  }
  return output;
}

function truncate(input: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (input.length <= maxLength) return input;
  let cut = maxLength - 1;
  const previous = input.charCodeAt(cut - 1);
  if (previous >= 0xd800 && previous <= 0xdbff) cut -= 1;
  return input.slice(0, cut) + "…";
}

/**
 * Normaliza y recorta un borrador. Devuelve `null` si queda inservible.
 *
 * Idempotente: `sanitize(sanitize(x))` da lo mismo que `sanitize(x)`. Esa
 * propiedad es la que garantiza que la clave calculada al proponer y la
 * calculada al enviar coincidan.
 */
export function sanitizeFeedbackDraft(
  input: Partial<FeedbackIssueDraft> & { kind: FeedbackIssueKind },
): FeedbackIssueDraft | null {
  if (!FEEDBACK_ISSUE_KINDS.includes(input.kind)) return null;

  const title = truncate(
    stripControlCharacters(String(input.title ?? ""), true).replace(/\s+/g, " ").trim(),
    TITLE_MAX_LENGTH,
  );
  const summary = truncate(
    stripControlCharacters(String(input.summary ?? ""), true)
      .split("\n")
      .map((line) => line.replace(/[^\S\n]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    SUMMARY_MAX_LENGTH,
  );

  if (!title || !summary) return null;
  return { kind: input.kind, title, summary };
}

/**
 * Clave de idempotencia derivada del contenido, no aleatoria.
 *
 * Mismo texto, misma clave. Eso hace que el bucle de tres reintentos que
 * envuelve la llamada al proveedor, un timeout seguido de reintento, o una
 * recarga en web, devuelvan la issue existente en vez de duplicarla.
 *
 * NO la cambies a un valor aleatorio: la idempotencia se rompería en silencio.
 */
export function buildIdempotencyKey(draft: FeedbackIssueDraft): string {
  const canonical = draft.kind + " " + draft.title + " " + draft.summary;
  return "v1:" + draft.kind + ":" + hash64Hex(canonical);
}

/** Dos pasadas FNV-1a de 32 bits. Sin BigInt ni WebCrypto: puro y síncrono. */
function hash64Hex(input: string): string {
  return fnv1a32(input, 0x811c9dc5) + fnv1a32(input, 0x01000193);
}

function fnv1a32(input: string, basis: number): string {
  let hash = basis >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Una referencia de issue solo vale si trae número entero positivo y una URL
 * de GitHub. Un 2xx sin esto NO es un éxito: es el fallo exacto que este
 * trabajo existe para eliminar.
 */
export function isVerifiedIssueReference(
  value: unknown,
): value is { number: number; url: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { number?: unknown; url?: unknown };
  return (
    typeof candidate.number === "number"
    && Number.isInteger(candidate.number)
    && candidate.number > 0
    && typeof candidate.url === "string"
    && candidate.url.startsWith("https://github.com/")
  );
}

function assertNever(value: never): never {
  throw new Error("Resultado de incidencia sin texto: " + JSON.stringify(value));
}

/**
 * Texto que se devuelve al modelo como resultado de la tool.
 *
 * El `switch` es exhaustivo y sin `default` alcanzable: añadir una variante al
 * union sin darle texto rompe `tsc --noEmit`. Ninguna rama distinta de
 * `created` puede afirmar que la incidencia existe.
 */
export function describeOutcomeForModel(outcome: FeedbackIssueOutcome): string {
  switch (outcome.status) {
    case "created":
      return (
        "Incidencia registrada con el número " + outcome.issueNumber + ". "
        + "Comunica al usuario ese número. No inventes ningún otro dato."
      );
    case "canceled":
      return "El usuario ha cancelado el envío. No se ha registrado nada. No insistas.";
    case "unavailable":
      return (
        "El canal de incidencias no está disponible en esta versión de la app. "
        + "NO afirmes que se ha registrado nada. Dile al usuario que ahora mismo no se puede enviar."
      );
    case "rejected":
      return (
        "El servidor ha rechazado el envío (" + outcome.reason + "). "
        + "NO afirmes que se ha registrado nada. Explica al usuario que no se ha podido enviar."
      );
    case "error":
      return (
        "Ha fallado el envío (" + outcome.reason + "). "
        + "NO afirmes que se ha registrado nada. Ofrece volver a intentarlo más tarde."
      );
    default:
      return assertNever(outcome);
  }
}

/** Texto que ve el usuario en la app. */
export function describeOutcomeForUser(outcome: FeedbackIssueOutcome): string {
  switch (outcome.status) {
    case "created":
      return outcome.deduplicated
        ? "Ya habíamos recibido esta propuesta (referencia " + outcome.issueNumber + ")."
        : "Propuesta enviada. Referencia " + outcome.issueNumber + ".";
    case "canceled":
      return "No se ha enviado nada.";
    case "unavailable":
      return "Ahora mismo no se pueden enviar propuestas. Inténtalo más adelante.";
    case "rejected":
      return outcome.reason === "rate_limited"
        ? "Has enviado varias propuestas seguidas. Espera un momento antes de volver a intentarlo."
        : "No se ha podido enviar la propuesta.";
    case "error":
      return "No se ha podido enviar la propuesta. Puedes volver a intentarlo.";
    default:
      return assertNever(outcome);
  }
}

/**
 * Resumen de un alimento, con SOLO los campos que el usuario acaba de ver en
 * el formulario. Nada de JSON interno ni de identificadores derivados.
 */
export function formatFoodSummary(food: {
  name: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}): string {
  return [
    "Alimento que no está en el catálogo de Gymnasia.",
    "",
    "- Nombre: " + food.name,
    "- Cantidad registrada: " + food.grams + " g",
    "- Calorías: " + food.calories_kcal + " kcal",
    "- Proteína: " + food.protein_g + " g",
    "- Carbohidratos: " + food.carbs_g + " g",
    "- Grasa: " + food.fat_g + " g",
  ].join("\n");
}

/** Resumen de un ejercicio, con los campos visibles en el formulario. */
export function formatExerciseSummary(exercise: {
  name: string;
  muscle_group?: string;
  equipment?: string;
}): string {
  return [
    "Ejercicio que no está en el catálogo de Gymnasia.",
    "",
    "- Nombre: " + exercise.name,
    "- Grupo muscular: " + (exercise.muscle_group || "Sin especificar"),
    "- Equipamiento: " + (exercise.equipment || "Sin especificar"),
  ].join("\n");
}
