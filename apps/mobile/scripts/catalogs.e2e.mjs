import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { createExerciseCatalogArtifacts } from "../../../scripts/catalogs/exercise-pagination.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repositoryRoot = join(mobileRoot, "..", "..");
const distRoot = join(mobileRoot, "dist");
const port = Number.parseInt(process.env.CATALOG_E2E_PORT ?? "8136", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const storageKey = "gymnasia.development:gymnasia.mobile.local.v3";
const foodsCacheKey = "gymnasia.development:gymnasia.mobile.foods_repo.v2";
const exercisesCacheKey = "gymnasia.development:gymnasia.mobile.exercises_repo.v3";
const exerciseCatalogCacheKey = "gymnasia.development:gymnasia.mobile.exercise_catalog.v4";
const legacyFoodsCacheKey = "gymnasia.development:gymnasia.mobile.foods_repo.v1";
const legacyProductsCacheKey = "gymnasia.development:gymnasia.mobile.products_repo.v1";
const legacyRecipesCacheKey = "gymnasia.development:gymnasia.mobile.recipes_repo.v1";
const fixtureFoodName = "Pera Catálogo E2E";
const fixtureExerciseName = "Sentadilla Catálogo E2E";
const screenshotDir = process.env.CATALOG_E2E_SCREENSHOT_DIR || "";
const ciqualFoods = JSON.parse(readFileSync(join(repositoryRoot, "apps/mobile/catalogs/generated/ciqualBaseline.generated.json"), "utf8")).foods;
const ciqualRice = ciqualFoods.find((food) => food.id === "ciqual-9100");
const ciqualLatest = ciqualFoods.find((food) => food.id === "ciqual-1010");
const ciqualImageIndex = JSON.parse(readFileSync(join(repositoryRoot, "apps/mobile/catalogs/generated/ciqualImages.generated.json"), "utf8"));
const ciqualImageUrl = (food) => `https://raw.githubusercontent.com/maximofn/gymnasia/main/alimentos/ciqual/${ciqualImageIndex.images[food.id]}`;
const ciqualImageFiles = new Map(Object.values(ciqualImageIndex.images).map((path) => [
  `/maximofn/gymnasia/main/alimentos/ciqual/${path}`, join(repositoryRoot, "alimentos/ciqual", path),
]));
const ciqualIncomplete = ciqualFoods.find((food) => food.calories_per_100g !== null && food.ciqual.qualifiers.fat_per_100g.qualifier === "missing");

if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

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

function exerciseCatalogFixture(name = fixtureExerciseName) {
  const entries = Array.from({ length: 30 }, (_, index) => {
    const id = `catalog-e2e-${String(index).padStart(2, "0")}`;
    return {
      id,
      name: `Movimiento E2E ${String(index).padStart(2, "0")}`,
      image_male: `images/${id}-male.webp`,
      image_female: `images/${id}-female.webp`,
      muscle_group: "Espalda",
      secondary_muscles: ["Bíceps"],
      equipment: "Mancuernas",
      difficulty: "Principiante",
      instructions: `Instrucciones E2E ${index}`,
    };
  });
  entries.push({ ...exerciseFixture[0], name });
  const generated = createExerciseCatalogArtifacts("/fixture/ejercicios", entries);
  return Object.fromEntries(generated.artifacts.map((artifact) => [
    artifact.path.split("/catalog-v1/")[1],
    artifact.contents,
  ]));
}

const duplicateProductFixture = [{
  ...foodFixture[0],
  id: "pera-catalogo-producto-e2e",
  image: "Pera-Catalogo-Producto-E2E.webp",
}];

function log(message) {
  console.log(`[catalogs-e2e] ${message}`);
}

function seedStore(agentEnabled = false) {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    measurements: [],
    threads: [{ id: "thread_catalogs_e2e", title: "Catálogos E2E" }],
    messagesByThread: { thread_catalogs_e2e: [] },
    keys: [
      { provider: "openai", is_active: agentEnabled, api_key: agentEnabled ? "e2e-local-fake-key" : "", model: "gpt-5.6-luna" },
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
  const exerciseImageFixture = readFileSync(join(repositoryRoot, "ejercicios", "images", "flexion-unilateral-male.webp"));
  await page.route("**/dev-store", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "{}",
  }));
  await page.route("https://api.github.com/**", (route) => route.fulfill({ status: 503 }));
  await page.route("https://raw.githubusercontent.com/**", async (route) => {
    if (networkState.offline) {
      return route.fulfill({ status: 503, body: "offline fixture" });
    }

    const pathname = new URL(route.request().url()).pathname;
    if (networkState.failProducts && pathname.endsWith("/productos_comerciales/all.json")) {
      return route.fulfill({ status: 503, body: "products unavailable fixture" });
    }
    if (pathname.endsWith("/alimentos/all.json")) {
      if (networkState.foodGate) await networkState.foodGate;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(foodFixture) });
    }
    if (pathname.includes("/ejercicios/catalog-v1/")) {
      const relativePath = pathname.split("/ejercicios/catalog-v1/")[1];
      const artifact = exerciseCatalogFixture(networkState.exerciseName)[relativePath];
      return artifact
        ? route.fulfill({ status: 200, contentType: "application/json", body: artifact })
        : route.fulfill({ status: 404, body: "missing exercise catalog fixture" });
    }
    if (pathname.endsWith("/productos_comerciales/all.json")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(networkState.duplicateFood ? duplicateProductFixture : []),
      });
    }
    if (pathname.endsWith("/recetas/all.json")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (pathname.endsWith(".webp")) {
      if (pathname.includes("/alimentos/ciqual/")) {
        const file = ciqualImageFiles.get(pathname);
        return file
          ? route.fulfill({ status: 200, contentType: "image/webp", body: readFileSync(file) })
          : route.fulfill({ status: 404, body: "Imagen CIQUAL sin registrar" });
      }
      return route.fulfill({
        status: 200,
        contentType: "image/webp",
        body: pathname.includes("/ejercicios/") ? exerciseImageFixture : imageFixture,
      });
    }
    return route.fulfill({ status: 200, contentType: "text/plain", body: "Fixture local de catálogos." });
  });
}

async function preparePage(context, networkState, initialStorage = {}, agentEnabled = false) {
  const page = await context.newPage();
  page.on("pageerror", (error) => log(`Error de página: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") log(`Consola: ${message.text()}`);
  });
  await page.addInitScript(({ key, store, seededStorage }) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(store));
    }
    if (!sessionStorage.getItem("catalog-fixture-seeded")) {
      for (const [storageKey, value] of Object.entries(seededStorage)) localStorage.setItem(storageKey, value);
      sessionStorage.setItem("catalog-fixture-seeded", "1");
    }
  }, { key: storageKey, store: seedStore(agentEnabled), seededStorage: initialStorage });
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

async function openExerciseConsumer(page, routineName, exerciseName = fixtureExerciseName) {
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
  const search = page.getByTestId("exercise-catalog-search");
  await search.waitFor({ state: "visible" });
  await search.fill(exerciseName);
}

async function expectExerciseConsumer(page, routineName, expected, exerciseName = fixtureExerciseName) {
  await openExerciseConsumer(page, routineName, exerciseName);
  const result = page.getByText(exerciseName, { exact: true });
  if (expected) {
    await result.last().waitFor({ state: "visible" });
  } else {
    assert.equal(await result.count(), 0);
  }
}

async function expectCaches(page, expected, exerciseName = fixtureExerciseName) {
  try {
    await page.waitForFunction(
      ({ foodKey, exerciseKey, hasEntries, expectedExerciseName }) => {
        const foods = JSON.parse(localStorage.getItem(foodKey) ?? "null")?.data ?? [];
        const exerciseCatalog = JSON.parse(localStorage.getItem(exerciseKey) ?? "null");
        return hasEntries
          ? foods.some((entry) => entry.name === "Pera Catálogo E2E")
            && exerciseCatalog?.active?.manifest?.itemCount > 0
          : foods.length === 0 && exerciseCatalog === null;
      },
      { foodKey: foodsCacheKey, exerciseKey: exerciseCatalogCacheKey, hasEntries: expected, expectedExerciseName: exerciseName },
    );
  } catch (error) {
    log(`Caché observada: ${JSON.stringify(await page.evaluate(() => ({ ...localStorage })))}`);
    throw error;
  }
}

function openAIToolCallSse(responseId, callId, name, argumentsJson = "{}") {
  const itemId = `fc_${callId}`;
  return [
    `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: { id: responseId } })}`,
    `event: response.output_item.added\ndata: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: itemId, call_id: callId, name, arguments: "", status: "in_progress" } })}`,
    `event: response.function_call_arguments.done\ndata: ${JSON.stringify({ type: "response.function_call_arguments.done", item_id: itemId, output_index: 0, arguments: argumentsJson })}`,
    `event: response.output_item.done\ndata: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: { type: "function_call", id: itemId, call_id: callId, name, arguments: argumentsJson, status: "completed" } })}`,
    `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: responseId, output: [{ type: "function_call", id: itemId, call_id: callId, name, arguments: argumentsJson, status: "completed" }] } })}`,
    "data: [DONE]",
    "",
  ].join("\n\n");
}

function openAIFinalSse(text = "Catálogos consultados.") {
  return [
    `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: { id: "resp_catalog_final" } })}`,
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", item_id: "msg_catalog_final", output_index: 0, content_index: 0, delta: text })}`,
    `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: "resp_catalog_final", output: [{ type: "message", id: "msg_catalog_final", content: [{ type: "output_text", text }] }] } })}`,
    "data: [DONE]",
    "",
  ].join("\n\n");
}

async function expectProviderCatalogTools(page, expectedFoodAvailability, expectedExerciseAvailability = expectedFoodAvailability) {
  const requests = [];
  const routineArguments = JSON.stringify({
    data: {
      name: "Rutina agente paginada",
      category: "strength",
      icon: "activity",
      exercises: [{
        kind: "catalog",
        source_id: "gymnasia_exercises",
        item_id: "sentadilla-catalogo-e2e",
        series: [{ type: "normal", reps: 8, weight_kg: 40, rest_seconds: 90 }],
      }],
    },
  });
  await page.route("**/v1/responses*", async (route) => {
    requests.push(route.request().postDataJSON());
    const body = requests.length === 1
      ? openAIToolCallSse("resp_catalog_foods", "call_catalog_foods", "search_foods")
      : requests.length === 2
        ? openAIToolCallSse("resp_catalog_exercises", "call_catalog_exercises", "search_exercises", JSON.stringify({ query: fixtureExerciseName }))
        : requests.length === 3
          ? openAIToolCallSse("resp_catalog_routine", "call_catalog_routine", "create_routine", routineArguments)
          : openAIFinalSse();
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
      body,
    });
  });
  await page.getByTestId("nav-tab-chat").click();
  await page.getByTestId("chat-input").fill("Consulta ambos catálogos");
  await page.getByTestId("chat-send").click();
  await page.getByText("Catálogos consultados.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(requests.length, 4);
  for (const [requestIndex, expectedSource, expectedAvailability] of [
    [1, "gymnasia_foods", expectedFoodAvailability],
    [2, "gymnasia_exercises", expectedExerciseAvailability],
  ]) {
    const expectedCallId = requestIndex === 1 ? "call_catalog_foods" : "call_catalog_exercises";
    const output = requests[requestIndex].input?.find(
      (item) => item.type === "function_call_output" && item.call_id === expectedCallId,
    )?.output;
    assert.equal(typeof output, "string");
    const parsed = JSON.parse(output);
    assert.equal(parsed.availability, expectedAvailability);
    assert.equal(parsed.sources.some((source) => source.source_id === expectedSource), true);
    assert.equal(parsed.results.every((result) => result.source_id && result.item_id), true);
  }
  const routineOutput = requests[3].input?.find(
    (item) => item.type === "function_call_output" && item.call_id === "call_catalog_routine",
  )?.output;
  assert.equal(typeof routineOutput, "string");
  const expectedRoutineStatus = expectedExerciseAvailability === "unavailable" ? "invalid_input" : "created";
  assert.equal(JSON.parse(routineOutput).status, expectedRoutineStatus);
  if (expectedRoutineStatus === "created") {
    await page.waitForFunction((key) => (
      JSON.parse(localStorage.getItem(key) ?? "{}").templates?.some(
        (template) => template.name === "Rutina agente paginada"
          && template.exercises?.[0]?.catalog_link?.ref?.itemId === "sentadilla-catalogo-e2e",
      )
    ), storageKey);
  }
  await page.unroute("**/v1/responses*");
}

async function expectCiqualOffline(page) {
  log("Verificando CIQUAL en Ajustes y Dieta sin red ni caché previa");
  await page.getByTestId("nav-tab-settings").click();
  await page.getByTestId("settings-tab-foods").click();
  await page.getByTestId("ciqual-attribution").waitFor({ state: "visible" });
  await page.getByTestId("food-catalog-load-more").waitFor({ state: "visible" });
  assert.equal(await page.getByTestId(/^food-catalog-row-/).count(), 30);
  await page.getByTestId("food-catalog-load-more").click();
  assert.equal(await page.getByTestId(/^food-catalog-row-/).count(), 60);
  // La búsqueda se aplica al catálogo completo, no solo a las 30 filas visibles.
  await page.locator('input[placeholder="Buscar alimento..."]').fill(ciqualIncomplete.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  await page.getByText(ciqualIncomplete.name, { exact: true }).click();
  const detail = page.getByTestId("shell-layer-settings-food-detail");
  await detail.getByText("No disponible", { exact: true }).first().waitFor({ state: "visible" });
  assert.equal(await detail.getByText("Ración típica", { exact: true }).count(), 0);
  await detail.getByText(/Original francés:/).waitFor({ state: "visible" });
  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, "ciqual-detail-390.png"), fullPage: true });
    await page.setViewportSize({ width: 960, height: 900 });
    await page.screenshot({ path: join(screenshotDir, "ciqual-detail-960.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.getByTestId("nav-tab-diet").click();
  const search = page.locator('input[placeholder="Buscar alimento..."]').first();
  await search.fill(ciqualRice.name);
  await page.getByText(ciqualRice.name, { exact: true }).click();
  await page.getByTestId("selected-food-grams-input").fill("150");
  await page.getByTestId("save-selected-food").click();
  await page.waitForFunction((key) => Object.values(JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate ?? {}).some((day) => day.meals.some((meal) => meal.items.some((item) => item.catalog_link?.ref?.sourceId === "anses_ciqual_2025" && item.catalog_link.ref.itemId === "ciqual-9100" && item.calories_kcal === 525))), storageKey);
  await search.fill(ciqualIncomplete.name);
  await page.getByText(ciqualIncomplete.name, { exact: true }).click();
  assert.equal(await page.getByTestId("manual-food-fat_g-input").inputValue(), "");
  await page.getByTestId("save-manual-food").click();
  await page.getByTestId("manual-food-fat_g-error").waitFor({ state: "visible" });
  const items = await page.evaluate((key) => Object.values(JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate ?? {}).flatMap((day) => day.meals.flatMap((meal) => meal.items)), storageKey);
  assert.equal(items.some((item) => item.title === ciqualIncomplete.name), false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("nav-tab-diet").click();
  await page.getByText(ciqualRice.name, { exact: true }).waitFor({ state: "visible" });

  log("Verificando tools CIQUAL con proveedor falso, selección por ID y rechazo de desconocidos");
  const requests = [];
  await page.route("**/v1/responses*", async (route) => {
    requests.push(route.request().postDataJSON());
    const number = requests.length;
    const body = number === 1
      ? openAIToolCallSse("resp_ciqual_search", "call_ciqual_search", "search_foods", JSON.stringify({ query: ciqualRice.name, source: "anses_ciqual_2025" }))
      : number === 2 || number === 3
        ? openAIToolCallSse(`resp_ciqual_add_${number}`, `call_ciqual_add_${number}`, "add_meal_food", JSON.stringify({ date: "2026-10-29", meal: "Comida", data: JSON.stringify({ kind: "catalog", source_id: "anses_ciqual_2025", item_id: number === 2 ? ciqualRice.id : ciqualIncomplete.id, grams: 150 }) }))
        : openAIFinalSse("CIQUAL consultado.");
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
  });
  await page.getByTestId("nav-tab-chat").click();
  await page.getByTestId("chat-input").fill("Consulta CIQUAL y registra arroz con la referencia indicada");
  await page.getByTestId("chat-send").click();
  await page.getByText("CIQUAL consultado.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(requests.length, 4);
  const output = (index, callId) => JSON.parse(requests[index].input.find((item) => item.type === "function_call_output" && item.call_id === callId).output);
  assert.equal(output(1, "call_ciqual_search").results[0].source_id, "anses_ciqual_2025");
  assert.equal(output(3, "call_ciqual_add_3").error, "incomplete_nutrition");
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.["2026-10-29"]?.meals.some((meal) => meal.items.some((item) => item.catalog_link?.ref?.sourceId === "anses_ciqual_2025" && item.calories_kcal === 525)), storageKey);
  await page.unroute("**/v1/responses*");
}

async function expectCoachMealCorrection() {
  log("Verificando que Coach corrige los gramos de un alimento sin duplicarlo");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await preparePage(context, { offline: true }, {}, true);
    await openApp(page);
    const today = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    const requests = [];
    const toolOutput = (request, callId) => {
      const item = request.input.find((entry) => entry.type === "function_call_output" && entry.call_id === callId);
      return item ? JSON.parse(item.output) : null;
    };
    await page.route("**/v1/responses*", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const number = requests.length;
      let body;
      if (number === 1) {
        body = openAIToolCallSse("resp_fix_add", "call_fix_add", "add_meal_food", JSON.stringify({ date: today, meal: "Cena", data: JSON.stringify({ kind: "catalog", source_id: "anses_ciqual_2025", item_id: ciqualRice.id, grams: 150 }) }));
      } else if (number === 2) {
        body = openAIFinalSse("Arroz apuntado.");
      } else if (number === 3) {
        body = openAIToolCallSse("resp_fix_read", "call_fix_read", "read_meal_foods", JSON.stringify({ date: today, meal: "Cena" }));
      } else if (number === 4) {
        const foods = toolOutput(request, "call_fix_read");
        assert.equal(foods.length, 1);
        body = openAIToolCallSse("resp_fix_update", "call_fix_update", "update_meal_food", JSON.stringify({ date: today, meal: "Cena", entry_id: foods[0].entrada_id, grams: 100 }));
      } else {
        body = openAIFinalSse("Corregido a 100 g.");
      }
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
    });
    await page.getByTestId("nav-tab-chat").click();
    await page.getByTestId("chat-input").fill("Apunta 150 g de arroz en la cena");
    await page.getByTestId("chat-send").click();
    await page.getByText("Arroz apuntado.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByTestId("chat-input").fill("Me he equivocado, eran 100 gramos");
    await page.getByTestId("chat-send").click();
    await page.getByText("Corregido a 100 g.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(requests.length, 5);
    assert.equal(toolOutput(requests[4], "call_fix_update").status, "updated");
    await page.waitForFunction(({ key, date }) => {
      const items = (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals ?? [])
        .filter((meal) => meal.title === "Cena")
        .flatMap((meal) => meal.items);
      return items.length === 1 && items[0].grams === 100;
    }, { key: storageKey, date: today });
    await page.unroute("**/v1/responses*");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-diet").click();
    const rows = page.getByTestId(/^diet-item-row-/).filter({ hasText: ciqualRice.name });
    await rows.first().waitFor({ state: "visible" });
    assert.equal(await rows.count(), 1);
    await rows.first().getByText(/^100 g · /).waitFor({ state: "visible" });
    await rows.first().getByText("350 kcal", { exact: true }).waitFor({ state: "visible" });
    const persisted = await page.evaluate(({ key, date }) => (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals ?? []).flatMap((meal) => meal.items.map((item) => [meal.title, item.grams, item.calories_kcal])), { key: storageKey, date: today });
    assert.deepEqual(persisted, [["Cena", 100, 350]]);

    log("Verificando que la pantalla edita y borra con la misma lógica compartida");
    const readMeals = () => page.evaluate(({ key, date }) => (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals ?? []).map((meal) => [meal.title, meal.items.map((item) => [item.grams, item.calories_kcal])]), { key: storageKey, date: today });
    await rows.first().locator('[tabindex="0"]').last().click();
    await page.getByText("Editar a mano", { exact: true }).click();
    await page.getByTestId("manual-food-grams-input").fill("80");
    await page.getByTestId("save-manual-food").click();
    await page.waitForFunction(({ key, date }) => JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals?.[0]?.items?.[0]?.grams === 80, { key: storageKey, date: today });
    assert.deepEqual(await readMeals(), [["Cena", [[80, 280]]]]);
    await rows.first().locator('[tabindex="0"]').last().click();
    await page.getByText("Eliminar", { exact: true }).click();
    await page.waitForFunction(({ key, date }) => (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals ?? []).length === 0, { key: storageKey, date: today });
    assert.equal(await rows.count(), 0);
  } finally {
    await context.close();
  }
}

async function expectCoachWholeMeal() {
  log("Verificando que Coach apunta, copia y vacía una comida entera");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await preparePage(context, { offline: true }, {}, true);
    await openApp(page);
    const [today, yesterday] = await page.evaluate(() => {
      const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const now = new Date();
      const before = new Date(now);
      before.setDate(now.getDate() - 1);
      return [iso(now), iso(before)];
    });
    const requests = [];
    const toolOutput = (request, callId) => {
      const item = request.input.find((entry) => entry.type === "function_call_output" && entry.call_id === callId);
      return item ? JSON.parse(item.output) : null;
    };
    const rice = (grams) => ({ kind: "catalog", source_id: "anses_ciqual_2025", item_id: ciqualRice.id, grams });
    await page.route("**/v1/responses*", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const number = requests.length;
      let body;
      if (number === 1) {
        body = openAIToolCallSse("resp_whole_add", "call_whole_add", "add_meal_foods", JSON.stringify({ date: yesterday, meal: "Cena", foods: [rice(150), rice(50)] }));
      } else if (number === 2) {
        body = openAIFinalSse("Cena de ayer apuntada.");
      } else if (number === 3) {
        body = openAIToolCallSse("resp_whole_copy", "call_whole_copy", "copy_meal", JSON.stringify({ from_date: yesterday, from_meal: "Cena", to_date: today, to_meal: "Cena", mode: "copy" }));
      } else if (number === 4) {
        body = openAIFinalSse("Cena copiada a hoy.");
      } else if (number === 5) {
        body = openAIToolCallSse("resp_whole_clear", "call_whole_clear", "clear_meal", JSON.stringify({ date: yesterday, meal: "Cena" }));
      } else {
        body = openAIFinalSse("Cena de ayer vaciada.");
      }
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
    });
    await page.getByTestId("nav-tab-chat").click();
    for (const [message, reply] of [
      ["Ayer cené 150 g de arroz y otros 50 g de arroz", "Cena de ayer apuntada."],
      ["Hoy he cenado lo mismo que ayer", "Cena copiada a hoy."],
      ["Borra todo lo de la cena de ayer", "Cena de ayer vaciada."],
    ]) {
      await page.getByTestId("chat-input").fill(message);
      await page.getByTestId("chat-send").click();
      await page.getByText(reply, { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    }
    assert.equal(requests.length, 6);
    assert.equal(toolOutput(requests[1], "call_whole_add").status, "added");
    const copied = toolOutput(requests[3], "call_whole_copy");
    assert.equal(copied.status, "copied");
    assert.deepEqual(copied.sustituidos, []);
    assert.equal(toolOutput(requests[5], "call_whole_clear").quitados.length, 2);

    const readDay = (date) => page.evaluate(({ key, day }) => (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[day]?.meals ?? []).map((meal) => [meal.title, meal.items.map((item) => [item.grams, item.calories_kcal])]), { key: storageKey, day: date });
    await page.waitForFunction(({ key, date }) => (JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate?.[date]?.meals ?? []).length === 0, { key: storageKey, date: yesterday });
    await page.unroute("**/v1/responses*");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-diet").click();
    const rows = page.getByTestId(/^diet-item-row-/).filter({ hasText: ciqualRice.name });
    await rows.first().waitFor({ state: "visible" });
    assert.equal(await rows.count(), 2);
    await page.getByText("525 kcal", { exact: true }).first().waitFor({ state: "visible" });
    await page.getByText("175 kcal", { exact: true }).first().waitFor({ state: "visible" });
    assert.deepEqual(await readDay(today), [["Cena", [[150, 525], [50, 175]]]]);
    assert.deepEqual(await readDay(yesterday), []);
  } finally {
    await context.close();
  }
}

async function expectCoachMeasurementDeletion() {
  log("Verificando que Coach borra la medición entera de un día y no vuelve al recargar");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await preparePage(context, { offline: true }, {}, true);
    await openApp(page);
    const today = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    const requests = [];
    const toolOutput = (request, callId) => {
      const item = request.input.find((entry) => entry.type === "function_call_output" && entry.call_id === callId);
      return item ? JSON.parse(item.output) : null;
    };
    await page.route("**/v1/responses*", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const number = requests.length;
      let body;
      if (number === 1) {
        body = openAIToolCallSse("resp_measure_write", "call_measure_write", "write_measurement", JSON.stringify({ date: today, data: { weight_kg: 74.5 } }));
      } else if (number === 2) {
        body = openAIFinalSse("Peso apuntado.");
      } else if (number === 3) {
        body = openAIToolCallSse("resp_measure_delete", "call_measure_delete", "delete_measurement", JSON.stringify({ date: today }));
      } else {
        body = openAIFinalSse("Medición borrada.");
      }
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
    });
    const readMeasurements = () => page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").measurements ?? []).map((item) => [item.id, item.measured_on, item.weight_kg]), storageKey);
    await page.getByTestId("nav-tab-chat").click();
    await page.getByTestId("chat-input").fill("Apunta que hoy peso 74,5 kg");
    await page.getByTestId("chat-send").click();
    await page.getByText("Peso apuntado.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").measurements ?? []).length === 1, storageKey);
    const [[measurementId]] = await readMeasurements();
    await page.getByTestId("chat-input").fill("Borra la medición de hoy, no era mía");
    await page.getByTestId("chat-send").click();
    await page.getByText("Medición borrada.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(requests.length, 4);
    assert.deepEqual(toolOutput(requests[3], "call_measure_delete"), {
      status: "deleted",
      written: true,
      fecha: today,
      medidas_borradas: { weight_kg: 74.5, body_fat_pct: null, neck_cm: null, chest_cm: null, waist_cm: null, hips_cm: null, biceps_cm: null, quadriceps_cm: null, calf_cm: null, height_cm: null },
      tenia_foto: false,
    });
    await page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").measurements ?? []).length === 0, storageKey);
    await page.unroute("**/v1/responses*");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-measures").click();
    await page.getByTestId("measurement-add").waitFor({ state: "visible" });
    assert.equal(await page.getByTestId(`measurement-history-${measurementId}`).count(), 0);
    assert.deepEqual(await readMeasurements(), []);
    const receipts = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").toolOperationReceipts ?? []).map((receipt) => receipt.toolName), storageKey);
    assert(receipts.includes("delete_measurement"), "El borrado debe dejar recibo de idempotencia.");
  } finally {
    await context.close();
  }
}

async function expectCoachRoutineEditing() {
  log("Verificando que Coach renombra y borra una rutina sin perder el historial");
  const routineId = "template_e2e_pierna";
  const otherId = "template_e2e_torso";
  const exercise = (id) => ({
    id,
    name: "Sentadilla",
    muscle: "Cuádriceps",
    image_uri: null,
    sets: [],
    series: [{ id: `${id}_s1`, type: "normal", reps: "8", weight_kg: "60", rest_seconds: "90" }],
    catalog_link: { schemaVersion: 1, status: "unresolved", reason: "manual" },
  });
  const template = (id, name) => ({ id, name, category: "strength", icon: "activity", duration_minutes: "45", exercises: [exercise(`${id}_ex1`)] });
  const historyEntry = {
    id: "session_e2e_pierna",
    template_id: routineId,
    template_name: "Pierna",
    finished_at: new Date(Date.now() - 86_400_000).toISOString(),
    elapsed_seconds: 2400,
    completion_status: "completed",
    summary_schema_version: 1,
    calculation_version: 1,
    can_recalculate: false,
    prescription_snapshot: null,
    completed_effort_count: 1,
    total_effort_count: 1,
    effort_breakdown: null,
    estimated_calories: 120,
    total_volume_kg: 480,
    total_reps: 8,
  };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const seeded = { ...seedStore(true), templates: [template(routineId, "Pierna"), template(otherId, "Torso")], workoutHistory: [historyEntry] };
    const page = await preparePage(context, { offline: true }, { [storageKey]: JSON.stringify(seeded) }, true);
    await openApp(page);
    const requests = [];
    const toolOutput = (request, callId) => {
      const item = request.input.find((entry) => entry.type === "function_call_output" && entry.call_id === callId);
      return item ? JSON.parse(item.output) : null;
    };
    await page.route("**/v1/responses*", async (route) => {
      requests.push(route.request().postDataJSON());
      const number = requests.length;
      let body;
      if (number === 1) {
        body = openAIToolCallSse("resp_routine_read", "call_routine_read", "read_routines");
      } else if (number === 2) {
        body = openAIToolCallSse("resp_routine_update", "call_routine_update", "update_routine", JSON.stringify({ routine_id: routineId, data: { name: "Pierna A" } }));
      } else if (number === 3) {
        body = openAIFinalSse("Rutina renombrada.");
      } else if (number === 4) {
        body = openAIToolCallSse("resp_routine_delete", "call_routine_delete", "delete_routine", JSON.stringify({ routine_id: routineId }));
      } else {
        body = openAIFinalSse("Rutina borrada.");
      }
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
    });
    const readTemplates = () => page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").templates ?? []).map((item) => [item.id, item.name, item.exercises.length]), storageKey);
    await page.getByTestId("nav-tab-chat").click();
    await page.getByTestId("chat-input").fill("Cámbiale el nombre a la rutina de pierna por Pierna A");
    await page.getByTestId("chat-send").click();
    await page.getByText("Rutina renombrada.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const routines = toolOutput(requests[1], "call_routine_read");
    assert.deepEqual(routines.map((item) => [item.id, item.nombre, item.icono]), [[routineId, "Pierna", "activity"], [otherId, "Torso", "activity"]]);
    assert.deepEqual(toolOutput(requests[2], "call_routine_update"), {
      status: "updated",
      written: true,
      routine_id: routineId,
      antes: { nombre: "Pierna", categoria: "strength", icono: "activity", duracion_minutos: "45" },
      despues: { nombre: "Pierna A", categoria: "strength", icono: "activity", duracion_minutos: "45" },
      ejercicios: 1,
    });
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "{}").templates?.[0]?.name === "Pierna A", storageKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-training").click();
    await page.getByTestId(`training-template-open-${routineId}`).getByText("Pierna A", { exact: true }).waitFor({ state: "visible" });
    assert.deepEqual(await readTemplates(), [[routineId, "Pierna A", 1], [otherId, "Torso", 1]]);

    await page.getByTestId("nav-tab-chat").click();
    await page.getByTestId("chat-input").fill("Borra la rutina Pierna A");
    await page.getByTestId("chat-send").click();
    await page.getByText("Rutina borrada.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(requests.length, 5);
    assert.deepEqual(toolOutput(requests[4], "call_routine_delete"), {
      status: "deleted",
      written: true,
      routine_id: routineId,
      nombre: "Pierna A",
      ejercicios: 1,
      historial_conservado: true,
    });
    await page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").templates ?? []).length === 1, storageKey);
    await page.unroute("**/v1/responses*");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-training").click();
    await page.getByTestId(`training-template-open-${otherId}`).waitFor({ state: "visible" });
    assert.equal(await page.getByTestId(`training-template-open-${routineId}`).count(), 0);
    assert.deepEqual(await readTemplates(), [[otherId, "Torso", 1]]);
    const history = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").workoutHistory ?? []).map((item) => [item.id, item.template_name]), storageKey);
    assert.deepEqual(history, [["session_e2e_pierna", "Pierna"]]);
    const receipts = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").toolOperationReceipts ?? []).map((receipt) => receipt.toolName), storageKey);
    assert(receipts.includes("update_routine") && receipts.includes("delete_routine"), "Editar y borrar deben dejar recibo de idempotencia.");
  } finally {
    await context.close();
  }
}

async function expectCoachRoutineExerciseEditing() {
  log("Verificando que Coach añade un ejercicio a una rutina existente y le cambia el peso");
  const routineId = "template_e2e_espalda";
  const exercise = (id, name, weight) => ({
    id,
    name,
    muscle: "Espalda",
    image_uri: null,
    sets: [],
    series: [
      { id: `${id}_s1`, type: "normal", reps: "10", weight_kg: weight, rest_seconds: "90" },
      { id: `${id}_s2`, type: "normal", reps: "10", weight_kg: weight, rest_seconds: "90" },
    ],
    catalog_link: { schemaVersion: 1, status: "unresolved", reason: "manual" },
  });
  const template = {
    id: routineId,
    name: "Espalda",
    category: "strength",
    icon: "activity",
    exercises: [exercise("exercise_e2e_remo", "Remo", "50"), exercise("exercise_e2e_jalon", "Jalón", "45")],
  };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const seeded = { ...seedStore(true), templates: [template] };
    const page = await preparePage(context, { offline: true }, { [storageKey]: JSON.stringify(seeded) }, true);
    await openApp(page);
    const requests = [];
    const toolOutput = (request, callId) => {
      const item = request.input.find((entry) => entry.type === "function_call_output" && entry.call_id === callId);
      return item ? JSON.parse(item.output) : null;
    };
    await page.route("**/v1/responses*", async (route) => {
      requests.push(route.request().postDataJSON());
      const number = requests.length;
      let body;
      if (number === 1) {
        body = openAIToolCallSse("resp_rex_read", "call_rex_read", "read_routines");
      } else if (number === 2) {
        body = openAIToolCallSse("resp_rex_add", "call_rex_add", "add_routine_exercise", JSON.stringify({
          routine_id: routineId,
          exercise: { kind: "custom", name: "Dominadas", muscle: "Espalda", series: [1, 2, 3].map(() => ({ type: "normal", reps: 8 })) },
        }));
      } else if (number === 3) {
        body = openAIFinalSse("Ejercicio añadido.");
      } else if (number === 4) {
        const added = toolOutput(requests[2], "call_rex_add").despues.ejercicio_id;
        body = openAIToolCallSse("resp_rex_update", "call_rex_update", "update_routine_exercise", JSON.stringify({
          routine_id: routineId,
          exercise_id: added,
          all_series: { weight_kg: 10 },
        }));
      } else {
        body = openAIFinalSse("Peso cambiado.");
      }
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }, body });
    });
    const readExercises = () => page.evaluate((key) => (
      (JSON.parse(localStorage.getItem(key) ?? "{}").templates ?? [])[0]?.exercises ?? []
    ).map((item) => [item.name, item.series.map((series) => `${series.reps}x${series.weight_kg}`)]), storageKey);

    await page.getByTestId("nav-tab-chat").click();
    await page.getByTestId("chat-input").fill("Añade dominadas a la rutina de espalda, 3x8");
    await page.getByTestId("chat-send").click();
    await page.getByText("Ejercicio añadido.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const routines = toolOutput(requests[1], "call_rex_read");
    assert.deepEqual(
      routines[0].ejercicios.map((item) => [item.ejercicio_id, item.series.map((series) => series.serie_id)]),
      [
        ["exercise_e2e_remo", ["exercise_e2e_remo_s1", "exercise_e2e_remo_s2"]],
        ["exercise_e2e_jalon", ["exercise_e2e_jalon_s1", "exercise_e2e_jalon_s2"]],
      ],
    );
    const addResult = toolOutput(requests[2], "call_rex_add");
    assert.equal(addResult.status, "updated");
    assert.deepEqual(addResult.orden, ["Remo", "Jalón", "Dominadas"]);
    assert.equal(addResult.despues.posicion, 3);
    const addedId = addResult.despues.ejercicio_id;
    await page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").templates?.[0]?.exercises ?? []).length === 3, storageKey);

    await page.getByTestId("chat-input").fill("Ponle 10 kilos a las dominadas");
    await page.getByTestId("chat-send").click();
    await page.getByText("Peso cambiado.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(requests.length, 5);
    const updateResult = toolOutput(requests[4], "call_rex_update");
    assert.equal(updateResult.status, "updated");
    assert.deepEqual(updateResult.despues.series.map((series) => series.peso_kg), ["10", "10", "10"]);
    await page.waitForFunction((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").templates?.[0]?.exercises?.[2]?.series ?? [])
      .every((series) => series.weight_kg === "10"), storageKey);

    await page.unroute("**/v1/responses*");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-training").click();
    await page.getByTestId(`training-template-open-${routineId}`).click();
    // La ficha de la rutina enseña el ejercicio nuevo con el peso cambiado…
    await page.getByText("Dominadas", { exact: true }).first().waitFor({ state: "visible" });
    await page.getByText("10 kg", { exact: true }).first().waitFor({ state: "visible" });
    // …y el editor lo abre como un ejercicio más, con su propio menú.
    await page.getByTestId("training-detail-edit").click();
    await page.getByTestId(`training-exercise-menu-${addedId}`).waitFor({ state: "visible" });
    assert.deepEqual(await readExercises(), [
      ["Remo", ["10x50", "10x50"]],
      ["Jalón", ["10x45", "10x45"]],
      ["Dominadas", ["8x10", "8x10", "8x10"]],
    ]);
    const receipts = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? "{}").toolOperationReceipts ?? []).map((receipt) => receipt.toolName), storageKey);
    assert(
      receipts.includes("add_routine_exercise") && receipts.includes("update_routine_exercise"),
      "Añadir y editar un ejercicio deben dejar recibo de idempotencia.",
    );
  } finally {
    await context.close();
  }
}

async function expectCiqualImages() {
  log("Verificando imágenes reales de CIQUAL en catálogo, búsqueda, dieta e historial");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const networkState = { offline: false };
  const page = await preparePage(context, networkState);
  const expectImage = async (scope, food) => {
    const image = scope.locator("img").filter({ visible: true }).first();
    await image.waitFor({ state: "visible" });
    await page.waitForFunction(({ url }) => Array.from(document.images).some((image) => image.src === url && image.complete && image.naturalWidth === 1024), { url: ciqualImageUrl(food) });
    assert.equal(await image.getAttribute("src"), ciqualImageUrl(food));
    assert.equal(await image.evaluate((image) => image.naturalWidth), 1024);
  };
  try {
    await openApp(page);
    await page.getByTestId("nav-tab-settings").click();
    await page.getByTestId("settings-tab-foods").click();
    const catalogSearch = page.locator('input[placeholder="Buscar alimento..."]');
    await catalogSearch.fill(ciqualLatest.name);
    await expectImage(page.getByTestId(`food-catalog-row-anses_ciqual_2025-${ciqualLatest.id}`), ciqualLatest);
    await catalogSearch.fill(ciqualRice.name);
    const row = page.getByTestId(`food-catalog-row-anses_ciqual_2025-${ciqualRice.id}`);
    await expectImage(row, ciqualRice);
    await row.click();
    const detail = page.getByTestId("shell-layer-settings-food-detail");
    await expectImage(detail, ciqualRice);
    await detail.getByText(/Imágenes ilustrativas generadas por IA/).waitFor({ state: "visible" });
    if (screenshotDir) {
      await page.screenshot({ path: join(screenshotDir, "ciqual-images-catalog-390.png"), fullPage: true });
      await page.setViewportSize({ width: 960, height: 900 });
      await page.screenshot({ path: join(screenshotDir, "ciqual-images-catalog-960.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.getByTestId("nav-tab-diet").click();
    const search = page.locator('input[placeholder="Buscar alimento..."]').first();
    await search.fill(ciqualRice.name);
    const result = page.getByText(ciqualRice.name, { exact: true });
    await expectImage(result.locator("..").locator(".."), ciqualRice);
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "ciqual-images-search-390.png"), fullPage: true });
    await result.click();
    await page.getByTestId("selected-food-grams-input").fill("150");
    await page.getByTestId("save-selected-food").click();
    const mealRow = page.getByTestId(/^diet-item-row-/).filter({ hasText: ciqualRice.name });
    await expectImage(mealRow, ciqualRice);
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "ciqual-images-diet-390.png"), fullPage: true });
    const saved = await page.evaluate((key) => Object.values(JSON.parse(localStorage.getItem(key)).dietByDate).flatMap((day) => day.meals.flatMap((meal) => meal.items)), storageKey);
    assert.equal(saved[0].image_uri, ciqualImageUrl(ciqualRice));
    assert.equal(saved[0].calories_kcal, 525);

    // Simula una comida guardada antes de integrar las imágenes; conserva sus totales.
    await page.evaluate((key) => {
      const store = JSON.parse(localStorage.getItem(key));
      for (const day of Object.values(store.dietByDate)) for (const meal of day.meals) for (const item of meal.items) item.image_uri = null;
      localStorage.setItem(key, JSON.stringify(store));
    }, storageKey);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-diet").click();
    await expectImage(page.getByTestId(/^diet-item-row-/).filter({ hasText: ciqualRice.name }), ciqualRice);
    const restored = await page.evaluate((key) => Object.values(JSON.parse(localStorage.getItem(key)).dietByDate).flatMap((day) => day.meals.flatMap((meal) => meal.items)), storageKey);
    assert.deepEqual(restored, saved.map((item) => ({ ...item, image_uri: null })));

    log("Verificando sustitución de imágenes sin red y conservación de los datos");
    networkState.offline = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-tab-diet").click();
    const offlineMeal = page.getByTestId(/^diet-item-row-/).filter({ hasText: ciqualRice.name });
    await offlineMeal.waitFor({ state: "visible" });
    await page.waitForFunction(() => !Array.from(document.images).some((image) => image.src.includes("/alimentos/ciqual/")));
    await search.fill(ciqualRice.name);
    await page.getByText(ciqualRice.name, { exact: true }).last().click();
    await page.getByTestId("selected-food-grams-input").fill("100");
    await page.getByTestId("save-selected-food").click();
    await page.waitForFunction((key) => Object.values(JSON.parse(localStorage.getItem(key)).dietByDate).some((day) => day.meals.some((meal) => meal.items.length === 2)), storageKey);
  } finally {
    await context.close();
  }
}

exportDevelopmentBundle();
const server = await startServer();
const browser = await chromium.launch({ headless: process.env.CATALOG_E2E_HEADLESS !== "0" });

try {
  await expectCiqualImages();
  await expectCoachMealCorrection();
  await expectCoachWholeMeal();
  await expectCoachMeasurementDeletion();
  await expectCoachRoutineEditing();
  await expectCoachRoutineExerciseEditing();
  if (process.env.CATALOG_E2E_CIQUAL_ONLY === "1") {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await preparePage(context, { offline: true }, {}, true);
    await openApp(page);
    await expectFoodConsumer(page, false);
    await expectCiqualOffline(page);
    await context.close();
  } else {
  const networkState = { offline: false, exerciseName: fixtureExerciseName };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await preparePage(context, networkState, {}, true);

  log("Verificando descarga y consumo de agregados válidos");
  await openApp(page);
  await expectFoodConsumer(page, true);
  await page.getByText("Actualizado ahora", { exact: true }).first().waitFor({ state: "visible" });
  await expectProviderCatalogTools(page, "fresh");
  await expectCaches(page, true);
  await expectExerciseConsumer(page, "Rutina Catálogos E2E", true);
  const selectedCatalogRow = page.getByTestId("exercise-catalog-row-sentadilla-catalogo-e2e");
  await selectedCatalogRow.waitFor({ state: "visible" });
  await selectedCatalogRow.scrollIntoViewIfNeeded();
  await page.getByTestId("exercise-catalog-search").evaluate((element) => element.blur());
  if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "exercise-catalog-selector.png") });
  await selectedCatalogRow.click();
  await page.getByTestId("training-editor-save").click();
  await page.waitForFunction((key) => {
    const store = JSON.parse(localStorage.getItem(key) ?? "{}");
    return store.templates?.[0]?.exercises?.[0]?.catalog_link?.ref?.itemId === "sentadilla-catalogo-e2e";
  }, storageKey);

  log("Verificando scroll infinito y consulta reutilizada desde Ajustes");
  await page.getByTestId("nav-tab-settings").click();
  await page.getByTestId("settings-tab-training").click();
  const openCatalog = page.getByTestId("settings-open-exercise-catalog");
  await openCatalog.scrollIntoViewIfNeeded();
  await openCatalog.click();
  const catalogList = page.getByTestId("exercise-catalog-list");
  await catalogList.waitFor({ state: "visible" });
  await catalogList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.getByText(fixtureExerciseName, { exact: true }).last().waitFor({ state: "visible" });
  const catalogSearch = page.getByTestId("exercise-catalog-search");
  await catalogSearch.fill("movimiento");
  await catalogSearch.fill(fixtureExerciseName);
  await page.getByRole("button", { name: "Cuádriceps" }).click();
  await page.waitForTimeout(400);
  const settingsCatalogRow = page.getByTestId("exercise-catalog-row-sentadilla-catalogo-e2e");
  await settingsCatalogRow.waitFor({ state: "visible" });
  await settingsCatalogRow.scrollIntoViewIfNeeded();
  await catalogSearch.evaluate((element) => element.blur());
  await page.waitForTimeout(200);
  if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "exercise-catalog-settings.png") });
  await settingsCatalogRow.click();
  await page.getByText("Flexiona cadera y rodillas manteniendo el torso estable.", { exact: true }).waitFor({ state: "visible" });
  await page.getByTestId("exercise-detail-close").click();
  await page.getByLabel("Cerrar catálogo").click();

  log("Verificando que un cambio de nombre conserva el vínculo por ID");
  const renamedExercise = "Sentadilla Catálogo Renombrada";
  networkState.exerciseName = renamedExercise;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("nav-tab-diet").waitFor({ state: "visible" });
  await expectCaches(page, true, renamedExercise);
  await expectExerciseConsumer(page, "Rutina Catálogos E2E", true, renamedExercise);
  await page.getByTestId("exercise-catalog-row-sentadilla-catalogo-e2e").click();
  await page.waitForFunction(({ key, expectedName }) => {
    const exercise = JSON.parse(localStorage.getItem(key) ?? "{}").templates?.[0]?.exercises?.[0];
    return exercise?.name === expectedName
      && exercise?.catalog_link?.ref?.itemId === "sentadilla-catalogo-e2e";
  }, { key: storageKey, expectedName: renamedExercise });

  log("Verificando que la caché mantiene ambos consumidores sin red");
  networkState.offline = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("nav-tab-diet").waitFor({ state: "visible" });
  await expectCaches(page, true, renamedExercise);
  await expectFoodConsumer(page, true);
  await page.getByText(/Copia local/).first().waitFor({ state: "visible" });
  await expectProviderCatalogTools(page, "cached");
  await expectExerciseConsumer(page, "Rutina Catálogos E2E", true, renamedExercise);
  await context.close();

  log("Verificando búsqueda del agente cuando el catálogo termina de cargar durante el turno");
  let releaseFoodResponse;
  const foodGate = new Promise((resolve) => { releaseFoodResponse = resolve; });
  const lateContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const latePage = await preparePage(lateContext, { offline: false, foodGate }, {}, true);
  const lateRequests = [];
  await latePage.route("**/v1/responses*", async (route) => {
    lateRequests.push(route.request().postDataJSON());
    if (lateRequests.length === 1) {
      releaseFoodResponse();
      await expectFoodConsumer(latePage, true);
      await latePage.getByTestId("nav-tab-chat").click();
    }
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
      body: lateRequests.length === 1
        ? openAIToolCallSse("resp_late_food", "call_late_food", "search_foods", JSON.stringify({ query: fixtureFoodName }))
        : openAIFinalSse(),
    });
  });
  await openApp(latePage);
  await latePage.getByTestId("nav-tab-chat").click();
  await latePage.getByTestId("chat-input").fill(`Busca ${fixtureFoodName}`);
  await latePage.getByTestId("chat-send").click();
  await latePage.getByText("Catálogos consultados.", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const lateOutput = lateRequests[1].input?.find((item) => item.type === "function_call_output")?.output;
  assert.equal(typeof lateOutput, "string");
  const lateSearch = JSON.parse(lateOutput);
  assert.equal(lateSearch.availability, "fresh");
  assert.equal(lateSearch.results[0]?.nombre, fixtureFoodName);
  await lateContext.close();

  log("Verificando migración offline de todos los artefactos y retirada verificada de v2/v3");
  const migrationContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const oldArtifacts = exerciseCatalogFixture();
  const oldManifest = JSON.parse(oldArtifacts["manifest.json"]);
  const artifactPrefix = `${exerciseCatalogCacheKey}:artifact:`;
  const legacyV2Key = exercisesCacheKey.replace(".v3", ".v2");
  const largeStore = seedStore(false);
  const preservedMessage = "Historial personal sintético 🏋️ ".repeat(20_000);
  largeStore.messagesByThread.thread_catalogs_e2e.push({ id: "migration-history", role: "user",
    content: preservedMessage, created_at: "2026-09-01T10:00:00Z" });
  const oldStorage = {
    [storageKey]: JSON.stringify(largeStore),
    [exerciseCatalogCacheKey]: JSON.stringify({ schemaVersion: 4, active: { manifest: oldManifest, fetchedAt: new Date().toISOString() } }),
    [legacyV2Key]: JSON.stringify(exerciseFixture),
    [exercisesCacheKey]: JSON.stringify(exerciseFixture),
    ...Object.fromEntries(Object.entries(oldArtifacts).filter(([path]) => path !== "manifest.json")
      .map(([path, raw]) => [`${artifactPrefix}${oldManifest.catalogVersion}:${path}`, raw])),
  };
  const migratedPage = await preparePage(migrationContext, { offline: true }, oldStorage);
  await openApp(migratedPage);
  await migratedPage.waitForFunction(({ oldKeys, artifactPrefix }) => oldKeys.every((key) => localStorage.getItem(key) === null)
    && !Object.keys(localStorage).some((key) => key.startsWith(artifactPrefix)),
    { oldKeys: [legacyV2Key, exercisesCacheKey], artifactPrefix });
  await expectExerciseConsumer(migratedPage, "Rutina migrada offline", true);
  const storedArtifacts = await migratedPage.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("gymnasia.development:gymnasia_public_catalog_cache_v1", 1);
    request.onerror = () => reject(new Error("IndexedDB unavailable"));
    request.onsuccess = () => {
      const database = request.result;
      const tx = database.transaction("artifacts", "readonly");
      const read = tx.objectStore("artifacts").getAll();
      read.onsuccess = () => resolve(read.result);
      tx.oncomplete = () => database.close();
    };
  }));
  assert.ok(storedArtifacts.length >= Object.keys(oldArtifacts).length - 1);
  assert.ok(storedArtifacts.every((raw) => typeof raw === "string" && JSON.parse(raw).schemaVersion === 1));
  await migratedPage.reload({ waitUntil: "domcontentloaded" });
  await migratedPage.getByTestId("nav-tab-diet").waitFor({ state: "visible" });
  await expectExerciseConsumer(migratedPage, "Rutina migrada offline", true);
  assert.equal(await migratedPage.evaluate((key) => JSON.parse(localStorage.getItem(key)).messagesByThread.thread_catalogs_e2e[0].content, storageKey), preservedMessage);
  await migrationContext.close();

  log("Verificando cachés heredadas antiguas y migración offline");
  const staleState = { offline: true };
  const staleContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const stalePage = await preparePage(staleContext, staleState, {
    [legacyFoodsCacheKey]: JSON.stringify(foodFixture),
    [legacyProductsCacheKey]: "[]",
    [legacyRecipesCacheKey]: "[]",
    [exercisesCacheKey]: JSON.stringify(exerciseFixture),
  });
  await openApp(stalePage);
  await expectFoodConsumer(stalePage, true);
  await stalePage.getByText("Copia antigua", { exact: true }).first().waitFor({ state: "visible" });
  await expectExerciseConsumer(stalePage, "Rutina Caché Antigua E2E", true);
  await expectCaches(stalePage, true);
  await staleContext.close();

  log("Verificando disponibilidad parcial cuando falla una fuente nutricional");
  const partialContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const partialPage = await preparePage(partialContext, { offline: false, failProducts: true }, {}, true);
  await openApp(partialPage);
  await expectFoodConsumer(partialPage, true);
  const partialNotice = partialPage.getByTestId("diet-food-catalog-status-desayuno");
  await partialNotice.getByText("Disponibilidad parcial", { exact: true }).waitFor({ state: "visible" });
  if (screenshotDir) await partialNotice.screenshot({ path: join(screenshotDir, "partial-availability.png") });
  await expectProviderCatalogTools(partialPage, "partial", "fresh");
  await partialContext.close();

  log("Verificando arranque limpio sin red con catálogo de alimentos integrado");
  const coldContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const coldPage = await preparePage(coldContext, { offline: true }, {}, true);
  await openApp(coldPage);
  await expectCaches(coldPage, false);
  await expectFoodConsumer(coldPage, false);
  const unavailableNotice = coldPage.getByTestId("diet-food-catalog-status-desayuno");
  await unavailableNotice.getByText("Disponibilidad parcial", { exact: true }).waitFor({ state: "visible" });
  if (screenshotDir) await unavailableNotice.screenshot({ path: join(screenshotDir, "unavailable.png") });
  await coldPage.getByTestId("nav-tab-chat").click();
  let unexpectedProviderCall = false;
  await coldPage.route("**/v1/responses*", (route) => {
    unexpectedProviderCall = true;
    return route.fulfill({ status: 500 });
  });
  await coldPage.getByTestId("chat-input").fill("Busca arroz blanco en el catálogo y dime sus calorías por 100 g");
  await coldPage.getByTestId("chat-send").click();
  await coldPage.getByText("En el catálogo, Arroz blanco (cocido) tiene 130 kcal por 100 g.", { exact: true })
    .waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(unexpectedProviderCall, false);
  if (screenshotDir) await coldPage.screenshot({ path: join(screenshotDir, "coach-catalog-rice.png") });
  await coldPage.unroute("**/v1/responses*");
  await expectCiqualOffline(coldPage);
  await expectProviderCatalogTools(coldPage, "partial", "unavailable");
  await expectExerciseConsumer(coldPage, "Rutina Offline E2E", false);
  await coldPage.getByText("No se pudo cargar esta parte del catálogo.", { exact: true }).waitFor({ state: "visible" });
  await coldPage.getByTestId("training-exercise-custom-open").waitFor({ state: "visible" });
  await coldPage.getByTestId("exercise-catalog-search").evaluate((element) => element.blur());
  if (screenshotDir) await coldPage.screenshot({ path: join(screenshotDir, "exercise-catalog-offline.png") });
  await coldContext.close();

  log("Verificando que una caché manipulada se rechaza íntegramente");
  const corruptContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const corruptEnvelope = JSON.stringify({
    schemaVersion: 1,
    sourceId: "gymnasia_foods",
    fetchedAt: new Date().toISOString(),
    contentHashSha256: "sha256:manipulado",
    etag: null,
    provenance: {},
    data: foodFixture.map((entry) => ({ ...entry, sourceId: "gymnasia_foods", source: "alimento" })),
  });
  const corruptPage = await preparePage(corruptContext, { offline: true }, { [foodsCacheKey]: corruptEnvelope });
  await openApp(corruptPage);
  await expectFoodConsumer(corruptPage, false);
  await corruptPage.getByText("Disponibilidad parcial", { exact: true }).first().waitFor({ state: "visible" });
  await corruptContext.close();

  log("Verificando selección explícita ante una coincidencia ambigua");
  const ambiguousContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ambiguousPage = await preparePage(ambiguousContext, { offline: false, duplicateFood: true });
  await openApp(ambiguousPage);
  await expectFoodConsumer(ambiguousPage, true);
  await ambiguousPage.locator('input[placeholder="Buscar alimento..."]').first().fill("");
  await ambiguousPage.getByTestId("open-manual-food-desayuno").click();
  await ambiguousPage.getByTestId("manual-food-name-input").fill(fixtureFoodName);
  await ambiguousPage.getByTestId("manual-food-grams-input").fill("100");
  await ambiguousPage.getByTestId("manual-food-calories-input").fill("57");
  await ambiguousPage.getByTestId("manual-food-protein_g-input").fill("0.4");
  await ambiguousPage.getByTestId("manual-food-carbs_g-input").fill("15");
  await ambiguousPage.getByTestId("manual-food-fat_g-input").fill("0.1");
  await ambiguousPage.getByTestId("save-manual-food").click();
  const ambiguityModal = ambiguousPage.getByTestId("food-catalog-ambiguity-modal");
  await ambiguityModal.waitFor({ state: "visible" });
  if (screenshotDir) await ambiguityModal.screenshot({ path: join(screenshotDir, "ambiguous-selection.png") });
  assert.equal(await ambiguousPage.getByText(fixtureFoodName, { exact: true }).count() >= 2, true);
  await ambiguousPage.getByTestId("food-catalog-keep-manual").click();
  await ambiguousPage.waitForFunction((key) => {
    const days = JSON.parse(localStorage.getItem(key) ?? "{}").dietByDate;
    const firstDay = days && Object.values(days)[0];
    return firstDay?.meals?.[0]?.items?.[0]?.catalog_link?.reason === "manual";
  }, storageKey);
  await ambiguousContext.close();

  log("Runtime local-first, identidad y estados degradados verificados");
  }
  log("Catálogos E2E completados correctamente, incluidas imágenes CIQUAL");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
