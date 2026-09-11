import { type GoogleInteractionTurn, type GoogleStep } from "./googleInteractions";
import { canonicalToolJson } from "./toolOperationLedger";
import {
  toolCallOccurrenceKey,
  type ToolCallEnvelope,
} from "./toolOperationLedger";

export const MAX_TOOL_ROUNDS = 10;

export async function runGoogleToolLoop(input: {
  initialTurn: GoogleInteractionTurn;
  initialMessages: GoogleStep[];
  requestNextTurn: (messages: GoogleStep[]) => Promise<GoogleInteractionTurn>;
  executeTool: ExecuteTool;
  executionId?: string;
  maxRounds?: number;
}): Promise<GoogleInteractionTurn & {
  history: GoogleStep[];
  interactions: Array<{ id: string; usage: Record<string, unknown> }>;
}> {
  let turn = input.initialTurn;
  const messages: GoogleStep[] = JSON.parse(JSON.stringify(input.initialMessages));
  const history: GoogleStep[] = [];
  const interactions: Array<{ id: string; usage: Record<string, unknown> }> = [];
  const seenInteractions = new Map<string, string>();
  const seenCallIds = new Set<string>();
  const occurrences = new Map<string, number>();
  for (let round = 0; ; round += 1) {
    const identity = canonicalToolJson({ status: turn.status, steps: turn.steps });
    const previous = seenInteractions.get(turn.interactionId);
    if (previous !== undefined && previous !== identity) {
      throw new Error("Google Interactions: identidad de interacción contradictoria.");
    }
    if (previous === undefined) {
      // A new round cannot reuse an identity already committed in this history.
      for (const step of turn.steps) {
        if (step.type !== "function_call") continue;
        if (seenCallIds.has(step.id)) {
          throw new Error("Google Interactions: ID de herramienta repetido entre rondas.");
        }
        seenCallIds.add(step.id);
      }
      seenInteractions.set(turn.interactionId, identity);
      interactions.push({ id: turn.interactionId, usage: turn.usage });
      history.push(...turn.steps);
      messages.push(...turn.steps);
    }
    if (turn.status === "completed") return { ...turn, history, interactions };
    if (round >= (input.maxRounds ?? MAX_TOOL_ROUNDS)) {
      throw new Error("Google Interactions: la respuesta sigue pendiente de herramientas al alcanzar el límite de rondas.");
    }
    // Replaying an entire round reuses its results, without new occurrences/effects.
    if (previous === undefined) {
      for (const call of turn.steps) {
        if (call.type !== "function_call") continue;
        const result = await input.executeTool(call.name, call.arguments, {
          executionId: input.executionId ?? "legacy-execution",
          provider: "google", providerCallId: call.id, name: call.name, args: call.arguments,
          occurrence: nextOccurrence(occurrences, call.name, call.arguments),
        });
        const output: GoogleStep = { type: "function_result", name: call.name, call_id: call.id,
          result: [{ type: "text", text: result }] };
        history.push(output);
        messages.push(output);
      }
    }
    // A caller must not mutate the committed snapshot used by future rounds.
    turn = await input.requestNextTurn(JSON.parse(JSON.stringify(messages)) as GoogleStep[]);
  }
}

export type ExecuteTool = (
  name: string,
  args: Record<string, unknown>,
  call: ToolCallEnvelope,
) => Promise<string>;

function nextOccurrence(
  occurrences: Map<string, number>,
  name: string,
  args: Record<string, unknown>,
): number {
  const key = toolCallOccurrenceKey(name, args);
  const occurrence = occurrences.get(key) ?? 0;
  occurrences.set(key, occurrence + 1);
  return occurrence;
}

export type OpenAIFunctionCall = {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
  status?: string;
};

export type OpenAIToolTurn = {
  responseId: string | null;
  outputItems: Array<{ type: string } | OpenAIFunctionCall>;
};

export function parseOpenAIFunctionArguments(rawArguments: string): Record<string, unknown> {
  const trimmed = rawArguments.trim();
  if (!trimmed) return {};
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runOpenAIToolLoop<TTurn extends OpenAIToolTurn>(input: {
  initialTurn: TTurn;
  requestNextTurn: (
    outputs: Array<Record<string, unknown>>,
    previousResponseId: string,
  ) => Promise<TTurn>;
  executeTool: ExecuteTool;
  executionId?: string;
  maxRounds?: number;
}): Promise<TTurn> {
  let turn = input.initialTurn;
  const occurrences = new Map<string, number>();
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    const toolCalls = turn.outputItems.filter(
      (item): item is OpenAIFunctionCall => item.type === "function_call",
    );
    if (toolCalls.length === 0) break;
    if (!turn.responseId) {
      throw new Error("OpenAI no devolvio response_id para continuar las herramientas.");
    }
    const outputs: Array<Record<string, unknown>> = [];
    for (const toolCall of toolCalls) {
      const args = parseOpenAIFunctionArguments(toolCall.arguments);
      const result = await input.executeTool(
        toolCall.name,
        args,
        {
          executionId: input.executionId ?? "legacy-execution",
          provider: "openai",
          providerCallId: toolCall.call_id,
          name: toolCall.name,
          args,
          occurrence: nextOccurrence(occurrences, toolCall.name, args),
        },
      );
      outputs.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: result,
      });
    }
    turn = await input.requestNextTurn(outputs, turn.responseId);
  }
  return turn;
}

export type AnthropicTextBlock = { type: "text"; text: string };
export type AnthropicThinkingBlock = {
  type: "thinking";
  thinking: string;
  signature?: string;
};
export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
  partial_json?: string;
};
export type AnthropicResponseBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicToolUseBlock;

export type AnthropicToolTurn = {
  contentBlocks: AnthropicResponseBlock[];
};

export async function runAnthropicToolLoop<TTurn extends AnthropicToolTurn>(input: {
  initialTurn: TTurn;
  initialMessages: Array<Record<string, unknown>>;
  requestNextTurn: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  executeTool: ExecuteTool;
  executionId?: string;
  maxRounds?: number;
}): Promise<TTurn> {
  let turn = input.initialTurn;
  let messages = [...input.initialMessages];
  const occurrences = new Map<string, number>();
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    const toolCalls = turn.contentBlocks.filter(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use",
    );
    if (toolCalls.length === 0) break;
    const toolResults: Array<Record<string, unknown>> = [];
    for (const toolCall of toolCalls) {
      const args = toolCall.input ?? {};
      const result = await input.executeTool(toolCall.name, args, {
        executionId: input.executionId ?? "legacy-execution",
        provider: "anthropic",
        providerCallId: toolCall.id,
        name: toolCall.name,
        args,
        occurrence: nextOccurrence(occurrences, toolCall.name, args),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolCall.id,
        content: result,
      });
    }
    messages = [
      ...messages,
      { role: "assistant", content: turn.contentBlocks },
      { role: "user", content: toolResults },
    ];
    turn = await input.requestNextTurn(messages);
  }
  return turn;
}
