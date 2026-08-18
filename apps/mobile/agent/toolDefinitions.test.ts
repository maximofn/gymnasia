import Ajv from "ajv";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  CHAT_TOOLS,
  validateToolInput,
} from "./toolDefinitions";
import { AGENT_TOOL_HANDLER_NAMES } from "./toolExecutor";

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const SUPPORTED_PROPERTY_TYPES = new Set(["string", "number", "object", "array"]);

describe("catálogo canónico de tools", () => {
  it("declara al menos una tool con metadatos significativos", () => {
    expect(AGENT_TOOL_DEFINITIONS.length).toBeGreaterThan(0);

    for (const definition of AGENT_TOOL_DEFINITIONS) {
      expect(definition.name.trim()).not.toBe("");
      expect(definition.name).toMatch(TOOL_NAME_PATTERN);
      expect(definition.description.trim().length).toBeGreaterThanOrEqual(20);
    }
  });

  it("usa nombres únicos", () => {
    const uniqueNames = new Set(AGENT_TOOL_NAMES);
    expect(uniqueNames.size).toBe(AGENT_TOOL_NAMES.length);
  });

  it("declara JSON Schemas de objeto coherentes", () => {
    for (const definition of AGENT_TOOL_DEFINITIONS) {
      const { inputSchema } = definition;
      expect(inputSchema.type).toBe("object");
      expect(inputSchema.properties).toBeTypeOf("object");
      expect(inputSchema.properties).not.toBeNull();
      expect(Array.isArray(inputSchema.properties)).toBe(false);

      const required = inputSchema.required ?? [];
      expect(new Set(required).size).toBe(required.length);
      for (const field of required) {
        expect(inputSchema.properties).toHaveProperty(field);
      }

      for (const property of Object.values(inputSchema.properties)) {
        expect(SUPPORTED_PROPERTY_TYPES.has(property.type)).toBe(true);
      }
    }
  });

  it("compila todos los inputSchema con Ajv", () => {
    const ajv = new Ajv({ allErrors: true, strict: true });

    for (const definition of AGENT_TOOL_DEFINITIONS) {
      expect(() => ajv.compile(definition.inputSchema)).not.toThrow();
    }
  });
});

describe("contrato schema ↔ ejecutor ↔ proveedores", () => {
  it("declara exactamente las tools que implementa el ejecutor", () => {
    expect([...AGENT_TOOL_NAMES].sort()).toEqual([...AGENT_TOOL_HANDLER_NAMES].sort());
  });

  it("proyecta el catálogo completo al formato de OpenAI", () => {
    expect(CHAT_TOOLS.openai).toEqual(AGENT_TOOL_DEFINITIONS.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    })));
  });

  it("proyecta el catálogo completo al formato de Anthropic", () => {
    expect(CHAT_TOOLS.anthropic).toEqual(AGENT_TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })));
  });

  it("proyecta el catálogo completo al formato de Google", () => {
    expect(CHAT_TOOLS.google).toEqual([{
      functionDeclarations: AGENT_TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
    }]);
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

  it("nunca lanza con schemas del catálogo y argumentos arbitrarios (property-based)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...AGENT_TOOL_DEFINITIONS), fc.anything(), (tool, input) => {
        const result = validateToolInput(tool.inputSchema, input);
        return typeof result.valid === "boolean"
          && Array.isArray(result.errors)
          && result.errors.every((error) => typeof error === "string");
      }),
      { numRuns: 1000, seed: 340034 },
    );
  });
});
