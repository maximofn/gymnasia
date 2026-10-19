import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repositoryRoot = join(mobileRoot, "..", "..");
const distRoot = join(mobileRoot, "dist");
const port = Number.parseInt(process.env.SHELL_E2E_PORT ?? "8135", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const stepTimeoutMs = 20000;
const storageKey = "gymnasia.development:gymnasia.mobile.local.v3";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webp": "image/webp",
};

const tabs = ["home", "training", "diet", "measures", "chat", "settings"];

function log(message) {
  console.log(`[shell-e2e] ${message}`);
}

function seedStore() {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    measurements: [],
    threads: [{ id: "thread_shell_e2e", title: "Shell E2E" }],
    messagesByThread: { thread_shell_e2e: [] },
    keys: [
      { provider: "openai", is_active: false, api_key: "", model: "gpt-5.6-luna" },
      { provider: "anthropic", is_active: false, api_key: "", model: "claude-sonnet-4-5" },
      { provider: "google", is_active: false, api_key: "", model: "gemini-2.5-flash" },
    ],
    chatProvider: "openai",
    foodAIProvider: "google",
  };
}

function exportDevelopmentBundle() {
  if (process.env.SHELL_E2E_SKIP_EXPORT === "1") {
    log("Reutilizando el bundle web existente");
    return;
  }
  log("Exportando el bundle web de desarrollo");
  execFileSync(
    "npm",
    [
      "--workspace",
      "apps/mobile",
      "exec",
      "--",
      "expo",
      "export",
      "--platform",
      "web",
      "--dev",
      "--clear",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        APP_ENV: "development",
        DEV_PROVIDER_MODE: "byok",
        CI: process.env.CI ?? "1",
      },
      stdio: "inherit",
    },
  );
}

function startServer() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    let path = candidate.startsWith(distRoot) ? candidate : join(distRoot, "index.html");
    try {
      if (statSync(path).isDirectory()) path = join(path, "index.html");
    } catch {
      path = join(distRoot, "index.html");
    }
    response.writeHead(200, {
      "content-type": mimeTypes[extname(path)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(readFileSync(path));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function waitUntilHidden(locator) {
  await locator.waitFor({ state: "hidden", timeout: stepTimeoutMs });
}

async function openTab(page, tab, layout) {
  await page.getByTestId(`${layout === "desktop" ? "desktop-nav" : "nav-tab"}-${tab}`).click({
    timeout: stepTimeoutMs,
  });
  const screenEvidence = {
    home: page.getByTestId("home-primary-training-action"),
    training: page.getByTestId("training-create-first"),
    diet: page.getByTestId("diet-meal-category-desayuno"),
    measures: page.getByTestId("measurement-add"),
    chat: page.getByText("API Key no configurada", { exact: true }),
    settings: page.getByTestId("settings-tab-provider"),
  }[tab];
  await screenEvidence.waitFor({ state: "visible", timeout: stepTimeoutMs });
}

async function exerciseLayers(page, layout) {
  log(`${layout}: recorriendo los seis destinos`);
  for (const tab of tabs) await openTab(page, tab, layout);

  log(`${layout}: abriendo y cerrando la explicación BYOK`);
  await openTab(page, "chat", layout);
  await page.getByText("¿Qué es BYOK?", { exact: true }).click({ timeout: stepTimeoutMs });
  const byokLayer = page.getByTestId("shell-layer-byok-explanation");
  await byokLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  await page.getByText("Ocultar", { exact: true }).click({ timeout: stepTimeoutMs });
  await waitUntilHidden(byokLayer);
  await page.getByText("API Key no configurada", { exact: true }).waitFor({ state: "visible" });

  log(`${layout}: comprobando desplegable de fecha de dieta`);
  await openTab(page, "diet", layout);
  await page.getByTestId("diet-date-picker-toggle").click({ timeout: stepTimeoutMs });
  const dietDateLayer = page.getByTestId("shell-layer-diet-date-picker");
  await dietDateLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  const dietDate = await dietDateLayer.inputValue();
  await page.getByTestId("diet-date-picker-toggle").click({ timeout: stepTimeoutMs });
  await waitUntilHidden(dietDateLayer);
  assert.match(dietDate, /^\d{4}-\d{2}-\d{2}$/);
  await page.getByTestId("diet-meal-category-desayuno").waitFor({ state: "visible" });

  log(`${layout}: conservando el filtro de medidas al cerrar una vista anidada`);
  await openTab(page, "measures", layout);
  await page.getByTestId("measures-chart-metric-current").click({ timeout: stepTimeoutMs });
  const metricLayer = page.getByTestId("shell-layer-measures-metric-dropdown");
  await metricLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  await page.getByTestId("measures-chart-metric-option-bodyFat").click({ timeout: stepTimeoutMs });
  await waitUntilHidden(metricLayer);
  await page.getByTestId("measurement-add").click({ timeout: stepTimeoutMs });
  const measurementLayer = page.getByTestId("shell-layer-measurement-entry");
  await measurementLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  await measurementLayer.getByText("Cancelar", { exact: true }).first().click({ timeout: stepTimeoutMs });
  await waitUntilHidden(measurementLayer);
  assert.match(
    await page.getByTestId("measures-chart-metric-current").innerText(),
    /% Grasa/,
  );

  log(`${layout}: cerrando menús de proveedor y borrado sin perder Ajustes`);
  await openTab(page, "settings", layout);
  await page.getByTestId("settings-tab-provider").click({ timeout: stepTimeoutMs });
  await page.getByTestId("chat-provider-dropdown-toggle").click({ timeout: stepTimeoutMs });
  const providerLayer = page.getByTestId("shell-layer-chat-provider-dropdown");
  await providerLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  await page.getByTestId("chat-provider-dropdown-toggle").click({ timeout: stepTimeoutMs });
  await waitUntilHidden(providerLayer);

  const dataTab = page.getByTestId("settings-tab-data");
  await dataTab.scrollIntoViewIfNeeded({ timeout: stepTimeoutMs });
  await dataTab.click({ timeout: stepTimeoutMs });
  const deletionAction = page.getByTestId("data-deletion-open-activity");
  await deletionAction.scrollIntoViewIfNeeded({ timeout: stepTimeoutMs });
  await deletionAction.click({ timeout: stepTimeoutMs });
  const deletionLayer = page.getByTestId("shell-layer-data-deletion");
  await deletionLayer.waitFor({ state: "visible", timeout: stepTimeoutMs });
  await page.getByLabel("Cancelar borrado de datos").click({ timeout: stepTimeoutMs });
  await waitUntilHidden(deletionLayer);
  await page.getByTestId("settings-tab-data").waitFor({ state: "visible" });
}

async function runViewport(browser, width) {
  const layout = width >= 960 ? "desktop" : "compact";
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await context.route("https://api.github.com/**", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: "{}",
  }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, value);
  }, { key: storageKey, value: JSON.stringify(seedStore()) });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: stepTimeoutMs });
  await page.getByTestId("home-primary-training-action").waitFor({ state: "visible", timeout: stepTimeoutMs });

  for (const tab of tabs) {
    const expected = `${layout === "desktop" ? "desktop-nav" : "nav-tab"}-${tab}`;
    const unexpected = `${layout === "desktop" ? "nav-tab" : "desktop-nav"}-${tab}`;
    assert.equal(await page.getByTestId(expected).count(), 1, `${width}px: falta ${expected}`);
    assert.equal(await page.getByTestId(unexpected).count(), 0, `${width}px: aparece ${unexpected}`);
  }

  await exerciseLayers(page, layout);
  assert.deepEqual(pageErrors, [], `${width}px: errores de página: ${pageErrors.join(" | ")}`);
  await context.close();
}

async function run() {
  exportDevelopmentBundle();
  assert.ok(existsSync(join(distRoot, "index.html")), "La exportación no creó dist/index.html.");
  const server = await startServer();
  const browser = await chromium.launch({ headless: process.env.SHELL_E2E_HEADLESS !== "0" });
  try {
    await runViewport(browser, 390);
    await runViewport(browser, 960);
    log("OK: destinos y capas conservan el estado en shell compacto y de escritorio");
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
