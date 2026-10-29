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

exportDevelopmentBundle();
const server = await startServer();
const browser = await chromium.launch({ headless: process.env.CATALOG_E2E_HEADLESS !== "0" });

try {
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
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
