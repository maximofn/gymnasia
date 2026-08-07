import type {
  AnthropicResponseBlock,
  AnthropicToolUseBlock,
  GoogleResponsePart,
} from "./providerToolLoop";
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
};

export type GoogleStreamTurnResult = {
  content: string;
  thinking: string | null;
  modelParts: GoogleResponsePart[];
  finishReason: string | null;
};

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
      };
    },
  };
}

function normalizeGoogleArgs(rawArgs: unknown): Record<string, unknown> {
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }
  if (typeof rawArgs === "string") {
    const parsed = parseJson(rawArgs);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return {};
}

export function createGoogleStreamParser(handlers?: StreamingHandlers) {
  let rawBuffer = "";
  let streamedContent = "";
  let streamedThinking = "";
  let finishReason: string | null = null;
  const modelParts: GoogleResponsePart[] = [];
  const processEvent = (rawEvent: string) => {
    const event = parseSSEEvent(rawEvent);
    if (!event?.data || event.data.trim() === "[DONE]") return;
    const parsed = parseJson(event.data);
    if (!parsed || typeof parsed !== "object") return;
    const payload = parsed as {
      error?: unknown;
      candidates?: Array<{
        finishReason?: string;
        finish_reason?: string;
        content?: {
          parts?: Array<{
            text?: string;
            thought?: boolean;
            thoughtSignature?: string;
            thought_signature?: string;
            functionCall?: { name?: string; args?: unknown };
            function_call?: { name?: string; args?: unknown };
          }>;
        };
      }>;
    };
    if (payload.error) throw new Error(errorMessage(parsed, "Google AI stream error"));
    for (const candidate of payload.candidates ?? []) {
      finishReason = candidate.finishReason ?? candidate.finish_reason ?? finishReason;
      for (const part of candidate.content?.parts ?? []) {
        const text = typeof part.text === "string" ? part.text : undefined;
        const thought = part.thought === true;
        const thoughtSignature = typeof part.thoughtSignature === "string"
          ? part.thoughtSignature
          : typeof part.thought_signature === "string"
            ? part.thought_signature
            : undefined;
        const functionCall = part.functionCall ?? part.function_call;
        if (text) {
          if (thought) {
            streamedThinking += text;
            handlers?.onThinkingDelta?.(text, streamedThinking);
          } else {
            streamedContent += text;
            handlers?.onContentDelta?.(text, streamedContent);
          }
        }
        if (functionCall && typeof functionCall.name === "string" && functionCall.name.trim()) {
          modelParts.push({
            functionCall: {
              name: functionCall.name.trim(),
              args: normalizeGoogleArgs(functionCall.args),
            },
            thought,
            thoughtSignature,
          });
        } else if (text || thoughtSignature) {
          modelParts.push({
            ...(text !== undefined ? { text } : {}),
            ...(thought ? { thought: true } : {}),
            ...(thoughtSignature ? { thoughtSignature } : {}),
          });
        }
      }
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
    finish: (): GoogleStreamTurnResult => {
      if (rawBuffer.trim()) processEvent(rawBuffer);
      rawBuffer = "";
      return {
        content: streamedContent.trim(),
        thinking: streamedThinking.trim() || null,
        modelParts,
        finishReason,
      };
    },
  };
}
