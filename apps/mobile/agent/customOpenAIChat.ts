import type { ProviderConfiguration } from "./providerConfiguration";
import { customOpenAIEndpoint } from "./customOpenAIUrl";
import { parseSSEEvent, splitSSEEvents } from "./sse";

export type ChatCompletionToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<Record<string, unknown>> | null;
  tool_calls?: ChatCompletionToolCall[];
  tool_call_id?: string;
};

export type ChatCompletionTool = {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
};

export type ChatCompletionResult = {
  content: string;
  toolCalls: ChatCompletionToolCall[];
};

export class CustomOpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "CustomOpenAIError";
  }
}

export function isUnsupportedCustomFeature(error: unknown, feature: "stream" | "tools"): boolean {
  if (!(error instanceof CustomOpenAIError) || error.status === null) return false;
  if (![400, 404, 405, 422, 501].includes(error.status)) return false;
  const detail = `${error.code ?? ""} ${error.message}`.toLowerCase();
  const named = feature === "stream" ? /stream|sse|streaming/ : /tool|function.call|function_call/;
  return named.test(detail) && /unsupported|not supported|not available|not implement|unknown|invalid|no soport|no admite|desconocid/i.test(detail);
}

export function chatCompletionTools(
  definitions: ReadonlyArray<Record<string, unknown>>,
): ChatCompletionTool[] {
  return definitions.map((item) => ({
    type: "function" as const,
    function: {
      name: String(item.name),
      ...(typeof item.description === "string" ? { description: item.description } : {}),
      parameters: (item.parameters ?? {}) as Record<string, unknown>,
    },
  }));
}

function parseToolCalls(raw: unknown): ChatCompletionToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const call = item as Partial<ChatCompletionToolCall>;
    if (
      !call || typeof call.id !== "string" || !call.id
      || call.type !== "function"
      || typeof call.function?.name !== "string" || !call.function.name
      || typeof call.function.arguments !== "string"
    ) {
      throw new CustomOpenAIError("El proveedor devolvió una llamada a herramienta incompleta.");
    }
    return call as ChatCompletionToolCall;
  });
}

function parseJsonCompletion(raw: unknown): ChatCompletionResult {
  const payload = raw as {
    choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>;
  } | null;
  const message = payload?.choices?.[0]?.message;
  if (!message) throw new CustomOpenAIError("El proveedor no devolvió una respuesta Chat Completions válida.");
  const content = typeof message.content === "string" ? message.content : "";
  const toolCalls = parseToolCalls(message.tool_calls);
  if (!content && toolCalls.length === 0) {
    throw new CustomOpenAIError("El modelo no devolvió contenido ni herramientas.");
  }
  return { content, toolCalls };
}

function createStreamParser(onContentDelta?: (delta: string) => void) {
  let buffer = "";
  let content = "";
  let done = false;
  const tools = new Map<number, ChatCompletionToolCall>();
  const process = (rawEvent: string) => {
    const event = parseSSEEvent(rawEvent);
    if (!event?.data) return;
    if (event.data === "[DONE]") { done = true; return; }
    if (done) throw new CustomOpenAIError("El proveedor envió datos después del fin del stream.");
    let payload: unknown;
    try { payload = JSON.parse(event.data); }
    catch { throw new CustomOpenAIError("El proveedor envió un evento SSE inválido."); }
    const record = payload as {
      error?: { message?: string };
      choices?: Array<{
        delta?: {
          content?: string;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    if (record.error) throw new CustomOpenAIError(record.error.message || "Error del proveedor.");
    const delta = record.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      onContentDelta?.(delta.content);
    }
    for (const fragment of delta.tool_calls ?? []) {
      if (!Number.isSafeInteger(fragment.index) || (fragment.index ?? -1) < 0) {
        throw new CustomOpenAIError("El proveedor devolvió un índice de herramienta inválido.");
      }
      const index = fragment.index!;
      const current = tools.get(index) ?? {
        id: "", type: "function" as const, function: { name: "", arguments: "" },
      };
      if (fragment.id && current.id && fragment.id !== current.id) {
        throw new CustomOpenAIError("El proveedor cambió el ID de una herramienta durante el stream.");
      }
      if (fragment.type && fragment.type !== "function") {
        throw new CustomOpenAIError("El proveedor devolvió un tipo de herramienta no compatible.");
      }
      if (fragment.id) current.id = fragment.id;
      if (fragment.function?.name) current.function.name += fragment.function.name;
      if (fragment.function?.arguments) current.function.arguments += fragment.function.arguments;
      tools.set(index, current);
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      if (buffer.length > 1_048_576) throw new CustomOpenAIError("El evento SSE es demasiado grande.");
      const split = splitSSEEvents(buffer);
      buffer = split.rest;
      split.events.forEach(process);
    },
    finish(): ChatCompletionResult {
      if (!done || buffer.trim()) {
        throw new CustomOpenAIError("La respuesta del proveedor se cortó antes de completarse.");
      }
      const toolCalls = parseToolCalls([...tools.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, call]) => call));
      if (!content && toolCalls.length === 0) {
        throw new CustomOpenAIError("El modelo no devolvió contenido ni herramientas.");
      }
      return { content, toolCalls };
    },
  };
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) throw new CustomOpenAIError("La respuesta del proveedor es demasiado grande.");
    return text;
  }
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CustomOpenAIError("La respuesta del proveedor es demasiado grande.");
    }
  }
  return text + decoder.decode();
}

function errorFromPayload(raw: string, status: number, apiKey: string): CustomOpenAIError {
  let payload: { error?: { message?: string; code?: string; type?: string }; message?: string } | null = null;
  try { payload = JSON.parse(raw); } catch { /* Keep the status fallback. */ }
  const detail = payload?.error?.message ?? payload?.message ?? `Error del proveedor (${status}).`;
  const safe = detail.replaceAll(apiKey, "[clave oculta]").slice(0, 500);
  return new CustomOpenAIError(safe, status, payload?.error?.code ?? payload?.error?.type ?? null);
}

export async function requestCustomOpenAIChat(
  provider: ProviderConfiguration,
  messages: ChatCompletionMessage[],
  options: {
    platform: string;
    tools?: ChatCompletionTool[];
    stream?: boolean;
    onContentDelta?: (delta: string) => void;
    fetchImpl?: typeof fetch;
  },
): Promise<ChatCompletionResult> {
  const url = customOpenAIEndpoint(provider.base_url ?? "", "chat/completions");
  const model = provider.model.trim();
  const apiKey = provider.api_key.trim();
  if (!model || !apiKey) throw new CustomOpenAIError("Configura un modelo y una API key para este proveedor.");
  const fetchImpl = options.fetchImpl ?? (options.platform === "web"
    ? fetch
    : (await import("expo/fetch")).fetch as typeof fetch);
  const body = { model, messages, ...(options.tools?.length ? { tools: options.tools } : {}) };
  const call = async (stream: boolean): Promise<ChatCompletionResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(stream ? { Accept: "text/event-stream" } : {}),
        },
        body: JSON.stringify({ ...body, stream }),
        signal: controller.signal,
      });
      if (!response.ok) throw errorFromPayload(await readLimited(response, 16_384), response.status, apiKey);
      if (!stream || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const raw = await readLimited(response, 2_097_152);
        let payload: unknown;
        try { payload = JSON.parse(raw); }
        catch { throw new CustomOpenAIError("El proveedor devolvió JSON inválido."); }
        return parseJsonCompletion(payload);
      }
      const parser = createStreamParser(options.onContentDelta);
      const reader = response.body?.getReader();
      if (!reader) {
        parser.push(await readLimited(response, 2_097_152));
      } else {
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
      }
      return parser.finish();
    } catch (error) {
      if (error instanceof CustomOpenAIError) {
        throw new CustomOpenAIError(
          error.message.replaceAll(apiKey, "[clave oculta]"),
          error.status,
          error.code,
        );
      }
      if (controller.signal.aborted) throw new CustomOpenAIError("Tiempo de espera agotado al conectar con el proveedor.");
      throw new CustomOpenAIError("No se pudo conectar con el proveedor. Comprueba la red, HTTPS y CORS si usas web.");
    } finally {
      clearTimeout(timeout);
    }
  };
  if (options.stream === false) return call(false);
  try { return await call(true); }
  catch (error) {
    if (isUnsupportedCustomFeature(error, "stream")) return call(false);
    throw error;
  }
}
