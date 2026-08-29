export const MAX_TOOL_ROUNDS = 10;

export type ExecuteTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string>;

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
  maxRounds?: number;
}): Promise<TTurn> {
  let turn = input.initialTurn;
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
      const result = await input.executeTool(
        toolCall.name,
        parseOpenAIFunctionArguments(toolCall.arguments),
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
  maxRounds?: number;
}): Promise<TTurn> {
  let turn = input.initialTurn;
  let messages = [...input.initialMessages];
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    const toolCalls = turn.contentBlocks.filter(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use",
    );
    if (toolCalls.length === 0) break;
    const toolResults: Array<Record<string, unknown>> = [];
    for (const toolCall of toolCalls) {
      const result = await input.executeTool(toolCall.name, toolCall.input ?? {});
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

export type GoogleFunctionCall = {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
};

export type GoogleResponsePart = {
  text?: string;
  functionCall?: GoogleFunctionCall;
  thought?: boolean;
  thoughtSignature?: string;
};

export type GoogleToolTurn = {
  modelParts: GoogleResponsePart[];
};

export function mapGoogleResponsePartToRequestPart(
  part: GoogleResponsePart,
): Record<string, unknown> | null {
  const nextPart: Record<string, unknown> = {};
  if (typeof part.text === "string") nextPart.text = part.text;
  if (part.functionCall) {
    nextPart.functionCall = {
      ...(typeof part.functionCall.id === "string" && part.functionCall.id.trim()
        ? { id: part.functionCall.id.trim() }
        : {}),
      name: part.functionCall.name,
      args: part.functionCall.args ?? {},
    };
  }
  if (part.thought === true) nextPart.thought = true;
  if (typeof part.thoughtSignature === "string" && part.thoughtSignature.trim()) {
    nextPart.thoughtSignature = part.thoughtSignature;
  }
  return Object.keys(nextPart).length > 0 ? nextPart : null;
}

export async function runGoogleToolLoop<TTurn extends GoogleToolTurn>(input: {
  initialTurn: TTurn;
  initialMessages: Array<Record<string, unknown>>;
  requestNextTurn: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  executeTool: ExecuteTool;
  maxRounds?: number;
}): Promise<TTurn> {
  let turn = input.initialTurn;
  const messages = [...input.initialMessages];
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    const toolCalls = turn.modelParts.filter(
      (part): part is GoogleResponsePart & { functionCall: GoogleFunctionCall } =>
        Boolean(part.functionCall?.name),
    );
    if (toolCalls.length === 0) break;
    const modelParts = turn.modelParts
      .map(mapGoogleResponsePartToRequestPart)
      .filter((part): part is Record<string, unknown> => Boolean(part));
    const responseParts: Array<Record<string, unknown>> = [];
    for (const part of toolCalls) {
      const functionCall = part.functionCall;
      const result = await input.executeTool(functionCall.name, functionCall.args ?? {});
      responseParts.push({
        functionResponse: {
          ...(typeof functionCall.id === "string" && functionCall.id.trim()
            ? { id: functionCall.id.trim() }
            : {}),
          name: functionCall.name,
          response: { result },
        },
      });
    }
    messages.push({ role: "model", parts: modelParts });
    messages.push({ role: "user", parts: responseParts });
    turn = await input.requestNextTurn(messages);
  }
  return turn;
}
