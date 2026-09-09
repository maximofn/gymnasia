/** Regression for GYM-230 (ticket para corregir la lentitud de la interfaz). */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const output = process.env.MEASUREMENT_E2E_OUTPUT ?? join(tmpdir(), "gymnasia-measurement-performance");
const dist = join(output, "dist");
const scope = (key) => `gymnasia.development:${key}`;
const storeKey = scope("gymnasia.mobile.local.v3");
const sessionKey = scope("gymnasia.mobile.training.session.v1");
const snapshotKey = scope("gymnasia.mobile.local.last_good.v1");
const log = (message) => console.log(`[measurement-e2e] ${message}`);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function record(index, overrides = {}) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - index - 1);
  return {
    id: `measure-${index}`, measured_on: dateKey(date), measured_at: date.toISOString(),
    weight_kg: 80 + (index % 20) / 10, body_fat_pct: null, height_cm: null,
    neck_cm: 40, waist_cm: 90, hips_cm: 100, chest_cm: 101,
    biceps_cm: 35, quadriceps_cm: 60, calf_cm: 38, photo_uri: null, ...overrides,
  };
}

function seedStore() {
  return {
    templates: [{
      id: "perf", name: "Rutina de rendimiento", category: "hypertrophy", icon: "zap",
      duration_minutes: "30", series_schema_version: 1,
      exercises: [{
        id: "exercise", name: "Press de banca", sets: [10, 10, 10], load_kg: 40, rest_seconds: 0,
        series: [1, 2, 3].map((n) => ({ id: `set-${n}`, type: "normal", reps: "10", weight_kg: "40", rest_seconds: "0", sub_series: [] })),
      }],
    }],
    workoutHistory: [], dietByDate: {},
    dietSettings: {
      sex: "male", height_cm: "180", goal: "maintain", daily_calories: "2200",
      macro_mode: "manual_calories", manual_macro_calories: { carbs: "1100", protein: "550", fat: "550" },
      protein_grams_per_kg: "2", carbs_grams_per_kg: "3", fat_grams_per_kg: "1",
    },
    measurements: Array.from({ length: 1826 }, (_, i) => record(i)),
    threads: [{ id: "perf-thread", title: "Prueba de rendimiento" }],
    messagesByThread: { "perf-thread": [] }, keys: [],
  };
}

async function counters(page) {
  return page.evaluate(() => ({ ...globalThis.__GYMNASIA_MEASUREMENT_WORK__ }));
}
async function persisted(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storeKey);
}
async function click(page, id) {
  const locator = page.getByTestId(id);
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}
async function nav(page, tab) { await click(page, `nav-tab-${tab}`); }
async function settings(page, tab) {
  await nav(page, "settings");
  await click(page, `settings-tab-${tab}`);
}
async function expectUnchanged(page, before, label) {
  const after = await counters(page);
  for (const key of ["preparations", "sorts", "summaries", "summaryVisits", "metricEvaluations", "cards"]) {
    assert.equal(after[key], before[key], `${label}: volvió a ejecutar ${key}`);
  }
}
async function waitForWeight(page, weight) {
  await page.waitForFunction(({ key, weight }) => JSON.parse(localStorage.getItem(key) ?? "null")?.measurements?.[0]?.weight_kg === weight, { key: storeKey, weight });
}
async function assertCard(page, value) {
  await nav(page, "measures");
  await page.getByTestId("measurement-stat-Peso").filter({ hasText: value }).waitFor();
}

mkdirSync(output, { recursive: true });
if (process.env.MEASUREMENT_E2E_SKIP_EXPORT !== "1") {
  log("Exportando la app con contadores solo para pruebas");
  execFileSync("npm", ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear", "--output-dir", dist], {
    cwd: root, stdio: "inherit",
    env: { ...process.env, APP_ENV: "development", DEV_PROVIDER_MODE: "fake", EXPO_PUBLIC_MEASUREMENT_PERF_TEST: "1", CI: "1" },
  });
}
assert.ok(existsSync(join(dist, "index.html")));
const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".ttf": "font/ttf", ".png": "image/png", ".webp": "image/webp", ".wav": "audio/wav" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = normalize(join(dist, pathname === "/" ? "index.html" : pathname));
  const file = candidate.startsWith(`${dist}/`) && existsSync(candidate) ? candidate : join(dist, "index.html");
  response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: process.env.MEASUREMENT_E2E_HEADLESS !== "0" });
const errors = [];
const results = [];
let page;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, store }) => {
    if (sessionStorage.getItem("measurement-test-seeded")) return;
    sessionStorage.setItem("measurement-test-seeded", "1");
    localStorage.setItem(key, JSON.stringify(store));
  }, { key: storeKey, store: seedStore() });
  await context.route("**/*", (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(url) || requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.getByTestId("nav-tab-home").waitFor();
  await page.waitForFunction(() => globalThis.__GYMNASIA_MEASUREMENT_WORK__?.preparationVisits >= 1826);
  await assertCard(page, "80 kg");
  await nav(page, "training");
  await click(page, "training-template-inline-start-perf");
  await page.getByText("Sesión activa", { exact: true }).waitFor();
  const baseline = await counters(page);
  const elapsed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).elapsed_seconds, sessionKey);
  await page.waitForFunction(({ key, elapsed }) => JSON.parse(localStorage.getItem(key) ?? "null")?.elapsed_seconds >= elapsed + 3, { key: sessionKey, elapsed });
  await expectUnchanged(page, baseline, "tres ticks del cronómetro");
  await click(page, "training-session-complete-series-exercise:set-1");
  for (const tab of ["home", "diet", "measures", "home", "measures"]) {
    await nav(page, tab);
    await page.mouse.move(200, 450);
    await page.mouse.wheel(0, 500);
  }
  await click(page, "measures-chart-period-current");
  await click(page, "measures-chart-period-option-all");
  await expectUnchanged(page, baseline, "navegación, check, scroll y periodo");
  await nav(page, "chat");
  await page.getByTestId("chat-input").fill("Hola fixture");
  // The existing workout overlay covers Send at this narrow web viewport.
  // Use its real keyboard activation, without bypassing the button's disabled state.
  await page.getByTestId("chat-send").focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-testid^="chat-message-assistant-"]').filter({ hasText: "Fixture local" }).waitFor();
  // Main chat has no stop-response control: cover discarding a draft and leaving chat.
  await page.getByTestId("chat-input").fill("Borrador descartado");
  await page.getByTestId("chat-input").fill("");
  await nav(page, "home");
  await expectUnchanged(page, baseline, "envío, borrador descartado y salida del chat");
  results.push({ scenario: "unrelated-interactions", before: baseline, after: await counters(page) });
  log("Cronómetro, navegación, checks, scroll y chat no recalculan medidas");

  await settings(page, "diet");
  const beforeSex = await counters(page);
  await page.getByText("Mujer", { exact: true }).click();
  await click(page, "save-diet-plan");
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).dietSettings.sex === "female", storeKey);
  const afterSex = await counters(page);
  assert.equal(afterSex.preparations, beforeSex.preparations);
  assert.ok(afterSex.summaries > beforeSex.summaries);
  await page.getByPlaceholder("cm", { exact: true }).fill("170");
  await click(page, "save-diet-plan");
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).dietSettings.height_cm === "170", storeKey);
  assert.equal((await counters(page)).preparations, beforeSex.preparations);
  assert.ok((await counters(page)).summaries > afterSex.summaries);

  await nav(page, "measures");
  await click(page, "measurement-add");
  await page.getByTestId("measurement-weight-input").fill("77");
  const beforeAdd = await counters(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    globalThis.__restoreMeasurementTestStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (storageKey, value) {
      if (this === localStorage && storageKey === key) throw new Error("Fallo de disco simulado");
      return original.call(this, storageKey, value);
    };
  }, storeKey);
  await click(page, "measurement-save-primary");
  await page.getByText(/No se ha guardado la medición/).first().waitFor();
  assert.equal((await persisted(page)).measurements[0].weight_kg, 80);
  await expectUnchanged(page, beforeAdd, "guardado fallido");
  await page.evaluate(() => { globalThis.__restoreMeasurementTestStorage(); delete globalThis.__restoreMeasurementTestStorage; });
  await click(page, "measurement-save-primary");
  await waitForWeight(page, 77);
  await assertCard(page, "77 kg");
  assert.equal((await persisted(page)).measurements.length, 1826);
  assert.ok((await counters(page)).preparations > beforeAdd.preparations);
  const addedId = (await persisted(page)).measurements[0].id;
  await click(page, `measurement-history-${addedId}`);
  await page.getByTestId("measurement-weight-input").fill("76");
  await click(page, "measurement-save-primary");
  await waitForWeight(page, 76);
  await assertCard(page, "76 kg");
  await page.reload();
  await assertCard(page, "76 kg");
  await settings(page, "measures");
  await click(page, `measurement-delete-${addedId}`);
  await waitForWeight(page, 80);
  await assertCard(page, "80 kg");
  log("Altura, sexo, altas, edición, borrado y recarga actualizan los resultados");

  const importedStore = seedStore();
  importedStore.measurements = [record(0, { weight_kg: 71 })];
  const backup = {
    app: "gymnasia", type: "backup", schemaVersion: 1, appVersion: "1.0.0", createdAt: new Date().toISOString(),
    data: { store: importedStore, userPrefs: {}, personalFoods: [], personalData: [] },
  };
  await settings(page, "data");
  const chooserPromise = page.waitForEvent("filechooser");
  await click(page, "backup-import-picker");
  await (await chooserPromise).setFiles({ name: "synthetic-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await click(page, "backup-import-confirm");
  await waitForWeight(page, 71);
  await assertCard(page, "71 kg");
  await page.reload();
  await assertCard(page, "71 kg");

  const restoredStore = { ...importedStore, measurements: [record(0, { weight_kg: 69 })] };
  const payload = JSON.stringify(restoredStore);
  const snapshot = { version: 1, createdAt: new Date().toISOString(), payload, sha256: createHash("sha256").update(payload).digest("hex") };
  await page.evaluate(({ key, snapshotKey, snapshot }) => {
    localStorage.setItem(key, "{broken");
    localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  }, { key: storeKey, snapshotKey, snapshot });
  await page.reload();
  await click(page, "local-store-recovery-restore");
  await assertCard(page, "69 kg");
  await settings(page, "data");
  await click(page, "data-deletion-open-all");
  await page.getByTestId("data-deletion-confirmation-input").fill("BORRAR");
  await click(page, "data-deletion-confirm");
  await page.getByTestId("data-deletion-success").waitFor();
  await assertCard(page, "Sin datos");
  await page.reload();
  await assertCard(page, "Sin datos");
  log("Importación, recuperación y borrado total no conservan resúmenes antiguos");
  assert.deepEqual(errors, []);
  writeFileSync(join(output, "results.json"), JSON.stringify({ result: "passed", results }, null, 2));
} catch (error) {
  if (page) {
    await page.screenshot({ path: join(output, "failure.png"), fullPage: true });
    writeFileSync(join(output, "failure.txt"), await page.locator("body").innerText());
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
