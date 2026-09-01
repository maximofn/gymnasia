import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
} from "./providerToolLoop";
import { parseSSEJsonFixture } from "./sse";

function readFixture<T>(name: string): T[] {
  const fixture = readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
  return parseSSEJsonFixture<T>(fixture);
}

describe("integración del bucle con proveedor falso", () => {
  it("completa tool_use → tool_result → siguiente ronda en OpenAI", async () => {
    const [initialTurn, finalTurn] = readFixture<any>("openai-tool-loop.sse");
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    const requestNextTurn = vi.fn(async (_messages: Array<Record<string, unknown>>) => finalTurn);
    const result = await runOpenAIToolLoop({ initialTurn, requestNextTurn, executeTool });

    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
    expect(executeTool).toHaveBeenCalledWith(
      "read_field_value",
      { key: "Objetivo" },
      expect.objectContaining({
        executionId: "legacy-execution",
        provider: "openai",
        providerCallId: "call_1",
        occurrence: 0,
      }),
    );
    expect(requestNextTurn).toHaveBeenCalledWith([
      { type: "function_call_output", call_id: "call_1", output: "Ganar masa muscular" },
    ], "resp_openai_1");
  });

  it("completa tool_use → tool_result → siguiente ronda en Anthropic", async () => {
    const [initialTurn, finalTurn] = readFixture<any>("anthropic-tool-loop.sse");
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    const requestNextTurn = vi.fn(async (_messages: Array<Record<string, unknown>>) => finalTurn);
    const initialMessages = [{ role: "user", content: "¿Cuál es mi objetivo?" }];
    const result = await runAnthropicToolLoop({
      initialTurn,
      initialMessages,
      requestNextTurn,
      executeTool,
    });

    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
    expect(executeTool).toHaveBeenCalledWith(
      "read_field_value",
      { key: "Objetivo" },
      expect.objectContaining({
        executionId: "legacy-execution",
        provider: "anthropic",
        providerCallId: "toolu_1",
        occurrence: 0,
      }),
    );
    const nextMessages = requestNextTurn.mock.calls[0][0];
    expect(nextMessages.at(-1)).toEqual({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "toolu_1",
        content: "Ganar masa muscular",
      }],
    });
  });

  it("completa functionCall → functionResponse → siguiente ronda en Google", async () => {
    const [initialTurn, finalTurn] = readFixture<any>("google-tool-loop.sse");
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    const requestNextTurn = vi.fn(async (_messages: Array<Record<string, unknown>>) => finalTurn);
    const result = await runGoogleToolLoop({
      initialTurn,
      initialMessages: [{ role: "user", parts: [{ text: "¿Cuál es mi objetivo?" }] }],
      requestNextTurn,
      executeTool,
    });

    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
    expect(executeTool).toHaveBeenCalledWith(
      "read_field_value",
      { key: "Objetivo" },
      expect.objectContaining({
        executionId: "legacy-execution",
        provider: "google",
        occurrence: 0,
      }),
    );
    const nextMessages = requestNextTurn.mock.calls[0][0];
    expect(nextMessages.at(-1)).toEqual({
      role: "user",
      parts: [{
        functionResponse: {
          name: "read_field_value",
          response: { result: "Ganar masa muscular" },
        },
      }],
    });
  });

  it("falla de forma explícita si OpenAI omite el id necesario para continuar", async () => {
    await expect(runOpenAIToolLoop({
      initialTurn: {
        responseId: null,
        outputItems: [{
          type: "function_call" as const,
          id: "fc_missing_id",
          call_id: "call_missing_id",
          name: "read_field_value",
          arguments: "{}",
        }],
      },
      requestNextTurn: async () => ({ responseId: null, outputItems: [] }),
      executeTool: async () => "",
    })).rejects.toThrow("OpenAI no devolvio response_id");
  });
});
