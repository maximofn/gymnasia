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
const port = Number.parseInt(process.env.DATA_DELETION_E2E_PORT ?? "8132", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const namespace = "gymnasia.development";
const scopedKey = (key) => `${namespace}:${key}`;
const marker = "gymnasia-deletion-e2e-marker";

const keys = {
  store: scopedKey("gymnasia.mobile.local.v3"),
  providerConfiguration: scopedKey("gymnasia.mobile.provider_configuration.v1"),
  lastGood: scopedKey("gymnasia.mobile.local.last_good.v1"),
  quarantine: scopedKey("gymnasia.mobile.local.quarantine.v1"),
  session: scopedKey("gymnasia.mobile.training.session.v1"),
  sessionTemplate: scopedKey("gymnasia.mobile.training.session_template_snapshot.v1"),
  personalData: scopedKey("gymnasia.mobile.personal_data.v1"),
  personalFoods: scopedKey("gymnasia.mobile.personal_foods.v1"),
  preferences: scopedKey("gymnasia.mobile.user_prefs.v1"),
  consent: scopedKey("gymnasia.mobile.health_safety.consent.v1"),
  alarmHealth: scopedKey("gymnasia.mobile.alarm_health.v1"),
  backupMeta: scopedKey("gymnasia.mobile.backup_meta.v1"),
  traces: scopedKey("gymnasia_debug_traces"),
  foodsCache: scopedKey("gymnasia.mobile.foods_repo.v1"),
  signedPolicy: scopedKey("gymnasia.mobile.signed_policy.cache.v1"),
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
  console.log(`[local-data-deletion-e2e] ${message}`);
}

function seedStore() {
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
    threads: [{ id: "thread_deletion_e2e", title: "Conversación marcada" }],
    messagesByThread: {
      thread_deletion_e2e: [{
        id: "message_deletion_e2e",
        role: "user",
        content: `actividad-${marker}`,
        created_at: "2026-08-30T10:00:00.000Z",
      }],
    },
    keys: [
      {
        provider: "openai",
        is_active: true,
        api_key: `secret-${marker}`,
        model: "gpt-5-mini",
        reasoning_effort: "low",
      },
      {
        provider: "anthropic",
        is_active: false,
        api_key: "",
        model: "claude-3-5-sonnet-latest",
      },
      {
        provider: "google",
        is_active: false,
        api_key: "",
        model: "gemini-3.6-flash",
      },
    ],
    chatProvider: "openai",
    foodAIProvider: "google",
  };
}

function seedEntries() {
  return {
    [keys.store]: JSON.stringify(seedStore()),
    [keys.personalData]: JSON.stringify([
      { key: "objetivo", description: "Dato marcado", value: `memory-${marker}` },
    ]),
    [keys.personalFoods]: JSON.stringify([
      { id: "food-e2e", name: `food-${marker}`, calories_kcal: 10, protein_g: 1, carbs_g: 1, fat_g: 0 },
    ]),
    [keys.preferences]: JSON.stringify({
      chartPeriod: "6m",
      notifications: { enabled: false, sound: false, vibrate: false, soundKey: "beep" },
    }),
    [keys.consent]: JSON.stringify({ marker: `consent-${marker}` }),
    [keys.alarmHealth]: JSON.stringify({ lastDelayMs: 1234, lastObservedAt: 1, lateStreak: 2 }),
    [keys.backupMeta]: JSON.stringify({ lastBackupAt: "2026-08-30T10:00:00.000Z" }),
    [keys.traces]: JSON.stringify([{ message: `trace-${marker}` }]),
    [keys.foodsCache]: JSON.stringify([{ id: `cache-${marker}` }]),
    [keys.signedPolicy]: JSON.stringify({ antiRollback: `signed-${marker}` }),
  };
}

function exportDevelopmentBundle() {
  if (process.env.DATA_DELETION_E2E_SKIP_EXPORT === "1") {
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
        EXPO_PUBLIC_DEV_STORE_MIRROR: "1",
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

async function openDataSettings(page) {
  await page.getByTestId("nav-tab-settings").click();
  const dataTab = page.getByTestId("settings-tab-data");
  await dataTab.scrollIntoViewIfNeeded();
  await dataTab.click();
}

async function storageSnapshot(page) {
  return page.evaluate(() => Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key) => key !== null)
      .map((key) => [key, localStorage.getItem(key)]),
  ));
}

async function run() {
  exportDevelopmentBundle();
  assert.ok(existsSync(join(distRoot, "index.html")), "La exportación no creó dist/index.html.");
  const server = await startServer();
  const browser = await chromium.launch({
    headless: process.env.DATA_DELETION_E2E_HEADLESS !== "0",
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let devStore = JSON.stringify(seedStore());
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript((entries) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, seedEntries());
  await page.route("**/dev-store", async (route) => {
    if (route.request().method() === "POST") {
      devStore = route.request().postData() ?? "{}";
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: devStore });
  });
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
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByTestId("nav-tab-home").waitFor({ state: "visible", timeout: 30_000 });

    await page.evaluate(({ recoveryKeys, staleMarker }) => {
      localStorage.setItem(recoveryKeys.lastGood, JSON.stringify({ payload: `snapshot-${staleMarker}` }));
      localStorage.setItem(recoveryKeys.quarantine, JSON.stringify({ rawPayload: `quarantine-${staleMarker}` }));
      localStorage.setItem(recoveryKeys.session, JSON.stringify({ marker: `session-${staleMarker}` }));
      localStorage.setItem(
        recoveryKeys.sessionTemplate,
        JSON.stringify({ marker: `session-template-${staleMarker}` }),
      );
    }, { recoveryKeys: keys, staleMarker: marker });

    log("Comprobando el borrado parcial y sus preservaciones");
    await openDataSettings(page);
    await page.getByTestId("data-deletion-open-activity").scrollIntoViewIfNeeded();
    await page.getByTestId("data-deletion-open-activity").click();
    await page.getByTestId("data-deletion-confirm").click();
    await page.getByTestId("data-deletion-success").waitFor({ state: "visible", timeout: 30_000 });

    const partial = await storageSnapshot(page);
    assert.match(partial[keys.personalData] ?? "", new RegExp(`memory-${marker}`));
    assert.match(partial[keys.personalFoods] ?? "", new RegExp(`food-${marker}`));
    assert.ok(partial[keys.signedPolicy], "el borrado parcial no debe eliminar la caché firmada");
    assert.doesNotMatch(partial[keys.store] ?? "", new RegExp(`secret-${marker}`));
    assert.match(
      partial[keys.providerConfiguration] ?? "",
      new RegExp(`secret-${marker}`),
      "el borrado parcial debe conservar el diario web de proveedores",
    );
    assert.doesNotMatch(partial[keys.store] ?? "", new RegExp(`actividad-${marker}`));
    assert.doesNotMatch(
      partial[keys.lastGood] ?? "",
      new RegExp(`actividad-${marker}|snapshot-${marker}|quarantine-${marker}|session-${marker}`),
    );
    assert.equal(partial[keys.quarantine], undefined);
    assert.equal(partial[keys.session], undefined);
    assert.equal(partial[keys.sessionTemplate], undefined);
    assert.doesNotMatch(devStore, new RegExp(marker));
    assert.equal(JSON.parse(partial[keys.store]).dietSettings.daily_calories, "2200");
    assert.equal(JSON.parse(partial[keys.preferences]).chartPeriod, "6m");

    log("Comprobando la confirmación reforzada y el borrado total");
    const unknownPersonalKey = scopedKey("gymnasia.mobile.future_personal_partition.v1");
    await page.evaluate(async ({ key, staleMarker }) => {
      localStorage.setItem(key, `future-${staleMarker}`);
      await fetch("/dev-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [`dev-store-${staleMarker}`] }),
      });
    }, { key: unknownPersonalKey, staleMarker: marker });
    await openDataSettings(page);
    await page.getByTestId("data-deletion-open-all").scrollIntoViewIfNeeded();
    await page.getByTestId("data-deletion-open-all").click();
    const confirm = page.getByTestId("data-deletion-confirm");
    assert.equal(await confirm.isDisabled(), true);
    await page.getByTestId("data-deletion-confirmation-input").fill("BORRAR");
    assert.equal(await confirm.isDisabled(), false);
    await confirm.click();
    await page.getByTestId("data-deletion-success").waitFor({ state: "visible", timeout: 30_000 });

    const complete = await storageSnapshot(page);
    const combined = Object.entries(complete)
      .filter(([key]) => key !== keys.signedPolicy)
      .map(([, value]) => value)
      .join("\n");
    assert.doesNotMatch(combined, new RegExp(marker));
    assert.ok(complete[keys.signedPolicy], "el borrado total debe conservar la caché firmada");
    assert.equal(complete[unknownPersonalKey], undefined);
    assert.doesNotMatch(devStore, new RegExp(marker));
    assert.equal(complete[keys.preferences], undefined);
    assert.deepEqual(pageErrors, [], `Errores en la página: ${pageErrors.join(" | ")}`);
    log("Los dos alcances y la excepción anti-retroceso quedaron verificados");
  } catch (error) {
    await page.screenshot({ path: "/tmp/local-data-deletion-e2e-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
