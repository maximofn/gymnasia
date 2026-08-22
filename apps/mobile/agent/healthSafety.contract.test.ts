import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const noticeSource = readFileSync(new URL("../HealthSafetyNotice.tsx", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return appSource.slice(start, end);
}

describe("contrato de integración del guardrail sanitario", () => {
  it("clasifica antes del proveedor en las tres superficies", () => {
    const main = sourceBetween("async function sendMessage()", "function resetDietMealEditorState");
    const estimator = sourceBetween("async function sendFoodEstimatorMessage", "async function requestStructuredNutritionJSON");
    const mini = sourceBetween("async function sendMcMessage()", "const lastAssistantMsg");
    for (const source of [main, estimator, mini]) {
      expect(source.indexOf("classifyHealthSafetyText")).toBeGreaterThanOrEqual(0);
      expect(source.indexOf("isBlockingHealthRisk")).toBeGreaterThan(source.indexOf("classifyHealthSafetyText"));
    }
    expect(main.indexOf("isBlockingHealthRisk(bundledDecision.level)")).toBeLessThan(
      main.indexOf("if (!activeProvider)"),
    );
    expect(estimator.indexOf("isBlockingHealthRisk(bundledDecision.level)")).toBeLessThan(
      estimator.indexOf("resolveFoodEstimatorProviderFromState"),
    );
  });

  it("protege streaming, tools y errores técnicos por rutas distintas", () => {
    const provider = sourceBetween("async function callProviderChatAPIWithTools", "const foodEstimatorTools");
    expect(provider).toContain("healthSafetyToolAllowed");
    expect(provider).toContain("agentToolEffect");
    expect(provider).toContain("tool_blocked_by_health_safety");
    expect(appSource.match(/createHealthSafeStreamGate/g)?.length).toBeGreaterThanOrEqual(4);
    expect(appSource).toContain('kind: "technical_error"');
    expect(appSource).toContain('kind: "health_safety_intervention"');
  });

  it("persiste consentimiento versionado fuera del backup y muestra una alerta accesible", () => {
    expect(appSource).toContain("HEALTH_SAFETY_CONSENT_KEY");
    expect(appSource).toContain("consentVersion: BUNDLED_RUNTIME_HEALTH_SAFETY_POLICY.consentVersion");
    const backup = sourceBetween("function buildBackupPayload", "function parseBackupPayload");
    expect(backup).not.toContain("healthSafetyConsent");
    expect(noticeSource).toContain('accessibilityRole="alert"');
    expect(noticeSource).toContain('accessibilityLiveRegion="polite"');
    expect(noticeSource).toContain("#FFCD4D");
  });
});
