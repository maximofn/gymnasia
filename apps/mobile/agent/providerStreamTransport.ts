import {
  createAnthropicStreamParser,
  createOpenAIStreamParser,
  type AnthropicStreamTurnResult,
  type OpenAIStreamTurnResult,
  type StreamingHandlers,
} from "./providerStreamParsers";
import { parseJsonSafely } from "./providerResponseModel";

const REQUEST_TIMEOUT_MS = 120000;
const ANTHROPIC_TRUNCATED_STREAM_MESSAGE =
  "La respuesta de Anthropic se cortó antes de completarse. Vuelve a intentarlo.";

export function extractProviderErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as {
    error?: { message?: string };
    detail?: string;
    message?: string;
  };
  return candidate.error?.message ?? candidate.detail ?? candidate.message ?? fallback;
}

export async function streamAnthropicRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con Anthropic.",
  statusFallbackPrefix = "Anthropic error",
): Promise<AnthropicStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createAnthropicStreamParser(handlers);
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

    const resolveOnce = (result: AnthropicStreamTurnResult) => {
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
    xhr.timeout = REQUEST_TIMEOUT_MS;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Anthropic."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con Anthropic."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de Anthropic."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = parser.finish();
          if (result.truncated) {
            rejectOnce(new Error(ANTHROPIC_TRUNCATED_STREAM_MESSAGE));
            return;
          }
          resolveOnce(result);
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de Anthropic."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractProviderErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(JSON.stringify({ ...body, stream: true }));
  });
}

export async function streamOpenAIRequestViaXHR(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con OpenAI.",
  statusFallbackPrefix = "OpenAI error",
): Promise<OpenAIStreamTurnResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const parser = createOpenAIStreamParser(handlers);
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

    const resolveOnce = (result: OpenAIStreamTurnResult) => {
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
    xhr.timeout = REQUEST_TIMEOUT_MS;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onprogress = () => {
      try {
        processPendingResponseText();
      } catch (err) {
        xhr.abort();
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de OpenAI."),
        );
      }
    };

    xhr.onerror = () => {
      rejectOnce(new Error(networkFallbackMessage));
    };

    xhr.ontimeout = () => {
      rejectOnce(new Error("Tiempo de espera agotado al conectar con OpenAI."));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== xhr.DONE || settled) return;

      try {
        processPendingResponseText();
      } catch (err) {
        rejectOnce(
          err instanceof Error ? err : new Error("No se pudo procesar el stream de OpenAI."),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolveOnce(parser.finish());
        } catch (err) {
          rejectOnce(
            err instanceof Error ? err : new Error("No se pudo finalizar el stream de OpenAI."),
          );
        }
        return;
      }

      const payload = parseJsonSafely<unknown>(xhr.responseText ?? "");
      const rawMessage = xhr.responseText?.trim();
      const fallbackMessage = xhr.status
        ? `${statusFallbackPrefix} (${xhr.status})`
        : networkFallbackMessage;
      rejectOnce(new Error(extractProviderErrorMessage(payload, rawMessage || fallbackMessage)));
    };

    xhr.send(JSON.stringify({ ...body, stream: true }));
  });
}

export async function streamOpenAIRequestViaFetch(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  handlers?: StreamingHandlers,
  networkFallbackMessage = "No se pudo conectar con OpenAI.",
  statusFallbackPrefix = "OpenAI error",
): Promise<OpenAIStreamTurnResult> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      const payload = parseJsonSafely<unknown>(rawText);
      throw new Error(
        extractProviderErrorMessage(
          payload,
          rawText || `${statusFallbackPrefix} (${response.status})`,
        ),
      );
    }

    const parser = createOpenAIStreamParser(handlers);
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
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al conectar con OpenAI.");
    }
    if (err instanceof Error && err.message.trim()) {
      throw err;
    }
    throw new Error(networkFallbackMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}
