import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  createAnthropicStreamParser,
  createGoogleStreamParser,
  createOpenAIStreamParser,
} from "./providerStreamParsers";
import {
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
} from "./providerToolLoop";

function readRawFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/raw/${name}`, import.meta.url), "utf8");
}

function replayInNetworkChunks<TResult>(
  raw: string,
  parser: { push: (chunk: string) => void; finish: () => TResult },
): TResult {
  const chunkSizes = [1, 7, 23, 5, 41, 3, 17];
  let offset = 0;
  let chunkIndex = 0;
  while (offset < raw.length) {
    const size = chunkSizes[chunkIndex % chunkSizes.length];
    parser.push(raw.slice(offset, offset + size));
    offset += size;
    chunkIndex += 1;
  }
  return parser.finish();
}

describe("pipeline SSE crudo → parser → tool → segunda ronda", () => {
  it("procesa el dialecto completo de OpenAI", async () => {
    const deltas: string[] = [];
    const initialTurn = replayInNetworkChunks(
      readRawFixture("openai-tool-call.sse"),
      createOpenAIStreamParser({ onContentDelta: (delta) => deltas.push(delta) }),
    );
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    const requests: Array<{ outputs: Array<Record<string, unknown>>; responseId: string }> = [];
    const result = await runOpenAIToolLoop({
      initialTurn,
      executeTool,
      requestNextTurn: async (outputs, responseId) => {
        requests.push({ outputs, responseId });
        return replayInNetworkChunks(
          readRawFixture("openai-final.sse"),
          createOpenAIStreamParser({ onContentDelta: (delta) => deltas.push(delta) }),
        );
      },
    });

    expect(initialTurn.outputItems).toEqual([expect.objectContaining({
      type: "function_call",
      name: "read_field_value",
      arguments: '{"key":"Objetivo"}',
    })]);
    expect(executeTool).toHaveBeenCalledWith("read_field_value", { key: "Objetivo" });
    expect(requests).toEqual([{
      responseId: "resp_openai_tool",
      outputs: [{
        type: "function_call_output",
        call_id: "call_openai_1",
        output: "Ganar masa muscular",
      }],
    }]);
    expect(deltas.join("")).toBe("Tu objetivo es ganar masa muscular.");
    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
  });

  it("procesa el dialecto completo de Anthropic", async () => {
    const initialTurn = replayInNetworkChunks(
      readRawFixture("anthropic-tool-call.sse"),
      createAnthropicStreamParser(),
    );
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    let continuedMessages: Array<Record<string, unknown>> = [];
    const result = await runAnthropicToolLoop({
      initialTurn,
      initialMessages: [{ role: "user", content: "¿Cuál es mi objetivo?" }],
      executeTool,
      requestNextTurn: async (messages) => {
        continuedMessages = messages;
        return replayInNetworkChunks(
          readRawFixture("anthropic-final.sse"),
          createAnthropicStreamParser(),
        );
      },
    });

    expect(initialTurn.contentBlocks).toEqual([{
      type: "tool_use",
      id: "toolu_anthropic_1",
      name: "read_field_value",
      input: { key: "Objetivo" },
    }]);
    expect(initialTurn.stopReason).toBe("tool_use");
    expect(executeTool).toHaveBeenCalledWith("read_field_value", { key: "Objetivo" });
    expect(continuedMessages.at(-1)).toEqual({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "toolu_anthropic_1",
        content: "Ganar masa muscular",
      }],
    });
    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
    expect(result.stopReason).toBe("end_turn");
  });

  it("procesa el dialecto completo de Google", async () => {
    const initialTurn = replayInNetworkChunks(
      readRawFixture("google-tool-call.sse"),
      createGoogleStreamParser(),
    );
    const executeTool = vi.fn(async () => "Ganar masa muscular");
    let continuedMessages: Array<Record<string, unknown>> = [];
    const result = await runGoogleToolLoop({
      initialTurn,
      initialMessages: [{ role: "user", parts: [{ text: "¿Cuál es mi objetivo?" }] }],
      executeTool,
      requestNextTurn: async (messages) => {
        continuedMessages = messages;
        return replayInNetworkChunks(
          readRawFixture("google-final.sse"),
          createGoogleStreamParser(),
        );
      },
    });

    expect(initialTurn.modelParts).toEqual([{
      functionCall: { name: "read_field_value", args: { key: "Objetivo" } },
      thought: false,
      thoughtSignature: undefined,
    }]);
    expect(executeTool).toHaveBeenCalledWith("read_field_value", { key: "Objetivo" });
    expect(continuedMessages.at(-1)).toEqual({
      role: "user",
      parts: [{
        functionResponse: {
          name: "read_field_value",
          response: { result: "Ganar masa muscular" },
        },
      }],
    });
    expect(result.content).toBe("Tu objetivo es ganar masa muscular.");
    expect(result.finishReason).toBe("STOP");
  });
});
