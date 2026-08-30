import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm, stat, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(mobileRoot));
const syntheticSecret = `sk-e2e-${"private".repeat(8)}`;

function log(message) {
  console.log(`[dev-store-e2e] ${message}`);
}

function fixtureStore(secret = syntheticSecret) {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [{ id: "thread-e2e", title: "Estado restaurable" }],
    messagesByThread: { "thread-e2e": [{ content: "Mensaje conservado", token: secret }] },
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

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No se pudo reservar un puerto.");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function startMetro({ enabled, port, storePath }) {
  const script = enabled ? "web:mirror" : "web";
  const child = spawn(
    "npm",
    ["--workspace", "apps/mobile", "run", script, "--", "--port", `${port}`, "--localhost"],
    {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        CI: "1",
        GYMNASIA_DEV_STORE_TEST_MODE: "1",
        GYMNASIA_DEV_STORE_TEST_FILE: storePath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const append = (chunk) => {
    output = `${output}${chunk}`.slice(-20_000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  return { child, output: () => output };
}

async function stopMetro(child) {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") child.kill("SIGTERM");
  else process.kill(-child.pid, "SIGTERM");
  const timeout = setTimeout(() => {
    if (child.exitCode === null) {
      if (process.platform === "win32") child.kill("SIGKILL");
      else process.kill(-child.pid, "SIGKILL");
    }
  }, 5_000);
  await once(child, "exit").catch(() => {});
  clearTimeout(timeout);
}

async function waitForMetro(baseUrl, metro) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (metro.child.exitCode !== null) {
      throw new Error(`Metro terminó antes de arrancar:\n${metro.output().replaceAll(syntheticSecret, "[REDACTED]")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/dev-store`, {
        headers: { Origin: baseUrl, "Sec-Fetch-Site": "same-origin" },
      });
      if ([200, 404].includes(response.status)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Metro no respondió a tiempo:\n${metro.output().replaceAll(syntheticSecret, "[REDACTED]")}`);
}

async function runEnabledMirror(storePath) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const metro = startMetro({ enabled: true, port, storePath });
  try {
    await waitForMetro(baseUrl, metro);
    log("Metro arrancó con el espejo opt-in");

    const postResponse = await fetch(`${baseUrl}/dev-store`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify(fixtureStore()),
    });
    assert.equal(postResponse.status, 204);

    const fileContents = await readFile(storePath, "utf8");
    assert.equal(fileContents.includes(syntheticSecret), false, "el secreto sintético llegó al disco");
    assert.equal((await stat(storePath)).mode & 0o777, 0o600);
    const stored = JSON.parse(fileContents);
    assert.equal(stored.threads[0].title, "Estado restaurable");
    assert.equal(stored.keys.every((key) => key.api_key === "" && key.workspace_id === ""), true);

    const getResponse = await fetch(`${baseUrl}/dev-store`, {
      headers: { Origin: baseUrl, "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(getResponse.status, 200);
    assert.equal(getResponse.headers.get("access-control-allow-origin"), null);
    assert.equal((await getResponse.text()).includes(syntheticSecret), false);

    const mismatchedLoopbackOrigin = await fetch(`${baseUrl}/dev-store`, {
      headers: { Origin: `http://localhost:${port}`, "Sec-Fetch-Site": "same-site" },
    });
    assert.equal(mismatchedLoopbackOrigin.status, 403);
    assert.equal(mismatchedLoopbackOrigin.headers.get("access-control-allow-origin"), null);

    // Expo aplica además su propio CorsMiddleware antes del middleware de Metro.
    // Hoy responde 500 a orígenes externos; el contrato relevante es que nunca
    // autoriza, devuelve el store ni añade una cabecera CORS permisiva.
    const externalOrigin = await fetch(`${baseUrl}/dev-store`, {
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    const externalBody = await externalOrigin.text();
    assert.equal(externalOrigin.ok, false);
    assert.equal(externalOrigin.headers.get("access-control-allow-origin"), null);
    assert.equal(externalBody.includes(syntheticSecret), false);
    assert.equal(externalBody.includes("Estado restaurable"), false);

    const invalidJson = await fetch(`${baseUrl}/dev-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: "{",
    });
    assert.equal(invalidJson.status, 400);

    const invalidSchema = await fetch(`${baseUrl}/dev-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: "{}",
    });
    assert.equal(invalidSchema.status, 422);

    const oversized = await fetch(`${baseUrl}/dev-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ padding: "x".repeat(5 * 1024 * 1024) }),
    });
    assert.equal(oversized.status, 413);

    assert.equal(metro.output().includes(syntheticSecret), false, "Metro imprimió el secreto sintético");
  } finally {
    await stopMetro(metro.child);
  }
}

async function runDisabledMirror(storePath) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const metro = startMetro({ enabled: false, port, storePath });
  try {
    await waitForMetro(baseUrl, metro);
    const response = await fetch(`${baseUrl}/dev-store`, {
      headers: { Origin: baseUrl, "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(response.status, 404, "el endpoint existe sin activación explícita");
    assert.equal((await response.text()).includes(syntheticSecret), false);
    log("Metro rechazó el espejo sin el flag explícito");
  } finally {
    await stopMetro(metro.child);
  }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "gymnasia-dev-store-e2e-"));
const storePath = join(temporaryRoot, ".dev-store.json");
try {
  await runEnabledMirror(storePath);
  await runDisabledMirror(storePath);
  log("E2E completado sin credenciales en disco, respuestas ni logs");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
