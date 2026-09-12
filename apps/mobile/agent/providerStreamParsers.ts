import type {
  AnthropicResponseBlock,
  AnthropicToolUseBlock,
} from "./providerToolLoop";
import { googleText, isGoogleRecord, isGoogleStep, type GoogleContent, type GoogleStep, type GoogleInteractionTurn } from "./googleInteractions";
import { canonicalToolJson } from "./toolOperationLedger";
import { parseSSEEvent, splitSSEEvents } from "./sse";

export type StreamingHandlers = {
  onContentDelta?: (delta: string, aggregate: string) => void;
  onThinkingDelta?: (delta: string, aggregate: string) => void;
};

export type OpenAIReasoningOutputItem = {
  type: "reasoning";
  id?: string;
  summary?: Array<{ type: "summary_text"; text: string }>;
};

export type OpenAIMessageOutputItem = {
  type: "message";
  id?: string;
  content?: Array<{ type: "output_text"; text: string }>;
};

export type OpenAIFunctionCallOutputItem = {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
  status?: string;
};

export type OpenAIResponseOutputItem =
  | OpenAIReasoningOutputItem
  | OpenAIMessageOutputItem
  | OpenAIFunctionCallOutputItem;

export type OpenAIStreamTurnResult = {
  responseId: string | null;
  content: string;
  thinking: string | null;
  outputItems: OpenAIResponseOutputItem[];
};

export type AnthropicStreamTurnResult = {
  content: string;
  thinking: string | null;
  contentBlocks: AnthropicResponseBlock[];
  stopReason: string | null;
  /**
   * El stream acabó sin el `message_stop` que lo cierra. Señal de que la
   * respuesta llegó a medias: sin esto, un corte se ve igual que un turno
   * completo y el contenido parcial pasa por bueno.
   */
  truncated: boolean;
};

export type GoogleStreamTurnResult = GoogleInteractionTurn;

export class GoogleStreamError extends Error {
  constructor(public readonly code: string, detail: string) {
    super(`Google Interactions: ${detail} (${code})`);
    this.name = "GoogleStreamError";
  }
}

export function createGoogleStreamParser(handlers?: StreamingHandlers) {
  let buffer = "";
  let interactionId: string | null = null;
  let terminal: GoogleInteractionTurn["status"] | null = null;
  let usage: Record<string, unknown> = {};
  let content = "";
  let thinking = "";
  let failure: Error | null = null;
  let finished = false;
  const steps = new Map<number, {
    start: string; step: Record<string, unknown>; arguments: string; stopped: boolean;
  }>();
  const callIds = new Set<string>();
  const fail = (code: string, detail: string): never => { throw new GoogleStreamError(code, detail); };
  const appendText = (parts: GoogleContent[], text: string) => {
    const last = parts[parts.length - 1];
    if (last?.type === "text") last.text = String(last.text ?? "") + text;
    else parts.push({ type: "text", text });
  };
  const emit = (text: string, thought: boolean) => {
    if (!text) return;
    if (thought) { thinking += text; handlers?.onThinkingDelta?.(text, thinking); }
    else { content += text; handlers?.onContentDelta?.(text, content); }
  };
  const process = (raw: string) => {
    const event = parseSSEEvent(raw);
    if (!event?.data) return; // SSE comments/heartbeats have no payload.
    if (event.data === "[DONE]") {
      if (!terminal) fail("truncated", "el stream terminó antes de completar la interacción");
      return;
    }
    let data: unknown;
    try { data = JSON.parse(event.data); }
    catch { fail("invalid_json", "evento JSON no válido"); }
    if (!isGoogleRecord(data) || typeof data.event_type !== "string") {
      return fail("invalid_event", "falta el tipo de evento");
    }
    const type = data.event_type;
    if (event.event !== "message" && event.event !== type) fail("invalid_event", "tipos SSE contradictorios");
    if (type === "error") fail("provider_error", errorMessage(data, "error del proveedor"));
    if (terminal && type !== "step.start" && type !== "step.stop") {
      fail("after_terminal", "evento después del cierre de la interacción");
    }
    if (type === "interaction.created") {
      if (interactionId !== null || !isGoogleRecord(data.interaction)
        || typeof data.interaction.id !== "string"
        || data.interaction.status !== "in_progress") fail("invalid_created", "apertura de interacción no válida");
      interactionId = (data.interaction as { id: string }).id;
      return;
    }
    if (interactionId === null) fail("missing_created", "evento recibido antes de abrir la interacción");
    if (data.interaction_id !== undefined && data.interaction_id !== interactionId) {
      fail("interaction_mismatch", "el evento pertenece a otra interacción");
    }
    if (type === "interaction.status_update") {
      if (!["in_progress", "requires_action", "completed"].includes(String(data.status))) {
        fail("terminal_status", `estado no completado: ${String(data.status)}`);
      }
      return;
    }
    if (type === "interaction.completed") {
      if (!isGoogleRecord(data.interaction) || data.interaction.id !== interactionId) {
        return fail("interaction_mismatch", "cierre de otra interacción");
      }
      const status = data.interaction.status;
      if (status !== "completed" && status !== "requires_action") {
        return fail("terminal_status", `estado no completado: ${String(status)}`);
      }
      if (!steps.size || [...steps.values()].some((item) => !item.stopped)) {
        fail("unfinished_step", "la interacción tiene pasos sin completar");
      }
      if ((status === "requires_action") !== (callIds.size > 0)) {
        fail("inconsistent_status", "el estado no coincide con las herramientas recibidas");
      }
      if (!isGoogleRecord(data.interaction.usage)) fail("invalid_usage", "faltan las estadísticas de uso");
      usage = data.interaction.usage as Record<string, unknown>;
      terminal = status;
      return;
    }
    if (!["step.start", "step.delta", "step.stop"].includes(type)) {
      fail("unsupported_event", `evento no soportado: ${type}`);
    }
    if (!Number.isSafeInteger(data.index) || Number(data.index) < 0) fail("invalid_index", "índice de paso no válido");
    const index = Number(data.index);
    const current = steps.get(index);
    if (type === "step.start") {
      if (!isGoogleRecord(data.step)) return fail("invalid_step", "apertura de paso no válida");
      const start = canonicalToolJson(data.step);
      if (current) {
        if (current.start !== start) fail("step_collision", "un índice identifica dos pasos distintos");
        return; // Replayed opening must not reset accumulated arguments or content.
      }
      if (terminal || index !== steps.size) fail("invalid_sequence", "orden de apertura de pasos no válido");
      const step = JSON.parse(JSON.stringify(data.step)) as Record<string, unknown>;
      if (step.type === "model_output") step.content ??= [];
      if (step.type === "function_call") {
        step.arguments ??= {};
        if (typeof step.id !== "string" || callIds.has(step.id)) fail("call_collision", "ID de herramienta ausente o repetido");
        callIds.add(step.id as string);
      }
      if (!["model_output", "thought", "function_call"].includes(String(step.type)) || !isGoogleStep(step)) {
        return fail("unsupported_step", "paso no válido o no soportado");
      }
      steps.set(index, { start, step, arguments: "", stopped: false });
      if (step.type === "model_output") emit(googleText(step.content), false);
      if (step.type === "thought") emit(googleText(step.summary), true);
      return;
    }
    if (!current) return fail("missing_start", "paso recibido sin apertura");
    if (type === "step.stop") {
      if (current.stopped) return;
      if (terminal) fail("after_terminal", "cierre de paso después de la interacción");
      if (current.step.type === "function_call" && current.arguments) {
        let args: unknown;
        try { args = JSON.parse(current.arguments); }
        catch { fail("invalid_arguments", "argumentos de herramienta incompletos"); }
        if (!isGoogleRecord(args)) fail("invalid_arguments", "los argumentos deben ser un objeto");
        current.step.arguments = args;
      }
      if (current.step.type === "thought" && (typeof current.step.signature !== "string" || !current.step.signature)) {
        fail("missing_signature", "pensamiento completado sin firma");
      }
      if (!isGoogleStep(current.step)) fail("invalid_step", "paso ensamblado no válido");
      current.stopped = true;
      return;
    }
    if (current.stopped || terminal) fail("closed_step", "delta recibido después del cierre");
    if (!isGoogleRecord(data.delta)) return fail("invalid_delta", "delta no válido");
    const delta = data.delta;
    const step = current.step;
    if (step.type === "model_output" && delta.type === "text" && typeof delta.text === "string") {
      appendText(step.content as GoogleContent[], delta.text);
      emit(delta.text, false);
    } else if (step.type === "thought" && delta.type === "thought_summary" && isGoogleRecord(delta.content)) {
      const parts = (step.summary ??= []) as GoogleContent[];
      if (delta.content.type === "text" && typeof delta.content.text === "string") {
        appendText(parts, delta.content.text); emit(delta.content.text, true);
      } else if (delta.content.type === "image") parts.push(delta.content as GoogleContent);
      else fail("invalid_delta", "resumen de pensamiento no válido");
    } else if (step.type === "thought" && delta.type === "thought_signature" && typeof delta.signature === "string") {
      if (step.signature && step.signature !== delta.signature) fail("signature_collision", "firmas de pensamiento contradictorias");
      step.signature = delta.signature;
    } else if (step.type === "function_call" && delta.type === "arguments_delta" && typeof delta.arguments === "string") {
      if (Object.keys(step.arguments as object).length) fail("invalid_arguments", "argumentos completos y parciales mezclados");
      current.arguments += delta.arguments;
    } else {
      fail("unsupported_delta", `delta incompatible: ${String(delta.type)}`);
    }
  };
  return {
    push(chunk: string) {
      if (failure) throw failure;
      if (finished) return fail("already_finished", "el lector ya ha finalizado");
      try {
        buffer += chunk;
        const split = splitSSEEvents(buffer);
        buffer = split.rest;
        split.events.forEach(process);
      } catch (error) { failure = error as Error; throw error; }
    },
    finish(): GoogleInteractionTurn {
      if (failure) throw failure;
      if (buffer.trim() || !terminal || interactionId === null) {
        return fail("truncated", "respuesta interrumpida o incompleta");
      }
      finished = true;
      return { interactionId, status: terminal, steps: [...steps.values()].map((item) => item.step as GoogleStep),
        content: content.trim(), thinking: thinking.trim() || null, usage };
    },
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (
      record.error
      && typeof record.error === "object"
      && typeof record.error.message === "string"
      && record.error.message.trim()
    ) {
      return record.error.message;
    }
    if (typeof record.message === "string" && record.message.trim()) return record.message;
  }
  return fallback;
}

function normalizeOpenAIArguments(rawArguments: unknown): string {
  if (typeof rawArguments === "string") return rawArguments;
  if (rawArguments && typeof rawArguments === "object") {
    try {
      return JSON.stringify(rawArguments);
    } catch {
      return "";
    }
  }
  return "";
}

function normalizeOpenAIOutputItem(rawItem: unknown): OpenAIResponseOutputItem | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as {
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: unknown;
    status?: string;
    summary?: Array<{ type?: string; text?: string }>;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (item.type === "reasoning") {
    return {
      type: "reasoning",
      id: typeof item.id === "string" ? item.id : undefined,
      summary: Array.isArray(item.summary)
        ? item.summary.flatMap((part) => part?.type === "summary_text" && typeof part.text === "string"
          ? [{ type: "summary_text" as const, text: part.text }]
          : [])
        : undefined,
    };
  }
  if (item.type === "message") {
    return {
      type: "message",
      id: typeof item.id === "string" ? item.id : undefined,
      content: Array.isArray(item.content)
        ? item.content.flatMap((part) => part?.type === "output_text" && typeof part.text === "string"
          ? [{ type: "output_text" as const, text: part.text }]
          : [])
        : undefined,
    };
  }
  if (
    item.type === "function_call"
    && typeof item.id === "string"
    && typeof item.call_id === "string"
    && typeof item.name === "string"
  ) {
    return {
      type: "function_call",
      id: item.id,
      call_id: item.call_id,
      name: item.name,
      arguments: normalizeOpenAIArguments(item.arguments),
      status: typeof item.status === "string" ? item.status : undefined,
    };
  }
  return null;
}

function parseOpenAIOutputItems(payload: unknown): OpenAIResponseOutputItem[] {
  if (!payload || typeof payload !== "object") return [];
  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return [];
  return output
    .map(normalizeOpenAIOutputItem)
    .filter((item): item is OpenAIResponseOutputItem => Boolean(item));
}

function collectOpenAIText(items: OpenAIResponseOutputItem[]): string {
  return items
    .filter((item): item is OpenAIMessageOutputItem => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n");
}

function collectOpenAIThinking(items: OpenAIResponseOutputItem[]): string | null {
  const result = items
    .filter((item): item is OpenAIReasoningOutputItem => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return result || null;
}

export function createOpenAIStreamParser(handlers?: StreamingHandlers) {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let responseId: string | null = null;
  const itemsByIndex = new Map<number, OpenAIResponseOutputItem>();
  const indexesById = new Map<string, number>();

  const setItem = (index: number, item: OpenAIResponseOutputItem) => {
    itemsByIndex.set(index, item);
    if ("id" in item && typeof item.id === "string" && item.id.trim()) {
      indexesById.set(item.id, index);
    }
  };
  const replaceItems = (items: OpenAIResponseOutputItem[]) => {
    itemsByIndex.clear();
    indexesById.clear();
    items.forEach((item, index) => setItem(index, item));
  };
  const updateArguments = (itemId: string, nextArguments: (current: string) => string) => {
    const index = indexesById.get(itemId);
    if (index === undefined) return;
    const item = itemsByIndex.get(index);
    if (item?.type !== "function_call") return;
    setItem(index, { ...item, arguments: nextArguments(item.arguments) });
  };
  const processEvent = (rawEvent: string) => {
    const event = parseSSEEvent(rawEvent);
    if (!event?.data || event.data.trim() === "[DONE]") return;
    const parsed = parseJson(event.data);
    if (!parsed || typeof parsed !== "object") return;
    const payload = parsed as {
      type?: string;
      delta?: string;
      arguments?: string;
      item_id?: string;
      output_index?: number;
      item?: unknown;
      response?: { id?: string; output?: unknown[]; error?: { message?: string } };
    };
    const type = payload.type ?? event.event;
    if (type === "error" || event.event === "error") {
      throw new Error(errorMessage(parsed, "OpenAI stream error"));
    }
    if (type === "response.failed") {
      throw new Error(payload.response?.error?.message ?? errorMessage(parsed, "OpenAI stream error"));
    }
    if (type === "response.created" || type === "response.in_progress") {
      responseId = payload.response?.id ?? responseId;
    } else if (type === "response.output_text.delta") {
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      streamedContent += delta;
      if (delta) handlers?.onContentDelta?.(delta, streamedContent);
    } else if (type === "response.reasoning_summary_text.delta") {
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      streamedThinking += delta;
      if (delta) handlers?.onThinkingDelta?.(delta, streamedThinking);
    } else if (type === "response.output_item.added" || type === "response.output_item.done") {
      if (typeof payload.output_index !== "number") return;
      const item = normalizeOpenAIOutputItem(payload.item);
      if (item) setItem(payload.output_index, item);
    } else if (type === "response.function_call_arguments.delta") {
      if (typeof payload.item_id !== "string" || typeof payload.delta !== "string") return;
      updateArguments(payload.item_id, (current) => current + payload.delta);
    } else if (type === "response.function_call_arguments.done") {
      if (typeof payload.item_id !== "string") return;
      updateArguments(payload.item_id, () => payload.arguments ?? "");
    } else if (type === "response.completed") {
      responseId = payload.response?.id ?? responseId;
      const finalItems = parseOpenAIOutputItems(payload.response);
      if (finalItems.length > 0) replaceItems(finalItems);
    }
  };
  const push = (chunk: string) => {
    rawBuffer += chunk;
    const split = splitSSEEvents(rawBuffer);
    rawBuffer = split.rest;
    split.events.forEach(processEvent);
  };
  return {
    push,
    finish: (): OpenAIStreamTurnResult => {
      if (rawBuffer.trim()) processEvent(rawBuffer);
      rawBuffer = "";
      const outputItems = Array.from(itemsByIndex.entries())
        .sort(([left], [right]) => left - right)
        .map(([, item]) => item);
      return {
        responseId,
        content: streamedContent.trim() || collectOpenAIText(outputItems),
        thinking: streamedThinking.trim() || collectOpenAIThinking(outputItems),
        outputItems,
      };
    },
  };
}

export function createAnthropicStreamParser(handlers?: StreamingHandlers) {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let stopReason: string | null = null;
  let sawTerminalEvent = false;
  const blocks = new Map<number, AnthropicResponseBlock & { partial_json?: string }>();
  const processEvent = (rawEvent: string) => {
    const event = parseSSEEvent(rawEvent);
    if (!event?.data) return;
    const parsed = parseJson(event.data);
    if (!parsed || typeof parsed !== "object") return;
    const payload = parsed as {
      type?: string;
      index?: number;
      content_block?: Record<string, unknown>;
      delta?: Record<string, unknown>;
      message?: { stop_reason?: string | null };
    };
    const type = payload.type ?? event.event;
    if (type === "error" || event.event === "error") {
      throw new Error(errorMessage(parsed, "Anthropic stream error"));
    }
    const index = typeof payload.index === "number" ? payload.index : -1;
    if (type === "content_block_start" && index >= 0 && payload.content_block) {
      const block = payload.content_block;
      if (block.type === "text") {
        blocks.set(index, { type: "text", text: typeof block.text === "string" ? block.text : "" });
      } else if (block.type === "thinking") {
        blocks.set(index, {
          type: "thinking",
          thinking: typeof block.thinking === "string" ? block.thinking : "",
          signature: typeof block.signature === "string" ? block.signature : undefined,
        });
      } else if (block.type === "tool_use") {
        blocks.set(index, {
          type: "tool_use",
          id: typeof block.id === "string" ? block.id : "",
          name: typeof block.name === "string" ? block.name : "",
          input: {},
          partial_json: "",
        });
      }
    } else if (type === "content_block_delta" && index >= 0 && payload.delta) {
      const block = blocks.get(index);
      if (!block) return;
      if (payload.delta.type === "text_delta" && block.type === "text") {
        const delta = typeof payload.delta.text === "string" ? payload.delta.text : "";
        block.text += delta;
        streamedContent += delta;
        if (delta) handlers?.onContentDelta?.(delta, streamedContent);
      } else if (payload.delta.type === "thinking_delta" && block.type === "thinking") {
        const delta = typeof payload.delta.thinking === "string" ? payload.delta.thinking : "";
        block.thinking += delta;
        streamedThinking += delta;
        if (delta) handlers?.onThinkingDelta?.(delta, streamedThinking);
      } else if (payload.delta.type === "signature_delta" && block.type === "thinking") {
        block.signature = typeof payload.delta.signature === "string" ? payload.delta.signature : block.signature;
      } else if (payload.delta.type === "input_json_delta" && block.type === "tool_use") {
        block.partial_json = (block.partial_json ?? "")
          + (typeof payload.delta.partial_json === "string" ? payload.delta.partial_json : "");
      }
    } else if (type === "content_block_stop" && index >= 0) {
      const block = blocks.get(index);
      if (block?.type === "tool_use") {
        const input = parseJson(block.partial_json ?? "");
        block.input = input && typeof input === "object" && !Array.isArray(input)
          ? input as Record<string, unknown>
          : {};
      }
    } else if (type === "message_delta") {
      stopReason = payload.message?.stop_reason
        ?? (typeof payload.delta?.stop_reason === "string" ? payload.delta.stop_reason : null)
        ?? stopReason;
    } else if (type === "message_stop") {
      sawTerminalEvent = true;
    }
  };
  const push = (chunk: string) => {
    rawBuffer += chunk;
    const split = splitSSEEvents(rawBuffer);
    rawBuffer = split.rest;
    split.events.forEach(processEvent);
  };
  return {
    push,
    finish: (): AnthropicStreamTurnResult => {
      if (rawBuffer.trim()) processEvent(rawBuffer);
      rawBuffer = "";
      const contentBlocks = Array.from(blocks.entries())
        .sort(([left], [right]) => left - right)
        .map(([, block]) => block.type === "tool_use"
          ? {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
            } satisfies AnthropicToolUseBlock
          : block);
      return {
        content: streamedContent.trim(),
        thinking: streamedThinking.trim() || null,
        contentBlocks,
        stopReason,
        truncated: !sawTerminalEvent,
      };
    },
  };
}
