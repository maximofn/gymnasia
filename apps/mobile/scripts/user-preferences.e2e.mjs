import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repositoryRoot = join(mobileRoot, "..", "..");
const distRoot = join(mobileRoot, "dist");
const port = Number.parseInt(process.env.USER_PREFERENCES_E2E_PORT ?? "8133", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const namespace = "gymnasia.development";
const scopedKey = (key) => `${namespace}:${key}`;
const keys = {
  store: scopedKey("gymnasia.mobile.local.v3"),
  preferences: scopedKey("gymnasia.mobile.user_prefs.v1"),
  traces: scopedKey("gymnasia_debug_traces"),
};
const privateMarker = "PRIVATE_PREFERENCE_VALUE_MUST_NOT_LEAK";

const startupCanonical = {
  schemaVersion: 1,
  chartPeriod: "6m",
  chartMetric: "waist",
  notifications: {
    enabled: false,
    sound: true,
    vibrate: false,
    soundKey: "buzzer",
  },
};

const importedCanonical = {
  schemaVersion: 1,
  chartPeriod: "1m",
  chartMetric: "bodyFat",
  notifications: {
    enabled: true,
    sound: false,
    vibrate: true,
    soundKey: "bell",
  },
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".png": "image/png",
};

function log(message) {
  console.log(`[user-preferences-e2e] ${message}`);
}

function createStore() {
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
    threads: [],
    messagesByThread: {},
    keys: [],
  };
}

function exportDevelopmentBundle() {
  if (process.env.USER_PREFERENCES_E2E_SKIP_EXPORT === "1") {
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
        DEV_PROVIDER_MODE: "fake",
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

async function readJsonStorage(page, key) {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? null : JSON.parse(raw);
  }, key);
}

async function waitForStoredPreferences(page, expected) {
  await page.waitForFunction(({ key, value }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      return JSON.stringify(JSON.parse(raw)) === JSON.stringify(value);
    } catch {
      return false;
    }
  }, { key: keys.preferences, value: expected });
  assert.deepEqual(await readJsonStorage(page, keys.preferences), expected);
}

async function preferenceTraces(page) {
  const traces = await readJsonStorage(page, keys.traces);
  return Array.isArray(traces)
    ? traces.filter((entry) => entry?.tag === "user-preferences")
    : [];
}

async function openSettingsTab(page, tab) {
  await page.getByTestId("nav-tab-settings").click();
  const tabButton = page.getByTestId(`settings-tab-${tab}`);
  await tabButton.scrollIntoViewIfNeeded();
  await tabButton.click();
}

async function run() {
  exportDevelopmentBundle();
  assert.ok(existsSync(join(distRoot, "index.html")), "La exportación no creó dist/index.html.");

  const server = await startServer();
  const browser = await chromium.launch({
    headless: process.env.USER_PREFERENCES_E2E_HEADLESS !== "0",
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(({ storageKeys, store, marker }) => {
    if (sessionStorage.getItem("gymnasia-user-preferences-e2e-seeded") === "1") return;
    localStorage.clear();
    localStorage.setItem(storageKeys.store, JSON.stringify(store));
    localStorage.setItem(storageKeys.preferences, JSON.stringify({
      schemaVersion: 99,
      chartPeriod: "6m",
      chartMetric: "waist",
      unknownRoot: marker,
      notifications: {
        enabled: false,
        sound: "false",
        vibrate: false,
        soundKey: "buzzer",
        unknownNested: marker,
      },
    }));
    localStorage.setItem(storageKeys.traces, "[]");
    sessionStorage.setItem("gymnasia-user-preferences-e2e-seeded", "1");
  }, { storageKeys: keys, store: createStore(), marker: privateMarker });

  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("https://api.github.com/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: "{}",
  }));

  try {
    log("Reparando el documento dañado durante el arranque");
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByTestId("nav-tab-home").waitFor({ state: "visible", timeout: 30_000 });
    await waitForStoredPreferences(page, startupCanonical);

    log("Comprobando que la interfaz refleja todos los campos reparados");
    await page.getByTestId("nav-tab-measures").click();
    assert.match(await page.getByTestId("measures-chart-metric-current").innerText(), /Cintura/);
    assert.match(await page.getByTestId("measures-chart-period-current").innerText(), /6 meses/);

    await openSettingsTab(page, "notifications");
    assert.match(await page.getByTestId("notification-enabled-toggle").getAttribute("aria-label") ?? "", /no$/);
    assert.match(await page.getByTestId("notification-sound-toggle").getAttribute("aria-label") ?? "", /sí$/);
    assert.match(await page.getByTestId("notification-vibrate-toggle").getAttribute("aria-label") ?? "", /no$/);
    assert.match(await page.getByTestId("notification-sound-option-buzzer").getAttribute("aria-label") ?? "", /seleccionado$/);

    const startupTraces = await preferenceTraces(page);
    assert.equal(startupTraces.length, 1);
    assert.deepEqual(startupTraces[0].data, {
      source: "startup",
      schemaVersion: 1,
      repairCodes: ["unsupported_schema_version", "notification_sound_defaulted"],
    });
    assert.doesNotMatch(JSON.stringify(startupTraces), new RegExp(privateMarker));

    log("Recargando el documento canónico sin generar otra reparación");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByTestId("nav-tab-home").waitFor({ state: "visible", timeout: 30_000 });
    await waitForStoredPreferences(page, startupCanonical);
    assert.equal((await preferenceTraces(page)).length, startupTraces.length);

    log("Importando una copia v1 con preferencias parciales");
    await openSettingsTab(page, "data");
    const backup = {
      app: "gymnasia",
      type: "backup",
      schemaVersion: 1,
      appVersion: "1.0.0",
      createdAt: "2026-09-01T10:00:00.000Z",
      data: {
        store: createStore(),
        userPrefs: {
          chartPeriod: "1m",
          chartMetric: "bodyFat",
          notifications: { enabled: true, sound: false, soundKey: "bell" },
        },
        personalFoods: [],
        personalData: [],
      },
    };
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
    await page.getByTestId("backup-import-picker").click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "legacy-preferences.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByTestId("backup-import-confirm").waitFor({ state: "visible", timeout: 30_000 });
    await page.getByTestId("backup-import-confirm").click();
    const result = page.getByTestId("backup-result");
    await result.waitFor({ state: "visible", timeout: 30_000 });
    assert.match(await result.innerText(), /Se repararon ajustes de preferencias/);
    await waitForStoredPreferences(page, importedCanonical);

    const importedTraces = await preferenceTraces(page);
    assert.equal(importedTraces.length, 2);
    assert.deepEqual(importedTraces[1].data, {
      source: "backup",
      schemaVersion: 1,
      repairCodes: ["legacy_unversioned", "notification_vibrate_defaulted"],
    });
    assert.doesNotMatch(JSON.stringify(importedTraces), new RegExp(privateMarker));

    log("Recargando las preferencias importadas sin nuevas reparaciones");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByTestId("nav-tab-home").waitFor({ state: "visible", timeout: 30_000 });
    await waitForStoredPreferences(page, importedCanonical);
    assert.equal((await preferenceTraces(page)).length, importedTraces.length);
    assert.deepEqual(pageErrors, [], `Errores en la página: ${pageErrors.join(" | ")}`);
    log("Arranque, importación, redacción e idempotencia verificados");
  } catch (error) {
    await page.screenshot({ path: "/tmp/user-preferences-e2e-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

await run();
