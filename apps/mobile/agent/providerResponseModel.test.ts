import { describe, expect, it } from "vitest";

import {
  buildOpenAIReasoningConfig,
  normalizeOpenAIFunctionCallArguments,
  parseAnthropicContent,
  parseJsonSafely,
  parseOpenAIContent,
  parseOpenAIResponseResult,
} from "./providerResponseModel";

describe("provider response model", () => {
  it("conserva texto, razonamiento y llamadas de función de Responses", () => {
    expect(parseOpenAIResponseResult({
      output: [
        { type: "reasoning", summary: [{ type: "summary_text", text: "  Analiza  " }] },
        { type: "message", content: [{ type: "output_text", text: "  Respuesta  " }] },
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "save",
          arguments: { value: 2 },
        },
      ],
    })).toEqual({ content: "Respuesta", thinking: "Analiza" });
    expect(normalizeOpenAIFunctionCallArguments({ value: 2 })).toBe("{\"value\":2}");
  });

  it("mantiene el fallback de Chat Completions", () => {
    expect(parseOpenAIContent({
      choices: [{ message: { content: [{ type: "text", text: "  Hola  " }] } }],
    })).toBe("Hola");
  });

  it("separa texto y pensamiento de Anthropic", () => {
    expect(parseAnthropicContent({
      content: [
        { type: "thinking", thinking: "  Razona  " },
        { type: "text", text: "  Contesta  " },
      ],
    })).toEqual({ content: "Contesta", thinking: "Razona" });
  });

  it("configura el resumen detallado solo en modelos con razonamiento", () => {
    expect(buildOpenAIReasoningConfig({ model: "gpt-5.4", reasoning_effort: "high" }))
      .toEqual({ effort: "high", summary: "detailed" });
    expect(buildOpenAIReasoningConfig({ model: "gpt-4o", reasoning_effort: "high" }))
      .toBeNull();
  });

  it("tolera JSON no válido", () => {
    expect(parseJsonSafely<{ ok: boolean }>("{\"ok\":true}")).toEqual({ ok: true });
    expect(parseJsonSafely("{")).toBeNull();
  });
});
