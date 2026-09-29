import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderConfiguration } from "./providerConfiguration";
import { createOpenAIStreamParser, type OpenAIResponseOutputItem } from "./providerStreamParsers";
import { identifyToolOperation, type ToolCallEnvelope } from "./toolOperationLedger";

const sent: Array<Record<string, unknown>> = [];
const turns: OpenAIResponseOutputItem[][] = [];
let failAtRequest = 0;

vi.mock("./providerStreamTransport", () => ({
  streamOpenAIRequestViaFetch: vi.fn(async (
    _url: string,
    _headers: Record<string, string>,
    body: Record<string, unknown>,
    handlers: Parameters<typeof createOpenAIStreamParser>[0],
  ) => {
    sent.push(JSON.parse(JSON.stringify(body)) as Record<string, unknown>);
    if (sent.length === failAtRequest) {
      throw new Error("red interrumpida");
    }
    const output = turns.shift();
    if (!output) throw new Error("Falta una ronda del proveedor falso.");
    const parser = createOpenAIStreamParser(handlers);
    const summary = output.find((item) => item.type === "reasoning" && item.summary?.length);
    if (summary?.type === "reasoning") {
      const delta = summary.summary?.map((part) => part.text ?? "").join("") ?? "";
      parser.push(`event: response.reasoning_summary_text.delta\ndata: ${JSON.stringify({
        type: "response.reasoning_summary_text.delta", delta,
      })}\n\n`);
    }
    const final = output.some((item) => item.type === "message" && item.phase === "final_answer");
    if (final) {
      parser.push('event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hecho."}\n\n');
    }
    parser.push(`event: response.completed\ndata: ${JSON.stringify({
      type: "response.completed",
      response: { id: `resp_${sent.length}`, output },
    })}\n\n`);
    return parser.finish();
  }),
  streamOpenAIRequestViaXHR: vi.fn(),
  streamAnthropicRequestViaXHR: vi.fn(),
}));

const { requestProviderToolChat } = await import("./providerToolClient");

const provider: ProviderConfiguration = {
  provider: "openai",
  api_key: "fixture",
  model: "fixture-model",
  is_active: true,
  reasoning_effort: "medium",
};
const runtime = { fakeMode: false, platform: "web" as const };

beforeEach(() => {
  sent.length = 0;
  turns.length = 0;
  failAtRequest = 0;
});

describe("OpenAI Responses sin estado remoto", () => {
  it("combina eventos SSE sin perder contenido cifrado ni phase", () => {
    const parser = createOpenAIStreamParser();
    parser.push(`event: response.output_item.done\ndata: ${JSON.stringify({
      type: "response.output_item.done", output_index: 0,
      item: { type: "reasoning", id: "rs_1", encrypted_content: "cifrado" },
    })}\n\n`);
    parser.push(`event: response.output_item.done\ndata: ${JSON.stringify({
      type: "response.output_item.done", output_index: 1,
      item: { type: "message", id: "msg_1", role: "assistant", phase: "final_answer",
        content: [{ type: "output_text", text: "Hecho." }] },
    })}\n\n`);
    parser.push(`event: response.completed\ndata: ${JSON.stringify({
      type: "response.completed", response: { id: "resp_1", output: [
        { type: "reasoning", id: "rs_1" },
        { type: "message", id: "msg_1", content: [{ type: "output_text", text: "Hecho." }] },
      ] },
    })}\n\n`);
    const result = parser.finish();
    expect(result.truncated).toBe(false);
    expect(result.content).toBe("Hecho.");
    expect(result.outputItems).toMatchObject([
      { type: "reasoning", encrypted_content: "cifrado" },
      { type: "message", role: "assistant", phase: "final_answer" },
    ]);
  });

  it("reproduce el razonamiento cifrado, mensajes y varias tools a través de dos rondas", async () => {
    turns.push(
      [
        { type: "reasoning", id: "rs_1", encrypted_content: "cifrado_1",
          summary: [{ type: "summary_text", text: "Plan" }] },
        { type: "message", id: "msg_1", role: "assistant", phase: "commentary",
          content: [{ type: "output_text", text: "Consulto datos" }] },
        { type: "function_call", id: "fc_1", call_id: "call_1", name: "read_field_value",
          arguments: '{"key":"Objetivo"}' },
        { type: "function_call", id: "fc_2", call_id: "call_2", name: "read_field_value",
          arguments: '{"key":"Peso"}' },
      ],
      [
        { type: "reasoning", id: "rs_2", encrypted_content: "cifrado_2" },
        { type: "function_call", id: "fc_3", call_id: "call_3", name: "read_field_value",
          arguments: '{"key":"Altura"}' },
      ],
      [{ type: "message", id: "msg_final", role: "assistant", phase: "final_answer",
        content: [{ type: "output_text", text: "Hecho." }] }],
    );
    const history = [{ role: "user" as const, content: "Revisa mis datos" }];
    const executeTool = vi.fn(async (_name: string, args: Record<string, unknown>) => `valor:${args.key}`);
    const onContentDelta = vi.fn();

    const result = await requestProviderToolChat(provider, history, runtime, {
      executeTool, executionId: "turno_1", onContentDelta,
    });

    expect(result.content).toBe("Hecho.");
    expect(result.thinking).toBe("Plan");
    expect(onContentDelta).toHaveBeenCalledWith("Hecho.", "Hecho.");
    expect(executeTool.mock.calls).toHaveLength(3);
    expect(history).toEqual([{ role: "user", content: "Revisa mis datos" }]);
    expect(sent).toHaveLength(3);
    for (const body of sent) {
      expect(body).toMatchObject({ store: false, include: ["reasoning.encrypted_content"] });
      expect(body).not.toHaveProperty("previous_response_id");
      expect(body).toHaveProperty("instructions");
      expect(body).toHaveProperty("tools");
    }
    expect(sent[0].input).toEqual(history);
    expect(sent[1].input).toEqual([
      ...history,
      { type: "reasoning", id: "rs_1", encrypted_content: "cifrado_1",
        summary: [{ type: "summary_text", text: "Plan" }] },
      { type: "message", id: "msg_1", role: "assistant", phase: "commentary",
        content: [{ type: "output_text", text: "Consulto datos" }] },
      { type: "function_call", id: "fc_1", call_id: "call_1", name: "read_field_value",
        arguments: '{"key":"Objetivo"}' },
      { type: "function_call", id: "fc_2", call_id: "call_2", name: "read_field_value",
        arguments: '{"key":"Peso"}' },
      { type: "function_call_output", call_id: "call_1", output: "valor:Objetivo" },
      { type: "function_call_output", call_id: "call_2", output: "valor:Peso" },
    ]);
    expect((sent[2].input as unknown[]).slice(-3)).toEqual([
      { type: "reasoning", id: "rs_2", encrypted_content: "cifrado_2" },
      { type: "function_call", id: "fc_3", call_id: "call_3", name: "read_field_value",
        arguments: '{"key":"Altura"}' },
      { type: "function_call_output", call_id: "call_3", output: "valor:Altura" },
    ]);
    expect(JSON.stringify(result)).not.toContain("cifrado_");
  });

  it("mantiene la identidad de la tool entre reintentos y no repite una escritura confirmada", async () => {
    const toolCall: OpenAIResponseOutputItem = {
      type: "function_call", id: "fc_write", call_id: "call_write", name: "write_field_value",
      arguments: '{"key":"Objetivo","value":"fuerza"}',
    };
    const committed = new Map<string, string>();
    const write = vi.fn(async () => "guardado");
    const executeTool = async (_name: string, _args: Record<string, unknown>, call: ToolCallEnvelope) => {
      const id = identifyToolOperation(call).operationId;
      const previous = committed.get(id);
      if (previous) return previous;
      const result = await write();
      committed.set(id, result);
      return result;
    };
    turns.push([toolCall]);
    failAtRequest = 2;
    // El proveedor falla al continuar después de que la primera tool ya se ejecutó.
    await expect(requestProviderToolChat(provider, [{ role: "user", content: "Guarda" }], runtime,
      { executeTool, executionId: "turno_reintentado" })).rejects.toThrow("red interrumpida");
    failAtRequest = 0;
    turns.push([{ ...toolCall, id: "fc_write_retry", call_id: "call_write_retry" }],
      [{ type: "message", phase: "final_answer",
      content: [{ type: "output_text", text: "Hecho." }] }]);
    const result = await requestProviderToolChat(provider, [{ role: "user", content: "Guarda" }], runtime,
      { executeTool, executionId: "turno_reintentado" });
    expect(result.content).toBe("Hecho.");
    expect(write).toHaveBeenCalledTimes(1);
    expect(sent[2].input).toEqual([{ role: "user", content: "Guarda" }]);
    expect(JSON.stringify(sent[3].input)).toContain("call_write_retry");
    expect(JSON.stringify(sent[3].input)).not.toContain('"call_write"');
  });
});
