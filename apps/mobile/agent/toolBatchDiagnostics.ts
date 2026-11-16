import { agentToolEffect } from "./toolDefinitions";

type BatchTraceBase = { batchId: string };
type ToolTraceBase = BatchTraceBase & {
  index: number;
  toolName: string;
  effect: string;
  offsetMs: number;
};

export type ToolBatchTraceEvent =
  | (BatchTraceBase & { phase: "batch_started"; toolCount: number; maxConcurrentReads: number })
  | (ToolTraceBase & { phase: "tool_started" })
  | (ToolTraceBase & { phase: "tool_finished"; durationMs: number; outcome: "returned" | "threw" })
  | (BatchTraceBase & {
    phase: "batch_finished";
    durationMs: number;
    totalToolDurationMs: number;
    startedCount: number;
    returnedCount: number;
    thrownCount: number;
    peakActiveTools: number;
    outcome: "returned" | "threw";
  });

export type ToolBatchDiagnostics = {
  onEvent: (event: ToolBatchTraceEvent) => void;
  /** Injectable monotonic clock for deterministic tests. */
  now?: () => number;
};

let nextBatchId = 0;

function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/** Diagnostics never receive arguments, provider IDs, results or exception text. */
export function createToolBatchMeasurement(
  maxConcurrentReads: number,
  toolCount: number,
  diagnostics: ToolBatchDiagnostics,
) {
  const batchId = `${Date.now()}-${++nextBatchId}`;
  const now = diagnostics.now ?? monotonicNow;
  const startedAt = now();
  let startedCount = 0;
  let returnedCount = 0;
  let thrownCount = 0;
  let active = 0;
  let peakActiveTools = 0;
  let totalToolDurationMs = 0;
  const emit = (event: ToolBatchTraceEvent) => {
    try {
      diagnostics.onEvent(event);
    } catch {
      // A broken local diagnostic sink must not change tool execution.
    }
  };
  emit({ phase: "batch_started", batchId, toolCount, maxConcurrentReads });

  return {
    async execute<T extends { name: string }, R>(
      call: T,
      index: number,
      execute: (call: T, index: number) => Promise<R>,
    ): Promise<R> {
      const toolStartedAt = now();
      const effect = agentToolEffect(call.name);
      const identity = { batchId, index, toolName: effect ? call.name : "unknown", effect: effect ?? "unknown" };
      startedCount += 1;
      active += 1;
      peakActiveTools = Math.max(peakActiveTools, active);
      emit({ ...identity, phase: "tool_started", offsetMs: Math.max(0, toolStartedAt - startedAt) });
      let outcome: "returned" | "threw" = "threw";
      try {
        const result = await execute(call, index);
        returnedCount += 1;
        outcome = "returned";
        return result;
      } finally {
        const endedAt = now();
        const durationMs = Math.max(0, endedAt - toolStartedAt);
        active -= 1;
        if (outcome === "threw") thrownCount += 1;
        totalToolDurationMs += durationMs;
        emit({ ...identity, phase: "tool_finished", offsetMs: Math.max(0, endedAt - startedAt), durationMs, outcome });
      }
    },
    finish(outcome: "returned" | "threw") {
      emit({ phase: "batch_finished", batchId, durationMs: Math.max(0, now() - startedAt),
        totalToolDurationMs, startedCount, returnedCount, thrownCount, peakActiveTools, outcome });
    },
  };
}
