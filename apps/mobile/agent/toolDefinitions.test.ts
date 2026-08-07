import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  CHAT_TOOLS,
  validateToolInput,
} from "./toolDefinitions";
import { AGENT_TOOL_HANDLER_NAMES } from "./toolExecutor";

describe("contrato schema ↔ ejecutor", () => {
  it("declara exactamente las tools que implementa el ejecutor", () => {
    expect([...AGENT_TOOL_NAMES].sort()).toEqual([...AGENT_TOOL_HANDLER_NAMES].sort());
  });

  it("deriva los formatos de los tres proveedores del mismo schema", () => {
    for (const definition of AGENT_TOOL_DEFINITIONS) {
      const openAI = CHAT_TOOLS.openai.find((tool) => tool.name === definition.name);
      const anthropic = CHAT_TOOLS.anthropic.find((tool) => tool.name === definition.name);
      const google = CHAT_TOOLS.google[0].functionDeclarations.find(
        (tool) => tool.name === definition.name,
      );
      expect(openAI?.parameters).toEqual(definition.inputSchema);
      expect(anthropic?.input_schema).toEqual(definition.inputSchema);
      expect(google?.parameters).toEqual(definition.inputSchema);
    }
  });
});

describe("validateToolInput", () => {
  const writeMeasurement = AGENT_TOOL_DEFINITIONS.find(
    (tool) => tool.name === "write_measurement",
  );

  it("informa de campos requeridos y tipos incompatibles", () => {
    expect(writeMeasurement).toBeDefined();
    const missing = validateToolInput(writeMeasurement!.inputSchema, {});
    expect(missing.valid).toBe(false);
    expect(missing.errors).toContain('Falta el campo requerido "date".');
    expect(missing.errors).toContain('Falta el campo requerido "data".');

    const wrongType = validateToolInput(writeMeasurement!.inputSchema, {
      date: 20260411,
      data: "{}",
    });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.errors).toContain('El campo "date" debe ser de tipo string.');
  });

  it("nunca lanza con argumentos arbitrarios (property-based)", () => {
    expect(writeMeasurement).toBeDefined();
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = validateToolInput(writeMeasurement!.inputSchema, input);
        return typeof result.valid === "boolean"
          && Array.isArray(result.errors)
          && result.errors.every((error) => typeof error === "string");
      }),
      { numRuns: 1000, seed: 340034 },
    );
  });
});
