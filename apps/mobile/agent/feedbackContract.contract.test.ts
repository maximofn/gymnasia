import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_TOOL_DEFINITIONS } from "./toolDefinitions";
import {
  FEEDBACK_ISSUE_KINDS,
  FEEDBACK_ISSUE_PATH,
  FEEDBACK_SCHEMA_VERSION,
  REPORT_SUMMARY_MAX_LENGTH,
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
    expect(numericConstant(workerContract, "REPORT_SUMMARY_MAX_LENGTH")).toBe(
      REPORT_SUMMARY_MAX_LENGTH,
    );
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

describe("el APK que se distribuye debe poder hablar con el backend", () => {
  // Este contrato existe por un fallo real: el workflow distribuía staging y su
  // endpoint estaba vacío. Ahora la publicación solo admite production-apk; el
  // test ancla tanto esa variante como su backend para que no vuelva a degradar
  // en silencio.
  const appConfig = readFileSync(join(__dirname, "..", "app.config.ts"), "utf8");
  const buildWorkflow = readFileSync(
    join(repositoryRoot, ".github", "workflows", "build-apk.yml"),
    "utf8",
  );

  function endpointFor(environment: string): string {
    const block = appConfig.match(
      /const FEEDBACK_ENDPOINTS: Record<BuildEnvironment, string> = \{([\s\S]*?)\};/,
    );
    if (!block) throw new Error("No se encontró FEEDBACK_ENDPOINTS en app.config.ts.");
    const line = block[1]
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${environment}:`));
    if (!line) throw new Error(`No se encontró el entorno ${environment}.`);
    return line.slice(environment.length + 1).replace(/,$/, "").trim();
  }

  it("el workflow de publicación solo compila production-apk", () => {
    expect(buildWorkflow).toContain("--profile production-apk");
    expect(buildWorkflow).toContain("--build-profile production-apk");
    expect(buildWorkflow).not.toContain("github.event.inputs.profile");
    expect(buildWorkflow).not.toContain("inputs.profile");
    expect(buildWorkflow).toContain("environment: Production");
    expect(buildWorkflow).toContain("--environment production");
  });

  it("staging y production tienen endpoint configurado", () => {
    for (const environment of ["staging", "production"]) {
      const value = endpointFor(environment);
      expect(value).not.toBe('""');
      expect(value).not.toBe("''");
    }
  });

  it("staging y production apuntan al mismo backend", () => {
    // Solo hay un backend. La distinción staging/producción de este repositorio
    // es del canal de la política del agente, no del receptor de incidencias.
    expect(endpointFor("staging")).toBe(endpointFor("production"));
  });

  it("development se queda sin endpoint", () => {
    // Trastear en local no puede escribir en el repositorio de incidencias real.
    expect(endpointFor("development")).toBe('""');
  });

  it("el host configurado está declarado en el inventario de datos", () => {
    const inventory = readFileSync(
      join(repositoryRoot, "scripts", "data-inventory", "inventory.json"),
      "utf8",
    );
    const url = appConfig.match(/const FEEDBACK_ENDPOINT = "(https:\/\/[^"]+)"/);
    expect(url).not.toBeNull();
    const host = new URL(url![1]).host;
    expect(inventory).toContain(`"host": "${host}"`);
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
