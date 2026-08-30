import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// App.tsx no es importable en Node, así que el contrato se asserta sobre su
// fuente. Es la prueba central de GYM-139: demuestra que la vía que anexaba un
// dato local al system prompt no existe, no solo que hoy no se dispare.
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

function componentFunctionBody(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `no se encontró "${header}" en App.tsx`).toBeGreaterThan(-1);
  const rest = source.slice(start + header.length);
  const end = rest.search(/\n {2}(?:async )?function /);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("GYM-139: ningún dato local llega al system prompt", () => {
  it("no queda rastro del mecanismo de inyección", () => {
    for (const removed of [
      "Instrucciones de depuracion",
      "Instrucciones de depuración",
      "debugField",
      "fullSystemPrompt",
      'f.key === "debug"',
    ]) {
      expect(appSource).not.toContain(removed);
    }
  });

  it("sendMessage no lee datos personales al construir la petición", () => {
    const body = componentFunctionBody(appSource, "  async function sendMessage() {");
    expect(body).not.toContain("loadPersonalData");
    expect(body).not.toContain("personalDataFields");
    expect(body).toContain("content: systemPromptSelection.content");
    expect(body).toContain("localPromptOverrides: 0");
  });

  it("la traza del envío no vuelca el contenido del prompt", () => {
    const body = componentFunctionBody(appSource, "  async function sendMessage() {");
    const trace = body.slice(body.indexOf('pushTrace("chatPrompt", "chat-request"'));
    expect(trace).toContain("basePromptChars: systemPromptSelection.content.length");
    expect(trace.slice(0, trace.indexOf("});"))).not.toContain("content:");
  });

  it("las fronteras del almacén pasan por la sanitización", () => {
    expect(appSource).toContain("return sanitizePersonalDataFields(JSON.parse(raw));");
    expect(appSource).toContain("JSON.stringify(sanitizePersonalDataFields(fields)),");
    expect(appSource).toContain(
      "await savePersonalData(sanitizePersonalDataFields(data.personalData));",
    );
    expect(appSource).not.toContain("Array.isArray(data.personalData)");
  });

  it("App.tsx no redeclara el tipo ni serializa datos personales por su cuenta", () => {
    expect(appSource).not.toContain("type PersonalDataField = {");
    expect(appSource).not.toContain("function personalDataToJson");
    expect(appSource).toContain('from "./agent/personalData"');
  });
});
