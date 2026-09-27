import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { GoogleInteractionTurn, GoogleStep } from "./googleInteractions";
import {
  MAX_TOOL_ROUNDS,
  ROUND_LIMIT_TOOL_RESULT,
  ROUND_LIMIT_USER_MESSAGE,
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
  ToolRoundLimitError,
  type AnthropicToolTurn,
  type OpenAIToolTurn,
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
function anthropicToolTurn(id: string): AnthropicToolTurn {
  return {
    contentBlocks: [{
      type: "tool_use" as const,
      id,
      name: "read_field_value",
      input: { key: id },
    }],
  };
}

function anthropicTextTurn(text: string): AnthropicToolTurn {
  return { contentBlocks: [{ type: "text" as const, text }] };
}

function openAIToolTurn(responseId: string, callId: string): OpenAIToolTurn {
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

function openAITextTurn(responseId: string, text: string): OpenAIToolTurn {
  return {
    responseId,
    // El bucle solo mira el tipo de cada elemento; el texto va para leer el test.
    outputItems: [{ type: "message", content: [{ type: "output_text", text }] } as { type: string }],
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

  describe("al agotar MAX_TOOL_ROUNDS, una llamada de cierre sin tools contesta al usuario", () => {
    it("el tope por defecto es de 10 rondas", () => {
      expect(MAX_TOOL_ROUNDS).toBe(10);
    });

    it("Anthropic no ejecuta las tools pendientes y cierra con una respuesta de texto", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => anthropicToolTurn(`toolu_${++round}`));
      const closingTurn = anthropicTextTurn("Encontré tu historial, pero no llegué a calcular la marca.");
      const requestClosingTurn = vi.fn(async (_messages: Array<Record<string, unknown>>) => closingTurn);
      const executeTool = numberedExecuteTool();

      const result = await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [{ role: "user", content: "Bucle" }],
        requestNextTurn,
        requestClosingTurn,
        executeTool,
      });

      expect(result).toEqual({ ...closingTurn, roundLimitReached: true });
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(executeTool).not.toHaveBeenCalledWith("read_field_value", { key: "toolu_10" }, expect.anything());
      expect(requestNextTurn).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestClosingTurn).toHaveBeenCalledTimes(1);
      // La petición pendiente sigue en el historial y recibe su resultado sintético con el mismo id.
      expect(requestClosingTurn.mock.calls[0][0].slice(-2)).toEqual([
        { role: "assistant", content: anthropicToolTurn("toolu_10").contentBlocks },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_10", content: ROUND_LIMIT_TOOL_RESULT }] },
      ]);
    });

    it("OpenAI responde las llamadas pendientes sin ejecutarlas y cierra encadenando el response_id", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => {
        round += 1;
        return openAIToolTurn(`resp_${round}`, `call_${round}`);
      });
      const closingTurn = openAITextTurn("resp_cierre", "No me dio tiempo a todo.");
      const requestClosingTurn = vi.fn(async (
        _outputs: Array<Record<string, unknown>>,
        _previousResponseId: string,
      ) => closingTurn);
      const executeTool = numberedExecuteTool();

      const result = await runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn,
        requestClosingTurn,
        executeTool,
      });

      expect(result).toEqual({ ...closingTurn, roundLimitReached: true });
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestClosingTurn).toHaveBeenCalledWith([
        { type: "function_call_output", call_id: "call_10", output: ROUND_LIMIT_TOOL_RESULT },
      ], "resp_10");
    });

    it("Google añade un resultado sintético por llamada pendiente y conserva el cierre en el historial", async () => {
      let round = 0;
      const requestNextTurn = vi.fn(async () => {
        round += 1;
        return googleToolTurn(`google_turn_${round}`, `google_call_${round}`);
      });
      const closingTurn = googleTextTurn("google_cierre", "No me dio tiempo a todo.");
      const requestClosingTurn = vi.fn(async (_messages: GoogleStep[]) => closingTurn);
      const executeTool = numberedExecuteTool();

      const result = await runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [{ type: "user_input", content: [{ type: "text", text: "Bucle" }] }],
        requestNextTurn,
        requestClosingTurn,
        executeTool,
      });

      expect(result.content).toBe("No me dio tiempo a todo.");
      expect(result.roundLimitReached).toBe(true);
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
      expect(requestClosingTurn.mock.calls[0][0].slice(-2)).toEqual([
        { type: "function_call", id: "google_call_10", name: "read_field_value", arguments: { key: "google_call_10" } },
        { type: "function_result", name: "read_field_value", call_id: "google_call_10",
          result: [{ type: "text", text: ROUND_LIMIT_TOOL_RESULT }] },
      ]);
      expect(result.history.at(-1)).toEqual(closingTurn.steps[0]);
      expect(result.interactions.at(-1)?.id).toBe("google_cierre");
    });

    it("una respuesta que termina a tiempo no pasa por la llamada de cierre", async () => {
      const requestClosingTurn = vi.fn();
      const result = await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => anthropicTextTurn("Listo."),
        requestClosingTurn,
        executeTool: numberedExecuteTool(),
      });

      expect(result.roundLimitReached).toBeUndefined();
      expect(requestClosingTurn).not.toHaveBeenCalled();
    });

    it("si la llamada de cierre falla, lanza el error específico del límite con la causa original", async () => {
      const failure = new Error("red caída");
      const attempt = runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn: async () => openAIToolTurn("resp_1", "call_1"),
        requestClosingTurn: async () => { throw failure; },
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      });

      await expect(attempt).rejects.toBeInstanceOf(ToolRoundLimitError);
      await expect(attempt).rejects.toMatchObject({ message: ROUND_LIMIT_USER_MESSAGE, cause: failure });
    });

    it("si el modelo vuelve a pedir tools en la llamada de cierre, lanza el error específico", async () => {
      await expect(runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => anthropicToolTurn("toolu_1"),
        requestClosingTurn: async () => anthropicToolTurn("toolu_2"),
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      })).rejects.toBeInstanceOf(ToolRoundLimitError);

      await expect(runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [],
        requestNextTurn: async () => googleToolTurn("google_turn_1", "google_call_1"),
        requestClosingTurn: async () => googleToolTurn("google_turn_2", "google_call_2"),
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      })).rejects.toBeInstanceOf(ToolRoundLimitError);
    });

    it("sin llamada de cierre (p. ej. el estimador de alimentos), agotar las rondas es el error específico", async () => {
      await expect(runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [],
        requestNextTurn: async () => googleToolTurn("google_turn_1", "google_call_1"),
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      })).rejects.toThrow(ROUND_LIMIT_USER_MESSAGE);
    });

    it("una respuesta final justo en la ronda 10 se acepta sin llamada de cierre", async () => {
      // Frontera del tope: 10 rondas de tools y la undécima llamada ya contesta.
      const closing = vi.fn();
      let anthropicRound = 0;
      const anthropic = await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => (++anthropicRound < MAX_TOOL_ROUNDS
          ? anthropicToolTurn(`toolu_${anthropicRound}`)
          : anthropicTextTurn("Hecho.")),
        requestClosingTurn: closing,
        executeTool: numberedExecuteTool(),
      });

      let openAIRound = 0;
      const openAI = await runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn: async () => (++openAIRound < MAX_TOOL_ROUNDS
          ? openAIToolTurn(`resp_${openAIRound}`, `call_${openAIRound}`)
          : openAITextTurn(`resp_${openAIRound}`, "Hecho.")),
        requestClosingTurn: closing,
        executeTool: numberedExecuteTool(),
      });

      let googleRound = 0;
      const google = await runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [],
        requestNextTurn: async () => (++googleRound < MAX_TOOL_ROUNDS
          ? googleToolTurn(`google_turn_${googleRound}`, `google_call_${googleRound}`)
          : googleTextTurn(`google_turn_${googleRound}`, "Hecho.")),
        requestClosingTurn: closing,
        executeTool: numberedExecuteTool(),
      });

      expect(anthropic.contentBlocks).toEqual([{ type: "text", text: "Hecho." }]);
      expect(openAI.outputItems[0]).toMatchObject({ type: "message" });
      expect(google.content).toBe("Hecho.");
      expect([anthropic.roundLimitReached, openAI.roundLimitReached, google.roundLimitReached])
        .toEqual([undefined, undefined, undefined]);
      expect(closing).not.toHaveBeenCalled();
    });

    it("revisa el truncado en el turno que llega al tope antes de intentar el cierre", async () => {
      const closing = vi.fn();
      let anthropicRound = 0;
      await expect(runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => ({ ...anthropicToolTurn(`toolu_${++anthropicRound}`), truncated: true }),
        requestClosingTurn: closing,
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      })).rejects.toThrow("se cortó antes de completarse");

      await expect(runOpenAIToolLoop({
        initialTurn: openAIToolTurn("resp_0", "call_0"),
        requestNextTurn: async () => ({ ...openAIToolTurn("resp_1", "call_1"), truncated: true }),
        requestClosingTurn: closing,
        executeTool: numberedExecuteTool(),
        maxRounds: 1,
      })).rejects.toThrow("se cortó antes de completarse");

      expect(closing).not.toHaveBeenCalled();
    });

    it("respeta un maxRounds menor en los tres proveedores", async () => {
      const closing = { anthropic: vi.fn(async () => anthropicTextTurn("Cierre.")),
        openai: vi.fn(async () => openAITextTurn("resp_cierre", "Cierre.")),
        google: vi.fn(async () => googleTextTurn("google_cierre", "Cierre.")) };

      let anthropicRound = 0;
      const anthropicTool = numberedExecuteTool();
      await runAnthropicToolLoop({
        initialTurn: anthropicToolTurn("toolu_0"),
        initialMessages: [],
        requestNextTurn: async () => anthropicToolTurn(`toolu_${++anthropicRound}`),
        requestClosingTurn: closing.anthropic,
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
        requestClosingTurn: closing.openai,
        executeTool: openAITool,
        maxRounds: 2,
      });

      let googleRound = 0;
      const googleTool = numberedExecuteTool();
      await runGoogleToolLoop({
        initialTurn: googleToolTurn("google_turn_0", "google_call_0"),
        initialMessages: [],
        requestNextTurn: async () => {
          googleRound += 1;
          return googleToolTurn(`google_turn_${googleRound}`, `google_call_${googleRound}`);
        },
        requestClosingTurn: closing.google,
        executeTool: googleTool,
        maxRounds: 2,
      });

      expect([
        anthropicTool.mock.calls.length,
        openAITool.mock.calls.length,
        googleTool.mock.calls.length,
      ]).toEqual([2, 2, 2]);
      expect([closing.anthropic, closing.openai, closing.google].map((fn) => fn.mock.calls.length))
        .toEqual([1, 1, 1]);
    });
  });
});
