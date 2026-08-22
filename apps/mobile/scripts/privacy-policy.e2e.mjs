/**
 * E2E de la política de privacidad publicada (GYM-190).
 *
 * Comprueba lo que el ticket pide verificar de verdad: que la política se lee
 * desde una instalación de producción, sin iniciar sesión y sin estado previo.
 * Para eso exporta el sitio web tal cual lo despliega Vercel, lo sirve en local y
 * lo abre con un contexto de navegador limpio: sin cookies, sin almacenamiento y
 * sin ninguna clave configurada.
 *
 *   node apps/mobile/scripts/privacy-policy.e2e.mjs
 *   PRIVACY_E2E_SKIP_EXPORT=1 node apps/mobile/scripts/privacy-policy.e2e.mjs
 *   PRIVACY_E2E_HEADLESS=0 node apps/mobile/scripts/privacy-policy.e2e.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repoRoot = join(mobileRoot, "..", "..");
const distRoot = join(mobileRoot, "dist");

const PORT = Number.parseInt(process.env.PRIVACY_E2E_PORT ?? "8124", 10);
const HEADLESS = process.env.PRIVACY_E2E_HEADLESS !== "0";
const SKIP_EXPORT = process.env.PRIVACY_E2E_SKIP_EXPORT === "1";
const STEP_TIMEOUT_MS = 20000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

const generated = readFileSync(
  join(mobileRoot, "agent", "generated", "legalCopy.generated.ts"),
  "utf8",
);
const readGenerated = (name) => {
  const match = generated.match(new RegExp(`${name} = "([^"]+)"`));
  assert.ok(match, `no se pudo leer ${name} del módulo generado`);
  return match[1];
};
const readGeneratedRecord = (name) => {
  const block = generated.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `no se pudo leer ${name} del módulo generado`);
  return Object.fromEntries(
    [...block[1].matchAll(/(\w+): "([^"]*)"/g)].map((entry) => [entry[1], entry[2]]),
  );
};

const POLICY_VERSION = readGenerated("PRIVACY_POLICY_VERSION");
const DIGESTS = readGeneratedRecord("PRIVACY_POLICY_DIGESTS");
const DISCLAIMERS = readGeneratedRecord("MEDICAL_DISCLAIMER");

function logStep(message) {
  console.log(`[privacy-e2e] ${message}`);
}

function exportWeb() {
  logStep("Exportando el sitio web (expo export --platform web)…");
  execFileSync("npm", ["--workspace", "apps/mobile", "run", "build:web"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(distRoot, relative === "/" ? "index.html" : relative);

    try {
      if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      res.writeHead(404).end("not found");
      return;
    }

    res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

const PAGES = [
  {
    locale: "es",
    path: "/privacidad",
    lang: "es",
    alternatePath: "/privacy",
    heading: "Política de privacidad de Gymnasia",
    anchors: ["byok", "proveedores", "copias", "denuncia", "eliminacion", "no-dispositivo-medico"],
  },
  {
    locale: "en",
    path: "/privacy",
    lang: "en",
    alternatePath: "/privacidad",
    heading: "Gymnasia Privacy Policy",
    anchors: ["byok", "proveedores", "copias", "denuncia", "eliminacion", "no-dispositivo-medico"],
  },
];

async function run() {
  if (!SKIP_EXPORT) exportWeb();
  assert.ok(
    existsSync(join(distRoot, "privacidad", "index.html")),
    "dist/privacidad/index.html no existe: expo export no copió apps/mobile/public/",
  );

  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}`;
  logStep(`Sirviendo ${distRoot} en ${baseUrl}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const failures = [];

  try {
    for (const target of PAGES) {
      // Contexto nuevo por página: sin cookies, sin localStorage y sin ninguna
      // credencial. Es la prueba de "lectura sin autenticación": la política no
      // puede depender de nada que el usuario haya hecho antes.
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on("pageerror", (error) => failures.push(`[${target.locale}] pageerror: ${error.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") failures.push(`[${target.locale}] console.error: ${msg.text()}`);
      });

      const response = await page.goto(`${baseUrl}${target.path}`, {
        waitUntil: "domcontentloaded",
        timeout: STEP_TIMEOUT_MS,
      });
      assert.equal(response.status(), 200, `${target.path} no devolvió 200`);

      const storage = await context.storageState();
      assert.deepEqual(storage.cookies, [], `${target.path} dejó cookies`);

      assert.equal(
        await page.locator("html").getAttribute("lang"),
        target.lang,
        `${target.path} no declara lang="${target.lang}"`,
      );
      assert.equal(
        (await page.locator("h1").innerText()).trim(),
        target.heading,
        `${target.path} no muestra el título esperado`,
      );

      const version = await page
        .locator('meta[name="gymnasia-policy-version"]')
        .getAttribute("content");
      assert.equal(version, POLICY_VERSION, `${target.path} publica otra versión`);

      const digest = await page
        .locator('meta[name="gymnasia-policy-digest"]')
        .getAttribute("content");
      assert.equal(
        digest,
        DIGESTS[target.locale],
        `${target.path} publica un texto distinto del que declara la app`,
      );

      for (const anchor of target.anchors) {
        assert.equal(
          await page.locator(`#${anchor}`).count(),
          1,
          `${target.path} no tiene la sección #${anchor}`,
        );
      }

      const body = await page.locator("body").innerText();
      assert.ok(
        body.includes(DISCLAIMERS[target.locale]),
        `${target.path} no muestra el descargo sanitario`,
      );
      assert.ok(
        body.includes("maximofn@maximofn.com"),
        `${target.path} no muestra el contacto del responsable`,
      );

      const alternate = await page
        .locator(`link[rel="alternate"][hreflang="${target.locale === "es" ? "en" : "es"}"]`)
        .getAttribute("href");
      assert.ok(
        alternate.endsWith(target.alternatePath),
        `${target.path} no enlaza con la otra versión de idioma`,
      );

      // La navegación entre idiomas debe funcionar dentro del sitio publicado.
      await page.goto(`${baseUrl}${target.alternatePath}`, { waitUntil: "domcontentloaded" });
      assert.equal(
        await page.locator("html").getAttribute("lang"),
        target.locale === "es" ? "en" : "es",
        `${target.alternatePath} no sirve el otro idioma`,
      );

      logStep(`${target.path} correcto (versión ${version}, ${target.anchors.length} secciones)`);
      await context.close();
    }

    if (failures.length > 0) {
      throw new Error(`Errores en la página publicada:\n  ${failures.join("\n  ")}`);
    }
    logStep("Política de privacidad verificada en ambos idiomas.");
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
