import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";

// Development-only, loopback-only SSE server. Android reaches it through adb reverse.
const port = Number(process.env.GOOGLE_FIXTURE_PORT || 18882);
const scenario = process.env.GOOGLE_FIXTURE_SCENARIO || "objective";
assert(["objective", "measurement", "truncate", "malformed"].includes(scenario));
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
let requests = 0;
let continuations = 0;
const fixture = (name) => readFileSync(new URL(`../agent/__fixtures__/raw/${name}.sse`, import.meta.url), "utf8");

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type,x-goog-api-key");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (request.url === "/results") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ scenario, requests, continuations })); return;
  }
  try {
    assert.equal(request.headers["x-goog-api-key"], "e2e-local-fake-key");
    if (request.method === "GET" && request.url?.startsWith("/v1beta/models")) {
      const model = { name: "models/gemini-3.8-flash", displayName: "Google fixture",
        supportedGenerationMethods: ["generateContent"] };
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(request.url === "/v1beta/models" ? { models: [model] } : model)); return;
    }
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/v1beta/interactions");
    let source = "";
    for await (const chunk of request) { source += chunk; assert(source.length <= 2_000_000); }
    const body = JSON.parse(source);
    assert.equal(body.store, false);
    assert.equal(body.stream, true);
    assert.equal("previous_interaction_id" in body, false);
    assert(Array.isArray(body.input));
    requests += 1;
    const continuing = body.input.at(-1)?.type === "function_result";
    if (continuing) {
      continuations += 1;
      const result = body.input.at(-1);
      assert(body.input.some((step) => step.type === "function_call" && step.id === result.call_id && step.name === result.name));
    }
    const prefix = scenario === "measurement" ? "google-measurement" : "google";
    let raw = fixture(`${prefix}-${continuing ? "final" : "tool-call"}`);
    raw = raw.replace(/"id": "([^"]+)"/g, (_match, id) => `"id": "${id}_${requests}"`);
    // Every lifecycle event is replayed. The actual XHR receives cumulative text.
    raw = raw.split("\n\n").map((event) => /^event: step\.(start|stop)/.test(event)
      ? `${event}\n\n${event}` : event).join("\n\n");
    if (scenario === "truncate") raw = raw.slice(0, raw.indexOf("event: step.stop"));
    if (scenario === "malformed") raw = "event: step.start\ndata: {broken}\n\n";
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" });
    const bytes = Buffer.from(raw);
    for (let i = 0; i < bytes.length && !response.destroyed; i += 7) {
      response.write(bytes.subarray(i, i + 7)); await setImmediate();
    }
    response.end();
    console.log(JSON.stringify({ scenario, request: requests, continuation: continuing }));
  } catch {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Google fixture contract failed" } }));
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Google fixture ready on 127.0.0.1:${port} (${scenario})`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
