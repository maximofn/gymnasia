import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repositoryRoot = join(mobileRoot, "..", "..");
const distRoot = join(mobileRoot, "dist");
const port = Number.parseInt(process.env.DIET_E2E_PORT ?? "8133", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const storageKey = "gymnasia.development:gymnasia.mobile.local.v3";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".png": "image/png",
};

function log(message) {
  console.log(`[diet-validation-e2e] ${message}`);
}

function seedStore() {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {
      goal: "maintain",
      activity_level: "moderate",
      sex: "male",
      height_cm: "",
      birth_date: "",
      daily_calories: "2200",
      macro_mode: "manual_calories",
      manual_macro_calories: { protein: "550", carbs: "1100", fat: "550" },
      protein_grams_per_kg: "1.5",
      carbs_grams_per_kg: "",
      fat_grams_per_kg: "",
    },
    measurements: [],
    threads: [{ id: "thread_diet_e2e", title: "Dieta E2E" }],
    messagesByThread: { thread_diet_e2e: [] },
    keys: [
      { provider: "openai", is_active: false, api_key: "", model: "gpt-5-mini" },
      { provider: "anthropic", is_active: false, api_key: "", model: "claude-sonnet-4-5" },
      { provider: "google", is_active: false, api_key: "", model: "gemini-2.5-flash" },
    ],
    chatProvider: "openai",
    foodAIProvider: "google",
  };
}

function exportDevelopmentBundle() {
  if (process.env.DIET_E2E_SKIP_EXPORT === "1") {
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

async function persistedStore(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), storageKey);
}

async function openDietSettings(page) {
  await page.getByTestId("nav-tab-settings").click();
  const dietSettings = page.getByTestId("settings-tab-diet");
  await dietSettings.scrollIntoViewIfNeeded();
  await dietSettings.click();
  await page.getByTestId("diet-plan-daily-calories-input").waitFor({ state: "visible" });
}

exportDevelopmentBundle();
const server = await startServer();
const browser = await chromium.launch({ headless: process.env.DIET_E2E_HEADLESS !== "0" });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(({ key, store }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(store));
  }, { key: storageKey, store: seedStore() });
  await page.route("**/dev-store", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await openDietSettings(page);

  log("Comprobando que un objetivo diario cero no se guarda");
  await page.getByTestId("diet-plan-daily-calories-input").fill("0");
  await page.getByTestId("diet-plan-error-daily-calories").waitFor({ state: "visible" });
  await page.getByTestId("save-diet-plan").click();
  await page.getByTestId("diet-plan-save-result")
    .filter({ hasText: "Revisa los campos marcados" })
    .waitFor({ state: "visible" });
  assert.equal((await persistedStore(page)).dietSettings.daily_calories, "2200");

  log("Guardando un reparto que supera el objetivo sin mostrar remanentes negativos");
  await page.getByTestId("diet-plan-daily-calories-input").fill("2000");
  await page.getByTestId("diet-plan-protein-calories-input").fill("1000");
  await page.getByTestId("diet-plan-carbs-calories-input").fill("1000");
  await page.getByTestId("diet-plan-fat-calories-input").fill("500");
  const budgetWarning = page.getByTestId("diet-plan-budget-warning");
  await budgetWarning.waitFor({ state: "visible" });
  assert((await budgetWarning.textContent()).includes("500 kcal"));
  assert((await budgetWarning.locator("xpath=..").textContent()).includes("Restantes: 0 kcal"));
  assert.equal((await budgetWarning.locator("xpath=..").textContent()).includes("Restantes: -"), false);
  await page.getByTestId("save-diet-plan").click();
  await page.getByTestId("diet-plan-save-result")
    .filter({ hasText: "Plan guardado con un exceso de 500 kcal" })
    .waitFor({ state: "visible" });
  if (process.env.DIET_E2E_SETTINGS_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.DIET_E2E_SETTINGS_SCREENSHOT_PATH,
      fullPage: true,
    });
  }
  await page.waitForFunction((key) => {
    const store = JSON.parse(localStorage.getItem(key) ?? "null");
    return store?.dietSettings?.daily_calories === "2000"
      && store?.dietSettings?.manual_macro_calories?.fat === "500";
  }, storageKey);
  log("Comprobando el formulario manual y la ausencia de escrituras parciales");
  await page.getByTestId("nav-tab-diet").click();
  await page.getByTestId("diet-saved-plan-budget-warning").waitFor({ state: "visible" });
  const openManual = page.getByTestId("open-manual-food-desayuno");
  await openManual.scrollIntoViewIfNeeded();
  await openManual.click();
  await page.getByTestId("manual-food-name-input").fill("Agua E2E");
  await page.getByTestId("manual-food-calories-input").fill("-5");
  await page.getByTestId("save-manual-food").click();
  await page.getByTestId("manual-food-calories-error").waitFor({ state: "visible" });
  assert.deepEqual((await persistedStore(page)).dietByDate, {});

  await page.getByTestId("manual-food-calories-input").fill("0");
  await page.getByTestId("save-manual-food").click();
  await page.getByText("Agua E2E", { exact: true }).last().waitFor({ state: "visible" });
  await page.waitForFunction((key) => {
    const store = JSON.parse(localStorage.getItem(key) ?? "null");
    return Object.values(store?.dietByDate ?? {}).some((day) =>
      day.meals?.some((meal) => meal.items?.some((item) => (
        item.title === "Agua E2E"
        && item.calories_kcal === 0
        && item.protein_g === 0
        && item.carbs_g === 0
        && item.fat_g === 0
      ))),
    );
  }, storageKey);
  if (process.env.DIET_E2E_DIET_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.DIET_E2E_DIET_SCREENSHOT_PATH,
      fullPage: true,
    });
  }

  await context.close();
  log("Flujo de validación de dieta verificado");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
