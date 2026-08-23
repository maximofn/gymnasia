import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_TOOL_DEFINITIONS } from "./toolDefinitions";
import {
  FEEDBACK_ISSUE_KINDS,
  FEEDBACK_ISSUE_PATH,
  FEEDBACK_SCHEMA_VERSION,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "./feedbackIssues";

const repositoryRoot = join(__dirname, "..", "..", "..");
const workerContract = readFileSync(
  join(repositoryRoot, "apps", "feedback-worker", "src", "contract.ts"),
  "utf8",
);
const appSource = readFileSync(join(__dirname, "..", "App.tsx"), "utf8");

function numericConstant(source: string, name: string): number {
  const match = source.match(new RegExp(`export const ${name} = (\\d+)`));
  if (!match) throw new Error(`No se encontró ${name} en el contrato del Worker.`);
  return Number(match[1]);
}

describe("contrato cliente <-> Worker", () => {
  it("los límites de longitud coinciden", () => {
    expect(numericConstant(workerContract, "TITLE_MAX_LENGTH")).toBe(TITLE_MAX_LENGTH);
    expect(numericConstant(workerContract, "SUMMARY_MAX_LENGTH")).toBe(SUMMARY_MAX_LENGTH);
  });

  it("la versión de esquema coincide", () => {
    expect(workerContract).toContain(
      `export const FEEDBACK_SCHEMA_VERSION = ${FEEDBACK_SCHEMA_VERSION} as const;`,
    );
  });

  it("la ruta del endpoint coincide", () => {
    expect(workerContract).toContain(
      `export const FEEDBACK_ISSUE_PATH = "${FEEDBACK_ISSUE_PATH}" as const;`,
    );
  });

  it("los tipos de incidencia coinciden", () => {
    for (const kind of FEEDBACK_ISSUE_KINDS) {
      expect(workerContract).toContain(`"${kind}"`);
    }
  });

  it("el Worker acepta exactamente las claves que el cliente envía", () => {
    for (const key of ["schema_version", "kind", "title", "summary", "idempotency_key"]) {
      expect(workerContract).toContain(`"${key}"`);
    }
  });
});

describe("create_feature_issue: contrato de la tool", () => {
  const definition = AGENT_TOOL_DEFINITIONS.find(
    (tool) => tool.name === "create_feature_issue",
  );

  it("sigue publicándose al modelo", () => {
    expect(definition).toBeDefined();
  });

  it("no declara ninguna propiedad de conversación literal", () => {
    // GYM-54 prohíbe enviar conversación cruda: si el campo no existe en el
    // contrato, el modelo no puede rellenarlo.
    const properties = Object.keys(definition!.inputSchema.properties);
    expect(properties).toEqual(["title", "summary"]);
    for (const property of properties) {
      expect(property).not.toMatch(/excerpt|conversation|conversacion/i);
    }
    expect(JSON.stringify(definition)).not.toContain("conversation_excerpt");
  });

  it("instruye al modelo a pedir confirmación y a no afirmar la creación", () => {
    const description = definition!.description.toLowerCase();
    expect(description).toContain("aprueb");
    expect(description).toContain("no afirmes nunca");
  });
});

describe("regresión: los escritores no-op han desaparecido de App.tsx", () => {
  // App.tsx no tiene tests unitarios (23.726 líneas, ver GYM-202, ticket para
  // estudiar cómo testear App.tsx). Leerlo como texto es la única forma de
  // anclar este borrado de forma determinista.
  it("no queda el token vacío ni ninguna de las tres funciones", () => {
    for (const symbol of [
      "GITHUB_FOOD_ISSUE_TOKEN",
      "createGitHubFoodIssue",
      "createGitHubExerciseIssue",
      "createGitHubFeatureIssue",
    ]) {
      expect(appSource).not.toContain(symbol);
    }
  });

  it("no queda ninguna escritura directa contra la API de issues de GitHub", () => {
    expect(appSource).not.toContain("api.github.com/repos/maximofn/gymnasia/issues");
    expect(appSource).not.toMatch(/repos\/[^"'`]+\/issues/);
  });

  it("no hay ninguna cabecera de autorización de GitHub en el cliente", () => {
    expect(appSource).not.toMatch(/Authorization: `Bearer \$\{GITHUB/);
  });
});
