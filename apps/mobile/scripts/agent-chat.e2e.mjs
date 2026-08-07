import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DEFAULT_PORT = 8091;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const STORE_KEY = "gymnasia.mobile.local.v3";
const PERSONAL_DATA_KEY = "gymnasia.mobile.personal_data.v1";

function logStep(message) {
  console.log(`[agent-e2e] ${message}`);
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function waitForUrl(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_BOOT_TIMEOUT_MS) {
    if (await isReachable(url)) return;
    await sleep(500);
  }
  throw new Error(`Expo web no respondió en ${url}.`);
}

async function ensureWebServer() {
  const configuredUrl = process.env.AGENT_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }
  const port = Number.parseInt(process.env.AGENT_E2E_PORT ?? `${DEFAULT_PORT}`, 10) || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  logStep("Exportando el bundle web");
  const child = spawn(
    "npm",
    ["--workspace", "apps/mobile", "run", "build:web"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: process.env.CI ?? "1" },
    },
  );
  child.stdout.on("data", (chunk) => {
    const output = `${chunk}`.trim();
    if (output.includes("Bundled") || output.includes("Exported")) {
      logStep(output);
    }
  });
  child.stderr.on("data", (chunk) => {
    const output = `${chunk}`.trim();
    if (output) console.error(`[agent-e2e][expo] ${output}`);
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) throw new Error(`expo export terminó con código ${exitCode}.`);

  const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const distRoot = join(mobileRoot, "dist");
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
    ".png": "image/png",
  };
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    const filePath = candidate.startsWith(distRoot) && existsSync(candidate)
      ? candidate
      : join(distRoot, "index.html");
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(readFileSync(filePath));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  logStep(`Sirviendo el bundle exportado en ${baseUrl}`);
  return {
    baseUrl,
    stop: async () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function createSeedStore() {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {
      goal: "maintain",
      daily_calories: "2200",
      macro_mode: "manual_calories",
      manual_macro_calories: { carbs: "1100", protein: "550", fat: "550" },
      protein_grams_per_kg: "2",
      carbs_grams_per_kg: "3",
      fat_grams_per_kg: "1",
    },
    measurements: [],
    threads: [{ id: "thread_e2e", title: "E2E" }],
    messagesByThread: { thread_e2e: [] },
    keys: [
      {
        provider: "openai",
        is_active: true,
        api_key: "e2e-local-fake-key",
        model: "gpt-5-mini",
        reasoning_effort: "low",
      },
      { provider: "anthropic", is_active: false, api_key: "", model: "claude-3-5-sonnet-latest" },
      { provider: "google", is_active: false, api_key: "", model: "gemini-3-flash-preview" },
    ],
    chatProvider: "openai",
    foodAIProvider: "google",
  };
}

function fixture(name) {
  return readFileSync(
    new URL(`../agent/__fixtures__/raw/${name}`, import.meta.url),
    "utf8",
  );
}

async function runAgentChatE2E(page, baseUrl) {
  const requestBodies = [];
  await page.addInitScript(({ storeKey, personalDataKey, store }) => {
    window.localStorage.clear();
    window.localStorage.setItem(storeKey, JSON.stringify(store));
    window.localStorage.setItem(personalDataKey, JSON.stringify([
      { key: "Objetivo", description: "Objetivo principal", value: "Ganar masa muscular" },
    ]));
  }, {
    storeKey: STORE_KEY,
    personalDataKey: PERSONAL_DATA_KEY,
    store: createSeedStore(),
  });

  await page.route("**/dev-store", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("https://raw.githubusercontent.com/**", async (route) => {
    const isPrompt = route.request().url().includes("/prompts/AGENTS.md");
    await route.fulfill({
      status: 200,
      contentType: isPrompt ? "text/plain; charset=utf-8" : "application/json",
      body: isPrompt ? "Eres Gymnasia Coach. Responde en español." : "[]",
    });
  });
  await page.route("**/v1/responses*", async (route) => {
    const body = route.request().postDataJSON();
    requestBodies.push(body);
    logStep(`Proveedor falso: ronda ${requestBodies.length}`);
    const responseFixture = requestBodies.length === 1
      ? fixture("openai-tool-call.sse")
      : fixture("openai-final.sse");
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
      body: responseFixture,
    });
  });

  logStep("Abriendo la app y el chat");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="nav-tab-chat"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="chat-input"]').fill("¿Cuál es mi objetivo?");

  logStep("Enviando mensaje y esperando tool call + segunda ronda");
  await page.locator('[data-testid="chat-send"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid^="chat-message-assistant-"]')
    .filter({ hasText: "Tu objetivo es ganar masa muscular." })
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });

  assert.equal(requestBodies.length, 2, "El chat debe realizar exactamente dos rondas con el proveedor falso.");
  assert.equal(requestBodies[0].stream, true);
  assert(Array.isArray(requestBodies[0].tools) && requestBodies[0].tools.length > 0);
  assert.equal(requestBodies[1].previous_response_id, "resp_openai_tool");
  assert.deepEqual(requestBodies[1].input, [{
    type: "function_call_output",
    call_id: "call_openai_1",
    output: "Ganar masa muscular",
  }]);
  assert.equal(await page.locator('[data-testid^="chat-message-user-"]').last().innerText(),
    "user\n¿Cuál es mi objetivo?");
  logStep("E2E completado: UI → SSE → tool → segunda ronda → UI");
}

async function main() {
  const server = await ensureWebServer();
  let browser = null;
  let context = null;
  let page = null;
  try {
    browser = await chromium.launch({ headless: process.env.AGENT_E2E_HEADLESS !== "0" });
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await context.newPage();
    page.on("pageerror", (error) => console.error(`[agent-e2e][page] ${error.message}`));
    page.on("request", (request) => {
      if (/openai|anthropic|generativelanguage/i.test(request.url())) {
        logStep(`Petición externa observada: ${request.method()} ${request.url()}`);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") console.error(`[agent-e2e][console] ${message.text()}`);
    });
    await runAgentChatE2E(page, server.baseUrl);
  } catch (error) {
    if (page) {
      const screenshotPath = "/tmp/agent-chat-e2e-failure.png";
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      console.error(`[agent-e2e] Captura del fallo: ${screenshotPath}`);
    }
    throw error;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await server.stop();
  }
}

main().catch((error) => {
  console.error("[agent-e2e] FAILED");
  console.error(error);
  process.exitCode = 1;
});
