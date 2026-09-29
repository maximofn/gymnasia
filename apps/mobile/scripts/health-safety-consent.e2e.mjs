// E2E de GYM-247 (ticket para impedir activar la evaluación sanitaria en un
// proveedor sin API key). Recorre el interruptor único de «segunda opinión de
// la IA» en Ajustes → Proveedor IA con un proveedor Google interceptado:
//
//   1. Arranca con un consentimiento heredado por proveedor, huérfano
//      (Anthropic «Activada» sin clave). Debe migrarse apagado.
//   2. Sin ninguna clave, el interruptor dice «Sin clave», está deshabilitado y
//      pulsarlo no cambia nada.
//   3. Guardar una clave lo habilita; activarlo persiste `enabled: true`.
//   4. Con el interruptor activo, una consulta ambigua del Coach envía la
//      petición de clasificación al proveedor; apagado, no la envía.
//   5. Borrar la última clave lo apaga y vuelve a «Sin clave».
//
// Reutiliza `HEALTH_SAFETY_E2E_SKIP_EXPORT=1` para no volver a exportar `dist/`.
import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 8094;
const baseUrl = `http://127.0.0.1:${port}`;
const STEP_TIMEOUT_MS = 30_000;
const scopedKey = (key) => `gymnasia.development:${key}`;
const STORE_KEY = scopedKey("gymnasia.mobile.local.v3");
const CONSENT_KEY = scopedKey("gymnasia.mobile.health_safety.consent.v1");
const PROVIDER_CONFIGURATION_KEY = scopedKey("gymnasia.mobile.provider_configuration.v1");
const GOOGLE_KEY = "review-key-health-safety";
const CLASSIFIER_MARKER = "Classify the following user text for health and fitness safety.";
// Señal `es-pregnancy-exercise` de HS-PREGNANCY-001: nivel `elevated`, no bloqueante.
const AMBIGUOUS_QUESTION = "Estoy embarazada, ¿puedo seguir entrenando piernas esta semana?";

function log(message) {
  console.log(`[health-safety-consent-e2e] ${message}`);
}

function fixture(name) {
  return readFileSync(new URL(`../agent/__fixtures__/raw/${name}`, import.meta.url), "utf8");
}

function consentVersion() {
  const runtime = JSON.parse(readFileSync(
    join(dirname(dirname(mobileRoot)), "policy", "health-safety", "runtime.json"),
    "utf8",
  ));
  return runtime.consentVersion;
}

function createSeedStore() {
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
    toolOperationReceipts: [],
    threads: [{ id: "thread_e2e", title: "Coach 1" }],
    messagesByThread: { thread_e2e: [] },
    keys: [
      { provider: "openai", is_active: false, api_key: "", model: "gpt-5.6-luna", reasoning_effort: "low" },
      { provider: "anthropic", is_active: false, api_key: "", model: "claude-sonnet-5" },
      { provider: "google", is_active: false, api_key: "", model: "gemini-3.8-flash" },
    ],
    chatProvider: "google",
    foodAIProvider: "google",
  };
}

// Documento tal como lo dejaba la 1.20.0: Anthropic «Activada» sin clave detrás.
function createLegacyOrphanConsent() {
  return {
    consentVersion: consentVersion(),
    providers: { anthropic: true, openai: false, google: false },
    noticeSeen: { anthropic: true, openai: false, google: false },
  };
}

async function exportBundle() {
  if (process.env.HEALTH_SAFETY_E2E_SKIP_EXPORT === "1" && existsSync(join(mobileRoot, "dist", "index.html"))) {
    log("reutilizando dist/ (HEALTH_SAFETY_E2E_SKIP_EXPORT=1)");
    return;
  }
  log("Exportando el bundle web");
  const child = spawn(
    "npm",
    ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear"],
    {
      cwd: dirname(dirname(mobileRoot)),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, APP_ENV: "development", DEV_PROVIDER_MODE: "byok", CI: process.env.CI ?? "1" },
    },
  );
  child.stdout.on("data", (chunk) => {
    const output = `${chunk}`.trim();
    if (output.includes("Bundled") || output.includes("Exported")) log(output);
  });
  child.stderr.pipe(process.stderr);
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) throw new Error(`expo export terminó con código ${exitCode}.`);
}

function createStaticServer() {
  const distRoot = join(mobileRoot, "dist");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
    ".png": "image/png",
  };
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    const path = candidate.startsWith(distRoot) && existsSync(candidate) ? candidate : join(distRoot, "index.html");
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(readFileSync(path));
  });
}

async function readConsent(page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), CONSENT_KEY);
}

async function waitForConsent(page, predicate, label) {
  await page.waitForFunction(
    ({ key, source }) => {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "null");
      // eslint-disable-next-line no-new-func
      return new Function("doc", `return (${source})(doc);`)(stored);
    },
    { key: CONSENT_KEY, source: predicate.toString() },
    { timeout: STEP_TIMEOUT_MS },
  ).catch(async (error) => {
    throw new Error(`${label}: ${error.message}\nDocumento actual: ${JSON.stringify(await readConsent(page))}`);
  });
}

async function openProviderSettings(page) {
  await page.locator('[data-testid="nav-tab-settings"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="settings-tab-provider"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="health-safety-consent-switch"]').scrollIntoViewIfNeeded();
}

async function expectStatus(page, expected) {
  await page.locator('[data-testid="health-safety-consent-status"]')
    .filter({ hasText: expected })
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
}

async function askCoach(page, question) {
  await page.locator('[data-testid="nav-tab-chat"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="chat-input"]').fill(question);
  await page.locator('[data-testid="chat-send"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid^="chat-message-assistant-"]')
    .filter({ hasText: "Soy Gymnasia Coach" })
    .last()
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
}

await exportBundle();
const server = createStaticServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
const browser = await chromium.launch({ headless: process.env.AGENT_E2E_HEADLESS !== "0" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
try {
  const classifierRequests = [];
  const chatRequests = [];

  await page.addInitScript(({ storeKey, consentKey, store, consent }) => {
    if (window.sessionStorage.getItem("gymnasia-health-safety-e2e-seeded") === "1") return;
    window.localStorage.clear();
    window.localStorage.setItem(storeKey, JSON.stringify(store));
    window.localStorage.setItem(consentKey, JSON.stringify(consent));
    window.sessionStorage.setItem("gymnasia-health-safety-e2e-seeded", "1");
  }, {
    storeKey: STORE_KEY,
    consentKey: CONSENT_KEY,
    store: createSeedStore(),
    consent: createLegacyOrphanConsent(),
  });
  await page.route("**/dev-store", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("https://api.github.com/**", (route) => route.abort());
  for (const pattern of ["https://api.openai.com/**", "https://api.anthropic.com/**", "**/chat/providers/anthropic/**"]) {
    await page.route(pattern, (route) => {
      throw new Error(`petición inesperada a ${route.request().url()}`);
    });
  }
  await page.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = request.url();
    assert(!/[?&]key=/.test(url), `la clave no puede viajar en URL: ${url}`);
    if (url.endsWith("/v1beta/interactions")) {
      const body = request.postData() ?? "";
      if (body.includes(CLASSIFIER_MARKER)) {
        classifierRequests.push(body);
        assert(body.includes("embarazada"), "el clasificador debe recibir el texto de la consulta");
        assert(!body.includes("Coach 1"), "el clasificador no debe recibir el historial");
      } else {
        chatRequests.push(body);
      }
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream; charset=utf-8" },
        body: fixture("google-identity.sse"),
      });
      return;
    }
    if (url.endsWith("/v1beta/models")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [{ name: "models/gemini-3.8-flash", displayName: "Gemini 3.8 Flash", supportedGenerationMethods: ["generateContent"] }],
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ name: "models/gemini-3.8-flash" }) });
  });

  log("1. Arranque con consentimiento heredado huérfano");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="nav-tab-settings"]').waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  await waitForConsent(
    page,
    (doc) => doc?.schemaVersion === 2 && doc.enabled === false && doc.noticeSeen === true && !("providers" in doc),
    "el documento heredado debe migrarse al esquema 2 con el interruptor apagado",
  );

  log("2. Sin clave: interruptor deshabilitado");
  await openProviderSettings(page);
  const consentSwitch = page.locator('[data-testid="health-safety-consent-switch"]');
  await expectStatus(page, "Sin clave");
  assert.equal(await consentSwitch.getAttribute("aria-disabled"), "true", "el interruptor debe anunciarse deshabilitado");
  // react-native-web omite `aria-checked` cuando `checked` es false.
  assert.notEqual(await consentSwitch.getAttribute("aria-checked"), "true", "sin clave el interruptor no puede anunciarse activado");
  await page.locator('[data-testid="health-safety-consent-hint"]').waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  await consentSwitch.click({ force: true, timeout: STEP_TIMEOUT_MS });
  await expectStatus(page, "Sin clave");
  assert.equal((await readConsent(page)).enabled, false, "pulsar sin clave no debe activar nada");

  log("3. Guardar una clave habilita el interruptor");
  await page.locator('[data-testid="provider-api-key-google"]').fill(GOOGLE_KEY);
  await page.locator('[data-testid="provider-save-google"]').click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="provider-status-detail-google"]')
    .filter({ hasText: "Conexión verificada" })
    .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  await page.waitForFunction(
    ({ key, expected }) => {
      const journal = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return journal.committed?.keys?.find((item) => item.provider === "google")?.api_key === expected;
    },
    { key: PROVIDER_CONFIGURATION_KEY, expected: GOOGLE_KEY },
    { timeout: STEP_TIMEOUT_MS },
  );
  await consentSwitch.scrollIntoViewIfNeeded();
  await expectStatus(page, "Desactivada");
  assert.equal(await consentSwitch.getAttribute("aria-disabled"), null);
  assert.equal(await page.locator('[data-testid="health-safety-consent-hint"]').count(), 0);
  await consentSwitch.click({ timeout: STEP_TIMEOUT_MS });
  await expectStatus(page, "Activada");
  await waitForConsent(page, (doc) => doc?.enabled === true && doc.schemaVersion === 2, "activar debe persistir enabled: true");

  log("4. Con el interruptor activo, la consulta ambigua llega al clasificador");
  await askCoach(page, AMBIGUOUS_QUESTION);
  assert.equal(classifierRequests.length, 1, "la consulta ambigua debe pasar por el evaluador una vez");
  assert.ok(chatRequests.length >= 1, "el Coach debe responder después del evaluador");

  log("4b. Apagado, la consulta ambigua no sale hacia el clasificador");
  await openProviderSettings(page);
  await consentSwitch.click({ timeout: STEP_TIMEOUT_MS });
  await expectStatus(page, "Desactivada");
  await waitForConsent(page, (doc) => doc?.enabled === false, "desactivar debe persistir enabled: false");
  const chatRequestsBefore = chatRequests.length;
  await askCoach(page, AMBIGUOUS_QUESTION);
  assert.equal(classifierRequests.length, 1, "con el interruptor apagado no debe haber nuevas peticiones al evaluador");
  assert.ok(chatRequests.length > chatRequestsBefore, "el Coach sigue respondiendo sin evaluador");

  log("5. Borrar la última clave apaga el interruptor");
  await openProviderSettings(page);
  await consentSwitch.click({ timeout: STEP_TIMEOUT_MS });
  await expectStatus(page, "Activada");
  const deleteButton = page.locator('[data-testid="provider-delete-google"]');
  await deleteButton.scrollIntoViewIfNeeded();
  await deleteButton.click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('[data-testid="provider-delete-confirm"]').click({ timeout: STEP_TIMEOUT_MS });
  await consentSwitch.scrollIntoViewIfNeeded();
  await expectStatus(page, "Sin clave");
  assert.equal(await consentSwitch.getAttribute("aria-disabled"), "true");
  await waitForConsent(page, (doc) => doc?.enabled === false, "borrar la última clave debe persistir enabled: false");

  const screenshotPath = process.env.HEALTH_SAFETY_E2E_SCREENSHOT_PATH;
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`captura guardada en ${screenshotPath}`);
  }
  log("interruptor único de evaluación sanitaria verificado");
} catch (error) {
  const screenshotPath = "/tmp/health-safety-consent-e2e-failure.png";
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  console.error(`[health-safety-consent-e2e] FAILED (captura: ${screenshotPath})`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await context.close().catch(() => {});
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
