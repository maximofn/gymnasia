import { describe, expect, it, vi } from "vitest";

import {
  handleFoodEstimatorToolCall,
  requestFoodEstimate,
  requestStructuredNutrition,
} from "./foodEstimatorClient";

describe("food estimator client", () => {
  it("conserva el estimador determinista sin tocar la red", async () => {
    const onStatus = vi.fn();
    const result = await requestFoodEstimate(
      {
        provider: "google",
        api_key: "fixture",
        model: "fixture-google",
        is_active: true,
        reasoning_effort: null,
      },
      [{ role: "user", content: "foto de mi comida" }],
      [],
      { fakeMode: true, platform: "web" },
      { onStatus },
    );

    expect(result.content).toContain("320 kcal");
    expect(onStatus).toHaveBeenCalledWith("Fixture local");
  });

  it("rechaza llamadas de herramienta sin código de barras", async () => {
    await expect(handleFoodEstimatorToolCall("scan_barcode", {}))
      .resolves.toBe("No se proporcionó un código de barras.");
  });

  it("valida la respuesta nutricional estructurada", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              dish_name: "Arroz",
              grams: 100,
              calories_kcal: 130,
              protein_g: 2.7,
              carbs_g: 28,
              fat_g: 0.3,
              food_type: "alimento",
            }),
          }],
        }],
      }),
    } as Response);

    await expect(requestStructuredNutrition(
      {
        provider: "openai",
        api_key: "fixture",
        model: "gpt-5.4",
        is_active: true,
        reasoning_effort: "medium",
      },
      "Arroz cocido",
      { fakeMode: false, platform: "web" },
    )).resolves.toMatchObject({ dish_name: "Arroz", calories_kcal: 130 });
    fetchMock.mockRestore();
  });
});
