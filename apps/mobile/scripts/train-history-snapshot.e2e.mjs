/**
 * E2E de GYM-179 (ticket para guardar la prescripción ejecutada en el historial):
 * navegación global, verificación, discrepancias, rutinas eliminadas y backup.
 */
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

const DEFAULT_PORT = 8102;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const STORE_KEY = `${DEVELOPMENT_NAMESPACE}:gymnasia.mobile.local.v3`;
const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function logStep(message) {
  console.log(`[train-history-e2e] ${message}`);
}

function prescriptionSnapshot() {
  return {
    schema_version: 1,
    execution_schema_version: 1,
    weight_unit: "kg",
    exercises: [{
      name: "Press histórico",
      series: [{
        type: "superset",
        reps: 10,
        weight_kg: 50,
        rest_seconds: 90,
        tempo_contraction: 2,
        tempo_pause: 0,
        tempo_relaxation: 3,
        completed: true,
        sub_series: [{
          exercise_name: "Aperturas históricas",
          reps: 12,
          weight_kg: 20,
          rest_seconds: 0,
          completed: true,
        }],
      }],
    }],
  };
}

function currentTemplate() {
  return {
    id: "tpl_history",
    series_schema_version: 1,
    name: "Rutina actual modificada",
    category: "strength",
    icon: "activity",
    duration_minutes: "40",
    exercises: [{
      id: "exercise_current",
      name: "Press actual modificado",
      sets: [99],
      series: [{
        id: "series_current",
        type: "normal",
        reps: "99",
        weight_kg: "99",
        rest_seconds: "30",
      }],
    }],
  };
}

function snapshotSummary(id, overrides = {}) {
  return {
    id,
    template_id: "tpl_history",
    template_name: "Rutina original",
    finished_at: "2026-09-09T10:00:00.000Z",
    elapsed_seconds: 1800,
    completion_status: "completed",
    summary_schema_version: 2,
    calculation_version: 2,
    can_recalculate: true,
    prescription_snapshot: prescriptionSnapshot(),
    completed_effort_count: 2,
    total_effort_count: 2,
    effort_breakdown: {
      completed_primary: 1,
      completed_sub_series: 1,
      total_primary: 1,
      total_sub_series: 1,
    },
    estimated_calories: 210,
    total_volume_kg: 740,
    total_reps: 22,
    ...overrides,
  };
}

function seededStore() {
  return {
    templates: [currentTemplate()],
    workoutHistory: [
      snapshotSummary("summary_match"),
      snapshotSummary("summary_mismatch", {
        finished_at: "2026-09-08T10:00:00.000Z",
        total_volume_kg: 888,
        total_reps: 999,
      }),
      snapshotSummary("summary_deleted", {
        template_id: "tpl_deleted",
        template_name: "Rutina ya eliminada",
        finished_at: "2026-09-07T10:00:00.000Z",
      }),
      {
        id: "summary_legacy",
        template_id: "tpl_legacy",
        template_name: "Rutina antigua",
        finished_at: "2026-09-06T10:00:00.000Z",
        elapsed_seconds: 900,
        completed_series_count: 1,
        total_series_count: 2,
        estimated_calories: 80,
        total_volume_kg: 320,
        total_reps: 16,
      },
    ],
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
  const configuredUrl = process.env.TRAIN_HISTORY_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }

  const port = Number.parseInt(process.env.TRAIN_HISTORY_E2E_PORT ?? `${DEFAULT_PORT}`, 10)
    || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  const distRoot = join(mobileRoot, "dist");
  if (
    process.env.TRAIN_HISTORY_E2E_SKIP_EXPORT === "1"
    && existsSync(join(distRoot, "index.html"))
  ) {
    logStep("Reutilizando dist/ existente");
  } else {
    logStep("Exportando el bundle web");
    const child = spawn("npm", ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        APP_ENV: "development",
        DEV_PROVIDER_MODE: "fake",
        CI: process.env.CI ?? "1",
      },
    });
    child.stdout.on("data", (chunk) => {
      const output = `${chunk}`.trim();
      if (output.includes("Bundled") || output.includes("Exported")) logStep(output);
    });
    child.stderr.on("data", (chunk) => {
      const output = `${chunk}`.trim();
      if (output) console.error(`[train-history-e2e][expo] ${output}`);
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
  return { baseUrl, stop: async () => new Promise((resolve) => server.close(() => resolve())) };
}

async function waitForAppReady(page) {
  await page.getByTestId("nav-tab-training").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
}

async function clickTestId(page, testId) {
  const locator = page.getByTestId(testId);
  await locator.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT_MS });
  await locator.click({ force: true, timeout: STEP_TIMEOUT_MS });
}

async function readStore(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
  assert.ok(raw, "el almacén principal no existe");
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

async function openTraining(page) {
  await clickTestId(page, "nav-tab-training");
}

async function openDataSettings(page) {
  await clickTestId(page, "nav-tab-settings");
  await clickTestId(page, "settings-tab-data");
}

async function chooseBackup(page, file) {
  const chooserPromise = page.waitForEvent("filechooser", { timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "backup-import-picker");
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
  await page.getByTestId("backup-import-confirm").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "backup-import-confirm");
}

async function run() {
  const server = await ensureWebServer();
  const browser = await chromium.launch({ headless: process.env.TRAIN_HISTORY_E2E_HEADLESS !== "0" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ storeKey, store }) => {
    localStorage.clear();
    localStorage.setItem(storeKey, store);
  }, { storeKey: STORE_KEY, store: JSON.stringify(seededStore()) });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(server.baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
    await waitForAppReady(page);
    await openTraining(page);
    await clickTestId(page, "training-open-global-history");
    await page.getByTestId("training-global-history").waitFor({ timeout: STEP_TIMEOUT_MS });
    assert.equal(await page.locator('[data-testid^="training-global-history-summary_"]').count(), 4);
    await page.screenshot({
      path: process.env.TRAIN_HISTORY_GLOBAL_SCREENSHOT ?? "/tmp/gym-179-history-global.png",
      fullPage: true,
    });
    logStep("Historial global ordenado y accesible sin depender de la rutina actual");

    await clickTestId(page, "training-global-history-summary_match");
    await page.getByText("Cálculo verificado", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.getByText("Press histórico", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
    assert.equal(await page.getByText("Press actual modificado", { exact: true }).count(), 0);
    await page.screenshot({
      path: process.env.TRAIN_HISTORY_E2E_SCREENSHOT ?? "/tmp/gym-179-history-detail.png",
      fullPage: true,
    });
    await clickTestId(page, "training-history-detail-back");

    await clickTestId(page, "training-global-history-summary_mismatch");
    await page.getByText("El cálculo actual no coincide", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
    assert.match(await page.getByTestId("training-history-stored-totals").innerText(), /999 reps.*888 kg/);
    assert.match(await page.getByTestId("training-history-recalculated-totals").innerText(), /22 reps.*740 kg/);
    await page.screenshot({
      path: process.env.TRAIN_HISTORY_MISMATCH_SCREENSHOT ?? "/tmp/gym-179-history-mismatch.png",
      fullPage: true,
    });
    await clickTestId(page, "training-history-detail-back");

    await clickTestId(page, "training-global-history-summary_deleted");
    await page.getByTestId("training-history-template-deleted").waitFor({ timeout: STEP_TIMEOUT_MS });
    await clickTestId(page, "training-history-detail-back");
    await clickTestId(page, "training-global-history-summary_legacy");
    await page.getByTestId("training-history-legacy-message").waitFor({ timeout: STEP_TIMEOUT_MS });
    await clickTestId(page, "training-history-detail-back");
    await clickTestId(page, "training-global-history-back");
    logStep("Verificación, discrepancia y sesiones antiguas explicadas sin alterar totales");

    await clickTestId(page, "training-template-menu-tpl_history");
    await clickTestId(page, "training-template-delete-tpl_history");
    await waitForStore(page, (store) => store.templates.length === 0, "la rutina actual no se eliminó");
    await clickTestId(page, "training-open-global-history");
    await clickTestId(page, "training-global-history-summary_match");
    await page.getByTestId("training-history-template-deleted").waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.getByText("Press histórico", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
    logStep("La prescripción sobrevive a la eliminación de la rutina");

    await openDataSettings(page);
    const downloadPromise = page.waitForEvent("download", { timeout: STEP_TIMEOUT_MS });
    await clickTestId(page, "backup-export");
    const download = await downloadPromise;
    const downloadPath = await download.path();
    assert.ok(downloadPath, "el navegador no conservó el paquete exportado");
    const backupBytes = readFileSync(downloadPath);

    await clickTestId(page, "data-deletion-open-activity");
    await clickTestId(page, "data-deletion-confirm");
    await waitForStore(
      page,
      (store) => store.workoutHistory.length === 0 && store.templates.length === 0,
      "el borrado de actividad no vació el historial",
    );
    await openDataSettings(page);
    await chooseBackup(page, {
      name: "historial.gymnasia",
      mimeType: "application/zip",
      buffer: backupBytes,
    });
    await page.getByTestId("backup-result").getByText(/restaurados correctamente/i)
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    let restoredStore = await waitForStore(
      page,
      (store) => store.workoutHistory.length === 4,
      "la restauración no recuperó todo el historial",
    );

    const invalidStore = structuredClone(restoredStore);
    invalidStore.workoutHistory[0].prescription_snapshot.schema_version = 99;
    const invalidBackup = {
      app: "gymnasia",
      type: "backup",
      schemaVersion: 1,
      appVersion: "1.0.0",
      createdAt: "2026-09-10T10:00:00.000Z",
      data: {
        store: invalidStore,
        userPrefs: {},
        personalFoods: [],
        personalData: [],
      },
    };
    await chooseBackup(page, {
      name: "historial-invalido.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalidBackup)),
    });
    await page.getByTestId("backup-result").getByText(/prescripción no compatible/i)
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    restoredStore = await readStore(page);
    assert.equal(restoredStore.workoutHistory[0].prescription_snapshot.schema_version, 1);
    assert.equal(restoredStore.workoutHistory.length, 4);

    await openTraining(page);
    await clickTestId(page, "training-open-global-history");
    await clickTestId(page, "training-global-history-summary_match");
    await page.getByText("Press histórico", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
    assert.deepEqual(pageErrors, [], `Errores en la página: ${pageErrors.join(" | ")}`);
    logStep("Exportación, borrado, restauración y rechazo transaccional verificados");
  } catch (error) {
    await page.screenshot({ path: "/tmp/gym-179-history-e2e-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await server.stop();
  }
}

await run();
