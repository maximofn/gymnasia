/**
 * E2E de ausencia del actualizador de APK.
 *
 * Exporta la variante de producción, la abre sin estado previo y comprueba que
 * ni inicio ni Ajustes ofrecen actualizaciones desde GitHub. También vigila el
 * endpoint antiguo: cualquier petición hace fallar la prueba.
 */
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
const port = Number.parseInt(process.env.UPDATE_REMOVAL_E2E_PORT ?? "8126", 10);
const baseUrl = `http://127.0.0.1:${port}`;
const releasesApi = "https://api.github.com/repos/maximofn/gymnasia/releases/latest";
const screenshotPath = process.env.UPDATE_REMOVAL_SCREENSHOT?.trim();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".png": "image/png",
};

function log(message) {
  console.log(`[update-removal-e2e] ${message}`);
}

function exportProductionBundle() {
  log("Exportando la variante web de producción");
  execFileSync(
    "npm",
    ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear"],
    {
      cwd: repositoryRoot,
      env: { ...process.env, APP_ENV: "production", CI: process.env.CI ?? "1" },
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

async function run() {
  exportProductionBundle();
  assert.ok(existsSync(join(distRoot, "index.html")), "La exportación no creó dist/index.html.");

  const server = await startServer();
  const browser = await chromium.launch({
    headless: process.env.UPDATE_REMOVAL_E2E_HEADLESS !== "0",
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let releaseRequests = 0;
  const pageErrors = [];

  page.on("request", (request) => {
    if (request.url() === releasesApi) releaseRequests += 1;
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.clear());
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

    for (const copy of ["Nueva versión disponible", "¿Actualizar la app?"]) {
      assert.equal(await page.getByText(copy, { exact: true }).count(), 0, `${copy} no debe aparecer en inicio.`);
    }

    await page.getByTestId("nav-tab-settings").click();
    await page.getByText("Configuración", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.getByTestId("settings-tab-updates").count(), 0,
      "Ajustes no debe conservar la pestaña del actualizador.");
    for (const copy of ["Comprobar nuevas versiones", "Versión en GitHub", "Actualizar app"]) {
      assert.equal(await page.getByText(copy, { exact: true }).count(), 0, `${copy} no debe aparecer en Ajustes.`);
    }

    await page.waitForTimeout(500);
    assert.equal(releaseRequests, 0, "La variante de producción consultó la última release de APK.");
    assert.deepEqual(pageErrors, [], `Errores en la página: ${pageErrors.join(" | ")}`);

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log(`Captura guardada en ${screenshotPath}`);
    }
    log("Producción no muestra interfaz ni realiza peticiones del actualizador.");
  } catch (error) {
    await page.screenshot({ path: "/tmp/update-removal-e2e-failure.png", fullPage: true }).catch(() => {});
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
