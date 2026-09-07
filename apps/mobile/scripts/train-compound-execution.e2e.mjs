/**
 * E2E de GYM-175 (ticket para contabilizar subseries y trabajo compuesto):
 * ejecución, migración y estadísticas de series compuestas.
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

const DEFAULT_PORT = 8098;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const scopedKey = (key) => `${DEVELOPMENT_NAMESPACE}:${key}`;
const STORE_KEY = scopedKey("gymnasia.mobile.local.v3");
const SESSION_KEY = scopedKey("gymnasia.mobile.training.session.v1");
const SESSION_SNAPSHOT_KEY = scopedKey("gymnasia.mobile.training.session_template_snapshot.v1");
const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function logStep(message) {
  console.log(`[train-compound-e2e] ${message}`);
}

function compoundTemplate() {
  const series = [
    ["set_drop", "dropset", "10", "100", "sub_drop", "5", "80", "0"],
    ["set_rest", "restpause", "8", "60", "sub_rest", "4", "60", "120"],
    ["set_myo", "myoreps", "12", "40", "sub_myo", "5", "40", "0"],
    ["set_cluster", "cluster", "6", "90", "sub_cluster", "3", "90", "0"],
    ["set_super", "superset", "10", "50", "sub_super", "12", "20", "0"],
  ].map(([seriesId, type, reps, weight, subId, subReps, subWeight, subRest]) => ({
    id: seriesId,
    type,
    reps,
    weight_kg: weight,
    rest_seconds: "0",
    sub_series: [{
      id: subId,
      reps: subReps,
      weight_kg: subWeight,
      rest_seconds: subRest,
      ...(type === "superset" ? { exercise_name: "Remo con mancuerna" } : {}),
    }],
  }));
  return {
    id: "tpl_compound",
    series_schema_version: 1,
    name: "Rutina compuesta verificable",
    category: "hypertrophy",
    icon: "zap",
    duration_minutes: "35",
    exercises: [{
      id: "exercise",
      name: "Press de banca",
      sets: series.map((item) => Number(item.reps)),
      load_kg: 100,
      rest_seconds: 0,
      series,
    }],
  };
}

function seededStore() {
  return {
    templates: [compoundTemplate()],
    workoutHistory: [{
      id: "legacy_summary",
      template_id: "tpl_compound",
      template_name: "Rutina compuesta verificable",
      finished_at: "2026-08-01T12:00:00.000Z",
      elapsed_seconds: 600,
      completed_series_count: 1,
      total_series_count: 5,
      estimated_calories: 92,
      total_volume_kg: 800,
      total_reps: 8,
    }],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [],
    messagesByThread: {},
    keys: [],
  };
}

function legacySession(overrides = {}) {
  const session = {
    id: "legacy_session",
    template_id: "tpl_compound",
    template_name: "Rutina compuesta verificable",
    category: "hypertrophy",
    started_at: "2026-09-07T08:00:00.000Z",
    current_exercise_index: 0,
    current_series_index: 1,
    completed_series_keys: ["exercise:set_drop"],
    completed_series_count: 99,
    total_series_count: 5,
    elapsed_seconds: 73,
    is_resting: true,
    rest_seconds_left: 45,
    rest_seconds_total: 120,
    status: "paused",
    ...overrides,
  };
  if (overrides.pending_resolution === null) delete session.pending_resolution;
  return session;
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
  const configuredUrl = process.env.TRAIN_COMPOUND_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }

  const port = Number.parseInt(process.env.TRAIN_COMPOUND_E2E_PORT ?? `${DEFAULT_PORT}`, 10)
    || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
  const distRoot = join(mobileRoot, "dist");
  if (
    process.env.TRAIN_COMPOUND_E2E_SKIP_EXPORT === "1"
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
      if (output) console.error(`[train-compound-e2e][expo] ${output}`);
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
  await locator.click({ force: true, timeout: STEP_TIMEOUT_MS });
}

async function readJsonStorage(page, key) {
  const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  assert.ok(raw, `no existe ${key}`);
  return JSON.parse(raw);
}

async function waitForStorage(page, key, predicate, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STEP_TIMEOUT_MS) {
    const raw = await page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
    if (raw) {
      const value = JSON.parse(raw);
      if (predicate(value)) return value;
    }
    await sleep(100);
  }
  throw new Error(message);
}

async function addSeed(context, session = null) {
  await context.addInitScript(
    ({ storeKey, sessionKey, snapshotKey, store, session, snapshot }) => {
      if (localStorage.getItem("gymnasia.compound-e2e.seeded") === "1") return;
      localStorage.clear();
      localStorage.setItem("gymnasia.compound-e2e.seeded", "1");
      localStorage.setItem(storeKey, store);
      if (session) localStorage.setItem(sessionKey, session);
      if (snapshot) localStorage.setItem(snapshotKey, snapshot);
    },
    {
      storeKey: STORE_KEY,
      sessionKey: SESSION_KEY,
      snapshotKey: SESSION_SNAPSHOT_KEY,
      store: JSON.stringify(seededStore()),
      session: session ? JSON.stringify(session) : null,
      snapshot: session ? JSON.stringify(compoundTemplate()) : null,
    },
  );
}

async function verifyLegacyMigration(browser, baseUrl) {
  const fixtures = [
    {
      name: "activa",
      session: legacySession({
        status: "running",
        is_resting: false,
        rest_seconds_left: 0,
        rest_seconds_total: 0,
        pending_resolution: null,
      }),
    },
    {
      name: "pausada",
      session: legacySession({
        status: "paused",
        is_resting: false,
        rest_seconds_left: 0,
        rest_seconds_total: 0,
        pending_resolution: null,
      }),
    },
    {
      name: "descansando",
      session: legacySession({
        status: "running",
        pending_resolution: null,
      }),
    },
    {
      name: "con resolución pendiente",
      session: legacySession({
        pending_resolution: {
          kind: "discard",
          requested_at: "2026-09-07T08:01:13.000Z",
        },
      }),
    },
  ];

  for (const fixture of fixtures) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await addSeed(context, fixture.session);
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
    await waitForAppReady(page);
    const migrated = await waitForStorage(
      page,
      SESSION_KEY,
      (candidate) => candidate.execution_schema_version === 1,
      `la sesión heredada ${fixture.name} no se migró`,
    );
    assert.deepEqual(migrated.completed_unit_keys, [
      "exercise:set_drop",
      "exercise:set_drop:sub_drop",
    ]);
    assert.equal(migrated.completed_effort_count, 2, "se confió en el contador heredado");
    assert.equal(migrated.total_effort_count, 10);
    assert.equal(migrated.current_unit_key, "exercise:set_rest");
    assert.equal(migrated.status, fixture.session.status);
    assert.equal(migrated.elapsed_seconds, 73);
    assert.equal(migrated.is_resting, fixture.session.is_resting);
    assert.equal(migrated.rest_seconds_left, fixture.session.rest_seconds_left);
    assert.equal(migrated.rest_seconds_total, fixture.session.rest_seconds_total);
    assert.equal(
      migrated.pending_resolution?.kind,
      fixture.session.pending_resolution?.kind,
    );

    await page.reload({ waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
    await waitForAppReady(page);
    const reloaded = await waitForStorage(
      page,
      SESSION_KEY,
      (candidate) => candidate.execution_schema_version === 1,
      `la sesión migrada ${fixture.name} no se recargó`,
    );
    assert.deepEqual(reloaded.completed_unit_keys, migrated.completed_unit_keys);
    assert.equal(reloaded.current_unit_key, migrated.current_unit_key);

    if (fixture.name === "activa") {
      await openTrainingTab(page);
      await clickTestId(page, "training-session-complete-series-exercise:set_rest");
      const continued = await waitForStorage(
        page,
        SESSION_KEY,
        (candidate) => candidate.completed_effort_count === 3 && candidate.is_resting,
        "la sesión migrada no continuó por la mini-serie pendiente",
      );
      assert.equal(continued.current_unit_key, "exercise:set_rest:sub_rest");
      assert.equal(continued.rest_seconds_total, 120);
    }
    await context.close();
  }
  logStep("Fixtures heredados activos, pausados, descansando y pendientes migrados de forma idempotente");
}

async function verifyCompoundExecution(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await addSeed(context);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await waitForAppReady(page);
  await openTrainingTab(page);
  await clickTestId(page, "training-template-inline-start-tpl_compound");
  await page.getByText("Sesión activa", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText("0/10 esfuerzos", { exact: true }).first().waitFor({ timeout: STEP_TIMEOUT_MS });
  assert.equal(
    await page.locator('[data-testid^="training-session-sub-series-"]').count(),
    5,
    "no se muestran los cinco tipos compuestos",
  );

  await clickTestId(page, "training-session-complete-series-exercise:set_drop");
  await clickTestId(page, "training-session-complete-sub-series-exercise:set_drop:sub_drop");
  await clickTestId(page, "training-session-complete-series-exercise:set_rest");
  await page.getByText(/Pausa antes de Press de banca/).waitFor({ timeout: STEP_TIMEOUT_MS });
  let session = await waitForStorage(
    page,
    SESSION_KEY,
    (candidate) => candidate.completed_effort_count === 3 && candidate.is_resting,
    "el descanso previo de rest-pause no se persistió",
  );
  assert.equal(session.current_unit_key, "exercise:set_rest:sub_rest");
  assert.equal(session.rest_seconds_total, 120);

  await page.reload({ waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await waitForAppReady(page);
  await openTrainingTab(page);
  await page.getByText("3/10 esfuerzos", { exact: true }).first().waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.screenshot({
    path: process.env.TRAIN_COMPOUND_SESSION_SCREENSHOT ?? "/tmp/gym-175-compound-session.png",
    fullPage: true,
  });
  await clickTestId(page, "training-session-skip-rest");
  await clickTestId(page, "training-session-complete-sub-series-exercise:set_rest:sub_rest");

  for (const [seriesId, subId] of [
    ["set_myo", "sub_myo"],
    ["set_cluster", "sub_cluster"],
    ["set_super", "sub_super"],
  ]) {
    await clickTestId(page, `training-session-complete-series-exercise:${seriesId}`);
    await clickTestId(page, `training-session-complete-sub-series-exercise:${seriesId}:${subId}`);
  }

  await page.getByTestId("training-complete-effort-breakdown").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText("5 principales · 5 mini-series", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  const store = await waitForStorage(
    page,
    STORE_KEY,
    (candidate) => candidate.workoutHistory?.some((summary) => summary.calculation_version === 2),
    "el resumen compuesto no se guardó",
  );
  const summary = store.workoutHistory.find((item) => item.calculation_version === 2);
  assert.equal(summary.completed_effort_count, 10);
  assert.equal(summary.total_effort_count, 10);
  assert.equal(summary.total_reps, 75);
  assert.equal(summary.total_volume_kg, 4350);
  assert.deepEqual(summary.effort_breakdown, {
    completed_primary: 5,
    completed_sub_series: 5,
    total_primary: 5,
    total_sub_series: 5,
  });
  assert.equal(summary.can_recalculate, false);
  const legacy = store.workoutHistory.find((item) => item.id === "legacy_summary");
  assert.equal(legacy.calculation_version, 1);
  assert.equal(legacy.total_volume_kg, 800);
  assert.equal(legacy.total_reps, 8);
  assert.equal(legacy.effort_breakdown, null);

  await clickTestId(page, "training-complete-close");
  await clickTestId(page, "training-template-open-tpl_compound");
  await page.getByTestId("training-stats-effort-breakdown").waitFor({ timeout: STEP_TIMEOUT_MS });
  const legacyWarning = page.getByTestId("training-stats-legacy-warning");
  await legacyWarning.waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByText("Desglose disponible para 1 de 2 entrenamientos.", { exact: true }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await legacyWarning.scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT_MS });
  await page.screenshot({
    path: process.env.TRAIN_COMPOUND_E2E_SCREENSHOT ?? "/tmp/gym-175-compound-stats.png",
    fullPage: true,
  });
  session = await readJsonStorage(page, STORE_KEY);
  assert.equal(session.workoutHistory.length, 2);
  logStep("Cinco tipos ejecutados, recargados y resumidos con historial legado visible");
  await context.close();
}

async function main() {
  const server = await ensureWebServer();
  const browser = await chromium.launch({
    headless: process.env.TRAIN_COMPOUND_E2E_HEADLESS !== "0",
  });
  try {
    await verifyLegacyMigration(browser, server.baseUrl);
    await verifyCompoundExecution(browser, server.baseUrl);
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
