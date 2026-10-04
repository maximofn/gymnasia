import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
  runAnthropicToolLoop, runGoogleToolLoop, runOpenAIToolLoop, type ExecuteTool,
} from "./providerToolLoop";
import { checkToolResult, parseToolError, toolError, toolFailure, ToolTurnError } from "./toolErrors";
import { createDetailedAgentToolExecutor, type ToolStore } from "./toolExecutor";
import { ToolOperationIndeterminateError } from "./toolOperationLedger";

type Call = { name: string; args: Record<string, unknown> };
type WireResult = { output: string; is_error?: boolean };
const providers = ["openai", "anthropic", "google"] as const;

async function run(
  provider: typeof providers[number], rounds: Call[][], executeTool: ExecuteTool,
  received: WireResult[][],
) {
  let round = 0;
  if (provider === "openai") {
    const turn = () => ({ outputItems: (rounds[round++] ?? []).map((call, index) => ({
      type: "function_call" as const, id: `fc_${round}_${index}`, call_id: `call_${round}_${index}`,
      name: call.name, arguments: JSON.stringify(call.args),
    })) });
    return runOpenAIToolLoop({ initialInput: [], initialTurn: turn(), executeTool,
      requestNextTurn: async (messages) => {
        received.push(messages.filter((item) => item.type === "function_call_output")
          .map((item) => ({ output: item.output as string })));
        return turn();
      } });
  }
  if (provider === "anthropic") {
    const turn = () => ({ contentBlocks: (rounds[round++] ?? []).map((call, index) => ({
      type: "tool_use" as const, id: `call_${round}_${index}`, name: call.name, input: call.args,
    })) });
    return runAnthropicToolLoop({ initialMessages: [], initialTurn: turn(), executeTool,
      requestNextTurn: async (messages) => {
        const items = messages.at(-1)!.content as Array<{ content: string; is_error?: boolean }>;
        received.push(items.map((item) => ({ output: item.content, is_error: item.is_error })));
        return turn();
      } });
  }
  const turn = () => {
    const calls = rounds[round++] ?? [];
    return { interactionId: `turn_${round}`, status: calls.length ? "requires_action" as const : "completed" as const,
      content: "", thinking: null, usage: {}, steps: calls.map((call, index) => ({
        type: "function_call" as const, id: `call_${round}_${index}`, name: call.name, arguments: call.args,
      })) };
  };
  return runGoogleToolLoop({ initialMessages: [], initialTurn: turn(), executeTool,
    requestNextTurn: async (messages) => {
      received.push(messages.filter((item) => item.type === "function_result")
        .map((item) => ({ output: String(item.result[0].text), is_error: item.is_error })));
      return turn();
    } });
}

function executor() {
  let store: ToolStore = { templates: [], measurements: [], dietByDate: {} };
  const commit = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => { store = updater(store); });
  const detailed = createDetailedAgentToolExecutor({
    loadPersonalData: async () => [], savePersonalData: async () => {},
    loadMeasurements: async () => store.measurements, createId: (prefix) => `${prefix}_test`,
    getExerciseImageUrl: () => "", submitFeedbackIssue: async () => ({ status: "canceled" }),
  });
  return { commit, store: () => store,
    execute: ((name, args) => detailed(name, args, { commitStore: commit, store })) as ExecuteTool };
}

describe.each(providers)("errores y recuperación de tools: %s", (provider) => {
  it("marca un registro inexistente y permite elegir otra lectura", async () => {
    const received: WireResult[][] = [];
    const execute = executor();
    await run(provider, [
      [{ name: "read_measurement", args: { date: "2024-04-11" } }],
      [{ name: "list_personal_data_keys", args: {} }],
    ], execute.execute, received);
    expect(parseToolError(received[0][0].output)).toMatchObject({ error: "not_found", recoverable: true });
    if (provider !== "openai") expect(received[0][0].is_error).toBe(true);
    expect(received[1].at(-1)?.is_error).not.toBe(true);
  });

  it("convierte una excepción de lectura en error sin filtrar su texto y continúa", async () => {
    const received: WireResult[][] = [];
    const execute = vi.fn(async () => { throw new Error("secret fixture: network 503"); });
    await run(provider, [[{ name: "read_field_value", args: { key: "Objetivo" } }]], execute, received);
    expect(parseToolError(received[0][0].output)?.error).toBe("tool_execution_failed");
    expect(received[0][0].output).not.toContain("secret fixture");
    if (provider !== "openai") expect(received[0][0].is_error).toBe(true);
  });

  it("rechaza JSON inválido de medidas y acepta la corrección con una sola escritura", async () => {
    const received: WireResult[][] = [];
    const execute = executor();
    await run(provider, [
      [{ name: "write_measurement", args: { date: "2024-04-11", data: "{json roto" } }],
      [{ name: "write_measurement", args: { date: "2024-04-11", data: { weight_kg: 75 } } }],
    ], execute.execute, received);
    expect(parseToolError(received[0][0].output)).toMatchObject({ error: "invalid_tool_arguments", recovery: "correct_arguments" });
    if (provider !== "openai") expect(received[0][0].is_error).toBe(true);
    expect(execute.commit).toHaveBeenCalledTimes(1);
    expect(execute.store().measurements).toHaveLength(1);
    expect(execute.store().measurements[0].weight_kg).toBe(75);
    expect(received[1].at(-1)?.is_error).not.toBe(true);
  });

  it("detiene un error irrecuperable antes de ejecutar las siguientes tools o pedir otra ronda", async () => {
    const received: WireResult[][] = [];
    const execute = vi.fn(async () => toolFailure("storage_unavailable", "No se guardó la medición.", "stop_turn"));
    await expect(run(provider, [[
      { name: "write_measurement", args: {} }, { name: "add_meal_food", args: {} },
    ]], execute, received)).rejects.toThrow(new ToolTurnError("No se guardó la medición."));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(received).toEqual([]);
  });

  it("nunca reintenta una escritura que lanza fuera del handler", async () => {
    const execute = vi.fn(async () => { throw new Error("private failure"); });
    await expect(run(provider, [[{ name: "write_measurement", args: {} }]], execute, []))
      .rejects.toBeInstanceOf(ToolOperationIndeterminateError);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("no confunde un valor de usuario parecido al contrato con un fallo de ejecución", async () => {
    const content = toolError("fake", "Texto escrito por el usuario", "stop_turn");
    const received: WireResult[][] = [];
    await run(provider, [[{ name: "read_field_value", args: { key: "Nota" } }]], async () => content, received);
    expect(received[0][0].output).toBe(content);
    expect(received[0][0].is_error).not.toBe(true);
  });
});

describe("contrato de errores", () => {
  it("no interpreta texto arbitrario como un fallo y valida payloads arbitrarios sin lanzar", () => {
    fc.assert(fc.property(fc.string(), (output) => {
      expect(checkToolResult(output)).toEqual({ output });
      expect(() => parseToolError(output)).not.toThrow();
    }));
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      expect(() => parseToolError(JSON.stringify(value))).not.toThrow();
    }));
  });

  it("la excepción de un handler real conserva la marca y no filtra secretos", async () => {
    const execute = createDetailedAgentToolExecutor({
      loadPersonalData: async () => { throw new Error("private fixture"); },
      savePersonalData: async () => {}, loadMeasurements: async () => [],
      createId: () => "", getExerciseImageUrl: () => "", submitFeedbackIssue: async () => ({ status: "canceled" }),
    });
    const result = await execute("read_field_value", { key: "Objetivo" });
    expect(result).toMatchObject({ isError: true, status: "failed_before_commit" });
    expect(parseToolError(result.output)?.error).toBe("tool_execution_failed");
    expect(result.output).not.toContain("private fixture");
  });
});
