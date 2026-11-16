import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCustomOpenAIChat, CustomOpenAIError } from "./customOpenAIChat";
import { fetchCustomOpenAIModels } from "./customOpenAIModels";
import { normalizeCustomOpenAIBaseUrl } from "./customOpenAIUrl";
import { isExplicitImageUnsupported, photoCapabilityId } from "./providerPhotoCapability";
import type { ProviderConfiguration } from "./providerConfiguration";
import { requestFoodEstimate } from "./foodEstimatorClient";
import { requestProviderToolChat } from "./providerToolClient";
import { toolFailure, ToolTurnError } from "./toolErrors";

const provider: ProviderConfiguration = {
  provider: "custom_openai",
  is_active: true,
  api_key: "test-secret",
  model: "my-model",
  base_url: "https://model.example/v1/",
};

describe("custom OpenAI-compatible provider", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("returns a marked read failure to the custom model and continues", async () => {
    const response = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ content: null, tool_calls: [{ id: "call_1", type: "function",
        function: { name: "read_routines", arguments: "{}" } }] }))
      .mockResolvedValueOnce(response({ content: "No pude leer tus rutinas." }));
    vi.stubGlobal("fetch", fetchImpl);
    const result = await requestProviderToolChat(provider, [{ role: "user", content: "Lee mis rutinas" }],
      { platform: "web", fakeMode: false }, { executeTool: async () => { throw new Error("private fixture"); } });
    expect(result.content).toBe("No pude leer tus rutinas.");
    const output = JSON.parse(fetchImpl.mock.calls[1][1].body).messages.at(-1);
    expect(JSON.parse(output.content)).toMatchObject({ is_error: true, error: "tool_execution_failed" });
    expect(output.content).not.toContain("private fixture");
  });

  it("stops the custom turn before another request on a fatal tool failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: {
      content: null, tool_calls: [{ id: "call_1", type: "function",
        function: { name: "write_measurement", arguments: '{}' } }],
    } }] }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(requestProviderToolChat(provider, [{ role: "user", content: "Guarda mi peso" }],
      { platform: "web", fakeMode: false }, { executeTool: async () =>
        toolFailure("storage_unavailable", "No se guardó la medición.", "stop_turn") }))
      .rejects.toBeInstanceOf(ToolTurnError);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("requires HTTPS and preserves an API path prefix", () => {
    expect(normalizeCustomOpenAIBaseUrl(provider.base_url!)).toBe("https://model.example/v1");
    expect(() => normalizeCustomOpenAIBaseUrl("http://192.168.1.2:8000/v1")).toThrow("https://");
    expect(() => normalizeCustomOpenAIBaseUrl("https://user:pass@model.example/v1")).toThrow();
  });

  it("sends Chat Completions to the configured endpoint and rejects redirects", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Hola" } }],
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const result = await requestCustomOpenAIChat(provider, [
      { role: "user", content: [{ type: "text", text: "comida" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,AA==" } }] },
    ], { platform: "web", stream: false, fetchImpl });
    expect(result.content).toBe("Hola");
    expect(fetchImpl).toHaveBeenCalledWith("https://model.example/v1/chat/completions", expect.objectContaining({
      redirect: "error",
      headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
    }));
    const body = JSON.parse((fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toMatchObject({ model: "my-model", stream: false });
    expect(body.messages[0].content[1].image_url.url).toContain("data:image/jpeg;base64,");
  });

  it("collects streamed content and tool calls", async () => {
    const events = [
      { choices: [{ delta: { content: "Hola " } }] },
      { choices: [{ delta: { content: "mundo", tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "scan_barcode", arguments: "{\"code\":" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"123\"}" } }] } }] },
    ].map((value) => `data: ${JSON.stringify(value)}\n\n`).join("") + "data: [DONE]\n\n";
    const fetchImpl = vi.fn(async () => new Response(events, { status: 200, headers: { "content-type": "text/event-stream" } })) as unknown as typeof fetch;
    const deltas: string[] = [];
    const result = await requestCustomOpenAIChat(provider, [{ role: "user", content: "Hola" }], {
      platform: "web", fetchImpl, onContentDelta: (delta) => deltas.push(delta),
    });
    expect(result.content).toBe("Hola mundo");
    expect(result.toolCalls).toEqual([{ id: "call-1", type: "function", function: { name: "scan_barcode", arguments: '{"code":"123"}' } }]);
    expect(deltas).toEqual(["Hola ", "mundo"]);
  });

  it("retries as non-streaming Chat Completions when streaming is explicitly unsupported", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Streaming is not supported" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200 }));
    const result = await requestCustomOpenAIChat(provider, [{ role: "user", content: "Hola" }], {
      platform: "web", fetchImpl,
    });
    expect(result.content).toBe("OK");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).stream).toBe(true);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).stream).toBe(false);
  });

  it("allows manual model entry when /models is absent and never follows its redirect", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const result = await fetchCustomOpenAIModels(provider, { platform: "web", fetchImpl });
    expect(result).toEqual({ options: [], unavailable: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://model.example/v1/models", expect.objectContaining({ redirect: "error" }));
  });

  it("recognizes only explicit image capability errors and scopes them to a model and URL", () => {
    expect(isExplicitImageUnsupported(new CustomOpenAIError("This model does not support image input", 400))).toBe(true);
    expect(isExplicitImageUnsupported(new CustomOpenAIError("Invalid API key", 401))).toBe(false);
    expect(isExplicitImageUnsupported(new CustomOpenAIError("Image download timed out", 400))).toBe(false);
    expect(photoCapabilityId(provider)).not.toBe(photoCapabilityId({ ...provider, model: "other-model" }));
    expect(photoCapabilityId(provider)).not.toBe(photoCapabilityId({ ...provider, base_url: "https://other.example/v1" }));
  });

  it("retries food estimation without barcode tools when the server explicitly rejects tools", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Tools are not supported" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Estimación aproximada" } }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchImpl);
    const result = await requestFoodEstimate(provider, [
      { role: "system", content: "Estima la comida" },
      { role: "user", content: "Un plato de arroz" },
    ], [], { platform: "web", fakeMode: false });
    expect(result.content).toContain("Estimación aproximada");
    expect(result.warning).toContain("no se consultarán productos por código de barras");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).tools).toBeDefined();
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it("blocks the Coach when the server rejects tools", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Tool calling not supported" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchImpl);
    await expect(requestProviderToolChat(provider, [
      { role: "user", content: "Añade un alimento" },
    ], { platform: "web", fakeMode: false }, {
      executeTool: vi.fn(),
    })).rejects.toThrow("Elige otro modelo");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("lets the custom Coach correct malformed JSON instead of aborting the turn", async () => {
    const response = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }), {
      status: 200, headers: { "content-type": "application/json" },
    });
    const call = (id: string, args: string) => ({
      content: null, tool_calls: [{ id, type: "function",
        function: { name: "read_routines", arguments: args },
      }],
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(call("invalid", "{broken")))
      .mockResolvedValueOnce(response(call("corrected", "{}")))
      .mockResolvedValueOnce(response({ content: "No tienes rutinas." }));
    vi.stubGlobal("fetch", fetchImpl);
    const executeTool = vi.fn(async () => "No hay rutinas de entrenamiento creadas.");
    const result = await requestProviderToolChat(provider, [{ role: "user", content: "Lee mis rutinas" }],
      { platform: "web", fakeMode: false }, { executeTool });
    expect(result.content).toBe("No tienes rutinas.");
    expect(executeTool).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).messages.at(-1)).toMatchObject({
      role: "tool", tool_call_id: "invalid", content: expect.stringContaining("invalid_tool_arguments"),
    });
    expect(executeTool).toHaveBeenCalledWith("read_routines", {}, expect.any(Object));
  });
});
