import { ISSUE_PRESENTATION, type FeedbackIssueRequest } from "./contract";

export type GitHubIssueResult =
  | { ok: true; number: number; url: string }
  | { ok: false; reason: "upstream_failed"; status: number | null };

export type GitHubClientOptions = {
  token: string;
  /** `owner/repo`. Fijo en el servidor: el cliente no puede elegirlo. */
  repository: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Crea una issue en el repositorio fijado por configuración.
 *
 * El único punto del servicio que habla con GitHub. La ruta, el método, el
 * repositorio y las etiquetas se construyen aquí y no dependen de la petición
 * entrante, así que el endpoint no puede usarse como proxy genérico.
 */
export async function createGitHubIssue(
  request: FeedbackIssueRequest,
  options: GitHubClientOptions,
): Promise<GitHubIssueResult> {
  const presentation = ISSUE_PRESENTATION[request.kind];
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(
    () => controller?.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${options.repository}/issues`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "user-agent": "gymnasia-feedback-worker",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({
          title: `${presentation.titlePrefix} ${request.title}`,
          body: request.summary,
          labels: presentation.labels,
        }),
        signal: controller?.signal,
      },
    );

    if (!response.ok) {
      return { ok: false, reason: "upstream_failed", status: response.status };
    }

    const payload = (await response.json().catch(() => null)) as
      | { number?: unknown; html_url?: unknown }
      | null;

    const number = typeof payload?.number === "number" ? payload.number : null;
    const url = typeof payload?.html_url === "string" ? payload.html_url : null;
    if (number === null || !Number.isInteger(number) || number <= 0 || !url) {
      // 2xx sin referencia utilizable no es un éxito: es exactamente el fallo
      // que este servicio existe para evitar.
      return { ok: false, reason: "upstream_failed", status: response.status };
    }

    return { ok: true, number, url };
  } catch {
    return { ok: false, reason: "upstream_failed", status: null };
  } finally {
    clearTimeout(timeout);
  }
}
