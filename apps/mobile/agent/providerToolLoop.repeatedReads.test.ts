import { readFileSync } from "node:fs";

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import type { ProviderConfiguration } from "./providerConfiguration";
import {
  executeToolSafely,
  MAX_IDENTICAL_READS,
  REPEATED_TOOL_CALL_ERROR,
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
} from "./providerToolLoop";
import { parseSSEJsonFixture } from "./sse";
import { parseToolError } from "./toolErrors";
import { toolCallOccurrenceKey, type ToolCallEnvelope } from "./toolOperationLedger";

// Un modelo terco: pide la misma lectura INSISTENCE veces y después responde.
const INSISTENCE = 5;
const ARGS = { query: "sentadilla", muscle: "pierna" };
const FINAL = "La sentadilla trabaja sobre todo la pierna.";

let customRound = 0;
vi.mock("./customOpenAIChat", async (importOriginal) => ({
  ...await importOriginal<typeof import("./customOpenAIChat")>(),
  requestCustomOpenAIChat: vi.fn(async () => {
    customRound += 1;
    if (customRound > INSISTENCE) return { content: FINAL, toolCalls: [] };
    return { content: "", toolCalls: [{ id: `call_${customRound}`, type: "function",
      function: { name: "search_exercises", arguments: JSON.stringify(ARGS) } }] };
  }),
}));

const { requestProviderToolChat } = await import("./providerToolClient");

function envelope(occurrence: number, name = "search_exercises"): ToolCallEnvelope {
  return { executionId: "e", provider: "openai", name, args: ARGS, occurrence };
}

function expectRepeatedError(output: unknown) {
  expect(typeof output).toBe("string");
  expect(parseToolError(output as string)).toMatchObject({
    kind: "tool_error", error: REPEATED_TOOL_CALL_ERROR, recovery: "choose_alternative", recoverable: true,
  });
}

describe("lecturas repetidas: corte por huella", () => {
  it("ejecuta las dos primeras lecturas idénticas y corta la tercera sin llamar al handler", async () => {
    const execute = vi.fn(async () => "resultado");
    for (let occurrence = 0; occurrence < MAX_IDENTICAL_READS; occurrence += 1) {
      expect(await executeToolSafely(execute, "search_exercises", ARGS, envelope(occurrence)))
        .toEqual({ output: "resultado" });
    }
    const third = await executeToolSafely(execute, "search_exercises", ARGS, envelope(MAX_IDENTICAL_READS));
    expect(execute).toHaveBeenCalledTimes(MAX_IDENTICAL_READS);
    expect(third.isError).toBe(true);
    expectRepeatedError(third.output);
  });

  it("no corta las tools con efectos: las protege el ledger de idempotencia", async () => {
    const execute = vi.fn(async () => "guardado");
    const result = await executeToolSafely(execute, "write_measurement", {}, envelope(5, "write_measurement"));
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toEqual({ output: "guardado" });
  });

  it("la huella no cambia al reordenar claves y sí con argumentos distintos", () => {
    expect(toolCallOccurrenceKey("search_exercises", { a: 1, b: { c: 2, d: 3 } }))
      .toBe(toolCallOccurrenceKey("search_exercises", { b: { d: 3, c: 2 }, a: 1 }));
    expect(toolCallOccurrenceKey("search_exercises", { query: "press" }))
      .not.toBe(toolCallOccurrenceKey("search_exercises", { query: "remo" }));
  });

  it("property: cualquier permutación de claves produce la misma huella", () => {
    const argsWithPermutation = fc.dictionary(fc.string(), fc.jsonValue()).chain((args) => {
      const keys = Object.keys(args);
      return fc.shuffledSubarray(keys, { minLength: keys.length, maxLength: keys.length })
        .map((order) => ({ args, order }));
    });
    fc.assert(fc.property(argsWithPermutation, ({ args, order }) => {
      const permuted = Object.fromEntries(order.map((key) => [key, args[key]]));
      return toolCallOccurrenceKey("t", args) === toolCallOccurrenceKey("t", permuted);
    }));
  });

  it("OpenAI: el modelo terco recibe el error a la tercera y la respuesta termina con normalidad", async () => {
    // Regresión: esta secuencia agotaba el tope de rondas.
    const [repeated, finalTurn] = parseSSEJsonFixture<any>(readFileSync(
      new URL("./__fixtures__/openai-repeated-read.sse", import.meta.url), "utf8"));
    const turn = (round: number) => JSON.parse(JSON.stringify(repeated)
      .replaceAll("call_repeat", `call_${round}`).replaceAll("fc_repeat", `fc_${round}`));
    const executeTool = vi.fn(async () => "resultado");
    let round = 1;
    let lastInput: Array<Record<string, unknown>> = [];
    const result = await runOpenAIToolLoop({
      initialInput: [], initialTurn: turn(round), executeTool,
      requestNextTurn: async (input) => {
        lastInput = input;
        round += 1;
        return round > INSISTENCE ? finalTurn : turn(round);
      },
    });
    expect(result.content).toBe(FINAL);
    expect(executeTool).toHaveBeenCalledTimes(MAX_IDENTICAL_READS);
    const outputs = lastInput.filter((item) => item.type === "function_call_output").map((item) => item.output);
    expect(outputs.slice(0, MAX_IDENTICAL_READS)).toEqual(["resultado", "resultado"]);
    outputs.slice(MAX_IDENTICAL_READS).forEach(expectRepeatedError);
  });

  it("Anthropic: igual comportamiento con claves en distinto orden", async () => {
    const turn = (round: number) => ({ content: "", thinking: null, stopReason: "tool_use",
      contentBlocks: [{ type: "tool_use", id: `toolu_${round}`, name: "search_exercises",
        input: round % 2 ? ARGS : { muscle: ARGS.muscle, query: ARGS.query } }] });
    const executeTool = vi.fn(async () => "resultado");
    let round = 1;
    let lastMessages: Array<Record<string, unknown>> = [];
    const result = await runAnthropicToolLoop({
      initialMessages: [{ role: "user", content: "¿Qué trabaja la sentadilla?" }],
      initialTurn: turn(round) as any, executeTool,
      requestNextTurn: async (messages) => {
        lastMessages = messages;
        round += 1;
        return (round > INSISTENCE
          ? { content: FINAL, thinking: null, stopReason: "end_turn", contentBlocks: [{ type: "text", text: FINAL }] }
          : turn(round)) as any;
      },
    });
    expect(result.content).toBe(FINAL);
    expect(executeTool).toHaveBeenCalledTimes(MAX_IDENTICAL_READS);
    const outputs = lastMessages.flatMap((message) => Array.isArray(message.content) ? message.content : [])
      .filter((block: any) => block.type === "tool_result");
    outputs.slice(MAX_IDENTICAL_READS).forEach((block: any) => {
      expect(block.is_error).toBe(true);
      expectRepeatedError(block.content);
    });
  });

  it("Google: igual comportamiento, y el contador se reinicia en cada mensaje del usuario", async () => {
    const turn = (round: number) => ({ interactionId: "", status: "requires_action", content: "", thinking: null,
      usage: {}, steps: [{ type: "function_call", id: `g_${round}`, name: "search_exercises", arguments: ARGS }] });
    const finalTurn = { interactionId: "", status: "completed", content: FINAL, thinking: null, usage: {},
      steps: [{ type: "model_output", content: [{ type: "text", text: FINAL }] }] };
    const executeTool = vi.fn(async () => "resultado");
    for (const userMessage of ["primer mensaje", "segundo mensaje"]) {
      executeTool.mockClear();
      let round = 1;
      const result = await runGoogleToolLoop({
        initialMessages: [{ type: "user_input", content: [{ type: "text", text: userMessage }] }],
        initialTurn: turn(round) as any, executeTool,
        requestNextTurn: async () => {
          round += 1;
          return (round > INSISTENCE ? finalTurn : turn(round)) as any;
        },
      });
      expect(result.content).toBe(FINAL);
      expect(executeTool).toHaveBeenCalledTimes(MAX_IDENTICAL_READS);
      const outputs = result.history.filter((step: any) => step.type === "function_result");
      outputs.slice(MAX_IDENTICAL_READS).forEach((step: any) => {
        expect(step.is_error).toBe(true);
        expectRepeatedError(step.result[0].text);
      });
    }
  });

  it("Chat Completions compatible: igual comportamiento a través del cliente", async () => {
    customRound = 0;
    const executeTool = vi.fn(async () => "resultado");
    const result = await requestProviderToolChat(
      { provider: "custom_openai", api_key: "fixture", model: "fixture-model", is_active: true,
        reasoning_effort: "medium", base_url: "https://llm.example.test/v1" } as ProviderConfiguration,
      [{ role: "user", content: "¿Qué trabaja la sentadilla?" }],
      { fakeMode: false, platform: "web" },
      { executeTool },
    );
    expect(result.content).toBe(FINAL);
    expect(executeTool).toHaveBeenCalledTimes(MAX_IDENTICAL_READS);
  });
});
