import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import fc from "fast-check";

const require = createRequire(import.meta.url);
const {
  atomicWriteFile,
  authorizeDevStoreRequest,
  createDevStoreMiddleware,
  policy,
  sanitizeDevStoreValue,
  validateDevStorePayload,
} = require("../../apps/mobile/dev-store/middleware.cjs");

function validStore(marker = "default", secret = "") {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [{ id: marker, title: marker }],
    messagesByThread: { main: [{ content: "ordinary text", token: secret }] },
    keys: [
      {
        provider: "openai",
        is_active: true,
        api_key: secret,
        model: "gpt-test",
        workspace_id: secret,
        reasoning_effort: "low",
      },
      {
        provider: "anthropic",
        is_active: false,
        api_key: "",
        model: "claude-test",
        workspace_id: secret,
        reasoning_effort: null,
      },
      {
        provider: "google",
        is_active: false,
        api_key: "",
        model: "gemini-test",
        workspace_id: "",
        reasoning_effort: null,
      },
    ],
    chatProvider: "openai",
    foodAIProvider: "google",
  };
}

function invokeMiddleware(middleware, {
  method = "GET",
  body = "",
  headers = {},
  url = "/dev-store",
} = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = url;
  request.headers = {
    host: "127.0.0.1:8081",
    origin: "http://127.0.0.1:8081",
    "sec-fetch-site": "same-origin",
    ...headers,
  };

  return new Promise((resolve, reject) => {
    const responseHeaders = new Map();
    const response = {
      statusCode: 200,
      headersSent: false,
      writableEnded: false,
      setHeader(name, value) {
        responseHeaders.set(name.toLowerCase(), `${value}`);
      },
      end(contents = "") {
        this.headersSent = true;
        this.writableEnded = true;
        resolve({
          status: this.statusCode,
          body: `${contents}`,
          headers: responseHeaders,
        });
      },
    };
    request.on("error", reject);
    middleware(request, response, () => resolve({ next: true, headers: responseHeaders }));
  });
}

function postStore(middleware, store, headers = {}) {
  const body = typeof store === "string" ? store : JSON.stringify(store);
  return invokeMiddleware(middleware, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("la política fija el límite, el esquema raíz y los campos siempre censurados", () => {
  assert.equal(policy.maxBytes, 5 * 1024 * 1024);
  assert.deepEqual(policy.sensitiveFieldNames, [
    "api_key",
    "workspace_id",
    "access_token",
    "refresh_token",
    "authorization",
    "password",
    "secret",
    "token",
  ]);
  assert.deepEqual(validateDevStorePayload(sanitizeDevStoreValue(validStore())), { ok: true });
  assert.equal(validateDevStorePayload({ ...validStore(), unexpected: true }).ok, false);
});

test("el saneado Node es profundo, inmutable e idempotente", () => {
  fc.assert(fc.property(
    fc.constantFrom(...policy.sensitiveFieldNames),
    fc.jsonValue(),
    (field, value) => {
      const original = { nested: [{ [field]: value }], content: "secret-like text is preserved" };
      const once = sanitizeDevStoreValue(original);
      assert.equal(once.nested[0][field], "");
      assert.equal(once.content, original.content);
      assert.deepEqual(sanitizeDevStoreValue(once), once);
      assert.deepEqual(original.nested[0][field], value);
    },
  ));
});

test("solo autoriza mismo origen sobre loopback", () => {
  assert.deepEqual(authorizeDevStoreRequest({
    host: "127.0.0.1:8081",
    origin: "http://127.0.0.1:8081",
    "sec-fetch-site": "same-origin",
  }), { ok: true });
  assert.equal(authorizeDevStoreRequest({ host: "192.168.1.2:8081" }).ok, false);
  assert.equal(authorizeDevStoreRequest({
    host: "127.0.0.1:8081",
    origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
  }).ok, false);
});

test("el middleware sanea POST y ficheros heredados, niega CORS y fuerza permisos privados", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gymnasia-dev-store-unit-"));
  const storePath = join(directory, ".dev-store.json");
  t.after(() => rm(directory, { recursive: true, force: true }));

  const middleware = createDevStoreMiddleware({ storePath, enabled: () => true });

  const secret = "sk-unit-private-value";
  const postResponse = await postStore(middleware, validStore("posted", secret));
  assert.equal(postResponse.status, 204);
  assert.equal(await readFile(storePath, "utf8").then((text) => text.includes(secret)), false);

  const getResponse = await invokeMiddleware(middleware);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.headers.has("access-control-allow-origin"), false);
  assert.equal(getResponse.body.includes(secret), false);
  assert.equal((await stat(storePath)).mode & 0o777, 0o600);

  await writeFile(storePath, JSON.stringify(validStore("legacy", secret)), { mode: 0o644 });
  const legacyResponse = await invokeMiddleware(middleware);
  assert.equal(legacyResponse.status, 200);
  assert.equal(legacyResponse.body.includes(secret), false);
  assert.equal((await readFile(storePath, "utf8")).includes(secret), false);
  assert.equal((await stat(storePath)).mode & 0o777, 0o600);

  const crossOrigin = await invokeMiddleware(middleware, {
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  });
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.has("access-control-allow-origin"), false);
});

test("rechaza modo apagado, tipo, tamaño, JSON y esquema inválidos", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gymnasia-dev-store-validation-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const disabledMiddleware = createDevStoreMiddleware({
    storePath: join(directory, "disabled.json"),
    enabled: () => false,
  });
  assert.equal((await invokeMiddleware(disabledMiddleware)).status, 404);

  const middleware = createDevStoreMiddleware({
    storePath: join(directory, "enabled.json"),
    enabled: () => true,
    maxBytes: 256,
  });

  const wrongType = await invokeMiddleware(middleware, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(wrongType.status, 415);
  assert.equal((await postStore(middleware, "{")).status, 400);
  assert.equal((await postStore(middleware, {})).status, 422);
  assert.equal((await postStore(middleware, "x".repeat(257))).status, 413);
});

test("cuerpos JSON arbitrarios nunca atraviesan el límite ni omiten el esquema", async () => {
  const maxBytes = 192;
  const middleware = createDevStoreMiddleware({
    storePath: join(tmpdir(), "unused-property-dev-store.json"),
    enabled: () => true,
    maxBytes,
    atomicWriter: async () => {},
  });

  await fc.assert(fc.asyncProperty(fc.jsonValue(), async (value) => {
    const body = JSON.stringify(value);
    const response = await postStore(middleware, body);
    if (Buffer.byteLength(body, "utf8") > maxBytes) {
      assert.equal(response.status, 413);
    } else {
      assert.ok([204, 422].includes(response.status));
    }
  }));
});

test("el reemplazo atómico conserva el archivo anterior si falla rename", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "gymnasia-dev-store-atomic-"));
  const storePath = join(directory, ".dev-store.json");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(storePath, "previous", { mode: 0o600 });

  const failingFileSystem = new Proxy((await import("node:fs")).promises, {
    get(target, property) {
      if (property === "rename") return async () => { throw new Error("rename failed"); };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  await assert.rejects(() => atomicWriteFile(storePath, "next", failingFileSystem), /rename failed/);
  assert.equal(await readFile(storePath, "utf8"), "previous");
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
});

test("serializa escrituras concurrentes en el orden en que se reciben", async (t) => {
  const writes = [];
  let releaseFirst;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const firstMayFinish = new Promise((resolve) => { releaseFirst = resolve; });
  const atomicWriter = async (_path, contents) => {
    writes.push(contents);
    if (writes.length === 1) {
      markFirstStarted();
      await firstMayFinish;
    }
  };
  const middleware = createDevStoreMiddleware({
    storePath: join(tmpdir(), "unused-dev-store.json"),
    enabled: () => true,
    atomicWriter,
  });

  const first = postStore(middleware, validStore("first"));
  await firstStarted;
  const second = postStore(middleware, validStore("second"));
  releaseFirst();
  assert.equal((await first).status, 204);
  assert.equal((await second).status, 204);
  assert.deepEqual(writes.map((contents) => JSON.parse(contents).threads[0].id), ["first", "second"]);
});
