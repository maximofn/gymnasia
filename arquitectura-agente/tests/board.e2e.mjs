/**
 * E2E del tablero con Playwright, sirviendo el directorio estático tal cual se
 * despliega en Vercel. Verifica que lo que hay en board.json acaba en pantalla
 * y que en móvil nada se sale del ancho de la ventana.
 *
 *   node arquitectura-agente/tests/board.e2e.mjs
 *   BOARD_E2E_HEADLESS=0 node arquitectura-agente/tests/board.e2e.mjs
 */
import assert from "node:assert/strict";
import http from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const board = JSON.parse(readFileSync(join(root, "data", "board.json"), "utf8"));

const PORT = Number.parseInt(process.env.BOARD_E2E_PORT ?? "8123", 10);
const HEADLESS = process.env.BOARD_E2E_HEADLESS !== "0";
const STEP_TIMEOUT_MS = 15000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function logStep(message) {
  console.log(`[board-e2e] ${message}`);
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(root, relative === "/" ? "index.html" : relative);

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

const tickets = board.groups.flatMap((group) => group.tickets);
const epics = board.groups.filter((group) => group.kind === "epic");

async function run() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}`;
  logStep(`Serving ${root} on ${baseUrl}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const failures = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") failures.push(`console.error: ${msg.text()}`);
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("body[data-ready='true']", { timeout: STEP_TIMEOUT_MS });
    logStep("Tablero cargado");

    // --- Vista de épicas: todo el JSON debe estar en pantalla ---------------
    const epicCards = await page.locator("#view-epics > .epic").count();
    assert.equal(epicCards, board.groups.length, "faltan grupos en la vista de épicas");

    const renderedIds = await page.locator("#view-epics .ticket .ticket-id").allInnerTexts();
    for (const ticket of tickets) {
      assert.ok(renderedIds.includes(ticket.id), `${ticket.id} no aparece en la vista de épicas`);
    }
    assert.equal(renderedIds.length, tickets.length, "hay tickets repetidos o de más");
    logStep(`${tickets.length} tickets y ${board.groups.length} grupos renderizados`);

    for (const epic of epics) {
      const heading = page.locator(".epic-title", { hasText: epic.title });
      assert.equal(await heading.count(), 1, `no se ve el título de la épica ${epic.id}`);
    }

    const progressText = await page.locator(".epic .progress-text").first().innerText();
    assert.match(progressText, /^\d+\/\d+ · \d+%$/, "la barra de progreso no muestra el ratio");

    // --- Solo el nombre del ticket lleva a Linear ---------------------------
    const firstTicketId = renderedIds[0];
    const href = await page
      .locator("#view-epics .ticket a.ticket-title")
      .first()
      .getAttribute("href");
    assert.equal(href, `${board.meta.linearBase}${firstTicketId}`, "enlace a Linear incorrecto");
    assert.equal(
      await page.locator("#view-epics .ticket .ticket-id a").count(),
      0,
      "el identifier no debe ser un enlace: solo el nombre lleva a Linear",
    );

    // --- Plegado de tickets -------------------------------------------------
    const firstTicket = page.locator("#view-epics .ticket").first();
    assert.equal(
      await firstTicket.locator(".ticket-detail").isVisible(),
      false,
      "los tickets deben nacer plegados",
    );
    await firstTicket.locator(".ticket-id").click();
    await firstTicket.locator(".ticket-detail").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    assert.equal(
      await firstTicket.locator(".toggle-caret").getAttribute("aria-expanded"),
      "true",
      "el aria-expanded del ticket no se actualiza",
    );
    await firstTicket.locator(".ticket-id").click();
    await firstTicket.locator(".ticket-detail").waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });

    // Y el estado de plegado sobrevive a un re-render por filtro.
    await firstTicket.locator(".ticket-id").click();
    await firstTicket.locator(".ticket-detail").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    await page.fill("#search", "GYM");
    await page.fill("#search", "");
    assert.equal(
      await page.locator("#view-epics .ticket").first().locator(".ticket-detail").isVisible(),
      true,
      "el ticket expandido se pliega solo al filtrar",
    );
    await page.locator("#view-epics .ticket").first().locator(".ticket-id").click();

    // --- Plegado de épicas --------------------------------------------------
    const firstEpic = page.locator("#view-epics > .epic").first();
    assert.equal(
      await firstEpic.locator(".ticket-list").isVisible(),
      true,
      "las épicas deben nacer abiertas",
    );
    await firstEpic.locator(".epic-title-row .epic-kind").click();
    await firstEpic.locator(".ticket-list").waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
    await firstEpic.locator(".epic-title-row .epic-kind").click();
    await firstEpic.locator(".ticket-list").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
    logStep("Plegado de tickets y épicas ok");

    // --- Filtro de búsqueda -------------------------------------------------
    await page.fill("#search", "tool_choice");
    await page.waitForFunction(
      () => document.querySelectorAll("#view-epics .ticket").length === 1,
      null,
      { timeout: STEP_TIMEOUT_MS },
    );
    assert.equal(
      await page.locator("#view-epics .ticket .ticket-id").innerText(),
      "GYM-44",
      "la búsqueda no filtra por título ni resumen",
    );
    await page.fill("#search", "");
    await page.waitForFunction(
      (expected) => document.querySelectorAll("#view-epics .ticket").length === expected,
      tickets.length,
      { timeout: STEP_TIMEOUT_MS },
    );
    logStep("Filtro de búsqueda ok");

    // --- Vista por estado ---------------------------------------------------
    await page.click(".tab-btn[data-view='states']");
    await page.waitForSelector("#view-states.active", { timeout: STEP_TIMEOUT_MS });
    const columns = await page.locator(".column").count();
    assert.equal(columns, board.states.length, "faltan columnas de estado");
    const cards = await page.locator(".card").count();
    assert.equal(cards, tickets.length, "la vista por estado no muestra todos los tickets");
    logStep(`${columns} columnas y ${cards} tarjetas`);

    // --- Vista de dependencias ----------------------------------------------
    await page.click(".tab-btn[data-view='deps']");
    await page.waitForSelector("#view-deps.active", { timeout: STEP_TIMEOUT_MS });

    const graphNodes = await page.locator("#graph .gnode").count();
    assert.ok(graphNodes > 0, "el grafo de dependencias está vacío");
    const graphEdges = await page.locator("#graph .gedge").count();
    assert.ok(graphEdges > 0, "el grafo no tiene aristas");

    const declaredEdges = [...board.groups, ...tickets].reduce(
      (total, node) => total + (node.dependsOn?.length ?? 0),
      0,
    );
    assert.equal(graphEdges, declaredEdges, "las aristas no cuadran con las dependencias del JSON");

    assert.ok(
      (await page.locator(".blocker-row").count()) > 0,
      "no se lista ningún bloqueante",
    );

    // Seleccionar un nodo aísla sus dependencias.
    await page.click("#graph .gnode[data-id='GYM-34']");
    await page.waitForSelector("#graph.has-selection", { timeout: STEP_TIMEOUT_MS });
    assert.ok(
      (await page.locator("#graph .gedge.on").count()) > 0,
      "seleccionar un nodo no resalta sus aristas",
    );
    await page.click("#graph .gnode[data-id='GYM-34']");

    // Las relaciones no bloqueantes añaden aristas, no las quitan.
    await page.check("#show-related");
    const withRelated = await page.locator("#graph .gedge").count();
    assert.ok(withRelated > graphEdges, "el toggle de relaciones no añade aristas");
    await page.uncheck("#show-related");
    logStep(`Grafo: ${graphNodes} nodos, ${graphEdges} aristas de bloqueo`);

    // --- Responsive: nada se sale del ancho en móvil ------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of ["epics", "states", "deps"]) {
      await page.click(`.tab-btn[data-view='${view}']`);
      await page.waitForSelector(`#view-${view}.active`, { timeout: STEP_TIMEOUT_MS });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert.ok(overflow <= 1, `la vista "${view}" desborda ${overflow}px en móvil`);
    }
    logStep("Responsive 390x844 ok");

    if (failures.length) {
      throw new Error(`Errores en la página:\n  ${failures.join("\n  ")}`);
    }

    logStep("PASS");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(`[board-e2e] FAIL: ${error.message}`);
  process.exitCode = 1;
});
