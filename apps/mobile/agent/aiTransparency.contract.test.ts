import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const disclosureSource = readFileSync(
  new URL("../AiIdentityDisclosure.tsx", import.meta.url),
  "utf8",
);
const promptSource = readFileSync(
  new URL("../../../prompts/AGENTS.md", import.meta.url),
  "utf8",
);

describe("contrato estático de superficies conversacionales", () => {
  it.each(["main-chat", "food-estimator", "personal-food-assistant"])(
    "mantiene visible la divulgación en %s",
    (surface) => {
      expect(appSource).toContain(`<AiIdentityDisclosure surface="${surface}" />`);
    },
  );

  it("protege las tres fronteras de system prompt", () => {
    expect(appSource.match(/composeAiSystemPrompt\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(appSource).not.toContain("system: FOOD_ESTIMATOR_SYSTEM_PROMPT");
    expect(appSource).not.toContain("systemInstruction: { parts: [{ text: FOOD_ESTIMATOR_SYSTEM_PROMPT }]");
  });

  it("mantiene la etiqueta accesible y su anuncio nativo", () => {
    expect(disclosureSource).toContain("accessibilityLabel={copy.disclosureAccessibilityLabel}");
    expect(disclosureSource).toContain('accessibilityLiveRegion="polite"');
    expect(disclosureSource).toContain("AccessibilityInfo.announceForAccessibility");
    expect(appSource).toContain('accessibilityLabel="Pregunta a Gymnasia Coach"');
    expect(appSource).toContain("Pregunta a Gymnasia Food Estimator");
  });

  it("mantiene ambos nombres sin presentar a los agentes como profesionales reales", () => {
    const conversationalSources = `${appSource}\n${promptSource}`;
    for (const prohibited of [
      "Eres Gymnasia Coach, un asistente de gimnasio",
      "Pregunta al coach",
      "nutricionista experto",
      "entrenador personal",
      "Gymnasia IA",
    ]) {
      expect(conversationalSources).not.toContain(prohibited);
    }
    expect(promptSource).toContain("Eres Gymnasia Coach, el sistema de inteligencia artificial");
    expect(appSource).toContain("Eres Gymnasia Food Estimator, el sistema de inteligencia artificial");
  });
});
