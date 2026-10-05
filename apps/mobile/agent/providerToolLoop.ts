import { type GoogleFunctionCall, type GoogleInteractionTurn, type GoogleStep } from "./googleInteractions";
import { canonicalToolJson } from "./toolOperationLedger";
import { agentToolEffect, formatToolInputError } from "./toolDefinitions";
import { checkToolResult, toolFailure, ToolTurnError, type ToolResult } from "./toolErrors";
import { executeToolBatch } from "./toolBatch";
import type { ToolBatchDiagnostics } from "./toolBatchDiagnostics";
import { ToolOperationIndeterminateError } from "./toolOperationLedger";
import {
  toolCallOccurrenceKey,
  type ToolCallEnvelope,
} from "./toolOperationLedger";

export const MAX_TOOL_ROUNDS = 10;

// Resultado que recibe el modelo por cada tool que pidió cuando ya no quedaban
// rondas. No se ejecuta nada y el texto solo informa del hecho, para que el modelo
// no afirme haber hecho algo que no hizo.
export const ROUND_LIMIT_TOOL_RESULT =
  "No ejecutada: se alcanzó el límite de pasos que el asistente puede dar en una sola respuesta.";

// Qué debe hacer el modelo en la llamada de cierre. Va en las instrucciones de
// sistema de esa llamada, no en el resultado de la tool: probado contra OpenAI,
// un resultado de tool se trata como dato y la instrucción se ignoraba. El tope
// cuenta por mensaje, así que si el usuario dice que sí hay rondas nuevas.
export const ROUND_LIMIT_CLOSING_INSTRUCTION =
  "Has llegado al límite de pasos de esta respuesta: las tools siguen disponibles, "
  + "pero no ahora. Responde al usuario con la información que ya tienes, explícale "
  + "que has llegado a ese límite y qué ha quedado sin hacer, y termina preguntándole "
  + "si quiere que continúes.";

/** Instrucciones de sistema de la llamada de cierre. */
export function closingSystemPrompt(systemPrompt: string): string {
  return systemPrompt
    ? `${systemPrompt}\n\n${ROUND_LIMIT_CLOSING_INSTRUCTION}`
    : ROUND_LIMIT_CLOSING_INSTRUCTION;
}

export const ROUND_LIMIT_USER_MESSAGE =
  "Esta consulta necesitaba más pasos de los que el asistente puede dar en una sola "
  + "respuesta. Prueba a dividirla en preguntas más pequeñas.";

/** El bucle agotó sus rondas y la llamada de cierre no produjo una respuesta. */
export class ToolRoundLimitError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(ROUND_LIMIT_USER_MESSAGE);
    this.name = "ToolRoundLimitError";
    if (options && "cause" in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

/** Marca que acompaña al turno final cuando se llegó a él por agotar las rondas. */
export type RoundLimitMarker = { roundLimitReached?: boolean };

async function requestClosing<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw new ToolRoundLimitError({ cause: error });
  }
}

export async function runGoogleToolLoop(input: {
  initialTurn: GoogleInteractionTurn;
  initialMessages: GoogleStep[];
  requestNextTurn: (messages: GoogleStep[]) => Promise<GoogleInteractionTurn>;
  /** Pide un turno con las tools prohibidas. Sin él, agotar las rondas es un error. */
  requestClosingTurn?: (messages: GoogleStep[]) => Promise<GoogleInteractionTurn>;
  executeTool: ExecuteTool;
  toolBatchDiagnostics?: ToolBatchDiagnostics;
  executionId?: string;
  maxRounds?: number;
}): Promise<GoogleInteractionTurn & RoundLimitMarker & {
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
    // Con store:false Google usa "" como ID, así que solo los IDs no vacíos
    // pueden identificar un replay entre rondas.
    const previous = turn.interactionId ? seenInteractions.get(turn.interactionId) : undefined;
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
      if (turn.interactionId) seenInteractions.set(turn.interactionId, identity);
      interactions.push({ id: turn.interactionId, usage: turn.usage });
      history.push(...turn.steps);
      messages.push(...turn.steps);
    }
    if (turn.status === "completed") return { ...turn, history, interactions };
    if (round >= (input.maxRounds ?? MAX_TOOL_ROUNDS)) {
      if (!input.requestClosingTurn) throw new ToolRoundLimitError();
      const answered = new Set(messages.flatMap((step) =>
        step.type === "function_result" ? [step.call_id] : []));
      for (const call of turn.steps) {
        if (call.type !== "function_call" || answered.has(call.id)) continue;
        const output: GoogleStep = { type: "function_result", name: call.name, call_id: call.id,
          result: [{ type: "text", text: ROUND_LIMIT_TOOL_RESULT }] };
        history.push(output);
        messages.push(output);
      }
      const requestClosingTurn = input.requestClosingTurn;
      const closing = await requestClosing(() =>
        requestClosingTurn(JSON.parse(JSON.stringify(messages)) as GoogleStep[]));
      if (closing.status !== "completed") throw new ToolRoundLimitError();
      interactions.push({ id: closing.interactionId, usage: closing.usage });
      history.push(...closing.steps);
      return { ...closing, history, interactions, roundLimitReached: true };
    }
    // Replaying an entire round reuses its results, without new occurrences/effects.
    if (previous === undefined) {
      const calls = turn.steps.filter((step): step is GoogleFunctionCall => step.type === "function_call")
        .map((call) => ({ ...call, envelope: {
          executionId: input.executionId ?? "legacy-execution",
          provider: "google" as const, providerCallId: call.id, name: call.name, args: call.arguments,
          occurrence: nextOccurrence(occurrences, call.name, call.arguments),
        } }));
      const results = await executeToolBatch(calls, (call) =>
        executeToolSafely(input.executeTool, call.name, call.arguments, call.envelope), 1, input.toolBatchDiagnostics);
      const outputs: GoogleStep[] = calls.map((call, index) => ({
        type: "function_result", name: call.name, call_id: call.id,
        result: [{ type: "text", text: results[index].output }],
        ...(results[index].isError ? { is_error: true } : {}),
      }));
      history.push(...outputs);
      messages.push(...outputs);
    }
    // A caller must not mutate the committed snapshot used by future rounds.
    turn = await input.requestNextTurn(JSON.parse(JSON.stringify(messages)) as GoogleStep[]);
  }
}

export type ExecuteTool = (
  name: string,
  args: Record<string, unknown>,
  call: ToolCallEnvelope,
) => Promise<string | ToolResult>;

/** Catch failures outside handlers too (authorization, storage coordinator).
 * An unexpected write failure has unknown effects: never invite a blind retry.
 * Raw exception text may contain secrets and must not reach the model or user.
 */
export async function executeToolSafely(
  execute: ExecuteTool,
  name: string,
  args: Record<string, unknown>,
  call: ToolCallEnvelope,
): Promise<ToolResult> {
  let output: string | ToolResult;
  try {
    output = await execute(name, args, call);
  } catch (error) {
    if (error instanceof ToolTurnError || error instanceof ToolOperationIndeterminateError) throw error;
    if (agentToolEffect(name) !== "read") throw new ToolOperationIndeterminateError();
    output = toolFailure("tool_execution_failed",
      "La lectura ha fallado. No interpretes este error como un dato. Puedes consultar otra fuente o explicar al usuario que no se pudo obtener la información.",
      "choose_alternative");
  }
  return checkToolResult(output);
}

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
  responseId?: string | null;
  truncated?: boolean;
  outputItems: Array<{ type: string } | OpenAIFunctionCall>;
};

function copyOpenAIInput(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(items)) as Array<Record<string, unknown>>;
}

export function parseOpenAIFunctionArguments(rawArguments: string): Record<string, unknown> | null {
  const trimmed = rawArguments.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function runOpenAIToolLoop<TTurn extends OpenAIToolTurn>(input: {
  initialTurn: TTurn;
  /** Historial elegido antes de la consulta; la secuencia activa nunca se recorta. */
  initialInput: Array<Record<string, unknown>>;
  requestNextTurn: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  /** Pide un turno con las tools prohibidas. Sin él, agotar las rondas es un error. */
  requestClosingTurn?: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  executeTool: ExecuteTool;
  toolBatchDiagnostics?: ToolBatchDiagnostics;
  executionId?: string;
  maxRounds?: number;
}): Promise<TTurn & RoundLimitMarker> {
  let turn = input.initialTurn;
  const occurrences = new Map<string, number>();
  const seenCallIds = new Set<string>();
  const selectedHistory = copyOpenAIInput(input.initialInput);
  const activeItems: Array<Record<string, unknown>> = [];
  const currentInput = () => copyOpenAIInput([...selectedHistory, ...activeItems]);
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    if (turn.truncated) {
      throw new Error("La respuesta de OpenAI se cortó antes de completarse. Vuelve a intentarlo.");
    }
    const toolCalls = turn.outputItems.filter(
      (item): item is OpenAIFunctionCall => item.type === "function_call",
    );
    if (toolCalls.length === 0) break;
    // Validate the complete round before executing any tool or committing its replay.
    const ids = toolCalls.map((call) => call.call_id);
    if (new Set(ids).size !== ids.length || ids.some((id) => seenCallIds.has(id))) {
      throw new Error("OpenAI devolvió un identificador de herramienta repetido.");
    }
    ids.forEach((id) => seenCallIds.add(id));
    activeItems.push(...copyOpenAIInput(turn.outputItems as Array<Record<string, unknown>>));
    // Assign occurrences before execution: completion order never changes identity.
    const calls = toolCalls.map((call) => {
      const args = parseOpenAIFunctionArguments(call.arguments);
      return { ...call, args, envelope: args === null ? null : {
        executionId: input.executionId ?? "legacy-execution",
        provider: "openai" as const, providerCallId: call.call_id, name: call.name, args,
        occurrence: nextOccurrence(occurrences, call.name, args),
      } };
    });
    const results = await executeToolBatch(calls, async (call) =>
      call.envelope === null
        ? { output: formatToolInputError(["Los argumentos deben ser un objeto JSON válido."]), isError: true }
        : executeToolSafely(input.executeTool, call.name, call.envelope.args, call.envelope), 1, input.toolBatchDiagnostics);
    activeItems.push(...calls.map((call, index) => ({
      type: "function_call_output", call_id: call.call_id, output: results[index].output,
    })));
    turn = await input.requestNextTurn(currentInput());
  }
  if (turn.truncated) {
    throw new Error("La respuesta de OpenAI se cortó antes de completarse. Vuelve a intentarlo.");
  }
  const pending = turn.outputItems.filter(
    (item): item is OpenAIFunctionCall => item.type === "function_call",
  );
  if (pending.length === 0) return turn;
  if (!input.requestClosingTurn) throw new ToolRoundLimitError();
  const requestClosingTurn = input.requestClosingTurn;
  const ids = pending.map((call) => call.call_id);
  if (new Set(ids).size !== ids.length || ids.some((id) => seenCallIds.has(id))) {
    throw new ToolRoundLimitError();
  }
  activeItems.push(...copyOpenAIInput(turn.outputItems as Array<Record<string, unknown>>));
  activeItems.push(...pending.map((toolCall) => ({
    type: "function_call_output",
    call_id: toolCall.call_id,
    output: ROUND_LIMIT_TOOL_RESULT,
  })));
  const closing = await requestClosing(() => requestClosingTurn(currentInput()));
  if (closing.truncated || closing.outputItems.some((item) => item.type === "function_call")) {
    throw new ToolRoundLimitError();
  }
  return { ...closing, roundLimitReached: true };
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
  truncated?: boolean;
  contentBlocks: AnthropicResponseBlock[];
};

export async function runAnthropicToolLoop<TTurn extends AnthropicToolTurn>(input: {
  initialTurn: TTurn;
  initialMessages: Array<Record<string, unknown>>;
  requestNextTurn: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  /** Pide un turno con las tools prohibidas. Sin él, agotar las rondas es un error. */
  requestClosingTurn?: (messages: Array<Record<string, unknown>>) => Promise<TTurn>;
  executeTool: ExecuteTool;
  toolBatchDiagnostics?: ToolBatchDiagnostics;
  executionId?: string;
  maxRounds?: number;
}): Promise<TTurn & RoundLimitMarker> {
  let turn = input.initialTurn;
  let messages = [...input.initialMessages];
  const occurrences = new Map<string, number>();
  const maxRounds = input.maxRounds ?? MAX_TOOL_ROUNDS;
  for (let round = 0; round < maxRounds; round += 1) {
    if (turn.truncated) {
      throw new Error("La respuesta de Anthropic se cortó antes de completarse. Vuelve a intentarlo.");
    }
    const toolCalls = turn.contentBlocks.filter(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use",
    );
    if (toolCalls.length === 0) break;
    const calls = toolCalls.map((call) => {
      const args = call.input ?? {};
      return { ...call, envelope: {
        executionId: input.executionId ?? "legacy-execution",
        provider: "anthropic" as const, providerCallId: call.id, name: call.name, args,
        occurrence: nextOccurrence(occurrences, call.name, args),
      } };
    });
    const results = await executeToolBatch(calls, (call) =>
      executeToolSafely(input.executeTool, call.name, call.envelope.args, call.envelope), 1, input.toolBatchDiagnostics);
    const toolResults = calls.map((call, index) => ({
      type: "tool_result", tool_use_id: call.id, content: results[index].output,
      ...(results[index].isError ? { is_error: true } : {}),
    }));
    messages = [
      ...messages,
      { role: "assistant", content: turn.contentBlocks },
      { role: "user", content: toolResults },
    ];
    turn = await input.requestNextTurn(messages);
  }
  const pending = turn.contentBlocks.filter(
    (block): block is AnthropicToolUseBlock => block.type === "tool_use",
  );
  if (pending.length === 0) return turn;
  if (turn.truncated) {
    throw new Error("La respuesta de Anthropic se cortó antes de completarse. Vuelve a intentarlo.");
  }
  if (!input.requestClosingTurn) throw new ToolRoundLimitError();
  const requestClosingTurn = input.requestClosingTurn;
  const closingMessages = [
    ...messages,
    { role: "assistant", content: turn.contentBlocks },
    {
      role: "user",
      content: pending.map((toolCall) => ({
        type: "tool_result",
        tool_use_id: toolCall.id,
        content: ROUND_LIMIT_TOOL_RESULT,
      })),
    },
  ];
  const closing = await requestClosing(() => requestClosingTurn(closingMessages));
  if (closing.truncated || closing.contentBlocks.some((block) => block.type === "tool_use")) {
    throw new ToolRoundLimitError();
  }
  return { ...closing, roundLimitReached: true };
}
