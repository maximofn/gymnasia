import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { GoogleInteractionTurn, GoogleStep } from "./googleInteractions";
import {
  MAX_TOOL_ROUNDS,
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
      initialMessages: [{ type: "user_input", content: [{ type: "text", text: "¿Cuál es mi objetivo?" }] }],
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
    expect(nextMessages.at(-1)).toEqual({ type: "function_result", name: "read_field_value",
      call_id: "google_call_1", result: [{ type: "text", text: "Ganar masa muscular" }] });
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

// Turnos mínimos, construidos a mano, para recorrer el bucle ronda a ronda.
function anthropicToolTurn(id: string) {
  return {
    contentBlocks: [{
      type: "tool_use" as const,
      id,
      name: "read_field_value",
      input: { key: id },
    }],
  };
}

function anthropicTextTurn(text: string) {
  return { contentBlocks: [{ type: "text" as const, text }] };
}

function openAIToolTurn(responseId: string, callId: string) {
  return {
    responseId,
    outputItems: [{
      type: "function_call" as const,
      id: `fc_${callId}`,
      call_id: callId,
      name: "read_field_value",
      arguments: JSON.stringify({ key: callId }),
    }],
  };
}

function openAITextTurn(responseId: string, text: string) {
  return {
    responseId,
    outputItems: [{ type: "message", content: [{ type: "output_text", text }] }],
  };
}

function googleToolTurn(interactionId: string, callId: string): GoogleInteractionTurn {
  return {
    interactionId,
    status: "requires_action",
    steps: [{ type: "function_call", id: callId, name: "read_field_value", arguments: { key: callId } }],
    content: "",
    thinking: null,
    usage: {},
  };
}

function googleTextTurn(interactionId: string, text: string): GoogleInteractionTurn {
  return {
    interactionId,
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text }] }],
    content: text,
    thinking: null,
    usage: {},
  };
}

// Cada llamada a la tool devuelve un resultado distinto para poder seguirlo en el historial.
function numberedExecuteTool() {
  return vi.fn(async (_name: string, args: Record<string, unknown>) => `resultado de ${String(args.key)}`);
}

describe("rondas del bucle con proveedor falso", () => {
  describe("dos rondas de tools terminan en la respuesta final", () => {
    it("Anthropic reenvía asistente y resultados de cada ronda, en ese orden", async () => {
      const initialMessages = [{ role: "user", content: "¿Cuál es mi objetivo y mi peso?" }];
      const secondTurn = anthropicToolTurn("toolu_2");
      const finalTurn = anthropicTextTurn("Quieres ganar masa y pesas 80 kg.");
      const requestNextTurn = vi.fn()
        .mockResolvedValueOnce(secondTurn)
        .mockResolvedValueOnce(finalTurn);
      const executeTool = numberedExecuteTool();
      const firstTurn = anthropicToolTurn("toolu_1");

      const result = await runAnthropicToolLoop({
        initialTurn: firstTurn,
        initialMessages,
        requestNextTurn,
        executeTool,
      });

      expect(result).toBe(finalTurn);
      expect(executeTool).toHaveBeenCalledTimes(2);
      expect(requestNextTurn).toHaveBeenCalledTimes(2);
      // El orden importa: Anthropic rechaza un tool_result que no sigue a su tool_use.
      expect(requestNextTurn.mock.calls[1][0]).toEqual([
        initialMessages[0],
        { role: "assistant", content: firstTurn.contentBlocks },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "resultado de toolu_1" }] },
        { role: "assistant", content: secondTurn.contentBlocks },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: "resultado de toolu_2" }] },
      ]);
      // La primera petición no ve la segunda ronda: cada ronda recibe su propia copia.
      expect(requestNextTurn.mock.calls[0][0]).toHaveLength(3);
    });

    it("OpenAI encadena cada ronda con el response_id del turno anterior", async () => {
      const finalTurn = openAITextTurn("resp_3", "Quieres ganar masa y pesas 80 kg.");
      const requestNextTurn = vi.fn()
        .mockResolvedValueOnce(openAIToolTurn("resp_2", "call_2"))
        .mockResolvedValueOnce(finalTurn);
      const executeTool = numberedExecuteTool();

      const result = await runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_1", "call_1"),
        requestNextTurn,
        executeTool,
      });

      expect(result).toBe(finalTurn);
      expect(executeTool).toHaveBeenCalledTimes(2);
      // OpenAI guarda el historial en su lado: solo viajan los resultados nuevos.
      expect(requestNextTurn.mock.calls).toEqual([
        [[{ type: "function_call_output", call_id: "call_1", output: "resultado de call_1" }], "resp_1"],
        [[{ type: "function_call_output", call_id: "call_2", output: "resultado de call_2" }], "resp_2"],
      ]);
    });

    it("Google reenvía cada llamada seguida de su resultado, en ese orden", async () => {
      const initialMessages: GoogleStep[] = [
        { type: "user_input", content: [{ type: "text", text: "¿Cuál es mi objetivo y mi peso?" }] },
      ];
      const finalTurn = googleTextTurn("google_turn_3", "Quieres ganar masa y pesas 80 kg.");
      const requestNextTurn = vi.fn()
        .mockResolvedValueOnce(googleToolTurn("google_turn_2", "google_call_2"))
        .mockResolvedValueOnce(finalTurn);
      const executeTool = numberedExecuteTool();

      const result = await runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_1", "google_call_1"),
        initialMessages,
        requestNextTurn,
        executeTool,
      });

      expect(result.content).toBe("Quieres ganar masa y pesas 80 kg.");
      expect(result.interactions.map(({ id }) => id)).toEqual([
        "google_turn_1",
        "google_turn_2",
        "google_turn_3",
      ]);
      expect(executeTool).toHaveBeenCalledTimes(2);
      const sentTypes = requestNextTurn.mock.calls[1][0].map((step: GoogleStep) =>
        step.type === "function_call" || step.type === "function_result"
          ? `${step.type}:${String(step.type === "function_call" ? step.id : step.call_id)}`
          : step.type);
      expect(sentTypes).toEqual([
        "user_input",
        "function_call:google_call_1",
        "function_result:google_call_1",
        "function_call:google_call_2",
        "function_result:google_call_2",
      ]);
    });
  });

  describe("una respuesta sin tool calls sale en la primera vuelta", () => {
    it("Anthropic no ejecuta tools ni vuelve a llamar al modelo", async () => {
      const initialTurn = anthropicTextTurn("Hola.");
      const requestNextTurn = vi.fn();
      const executeTool = vi.fn();

      const result = await runAnthropicToolLoop({
        initialTurn,
        initialMessages: [{ role: "user", content: "Hola" }],
        requestNextTurn,
        executeTool,
      });

      expect(result).toBe(initialTurn);
      expect(executeTool).not.toHaveBeenCalled();
      expect(requestNextTurn).not.toHaveBeenCalled();
    });

    it("OpenAI no ejecuta tools ni vuelve a llamar al modelo", async () => {
      const initialTurn = openAITextTurn("resp_1", "Hola.");
      const requestNextTurn = vi.fn();
      const executeTool = vi.fn();

      const result = await runOpenAIToolLoop({ initialTurn, requestNextTurn, executeTool });

      expect(result).toBe(initialTurn);
      expect(executeTool).not.toHaveBeenCalled();
      expect(requestNextTurn).not.toHaveBeenCalled();
    });

    it("Google no ejecuta tools ni vuelve a llamar al modelo", async () => {
      const requestNextTurn = vi.fn();
      const executeTool = vi.fn();

      const result = await runGoogleToolLoop({
        initialTurn: googleTextTurn("google_turn_1", "Hola."),
        initialMessages: [{ type: "user_input", content: [{ type: "text", text: "Hola" }] }],
        requestNextTurn,
        executeTool,
      });

      expect(result.content).toBe("Hola.");
      expect(executeTool).not.toHaveBeenCalled();
      expect(requestNextTurn).not.toHaveBeenCalled();
    });
  });

  describe("un proveedor que pide tools sin parar se detiene en MAX_TOOL_ROUNDS", () => {
    it("el tope por defecto es de 10 rondas", () => {
      expect(MAX_TOOL_ROUNDS).toBe(10);
    });

    // Comportamiento actual, no deseado: Anthropic y OpenAI salen del bucle sin avisar
    // y devuelven un turno que aún pide tools. El llamador lo ve como «no devolvió contenido».
    it("Anthropic ejecuta 10 rondas y devuelve, sin error, el turno que sigue pidiendo tools", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => anthropicToolTurn(`toolu_${++round}`));
      const executeTool = numberedExecuteTool();

      const result = await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [{ role: "user", content: "Bucle" }],
        requestNextTurn,
        executeTool,
      });

      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestNextTurn).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(result.contentBlocks).toEqual(anthropicToolTurn("toolu_10").contentBlocks);
    });

    it("OpenAI ejecuta 10 rondas y devuelve, sin error, el turno que sigue pidiendo tools", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => {
        round += 1;
        return openAIToolTurn(`resp_${round}`, `call_${round}`);
      });
      const executeTool = numberedExecuteTool();

      const result = await runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn,
        executeTool,
      });

      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestNextTurn).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(result.outputItems[0]).toMatchObject({ type: "function_call", call_id: "call_10" });
    });

    it("Google ejecuta 10 rondas y falla de forma explícita", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => {
        round += 1;
        return googleToolTurn(`google_turn_${round}`, `google_call_${round}`);
      });
      const executeTool = numberedExecuteTool();

      await expect(runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [{ type: "user_input", content: [{ type: "text", text: "Bucle" }] }],
        requestNextTurn,
        executeTool,
      })).rejects.toThrow("al alcanzar el límite de rondas");

      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestNextTurn).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    });

    it("respeta un maxRounds menor en los tres proveedores", async () => {
      let anthropicRound = 0;
      const anthropicTool = numberedExecuteTool();
      await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => anthropicToolTurn(`toolu_${++anthropicRound}`),
        executeTool: anthropicTool,
        maxRounds: 2,
      });

      let openAIRound = 0;
      const openAITool = numberedExecuteTool();
      await runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn: async () => {
          openAIRound += 1;
          return openAIToolTurn(`resp_${openAIRound}`, `call_${openAIRound}`);
        },
        executeTool: openAITool,
        maxRounds: 2,
      });

      let googleRound = 0;
      const googleTool = numberedExecuteTool();
      await expect(runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [],
        requestNextTurn: async () => {
          googleRound += 1;
          return googleToolTurn(`google_turn_${googleRound}`, `google_call_${googleRound}`);
        },
        executeTool: googleTool,
        maxRounds: 2,
      })).rejects.toThrow("al alcanzar el límite de rondas");

      expect([
        anthropicTool.mock.calls.length,
        openAITool.mock.calls.length,
        googleTool.mock.calls.length,
      ]).toEqual([2, 2, 2]);
    });
  });
});
