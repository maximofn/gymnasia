import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { createFeedbackIssueClient } from "./feedbackClient";
import type { FeedbackIssueDraft, FeedbackIssueOutcome } from "./feedbackIssues";
import { createOpenAIStreamParser } from "./providerStreamParsers";
import { runOpenAIToolLoop } from "./providerToolLoop";
import { createAgentToolExecutor, type ToolExecutorDependencies } from "./toolExecutor";

/**
 * Integración con proveedor falso para `create_feature_issue` (GYM-54).
 *
 * Recorre el ciclo completo con respuestas grabadas y sin red:
 *   SSE del proveedor -> parser -> bucle de tools -> ejecutor -> cliente HTTP
 *   -> resultado de tool que vuelve al modelo.
 *
 * Lo que se protege aquí es la propiedad que el código anterior violaba: el
 * texto que recibe el modelo **solo** puede afirmar que la incidencia existe
 * cuando el backend ha devuelto un número verificable.
 */

function readRawFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/raw/${name}`, import.meta.url), "utf8");
}

function replayInNetworkChunks<TResult>(
  raw: string,
  parser: { push: (chunk: string) => void; finish: () => TResult },
): TResult {
  // Trozos irregulares: una tool call partida por la mitad debe reensamblarse.
  const chunkSizes = [1, 7, 23, 5, 41, 3, 17];
  let offset = 0;
  let chunkIndex = 0;
  while (offset < raw.length) {
    const size = chunkSizes[chunkIndex % chunkSizes.length];
    parser.push(raw.slice(offset, offset + size));
    offset += size;
    chunkIndex += 1;
  }
  return parser.finish();
}

/** Ejecutor real, con el cliente HTTP real apuntando a un `fetch` grabado. */
function createExecutorWithBackend(fetchImpl: typeof fetch) {
  const client = createFeedbackIssueClient({
    baseUrl: "https://backend.test",
    fetchImpl,
  });
  const submitted: FeedbackIssueDraft[] = [];
  const dependencies = {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => [],
    saveMeasurements: async () => {},
    sortMeasurements: (measurements: unknown[]) => measurements,
    createId: (prefix: string) => `${prefix}_test`,
    getExerciseImageUrl: () => "",
    submitFeedbackIssue: async (draft: FeedbackIssueDraft): Promise<FeedbackIssueOutcome> => {
      submitted.push(draft);
      return client.submitIssue(draft);
    },
  } as unknown as ToolExecutorDependencies;
  return { executeTool: createAgentToolExecutor(dependencies), submitted };
}

function backendRespondingWith(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

/** Reproduce la fixture y ejecuta la tool que el modelo emite. */
async function runFeatureIssueTurn(executeTool: (name: string, args: Record<string, unknown>) => Promise<string>) {
  const turn = replayInNetworkChunks(
    readRawFixture("openai-feature-issue.sse"),
    createOpenAIStreamParser(),
  );
  const results: string[] = [];
  await runOpenAIToolLoop({
    initialTurn: turn,
    executeTool: async (name, args) => {
      const result = await executeTool(name, args);
      results.push(result);
      return result;
    },
    // Una sola ronda: tras la tool, el modelo cierra sin más llamadas.
    requestNextTurn: async () => ({
      responseId: null,
      outputItems: [],
      content: "",
      thinking: null,
    }),
  });
  return results;
}

describe("GYM-54: create_feature_issue de extremo a extremo con proveedor falso", () => {
  it("el modelo emite la tool y el ejecutor la reconoce con sus argumentos", async () => {
    const fetchImpl = backendRespondingWith(201, {
      number: 41,
      url: "https://github.com/maximofn/gymnasia-feedback/issues/41",
    });
    const { executeTool, submitted } = createExecutorWithBackend(fetchImpl);

    await runFeatureIssueTurn(executeTool);

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual({
      kind: "feature",
      title: "Exportar la dieta a PDF",
      summary: "El usuario quiere imprimir su dieta semanal.",
    });
  });

  it("con creación verificable, el modelo recibe el número real", async () => {
    const fetchImpl = backendRespondingWith(201, {
      number: 41,
      url: "https://github.com/maximofn/gymnasia-feedback/issues/41",
    });
    const { executeTool } = createExecutorWithBackend(fetchImpl);

    const [result] = await runFeatureIssueTurn(executeTool);

    expect(result).toContain("41");
    expect(result.toLowerCase()).toContain("registrada");
  });

  it("el cuerpo enviado al backend lleva solo las cinco claves del contrato", async () => {
    const fetchImpl = backendRespondingWith(201, {
      number: 1,
      url: "https://github.com/maximofn/gymnasia-feedback/issues/1",
    });
    const { executeTool } = createExecutorWithBackend(fetchImpl);

    await runFeatureIssueTurn(executeTool);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual([
      "idempotency_key",
      "kind",
      "schema_version",
      "summary",
      "title",
    ]);
    // Nada de conversación literal: el esquema de la tool ni siquiera la ofrece.
    expect(JSON.stringify(body)).not.toContain("conversation");
  });

  it.each([
    ["backend caído", 503, "", "no afirmes"],
    ["rechazo por rate limit", 429, "", "no afirmes"],
    ["error del servidor", 500, "", "no afirmes"],
    ["respuesta 2xx sin referencia", 200, '{"ok":true}', "no afirmes"],
    ["URL que no es de GitHub", 201, '{"number":7,"url":"https://evil.example/7"}', "no afirmes"],
  ])(
    "con %s, el modelo NUNCA recibe una confirmación de creación",
    async (_caso, status, body, esperado) => {
      const { executeTool } = createExecutorWithBackend(backendRespondingWith(status, body));

      const [result] = await runFeatureIssueTurn(executeTool);

      expect(result.toLowerCase()).toContain(esperado);
      expect(result.toLowerCase()).not.toContain("registrada con el n");
    },
  );

  it("un fallo de transporte no aborta el turno del chat", async () => {
    // Sin el try/catch del ejecutor, esta excepción subiría por el bucle de
    // tools y tumbaría la conversación entera.
    const exploding = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const { executeTool } = createExecutorWithBackend(exploding);

    const [result] = await runFeatureIssueTurn(executeTool);

    expect(result.toLowerCase()).toContain("no afirmes");
  });

  it("sin título ni resumen utilizables no se llama al backend", async () => {
    const fetchImpl = backendRespondingWith(201, { number: 1, url: "https://github.com/a/b/issues/1" });
    const { executeTool } = createExecutorWithBackend(fetchImpl);

    const result = await executeTool("create_feature_issue", { title: "   ", summary: "" });

    expect(result).toContain("Falta el título");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
