#!/usr/bin/env node

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LINEAR_ENDPOINT = "https://api.linear.app/graphql";
const SECRET_PATTERN = /\b(password|contrase(?:ñ|n)a|api[ _-]?key|secret|token)\b\s*[:=]?\s*\S*/giu;

const QUERY = `
  query PersonalBrainSnapshot($issueLimit: Int!, $projectLimit: Int!) {
    viewer { name }
    issues(first: $issueLimit, orderBy: updatedAt) {
      nodes {
        identifier
        title
        url
        createdAt
        updatedAt
        assignee { name }
        state { name }
        team { key name }
        project { name url }
        labels(first: 20) { nodes { name } }
      }
    }
    projects(first: $projectLimit) {
      nodes {
        id
        name
        url
        createdAt
        updatedAt
      }
    }
  }
`;

function redact(value) {
  return String(value ?? "")
    .replace(SECRET_PATTERN, "$1=[REDACTED]")
    .replace(/[\r\n]+/gu, " ")
    .trim();
}

function safeLinearUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "linear.app" ? url.href : "";
  } catch {
    return "";
  }
}

function formatLink(label, url) {
  const safeUrl = safeLinearUrl(url);
  return safeUrl ? `[${redact(label)}](${safeUrl})` : redact(label);
}

export function buildLinearMarkdown(data, generatedAt = new Date().toISOString()) {
  const issues = Array.isArray(data?.issues?.nodes) ? data.issues.nodes : [];
  const projects = Array.isArray(data?.projects?.nodes) ? data.projects.nodes : [];
  const lines = [
    "# Linear — snapshot de solo lectura",
    "",
    `Generado: ${generatedAt}`,
    "",
    "Este export incluye únicamente metadatos. Omite descripciones, comentarios,",
    "adjuntos y correo del usuario para reducir el riesgo de capturar secretos.",
    "",
    "## Proyectos",
    "",
  ];

  if (projects.length === 0) {
    lines.push("- Ninguno.");
  } else {
    for (const project of projects) {
      lines.push(
        `- ${formatLink(project.name, project.url)} — actualizado ${redact(project.updatedAt) || "desconocido"}`,
      );
    }
  }

  lines.push("", "## Issues actualizadas recientemente", "");
  if (issues.length === 0) {
    lines.push("- Ninguna.");
  } else {
    for (const issue of issues) {
      const labels = Array.isArray(issue?.labels?.nodes)
        ? issue.labels.nodes.map((label) => redact(label?.name)).filter(Boolean)
        : [];
      const fields = [
        issue?.state?.name ? `estado: ${redact(issue.state.name)}` : null,
        issue?.assignee?.name ? `responsable: ${redact(issue.assignee.name)}` : null,
        issue?.project?.name ? `proyecto: ${redact(issue.project.name)}` : null,
        labels.length > 0 ? `etiquetas: ${labels.join(", ")}` : null,
        issue?.updatedAt ? `actualizado: ${redact(issue.updatedAt)}` : null,
      ].filter(Boolean);
      const label = `${redact(issue.identifier)} ${redact(issue.title)}`.trim();
      lines.push(`- ${formatLink(label, issue.url)}${fields.length > 0 ? ` — ${fields.join("; ")}` : ""}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function fetchLinearSnapshot(apiKey, fetchImpl = fetch) {
  const response = await fetchImpl(LINEAR_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { issueLimit: 100, projectLimit: 50 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Linear API returned HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`Linear GraphQL query failed: ${redact(payload.errors[0]?.message) || "unknown error"}.`);
  }
  if (!payload?.data) {
    throw new Error("Linear GraphQL response did not contain data.");
  }
  return payload.data;
}

async function main() {
  const outputDirectory = process.argv[2];
  const apiKey = process.env.LINEAR_READONLY_API_KEY;
  if (!outputDirectory) {
    throw new Error("Usage: export-linear.mjs <output-directory>");
  }
  if (!apiKey) {
    throw new Error("LINEAR_READONLY_API_KEY is required.");
  }

  const data = await fetchLinearSnapshot(apiKey);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const outputPath = path.join(outputDirectory, "linear.md");
  await writeFile(outputPath, buildLinearMarkdown(data), { encoding: "utf8", mode: 0o600 });
  await chmod(outputPath, 0o600);
  console.log(`Exported ${data.issues?.nodes?.length ?? 0} Linear issues without descriptions or comments.`);
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Unknown Linear export error.");
    process.exitCode = 1;
  });
}
