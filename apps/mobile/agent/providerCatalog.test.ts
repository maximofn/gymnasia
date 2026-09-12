import { describe, expect, it } from "vitest";

import {
  googleModelsBaseUrl,
  parseGoogleModelOptions,
  parseOpenAIModelOptions,
} from "./providerCatalog";

describe("provider catalog", () => {
  it("normaliza, deduplica y ordena modelos de OpenAI", () => {
    expect(parseOpenAIModelOptions({
      data: [
        { id: "z-model", owned_by: " owner " },
        { id: "a-model" },
        { id: "z-model", owned_by: "new-owner" },
        { id: " " },
      ],
    })).toEqual([
      { id: "a-model", owned_by: null },
      { id: "z-model", owned_by: "new-owner" },
    ]);
  });

  it("normaliza modelos de Google y excluye los que no generan contenido", () => {
    expect(parseGoogleModelOptions({
      models: [
        { name: "models/z-model", displayName: "Z" },
        { name: "models/a-model", display_name: "A", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embed", supportedGenerationMethods: ["embedContent"] },
      ],
    })).toEqual([
      { id: "a-model", display_name: "A" },
      { id: "z-model", display_name: "Z" },
    ]);
  });

  it("deriva el catálogo de la misma ruta de Interactions usada por Google", () => {
    expect(googleModelsBaseUrl({ apiKey: "key" }))
      .toBe("https://generativelanguage.googleapis.com/v1beta/models");
  });
});
