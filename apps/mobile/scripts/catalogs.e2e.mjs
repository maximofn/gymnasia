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
  await page.route("https://raw.githubusercontent.com/**", (route) => {
    if (networkState.offline) {
      return route.fulfill({ status: 503, body: "offline fixture" });
    }

    const pathname = new URL(route.request().url()).pathname;
    if (networkState.failProducts && pathname.endsWith("/productos_comerciales/all.json")) {
      return route.fulfill({ status: 503, body: "products unavailable fixture" });
    }
    if (pathname.endsWith("/alimentos/all.json")) {
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
    for (const [storageKey, value] of Object.entries(seededStorage)) {
      if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, value);
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

function openAIFinalSse() {
  return [
    `event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: { id: "resp_catalog_final" } })}`,
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", item_id: "msg_catalog_final", output_index: 0, content_index: 0, delta: "Catálogos consultados." })}`,
    `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { id: "resp_catalog_final", output: [{ type: "message", id: "msg_catalog_final", content: [{ type: "output_text", text: "Catálogos consultados." }] }] } })}`,
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
    const output = requests[requestIndex].input?.find((item) => item.type === "function_call_output")?.output;
    assert.equal(typeof output, "string");
    const parsed = JSON.parse(output);
    assert.equal(parsed.availability, expectedAvailability);
    assert.equal(parsed.sources.some((source) => source.source_id === expectedSource), true);
    assert.equal(parsed.results.every((result) => result.source_id && result.item_id), true);
  }
  const routineOutput = requests[3].input?.find((item) => item.type === "function_call_output")?.output;
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

exportDevelopmentBundle();
const server = await startServer();
const browser = await chromium.launch({ headless: process.env.CATALOG_E2E_HEADLESS !== "0" });

try {
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

  log("Verificando arranque limpio sin red y repositorios vacíos");
  const coldContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const coldPage = await preparePage(coldContext, { offline: true }, {}, true);
  await openApp(coldPage);
  await expectCaches(coldPage, false);
  await expectFoodConsumer(coldPage, false);
  const unavailableNotice = coldPage.getByTestId("diet-food-catalog-status-desayuno");
  await unavailableNotice.getByText("Catálogo no disponible", { exact: true }).waitFor({ state: "visible" });
  if (screenshotDir) await unavailableNotice.screenshot({ path: join(screenshotDir, "unavailable.png") });
  await expectProviderCatalogTools(coldPage, "unavailable");
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
  await corruptPage.getByText("Catálogo no disponible", { exact: true }).first().waitFor({ state: "visible" });
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
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
