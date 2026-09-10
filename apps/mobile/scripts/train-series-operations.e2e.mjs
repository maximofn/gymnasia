/**
 * E2E de copias, cambios y restauración de series avanzadas, incluida GYM-176
 * (ticket para evitar registrar entrenamientos parciales como completos).
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

const DEFAULT_PORT = 8097;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const STORE_KEY = `${DEVELOPMENT_NAMESPACE}:gymnasia.mobile.local.v3`;
const SESSION_KEY = `${DEVELOPMENT_NAMESPACE}:gymnasia.mobile.training.session.v1`;
const SESSION_DRAFT_KEY = `${DEVELOPMENT_NAMESPACE}:gymnasia.mobile.training.session_template_draft.v1`;
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

async function openHomeTab(page) {
  const mobileNav = page.getByTestId("nav-tab-home");
  const desktopNav = page.getByTestId("desktop-nav-home");
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

async function waitForSessionDraft(page, predicate, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STEP_TIMEOUT_MS) {
    const raw = await page.evaluate((key) => localStorage.getItem(key), SESSION_DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (predicate(draft)) return draft;
    }
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
  await clickTestId(page, "training-template-edit-tpl_ops");
  await page.getByTestId("training-editor-name").fill("Borrador que se descarta");
  assert.equal(
    findTemplate(await readStore(page), "tpl_ops").name,
    "Rutina de operaciones avanzadas",
    "escribir en el editor modificó la rutina canónica",
  );
  await clickTestId(page, "training-editor-cancel");
  await page.getByTestId("training-editor-discard-modal").waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-editor-keep-editing");
  await page.getByTestId("training-editor-name").waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-editor-cancel");
  await clickTestId(page, "training-editor-confirm-discard");
  assert.equal(findTemplate(await readStore(page), "tpl_ops").name, "Rutina de operaciones avanzadas");
  logStep("Cancelar y volver atrás preservan la rutina canónica");
  await clickTestId(page, "training-detail-back");

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
  await clickTestId(page, "training-editor-series-add-exercise_press");
  await clickTestId(page, "training-exercise-menu-exercise_press");
  await clickTestId(page, "training-exercise-clone-exercise_press");
  assert.equal(
    findTemplate(await readStore(page), "tpl_ops").exercises.length,
    2,
    "el borrador del editor modificó la rutina canónica antes de guardar",
  );
  await clickTestId(page, "training-editor-save");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises.length === 3
      && findTemplate(candidate, "tpl_ops").exercises[0].series.length === 3,
    "el borrador completo no se guardó",
  );
  let originalTemplate = findTemplate(store, "tpl_ops");
  const sourceSeries = originalTemplate.exercises[0].series[0];
  const seriesClone = originalTemplate.exercises[0].series[1];
  assert.notEqual(seriesClone.id, sourceSeries.id);
  assert.notEqual(seriesClone.sub_series[0].id, sourceSeries.sub_series[0].id);
  const addedSeries = originalTemplate.exercises[0].series[2];
  assert.equal(addedSeries.type, "superset");
  assert.equal(addedSeries.sub_series.length, 1);
  assert.notEqual(addedSeries.sub_series[0].id, seriesClone.sub_series[0].id);
  const exerciseClone = originalTemplate.exercises[1];
  assert.notEqual(exerciseClone.id, "exercise_press");
  assert.notEqual(exerciseClone.series[0].id, "set_superset");
  assert.notEqual(exerciseClone.series[0].sub_series[0].id, "sub_fly");
  assert.equal(exerciseClone.series[0].sub_series[0].exercise_id, "exercise_fly");
  logStep("Borrador guardado de una vez sin reutilizar identidades anidadas");

  await clickTestId(page, "training-detail-back");
  await clickTestId(page, "training-template-inline-start-tpl_ops");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });

  const templateBeforeSessionChange = structuredClone(findTemplate(await readStore(page), "tpl_ops"));
  await clickTestId(page, "training-session-series-type-exercise_press-set_superset");
  await clickTestId(page, "training-series-type-option-dropset");
  const sessionDraft = await waitForSessionDraft(
    page,
    (candidate) => candidate.draft.exercises[0].series[0].type === "dropset",
    "el cambio a tipo compuesto no llegó al borrador de sesión",
  );
  store = await readStore(page);
  assert.equal(
    findTemplate(store, "tpl_ops").exercises[0].series[0].type,
    "superset",
    "la sesión modificó la rutina canónica antes de la decisión final",
  );
  assert.deepEqual(
    sessionDraft.draft.exercises[0].series[0].sub_series,
    templateBeforeSessionChange.exercises[0].series[0].sub_series,
    "el cambio de tipo alteró las mini-series conservadas",
  );
  logStep("Tipo compuesto cambiado durante la sesión");

  await clickTestId(page, "training-session-complete-series-exercise_press:set_superset");
  await clickTestId(page, "training-session-finish");
  await page.getByTestId("training-partial-finish-modal").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.screenshot({
    path: process.env.TRAIN_PARTIAL_WARNING_SCREENSHOT ?? "/tmp/gym-176-partial-warning.png",
    fullPage: true,
  });
  assert.equal((await readStore(page)).workoutHistory.length, 0, "la advertencia guardó un parcial sin permiso");
  await clickTestId(page, "training-partial-continue");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert.equal((await readStore(page)).workoutHistory.length, 0, "seguir entrenando creó historial");
  await clickTestId(page, "training-session-finish");
  await clickTestId(page, "training-partial-save");
  await page.getByText("Cambios de rutina detectados", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert.equal(await page.getByTestId("training-complete-apply-changes").count(), 1);
  assert.equal(await page.getByTestId("training-complete-revert-changes").count(), 1);
  const screenshotPath = process.env.TRAIN_SERIES_OPERATIONS_E2E_SCREENSHOT?.trim();
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  await clickTestId(page, "training-complete-revert-changes");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series[0].type === "superset"
      && candidate.workoutHistory.length === 1
      && candidate.workoutHistory[0].completion_status === "partial",
    "la rutina canónica cambió al elegir mantenerla",
  );
  assert.deepEqual(findTemplate(store, "tpl_ops"), templateBeforeSessionChange);
  assert.equal(store.workoutHistory[0].completed_effort_count, 1);
  assert.equal(store.workoutHistory[0].summary_schema_version, 2);
  assert.equal(store.workoutHistory[0].can_recalculate, true);
  assert.equal(
    store.workoutHistory[0].prescription_snapshot.exercises[0].series[0].type,
    "dropset",
    "el historial no conservó el tipo ejecutado antes de restaurar la rutina canónica",
  );
  assert.equal(
    store.workoutHistory[0].prescription_snapshot.exercises[0].series[0].completed,
    true,
  );
  assert.equal(
    store.workoutHistory[0].prescription_snapshot.exercises[0].series[0].sub_series[0].completed,
    false,
  );
  await page.getByText("Sesión parcial guardada", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert.equal(await page.getByText("¡Sesión completada!", { exact: true }).count(), 0);
  logStep("Parcial confirmado, cambios detectados y rutina original restaurada");

  await clickTestId(page, "training-complete-close");
  await openHomeTab(page);
  assert.match(await page.getByTestId("home-workout-streak").innerText(), /Racha\s*0\s*días seguidos/);
  assert.equal(await page.getByTestId("home-week-completed-count").innerText(), "0/7");
  assert.equal(await page.getByText("Último entrenamiento completado", { exact: true }).count(), 0);
  await openTrainingTab(page);
  await clickTestId(page, "training-template-open-tpl_ops");
  const partialHistoryRow = page.getByTestId(`training-history-${store.workoutHistory[0].id}`);
  await page.getByTestId(`training-history-status-${store.workoutHistory[0].id}`)
    .getByText("Parcial", { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText("Todavía no hay sesiones completadas para mostrar estadísticas.", { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await partialHistoryRow.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT_MS });
  await page.screenshot({
    path: process.env.TRAIN_PARTIAL_HISTORY_SCREENSHOT ?? "/tmp/gym-176-partial-history.png",
    fullPage: false,
  });
  await clickTestId(page, "training-detail-back");
  logStep("El parcial aparece en historial y no altera Inicio ni las estadísticas");

  await clickTestId(page, "training-template-inline-start-tpl_ops");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-session-series-type-exercise_press-set_superset");
  await clickTestId(page, "training-series-type-option-dropset");
  await clickTestId(page, "training-session-finish");
  await clickTestId(page, "training-partial-save");
  await clickTestId(page, "training-complete-apply-changes");
  store = await waitForStore(
    page,
    (candidate) => findTemplate(candidate, "tpl_ops").exercises[0].series[0].type === "dropset"
      && candidate.workoutHistory.filter((summary) => summary.completion_status === "partial").length === 2,
    "la versión de la sesión no se aplicó tras confirmarla",
  );
  logStep("Cambios de sesión conservados solo tras confirmación explícita");

  await clickTestId(page, "training-complete-close");
  await clickTestId(page, "training-template-inline-start-tpl_ops");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-session-series-type-exercise_press-set_superset");
  await clickTestId(page, "training-series-type-option-superset");
  await clickTestId(page, "training-session-discard");
  await clickTestId(page, "training-session-discard");
  await page.getByTestId("training-complete-revert-changes").waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-complete-revert-changes");
  store = await readStore(page);
  assert.equal(
    findTemplate(store, "tpl_ops").exercises[0].series[0].type,
    "dropset",
    "descartar la sesión cambió la rutina sin permiso",
  );
  logStep("Descartar una sesión preserva la versión canónica elegida");

  await clickTestId(page, "training-template-inline-start-tpl_ops");
  await clickTestId(page, "training-session-series-type-exercise_press-set_superset");
  await clickTestId(page, "training-series-type-option-superset");
  await waitForSessionDraft(
    page,
    (candidate) => candidate.draft.exercises[0].series[0].type === "superset",
    "el borrador no se persistió antes de recargar",
  );
  await page.waitForFunction(
    (key) => localStorage.getItem(key) !== null,
    SESSION_KEY,
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await waitForAppReady(page);
  await openTrainingTab(page);
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  const recoveredDraft = await waitForSessionDraft(
    page,
    (candidate) => candidate.draft.exercises[0].series[0].type === "superset",
    "el borrador no sobrevivió al reinicio",
  );
  assert.equal(recoveredDraft.draft_revision > 0, true);
  await clickTestId(page, "training-session-finish");
  await clickTestId(page, "training-partial-save");
  await page.getByTestId("training-complete-revert-changes").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.waitForFunction(
    (key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw).pending_resolution?.kind === "partial" : false;
    },
    SESSION_KEY,
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.evaluate(({ storeKey, templateId }) => {
    const raw = localStorage.getItem(storeKey);
    if (!raw) throw new Error("No existe el almacén para simular el cambio concurrente");
    const current = JSON.parse(raw);
    current.templates = current.templates.map((template) =>
      template.id === templateId
        ? { ...template, name: "Rutina cambiada fuera de la sesión" }
        : template);
    localStorage.setItem(storeKey, JSON.stringify(current));
  }, { storeKey: STORE_KEY, templateId: "tpl_ops" });
  await page.reload({ waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await waitForAppReady(page);
  await page.getByTestId("training-complete-revert-changes").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText("La rutina también cambió fuera de la sesión", { exact: true })
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  await clickTestId(page, "training-complete-revert-changes");
  store = await readStore(page);
  assert.equal(findTemplate(store, "tpl_ops").exercises[0].series[0].type, "dropset");
  assert.equal(findTemplate(store, "tpl_ops").name, "Rutina cambiada fuera de la sesión");
  assert.equal(
    new Set(store.workoutHistory.map((summary) => summary.id)).size,
    store.workoutHistory.length,
    "un reintento de resolución duplicó el historial",
  );
  logStep("Borrador, decisión pendiente y cambio concurrente recuperados tras reiniciar");

  await clickTestId(page, "training-complete-close");
  await openTrainingTab(page);
  const templateCountBeforeCreation = (await readStore(page)).templates.length;
  await clickTestId(page, "training-create");
  assert.equal(
    (await readStore(page)).templates.length,
    templateCountBeforeCreation,
    "crear abrió y persistió una rutina vacía",
  );
  await clickTestId(page, "training-editor-save");
  assert.equal(
    (await readStore(page)).templates.length,
    templateCountBeforeCreation,
    "guardar aceptó una rutina sin series ejecutables",
  );
  await clickTestId(page, "training-editor-cancel");
  await clickTestId(page, "training-editor-confirm-discard");
  assert.equal(
    (await readStore(page)).templates.length,
    templateCountBeforeCreation,
    "cancelar creó una rutina fantasma",
  );

  await clickTestId(page, "training-create");
  await page.getByTestId("training-editor-name").fill("Rutina transaccional");
  await clickTestId(page, "training-editor-add-exercise-bottom");
  await clickTestId(page, "training-exercise-custom-open");
  await page.getByTestId("training-exercise-custom-name").fill("Ejercicio transaccional");
  await clickTestId(page, "training-exercise-custom-save");
  await clickTestId(page, "training-editor-save");
  store = await waitForStore(
    page,
    (candidate) => candidate.templates.some((template) =>
      template.name === "Rutina transaccional"
      && template.exercises.some((exercise) => exercise.name === "Ejercicio transaccional")),
    "la nueva rutina válida no se guardó",
  );
  assert.equal(store.templates.length, templateCountBeforeCreation + 1);
  logStep("Crear cancela sin residuos y guarda solo un borrador válido");
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
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
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
