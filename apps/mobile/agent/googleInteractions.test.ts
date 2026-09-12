import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { buildGoogleHistory, isGoogleConversationTurn, type GoogleContent, type GoogleStep } from "./googleInteractions";
import { createGoogleStreamParser } from "./providerStreamParsers";
import { buildGoogleInteractionRequest } from "./providerTransport";
import { runGoogleToolLoop } from "./providerToolLoop";
import { googleInteractionEndpoint, requestGoogleInteraction } from "./googleStreamTransport";
import { identifyToolOperation, ToolOperationLedgerRepository } from "./toolOperationLedger";
import { validateLocalStoreTree } from "../persistence/localStoreRecovery";

function event(type: string, data: Record<string, unknown> = {}) {
  return `event: ${type}\ndata: ${JSON.stringify({ event_type: type, ...data })}\n\n`;
}
const created = event("interaction.created", { interaction: { id: "test-1", status: "in_progress" } });
const start = event("step.start", { index: 0, step: { type: "function_call", id: "call-1", name: "add_meal_food", arguments: {} } });
const args = event("step.delta", { index: 0, delta: { type: "arguments_delta", arguments: '{"food":"café 🥑"}' } });
const stop = event("step.stop", { index: 0 });
const terminal = (status = "requires_action") => event("interaction.completed", {
  interaction: { id: "test-1", status, usage: { total_tokens: 5, total_thought_tokens: 2 } },
});
const done = "event: done\ndata: [DONE]\n\n";
const raw = created + start + args + stop + terminal() + done;
const parse = (value: string) => { const parser = createGoogleStreamParser(); parser.push(value); return parser.finish(); };
const finalRaw = readFileSync(new URL("__fixtures__/raw/google-final.sse", import.meta.url), "utf8");

describe("Google Interactions lifecycle", () => {
  it("assembles opaque thoughts, initial content, repeated text and usage without rewriting fields", () => {
    const signature = "  signed-blob==\n";
    const stream = created
      + event("step.start", { index: 0, step: { type: "thought", provider_extra: { opaque: 1 } } })
      + event("step.delta", { index: 0, delta: { type: "thought_summary", content: { type: "text", text: "Pensando " } } })
      + event("step.delta", { index: 0, delta: { type: "thought_signature", signature } }) + stop
      + event("step.start", { index: 1, step: { type: "model_output", content: [{ type: "text", text: "sí " }] } })
      + event("step.delta", { index: 1, delta: { type: "text", text: "sí " } })
      + event("step.stop", { index: 1 }) + terminal("completed") + done;
    const result = parse(stream);
    expect(result.steps).toEqual([
      { type: "thought", provider_extra: { opaque: 1 }, summary: [{ type: "text", text: "Pensando " }], signature },
      { type: "model_output", content: [{ type: "text", text: "sí sí " }] },
    ]);
    expect(result.content).toBe("sí sí");
    expect(result.usage).toEqual({ total_tokens: 5, total_thought_tokens: 2 });
  });

  it("does not reset arguments or duplicate execution for replayed openings/closings", async () => {
    const turn = parse(created + start + args + start + stop + stop + terminal() + stop + done);
    const executeTool = vi.fn(async () => "saved");
    const request = vi.fn().mockResolvedValueOnce(turn).mockResolvedValueOnce(parse(finalRaw));
    const result = await runGoogleToolLoop({ initialTurn: turn, initialMessages: [], executeTool, requestNextTurn: request });
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.history.filter((step) => step.type === "function_call")).toHaveLength(1);
    expect(request.mock.calls[0][0]).toEqual(request.mock.calls[1][0]);
  });

  it.each([
    ["missing creation", start + args + stop + terminal()],
    ["missing opening", created + args],
    ["different step with same index", created + start + start.replace("call-1", "call-2")],
    ["missing index", created + start.replace('"index":0', '"index":-1')],
    ["delta after close", created + start + args + stop + args],
    ["invalid JSON", created + "data: {broken}\n\n"],
    ["invalid arguments", created + start + args.replace('café 🥑', 'broken\\"') + stop],
    ["array arguments", created + start + event("step.delta", { index: 0, delta: { type: "arguments_delta", arguments: "[]" } }) + stop],
    ["unclosed step", created + start + args + terminal()],
    ["wrong terminal", created + start + args + stop + terminal("failed")],
    ["calls with completed", created + start + args + stop + terminal("completed")],
    ["different interaction", created + start + args + stop + terminal().replace("test-1", "other")],
    ["truncated", raw.slice(0, raw.indexOf("event: interaction.completed"))],
    ["empty", ""],
    ["DONE alone", done],
  ])("rejects %s before tools can execute", (_name, value) => {
    expect(() => parse(value)).toThrow();
  });

  it("keeps failures sticky even if a caller catches push", () => {
    const parser = createGoogleStreamParser();
    expect(() => parser.push(created + args)).toThrow();
    expect(() => parser.finish()).toThrow();
  });

  it("rejects reordered lifecycle events", () => {
    const ordered = [created, start, args, stop, terminal()];
    fc.assert(fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4], { minLength: 5, maxLength: 5 }), (order) => {
      fc.pre(order.some((value, index) => value !== index));
      expect(() => parse(order.map((index) => ordered[index]).join("") + done)).toThrow();
    }));
  });

  it("survives arbitrary byte boundaries and lifecycle replays", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 73 }), { minLength: 1, maxLength: 40 }),
      fc.integer({ min: 0, max: 5 }), (sizes, repeats) => {
        const source = created + start + args + start.repeat(repeats) + stop.repeat(repeats + 1) + terminal() + done;
        const bytes = new TextEncoder().encode(source.replace(/\n/g, "\r\n"));
        const decoder = new TextDecoder(); const parser = createGoogleStreamParser();
        for (let i = 0, n = 0; i < bytes.length; n++) {
          const end = Math.min(i + sizes[n % sizes.length], bytes.length);
          parser.push(decoder.decode(bytes.slice(i, end), { stream: true })); i = end;
        }
        parser.push(decoder.decode());
        expect(parser.finish()).toEqual(parse(raw));
      }), { numRuns: 100 });
  });
});

describe("Google stateless continuation", () => {
  it("uses one explicit REST contract for text, images, tools, thinking and structured JSON", () => {
    const history: GoogleStep[] = [{ type: "user_input", content: [
      { type: "text", text: "Lee la etiqueta" },
      { type: "image", mime_type: "image/jpeg", data: "ZmFrZQ==" },
    ] }];
    const schema = { type: "object", properties: { kcal: { type: "number" } }, required: ["kcal"] };
    const tools = [{ type: "function", name: "lookup", parameters: { type: "object" } }];
    expect(buildGoogleInteractionRequest({ model: "gemini-3.8-flash", history,
      tools, thinking: true, systemInstruction: "Sistema", responseSchema: schema })).toEqual({
      model: "gemini-3.8-flash", input: history, tools, stream: true, store: false,
      system_instruction: "Sistema",
      generation_config: { thinking_level: "high", thinking_summaries: "auto" },
      response_format: { type: "text", mime_type: "application/json", schema },
    });
    const original = [{ role: "user" as const, content: "foto", googleInput: history[0].content as GoogleContent[] }];
    const restored = buildGoogleHistory(original);
    expect(restored).toEqual(history);
    (restored[0].content as Array<Record<string, unknown>>)[0].text = "mutado";
    expect(original[0].googleInput).toEqual(history[0].content);
  });

  it("rejects reused call IDs in a different interaction before a second effect", async () => {
    const executeTool = vi.fn(async () => "saved");
    await expect(runGoogleToolLoop({ initialTurn: parse(raw), initialMessages: [], executeTool,
      requestNextTurn: async () => parse(raw.replaceAll("test-1", "test-2")) })).rejects.toThrow(/ID de herramienta repetido/);
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it("replays full local history, keeps legacy text and isolates each snapshot", async () => {
    const first = parse(raw);
    const user: GoogleStep = { type: "user_input", content: [{ type: "text", text: "añade café" }] };
    const requests: Record<string, unknown>[] = [];
    const result = await runGoogleToolLoop({ initialTurn: first, initialMessages: [user],
      executeTool: async () => "saved", requestNextTurn: async (history) => {
        requests.push(buildGoogleInteractionRequest({ model: "gemini-3.8-flash", history }));
        return parse(finalRaw);
      } });
    expect(requests[0].input).toEqual([user, ...first.steps,
      { type: "function_result", name: "add_meal_food", call_id: "call-1", result: [{ type: "text", text: "saved" }] }]);
    expect(requests[0]).toMatchObject({ store: false, stream: true });
    expect(requests[0]).not.toHaveProperty("previous_interaction_id");
    const googleTurn = { version: 1 as const, model: "gemini-3.8-flash", steps: result.history, interactions: result.interactions };
    expect(isGoogleConversationTurn(googleTurn)).toBe(true);
    const messages = Array.from({ length: 25 }, (_, i) => ({ role: "user" as const, content: String(i) }));
    const history = buildGoogleHistory([...messages, { role: "assistant", content: "visible", googleTurn }]);
    expect(history).toHaveLength(25 + result.history.length);
    expect(history.slice(25)).toEqual(result.history);
    history[25].type = "thought";
    expect(googleTurn.steps[0].type).toBe("function_call");
    expect(buildGoogleHistory([{ role: "assistant", content: "viejo" }])).toEqual([
      { type: "model_output", content: [{ type: "text", text: "viejo" }] },
    ]);
    expect(isGoogleConversationTurn({ ...googleTurn, steps: first.steps })).toBe(false);
    expect(validateLocalStoreTree({ messagesByThread: { one: [{ googleTurn }] } })
      .filter((issue) => issue.path.includes("googleTurn"))).toEqual([]);
  });

  it("the ledger prevents a second effect on a complete retry, even with a new provider ID", async () => {
    const entries = new Map<string, string>();
    const storage = { getItem: async (key: string) => entries.get(key) ?? null,
      setItem: async (key: string, value: string) => { entries.set(key, value); }, removeItem: async (key: string) => { entries.delete(key); } };
    const ledger = new ToolOperationLedgerRepository(storage, "test-ledger");
    const effect = vi.fn();
    const attempt = (stream: string, fail: boolean) => runGoogleToolLoop({
      initialTurn: parse(stream), initialMessages: [], executionId: "same-user-message",
      executeTool: async (name, _args, call) => {
        const identity = identifyToolOperation(call); const found = await ledger.find(identity);
        if (found.kind === "replay") return found.output;
        effect(); await ledger.record(identity, name, "saved"); return "saved";
      },
      requestNextTurn: async () => { if (fail) throw new Error("network timeout"); return parse(finalRaw); },
    });
    await expect(attempt(raw, true)).rejects.toThrow("network timeout");
    await attempt(raw.replaceAll("call-1", "call-retry").replaceAll("test-1", "test-retry"), false);
    expect(effect).toHaveBeenCalledTimes(1);
  });
});

describe("Google transport parity", () => {
  it("reads the same real UTF-8 chunks through Fetch and cumulative XHR", async () => {
    const bytes = new TextEncoder().encode(finalRaw);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close();
    } }))));
    class XHR {
      DONE = 4; readyState = 1; status = 200; responseText = "";
      onprogress: (() => void) | null = null; onreadystatechange: (() => void) | null = null;
      open() {} setRequestHeader() {} abort() {}
      send() { for (const char of finalRaw) { this.responseText += char; this.onprogress?.(); }
        this.readyState = 4; this.onreadystatechange?.(); }
    }
    vi.stubGlobal("XMLHttpRequest", XHR);
    try {
      const input = { model: "gemini-3.8-flash", history: [], apiKey: "test" };
      expect(await requestGoogleInteraction({ ...input, platform: "web" }))
        .toEqual(await requestGoogleInteraction({ ...input, platform: "android" }));
    } finally { vi.unstubAllGlobals(); }
  });

  it("cannot route production requests or real keys to the development fixture server", () => {
    expect(() => googleInteractionEndpoint(18882, "production", "e2e-local-fake-key")).toThrow();
    expect(() => googleInteractionEndpoint(18882, "development", "real-key")).toThrow();
    expect(googleInteractionEndpoint(18882, "development", "e2e-local-fake-key")).toContain("127.0.0.1");
  });

  it("falls back to a buffered native response when Android streaming fails before content", async () => {
    let requests = 0;
    let bufferedListenedForProgress = false;
    const sentBodies: unknown[] = [];
    class FailingXHR {
      DONE = 4; readyState = 1; status = 0; responseText = "";
      onprogress: (() => void) | null = null; onreadystatechange: (() => void) | null = null;
      onerror: (() => void) | null = null; ontimeout: (() => void) | null = null;
      onload: (() => void) | null = null;
      open() {} setRequestHeader() {} abort() {}
      send(body: unknown) {
        requests += 1;
        sentBodies.push(body);
        if (requests === 1) { this.onerror?.(); return; }
        bufferedListenedForProgress = !!this.onprogress || !!this.onreadystatechange;
        this.status = 200; this.responseText = finalRaw; this.onload?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", FailingXHR);
    try {
      const result = await requestGoogleInteraction({
        model: "gemini-3.8-flash", history: [], apiKey: "test", platform: "android",
      });
      expect(result).toEqual(parse(finalRaw));
      expect(requests).toBe(2);
      expect(bufferedListenedForProgress).toBe(false);
      expect(sentBodies[1]).toBe(sentBodies[0]);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not retry after Android XHR has already shown part of the answer", async () => {
    const partial = created
      + event("step.start", { index: 0, step: { type: "model_output", content: [] } })
      + event("step.delta", { index: 0, delta: { type: "text", text: "Hola" } });
    let requests = 0;
    class PartiallyFailingXHR {
      DONE = 4; readyState = 1; status = 200; responseText = "";
      onprogress: (() => void) | null = null; onreadystatechange: (() => void) | null = null;
      onerror: (() => void) | null = null; ontimeout: (() => void) | null = null;
      onload: (() => void) | null = null;
      open() {} setRequestHeader() {} abort() {}
      send() { requests += 1; this.responseText = partial; this.onprogress?.(); this.onerror?.(); }
    }
    const onContentDelta = vi.fn();
    vi.stubGlobal("XMLHttpRequest", PartiallyFailingXHR);
    try {
      await expect(requestGoogleInteraction({
        model: "gemini-3.8-flash", history: [], apiKey: "test", platform: "android",
      }, { onContentDelta })).rejects.toThrow("No se pudo conectar con Google AI.");
      expect(onContentDelta).toHaveBeenCalledWith("Hola", "Hola");
      expect(requests).toBe(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
