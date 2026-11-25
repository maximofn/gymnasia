import { describe, expect, it } from "vitest";

import { createAnthropicStreamParser, createOpenAIStreamParser } from "./providerStreamParsers";
import { ROUND_LIMIT_TOOL_RESULT, ToolRoundLimitError } from "./providerToolLoop";
import { formatToolInputError } from "./toolDefinitions";
import { createToolLoopMeasurement, type ToolLoopTraceEvent } from "./toolLoopMetrics";

function clock(...ticks: number[]) {
  let index = 0;
  return () => ticks[Math.min(index++, ticks.length - 1)];
}

function openAICall(id: string, name: string, args: string) {
  return { type: "function_call", id: `fc_${id}`, call_id: id, name, arguments: args };
}

describe("medida del bucle de tools sobre una traza conocida", () => {
  it("registra vueltas, tokens, tamaño de la conversación y resultado de cada llamada", async () => {
    const events: ToolLoopTraceEvent[] = [];
    // inicio, petición 0 (envío y llegada), petición 1, petición 2, fin
    const measurement = createToolLoopMeasurement("openai", {
      onEvent: (event) => events.push(event),
      now: clock(0, 10, 110, 120, 170, 200, 260, 300),
    });
    const initial = [{ role: "user", content: "hola" }];
    await measurement.request(initial, false, async () => ({
      outputItems: [
        openAICall("a", "read_field_value", "{\"key\":\"peso\"}"),
        openAICall("b", "read_field_value", "{roto"),
        openAICall("c", "tool_inventada", "{}"),
      ],
      usage: { inputTokens: 100, outputTokens: 20 },
    }));
    const second = [
      ...initial,
      openAICall("a", "read_field_value", "{\"key\":\"peso\"}"),
      { type: "function_call_output", call_id: "a", output: "80 kg" },
      { type: "function_call_output", call_id: "b", output: formatToolInputError(["uno", "dos"]) },
      { type: "function_call_output", call_id: "c", output: ROUND_LIMIT_TOOL_RESULT },
    ];
    await measurement.request(second, false, async () => ({
      outputItems: [{ type: "message" }],
      usage: { inputTokens: 150, outputTokens: 30 },
    }));
    measurement.finish();

    expect(events).toEqual([
      {
        phase: "round", loopId: expect.any(String), provider: "openai",
        round: 0, closing: false, contextChars: JSON.stringify(initial).length, contextMessages: 1,
        inputTokens: 100, outputTokens: 20, providerMs: 100,
        calls: [
          { toolName: "read_field_value", effect: "read", argumentsParsed: true, outcome: "ok", errorCode: null, issueCount: null },
          { toolName: "read_field_value", effect: "read", argumentsParsed: false, outcome: "error",
            errorCode: "invalid_tool_arguments", issueCount: 2 },
          { toolName: "unknown", effect: "unknown", argumentsParsed: true, outcome: "not_executed", errorCode: null, issueCount: null },
        ],
      },
      {
        phase: "round", loopId: expect.any(String), provider: "openai",
        round: 1, closing: false, contextChars: JSON.stringify(second).length, contextMessages: 5,
        inputTokens: 150, outputTokens: 30, providerMs: 50, calls: [],
      },
      {
        phase: "loop_finished", loopId: expect.any(String), provider: "openai", outcome: "answered",
        rounds: 2, toolCalls: 3, failedCalls: 1, inputTokens: 250, outputTokens: 50,
        finalContextChars: JSON.stringify(second).length, durationMs: 200,
      },
    ]);
  });

  it("deja los tokens vacíos si el proveedor no los informa", async () => {
    const events: ToolLoopTraceEvent[] = [];
    const measurement = createToolLoopMeasurement("custom_openai", { onEvent: (event) => events.push(event) });
    await measurement.request([], false, async () => ({ content: "hola", toolCalls: [] }));
    measurement.finish();
    expect(events[0]).toMatchObject({ inputTokens: null, outputTokens: null });
    expect(events[1]).toMatchObject({ inputTokens: null, outputTokens: null, outcome: "answered" });
  });

  it("clasifica el final: cierre por límite, límite fallido y error", async () => {
    const outcomes: string[] = [];
    const onEvent = (event: ToolLoopTraceEvent) => {
      if (event.phase === "loop_finished") outcomes.push(event.outcome);
    };
    const closed = createToolLoopMeasurement("anthropic", { onEvent });
    await closed.request([], true, async () => ({ contentBlocks: [] }));
    closed.finish();
    const limit = createToolLoopMeasurement("anthropic", { onEvent });
    limit.finish(new ToolRoundLimitError());
    const failed = createToolLoopMeasurement("anthropic", { onEvent });
    failed.finish(new Error("red"));
    expect(outcomes).toEqual(["round_limit", "round_limit", "error"]);
  });

  it("deja como sin respuesta las llamadas de un turno que falla antes de ejecutarlas", async () => {
    const events: ToolLoopTraceEvent[] = [];
    const measurement = createToolLoopMeasurement("google", { onEvent: (event) => events.push(event) });
    await measurement.request([], false, async () => ({
      steps: [{ type: "function_call", id: "g1", name: "read_measurement", arguments: {} }],
      usage: { total_input_tokens: 7, total_output_tokens: 3 },
    }));
    await expect(measurement.request([], false, async () => { throw new Error("red"); })).rejects.toThrow("red");
    measurement.finish(new Error("red"));
    expect(events.map((event) => event.phase)).toEqual(["round", "loop_finished"]);
    expect(events[0]).toMatchObject({ inputTokens: 7, outputTokens: 3,
      calls: [{ toolName: "read_measurement", outcome: "unanswered" }] });
    expect(events[1]).toMatchObject({ outcome: "error", rounds: 1 });
  });

  it("un sumidero roto o un turno ilegible no cambian lo que devuelve la petición", async () => {
    const measurement = createToolLoopMeasurement("openai", { onEvent: () => { throw new Error("roto"); } });
    const turn = { outputItems: "no es una lista" };
    await expect(measurement.request([], false, async () => turn)).resolves.toBe(turn);
    expect(() => measurement.finish()).not.toThrow();
  });
});

describe("tokens en los parsers de streaming", () => {
  it("OpenAI toma el uso del evento final", () => {
    const parser = createOpenAIStreamParser();
    parser.push("event: response.completed\ndata: " + JSON.stringify({
      type: "response.completed",
      response: { id: "resp_1", output: [], usage: { input_tokens: 321, output_tokens: 45 } },
    }) + "\n\n");
    expect(parser.finish().usage).toEqual({ inputTokens: 321, outputTokens: 45 });
  });

  it("Anthropic suma la caché a la entrada y usa la salida acumulada", () => {
    const parser = createAnthropicStreamParser();
    const event = (data: Record<string, unknown>) => `event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;
    parser.push(event({ type: "message_start", message: { usage: {
      input_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 100, output_tokens: 1 } } }));
    parser.push(event({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 12 } }));
    parser.push(event({ type: "message_delta", delta: {}, usage: { output_tokens: 40 } }));
    parser.push(event({ type: "message_stop" }));
    expect(parser.finish().usage).toEqual({ inputTokens: 115, outputTokens: 40 });
  });

  it("sin uso informado, los tokens quedan vacíos", () => {
    const parser = createOpenAIStreamParser();
    parser.push("event: response.completed\ndata: " + JSON.stringify({
      type: "response.completed", response: { id: "resp_1", output: [] },
    }) + "\n\n");
    expect(parser.finish().usage).toEqual({ inputTokens: null, outputTokens: null });
  });
});
