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

  it("nunca lanza con argumentos malformados", () => {
    expect(writeMeasurement).toBeDefined();
    const primitives: unknown[] = [null, undefined, true, false, 0, 1, "", "{}", [], Symbol("x")];
    const generated = Array.from({ length: 500 }, (_value, index) => ({
      date: index % 3 === 0 ? index : `2026-04-${String((index % 28) + 1).padStart(2, "0")}`,
      data: index % 5 === 0 ? [index] : index % 7 === 0 ? null : JSON.stringify({ weight_kg: index }),
      extra: index % 2 === 0 ? { nested: [index] } : undefined,
    }));

    for (const input of [...primitives, ...generated]) {
      expect(() => validateToolInput(writeMeasurement!.inputSchema, input)).not.toThrow();
    }
  });
});
