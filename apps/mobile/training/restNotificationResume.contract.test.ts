import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  expect(start, `no se encontró ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `no se encontró ${endMarker}`).toBeGreaterThan(start);
  return appSource.slice(start, end);
}

describe("contrato de reanudación del aviso de descanso", () => {
  it("detiene el tick hasta saber si Android ya entregó el aviso", () => {
    const interval = sourceBetween(
      'if (!activeWorkoutSession || activeWorkoutSession.status !== "running") return;\n    const interval = setInterval(() => {',
      "return () => clearInterval(interval);",
    );
    expect(interval).toContain(
      'if (workoutAppStateRef.current !== "active" || foregroundRestRecoveryRef.current) return;',
    );

    const resume = sourceBetween(
      'const subscription = AppState.addEventListener("change", async (nextAppState) => {',
      "return () => {\n      subscription.remove();",
    );
    const recoveryStartedAt = resume.indexOf("foregroundRestRecoveryRef.current = true;");
    const trayReadAt = resume.indexOf("await syncRestDeliveryFromTray(expectedPayload)");
    expect(recoveryStartedAt).toBeGreaterThanOrEqual(0);
    expect(trayReadAt).toBeGreaterThan(recoveryStartedAt);
    expect(resume).toContain("foregroundRestRecoveryRef.current = false;");
  });

  it("acepta tanto el listener nativo como la bandeja como prueba de entrega", () => {
    const resume = sourceBetween(
      'const subscription = AppState.addEventListener("change", async (nextAppState) => {',
      "return () => {\n      subscription.remove();",
    );
    expect(resume).toContain("restNotifDeliveredAtRef.current !== null");
    expect(resume).toContain(
      "restNotifExpectedAtRef.current === expectedPayload.expected_at_ms",
    );
    expect(resume).toContain("const wasDelivered = wasObservedByListener || wasFoundInTray;");
  });
});
