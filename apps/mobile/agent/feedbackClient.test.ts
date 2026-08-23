import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { createFeedbackIssueClient, mapFeedbackResponse } from "./feedbackClient";
import type { FeedbackIssueDraft } from "./feedbackIssues";

const draft: FeedbackIssueDraft = {
  kind: "feature",
  title: "Exportar la dieta",
  summary: "Quiero un PDF imprimible.",
};

function respondWith(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("mapFeedbackResponse", () => {
  it("acepta un 2xx con referencia verificable", () => {
    const outcome = mapFeedbackResponse(
      201,
      JSON.stringify({ status: "created", number: 41, url: "https://github.com/a/b/issues/41" }),
    );
    expect(outcome).toEqual({
      status: "created",
      issueNumber: 41,
      issueUrl: "https://github.com/a/b/issues/41",
      deduplicated: false,
    });
  });

  it("propaga deduplicated", () => {
    const outcome = mapFeedbackResponse(
      200,
      JSON.stringify({ number: 41, url: "https://github.com/a/b/issues/41", deduplicated: true }),
    );
    expect(outcome).toMatchObject({ status: "created", deduplicated: true });
  });

  it("NO declara éxito con un 2xx sin referencia utilizable", () => {
    for (const body of ['{"ok":true}', "{}", "", "no es json", '{"number":0,"url":"x"}']) {
      expect(mapFeedbackResponse(200, body)).toEqual({
        status: "error",
        reason: "malformed_response",
      });
    }
  });

  it("NO declara éxito con una URL que no es de GitHub", () => {
    const outcome = mapFeedbackResponse(
      201,
      JSON.stringify({ number: 41, url: "https://evil.example/issues/41" }),
    );
    expect(outcome).toEqual({ status: "error", reason: "malformed_response" });
  });

  it("mapea cada familia de status a su resultado", () => {
    expect(mapFeedbackResponse(503, "")).toEqual({ status: "unavailable", reason: "disabled" });
    expect(mapFeedbackResponse(429, "")).toEqual({ status: "rejected", reason: "rate_limited" });
    expect(mapFeedbackResponse(413, "")).toEqual({ status: "rejected", reason: "too_long" });
    expect(mapFeedbackResponse(403, "")).toEqual({ status: "rejected", reason: "forbidden" });
    expect(mapFeedbackResponse(400, "")).toEqual({ status: "rejected", reason: "invalid_input" });
    expect(mapFeedbackResponse(500, "")).toEqual({ status: "error", reason: "server" });
  });
});

describe("createFeedbackIssueClient", () => {
  it("envía exactamente las cinco claves del contrato, y ninguna más", async () => {
    const fetchImpl = respondWith(201, {
      number: 1,
      url: "https://github.com/a/b/issues/1",
    });
    const client = createFeedbackIssueClient({
      baseUrl: "https://backend.example",
      fetchImpl,
    });
    await client.submitIssue(draft);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://backend.example/feedback/issues");
    expect(init.method).toBe("POST");
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual([
      "idempotency_key",
      "kind",
      "schema_version",
      "summary",
      "title",
    ]);
  });

  it("no envía cabecera de autorización", async () => {
    const fetchImpl = respondWith(201, { number: 1, url: "https://github.com/a/b/issues/1" });
    const client = createFeedbackIssueClient({ baseUrl: "https://backend.example", fetchImpl });
    await client.submitIssue(draft);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain("authorization");
  });

  it("convierte un fallo de transporte en error/transport sin lanzar", async () => {
    const client = createFeedbackIssueClient({
      baseUrl: "https://backend.example",
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    });
    await expect(client.submitIssue(draft)).resolves.toEqual({
      status: "error",
      reason: "transport",
    });
  });

  it("convierte un abort en error/timeout", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const client = createFeedbackIssueClient({
      baseUrl: "https://backend.example",
      fetchImpl: (async () => {
        throw abortError;
      }) as unknown as typeof fetch,
    });
    await expect(client.submitIssue(draft)).resolves.toEqual({
      status: "error",
      reason: "timeout",
    });
  });

  it("reintentar el mismo borrador usa la misma clave de idempotencia", async () => {
    const fetchImpl = respondWith(201, { number: 1, url: "https://github.com/a/b/issues/1" });
    const client = createFeedbackIssueClient({ baseUrl: "https://backend.example", fetchImpl });
    await client.submitIssue(draft);
    await client.submitIssue({ ...draft });
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const first = JSON.parse(String((calls[0][1] as RequestInit).body)).idempotency_key;
    const second = JSON.parse(String((calls[1][1] as RequestInit).body)).idempotency_key;
    expect(first).toBe(second);
  });
});

describe("mapFeedbackResponse: propiedades", () => {
  it("nunca lanza y nunca inventa un éxito", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 599 }),
        fc.oneof(
          fc.string({ maxLength: 200 }),
          fc.json(),
          fc.constant(""),
          fc.constant("<html>error</html>"),
        ),
        (status, body) => {
          const outcome = mapFeedbackResponse(status, String(body));
          expect(typeof outcome.status).toBe("string");
          if (outcome.status === "created") {
            // La invariante que sostiene el ticket entero.
            expect(status).toBeGreaterThanOrEqual(200);
            expect(status).toBeLessThan(300);
            expect(Number.isInteger(outcome.issueNumber)).toBe(true);
            expect(outcome.issueNumber).toBeGreaterThan(0);
            expect(outcome.issueUrl.startsWith("https://github.com/")).toBe(true);
          }
        },
      ),
    );
  });
});
