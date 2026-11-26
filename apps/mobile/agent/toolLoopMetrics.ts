import { ROUND_LIMIT_TOOL_RESULT, ToolRoundLimitError } from "./providerToolLoop";
import { agentToolEffect } from "./toolDefinitions";
import { parseToolError } from "./toolErrors";

/**
 * Medidas del bucle ReAct del Coach: cuántas vueltas da, cuánto crece la
 * conversación, cuántos tokens gasta y si las llamadas a tools salieron bien.
 *
 * Privacidad: los eventos solo llevan números, nombres canónicos de tools y
 * códigos de error fijos de la app. Nunca argumentos, resultados, texto del
 * usuario o del modelo, IDs del proveedor ni nombres de tool inventados por el
 * modelo (esos se registran como "unknown").
 *
 * Se mide en la frontera de cada petición al proveedor: el turno devuelto dice
 * qué tools pidió el modelo, y la conversación de la petición siguiente trae sus
 * resultados. Así los bucles no cambian y lo que se envía al proveedor tampoco.
 */

export type ToolLoopProvider = "openai" | "anthropic" | "google" | "custom_openai";

export type ToolLoopCallOutcome =
  /** La tool devolvió un resultado normal. */
  | "ok"
  /** La tool devolvió un error estructurado (argumentos inválidos, lectura repetida...). */
  | "error"
  /** No se ejecutó porque se agotaron las vueltas. */
  | "not_executed"
  /** El bucle terminó (por ejemplo, por un error) antes de que llegara su resultado. */
  | "unanswered";

export type ToolLoopCallMetric = {
  /** Nombre canónico, o "unknown" si el modelo pidió una tool que no existe. */
  toolName: string;
  effect: string;
  /** Si los argumentos llegaron como un objeto JSON legible. */
  argumentsParsed: boolean;
  outcome: ToolLoopCallOutcome;
  /** Código de error de la app (por ejemplo, "invalid_tool_arguments"). */
  errorCode: string | null;
  /** Número de problemas de validación, sin su texto. */
  issueCount: number | null;
};

export type ToolLoopRoundMetric = {
  /** 0 es la primera petición del turno. */
  round: number;
  /** Llamada de cierre tras agotar las vueltas, con las tools prohibidas. */
  closing: boolean;
  /** Tamaño en caracteres de la conversación enviada (sin instrucciones ni catálogo de tools). */
  contextChars: number;
  contextMessages: number;
  /** null si el proveedor no informa del uso. */
  inputTokens: number | null;
  outputTokens: number | null;
  providerMs: number;
  calls: ToolLoopCallMetric[];
};

export type ToolLoopOutcome = "answered" | "round_limit" | "error";

export type ToolLoopTraceEvent =
  | ({ phase: "round"; loopId: string; provider: ToolLoopProvider } & ToolLoopRoundMetric)
  | {
    phase: "loop_finished";
    loopId: string;
    provider: ToolLoopProvider;
    outcome: ToolLoopOutcome;
    rounds: number;
    toolCalls: number;
    failedCalls: number;
    inputTokens: number | null;
    outputTokens: number | null;
    finalContextChars: number;
    durationMs: number;
  };

export type ToolLoopDiagnostics = {
  onEvent: (event: ToolLoopTraceEvent) => void;
  /** Reloj monotónico inyectable para pruebas deterministas. */
  now?: () => number;
};

export type TokenUsage = { inputTokens: number | null; outputTokens: number | null };

type RequestedCall = { id: string; name: string; argumentsParsed: boolean };
type CallResult = { output: string; isError: boolean };

type ProviderAdapter = {
  calls: (turn: unknown) => RequestedCall[];
  results: (messages: unknown[]) => Map<string, CallResult>;
  usage: (turn: unknown) => TokenUsage;
};

const ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function tokenCount(...values: unknown[]): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) total = (total ?? 0) + value;
  }
  return total;
}

function parsesAsObject(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw.trim()) return false;
  try {
    return record(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
}

function turnUsage(turn: unknown): TokenUsage {
  const usage = record(record(turn)?.usage);
  return {
    inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : null,
    outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : null,
  };
}

const ADAPTERS: Record<ToolLoopProvider, ProviderAdapter> = {
  openai: {
    calls: (turn) => list(record(turn)?.outputItems).flatMap((item) => {
      const call = record(item);
      if (call?.type !== "function_call" || typeof call.call_id !== "string") return [];
      return [{ id: call.call_id, name: String(call.name ?? ""), argumentsParsed: parsesAsObject(call.arguments) }];
    }),
    results: (messages) => new Map(messages.flatMap((item) => {
      const output = record(item);
      if (output?.type !== "function_call_output" || typeof output.call_id !== "string") return [];
      return [[output.call_id, { output: String(output.output ?? ""), isError: false }] as const];
    })),
    usage: turnUsage,
  },
  custom_openai: {
    calls: (turn) => list(record(turn)?.toolCalls).flatMap((item) => {
      const call = record(item);
      const fn = record(call?.function);
      if (!call || typeof call.id !== "string" || !fn) return [];
      return [{ id: call.id, name: String(fn.name ?? ""), argumentsParsed: parsesAsObject(fn.arguments) }];
    }),
    results: (messages) => new Map(messages.flatMap((item) => {
      const message = record(item);
      if (message?.role !== "tool" || typeof message.tool_call_id !== "string") return [];
      return [[message.tool_call_id, { output: String(message.content ?? ""), isError: false }] as const];
    })),
    usage: turnUsage,
  },
  anthropic: {
    calls: (turn) => list(record(turn)?.contentBlocks).flatMap((item) => {
      const block = record(item);
      if (block?.type !== "tool_use" || typeof block.id !== "string") return [];
      return [{ id: block.id, name: String(block.name ?? ""), argumentsParsed: record(block.input) !== null }];
    }),
    results: (messages) => new Map(messages.flatMap((item) => {
      const message = record(item);
      if (message?.role !== "user") return [];
      return list(message.content).flatMap((part) => {
        const result = record(part);
        if (result?.type !== "tool_result" || typeof result.tool_use_id !== "string") return [];
        return [[result.tool_use_id, {
          output: typeof result.content === "string" ? result.content : "",
          isError: result.is_error === true,
        }] as const];
      });
    })),
    usage: turnUsage,
  },
  google: {
    calls: (turn) => list(record(turn)?.steps).flatMap((item) => {
      const step = record(item);
      if (step?.type !== "function_call" || typeof step.id !== "string") return [];
      return [{ id: step.id, name: String(step.name ?? ""), argumentsParsed: record(step.arguments) !== null }];
    }),
    results: (messages) => new Map(messages.flatMap((item) => {
      const step = record(item);
      if (step?.type !== "function_result" || typeof step.call_id !== "string") return [];
      const text = list(step.result).map((part) => record(part)?.text).find((value) => typeof value === "string");
      return [[step.call_id, { output: typeof text === "string" ? text : "", isError: step.is_error === true }] as const];
    })),
    // Google Interactions informa del uso en un objeto propio, con claves totales.
    usage: (turn) => {
      const usage = record(record(turn)?.usage);
      return {
        inputTokens: tokenCount(usage?.total_input_tokens ?? usage?.input_tokens),
        outputTokens: tokenCount(usage?.total_output_tokens ?? usage?.output_tokens),
      };
    },
  },
};

function callMetric(call: RequestedCall, result: CallResult | undefined): ToolLoopCallMetric {
  const effect = agentToolEffect(call.name);
  const base = {
    toolName: effect ? call.name : "unknown",
    effect: effect ?? "unknown",
    argumentsParsed: call.argumentsParsed,
  };
  if (!result) return { ...base, outcome: "unanswered", errorCode: null, issueCount: null };
  if (result.output === ROUND_LIMIT_TOOL_RESULT) {
    return { ...base, outcome: "not_executed", errorCode: null, issueCount: null };
  }
  const error = parseToolError(result.output);
  if (!error) {
    return result.isError
      ? { ...base, outcome: "error", errorCode: null, issueCount: null }
      : { ...base, outcome: "ok", errorCode: null, issueCount: null };
  }
  const issues = (error as Record<string, unknown>).issues;
  return {
    ...base,
    outcome: "error",
    errorCode: ERROR_CODE.test(error.error) ? error.error : "unrecognized",
    issueCount: Array.isArray(issues) ? issues.length : null,
  };
}

function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

let nextLoopId = 0;

export type ToolLoopMeasurement = {
  /** Envuelve una petición al proveedor con la conversación que se le envía. */
  request<T>(messages: readonly unknown[], closing: boolean, send: () => Promise<T>): Promise<T>;
  /** Cierra la medida. Sin error, el turno respondió (o cerró tras agotar las vueltas). */
  finish(error?: unknown): void;
};

export function createToolLoopMeasurement(
  provider: ToolLoopProvider,
  diagnostics: ToolLoopDiagnostics,
): ToolLoopMeasurement {
  const adapter = ADAPTERS[provider];
  const loopId = `${Date.now()}-${++nextLoopId}`;
  const now = diagnostics.now ?? monotonicNow;
  const startedAt = now();
  let pending: { metric: ToolLoopRoundMetric; requested: RequestedCall[] } | null = null;
  let rounds = 0;
  let toolCalls = 0;
  let failedCalls = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let finalContextChars = 0;
  let sawClosing = false;
  let finished = false;

  const emit = (event: ToolLoopTraceEvent) => {
    try {
      diagnostics.onEvent(event);
    } catch {
      // Un sumidero de diagnóstico roto no puede cambiar el chat.
    }
  };

  const flush = (resultsFrom: readonly unknown[] | null) => {
    if (!pending) return;
    const current = pending;
    pending = null;
    let results = new Map<string, CallResult>();
    try {
      if (resultsFrom) results = adapter.results([...resultsFrom]);
    } catch {
      // Sin resultados legibles, las llamadas quedan como "unanswered".
    }
    const calls = current.requested.map((call) => callMetric(call, results.get(call.id)));
    toolCalls += calls.length;
    failedCalls += calls.filter((call) => call.outcome === "error").length;
    emit({ phase: "round", loopId, provider, ...current.metric, calls });
  };

  return {
    async request(messages, closing, send) {
      if (finished) return send();
      flush(messages);
      let contextChars = 0;
      try {
        contextChars = JSON.stringify(messages).length;
      } catch {
        // Una conversación no serializable no se mide, pero se envía igual.
      }
      const requestedAt = now();
      const turn = await send();
      try {
        const usage = adapter.usage(turn);
        if (usage.inputTokens !== null) inputTokens = (inputTokens ?? 0) + usage.inputTokens;
        if (usage.outputTokens !== null) outputTokens = (outputTokens ?? 0) + usage.outputTokens;
        if (closing) sawClosing = true;
        finalContextChars = contextChars;
        pending = {
          metric: {
            round: rounds,
            closing,
            contextChars,
            contextMessages: messages.length,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            providerMs: Math.max(0, now() - requestedAt),
            calls: [],
          },
          requested: adapter.calls(turn),
        };
        rounds += 1;
      } catch {
        // Medir nunca puede romper el turno.
      }
      return turn;
    },
    finish(error) {
      if (finished) return;
      finished = true;
      flush(null);
      const outcome: ToolLoopOutcome = error === undefined
        ? sawClosing ? "round_limit" : "answered"
        : error instanceof ToolRoundLimitError ? "round_limit" : "error";
      emit({
        phase: "loop_finished", loopId, provider, outcome, rounds, toolCalls, failedCalls,
        inputTokens, outputTokens, finalContextChars, durationMs: Math.max(0, now() - startedAt),
      });
    },
  };
}
