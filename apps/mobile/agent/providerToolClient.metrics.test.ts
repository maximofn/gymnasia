import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderConfiguration } from "./providerConfiguration";
import { MAX_TOOL_ROUNDS } from "./providerToolLoop";
import { formatToolInputError } from "./toolDefinitions";
import type { ToolLoopTraceEvent } from "./toolLoopMetrics";

// Proveedor falso guiado por un guion: cada petición consume una entrada con las
// tools que "pide el modelo". Sin entradas, responde con texto final. Una entrada
// "forever" pide tools para siempre (salvo cuando se le prohíben).
type ScriptedCall = { name: string; args: Record<string, unknown> | string };
type Step = ScriptedCall[];
let script: Step[] = [];
let forever: ScriptedCall | null = null;
const sent: unknown[] = [];

function nextCalls(closing: boolean): ScriptedCall[] {
  if (closing) return [];
  if (forever) return [forever];
  return script.shift() ?? [];
}

function rawArgs(call: ScriptedCall): string {
  return typeof call.args === "string" ? call.args : JSON.stringify(call.args);
}

function objectArgs(call: ScriptedCall): Record<string, unknown> {
  return typeof call.args === "string" ? {} : call.args;
}

const FINAL = "Respuesta final.";

vi.mock("./providerStreamTransport", () => ({
  streamOpenAIRequestViaFetch: vi.fn(async (
    _url: string, _headers: unknown, body: Record<string, unknown>,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(structuredClone(body));
    const n = sent.length;
    const calls = nextCalls(body.tool_choice === "none");
    const usage = { inputTokens: 100 * n, outputTokens: 10 };
    if (calls.length === 0) {
      handlers?.onContentDelta?.(FINAL);
      return { responseId: `r${n}`, content: FINAL, thinking: null, truncated: false, outputItems: [{ type: "message" }], usage };
    }
    return { responseId: `r${n}`, content: "", thinking: null, truncated: false, usage,
      outputItems: calls.map((call, i) => ({ type: "function_call", id: `fc_${n}_${i}`, call_id: `call_${n}_${i}`,
        name: call.name, arguments: rawArgs(call) })) };
  }),
  streamOpenAIRequestViaXHR: vi.fn(),
  streamAnthropicRequestViaXHR: vi.fn(async (
    _url: string, _headers: unknown, body: Record<string, unknown>,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(structuredClone(body));
    const n = sent.length;
    const calls = nextCalls((body.tool_choice as { type?: string } | undefined)?.type === "none");
    const usage = { inputTokens: 100 * n, outputTokens: 10 };
    if (calls.length === 0) {
      handlers?.onContentDelta?.(FINAL);
      return { content: FINAL, thinking: null, stopReason: "end_turn", truncated: false, usage,
        contentBlocks: [{ type: "text", text: FINAL }] };
    }
    return { content: "", thinking: null, stopReason: "tool_use", truncated: false, usage,
      contentBlocks: calls.map((call, i) => ({ type: "tool_use", id: `toolu_${n}_${i}`, name: call.name, input: objectArgs(call) })) };
  }),
}));

vi.mock("./providerChatClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("./providerChatClient")>(),
  requestGoogleProviderInteraction: vi.fn(async (
    _provider: unknown, options: Record<string, unknown>, _runtime: unknown,
    handlers?: { onContentDelta?: (delta: string) => void },
  ) => {
    sent.push(structuredClone(options));
    const n = sent.length;
    const calls = nextCalls(options.toolChoice === "none");
    const usage = { total_input_tokens: 100 * n, total_output_tokens: 10 };
    if (calls.length === 0) {
      handlers?.onContentDelta?.(FINAL);
      return { interactionId: "", status: "completed", content: FINAL, thinking: null, usage,
        steps: [{ type: "model_output", content: [{ type: "text", text: FINAL }] }] };
    }
    return { interactionId: "", status: "requires_action", content: "", thinking: null, usage,
      steps: calls.map((call, i) => ({ type: "function_call", id: `g_${n}_${i}`, name: call.name, arguments: objectArgs(call) })) };
  }),
}));

vi.mock("./customOpenAIChat", async (importOriginal) => ({
  ...await importOriginal<typeof import("./customOpenAIChat")>(),
  requestCustomOpenAIChat: vi.fn(async (
    _provider: unknown, messages: unknown[],
    options: { toolChoice?: string; onContentDelta?: (delta: string) => void },
  ) => {
    sent.push({ messages: structuredClone(messages), tool_choice: options.toolChoice });
    const n = sent.length;
    const calls = nextCalls(options.toolChoice === "none");
    if (calls.length === 0) {
      options.onContentDelta?.(FINAL);
      return { content: FINAL, toolCalls: [] };
    }
    return { content: "", toolCalls: calls.map((call, i) => ({ id: `call_${n}_${i}`, type: "function",
      function: { name: call.name, arguments: rawArgs(call) } })) };
  }),
}));

const { requestProviderToolChat } = await import("./providerToolClient");

const KINDS = ["openai", "anthropic", "google", "custom_openai"] as const;
type Kind = typeof KINDS[number];

function provider(kind: Kind): ProviderConfiguration {
  return {
    provider: kind, api_key: "fixture", model: "fixture-model", is_active: true, reasoning_effort: "medium",
    ...(kind === "custom_openai" ? { base_url: "https://llm.example.test/v1" } : {}),
  } as ProviderConfiguration;
}

// Cada resultado lleva un número de orden, para comprobar que se reenvían todos y en orden.
let executed = 0;
const executeTool = vi.fn(async (_name: string, args: Record<string, unknown>) => {
  executed += 1;
  if (args.invalid) return { output: formatToolInputError(["Falta el campo requerido \"key\"."]), isError: true };
  return `observacion_${executed}`;
});

async function chat(kind: Kind, measured = true, userText = "Revisa mis datos") {
  const events: ToolLoopTraceEvent[] = [];
  let error: unknown;
  let content: string | undefined;
  try {
    content = (await requestProviderToolChat(
      provider(kind),
      [{ role: "user", content: userText }],
      { fakeMode: false, platform: "web" },
      {
        executeTool,
        now: () => new Date("2026-11-25T10:00:00Z"),
        ...(measured ? { toolLoopDiagnostics: { onEvent: (event: ToolLoopTraceEvent) => events.push(event) } } : {}),
      },
    )).content;
  } catch (caught) {
    error = caught;
  }
  const rounds = events.filter((event): event is Extract<ToolLoopTraceEvent, { phase: "round" }> => event.phase === "round");
  const finished = events.find((event): event is Extract<ToolLoopTraceEvent, { phase: "loop_finished" }> =>
    event.phase === "loop_finished");
  return { content, error, events, rounds, finished };
}

beforeEach(() => {
  script = [];
  forever = null;
  sent.length = 0;
  executed = 0;
  executeTool.mockClear();
});

describe.each(KINDS)("medidas del bucle con proveedor falso: %s", (kind) => {
  it("una traza de 3 vueltas termina en la respuesta esperada y se mide entera", async () => {
    script = [
      [{ name: "read_field_value", args: { key: "peso" } }],
      [{ name: "read_measurement", args: { invalid: true } }, { name: "read_field_value", args: { key: "altura" } }],
    ];
    const { content, rounds, finished } = await chat(kind);

    expect(content).toBe(FINAL);
    expect(rounds.map((round) => round.round)).toEqual([0, 1, 2]);
    expect(rounds.map((round) => round.calls.map((call) => call.outcome))).toEqual([["ok"], ["error", "ok"], []]);
    expect(rounds[1].calls[0]).toMatchObject({ toolName: "read_measurement", errorCode: "invalid_tool_arguments", issueCount: 1 });
    expect(finished).toMatchObject({ outcome: "answered", rounds: 3, toolCalls: 3, failedCalls: 1 });
    if (kind === "custom_openai") {
      expect(finished).toMatchObject({ inputTokens: null, outputTokens: null });
    } else {
      expect(finished).toMatchObject({ inputTokens: 600, outputTokens: 30 });
    }
  });

  it("en la vuelta N se reenvían todas las observaciones anteriores, en orden", async () => {
    script = [
      [{ name: "read_field_value", args: { key: "a" } }],
      [{ name: "read_field_value", args: { key: "b" } }, { name: "read_field_value", args: { key: "c" } }],
      [{ name: "read_field_value", args: { key: "d" } }],
    ];
    await chat(kind);

    for (let n = 1; n < sent.length; n += 1) {
      const body = JSON.stringify(sent[n]);
      const expected = { 1: 1, 2: 3, 3: 4 }[n] ?? 0;
      const positions = Array.from({ length: expected }, (_, i) => body.indexOf(`observacion_${i + 1}`));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((left, right) => left - right));
      expect(body).not.toContain(`observacion_${expected + 1}`);
    }
  });

  it("un proveedor que nunca termina se corta en el límite y devuelve una respuesta utilizable", async () => {
    forever = { name: "read_field_value", args: { key: "otra" } };
    let counter = 0;
    // Argumentos distintos en cada vuelta para que no los corte la protección de lecturas repetidas.
    Object.defineProperty(forever, "args", { get: () => ({ key: `otra_${counter++}` }) });
    const { content, rounds, finished } = await chat(kind);

    expect(content).toBe(FINAL);
    expect(rounds).toHaveLength(MAX_TOOL_ROUNDS + 2);
    expect(rounds.at(-1)).toMatchObject({ closing: true, calls: [] });
    expect(rounds.at(-2)!.calls.map((call) => call.outcome)).toEqual(["not_executed"]);
    expect(finished).toMatchObject({ outcome: "round_limit", rounds: MAX_TOOL_ROUNDS + 2 });
  });

  it("la protección corta un bucle que repite la misma consulta", async () => {
    forever = { name: "read_field_value", args: { key: "peso" } };
    const { rounds } = await chat(kind);

    const outcomes = rounds.flatMap((round) => round.calls.map((call) => call.errorCode ?? call.outcome));
    expect(outcomes.slice(0, 3)).toEqual(["ok", "ok", "repeated_tool_call"]);
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it("medir no cambia nada de lo que se envía al proveedor", async () => {
    const scenario = () => [
      [{ name: "read_field_value", args: { key: "a" } }],
      [{ name: "tool_inventada", args: "{roto" }],
    ];
    script = scenario();
    await chat(kind, false);
    const unmeasured = structuredClone(sent);
    sent.length = 0;
    executed = 0;
    script = scenario();
    await chat(kind, true);
    expect(sent).toEqual(unmeasured);
  });

  it("ningún evento contiene argumentos, resultados, texto del usuario ni tools inventadas", async () => {
    script = [
      [{ name: "read_field_value", args: { key: "SECRETO_ARG" } }, { name: "SECRETO_TOOL", args: "{\"x\":\"SECRETO_ARG\"}" }],
    ];
    executeTool.mockImplementationOnce(async () => "SECRETO_RESULTADO");
    const { events } = await chat(kind, true, "SECRETO_USUARIO");

    expect(JSON.stringify(events)).not.toMatch(/SECRETO|observacion|call_|toolu_|g_\d/);
  });
});

describe("contrato del formato de las medidas", () => {
  it("cada tipo de evento tiene exactamente estos campos", async () => {
    script = [[{ name: "read_field_value", args: { key: "a" } }]];
    const { rounds, finished } = await chat("openai");

    expect(Object.keys(rounds[0]).sort()).toEqual([
      "calls", "closing", "contextChars", "contextMessages", "inputTokens", "loopId", "outputTokens",
      "phase", "provider", "providerMs", "round",
    ]);
    expect(Object.keys(rounds[0].calls[0]).sort()).toEqual([
      "argumentsParsed", "effect", "errorCode", "issueCount", "outcome", "toolName",
    ]);
    expect(Object.keys(finished!).sort()).toEqual([
      "durationMs", "failedCalls", "finalContextChars", "inputTokens", "loopId", "outcome", "outputTokens",
      "phase", "provider", "rounds", "toolCalls",
    ]);
  });
});

describe("propiedades del bucle medido", () => {
  const call = fc.record({
    name: fc.constantFrom("read_field_value", "read_measurement", "tool_inventada"),
    args: fc.oneof(
      fc.record({ key: fc.constantFrom("a", "b", "c") }),
      fc.constant({ invalid: true }),
      fc.constant("{roto"),
    ),
  });

  it("nunca pasa del límite de vueltas más el cierre, y la conversación nunca se acorta", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...KINDS),
      fc.array(fc.array(call, { minLength: 1, maxLength: 3 }), { maxLength: MAX_TOOL_ROUNDS + 3 }),
      async (kind, steps) => {
        script = steps.map((step) => step.map((item) => ({ ...item })));
        forever = null;
        sent.length = 0;
        executed = 0;
        const { rounds, finished } = await chat(kind);

        expect(finished).toBeDefined();
        expect(rounds.length).toBe(finished!.rounds);
        expect(rounds.length).toBeLessThanOrEqual(MAX_TOOL_ROUNDS + 2);
        expect(rounds.length).toBe(sent.length);
        expect(rounds.map((round) => round.round)).toEqual(rounds.map((_, index) => index));
        for (let i = 1; i < rounds.length; i += 1) {
          expect(rounds[i].contextChars).toBeGreaterThanOrEqual(rounds[i - 1].contextChars);
        }
        expect(finished!.toolCalls).toBe(rounds.reduce((total, round) => total + round.calls.length, 0));
      },
    ), { numRuns: 60 });
  });
});
