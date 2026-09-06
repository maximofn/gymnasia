/** E2E de copias, cambios y restauración de series avanzadas. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DEFAULT_PORT = 8097;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const STORE_KEY = `${DEVELOPMENT_NAMESPACE}:gymnasia.mobile.local.v3`;
const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function logStep(message) {
  console.log(`[train-series-operations-e2e] ${message}`);
}

function seededStore() {
  const linked = (itemId) => ({
    schemaVersion: 1,
    status: "linked",
    ref: { schemaVersion: 1, sourceId: "gymnasia_exercises", itemId },
    linkedBy: "selection",
  });
  return {
    templates: [{
      id: "tpl_ops",
      series_schema_version: 1,
      name: "Rutina de operaciones avanzadas",
      category: "hypertrophy",
      icon: "zap",
      duration_minutes: "40",
      exercises: [
        {
          id: "exercise_press",
          name: "Press de banca",
          sets: [8],
          load_kg: 60,
          rest_seconds: 90,
          catalog_link: linked("press"),
          series: [{
            id: "set_superset",
            type: "superset",
            reps: "8",
            weight_kg: "60",
            rest_seconds: "90",
            sub_series: [{
              id: "sub_fly",
              reps: "12",
              weight_kg: "16",
              rest_seconds: "30",
              exercise_name: "Aperturas",
              exercise_id: "exercise_fly",
              catalog_link: linked("fly"),
            }],
          }],
        },
        {
          id: "exercise_fly",
          name: "Aperturas",
          sets: [12],
          load_kg: 16,
          rest_seconds: 60,
          catalog_link: linked("fly"),
          series: [{
            id: "set_fly",
            type: "normal",
            reps: "12",
            weight_kg: "16",
            rest_seconds: "60",
          }],
        },
      ],
    }],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [],
    messagesByThread: {},
    keys: [],
  };
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
  const configuredUrl = process.env.TRAIN_SERIES_OPERATIONS_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }

  const port = Number.parseInt(
    process.env.TRAIN_SERIES_OPERATIONS_E2E_PORT ?? `${DEFAULT_PORT}`,
    10,
  ) || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  const distRoot = join(mobileRoot, "dist");

  if (
    process.env.TRAIN_SERIES_OPERATIONS_E2E_SKIP_EXPORT === "1"
    && existsSync(join(distRoot, "index.html"))
  ) {
    logStep("Reutilizando dist/ existente");
  } else {
    logStep("Exportando el bundle web");
    const child = spawn(
      "npm",
      ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          APP_ENV: "development",
          DEV_PROVIDER_MODE: "fake",
          CI: process.env.CI ?? "1",
        },
      },
    );
    child.stdout.on("data", (chunk) => {
      const output = `${chunk}`.trim();
      if (output.includes("Bundled") || output.includes("Exported")) logStep(output);
    });
    child.stderr.on("data", (chunk) => {
      const output = `${chunk}`.trim();
      if (output) console.error(`[train-series-operations-e2e][expo] ${output}`);
    });
    const [exitCode] = await once(child, "exit");
    if (exitCode !== 0) throw new Error(`expo export terminó con código ${exitCode}.`);
  }

  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    const filePath = candidate.startsWith(distRoot) && existsSync(candidate)
      ? candidate
      : join(distRoot, "index.html");
    const extension = filePath.slice(filePath.lastIndexOf("."));
    response.writeHead(200, {
      "content-type": mimeTypes[extension] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(readFileSync(filePath));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    baseUrl,
    stop: async () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function waitForAppReady(page) {
  await page.waitForFunction(
    () => document.querySelectorAll(
      '[data-testid="nav-tab-training"], [data-testid="desktop-nav-training"]',
    ).length > 0,
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );
}

async function openTrainingTab(page) {
  const mobileNav = page.getByTestId("nav-tab-training");
  const desktopNav = page.getByTestId("desktop-nav-training");
  if (await mobileNav.count()) await mobileNav.click({ timeout: STEP_TIMEOUT_MS });
  else await desktopNav.click({ timeout: STEP_TIMEOUT_MS });
}

async function clickTestId(page, testId) {
  const locator = page.getByTestId(testId);
  await locator.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT_MS });
  await locator.click({ timeout: STEP_TIMEOUT_MS });
}

async function readStore(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
  assert.ok(raw, "el almacén desapareció del navegador");
  return JSON.parse(raw);
}

async function waitForStore(page, predicate, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STEP_TIMEOUT_MS) {
    const store = await readStore(page);
    if (predicate(store)) return store;
    await sleep(100);
  }
  throw new Error(message);
}

function findTemplate(store, id) {
  const template = store.templates.find((item) => item.id === id);
  assert.ok(template, `no existe la rutina ${id}`);
  return template;
}

async function run(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await waitForAppReady(page);
  await openTrainingTab(page);
  logStep("Rutina avanzada cargada");

  await clickTestId(page, "training-template-menu-tpl_ops");
  await clickTestId(page, "training-template-clone-tpl_ops");
  let store = await waitForStore(
    page,
    (candidate) => candidate.templates.length === 2,
    "la rutina no se duplicó",
  );
  const routineClone = store.templates.find((item) => item.id !== "tpl_ops");
  assert.ok(routineClone, "no se encontró la copia de la rutina");
  assert.notEqual(routineClone.exercises[0].id, "exercise_press");
  assert.notEqual(routineClone.exercises[0].series[0].id, "set_superset");
  assert.notEqual(routineClone.exercises[0].series[0].sub_series[0].id, "sub_fly");
  assert.equal(
    routineClone.exercises[0].series[0].sub_series[0].exercise_id,
    routineClone.exercises[1].id,
    "la superserie clonada apunta al ejercicio de la rutina original",
  );
  logStep("Rutina duplicada con referencias internas nuevas");

  await clickTestId(page, "training-template-menu-tpl_ops");
  await clickTestId(page, "training-template-edit-tpl_ops");
  await clickTestId(page, "training-editor-series-menu-exercise_press-set_superset");
  await clickTestId(page, "training-editor-series-duplicate-exercise_press-set_superset");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series.length === 2,
    "la serie no se duplicó",
  );
  let originalTemplate = findTemplate(store, "tpl_ops");
  const sourceSeries = originalTemplate.exercises[0].series[0];
  const seriesClone = originalTemplate.exercises[0].series[1];
  assert.notEqual(seriesClone.id, sourceSeries.id);
  assert.notEqual(seriesClone.sub_series[0].id, sourceSeries.sub_series[0].id);
  assert.deepEqual(
    { ...seriesClone, id: sourceSeries.id, sub_series: seriesClone.sub_series.map((item, index) => ({ ...item, id: sourceSeries.sub_series[index].id })) },
    sourceSeries,
  );
  logStep("Serie compuesta duplicada con mini-series nuevas");

  await clickTestId(page, "training-editor-series-add-exercise_press");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series.length === 3,
    "la nueva serie compuesta no se añadió",
  );
  originalTemplate = findTemplate(store, "tpl_ops");
  const addedSeries = originalTemplate.exercises[0].series[2];
  assert.equal(addedSeries.type, "superset");
  assert.equal(addedSeries.sub_series.length, 1);
  assert.notEqual(addedSeries.sub_series[0].id, seriesClone.sub_series[0].id);
  logStep("Nueva serie compuesta creada con su configuración completa");

  await clickTestId(page, "training-exercise-menu-exercise_press");
  await clickTestId(page, "training-exercise-clone-exercise_press");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises.length === 3,
    "el ejercicio no se duplicó",
  );
  originalTemplate = findTemplate(store, "tpl_ops");
  const exerciseClone = originalTemplate.exercises[1];
  assert.notEqual(exerciseClone.id, "exercise_press");
  assert.notEqual(exerciseClone.series[0].id, "set_superset");
  assert.notEqual(exerciseClone.series[0].sub_series[0].id, "sub_fly");
  assert.equal(exerciseClone.series[0].sub_series[0].exercise_id, "exercise_fly");
  logStep("Ejercicio duplicado sin reutilizar identidades anidadas");

  await clickTestId(page, "training-editor-save");
  await clickTestId(page, "training-detail-back");
  await clickTestId(page, "training-template-inline-start-tpl_ops");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });

  const templateBeforeSessionChange = structuredClone(findTemplate(await readStore(page), "tpl_ops"));
  await clickTestId(page, "training-session-series-type-exercise_press-set_superset");
  await clickTestId(page, "training-series-type-option-dropset");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series[0].type === "dropset",
    "el cambio a tipo compuesto durante la sesión no se guardó",
  );
  assert.deepEqual(
    findTemplate(store, "tpl_ops").exercises[0].series[0].sub_series,
    templateBeforeSessionChange.exercises[0].series[0].sub_series,
    "el cambio de tipo alteró las mini-series conservadas",
  );
  logStep("Tipo compuesto cambiado durante la sesión");

  await clickTestId(page, "training-session-finish");
  await page.getByText("Cambios detectados", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText(
    "Has modificado la configuración de algunas series. ¿Aplicar esos cambios a la rutina futura?",
    { exact: true },
  ).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert.equal(await page.getByTestId("training-complete-apply-changes").count(), 1);
  assert.equal(await page.getByTestId("training-complete-revert-changes").count(), 1);
  const screenshotPath = process.env.TRAIN_SERIES_OPERATIONS_E2E_SCREENSHOT?.trim();
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  await clickTestId(page, "training-complete-revert-changes");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series[0].type === "superset",
    "la instantánea previa a la sesión no se restauró",
  );
  assert.deepEqual(findTemplate(store, "tpl_ops"), templateBeforeSessionChange);
  logStep("Cambios detectados y rutina original restaurada");
}

async function main() {
  const server = await ensureWebServer();
  const browser = await chromium.launch({
    headless: process.env.TRAIN_SERIES_OPERATIONS_E2E_HEADLESS !== "0",
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(
      ({ key, value }) => {
        localStorage.clear();
        localStorage.setItem(key, value);
      },
      { key: STORE_KEY, value: JSON.stringify(seededStore()) },
    );
    const page = await context.newPage();
    await run(page, server.baseUrl);
    await context.close();
    console.log("[train-series-operations-e2e] PASS");
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((error) => {
  console.error("[train-series-operations-e2e] FAIL");
  console.error(error);
  process.exitCode = 1;
});
