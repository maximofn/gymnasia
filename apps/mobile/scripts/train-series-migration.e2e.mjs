/**
 * E2E de la migración de series avanzadas (GYM-173).
 *
 * Siembra un almacén con series avanzadas, incluida una con un tipo que no
 * existe, y comprueba tres cosas en la app real:
 *
 *   1. La app arranca. No aparece la pantalla de recuperación: un dato reparable
 *      nunca debe mandar el almacén del usuario a cuarentena.
 *   2. El tipo, los tempos y las mini-series siguen ahí tras recargar.
 *   3. La rutina queda sellada con su versión de esquema.
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

const DEFAULT_PORT = 8096;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const scopedKey = (key) => `${DEVELOPMENT_NAMESPACE}:${key}`;
const STORE_KEY = scopedKey("gymnasia.mobile.local.v3");
const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function logStep(message) {
  console.log(`[train-series-e2e] ${message}`);
}

/** Rutina con lo que el fallo histórico aplanaba, más un tipo inventado. */
function seededStore() {
  return {
    templates: [
      {
        id: "tpl_series",
        name: "Rutina con series avanzadas",
        category: "hypertrophy",
        exercises: [
          {
            id: "ex_1",
            name: "Press de banca",
            load_kg: 60,
            rest_seconds: 120,
            sets: [8, 6],
            series: [
              {
                id: "set_tempo",
                type: "tempo",
                reps: "8",
                weight_kg: "60",
                rest_seconds: "120",
                tempo_contraction: "3",
                tempo_pause: "1",
                tempo_relaxation: "2",
              },
              {
                id: "set_dropset",
                type: "dropset",
                reps: "6",
                weight_kg: "70",
                rest_seconds: "120",
                sub_series: [
                  { id: "sub_1", reps: "6", weight_kg: "55", rest_seconds: "0" },
                  { id: "sub_2", reps: "4", weight_kg: "40", rest_seconds: "0" },
                ],
              },
              {
                id: "set_basura",
                type: "no-existe-este-tipo",
                reps: "10",
                weight_kg: "30",
                rest_seconds: "60",
              },
            ],
          },
        ],
      },
    ],
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
  const configuredUrl = process.env.TRAIN_SERIES_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }

  const port =
    Number.parseInt(process.env.TRAIN_SERIES_E2E_PORT ?? `${DEFAULT_PORT}`, 10) || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;

  const distRoot = join(mobileRoot, "dist");
  if (process.env.TRAIN_SERIES_E2E_SKIP_EXPORT === "1" && existsSync(join(distRoot, "index.html"))) {
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
      if (output) console.error(`[train-series-e2e][expo] ${output}`);
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
  };
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    const filePath =
      candidate.startsWith(distRoot) && existsSync(candidate) ? candidate : join(distRoot, "index.html");
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

async function readStore(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
  assert.ok(raw, "el almacén desapareció del navegador");
  return JSON.parse(raw);
}

async function expectBodyContains(page, expected) {
  await page.waitForFunction(
    (needle) => Boolean(document.body?.innerText?.includes(needle)),
    expected,
    { timeout: STEP_TIMEOUT_MS },
  );
}

/** La barra de navegación cambia entre móvil y escritorio; sirven las dos. */
async function openTrainingTab(page) {
  const mobileNav = page.locator('[data-testid="nav-tab-training"]');
  const desktopNav = page.locator('[data-testid="desktop-nav-training"]');
  if (await mobileNav.count()) {
    await mobileNav.click({ timeout: STEP_TIMEOUT_MS });
  } else {
    await desktopNav.click({ timeout: STEP_TIMEOUT_MS });
  }
}

async function waitForAppReady(page) {
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-testid="nav-tab-training"], [data-testid="desktop-nav-training"]',
      ).length > 0,
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );
}

async function run() {
  const server = await ensureWebServer();
  const browser = await chromium.launch({ headless: process.env.TRAIN_SERIES_E2E_HEADLESS !== "0" });
  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ key, value }) => {
        localStorage.clear();
        localStorage.setItem(key, value);
      },
      { key: STORE_KEY, value: JSON.stringify(seededStore()) },
    );
    const page = await context.newPage();
    await page.goto(server.baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });

    // 1. La app arranca con normalidad. Un tipo de serie inventado es reparable,
    //    así que no puede acabar en la pantalla de recuperación.
    await waitForAppReady(page);
    assert.equal(
      await page.locator('[data-testid="local-store-recovery-screen"]').count(),
      0,
      "un dato reparable mandó el almacén a cuarentena",
    );
    logStep("La app arranca sin pantalla de recuperación");

    // La rutina sembrada se ve, no solo persiste.
    await openTrainingTab(page);
    await expectBodyContains(page, "Rutina con series avanzadas");
    logStep("La rutina migrada aparece en la lista");

    // 2. Lo persistido conserva las series avanzadas.
    await page.waitForFunction(
      (key) => {
        const raw = localStorage.getItem(key);
        return Boolean(raw && raw.includes("series_schema_version"));
      },
      STORE_KEY,
      { timeout: STEP_TIMEOUT_MS },
    );

    await page.reload({ waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
    await waitForAppReady(page);

    const store = await readStore(page);
    const template = store.templates.find((item) => item.id === "tpl_series");
    assert.ok(template, "la rutina sembrada desapareció");
    const series = template.exercises[0].series;

    const tempo = series.find((item) => item.id === "set_tempo");
    assert.equal(tempo.type, "tempo", "se perdió el tipo de la serie con tempo");
    assert.equal(tempo.tempo_contraction, "3", "se perdió el tempo de contracción");
    assert.equal(tempo.tempo_pause, "1", "se perdió el tempo de pausa");
    assert.equal(tempo.tempo_relaxation, "2", "se perdió el tempo de relajación");

    const dropset = series.find((item) => item.id === "set_dropset");
    assert.equal(dropset.type, "dropset", "se perdió el tipo drop-set");
    assert.equal(dropset.sub_series.length, 2, "se perdieron las mini-series");
    assert.equal(dropset.sub_series[1].weight_kg, "40", "se alteró una mini-serie");

    const repaired = series.find((item) => item.id === "set_basura");
    assert.ok(repaired, "la serie con tipo inventado desapareció");
    assert.ok(!repaired.type, "el tipo inventado sobrevivió sin repararse");
    assert.equal(repaired.reps, "10", "la reparación se llevó por delante las repeticiones");
    logStep("Tipo, tempos y mini-series sobreviven a la recarga");

    // 3. La rutina queda sellada.
    assert.equal(template.series_schema_version, 1, "la rutina no quedó sellada");
    logStep("La rutina queda sellada con series_schema_version 1");

    await context.close();
    console.log("[train-series-e2e] PASS");
  } finally {
    await browser.close();
    await server.stop();
  }
}

run().catch((error) => {
  console.error("[train-series-e2e] FAIL");
  console.error(error);
  process.exitCode = 1;
});
