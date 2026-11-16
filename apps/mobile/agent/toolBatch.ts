import { agentToolEffect } from "./toolDefinitions";
import { createToolBatchMeasurement, type ToolBatchDiagnostics } from "./toolBatchDiagnostics";

export const MAX_CONCURRENT_TOOL_READS = 4;

/** Writes and unknown tools are barriers. Only consecutive, known reads overlap.
 * The caller prepares call identities in provider order before starting work.
 * A fatal failure stops new reads and waits for the ones already in flight;
 * the turn must never finish while an earlier batch is still executing.
 */
export async function executeToolBatch<T extends { name: string }, R>(
  calls: readonly T[],
  execute: (call: T, index: number) => Promise<R>,
  maxConcurrentReads = MAX_CONCURRENT_TOOL_READS,
  diagnostics?: ToolBatchDiagnostics,
): Promise<R[]> {
  if (!Number.isInteger(maxConcurrentReads) || maxConcurrentReads < 1
    || maxConcurrentReads > MAX_CONCURRENT_TOOL_READS) {
    throw new Error("Invalid tool read concurrency.");
  }
  const results = new Array<R>(calls.length);
  const measurement = diagnostics
    ? createToolBatchMeasurement(maxConcurrentReads, calls.length, diagnostics)
    : undefined;
  const run = measurement
    ? (call: T, index: number) => measurement.execute(call, index, execute)
    : execute;
  let outcome: "returned" | "threw" = "threw";
  let start = 0;
  try {
    while (start < calls.length) {
      if (agentToolEffect(calls[start].name) !== "read") {
        results[start] = await run(calls[start], start);
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < calls.length && agentToolEffect(calls[end].name) === "read") end += 1;
      let next = start;
      let failed = false;
      const errors: Array<{ index: number; error: unknown }> = [];
      const worker = async () => {
        while (!failed && next < end) {
          const index = next++;
          try {
            results[index] = await run(calls[index], index);
          } catch (error) {
            failed = true;
            errors.push({ index, error });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(maxConcurrentReads, end - start) }, worker));
      if (errors.length) {
        errors.sort((left, right) => left.index - right.index);
        throw errors[0].error;
      }
      start = end;
    }
    outcome = "returned";
    return results;
  } finally {
    measurement?.finish(outcome);
  }
}
