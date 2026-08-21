import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 8092;
const baseUrl = `http://127.0.0.1:${port}`;

function log(message) {
  console.log(`[development-provider-e2e] ${message}`);
}

async function exportDevelopmentBundle() {
  const child = spawn(
    "npm",
    ["--workspace", "apps/mobile", "run", "build:web", "--", "--clear"],
    {
      cwd: dirname(dirname(mobileRoot)),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, APP_ENV: "development", CI: process.env.CI ?? "1" },
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
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", baseUrl).pathname);
    const candidate = normalize(join(distRoot, pathname === "/" ? "index.html" : pathname));
    const path = candidate.startsWith(distRoot) && existsSync(candidate)
      ? candidate
      : join(distRoot, "index.html");
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".ttf": "font/ttf",
      ".wav": "audio/wav",
      ".png": "image/png",
    };
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    response.end(readFileSync(path));
  });
}

await exportDevelopmentBundle();
const server = createStaticServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
const browser = await chromium.launch({ headless: process.env.AGENT_E2E_HEADLESS !== "0" });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let providerRequests = 0;
  let deploymentRequests = 0;
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "gymnasia.development:gymnasia.mobile.lastUpdateCheck",
      String(Date.now()),
    );
  });
  await page.route("**/dev-store", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("https://api.github.com/repos/maximofn/gymnasia/deployments**", (route) => {
    deploymentRequests += 1;
    return route.abort();
  });
  for (const pattern of [
    "https://api.openai.com/**",
    "https://api.anthropic.com/**",
    "https://generativelanguage.googleapis.com/**",
    "**/chat/providers/anthropic/**",
  ]) {
    await page.route(pattern, (route) => {
      providerRequests += 1;
      return route.abort();
    });
  }

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator('[data-testid="nav-tab-chat"]').click();
  await page.locator('[data-testid="chat-input"]').fill("Hola fixture");
  await page.locator('[data-testid="chat-send"]').click();
  await page.locator('[data-testid^="chat-message-assistant-"]')
    .filter({ hasText: "Fixture local de Gymnasia Coach" })
    .waitFor({ state: "visible", timeout: 30_000 });

  assert.equal(providerRequests, 0, "development fake no debe llamar a proveedores reales");
  assert.equal(deploymentRequests, 0, "development no debe consultar GitHub Deployments");
  log("fixture local verificado sin llamadas a proveedores ni deployments");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
