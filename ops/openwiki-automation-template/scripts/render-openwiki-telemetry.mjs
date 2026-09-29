import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readTelemetryFile } from "./openwiki-telemetry.mjs";

export const MANAGED_START = "<!-- OPENWIKI_RUNTIME_TELEMETRY:START -->";
export const MANAGED_END = "<!-- OPENWIKI_RUNTIME_TELEMETRY:END -->";

const PAGE_RELATIVE_PATH = "openwiki/operations/openwiki-automation.md";
const CLAIMS_RELATIVE_PATH = "openwiki/.claims/operations/openwiki-automation.json";
const MANIFEST_RELATIVE_PATH = "openwiki/.page-manifest.json";
const TELEMETRY_RELATIVE_PATH = "ops/openwiki-runtime-telemetry.json";
const MANIFEST_PAGE_KEY = `/${PAGE_RELATIVE_PATH}`;
const INSERT_BEFORE = "## Cambio y validación focalizada";

const FAILURE_LABELS = Object.freeze({
  oauth: "OAuth",
  "managed-markers": "marcadores gestionados",
  langsmith: "LangSmith",
  "rate-limit": "límite de uso",
  model: "modelo",
  "context-limit": "límite de contexto",
  network: "red",
  unknown: "desconocidos",
});

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "fecha no disponible";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  })
    .format(date)
    .replaceAll(".", "");
}

function formatDuration(value) {
  if (!Number.isFinite(value)) {
    return "no disponible";
  }
  if (value < 1_000) {
    return `${Math.round(value)} ms`;
  }
  const seconds = Math.round(value / 1_000);
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}

function formatCount(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : "no disponible";
}

function formatCost(cost) {
  if (cost.state === "zero") {
    return "0 USD (no hubo llamadas de modelo)";
  }
  if (cost.state !== "measured") {
    return "no disponible";
  }
  return `${cost.totalUsd.toFixed(4)} USD (${cost.coverage === "complete" ? "cobertura completa" : "cobertura parcial"})`;
}

function formatTokens(tokens) {
  if (tokens.state === "zero") {
    return "0 (no hubo llamadas de modelo)";
  }
  if (tokens.state !== "measured") {
    return "no disponibles";
  }
  return `${tokens.total.toLocaleString("es-ES")} (${tokens.coverage === "complete" ? "cobertura completa" : "cobertura parcial"})`;
}

function nonZeroFailures(failures) {
  return Object.entries(failures)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `${FAILURE_LABELS[category]}: ${count}`)
    .join(" · ") || "ninguno";
}

export function buildManagedSection(telemetry) {
  const lines = [MANAGED_START, "## Telemetría agregada de los últimos 7 días", ""];
  if (telemetry.latestAttempt.status === "unavailable") {
    lines.push(
      `> ⚠️ La consulta más reciente a LangSmith no estuvo disponible${telemetry.latestAttempt.at ? ` el ${formatDate(telemetry.latestAttempt.at)}` : ""}. Se conserva la última muestra válida sin bloquear la actualización documental.`,
      "",
    );
  }
  if (!telemetry.sample) {
    lines.push(
      "Todavía no existe una muestra válida. El runner publicará aquí únicamente agregados saneados cuando complete su primera consulta.",
      "",
      MANAGED_END,
    );
    return lines.join("\n");
  }

  const sample = telemetry.sample;
  const suffix = sample.truncated
    ? " La consulta alcanzó el límite de 900 spans; los conteos son una cota inferior."
    : "";
  lines.push(
    `Muestra recogida el **${formatDate(sample.collectedAt)}**, desde el ${formatDate(sample.windowStartAt)} hasta el ${formatDate(sample.windowEndAt)}.${suffix}`,
    "",
    "| Señal | Resultado |",
    "| --- | --- |",
    `| Ejecuciones raíz | ${sample.roots.total} totales · ${sample.roots.succeeded} correctas · ${sample.roots.failed} fallidas · ${sample.roots.unknown} sin resultado |`,
    `| Fallos por categoría | ${nonZeroFailures(sample.failures)} |`,
    `| Duración de ejecución | p50 ${formatDuration(sample.durationMs.roots.p50)} · p95 ${formatDuration(sample.durationMs.roots.p95)} · máximo ${formatDuration(sample.durationMs.roots.max)} |`,
    `| Duración de modelo | p50 ${formatDuration(sample.durationMs.models.p50)} · p95 ${formatDuration(sample.durationMs.models.p95)} |`,
    `| Duración de herramientas | p50 ${formatDuration(sample.durationMs.tools.p50)} · p95 ${formatDuration(sample.durationMs.tools.p95)} |`,
    `| Llamadas de modelo | ${sample.llm.calls} · p50 ${formatCount(sample.llm.callsPerRoot.p50)} por ejecución |`,
    `| Herramientas | búsqueda ${sample.tools.categories.search} · lectura ${sample.tools.categories.read} · escritura ${sample.tools.categories.write} · comandos ${sample.tools.categories.command} · otras ${sample.tools.categories.other} |`,
    `| Tokens | ${formatTokens(sample.llm.tokens)} |`,
    `| Coste | ${formatCost(sample.llm.cost)} |`,
    "",
    "Los ceros de tokens o coste que devuelve LangSmith se consideran **dato no disponible** cuando sí hubo llamadas de modelo. Solo se publica cero real si no hubo ninguna llamada. Las categorías de herramientas son fijas; los nombres no reconocidos cuentan como `otras` y nunca se publican.",
    "",
    "La muestra no contiene inputs, outputs, metadatos, nombres de trazas, identificadores, argumentos, resultados, URLs, rutas ni texto de errores. Los fallos se clasifican en memoria y solo sale su categoría permitida.",
    "",
    MANAGED_END,
  );
  return lines.join("\n");
}

export function replaceManagedSection(page, section) {
  const managedStart = page.indexOf(MANAGED_START);
  const managedEnd = page.indexOf(MANAGED_END);
  if (managedStart >= 0 || managedEnd >= 0) {
    if (managedStart < 0 || managedEnd < managedStart) {
      throw new Error("Runtime telemetry markers are malformed.");
    }
    return `${page.slice(0, managedStart)}${section}${page.slice(managedEnd + MANAGED_END.length)}`;
  }

  const insertionPoint = page.indexOf(INSERT_BEFORE);
  if (insertionPoint < 0) {
    throw new Error("Runtime telemetry insertion boundary was not found.");
  }
  return `${page.slice(0, insertionPoint)}${section}\n\n${page.slice(insertionPoint)}`;
}

export async function renderTelemetryPage(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const telemetry = await readTelemetryFile(
    path.join(root, TELEMETRY_RELATIVE_PATH),
  );
  if (!telemetry) {
    throw new Error("The public telemetry snapshot is invalid.");
  }

  const pagePath = path.join(root, PAGE_RELATIVE_PATH);
  const manifestPath = path.join(root, MANIFEST_RELATIVE_PATH);
  const claimsPath = path.join(root, CLAIMS_RELATIVE_PATH);
  const [currentPage, manifest, claims] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(claimsPath, "utf8").then(JSON.parse),
  ]);
  const nextPage = replaceManagedSection(
    currentPage,
    buildManagedSection(telemetry),
  );
  if (!manifest.pages?.[MANIFEST_PAGE_KEY] || !claims.pageVersion) {
    throw new Error("Runtime telemetry OpenWiki metadata is missing.");
  }
  const pageVersion = `sha256:${createHash("sha256").update(nextPage).digest("hex")}`;
  manifest.pages[MANIFEST_PAGE_KEY].pageVersion = pageVersion;
  claims.pageVersion = pageVersion;
  await Promise.all([
    writeFile(pagePath, nextPage, "utf8"),
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(claimsPath, `${JSON.stringify(claims, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write("runtime_telemetry_page=updated\n");
}

async function main() {
  const [repositoryRoot] = process.argv.slice(2);
  if (!repositoryRoot) {
    throw new Error("Expected the target repository path.");
  }
  await renderTelemetryPage(repositoryRoot);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}
