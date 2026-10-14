import assert from "node:assert/strict";
import test from "node:test";
import { githubJson } from "./prepare-policy-snapshot.mjs";

const url = "https://api.github.com/repos/maximofn/gymnasia/deployments";

test("CI autentica la lectura de deployments sin depender de la cuota anónima", async () => {
  let captured;
  const result = await githubJson(url, {
    token: "ci-test-token",
    fetchImpl: async (_url, options) => {
      captured = options;
      return { ok: true, json: async () => [{ id: 123 }] };
    },
  });
  assert.equal(captured.headers.Authorization, "Bearer ci-test-token");
  assert.equal(captured.redirect, "error");
  assert.deepEqual(result, [{ id: 123 }]);
});

test("la preparación local sigue pudiendo leer la política pública sin credencial", async () => {
  await githubJson(url, {
    token: "",
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, undefined);
      return { ok: true, json: async () => [] };
    },
  });
});

test("no envía la credencial de CI a otro origen ni sigue redirecciones", async () => {
  let requests = 0;
  await assert.rejects(githubJson("https://example.test/deployments", {
    token: "ci-test-token",
    fetchImpl: async () => { requests += 1; },
  }), /API de GitHub/);
  assert.equal(requests, 0);
});

test("un rechazo de GitHub conserva el fallo sin mostrar la credencial", async () => {
  await assert.rejects(githubJson(url, {
    token: "ci-test-token",
    fetchImpl: async () => ({ ok: false, status: 403 }),
  }), (error) => error.message.includes(": 403") && !error.message.includes("ci-test-token"));
});
