/** Shared error payload, carried as text so it also survives operation replay.
 * Success outputs keep their existing format. Errors are explicit, never inferred
 * from prose or arbitrary JSON fields in a successful result.
 */
export type ToolRecovery = "correct_arguments" | "choose_alternative" | "stop_turn";

export type ToolErrorPayload = {
  kind: "tool_error";
  version: 1;
  is_error: true;
  error: string;
  message: string;
  recovery: ToolRecovery;
  recoverable: boolean;
};

export type ToolResult = { output: string; isError?: boolean };

export function toolFailure(
  code: string,
  message: string,
  recovery: ToolRecovery,
  details: Record<string, unknown> = {},
): ToolResult {
  return { output: toolError(code, message, recovery, details), isError: true };
}

export function toolError(
  code: string,
  message: string,
  recovery: ToolRecovery,
  details: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    ...details,
    kind: "tool_error",
    version: 1,
    is_error: true,
    error: code,
    message,
    recovery,
    recoverable: recovery !== "stop_turn",
  });
}

export function parseToolError(output: string): ToolErrorPayload | null {
  try {
    const value: unknown = JSON.parse(output);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const error = value as Record<string, unknown>;
    if (error.kind !== "tool_error" || error.version !== 1 || error.is_error !== true
      || typeof error.error !== "string" || !error.error
      || typeof error.message !== "string" || !error.message
      || !["correct_arguments", "choose_alternative", "stop_turn"].includes(String(error.recovery))
      || error.recoverable !== (error.recovery !== "stop_turn")) return null;
    return error as ToolErrorPayload;
  } catch {
    return null;
  }
}

/** A local, non-retryable failure. Its message is safe to show to the user. */
export class ToolTurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolTurnError";
  }
}

export function checkToolResult(result: string | ToolResult): ToolResult {
  const normalized = typeof result === "string" ? { output: result } : result;
  // The flag comes from execution, never from user-controlled result content.
  if (!normalized.isError) return normalized;
  const error = parseToolError(normalized.output);
  if (!error) throw new ToolTurnError("La herramienta devolvió un error que no se pudo interpretar. No se ha repetido la acción.");
  if (error?.recovery === "stop_turn") throw new ToolTurnError(error.message);
  return normalized;
}
