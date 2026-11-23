import { readFileSync } from "node:fs";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { AI_TRANSPARENCY_POLICY, composeAiSystemPrompt } from "./aiTransparency";
import { appendCurrentDateContext, createCurrentDateContext } from "./currentDateContext";

describe("fecha de hoy para Coach", () => {
  it("da la fecha civil local en texto y en formato YYYY-MM-DD", () => {
    const context = createCurrentDateContext(new Date(2026, 10, 23, 10, 0));
    expect(context).toContain("Hoy es lunes, 23 de noviembre de 2026 (2026-11-23)");
    expect(context).toContain("este mes");
    expect(context).toContain("from y to");
  });

  it("cambia de día justo a medianoche local, no a medianoche UTC", () => {
    expect(createCurrentDateContext(new Date(2026, 10, 23, 23, 59))).toContain("(2026-11-23)");
    expect(createCurrentDateContext(new Date(2026, 10, 24, 0, 1))).toContain("martes, 24 de noviembre de 2026 (2026-11-24)");
    expect(createCurrentDateContext(new Date(2026, 11, 31, 23, 59))).toContain("jueves, 31 de diciembre de 2026");
    expect(createCurrentDateContext(new Date(2028, 1, 29, 12, 0))).toContain("martes, 29 de febrero de 2028 (2028-02-29)");
  });

  it("no envía hora ni zona horaria", () => {
    fc.assert(fc.property(
      fc.date({ min: new Date(2000, 0, 1), max: new Date(2100, 0, 1), noInvalidDate: true }),
      (now) => {
        const context = createCurrentDateContext(now);
        return !/\d{1,2}:\d{2}/.test(context)
          && !/UTC|GMT|[+-]\d{2}:?\d{2}|Europe|America/.test(context)
          && context.includes(`${now.getFullYear()}`);
      },
    ));
  });

  it("va tras las instrucciones fijas y antes del bloque de transparencia, que sigue cerrando el prompt", () => {
    const prompt = composeAiSystemPrompt(appendCurrentDateContext("Instrucciones fijas.", new Date(2026, 10, 23, 12)));
    expect(prompt.startsWith("Instrucciones fijas.")).toBe(true);
    expect(prompt.indexOf("## Fecha de hoy")).toBeGreaterThan(prompt.indexOf("Instrucciones fijas."));
    expect(prompt.endsWith(AI_TRANSPARENCY_POLICY)).toBe(true);
  });

  it("contrato: el cliente de Coach añade la fecha al prompt que comparten los tres proveedores", () => {
    const source = readFileSync(new URL("./providerToolClient.ts", import.meta.url), "utf8");
    expect(source.match(/appendCurrentDateContext\(/g)).toHaveLength(1);
    expect(source).toMatch(/const systemPrompt = composeAiSystemPrompt\(\s*appendCurrentDateContext\(/);
    // OpenAI, compatibles, Anthropic y Google leen la misma variable.
    expect(source.match(/systemPrompt\b/g)!.length).toBeGreaterThanOrEqual(6);
    expect(source.match(/composeAiSystemPrompt\(/g)).toHaveLength(1);
  });
});
