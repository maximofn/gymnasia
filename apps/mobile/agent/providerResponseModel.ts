import {
  normalizeOpenAIReasoningEffort,
  type OpenAIReasoningEffort,
  type ProviderConfiguration,
} from "./providerConfiguration";
import type {
  OpenAIMessageOutputItem,
  OpenAIReasoningOutputItem,
  OpenAIResponseOutputItem,
} from "./providerStreamParsers";

const OPENAI_REASONING_SUMMARY = "detailed";

export type ProviderTextResult = {
  content: string;
  thinking: string | null;
};

export function normalizeOpenAIFunctionCallArguments(rawArguments: unknown): string {
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

export function normalizeOpenAIResponseOutputItem(rawItem: unknown): OpenAIResponseOutputItem | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as {
    type?: string;
    id?: string;
    summary?: Array<{ type?: string; text?: string }>;
    content?: Array<{ type?: string; text?: string }>;
    call_id?: string;
    name?: string;
    arguments?: unknown;
    status?: string;
  };
  if (item.type === "reasoning") {
    const summary = Array.isArray(item.summary)
      ? item.summary
          .filter(
            (part): part is { type: "summary_text"; text: string } => (
              part?.type === "summary_text" && typeof part.text === "string"
            ),
          )
          .map((part) => ({ type: "summary_text" as const, text: part.text }))
      : undefined;
    return {
      type: "reasoning",
      id: typeof item.id === "string" ? item.id : undefined,
      summary,
    };
  }
  if (item.type === "message") {
    const content = Array.isArray(item.content)
      ? item.content
          .filter(
            (part): part is { type: "output_text"; text: string } => (
              part?.type === "output_text" && typeof part.text === "string"
            ),
          )
          .map((part) => ({ type: "output_text" as const, text: part.text }))
      : undefined;
    return {
      type: "message",
      id: typeof item.id === "string" ? item.id : undefined,
      content,
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
      arguments: normalizeOpenAIFunctionCallArguments(item.arguments),
      status: typeof item.status === "string" ? item.status : undefined,
    };
  }
  return null;
}

export function parseOpenAIResponseOutputItems(payload: unknown): OpenAIResponseOutputItem[] {
  if (!payload || typeof payload !== "object") return [];
  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return [];
  return output
    .map(normalizeOpenAIResponseOutputItem)
    .filter((item): item is OpenAIResponseOutputItem => item !== null);
}

export function collectOpenAIOutputText(outputItems: OpenAIResponseOutputItem[]): string | null {
  const text = outputItems
    .filter((item): item is OpenAIMessageOutputItem => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

export function collectOpenAIThinking(outputItems: OpenAIResponseOutputItem[]): string | null {
  const thinking = outputItems
    .filter((item): item is OpenAIReasoningOutputItem => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .filter((part) => part.type === "summary_text")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return thinking || null;
}

export function buildOpenAIReasoningConfig(
  provider: Pick<ProviderConfiguration, "model" | "reasoning_effort">,
): { effort: OpenAIReasoningEffort; summary: string } | null {
  const effort = normalizeOpenAIReasoningEffort(provider.reasoning_effort, provider.model);
  return effort ? { effort, summary: OPENAI_REASONING_SUMMARY } : null;
}

export function parseOpenAIResponseResult(payload: unknown): ProviderTextResult | null {
  if (!payload || typeof payload !== "object") return null;
  const outputItems = parseOpenAIResponseOutputItems(payload);
  const outputText = (payload as { output_text?: string | null }).output_text;
  const content = collectOpenAIOutputText(outputItems)
    ?? (typeof outputText === "string" ? outputText.trim() : null);
  const thinking = collectOpenAIThinking(outputItems);
  if (!content && !thinking) return null;
  return { content: content ?? "", thinking };
}

export function parseOpenAIContent(payload: unknown): string | null {
  const responseResult = parseOpenAIResponseResult(payload);
  if (responseResult?.content) return responseResult.content;
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  }).choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

export function parseAnthropicContent(payload: unknown): ProviderTextResult | null {
  if (!payload || typeof payload !== "object") return null;
  const blocks = (payload as {
    content?: Array<{ type?: string; text?: string; thinking?: string }>;
  }).content ?? [];
  const content = blocks
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n");
  const thinking = blocks
    .filter((part) => part?.type === "thinking" && typeof part.thinking === "string")
    .map((part) => part.thinking?.trim())
    .filter(Boolean)
    .join("\n");
  return content ? { content, thinking: thinking || null } : null;
}

export function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
