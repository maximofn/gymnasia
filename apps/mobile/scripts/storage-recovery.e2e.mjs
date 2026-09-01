import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DEFAULT_PORT = 8094;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 30000;
const DEVELOPMENT_NAMESPACE = "gymnasia.development";
const scopedKey = (key) => `${DEVELOPMENT_NAMESPACE}:${key}`;
const STORE_KEY = scopedKey("gymnasia.mobile.local.v3");
const SNAPSHOT_KEY = scopedKey("gymnasia.mobile.local.last_good.v1");
const QUARANTINE_KEY = scopedKey("gymnasia.mobile.local.quarantine.v1");
const SESSION_KEY = scopedKey("gymnasia.mobile.training.session.v1");
const SESSION_SNAPSHOT_KEY = scopedKey("gymnasia.mobile.training.session_template_snapshot.v1");
const PERSONAL_DATA_KEY = scopedKey("gymnasia.mobile.personal_data.v1");
const USER_PREFS_KEY = scopedKey("gymnasia.mobile.user_prefs.v1");
const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function logStep(message) {
  console.log(`[storage-recovery-e2e] ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createStore(marker = "") {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: marker ? [{ id: `thread_${marker}`, title: marker }] : [],
    messagesByThread: {},
    keys: [],
  };
}

function createSnapshot(payload) {
  return {
    version: 1,
    createdAt: "2026-08-30T10:00:00.000Z",
    payload,
    sha256: sha256(payload),
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
  const configuredUrl = process.env.STORAGE_RECOVERY_E2E_URL?.trim();
  if (configuredUrl) {
    await waitForUrl(configuredUrl);
    return { baseUrl: configuredUrl, stop: async () => {} };
  }

  const port = Number.parseInt(
    process.env.STORAGE_RECOVERY_E2E_PORT ?? `${DEFAULT_PORT}`,
    10,
  ) || DEFAULT_PORT;
  const baseUrl = `http://127.0.0.1:${port}`;
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
    if (output) console.error(`[storage-recovery-e2e][expo] ${output}`);
  });
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) throw new Error(`expo export terminó con código ${exitCode}.`);

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
  return {
    baseUrl,
    stop: async () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function openSeededPage(browser, baseUrl, seed) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(({ values }) => {
    localStorage.clear();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  }, { values: seed });
  const page = await context.newPage();
  const providerRequests = [];
  page.on("request", (request) => {
    if (/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/.test(request.url())) {
      providerRequests.push(request.url());
    }
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="local-store-recovery-screen"]')
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  return { context, page, providerRequests };
}

async function readLocalStorage(page, key) {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
}

async function waitForRecoveryToClose(page) {
  await page.locator('[data-testid="local-store-recovery-screen"]')
    .waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
}

async function run() {
  const server = await ensureWebServer();
  const browser = await chromium.launch({ headless: true });
  try {
    logStep("El JSON roto permanece intacto y puede exportarse");
    const corruptRaw = '{"templates":[BROKEN';
    {
      const { context, page, providerRequests } = await openSeededPage(browser, server.baseUrl, {
        [STORE_KEY]: corruptRaw,
      });
      await sleep(500);
      assert.equal(await readLocalStorage(page, STORE_KEY), corruptRaw);
      assert.equal(providerRequests.length, 0, "la recuperación no debe llamar a proveedores de IA");
      if (process.env.STORAGE_RECOVERY_E2E_SCREENSHOT) {
        await page.screenshot({
          path: process.env.STORAGE_RECOVERY_E2E_SCREENSHOT,
          fullPage: true,
        });
      }

      const downloadPromise = page.waitForEvent("download", { timeout: STEP_TIMEOUT_MS });
      await page.locator('[data-testid="local-store-recovery-export"]').click();
      const download = await downloadPromise;
      const exported = JSON.parse(await readFileSync(await download.path(), "utf8"));
      assert.equal(exported.type, "local-store-recovery");
      assert.equal(exported.recovery.rawPayload, corruptRaw);
      assert.match(exported.warning, /sensible/i);
      await context.close();
    }

    logStep("Los errores estructurales muestran solo rutas saneadas");
    {
      const malformedRaw = JSON.stringify(createStore());
      const malformed = JSON.stringify({ ...JSON.parse(malformedRaw), templates: "PRIVATE_VALUE" });
      const { context, page } = await openSeededPage(browser, server.baseUrl, {
        [STORE_KEY]: malformed,
      });
      await page.locator('[data-testid="local-store-recovery-details-toggle"]').click();
      const details = await page.locator('[data-testid="local-store-recovery-details"]').innerText();
      assert.match(details, /\$\.templates/);
      assert.doesNotMatch(details, /PRIVATE_VALUE/);
      assert.equal(await readLocalStorage(page, STORE_KEY), malformed);
      await context.close();
    }

    logStep("El reintento acepta una reparación explícita y elimina la cuarentena");
    {
      const repairedRaw = JSON.stringify(createStore("Datos reparados"));
      const { context, page } = await openSeededPage(browser, server.baseUrl, {
        [STORE_KEY]: "broken",
      });
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
        key: STORE_KEY,
        value: repairedRaw,
      });
      await page.locator('[data-testid="local-store-recovery-retry"]').click();
      await waitForRecoveryToClose(page);
      const stored = JSON.parse(await readLocalStorage(page, STORE_KEY));
      assert.equal(stored.threads[0].title, "Datos reparados");
      assert.equal(await readLocalStorage(page, QUARANTINE_KEY), null);
      await context.close();
    }

    logStep("La última copia íntegra solo se recupera después de confirmación");
    {
      const snapshotRaw = JSON.stringify(createStore("Snapshot recuperado"));
      const { context, page } = await openSeededPage(browser, server.baseUrl, {
        [STORE_KEY]: "broken",
        [SNAPSHOT_KEY]: JSON.stringify(createSnapshot(snapshotRaw)),
      });
      await page.locator('[data-testid="local-store-snapshot-available"]')
        .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
      assert.equal(await readLocalStorage(page, STORE_KEY), "broken");
      await page.locator('[data-testid="local-store-recovery-restore"]').click();
      await waitForRecoveryToClose(page);
      const restored = JSON.parse(await readLocalStorage(page, STORE_KEY));
      assert.equal(restored.threads[0].title, "Snapshot recuperado");
      assert.equal(await readLocalStorage(page, QUARANTINE_KEY), null);
      await context.close();
    }

    logStep("Descartar borra solo LocalStore y la sesión dependiente");
    {
      const personalData = JSON.stringify([{ key: "objetivo", description: "", value: "mantener" }]);
      const preferences = JSON.stringify({ chartPeriod: "1y", notifications: { enabled: false } });
      const { context, page } = await openSeededPage(browser, server.baseUrl, {
        [STORE_KEY]: "broken",
        [SESSION_KEY]: JSON.stringify({ id: "active" }),
        [SESSION_SNAPSHOT_KEY]: JSON.stringify({ id: "template" }),
        [PERSONAL_DATA_KEY]: personalData,
        [USER_PREFS_KEY]: preferences,
      });
      await page.locator('[data-testid="local-store-recovery-discard"]').click();
      await page.locator('[data-testid="local-store-recovery-discard-confirm"]').click();
      await waitForRecoveryToClose(page);
      const resetStore = JSON.parse(await readLocalStorage(page, STORE_KEY));
      assert.deepEqual(resetStore.templates, []);
      assert.equal(await readLocalStorage(page, SESSION_KEY), null);
      assert.equal(await readLocalStorage(page, SESSION_SNAPSHOT_KEY), null);
      assert.equal(await readLocalStorage(page, PERSONAL_DATA_KEY), personalData);
      assert.deepEqual(JSON.parse(await readLocalStorage(page, USER_PREFS_KEY)), {
        schemaVersion: 1,
        chartPeriod: "3m",
        chartMetric: "weight",
        notifications: {
          enabled: false,
          sound: true,
          vibrate: true,
          soundKey: "rest_finished",
        },
      });
      assert.equal(await readLocalStorage(page, QUARANTINE_KEY), null);
      await context.close();
    }

    logStep("Recorrido de recuperación completado");
  } finally {
    await browser.close();
    await server.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
