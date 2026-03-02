import assert from "node:assert/strict";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const DEFAULT_PORT = 8090;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const STEP_TIMEOUT_MS = 20000;
const BASE_URL_CANDIDATES = ["http://localhost:8081", "http://localhost:8082"];

function logStep(message) {
  console.log(`[train-e2e] ${message}`);
}

async function isUrlReachable(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isUrlReachable(url)) return true;
    await sleep(500);
  }
  return false;
}

async function ensureWebServer() {
  const configuredUrl = process.env.TRAIN_E2E_URL?.trim();
  const reuseExisting = process.env.TRAIN_E2E_REUSE_SERVER === "1";
  if (configuredUrl && (await isUrlReachable(configuredUrl))) {
    logStep(`Using configured server: ${configuredUrl}`);
    return {
      baseUrl: configuredUrl,
      stop: async () => {},
    };
  }
  if (reuseExisting) {
    for (const candidate of BASE_URL_CANDIDATES) {
      if (await isUrlReachable(candidate)) {
        logStep(`Using existing server: ${candidate}`);
        return {
          baseUrl: candidate,
          stop: async () => {},
        };
      }
    }
  }

  const port = Number.parseInt(process.env.TRAIN_E2E_PORT ?? `${DEFAULT_PORT}`, 10) || DEFAULT_PORT;
  const baseUrl = `http://localhost:${port}`;
  logStep(`Starting Expo web server on ${baseUrl}`);

  const child = spawn(
    "npm",
    [
      "--workspace",
      "apps/mobile",
      "run",
      "web",
      "--",
      "--port",
      `${port}`,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: process.env.CI ?? "1",
      },
    },
  );

  child.stdout.on("data", (chunk) => {
    const text = `${chunk}`;
    if (text.includes("Web is waiting on")) {
      logStep(text.trim());
    }
  });
  child.stderr.on("data", (chunk) => {
    const text = `${chunk}`.trim();
    if (text) {
      console.error(`[train-e2e][expo] ${text}`);
    }
  });

  const booted = await waitForUrl(baseUrl, SERVER_BOOT_TIMEOUT_MS);
  if (!booted) {
    try {
      child.kill("SIGINT");
    } catch {
      // ignore
    }
    throw new Error(
      `Expo web server did not become available at ${baseUrl} within ${SERVER_BOOT_TIMEOUT_MS}ms`,
    );
  }

  return {
    baseUrl,
    stop: async () => {
      if (child.killed) return;
      child.kill("SIGINT");
      try {
        await Promise.race([once(child, "exit"), sleep(5000)]);
      } catch {
        // ignore
      }
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    },
  };
}

async function expectBodyContains(page, expected, timeout = STEP_TIMEOUT_MS) {
  await page.waitForFunction(
    (needle) => Boolean(document.body?.innerText?.includes(needle)),
    expected,
    { timeout },
  );
}

async function clickNavTab(page, label) {
  const labelToTabKey = {
    Home: "home",
    Entrenamiento: "training",
    Dieta: "diet",
    Estadísticas: "measures",
    Chat: "chat",
    Configuración: "settings",
  };
  const tabKey = labelToTabKey[label];
  if (tabKey) {
    await page.locator(`[data-testid="nav-tab-${tabKey}"]`).click({ timeout: STEP_TIMEOUT_MS });
    return;
  }
  await page.locator(`text=${label}`).last().click({ timeout: STEP_TIMEOUT_MS });
}

async function clickByTestIdPrefix(page, prefix, index = 0) {
  await page.waitForFunction(
    ({ idPrefix, idIndex }) =>
      document.querySelectorAll(`[data-testid^="${idPrefix}"]`).length > idIndex,
    { idPrefix: prefix, idIndex: index },
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.evaluate(
    ({ idPrefix, idIndex }) => {
      const nodes = Array.from(document.querySelectorAll(`[data-testid^="${idPrefix}"]`));
      const node = nodes[idIndex];
      if (!node) {
        throw new Error(
          `Expected at least ${idIndex + 1} node(s) for data-testid prefix "${idPrefix}", got ${nodes.length}`,
        );
      }
      node.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    },
    { idPrefix: prefix, idIndex: index },
  );
}

async function fillInputByPlaceholder(page, placeholder, value, index = 0) {
  const locator = page.locator(`input[placeholder="${placeholder}"]`);
  const count = await locator.count();
  assert(
    count > index,
    `Expected input[placeholder="${placeholder}"] index ${index} to exist (count=${count})`,
  );
  await locator.nth(index).fill(value, { timeout: STEP_TIMEOUT_MS });
}

async function runTrainUsabilityE2E(page, baseUrl) {
  logStep(`Navigating to ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: STEP_TIMEOUT_MS });

  logStep("Resetting local data");
  await clickNavTab(page, "Configuración");
  await expectBodyContains(page, "Restablecer datos locales");
  await page.locator("text=Restablecer datos locales").first().click({ timeout: STEP_TIMEOUT_MS });

  logStep("Opening Entrenamiento tab and validating empty state");
  await clickNavTab(page, "Entrenamiento");
  await expectBodyContains(page, "Sin rutinas aún");

  logStep("Creating first routine");
  await page.locator("text=CREAR RUTINA").first().click({ timeout: STEP_TIMEOUT_MS });
  await fillInputByPlaceholder(page, "Nombre de rutina", "QA - Rutina Principal");
  await page.locator("text=Cardio").first().click({ timeout: STEP_TIMEOUT_MS });
  await page.locator("text=+ Agregar ejercicio").first().click({ timeout: STEP_TIMEOUT_MS });
  await page.locator('input[placeholder^="Ejercicio"]').first().fill("Intervalos Cinta QA");
  for (let i = 0; i < 3; i += 1) {
    await page.locator("text=+ Añadir serie").first().click({ timeout: STEP_TIMEOUT_MS });
  }

  logStep("Editing series and validating duration formula");
  const seriesInputs = page.locator('input[placeholder="-"]');
  const seriesInputCount = await seriesInputs.count();
  assert(seriesInputCount >= 12, `Expected at least 12 series inputs, got ${seriesInputCount}`);
  for (const index of [2, 5, 8, 11]) {
    await seriesInputs.nth(index).fill("1");
  }
  await page.waitForFunction(
    () =>
      document.querySelectorAll('input[value="6"], input[placeholder="6"]').length > 0,
    null,
    { timeout: STEP_TIMEOUT_MS },
  );

  logStep("Exercise actions: clone, move, delete");
  await clickByTestIdPrefix(page, "training-exercise-menu-");
  await clickByTestIdPrefix(page, "training-exercise-clone-");
  await expectBodyContains(page, "2 ejercicios");
  await clickByTestIdPrefix(page, "training-exercise-menu-", 1);
  await clickByTestIdPrefix(page, "training-exercise-move-");
  await clickByTestIdPrefix(page, "training-exercise-menu-");
  await clickByTestIdPrefix(page, "training-exercise-delete-");
  await expectBodyContains(page, "1 ejercicios");

  logStep("Saving routine");
  await page.locator("text=Guardar cambios").first().click({ timeout: STEP_TIMEOUT_MS });
  await expectBodyContains(page, "Mis Rutinas");

  logStep("Routine list actions: clone, move, delete");
  await clickByTestIdPrefix(page, "training-template-menu-");
  await clickByTestIdPrefix(page, "training-template-clone-");
  await expectBodyContains(page, "2 rutinas");
  await clickByTestIdPrefix(page, "training-template-menu-", 1);
  await clickByTestIdPrefix(page, "training-template-move-");
  await clickByTestIdPrefix(page, "training-template-menu-", 1);
  await clickByTestIdPrefix(page, "training-template-delete-");
  await expectBodyContains(page, "1 rutina");

  logStep("Starting session from routine menu");
  await clickByTestIdPrefix(page, "training-template-menu-");
  await clickByTestIdPrefix(page, "training-template-start-");
  await expectBodyContains(page, "Sesión activa");
  await clickByTestIdPrefix(page, "training-session-complete-series");
  await expectBodyContains(page, "1/4 series");

  logStep("Pausing, resuming and completing session");
  await clickByTestIdPrefix(page, "training-session-toggle-pause");
  await expectBodyContains(page, "Estado Pausado");
  await clickByTestIdPrefix(page, "training-session-toggle-pause");
  await expectBodyContains(page, "Estado Activo");
  if ((await page.locator('[data-testid="training-session-skip-rest"]').count()) > 0) {
    await page.locator('[data-testid="training-session-skip-rest"]').click({ force: true });
  }
  for (let i = 0; i < 3; i += 1) {
    await clickByTestIdPrefix(page, "training-session-complete-series");
    const skipLocator = page.locator('[data-testid="training-session-skip-rest"]');
    if ((await skipLocator.count()) > 0) {
      await skipLocator.click({ force: true });
    }
  }
  await expectBodyContains(page, "Último entrenamiento completado");

  logStep("Starting session again and testing discard flow");
  await clickByTestIdPrefix(page, "training-template-menu-");
  await clickByTestIdPrefix(page, "training-template-start-");
  await expectBodyContains(page, "Sesión activa");
  await page.locator('[data-testid="training-session-discard"]').click({ force: true });
  await expectBodyContains(page, 'Pulsa "Abandonar" de nuevo para confirmar.');
  await page.locator('[data-testid="training-session-discard"]').click({ force: true });
  await expectBodyContains(page, "Entrenamiento descartado.");
  await expectBodyContains(page, "Mis Rutinas");

  logStep("Entrenamiento usability e2e completed successfully");
}

async function main() {
  const headless = process.env.TRAIN_E2E_HEADLESS !== "0";
  const server = await ensureWebServer();
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    await runTrainUsabilityE2E(page, server.baseUrl);
  } catch (error) {
    const screenshotPath = "/tmp/train-usability-failure.png";
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`[train-e2e] Failure screenshot: ${screenshotPath}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
    await server.stop();
  }
}

main().catch((error) => {
  console.error("[train-e2e] FAILED");
  console.error(error);
  process.exit(1);
});
