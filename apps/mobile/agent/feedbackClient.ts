import {
  FEEDBACK_ISSUE_PATH,
  FEEDBACK_ISSUE_STATUS_PATH,
  FEEDBACK_SCHEMA_VERSION,
  buildIdempotencyKey,
  buildOperationIdempotencyKey,
  isVerifiedIssueReference,
  type FeedbackIssueDraft,
  type FeedbackIssueOutcome,
  type FeedbackIssueKind,
  type FeedbackOperationStatusOutcome,
} from "./feedbackIssues";

export type FeedbackClientConfig = {
  /** Ya validada por `resolveFeedbackEndpoint`. Sin barra final. */
  baseUrl: string;
  /** Inyectable para los tests. */
  fetchImpl?: typeof fetch;
  /** Secreto compartido del build, si lo hay. Ofuscación, no seguridad. */
  appSecret?: string;
  timeoutMs?: number;
};

export type FeedbackIssueClient = {
  submitIssue: (
    draft: FeedbackIssueDraft,
    operationId?: string,
  ) => Promise<FeedbackIssueOutcome>;
  getOperationStatus: (
    kind: FeedbackIssueKind,
    operationId: string,
  ) => Promise<FeedbackOperationStatusOutcome>;
};

/**
 * 15 s, no los 120 s del streaming de proveedores: aquí no hay stream y el
 * usuario está esperando delante de la pantalla.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export function createFeedbackIssueClient(
  config: FeedbackClientConfig,
): FeedbackIssueClient {
  const requestHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (config.appSecret) headers["x-gymnasia-app"] = config.appSecret;
    return headers;
  };

  const getOperationStatus = async (
    kind: FeedbackIssueKind,
    operationId: string,
  ): Promise<FeedbackOperationStatusOutcome> => {
    const fetchImpl = config.fetchImpl ?? fetch;
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = setTimeout(
      () => controller?.abort(),
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const key = buildOperationIdempotencyKey(kind, operationId);
      const response = await fetchImpl(
        `${config.baseUrl}${FEEDBACK_ISSUE_STATUS_PATH}?idempotency_key=${encodeURIComponent(key)}`,
        {
          method: "GET",
          headers: requestHeaders(),
          signal: controller?.signal,
        },
      );
      const rawBody = await response.text().catch(() => "");
      return mapFeedbackStatusResponse(response.status, rawBody);
    } catch {
      return { status: "indeterminate" };
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    getOperationStatus,
    async submitIssue(
      draft: FeedbackIssueDraft,
      operationId?: string,
    ): Promise<FeedbackIssueOutcome> {
      const fetchImpl = config.fetchImpl ?? fetch;
      // La guarda de `typeof` existe porque React Native antiguo no siempre
      // trae AbortController. Mismo patrón que el streaming de proveedores.
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = setTimeout(
        () => controller?.abort(),
        config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      try {
        const response = await fetchImpl(config.baseUrl + FEEDBACK_ISSUE_PATH, {
          method: "POST",
          headers: requestHeaders(),
          // Estas cinco claves y ninguna más. Cualquier campo extra sería un
          // canal por el que sale información que el usuario no ha confirmado.
          body: JSON.stringify({
            schema_version: FEEDBACK_SCHEMA_VERSION,
            kind: draft.kind,
            title: draft.title,
            summary: draft.summary,
            idempotency_key: operationId
              ? buildOperationIdempotencyKey(draft.kind, operationId)
              : buildIdempotencyKey(draft),
          }),
          signal: controller?.signal,
        });

        const rawBody = await response.text().catch(() => "");
        const outcome = mapFeedbackResponse(response.status, rawBody);
        if (
          operationId
          && (
            outcome.status === "error"
            || (outcome.status === "rejected" && outcome.reason === "rate_limited")
          )
        ) {
          const status = await getOperationStatus(draft.kind, operationId);
          if (status.status === "created") {
            return {
              status: "created",
              issueNumber: status.issueNumber,
              issueUrl: status.issueUrl,
              deduplicated: true,
            };
          }
          if (status.status === "pending") {
            return { status: "error", reason: "operation_pending" };
          }
        }
        return outcome;
      } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        const failure: FeedbackIssueOutcome = name === "AbortError"
          ? { status: "error", reason: "timeout" }
          : { status: "error", reason: "transport" };
        if (operationId) {
          const status = await getOperationStatus(draft.kind, operationId);
          if (status.status === "created") {
            return {
              status: "created",
              issueNumber: status.issueNumber,
              issueUrl: status.issueUrl,
              deduplicated: true,
            };
          }
          if (status.status === "pending") {
            return { status: "error", reason: "operation_pending" };
          }
        }
        return failure;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function mapFeedbackStatusResponse(
  status: number,
  rawBody: string,
): FeedbackOperationStatusOutcome {
  const body = parseJsonSafely(rawBody);
  if (status === 404 && (body as { status?: unknown } | null)?.status === "absent") {
    return { status: "absent" };
  }
  if (status === 202 && (body as { status?: unknown } | null)?.status === "pending") {
    return { status: "pending" };
  }
  if (
    status >= 200
    && status < 300
    && (body as { status?: unknown } | null)?.status === "created"
    && isVerifiedIssueReference(body)
  ) {
    return {
      status: "created",
      issueNumber: body.number,
      issueUrl: body.url,
    };
  }
  return { status: "indeterminate" };
}

/**
 * Traduce la respuesta HTTP a un resultado discriminado.
 *
 * Exportada aparte para poder fuzzearla sin red. Invariante que sostiene todo
 * el ticket: **nunca devuelve `created` salvo que el status sea 2xx y el
 * cuerpo traiga una referencia verificable**.
 */
export function mapFeedbackResponse(
  status: number,
  rawBody: string,
): FeedbackIssueOutcome {
  const body = parseJsonSafely(rawBody);

  if (status >= 200 && status < 300) {
    const reference = body as { number?: unknown; url?: unknown } | null;
    if (!isVerifiedIssueReference(reference)) {
      return { status: "error", reason: "malformed_response" };
    }
    const deduplicated =
      typeof body === "object"
      && body !== null
      && (body as { deduplicated?: unknown }).deduplicated === true;
    return {
      status: "created",
      issueNumber: reference.number,
      issueUrl: reference.url,
      deduplicated,
    };
  }

  if (status === 503) return { status: "unavailable", reason: "disabled" };
  if (status === 429) return { status: "rejected", reason: "rate_limited" };
  if (status === 413) return { status: "rejected", reason: "too_long" };
  if (status === 401 || status === 403) return { status: "rejected", reason: "forbidden" };
  if (status >= 400 && status < 500) return { status: "rejected", reason: "invalid_input" };
  return { status: "error", reason: "server" };
}

function parseJsonSafely(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
