import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TARGET_REPOSITORY = "maximofn/gymnasia";
const MODEL_LABEL = "ChatGPT · gpt-5.6-terra";
const PAGE_TITLES = Object.freeze({
  "openwiki/agent/provider-streaming.md": "Streaming de proveedores",
  "openwiki/agent/runtime.md": "Runtime del agente",
  "openwiki/mobile/diet-and-food-estimation.md":
    "Dieta y estimación de alimentos",
  "openwiki/operations/build-release-and-testing.md":
    "Compilación, publicación y pruebas",
  "openwiki/operations/prompt-policy-governance.md":
    "Gobierno de políticas de prompt",
  "openwiki/quickstart.md": "Guía rápida",
});

function firstRun(payload) {
  return Array.isArray(payload?.workflow_runs) ? payload.workflow_runs[0] : undefined;
}

function allSteps(payload) {
  return Array.isArray(payload?.jobs)
    ? payload.jobs.flatMap((job) => (Array.isArray(job.steps) ? job.steps : []))
    : [];
}

function step(payload, name) {
  return allSteps(payload).find((candidate) => candidate?.name === name);
}

function stepSucceeded(payload, name) {
  return step(payload, name)?.conclusion === "success";
}

function stepSkipped(payload, name) {
  return step(payload, name)?.conclusion === "skipped";
}

function safeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDuration(startValue, endValue) {
  const start = safeDate(startValue);
  const end = safeDate(endValue);
  if (!start || !end || end < start) {
    return "";
  }

  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (seconds < 60) {
    return `${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}

function stepDuration(payload, name) {
  const record = step(payload, name);
  return record ? formatDuration(record.started_at, record.completed_at) : "";
}

function jobDuration(payload) {
  const job = Array.isArray(payload?.jobs) ? payload.jobs[0] : undefined;
  return job ? formatDuration(job.started_at, job.completed_at) : "";
}

function formatReportDate(now) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Madrid",
    year: "numeric",
  })
    .format(now)
    .replaceAll(".", "");
}

function formatHistoryDate(value) {
  const date = safeDate(value);
  return date ? formatReportDate(date) : "fecha desconocida";
}

function failureHistory(payload) {
  const runs = Array.isArray(payload?.workflow_runs)
    ? payload.workflow_runs
    : [];
  const latest = runs[0];
  if (
    latest?.status !== "completed" ||
    !latest.conclusion ||
    latest.conclusion === "success"
  ) {
    return [];
  }

  const streak = [];
  let lastSuccess;
  for (const run of runs) {
    if (run?.status !== "completed") {
      continue;
    }
    if (run.conclusion === "success") {
      lastSuccess = run;
      break;
    }
    streak.push(run);
  }

  if (streak.length === 0) {
    return [];
  }

  const oldestFailure = streak.at(-1);
  return [
    `🔁 Fallos consecutivos: ${streak.length} · desde ${formatHistoryDate(oldestFailure?.created_at)}`,
    lastSuccess
      ? `🕘 Último éxito: ${formatHistoryDate(lastSuccess.created_at)}`
      : "🕘 Último éxito: no aparece en las últimas 30 ejecuciones",
  ];
}

function safeGitHubUrl(value, fallback) {
  try {
    const url = new URL(String(value));
    if (url.protocol === "https:" && url.hostname === "github.com") {
      return url.href;
    }
  } catch {
    // Only a canonical GitHub URL may enter the Telegram message.
  }
  return fallback;
}

function overallStatus(run, now) {
  if (!run) {
    return "⚠️ Sin ejecuciones registradas";
  }

  const createdAt = safeDate(run.created_at);
  const ageHours = createdAt
    ? Math.floor((now.getTime() - createdAt.getTime()) / 3_600_000)
    : 0;
  if (ageHours > 30) {
    return `🔴 Última ejecución hace ${ageHours} h`;
  }
  if (run.status === "queued") {
    return "🟠 Actualización en cola";
  }
  if (run.status === "in_progress") {
    return "🔵 Actualización en curso";
  }
  if (run.conclusion === "success") {
    return "✅ Actualización completa";
  }
  const conclusion = {
    cancelled: "cancelada",
    failure: "fallida",
    skipped: "omitida",
    stale: "obsoleta",
    timed_out: "sin tiempo",
  }[run.conclusion] || "fallida";
  return `🔴 Actualización ${conclusion}`;
}

function triggerLabel(event) {
  return {
    schedule: "programada",
    workflow_dispatch: "manual",
  }[event] || "automática";
}

function codeBrainLabel(jobs) {
  if (stepSucceeded(jobs, "Mark OpenAI OAuth failure")) {
    return "🔴 Code Brain bloqueado por OAuth";
  }
  if (stepSucceeded(jobs, "Mark OpenWiki non-auth failure")) {
    return "🔴 Code Brain falló antes de publicar";
  }
  if (stepSucceeded(jobs, "Run OpenWiki")) {
    const duration = stepDuration(jobs, "Run OpenWiki");
    return `✅ Code Brain actualizado${duration ? ` · ${duration}` : ""}`;
  }
  if (step(jobs, "Run OpenWiki")?.status === "in_progress") {
    return "🔵 Code Brain en ejecución";
  }
  return "⚪ Code Brain sin resultado";
}

function documentationLabel(jobs) {
  if (stepSucceeded(jobs, "Push fixed branch and create or update pull request")) {
    return "📝 Rama de documentación y PR actualizadas";
  }
  if (
    stepSucceeded(jobs, "Commit generated documentation") &&
    stepSkipped(jobs, "Push fixed branch and create or update pull request")
  ) {
    return "🟰 Sin cambios documentales nuevos";
  }
  return "⚪ No se publicaron cambios documentales";
}

function oauthLabel(jobs, run) {
  if (stepSucceeded(jobs, "Mark OpenWiki configuration missing")) {
    return "⚪ OAuth: runner sin configurar";
  }
  if (stepSucceeded(jobs, "Mark encrypted OAuth state failure")) {
    return "🔴 OAuth: estado cifrado inválido";
  }
  if (stepSucceeded(jobs, "Mark OpenAI OAuth failure")) {
    return "🔴 OAuth: login expirado o revocado";
  }
  if (stepSucceeded(jobs, "Mark OAuth persistence failure")) {
    return "🔴 OAuth: no se pudo persistir la renovación";
  }
  if (
    stepSucceeded(jobs, "Persist encrypted OAuth state") &&
    run?.conclusion === "success"
  ) {
    return "✅ OAuth: sesión válida · estado cifrado persistido";
  }
  return "⚪ OAuth: sin resultado concluyente";
}

function personalBrainLabel(jobs, run) {
  const failures = [
    ["Mark Personal Brain configuration failure", "configuración inválida"],
    ["Mark Personal Brain state failure", "estado cifrado inválido"],
    ["Mark Personal Brain onboarding failure", "configuración local fallida"],
    ["Mark Personal Brain update failure", "actualización fallida"],
    ["Mark Personal Brain persistence failure", "persistencia fallida"],
  ];
  for (const [name, reason] of failures) {
    if (stepSucceeded(jobs, name)) {
      return `🔴 Personal Brain: ${reason}`;
    }
  }
  if (stepSucceeded(jobs, "Mark Personal Brain sources missing")) {
    return "⚪ Personal Brain: sin fuentes configuradas";
  }
  if (
    stepSucceeded(jobs, "Update Personal Brain without LangSmith tracing") &&
    stepSucceeded(jobs, "Persist encrypted Personal Brain state") &&
    run?.conclusion === "success"
  ) {
    const duration = stepDuration(
      jobs,
      "Update Personal Brain without LangSmith tracing",
    );
    return `✅ Personal Brain actualizado y cifrado${duration ? ` · ${duration}` : ""}`;
  }
  return "⚪ Personal Brain: sin resultado concluyente";
}

function sourceLabel(jobs) {
  const sources = [
    ["Confirm Personal Brain Linear source", "Linear (solo metadatos)"],
    ["Confirm Personal Brain repository source", "maximofn.com"],
    ["Confirm Personal Brain Tavily source", "Tavily"],
  ]
    .filter(([stepName]) => stepSucceeded(jobs, stepName))
    .map(([, label]) => label);

  if (sources.length > 0) {
    return `Fuentes confirmadas: ${sources.join(" · ")}`;
  }
  if (stepSucceeded(jobs, "Update Personal Brain without LangSmith tracing")) {
    return "Fuentes configuradas: Linear · maximofn.com · Tavily";
  }
  return "Fuentes: sin confirmación";
}

function pullRequestSummary(pullRequests, currentRunPublished) {
  const pull = Array.isArray(pullRequests) ? pullRequests[0] : undefined;
  if (!pull || !Number.isInteger(pull.number)) {
    return { label: "🟰 Sin PR de documentación", url: "" };
  }

  const changedFiles = Number.isFinite(pull.changedFiles) ? pull.changedFiles : 0;
  const additions = Number.isFinite(pull.additions) ? pull.additions : 0;
  const deletions = Number.isFinite(pull.deletions) ? pull.deletions : 0;
  const stats = `${changedFiles} archivos · +${additions}/−${deletions}`;
  let state = "cerrada sin fusionar";
  let icon = "⚪";
  if (pull.state === "OPEN") {
    state = "abierta";
    icon = "🟡";
  } else if (pull.mergedAt) {
    state = "fusionada";
    icon = "✅";
  }

  const context = currentRunPublished
    ? "PR de esta ejecución:"
    : "Última PR conocida:";

  return {
    highlights: pullRequestHighlights(pull),
    label: `${icon} ${context} #${pull.number} ${state} · ${stats}`,
    url: safeGitHubUrl(pull.url, ""),
  };
}

function recoveryGuidance(jobs) {
  if (stepSucceeded(jobs, "Mark OpenAI OAuth failure")) {
    return [
      "",
      "🚨 ACCIÓN NECESARIA",
      "Abre OpenWiki en el Mac, ejecuta una consulta breve para renovar la sesión y vuelve a cargar el OAuth cifrado del runner.",
    ];
  }
  if (stepSucceeded(jobs, "Mark encrypted OAuth state failure")) {
    return [
      "",
      "🚨 ACCIÓN NECESARIA",
      "Vuelve a cargar el OAuth cifrado del runner; el estado guardado no se pudo descifrar.",
    ];
  }
  return [];
}

function pullRequestHighlights(pull) {
  if (!Array.isArray(pull?.files)) {
    return [];
  }

  const pages = pull.files
    .filter(
      ({ path }) =>
        typeof path === "string" &&
        /^openwiki\/[A-Za-z0-9_./-]+\.md$/u.test(path) &&
        !path.endsWith("/index.md"),
    )
    .map(({ additions, deletions, path }) => ({
      additions: Number.isFinite(additions) ? Math.max(0, additions) : 0,
      deletions: Number.isFinite(deletions) ? Math.max(0, deletions) : 0,
      path,
      title:
        PAGE_TITLES[path] ||
        path
          .split("/")
          .at(-1)
          .replace(/\.md$/u, "")
          .replaceAll(/[-_]+/gu, " ")
          .replace(/^./u, (character) => character.toUpperCase()),
    }))
    .sort(
      (left, right) =>
        right.additions + right.deletions - (left.additions + left.deletions) ||
        left.path.localeCompare(right.path),
    );

  const highlights = pages
    .slice(0, 3)
    .map(
      ({ additions, deletions, title }) =>
        `• ${title} · +${additions}/−${deletions}`,
    );
  if (pages.length > highlights.length) {
    const remaining = pages.length - highlights.length;
    highlights.push(`• ${remaining} ${remaining === 1 ? "página" : "páginas"} más`);
  }
  return highlights;
}

export function buildDailyReport({ runs, jobs, pullRequests, now = new Date() }) {
  const run = firstRun(runs);
  const fallbackRunUrl = `https://github.com/${TARGET_REPOSITORY}-openwiki-automation/actions/workflows/openwiki-update.yml`;
  const runUrl = safeGitHubUrl(run?.html_url, fallbackRunUrl);
  const duration = jobDuration(jobs);
  const trigger = triggerLabel(run?.event);
  const meta = duration ? `⏱ ${duration} · ${trigger}` : `⏱ ${trigger}`;
  const currentRunPublished = stepSucceeded(
    jobs,
    "Push fixed branch and create or update pull request",
  );
  const pull = pullRequestSummary(pullRequests, currentRunPublished);
  const history = failureHistory(runs);
  const guidance = recoveryGuidance(jobs);

  const lines = [
    `🧠 OpenWiki Gymnasia · ${formatReportDate(now)}`,
    "",
    overallStatus(run, now),
    meta,
    `🤖 ${MODEL_LABEL}`,
    ...history,
    "",
    "📚 CODE BRAIN",
    codeBrainLabel(jobs),
    documentationLabel(jobs),
    "🇪🇺 LangSmith · inputs, outputs y metadatos ocultos",
    "",
    "🔐 ESTADO PRIVADO",
    oauthLabel(jobs, run),
    personalBrainLabel(jobs, run),
    sourceLabel(jobs),
    ...guidance,
    "",
    "📦 DOCUMENTACIÓN",
    pull.label,
  ];

  if (pull.highlights?.length > 0) {
    lines.push("Cambios destacados:", ...pull.highlights);
  }

  if (pull.url) {
    lines.push(`🔗 ${pull.url}`);
  }
  lines.push(`⚙️ ${runUrl}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const [runsPath, jobsPath, pullRequestsPath, outputPath] = process.argv.slice(2);
  if (!runsPath || !jobsPath || !pullRequestsPath || !outputPath) {
    throw new Error("Expected runs, jobs, pull requests, and output paths.");
  }

  const [runs, jobs, pullRequests] = await Promise.all(
    [runsPath, jobsPath, pullRequestsPath].map(async (filePath) =>
      JSON.parse(await readFile(filePath, "utf8")),
    ),
  );
  const report = buildDailyReport({ runs, jobs, pullRequests });
  await writeFile(outputPath, report, { encoding: "utf8", mode: 0o600 });
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}
