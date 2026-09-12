import { createGoogleStreamParser, type GoogleStreamTurnResult, type StreamingHandlers } from "./providerStreamParsers";
import { buildGoogleInteractionRequest, googleApiHeaders, GOOGLE_INTERACTIONS_URL } from "./providerTransport";

function parseJsonSafely<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function extractErrorMessage(value: unknown, fallback: string): string {
  const error = (value as { error?: { message?: string } } | null)?.error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export function googleInteractionEndpoint(fixturePort: unknown, environment: unknown, apiKey: string): string {
  if (fixturePort === undefined || fixturePort === null) return GOOGLE_INTERACTIONS_URL;
  if (environment !== "development" || apiKey !== "e2e-local-fake-key"
    || !Number.isInteger(fixturePort) || Number(fixturePort) < 1024 || Number(fixturePort) > 65535) {
    throw new Error("El servidor Google de pruebas requiere Development y una clave ficticia.");
  }
  return `http://127.0.0.1:${fixturePort}/v1beta/interactions`;
}

export function requestGoogleInteraction(
  options: Parameters<typeof buildGoogleInteractionRequest>[0] & {
    apiKey: string; platform: string; environment?: string; fixturePort?: number;
  },
  handlers?: StreamingHandlers,
): Promise<GoogleStreamTurnResult> {
  const url = googleInteractionEndpoint(options.fixturePort, options.environment, options.apiKey);
  const headers = googleApiHeaders(options.apiKey, {
    "Content-Type": "application/json", Accept: "text/event-stream",
  });
  const body = buildGoogleInteractionRequest(options);
  if (options.platform === "web") {
    return streamGoogleRequestViaFetch(url, headers, body, handlers);
  }

  let emittedVisibleDelta = false;
  const trackedHandlers: StreamingHandlers = {
    onContentDelta: (delta, aggregate) => {
      if (handlers?.onContentDelta) {
        emittedVisibleDelta = true;
        handlers.onContentDelta(delta, aggregate);
      }
    },
    onThinkingDelta: (delta, aggregate) => {
      if (handlers?.onThinkingDelta) {
        emittedVisibleDelta = true;
        handlers.onThinkingDelta(delta, aggregate);
      }
    },
  };

  return streamGoogleRequestViaXHR(url, headers, body, trackedHandlers).catch((error) => {
    if (emittedVisibleDelta || !(error instanceof Error)
      || error.message !== "No se pudo conectar con Google AI.") {
      throw error;
    }
    // React Native usa una ruta nativa distinta al escuchar progreso en XHR.
    // Si esa ruta falla antes de mostrar contenido, repetimos la generación sin
    // progreso incremental y entregamos el SSE completo al mismo parser.
    return streamGoogleRequestViaBufferedXHR(url, headers, body, handlers);
  });
}

async function streamGoogleRequestViaBufferedXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Google AI.",
  statusFallbackPrefix = "Google AI error",
): Promise<GoogleStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      xhr.onload = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    xhr.open("POST", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      if (settled) return;
      const rawText = xhr.responseText ?? "";
      if (xhr.status < 200 || xhr.status >= 300) {
        const payload = parseJsonSafely<unknown>(rawText);
        const fallbackMessage = xhr.status
          ? `${statusFallbackPrefix} (${xhr.status})`
          : networkFallbackMessage;
        rejectOnce(new Error(extractErrorMessage(payload, rawText.trim() || fallbackMessage)));
        return;
      }

      try {
        const parser = createGoogleStreamParser(handlers);
        parser.push(rawText);
        const result = parser.finish();
        settled = true;
        cleanup();
        resolve(result);
      } catch (error) {
        rejectOnce(error instanceof Error
          ? error
          : new Error("No se pudo finalizar el stream de Google AI."));
      }
    };
    xhr.onerror = () => rejectOnce(new Error(networkFallbackMessage));
    xhr.ontimeout = () => rejectOnce(new Error("Tiempo de espera agotado al conectar con Google AI."));
    xhr.send(JSON.stringify(body));
  });
}

export async function streamGoogleRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Google AI.",
  statusFallbackPrefix = "Google AI error",
): Promise<GoogleStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createGoogleStreamParser(handlers);
    let lastOffset = 0;
    let settled = false;

    const cleanup = () => {
      xhr.onreadystatechange = null;
      xhr.onprogress = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const resolveOnce = (result: GoogleStreamTurnResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const processPendingResponseText = () => {
      const fullText = xhr.responseText ?? "";
      const nextText = fullText.slice(lastOffset);
      lastOffset = fullText.length;
      if (nextText) parser.push(nextText);
    };

    xhr.open("POST", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Google AI."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con Google AI."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Google AI."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolveOnce(parser.finish());
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de Google AI."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(JSON.stringify(body));
  });
}

export async function streamGoogleRequestViaFetch(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Google AI.",
  statusFallbackPrefix = "Google AI error",
): Promise<GoogleStreamTurnResult> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, 120000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      const payload = parseJsonSafely<unknown>(rawText);
      throw new Error(
        extractErrorMessage(payload, rawText || `${statusFallbackPrefix} (${response.status})`),
      );
    }

    const parser = createGoogleStreamParser(handlers);
    const reader = response.body?.getReader();
    if (!reader) {
      const rawText = await response.text().catch(() => "");
      if (rawText) parser.push(rawText);
      return parser.finish();
    }

    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      parser.push(decoder.decode(value, { stream: true }));
    }

    const remaining = decoder.decode();
    if (remaining) parser.push(remaining);
    return parser.finish();
  } catch (err) {
    controller?.abort();
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al conectar con Google AI.");
    }
    if (err instanceof Error && err.message.trim()) {
      throw err;
    }
    throw new Error(networkFallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}
