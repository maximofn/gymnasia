import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnthropicToolLoop, runGoogleToolLoop, runOpenAIToolLoop, type ExecuteTool } from "./providerToolLoop";
import { requestProviderToolChat } from "./providerToolClient";
import { createDetailedAgentToolExecutor, type ToolStore } from "./toolExecutor";
import { parseToolError, toolFailure, ToolTurnError } from "./toolErrors";
import type { ToolBatchDiagnostics, ToolBatchTraceEvent } from "./toolBatchDiagnostics";

type Call = { name: string; args: Record<string, unknown> };
type WireResult = { id: string; output: string; isError?: boolean };
const providers = ["openai", "anthropic", "google", "custom_openai"] as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

async function run(provider: typeof providers[number], calls: Call[], executeTool: ExecuteTool,
  received: WireResult[][], toolBatchDiagnostics?: ToolBatchDiagnostics) {
  if (provider === "openai") {
    return runOpenAIToolLoop({ initialInput: [], executeTool, toolBatchDiagnostics, executionId: "batch-test",
      initialTurn: { outputItems: calls.map((call, index) => ({
        type: "function_call" as const, id: `fc_${index}`, call_id: `call_${index}`,
        name: call.name, arguments: JSON.stringify(call.args),
      })) },
      requestNextTurn: async (messages) => {
        received.push(messages.filter((item) => item.type === "function_call_output")
          .map((item) => ({ id: String(item.call_id), output: String(item.output) })));
        return { outputItems: [] };
      },
    });
  }
  if (provider === "anthropic") {
    return runAnthropicToolLoop({ initialMessages: [], executeTool, toolBatchDiagnostics, executionId: "batch-test",
      initialTurn: { contentBlocks: calls.map((call, index) => ({
        type: "tool_use" as const, id: `call_${index}`, name: call.name, input: call.args,
      })) },
      requestNextTurn: async (messages) => {
        const items = messages.at(-1)!.content as Array<{ tool_use_id: string; content: string; is_error?: boolean }>;
        received.push(items.map((item) => ({ id: item.tool_use_id, output: item.content, isError: item.is_error })));
        return { contentBlocks: [] };
      },
    });
  }
  if (provider === "google") {
    return runGoogleToolLoop({ initialMessages: [], executeTool, toolBatchDiagnostics, executionId: "batch-test",
      initialTurn: { interactionId: "batch", status: "requires_action", content: "", thinking: null, usage: {},
        steps: calls.map((call, index) => ({ type: "function_call" as const,
          id: `call_${index}`, name: call.name, arguments: call.args })) },
      requestNextTurn: async (messages) => {
        received.push(messages.filter((item) => item.type === "function_result")
          .map((item) => ({ id: item.call_id, output: String(item.result[0].text), isError: item.is_error })));
        return { interactionId: "done", status: "completed", content: "", thinking: null, usage: {}, steps: [] };
      },
    });
  }
  const response = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }), {
    status: 200, headers: { "content-type": "application/json" },
  });
  let round = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (round++ === 0) return response({ content: null, tool_calls: calls.map((call, index) => ({
      type: "function", id: `call_${index}`, function: { name: call.name, arguments: JSON.stringify(call.args) },
    })) });
    const messages = JSON.parse(options.body).messages as Array<Record<string, unknown>>;
    received.push(messages.filter((item) => item.role === "tool")
      .map((item) => ({ id: String(item.tool_call_id), output: String(item.content) })));
    return response({ content: "Lote completado." });
  }));
  return requestProviderToolChat({ provider: "custom_openai", is_active: true, api_key: "fixture",
    model: "fixture", base_url: "https://fixture.example/v1" }, [{ role: "user", content: "Consulta mis datos" }],
    { platform: "web", fakeMode: false }, { executeTool, toolBatchDiagnostics, executionId: "batch-test" });
}

describe.each(providers)("lotes en el contrato de %s", (provider) => {
  afterEach(() => vi.unstubAllGlobals());

  it("solapa lecturas, conserva IDs y asigna ocurrencias antes de completarlas", async () => {
    const pending = Array.from({ length: 3 }, () => deferred<string>());
    const envelopes: Array<{ id: string; occurrence: number }> = [];
    const received: WireResult[][] = [];
    const batch = run(provider, [
      { name: "read_field_value", args: { key: "Objetivo" } },
      { name: "read_field_value", args: { key: "Objetivo" } },
      { name: "read_field_value", args: { key: "Peso" } },
    ], async (_name, _args, call) => {
      envelopes.push({ id: call.providerCallId!, occurrence: call.occurrence });
      return pending[Number(call.providerCallId!.split("_")[1])].promise;
    }, received);
    await vi.waitFor(() => expect(envelopes).toEqual([
      { id: "call_0", occurrence: 0 }, { id: "call_1", occurrence: 1 }, { id: "call_2", occurrence: 0 },
    ]));
    pending[2].resolve("third");
    pending[1].resolve("second");
    expect(received).toEqual([]);
    pending[0].resolve("first");
    await batch;
    expect(received[0].map(({ id, output }) => ({ id, output }))).toEqual([
      { id: "call_0", output: "first" }, { id: "call_1", output: "second" }, { id: "call_2", output: "third" },
    ]);
  });

  it("emite tiempos de las tools y del lote sin enviar los diagnósticos al proveedor", async () => {
    const events: ToolBatchTraceEvent[] = [];
    const received: WireResult[][] = [];
    await run(provider, [
      { name: "search_exercises", args: { query: "press" } },
      { name: "search_exercises", args: { query: "curl" } },
      { name: "search_exercises", args: { query: "sentadilla" } },
    ], async () => "catalog result", received, { now: () => 100, onEvent: (event) => events.push(event) });
    expect(events.filter((event) => event.phase === "tool_started").map((event) => event.index)).toEqual([0, 1, 2]);
    expect(events.at(-1)).toMatchObject({ phase: "batch_finished", durationMs: 0,
      totalToolDurationMs: 0, startedCount: 3, returnedCount: 3, peakActiveTools: 3 });
    expect(received[0]).toHaveLength(3);
    expect(JSON.stringify(received)).not.toContain("batch_finished");
    expect(JSON.stringify(events)).not.toContain("catalog result");
  });

  it("un fallo recuperable no cancela las otras lecturas del mismo turno", async () => {
    const received: WireResult[][] = [];
    const completed: string[] = [];
    await run(provider, Array.from({ length: 3 }, (_, i) => ({ name: "read_field_value", args: { key: String(i) } })),
      async (_name, _args, call) => {
        if (call.providerCallId === "call_1") throw new Error("private fixture");
        await Promise.resolve();
        completed.push(call.providerCallId!);
        return `ok_${call.providerCallId}`;
      }, received);
    expect(completed.sort()).toEqual(["call_0", "call_2"]);
    expect(received[0].map((item) => item.id)).toEqual(["call_0", "call_1", "call_2"]);
    expect(parseToolError(received[0][1].output)?.error).toBe("tool_execution_failed");
    expect(received[0][1].output).not.toContain("private fixture");
    if (provider === "google" || provider === "anthropic") expect(received[0][1].isError).toBe(true);
  });

  it("un fallo fatal drena las lecturas activas y no inicia la escritura siguiente", async () => {
    const gate = deferred<string>();
    const received: WireResult[][] = [];
    const execute = vi.fn(async (_name, _args, call) => call.providerCallId === "call_0"
      ? toolFailure("storage_unavailable", "Almacén inaccesible.", "stop_turn") : gate.promise);
    let finished = false;
    const batch = run(provider, [
      { name: "read_routines", args: {} }, { name: "read_measurement", args: { date: "2026-09-01" } },
      { name: "write_measurement", args: { date: "2026-09-01", data: { weight_kg: 75 } } },
    ], execute, received).catch((error) => { finished = true; return error; });
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(finished).toBe(false);
    gate.resolve("ok");
    expect(await batch).toBeInstanceOf(ToolTurnError);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(received).toEqual([]);
  });

  it("serializa dos mediciones sobre la misma fecha y la lectura ve la segunda", async () => {
    let store: ToolStore = { templates: [], measurements: [], dietByDate: {} };
    const gate = deferred<void>();
    const received: WireResult[][] = [];
    let active = 0;
    const commit = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => {
      expect(active).toBe(0);
      active += 1;
      await gate.promise;
      store = updater(store);
      active -= 1;
    });
    const detailed = createDetailedAgentToolExecutor({
      loadPersonalData: async () => [], savePersonalData: async () => {}, loadMeasurements: async () => store.measurements,
      createId: () => "measurement", getExerciseImageUrl: () => "", submitFeedbackIssue: async () => ({ status: "canceled" }),
    });
    const batch = run(provider, [
      ...[75, 76].map((weight_kg) => ({ name: "write_measurement",
        args: { date: "2026-09-01", data: { weight_kg } } })),
      { name: "read_measurement", args: { date: "2026-09-01" } },
    ],
      (name, args) => detailed(name, args, { store, commitStore: commit }), received);
    await vi.waitFor(() => expect(commit).toHaveBeenCalledOnce());
    gate.resolve();
    await batch;
    expect(commit).toHaveBeenCalledTimes(2);
    expect(store.measurements).toHaveLength(1);
    expect(store.measurements[0].weight_kg).toBe(76);
    expect(received[0].map((item) => item.id)).toEqual(["call_0", "call_1", "call_2"]);
    expect(JSON.parse(received[0][2].output).weight_kg).toBe(76);
  });
});
