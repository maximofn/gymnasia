import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";
import { createFakeDatabase } from "./fakeDatabase";

const ORIGIN = "https://gymnasia.maximofn.com";

function makeEnv(overrides: Partial<Env> = {}): { env: Env; issues: Map<string, unknown> } {
  const { database, issues } = createFakeDatabase();
  return {
    env: {
      DB: database,
      GITHUB_TOKEN: "token-de-prueba",
      GITHUB_REPO: "maximofn/gymnasia-feedback",
      ALLOWED_ORIGINS: ORIGIN,
      FEEDBACK_ENABLED: "true",
      ...overrides,
    },
    issues: issues as unknown as Map<string, unknown>,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://gymnasia-feedback.maximofn.com/feedback/issues", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    kind: "feature",
    title: "Exportar la dieta a PDF",
    summary: "Poder imprimir la dieta semanal.",
    idempotency_key: `v1:feature:${"a".repeat(16)}`,
    ...overrides,
  };
}

function githubOk(number = 41) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ number, html_url: `https://github.com/x/y/issues/${number}` }),
      { status: 201, headers: { "content-type": "application/json" } },
    ),
  );
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = githubOk();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /health", () => {
  it("responde ok", async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/health"),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("POST /feedback/issues", () => {
  it("crea la issue y devuelve número y URL verificables", async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(makeRequest(validBody()), env);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      status: "created",
      number: 41,
      url: "https://github.com/x/y/issues/41",
      deduplicated: false,
    });
  });

  it("fija repositorio, método y etiquetas en el servidor", async () => {
    const { env } = makeEnv();
    await worker.fetch(makeRequest(validBody()), env);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/maximofn/gymnasia-feedback/issues");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.labels).toEqual(["enhancement"]);
    expect(body.title).toBe("[FEATURE] Exportar la dieta a PDF");
  });

  it("no permite que el cliente elija repositorio ni etiquetas", async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(
      makeRequest(validBody({ repo: "victima/objetivo", labels: ["x"] })),
      env,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ reason: "unknown_fields" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reintentar con la misma clave devuelve la misma issue sin duplicar", async () => {
    const { env } = makeEnv();
    const first = await worker.fetch(makeRequest(validBody()), env);
    expect(first.status).toBe(201);

    const second = await worker.fetch(makeRequest(validBody()), env);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      status: "created",
      number: 41,
      url: "https://github.com/x/y/issues/41",
      deduplicated: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("deduplica por contenido aunque cambie la clave", async () => {
    const { env } = makeEnv();
    await worker.fetch(makeRequest(validBody()), env);
    const response = await worker.fetch(
      makeRequest(validBody({ idempotency_key: `v1:feature:${"b".repeat(16)}` })),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ deduplicated: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("mapea un fallo de GitHub a error sin filtrar el status del upstream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const { env } = makeEnv();
    const response = await worker.fetch(makeRequest(validBody()), env);
    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload).toEqual({ status: "error", reason: "upstream_failed" });
    expect(JSON.stringify(payload)).not.toContain("401");
  });

  it("no declara éxito si GitHub devuelve 2xx sin referencia utilizable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 })),
    );
    const { env } = makeEnv();
    const response = await worker.fetch(makeRequest(validBody()), env);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: "error" });
  });

  it("permite reintentar después de un fallo de GitHub", async () => {
    const failing = vi.fn(async () => new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", failing);
    const { env } = makeEnv();
    expect((await worker.fetch(makeRequest(validBody()), env)).status).toBe(502);

    vi.stubGlobal("fetch", githubOk(77));
    const retry = await worker.fetch(makeRequest(validBody()), env);
    expect(retry.status).toBe(201);
    await expect(retry.json()).resolves.toMatchObject({ number: 77 });
  });

  it("aplica rate limiting por IP", async () => {
    const { env } = makeEnv();
    const headers = { "cf-connecting-ip": "203.0.113.9" };
    // El contenido debe variar además de la clave: si no, la deduplicación por
    // contenido responde 200 y el test no estaría midiendo el rate limiting.
    for (let index = 0; index < 5; index += 1) {
      const response = await worker.fetch(
        makeRequest(
          validBody({
            title: `Mejora número ${index}`,
            idempotency_key: `v1:feature:${String(index).repeat(16)}`,
          }),
          headers,
        ),
        env,
      );
      expect(response.status).toBe(201);
    }
    const blocked = await worker.fetch(
      makeRequest(
        validBody({ title: "Otra más", idempotency_key: `v1:feature:${"9".repeat(16)}` }),
        headers,
      ),
      env,
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("responde unavailable cuando el interruptor está apagado", async () => {
    const { env } = makeEnv({ FEEDBACK_ENABLED: "false" });
    const response = await worker.fetch(makeRequest(validBody()), env);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rechaza sin el secreto compartido cuando está configurado", async () => {
    const { env } = makeEnv({ APP_SHARED_SECRET: "secreto-de-build" });
    const sinSecreto = await worker.fetch(makeRequest(validBody()), env);
    expect(sinSecreto.status).toBe(403);

    const conSecreto = await worker.fetch(
      makeRequest(validBody(), { "x-gymnasia-app": "secreto-de-build" }),
      env,
    );
    expect(conSecreto.status).toBe(201);
  });

  it("rechaza métodos y rutas que no son el endpoint", async () => {
    const { env } = makeEnv();
    const get = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/feedback/issues"),
      env,
    );
    expect(get.status).toBe(405);

    const otra = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/repos/x/y/issues", { method: "POST" }),
      env,
    );
    expect(otra.status).toBe(404);
  });

  it("no lanza con un cuerpo que no es JSON", async () => {
    const { env } = makeEnv();
    const response = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/feedback/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{no es json",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("CORS", () => {
  it("permite el origen configurado y no otros", async () => {
    const { env } = makeEnv();
    const permitido = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/feedback/issues", {
        method: "OPTIONS",
        headers: { origin: ORIGIN },
      }),
      env,
    );
    expect(permitido.headers.get("access-control-allow-origin")).toBe(ORIGIN);

    const ajeno = await worker.fetch(
      new Request("https://gymnasia-feedback.maximofn.com/feedback/issues", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
      env,
    );
    expect(ajeno.headers.get("access-control-allow-origin")).toBeNull();
  });
});
