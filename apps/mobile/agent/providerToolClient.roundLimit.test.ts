import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildGoogleInteractionRequest } from "./googleContextBudget";
import type { ProviderConfiguration } from "./providerConfiguration";
import {
  MAX_TOOL_ROUNDS,
  ROUND_LIMIT_CLOSING_INSTRUCTION,
  ROUND_LIMIT_TOOL_RESULT,
  ROUND_LIMIT_USER_MESSAGE,
} from "./providerToolLoop";

// Proveedores falsos que piden una tool en cada turno salvo cuando se les prohíben.
// Cada cuerpo enviado se guarda para comprobar el contrato de la llamada de cierre.
const sent: Array<Record<string, unknown>> = [];
let closingFails = false;
let narrateRounds = false;
let closingInsists = false;
const INTERMEDIATE = "Voy a mirar tus datos. ";

vi.mock("./providerStreamTransport", () => ({
  streamOpenAIRequestViaFetch: vi.fn(async (
    _url: string,
    _headers: Record<string, string>,
    body: Record<string, unknown>,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(body);
    const round = sent.length;
    if (body.tool_choice === "none") {
      if (closingFails) throw new Error("OpenAI error 500");
      handlers?.onContentDelta?.("Respuesta de cierre.");
      return { responseId: `resp_${round}`, content: "Respuesta de cierre.", thinking: null,
        truncated: false, outputItems: [{ type: "message" }] };
    }
    if (narrateRounds) handlers?.onContentDelta?.(INTERMEDIATE);
    return { responseId: `resp_${round}`, content: "", thinking: null, truncated: false,
      outputItems: [{ type: "function_call", id: `fc_${round}`, call_id: `call_${round}`,
        name: "read_field_value", arguments: "{}" }] };
  }),
  streamOpenAIRequestViaXHR: vi.fn(),
  streamAnthropicRequestViaXHR: vi.fn(async (
    _url: string,
    _headers: Record<string, string>,
    body: Record<string, unknown>,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(body);
    const round = sent.length;
    const closingCall = (body.tool_choice as { type?: string } | undefined)?.type === "none";
    if (closingCall && !closingInsists) {
      handlers?.onContentDelta?.("Respuesta de cierre.");
      return { content: "Respuesta de cierre.", thinking: null, stopReason: "end_turn",
        contentBlocks: [{ type: "text", text: "Respuesta de cierre." }] };
    }
    if (narrateRounds) handlers?.onContentDelta?.(INTERMEDIATE);
    return { content: "", thinking: null, stopReason: "tool_use",
      contentBlocks: [{ type: "tool_use", id: `toolu_${round}`, name: "read_field_value", input: {} }] };
  }),
}));

vi.mock("./providerChatClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("./providerChatClient")>(),
  requestGoogleProviderInteraction: vi.fn(async (
    _provider: ProviderConfiguration,
    options: Record<string, unknown>,
    _runtime: unknown,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(options);
    const round = sent.length;
    if (options.toolChoice === "none") {
      handlers?.onContentDelta?.("Respuesta de cierre.");
      return { interactionId: "", status: "completed", content: "Respuesta de cierre.", thinking: null,
        usage: {}, steps: [{ type: "model_output", content: [{ type: "text", text: "Respuesta de cierre." }] }] };
    }
    return { interactionId: "", status: "requires_action", content: "", thinking: null, usage: {},
      steps: [{ type: "function_call", id: `google_call_${round}`, name: "read_field_value", arguments: {} }] };
  }),
}));

vi.mock("./customOpenAIChat", async (importOriginal) => ({
  ...await importOriginal<typeof import("./customOpenAIChat")>(),
  requestCustomOpenAIChat: vi.fn(async (
    _provider: ProviderConfiguration,
    messages: Array<Record<string, unknown>>,
    options: { toolChoice?: string; onContentDelta?: (delta: string) => void },
  ) => {
    sent.push({ messages: structuredClone(messages), tool_choice: options.toolChoice });
    const round = sent.length;
    if (options.toolChoice === "none") {
      options.onContentDelta?.("Respuesta de cierre.");
      return { content: "Respuesta de cierre.", toolCalls: [] };
    }
    if (narrateRounds) options.onContentDelta?.(INTERMEDIATE);
    return { content: narrateRounds ? INTERMEDIATE : "", toolCalls: [{ id: `call_${round}`, type: "function",
      function: { name: "read_field_value", arguments: "{}" } }] };
  }),
}));

const { requestProviderToolChat } = await import("./providerToolClient");

function provider(kind: ProviderConfiguration["provider"]): ProviderConfiguration {
  return {
    provider: kind,
    api_key: "fixture",
    model: "fixture-model",
    is_active: true,
    reasoning_effort: "medium",
    ...(kind === "custom_openai" ? { base_url: "https://llm.example.test/v1" } : {}),
  } as ProviderConfiguration;
}

async function chat(kind: ProviderConfiguration["provider"]) {
  const executeTool = vi.fn(async () => "resultado");
  const result = await requestProviderToolChat(
    provider(kind),
    [{ role: "user", content: "Haz muchas cosas" }],
    { fakeMode: false, platform: "web" },
    { executeTool },
  );
  return { result, executeTool };
}

beforeEach(() => {
  sent.length = 0;
  closingFails = false;
  narrateRounds = false;
  closingInsists = false;
});

describe("cliente del chat al agotar las rondas de tools", () => {
  it("OpenAI cierra con tool_choice none, conserva las tools y responde con texto", async () => {
    const { result, executeTool } = await chat("openai");

    expect(result.content).toBe("Respuesta de cierre.");
    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(sent).toHaveLength(MAX_TOOL_ROUNDS + 2);
    const closing = sent.at(-1)!;
    expect(closing.tool_choice).toBe("none");
    expect(closing.tools).toBeDefined();
    expect((closing.input as Array<Record<string, unknown>>).slice(-2)).toEqual([{
      type: "function_call", id: `fc_${MAX_TOOL_ROUNDS + 1}`,
      call_id: `call_${MAX_TOOL_ROUNDS + 1}`, name: "read_field_value", arguments: "{}",
    }, {
      type: "function_call_output",
      call_id: `call_${MAX_TOOL_ROUNDS + 1}`,
      output: ROUND_LIMIT_TOOL_RESULT,
    }]);
    expect((closing.input as unknown[])).toHaveLength(1 + 2 * (MAX_TOOL_ROUNDS + 1));
    expect(sent.every((body) => body.store === false && !("previous_response_id" in body))).toBe(true);
    expect(sent.every((body) => Array.isArray(body.input))).toBe(true);
    expect(sent.every((body) => JSON.stringify(body.include) === '["reasoning.encrypted_content"]')).toBe(true);
    expect(sent.slice(0, -1).every((body) => body.tool_choice === undefined)).toBe(true);
    // La instrucción de cierre va en las instrucciones de sistema, y solo en esa llamada.
    expect(closing.instructions).toContain(ROUND_LIMIT_CLOSING_INSTRUCTION);
    expect(sent.slice(0, -1).some((body) => String(body.instructions).includes(ROUND_LIMIT_CLOSING_INSTRUCTION)))
      .toBe(false);
  });

  it("Anthropic cierra con tool_choice {type: none} sin quitar la lista de tools", async () => {
    const { result, executeTool } = await chat("anthropic");

    expect(result.content).toBe("Respuesta de cierre.");
    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    const closing = sent.at(-1)!;
    expect(closing.tool_choice).toEqual({ type: "none" });
    // El historial contiene tool_use: sin la lista de tools, Anthropic rechazaría la petición.
    expect(closing.tools).toBeDefined();
    expect(closing.system).toContain(ROUND_LIMIT_CLOSING_INSTRUCTION);
    expect(sent.slice(0, -1).some((body) => String(body.system).includes(ROUND_LIMIT_CLOSING_INSTRUCTION)))
      .toBe(false);
    const messages = closing.messages as Array<{ role: string; content: unknown }>;
    expect(messages.at(-1)).toEqual({ role: "user", content: [{
      type: "tool_result", tool_use_id: `toolu_${MAX_TOOL_ROUNDS + 1}`, content: ROUND_LIMIT_TOOL_RESULT,
    }] });
  });

  it("Google cierra pidiendo toolChoice none y guarda la respuesta en el turno persistido", async () => {
    const { result, executeTool } = await chat("google");

    expect(result.content).toBe("Respuesta de cierre.");
    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(sent.at(-1)!.toolChoice).toBe("none");
    expect(sent.every((options) => (options.contextBudget as { maxExchanges: number }).maxExchanges === 20))
      .toBe(true);
    expect(sent.slice(0, -1).every((options) => options.toolChoice === undefined)).toBe(true);
    expect(sent.at(-1)!.systemInstruction).toContain(ROUND_LIMIT_CLOSING_INSTRUCTION);
    expect(sent.slice(0, -1).some((options) =>
      String(options.systemInstruction).includes(ROUND_LIMIT_CLOSING_INSTRUCTION))).toBe(false);
    const steps = result.googleTurn!.steps;
    expect(steps.at(-2)).toMatchObject({ type: "function_result",
      result: [{ type: "text", text: ROUND_LIMIT_TOOL_RESULT }] });
    expect(steps.at(-1)).toMatchObject({ type: "model_output" });
  });

  it("OpenAI compatible responde las llamadas pendientes con el resultado sintético y cierra sin tools", async () => {
    const { result, executeTool } = await chat("custom_openai");

    expect(result.content).toBe("Respuesta de cierre.");
    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(sent).toHaveLength(MAX_TOOL_ROUNDS + 2);
    const closing = sent.at(-1)! as { messages: Array<Record<string, unknown>>; tool_choice?: string };
    expect(closing.tool_choice).toBe("none");
    expect(closing.messages[0]).toMatchObject({ role: "system" });
    expect(String(closing.messages[0].content)).toContain(ROUND_LIMIT_CLOSING_INSTRUCTION);
    expect(sent.slice(0, -1).some((body) => JSON.stringify(body).includes(ROUND_LIMIT_CLOSING_INSTRUCTION)))
      .toBe(false);
    expect(closing.messages.at(-1)).toEqual({
      role: "tool", content: ROUND_LIMIT_TOOL_RESULT, tool_call_id: `call_${MAX_TOOL_ROUNDS + 1}`,
    });
  });

  it("si la llamada de cierre falla, el usuario ve el mensaje del límite, no un error genérico", async () => {
    closingFails = true;
    await expect(chat("openai")).rejects.toThrow(ROUND_LIMIT_USER_MESSAGE);
  });

  it("Google envía tool_choice dentro de generation_config, junto al razonamiento", () => {
    // Verificado contra la API el 27-09-2026: en la raíz responde 400 «Unknown parameter 'tool_choice'».
    const body = buildGoogleInteractionRequest({
      model: "gemini-3.8-flash", history: [], tools: [{ type: "function", name: "x" }],
      thinking: true, toolChoice: "none",
    });
    expect(body.tool_choice).toBeUndefined();
    expect(body.generation_config).toEqual({
      thinking_level: "high", thinking_summaries: "auto", tool_choice: "none",
    });
  });

  // Regresión rescatada de una PR alternativa: al agotar las rondas, la frase que el
  // modelo escribe entre rondas («Voy a mirar tus datos…») se devolvía como respuesta final.
  describe("el texto emitido entre rondas nunca se presenta como respuesta final", () => {
    it.each(["openai", "anthropic", "custom_openai"] as const)(
      "%s: la respuesta termina con el texto de cierre, no con la frase intermedia",
      async (kind) => {
        narrateRounds = true;
        const { result } = await chat(kind);
        expect(result.content.endsWith("Respuesta de cierre.")).toBe(true);
      },
    );

    it("Anthropic: si el cierre vuelve a pedir tools, error del límite y no la frase a medias", async () => {
      narrateRounds = true;
      closingInsists = true;
      await expect(chat("anthropic")).rejects.toThrow(ROUND_LIMIT_USER_MESSAGE);
    });
  });
});
