import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestCustomOpenAIChat } from "./customOpenAIChat";
import type { ProviderConfiguration } from "./providerConfiguration";
import { streamAnthropicRequestViaXHR, streamOpenAIRequestViaFetch } from "./providerStreamTransport";
import { requestProviderToolChat } from "./providerToolClient";
import { MAX_TOOL_ROUNDS, ToolRoundLimitError } from "./providerToolLoop";

vi.mock("./providerStreamTransport", async (importOriginal) => ({
  ...await importOriginal<typeof import("./providerStreamTransport")>(),
  streamAnthropicRequestViaXHR: vi.fn(),
  streamOpenAIRequestViaFetch: vi.fn(),
}));

vi.mock("./customOpenAIChat", async (importOriginal) => ({
  ...await importOriginal<typeof import("./customOpenAIChat")>(),
  requestCustomOpenAIChat: vi.fn(),
}));

function provider(name: ProviderConfiguration["provider"]): ProviderConfiguration {
  return {
    provider: name,
    api_key: "fixture",
    model: `fixture-${name}`,
    is_active: true,
    base_url: name === "custom_openai" ? "https://model.example/v1" : undefined,
  };
}

const webRuntime = { platform: "web" as const, fakeMode: false };

describe("provider tool client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("conserva el cortocircuito determinista y emite el contenido", async () => {
    const onContentDelta = vi.fn();
    const result = await requestProviderToolChat(
      {
        provider: "openai",
        api_key: "fixture",
        model: "fixture-openai",
        is_active: true,
        reasoning_effort: "medium",
      },
      [{ role: "user", content: "mi rutina" }],
      { fakeMode: true, platform: "web" },
      { executeTool: vi.fn(), onContentDelta },
    );

    expect(result.content).toContain("mi rutina");
    expect(onContentDelta).toHaveBeenCalledWith(result.content, result.content);
  });

  // Regresión: al agotar las rondas, el texto emitido entre rondas («Voy a mirar…»)
  // se devolvía como si fuera la respuesta final, sin ningún aviso.
  describe("el texto emitido entre rondas no se hace pasar por respuesta al agotar el tope", () => {
    it("Anthropic", async () => {
      let call = 0;
      vi.mocked(streamAnthropicRequestViaXHR).mockImplementation(async (_url, _headers, _body, handlers) => {
        handlers?.onContentDelta?.("Voy a mirar tus datos. ", "");
        call += 1;
        return {
          content: "",
          thinking: null,
          contentBlocks: [{ type: "tool_use", id: `toolu_${call}`, name: "read_field_value", input: {} }],
        } as unknown as Awaited<ReturnType<typeof streamAnthropicRequestViaXHR>>;
      });
      const executeTool = vi.fn(async () => "ok");

      const request = requestProviderToolChat(
        provider("anthropic"),
        [{ role: "user", content: "Bucle" }],
        webRuntime,
        { executeTool },
      );

      await expect(request).rejects.toBeInstanceOf(ToolRoundLimitError);
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    });

    it("OpenAI", async () => {
      let call = 0;
      vi.mocked(streamOpenAIRequestViaFetch).mockImplementation(async (_url, _headers, _body, handlers) => {
        handlers?.onContentDelta?.("Voy a mirar tus datos. ", "");
        call += 1;
        return {
          content: "",
          thinking: null,
          responseId: `resp_${call}`,
          outputItems: [{
            type: "function_call",
            id: `fc_${call}`,
            call_id: `call_${call}`,
            name: "read_field_value",
            arguments: "{}",
          }],
        } as unknown as Awaited<ReturnType<typeof streamOpenAIRequestViaFetch>>;
      });
      const executeTool = vi.fn(async () => "ok");

      const request = requestProviderToolChat(
        provider("openai"),
        [{ role: "user", content: "Bucle" }],
        webRuntime,
        { executeTool },
      );

      await expect(request).rejects.toBeInstanceOf(ToolRoundLimitError);
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    });

    it("OpenAI compatible", async () => {
      let call = 0;
      vi.mocked(requestCustomOpenAIChat).mockImplementation(async (_provider, _history, options) => {
        options?.onContentDelta?.("Voy a mirar tus datos. ");
        call += 1;
        return {
          content: "Voy a mirar tus datos. ",
          toolCalls: [{
            id: `call_${call}`,
            type: "function",
            function: { name: "read_field_value", arguments: "{}" },
          }],
        };
      });
      const executeTool = vi.fn(async () => "ok");

      const request = requestProviderToolChat(
        provider("custom_openai"),
        [{ role: "user", content: "Bucle" }],
        webRuntime,
        { executeTool },
      );

      await expect(request).rejects.toThrow(
        "El modelo: la respuesta sigue pendiente de herramientas al alcanzar el límite de 10 rondas.",
      );
      expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    });
  });
});
