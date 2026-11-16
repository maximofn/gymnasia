import Ajv from "ajv";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  CHAT_TOOLS,
  agentToolEffect,
  validateToolInput,
} from "./toolDefinitions";
import { AGENT_TOOL_HANDLER_NAMES } from "./toolExecutor";

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const SUPPORTED_PROPERTY_TYPES = new Set(["string", "number", "integer", "object", "array"]);

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

  it("clasifica el efecto de todas las tools para el guardrail sanitario", () => {
    for (const definition of AGENT_TOOL_DEFINITIONS) {
      expect(["read", "local_write", "external_write"]).toContain(definition.effect);
      expect(agentToolEffect(definition.name)).toBe(definition.effect);
    }
    expect(agentToolEffect("unknown_tool")).toBeNull();
    expect(agentToolEffect("create_feature_issue")).toBe("external_write");
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
      strict: false,
    })));
  });

  it("permite enviar solo el peso sin que Responses haga obligatorias las otras medidas", () => {
    const tool = CHAT_TOOLS.openai.find((definition) => definition.name === "write_measurement")!;
    expect(tool.strict).toBe(false);
    const validate = new Ajv().compile(tool.parameters);
    expect(validate({ date: "2026-10-03", data: { weight_kg: 75.5 } })).toBe(true);
    expect(validate({ date: "2026-10-03", data: { weight_kg: "75,5" } })).toBe(false);
    expect(tool.parameters.required).not.toContain("clear_fields");
    expect(tool.parameters.properties.data.required ?? []).toEqual([]);
  });

  it("proyecta el catálogo completo al formato de Anthropic", () => {
    expect(CHAT_TOOLS.anthropic).toEqual(AGENT_TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })));
  });

  it("proyecta el catálogo completo al formato de Google", () => {
    expect(CHAT_TOOLS.google).toEqual(AGENT_TOOL_DEFINITIONS.map((tool) => ({
      type: "function", name: tool.name, description: tool.description, parameters: tool.inputSchema,
    })));
  });

  it("limita las comidas de lectura y escritura a las categorías de la app", () => {
    for (const name of ["read_meal_foods", "add_meal_food"]) {
      const tool = AGENT_TOOL_DEFINITIONS.find((definition) => definition.name === name);
      expect(tool?.inputSchema.properties.meal.enum).toEqual([
        "Desayuno",
        "Almuerzo",
        "Comida",
        "Merienda",
        "Cena",
      ]);
    }
  });

  it("publica create_routine como un objeto numérico y estricto en los tres proveedores", () => {
    const tool = AGENT_TOOL_DEFINITIONS.find((definition) => definition.name === "create_routine");
    expect(tool).toBeDefined();
    expect(tool!.inputSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        data: {
          type: "object",
          additionalProperties: false,
          required: ["name", "category", "icon", "exercises"],
          properties: {
            duration_minutes: { type: "integer", minimum: 1, maximum: 999 },
            exercises: { type: "array", minItems: 1 },
          },
        },
      },
    });
    expect(CHAT_TOOLS.openai.find((item) => item.name === "create_routine")?.parameters)
      .toBe(tool!.inputSchema);
    expect(CHAT_TOOLS.anthropic.find((item) => item.name === "create_routine")?.input_schema)
      .toBe(tool!.inputSchema);
    expect(CHAT_TOOLS.google.find((item) => item.name === "create_routine")?.parameters)
      .toBe(tool!.inputSchema);
  });
});

describe("validateToolInput", () => {
  const writeMeasurement = AGENT_TOOL_DEFINITIONS.find(
    (tool) => tool.name === "write_measurement",
  );

  it("no modifica los argumentos válidos ni convierte texto en números", () => {
    const input = { date: "2024-04-11", data: { weight_kg: 75.5 } };
    const before = structuredClone(input);
    expect(validateToolInput(writeMeasurement!.inputSchema, input).valid).toBe(true);
    expect(input).toEqual(before);
    const invalid = { date: input.date, data: { weight_kg: "75.5" } };
    expect(validateToolInput(writeMeasurement!.inputSchema, invalid).errors)
      .toContain('El campo "data.weight_kg" debe ser de tipo number.');
    expect(invalid.data.weight_kg).toBe("75.5");
  });

  it("rechaza null, también en propiedades opcionales y elementos de arrays", () => {
    expect(validateToolInput(writeMeasurement!.inputSchema, {
      date: null, data: { weight_kg: null }, clear_fields: [null],
    }).errors).toEqual([
      'El campo "date" debe ser de tipo string.',
      'El campo "data.weight_kg" debe ser de tipo number.',
      'El campo "clear_fields[0]" debe ser de tipo string.',
    ]);
    const routine = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "create_routine")!;
    expect(() => validateToolInput(routine.inputSchema, {
      data: { name: "Pierna", category: "strength", icon: "activity", exercises: [null] },
    })).not.toThrow();
    expect(validateToolInput(routine.inputSchema, { data: null }).valid).toBe(false);
  });

  it("respeta additionalProperties y no acepta campos heredados como requeridos", () => {
    const schema = {
      type: "object" as const,
      properties: { key: { type: "string" as const } },
      required: ["key"],
    };
    expect(validateToolInput(schema, { key: "Objetivo", extra: true }).valid).toBe(true);
    expect(validateToolInput({ ...schema, additionalProperties: false }, {
      key: "Objetivo", extra: true,
    }).errors).toEqual(['El campo "extra" no está permitido.']);
    expect(validateToolInput(schema, Object.create({ key: "Objetivo" })).valid).toBe(false);
    expect(validateToolInput({ ...schema, additionalProperties: false }, JSON.parse(
      '{"key":"Objetivo","__proto__":{},"constructor":"x"}',
    )).errors).toEqual([
      'El campo "__proto__" no está permitido.',
      'El campo "constructor" no está permitido.',
    ]);
  });

  it("coincide con JSON Schema para argumentos JSON arbitrarios", () => {
    const ajv = new Ajv({ allErrors: true, strict: true });
    const validators = AGENT_TOOL_DEFINITIONS.map((tool) => ({
      schema: tool.inputSchema, reference: ajv.compile(tool.inputSchema),
    }));
    fc.assert(fc.property(fc.constantFrom(...validators), fc.jsonValue(), ({ schema, reference }, input) =>
      validateToolInput(schema, input).valid === reference(input),
    ), { numRuns: 1000, seed: 400040 });
  });

  it("informa de campos requeridos y tipos incompatibles", () => {
    expect(writeMeasurement).toBeDefined();
    const missing = validateToolInput(writeMeasurement!.inputSchema, {});
    expect(missing.valid).toBe(false);
    expect(missing.errors).toContain('Falta el campo requerido "date".');
    expect(missing.errors).toContain('Falta el campo requerido "data".');

    const wrongType = validateToolInput(writeMeasurement!.inputSchema, {
      date: 20260411,
      data: {},
    });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.errors).toContain('El campo "date" debe ser de tipo string.');
  });

  it("valida el objeto estructurado de mediciones y sus campos anidados", () => {
    expect(writeMeasurement).toBeDefined();
    expect(validateToolInput(writeMeasurement!.inputSchema, {
      date: "2026-04-11",
      data: { weight_kg: 75.5, body_fat_pct: 18.5 },
    })).toEqual({ valid: true, errors: [] });

    const invalid = validateToolInput(writeMeasurement!.inputSchema, {
      date: "2026-04-11",
      data: { body_fat_pct: 101, unknown: 1 },
      clear_fields: ["not_a_measurement"],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain('El campo "data.body_fat_pct" debe ser 100 o menor.');
    expect(invalid.errors).toContain('El campo "data.unknown" no está permitido.');
    expect(invalid.errors[2]).toContain('El campo "clear_fields[0]" debe ser uno de estos valores');
  });

  it("rechaza valores fuera de un enum", () => {
    const readMeal = AGENT_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "read_meal_foods",
    );
    expect(readMeal).toBeDefined();
    const result = validateToolInput(readMeal!.inputSchema, {
      date: "2026-04-11",
      meal: "Picoteo",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('El campo "meal" debe ser uno de estos valores');
  });

  it("rechaza el JSON textual, arrays vacíos, decimales enteros y campos extra de create_routine", () => {
    const createRoutine = AGENT_TOOL_DEFINITIONS.find(
      (tool) => tool.name === "create_routine",
    );
    expect(createRoutine).toBeDefined();
    expect(validateToolInput(createRoutine!.inputSchema, {
      data: JSON.stringify({ name: "Pierna" }),
    }).valid).toBe(false);

    const result = validateToolInput(createRoutine!.inputSchema, {
      unexpected: true,
      data: {
        name: "Pierna",
        category: "strength",
        icon: "activity",
        exercises: [{
          kind: "custom",
          name: "Sentadilla",
          series: [{ type: "normal", reps: 2.5 }],
        }],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('El campo "unexpected" no está permitido.');
    expect(result.errors).toContain('El campo "data.exercises[0].series[0].reps" debe ser de tipo integer.');

    const empty = validateToolInput(createRoutine!.inputSchema, {
      data: { name: "Pierna", category: "strength", icon: "activity", exercises: [] },
    });
    expect(empty.errors).toContain('El campo "data.exercises" debe incluir al menos 1 elemento.');
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
