import { describe, expect, it, vi } from "vitest";

import {
  handleFoodEstimatorToolCall,
  requestFoodEstimate,
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
});
