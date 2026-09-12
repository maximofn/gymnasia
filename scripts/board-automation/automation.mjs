import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const ALERT_TITLE = "[board-sync] El tablero necesita atención";
export const ALERT_MARKER = "<!-- gymnasia-board-automation-alert:v1 -->";
const FINGERPRINT_MARKER = "gymnasia-board-automation-fingerprint";

function requireReport(report) {
  if (report?.schemaVersion !== 1 || typeof report?.changes !== "object") {
    throw new Error("El informe del tablero no cumple el schemaVersion 1.");
  }
  for (const key of ["states", "titles", "missingFromBoard", "missingFromLinear"]) {
    if (!Array.isArray(report.changes[key])) {
      throw new Error(`El informe del tablero no contiene changes.${key}.`);
    }
  }
  return report;
}

function safeRunUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("La URL de la ejecución no pertenece a github.com.");
  }
  return url.toString();
}

function ticketContext(identifier, context) {
  return `- ${identifier} (${context})`;
}

export function renderPullRequestBody(input) {
  const report = requireReport(input);
  if (report.status !== "safe_changes" || report.reviewRequiredCount !== 0) {
    throw new Error("Solo se puede describir una PR de cambios seguros.");
  }
  return [
    "## Resumen",
    "",
    "Sincronización mecánica del espejo con Linear. Los identificadores concretos están en el diff; se omiten aquí para que la integración GitHub–Linear no cambie estados por una mención textual.",
    "",
    `- Estados actualizados: ${report.changes.states.length}`,
    `- Títulos actualizados: ${report.changes.titles.length}`,
    "- Resúmenes, grupos, relaciones y orden editorial: sin cambios",
    "",
    "## Validación",
    "",
    "- `npm run test:linear`",
    "- `npm run test:board`",
    "- `npm run test:board:e2e`",
    "",
  ].join("\n");
}

export function problemPayload(kind, { report, evidence } = {}) {
  if (kind === "review-required") {
    const parsed = requireReport(report);
    if (parsed.status !== "review_required" || parsed.reviewRequiredCount < 1) {
      throw new Error("La alerta humana requiere un informe review_required no vacío.");
    }
    const additions = parsed.changes.missingFromBoard.map(({ id }) => ({
      id,
      context: "ticket nuevo pendiente de resumen, grupo y relaciones",
    }));
    const removals = parsed.changes.missingFromLinear.map(({ id }) => ({
      id,
      context: "entrada del tablero que ya no existe en Linear",
    }));
    return { kind, additions, removals };
  }
  if (kind === "production-mismatch") {
    return {
      kind,
      sourceCommit: evidence?.sourceCommit || "desconocido",
      localHash: evidence?.localHash || "no disponible",
      remoteHash: evidence?.remoteHash || "no disponible",
    };
  }
  if (["reconcile-failure", "deploy-failure"].includes(kind)) {
    return { kind };
  }
  throw new Error(`Tipo de alerta desconocido: ${kind}.`);
}

export function problemFingerprint(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function renderProblemComment(payload, runUrl) {
  const lines = [];
  if (payload.kind === "review-required") {
    lines.push(
      "## Linear requiere revisión humana",
      "",
      "La automatización no ha aplicado ningún cambio parcial. Hay que decidir el resumen, el grupo y las relaciones antes de modificar el tablero.",
    );
    if (payload.additions.length) {
      lines.push("", "Altas detectadas:", "", ...payload.additions.map(({ id, context }) => ticketContext(id, context)));
    }
    if (payload.removals.length) {
      lines.push("", "Bajas detectadas:", "", ...payload.removals.map(({ id, context }) => ticketContext(id, context)));
    }
  } else if (payload.kind === "production-mismatch") {
    lines.push(
      "## Producción no coincide con `main`",
      "",
      `- Commit esperado: \`${payload.sourceCommit}\``,
      `- SHA-256 local: \`${payload.localHash}\``,
      `- SHA-256 publicado: \`${payload.remoteHash}\``,
    );
  } else if (payload.kind === "reconcile-failure") {
    lines.push(
      "## Falló la conciliación automática",
      "",
      "No se pudo completar la lectura de Linear, la validación o la actualización de la PR automática. No se ha dado por sincronizado el tablero.",
    );
  } else {
    lines.push(
      "## Falló el despliegue automático",
      "",
      "No se pudo validar o publicar el tablero. La última versión correcta de producción continúa siendo la referencia hasta que una ejecución termine en verde.",
    );
  }
  const fingerprint = problemFingerprint(payload);
  lines.push(
    "",
    `[Ver ejecución](${safeRunUrl(runUrl)})`,
    "",
    `<!-- ${FINGERPRINT_MARKER}:${fingerprint} -->`,
    "",
  );
  return lines.join("\n");
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function githubRequester({ token, repository, fetchImpl = fetch }) {
  if (!token) throw new Error("Falta GITHUB_TOKEN para gestionar la alerta.");
  if (!/^[^/]+\/[^/]+$/.test(repository || "")) {
    throw new Error("GITHUB_REPOSITORY no tiene el formato owner/repo.");
  }
  return async (path, { method = "GET", body } = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers: githubHeaders(token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`GitHub API devolvió HTTP ${response.status}.`);
    }
    if (response.status === 204) return null;
    return response.json();
  };
}

export async function findAlertIssues(request) {
  const matches = [];
  for (let page = 1; page <= 10; page += 1) {
    const issues = await request(`/issues?state=all&per_page=100&page=${page}&sort=created&direction=asc`);
    matches.push(...issues.filter((issue) => (
      !issue.pull_request
      && issue.title === ALERT_TITLE
      && String(issue.body || "").includes(ALERT_MARKER)
    )));
    if (issues.length < 100) break;
  }
  return matches.sort((left, right) => left.number - right.number);
}

async function closeDuplicateIssues(request, issues) {
  const [canonical, ...duplicates] = issues;
  for (const duplicate of duplicates) {
    if (duplicate.state === "open") {
      await request(`/issues/${duplicate.number}`, {
        method: "PATCH",
        body: { state: "closed", state_reason: "not_planned" },
      });
    }
  }
  return canonical;
}

export async function ensureAlertIssue(request) {
  let issues = await findAlertIssues(request);
  if (!issues.length) {
    await request("/issues", {
      method: "POST",
      body: {
        title: ALERT_TITLE,
        body: [
          ALERT_MARKER,
          "Este issue único agrupa los problemas activos de sincronización y despliegue del tablero.",
          "La conciliación programada lo cerrará cuando Linear, `main` y producción vuelvan a coincidir.",
        ].join("\n\n"),
      },
    });
    issues = await findAlertIssues(request);
  }
  const issue = await closeDuplicateIssues(request, issues);
  if (!issue) throw new Error("GitHub no devolvió la issue de alerta recién creada.");
  const wasClosed = issue.state !== "open";
  if (wasClosed) {
    await request(`/issues/${issue.number}`, { method: "PATCH", body: { state: "open" } });
  }
  return { issue, wasClosed };
}

export async function publishProblem({ request, payload, runUrl }) {
  const { issue, wasClosed } = await ensureAlertIssue(request);
  const fingerprint = problemFingerprint(payload);
  const comments = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await request(`/issues/${issue.number}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const alreadyReported = comments.some((comment) => (
    String(comment.body || "").includes(`<!-- ${FINGERPRINT_MARKER}:${fingerprint} -->`)
  ));
  if (!alreadyReported || wasClosed) {
    await request(`/issues/${issue.number}/comments`, {
      method: "POST",
      body: { body: renderProblemComment(payload, runUrl) },
    });
  }
  return issue.number;
}

export async function closeHealthy({ request, runUrl }) {
  const issues = await findAlertIssues(request);
  for (const issue of issues) {
    if (issue.state !== "open") continue;
    await request(`/issues/${issue.number}/comments`, {
      method: "POST",
      body: {
        body: `Linear, \`main\` y producción vuelven a coincidir. [Ver comprobación](${safeRunUrl(runUrl)}).`,
      },
    });
    await request(`/issues/${issue.number}`, {
      method: "PATCH",
      body: { state: "closed", state_reason: "completed" },
    });
  }
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!key?.startsWith("--") || rest[index + 1] === undefined) {
      throw new Error(`Argumento incompleto: ${key || "(vacío)"}.`);
    }
    options[key.slice(2)] = rest[index + 1];
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === "pr-body") {
    process.stdout.write(renderPullRequestBody(JSON.parse(readFileSync(options.report, "utf8"))));
    return;
  }
  const request = githubRequester({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
  });
  if (command === "healthy") {
    await closeHealthy({ request, runUrl: options["run-url"] });
    return;
  }
  if (command !== "problem") throw new Error(`Comando desconocido: ${command || "(vacío)"}.`);
  const report = options.report ? JSON.parse(readFileSync(options.report, "utf8")) : undefined;
  const evidence = options.evidence ? JSON.parse(readFileSync(options.evidence, "utf8")) : undefined;
  const payload = problemPayload(options.kind, { report, evidence });
  await publishProblem({ request, payload, runUrl: options["run-url"] });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
