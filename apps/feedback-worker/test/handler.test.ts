import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  RATE_LIMIT_COUNTER_CUTOFF_MS,
  REPORT_REDACTION_BATCH_SIZE,
  REPORT_RETENTION_MS,
  pseudonymizeRateLimitIdentifier,
  redactExpiredReports,
  type Env,
} from "../src/index";
import { REDACTED_REPORT_BODY } from "../src/github";
import { createFakeDatabase } from "./fakeDatabase";

const ORIGIN = "https://gymnasia.maximofn.com";

function makeEnv(overrides: Partial<Env> = {}): {
  env: Env;
  issues: Map<string, unknown>;
  requests: Array<{ identifier: string; created_at: number }>;
} {
  const { database, issues, requests } = createFakeDatabase();
  return {
    env: {
      DB: database,
      GITHUB_TOKEN: "token-de-prueba",
      GITHUB_REPO: "maximofn/gymnasia-feedback",
      RATE_LIMIT_SALT: "sal-de-prueba-no-secreta",
      ALLOWED_ORIGINS: ORIGIN,
      FEEDBACK_ENABLED: "true",
      ...overrides,
    },
    issues: issues as unknown as Map<string, unknown>,
    requests,
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

  it("solo persiste un HMAC de la IP para el rate limiting", async () => {
    const { env, requests } = makeEnv();
    const ip = "203.0.113.17";
    await worker.fetch(makeRequest(validBody(), { "cf-connecting-ip": ip }), env);
    expect(requests).toHaveLength(1);
    expect(requests[0].identifier).not.toBe(ip);
    expect(requests[0].identifier).toMatch(/^[0-9a-f]{64}$/);
    await expect(pseudonymizeRateLimitIdentifier(ip, env.RATE_LIMIT_SALT)).resolves.toBe(
      requests[0].identifier,
    );
  });

  it("falla cerrado si falta el secreto del HMAC", async () => {
    const { env } = makeEnv({ RATE_LIMIT_SALT: "" });
    const response = await worker.fetch(makeRequest(validBody()), env);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
    expect(fetchSpy).not.toHaveBeenCalled();
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

describe("retención de denuncias", () => {
  function insertCreatedReport(
    issues: Map<string, unknown>,
    index: number,
    createdAt: number,
  ): void {
    const key = `v1:report:${index.toString(16).padStart(16, "0")}`;
    issues.set(key, {
      idempotency_key: key,
      kind: "report",
      content_hash: `hash-${index}`,
      state: "created",
      issue_number: 100 + index,
      issue_url: `https://github.com/maximofn/gymnasia-feedback/issues/${100 + index}`,
      created_at: createdAt,
      redacted_at: null,
    });
  }

  it("redacta el cuerpo al cumplir 30 días y conserva solo una nota neutra", async () => {
    const now = Date.UTC(2026, 7, 23, 12);
    const { env, issues } = makeEnv();
    insertCreatedReport(issues, 1, now - REPORT_RETENTION_MS);

    await expect(redactExpiredReports(env, now)).resolves.toBe(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ body: REDACTED_REPORT_BODY });
    expect((issues.get(`v1:report:${"1".padStart(16, "0")}`) as { redacted_at: number }).redacted_at)
      .toBe(now);
  });

  it("no toca denuncias con menos de 30 días", async () => {
    const now = Date.UTC(2026, 7, 23, 12);
    const { env, issues } = makeEnv();
    insertCreatedReport(issues, 1, now - REPORT_RETENTION_MS + 1);
    await expect(redactExpiredReports(env, now)).resolves.toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("solo marca la limpieza tras un PATCH correcto y reintenta después", async () => {
    const now = Date.UTC(2026, 7, 23, 12);
    const { env, issues } = makeEnv();
    insertCreatedReport(issues, 1, now - REPORT_RETENTION_MS);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    await expect(redactExpiredReports(env, now)).resolves.toBe(0);
    const row = issues.get(`v1:report:${"1".padStart(16, "0")}`) as { redacted_at: number | null };
    expect(row.redacted_at).toBeNull();

    vi.stubGlobal("fetch", githubOk(101));
    await expect(redactExpiredReports(env, now + 60_000)).resolves.toBe(1);
    expect(row.redacted_at).toBe(now + 60_000);
  });

  it("limita cada ejecución para respetar las subpeticiones del plan gratuito", async () => {
    const now = Date.UTC(2026, 7, 23, 12);
    const { env, issues } = makeEnv();
    for (let index = 0; index < REPORT_REDACTION_BATCH_SIZE + 1; index += 1) {
      insertCreatedReport(issues, index, now - REPORT_RETENTION_MS - index);
    }
    await expect(redactExpiredReports(env, now)).resolves.toBe(REPORT_REDACTION_BATCH_SIZE);
    expect(fetchSpy).toHaveBeenCalledTimes(REPORT_REDACTION_BATCH_SIZE);
  });

  it("el trigger programado elimina identificadores HMAC antes de cumplir 48 horas", async () => {
    const now = Date.UTC(2026, 7, 23, 12, 17);
    const { env, requests } = makeEnv();
    requests.push(
      { identifier: "antiguo", created_at: now - RATE_LIMIT_COUNTER_CUTOFF_MS - 1 },
      { identifier: "reciente", created_at: now - RATE_LIMIT_COUNTER_CUTOFF_MS + 1 },
    );

    await worker.scheduled({ scheduledTime: now }, env);

    expect(requests).toEqual([
      { identifier: "reciente", created_at: now - RATE_LIMIT_COUNTER_CUTOFF_MS + 1 },
    ]);
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
