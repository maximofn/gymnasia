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
const port = Number.parseInt(process.env.CATALOG_E2E_PORT ?? "8136", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const storageKey = "gymnasia.development:gymnasia.mobile.local.v3";
const foodsCacheKey = "gymnasia.development:gymnasia.mobile.foods_repo.v1";
const exercisesCacheKey = "gymnasia.development:gymnasia.mobile.exercises_repo.v2";
const fixtureFoodName = "Pera Catálogo E2E";
const fixtureExerciseName = "Sentadilla Catálogo E2E";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webp": "image/webp",
};

const foodFixture = [{
  id: "pera-catalogo-e2e",
  name: fixtureFoodName,
  category: "fruta",
  calories_per_100g: 57,
  protein_per_100g: 0.4,
  carbs_per_100g: 15,
  fat_per_100g: 0.1,
  fiber_per_100g: 3.1,
  serving_size_g: 178,
  serving_description: "1 pera mediana",
  image: "pera-catalogo-e2e.webp",
}];

const exerciseFixture = [{
  id: "sentadilla-catalogo-e2e",
  name: fixtureExerciseName,
  image_male: "images/sentadilla-catalogo-e2e-male.webp",
  image_female: "images/sentadilla-catalogo-e2e-female.webp",
  muscle_group: "Cuádriceps",
  secondary_muscles: ["Glúteos"],
  equipment: "Peso corporal",
  difficulty: "Principiante",
  instructions: "Flexiona cadera y rodillas manteniendo el torso estable.",
}];

function log(message) {
  console.log(`[catalogs-e2e] ${message}`);
}

function seedStore() {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    measurements: [],
    threads: [{ id: "thread_catalogs_e2e", title: "Catálogos E2E" }],
    messagesByThread: { thread_catalogs_e2e: [] },
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
  if (process.env.CATALOG_E2E_SKIP_EXPORT === "1") {
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

async function installRoutes(page, networkState) {
  const imageFixture = readFileSync(join(repositoryRoot, "alimentos", "images", "manzana.webp"));
  await page.route("**/dev-store", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("https://api.github.com/**", (route) => route.fulfill({ status: 503 }));
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    if (networkState.offline) {
      return route.fulfill({ status: 503, body: "offline fixture" });
    }

    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/alimentos/all.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(foodFixture) });
    }
    if (pathname.endsWith("/ejercicios/all.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exerciseFixture) });
    }
    if (pathname.endsWith("/productos_comerciales/all.json") || pathname.endsWith("/recetas/all.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (pathname.endsWith(".webp")) {
      return route.fulfill({ status: 200, contentType: "image/webp", body: imageFixture });
    }
    return route.fulfill({ status: 200, contentType: "text/plain", body: "Fixture local de catálogos." });
  });
}

async function preparePage(context, networkState) {
  const page = await context.newPage();
  await page.addInitScript(({ key, store }) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(store));
    }
  }, { key: storageKey, store: seedStore() });
  await installRoutes(page, networkState);
  return page;
}

async function openApp(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByTestId("nav-tab-diet").waitFor({ state: "visible", timeout: 30_000 });
}

async function expectFoodConsumer(page, expected) {
  await page.getByTestId("nav-tab-diet").click();
  const search = page.locator('input[placeholder="Buscar alimento..."]').first();
  await search.waitFor({ state: "visible" });
  await search.fill(fixtureFoodName);
  if (expected) {
    await page.getByText(fixtureFoodName, { exact: true }).first().waitFor({ state: "visible" });
  } else {
    await page.getByText("No se encontraron alimentos.", { exact: true }).first().waitFor({ state: "visible" });
  }
}

async function openExerciseConsumer(page, routineName) {
  await page.getByTestId("nav-tab-training").click();
  const addExercise = page.getByTestId("training-editor-add-exercise");
  if (!(await addExercise.isVisible().catch(() => false))) {
    const existingRoutine = page.getByText(routineName, { exact: true }).first();
    if (await existingRoutine.isVisible().catch(() => false)) {
      await existingRoutine.click();
      const editRoutine = page.getByTestId("training-detail-edit");
      await editRoutine.waitFor({ state: "visible" });
      await editRoutine.click();
    } else {
      const firstRoutine = page.getByText("CREAR RUTINA", { exact: true });
      if (await firstRoutine.isVisible().catch(() => false)) {
        await firstRoutine.click();
      } else {
        await page.getByText("Nueva rutina", { exact: true }).click();
      }
      await page.locator('input[placeholder="Nombre de rutina"]').fill(routineName);
    }
  }
  await addExercise.waitFor({ state: "visible" });
  await addExercise.click();
  const search = page.locator('input[placeholder="Buscar ejercicio..."]');
  await search.waitFor({ state: "visible" });
  await search.fill(fixtureExerciseName);
}

async function expectExerciseConsumer(page, routineName, expected) {
  await openExerciseConsumer(page, routineName);
  const result = page.getByText(fixtureExerciseName, { exact: true });
  if (expected) {
    await result.waitFor({ state: "visible" });
  } else {
    assert.equal(await result.count(), 0);
  }
}

async function expectCaches(page, expected) {
  await page.waitForFunction(
    ({ foodKey, exerciseKey, hasEntries }) => {
      const foods = JSON.parse(localStorage.getItem(foodKey) ?? "[]");
      const exercises = JSON.parse(localStorage.getItem(exerciseKey) ?? "[]");
      return hasEntries
        ? foods.some((entry) => entry.name === "Pera Catálogo E2E")
          && exercises.some((entry) => entry.name === "Sentadilla Catálogo E2E")
        : foods.length === 0 && exercises.length === 0;
    },
    { foodKey: foodsCacheKey, exerciseKey: exercisesCacheKey, hasEntries: expected },
  );
}

exportDevelopmentBundle();
const server = await startServer();
const browser = await chromium.launch({ headless: process.env.CATALOG_E2E_HEADLESS !== "0" });

try {
  const networkState = { offline: false };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await preparePage(context, networkState);

  log("Verificando descarga y consumo de agregados válidos");
  await openApp(page);
  await expectCaches(page, true);
  await expectFoodConsumer(page, true);
  await expectExerciseConsumer(page, "Rutina Catálogos E2E", true);

  log("Verificando que la caché mantiene ambos consumidores sin red");
  networkState.offline = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("nav-tab-diet").waitFor({ state: "visible" });
  await expectCaches(page, true);
  await expectFoodConsumer(page, true);
  await expectExerciseConsumer(page, "Rutina Catálogos E2E", true);
  await context.close();

  log("Verificando arranque limpio sin red y repositorios vacíos");
  const coldContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const coldPage = await preparePage(coldContext, networkState);
  await openApp(coldPage);
  await expectCaches(coldPage, false);
  await expectFoodConsumer(coldPage, false);
  await expectExerciseConsumer(coldPage, "Rutina Offline E2E", false);
  await coldContext.close();

  log("Fallback local-first de catálogos verificado");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
