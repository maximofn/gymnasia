#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const TERMINAL = new Set(["FINISHED", "ERRORED", "CANCELED"]);

export function extractSubmissionId(output) {
  const value = String(output ?? "");
  return value.match(new RegExp(`/submissions/(${UUID})(?:\\b|/)`, "i"))?.[1]
    ?? value.match(new RegExp(`\\b(${UUID})\\b`, "i"))?.[1]
    ?? null;
}

export function normalizeSubmission(value) {
  const submission = Array.isArray(value) ? value[0] : value;
  if (!submission?.id || !submission?.status) throw new Error("EAS no devolvió un submission identificable.");
  return {
    id: String(submission.id),
    status: String(submission.status).toUpperCase(),
    platform: String(submission.platform ?? "ANDROID").toUpperCase(),
    track: submission.androidConfig?.track ? String(submission.androidConfig.track).toLowerCase() : null,
    releaseStatus: submission.androidConfig?.releaseStatus
      ? String(submission.androidConfig.releaseStatus).toLowerCase()
      : null,
    createdAt: submission.createdAt ?? null,
    completedAt: submission.completedAt ?? null,
    canRetry: submission.canRetry ?? null,
    error: submission.error ? {
      code: String(submission.error.errorCode ?? "EAS_SUBMIT_ERROR").slice(0, 100),
      message: String(submission.error.message ?? "EAS Submit falló.")
        .replaceAll(/(?:expo|eas|google)?[_-]?(?:token|key|secret|credential)\s*[:=]\s*\S+/gi, "[credencial saneada]")
        .slice(0, 500),
    } : null,
  };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Argumento inválido: ${key}.`);
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function run(args) {
  const result = spawnSync("eas", args, {
    cwd: resolve("apps/mobile"),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) throw new Error(`EAS Submit terminó con código ${result.status}.`);
  return output;
}

function parseJsonOutput(output) {
  const candidates = String(output).trim().split(/\n(?=[{[])/).reverse();
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* try the next suffix */ }
  }
  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(output.slice(first, last + 1));
  throw new Error("EAS no devolvió JSON interpretable.");
}

function writeJson(path, value) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function view(submissionId) {
  return normalizeSubmission(parseJsonOutput(run(["submit:view", submissionId, "--json"])));
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!process.env.EXPO_TOKEN?.trim()) throw new Error("Falta EXPO_TOKEN en Play Internal.");
  if (!options.output) throw new Error("Falta --output.");
  if (command === "submit") {
    if (!options.artifact) throw new Error("Falta --artifact.");
    const output = run([
      "submit", "--platform", "android", "--profile", "production",
      "--path", resolve(options.artifact), "--non-interactive", "--no-wait",
    ]);
    const id = extractSubmissionId(output);
    if (!id) throw new Error("EAS aceptó la petición, pero no devolvió un submission ID; el estado queda incierto.");
    writeJson(options.output, { id, status: "NEW" });
    console.log(`Submission EAS creado: ${id}.`);
    return;
  }
  if (command === "retry") {
    if (!options["submission-id"]) throw new Error("Falta --submission-id.");
    const output = run(["submit:retry", options["submission-id"], "--json", "--non-interactive"]);
    const parsed = normalizeSubmission(parseJsonOutput(output));
    writeJson(options.output, parsed);
    console.log(`Submission EAS reintentado: ${parsed.id}.`);
    return;
  }
  if (command === "view") {
    if (!options["submission-id"]) throw new Error("Falta --submission-id.");
    writeJson(options.output, view(options["submission-id"]));
    return;
  }
  if (command === "wait") {
    if (!options["submission-id"]) throw new Error("Falta --submission-id.");
    const deadline = Date.now() + Number(options["timeout-ms"] ?? 45 * 60 * 1000);
    let submission;
    do {
      submission = view(options["submission-id"]);
      writeJson(options.output, submission);
      if (TERMINAL.has(submission.status)) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 30_000));
    } while (Date.now() < deadline);
    if (!TERMINAL.has(submission.status)) throw new Error("Timeout esperando EAS Submit; el submission conocido se reconciliará sin duplicarlo.");
    if (submission.status !== "FINISHED") throw new Error(submission.error?.message ?? `EAS Submit terminó en ${submission.status}.`);
    console.log(`Submission EAS validado: ${submission.id}.`);
    return;
  }
  throw new Error("Uso: eas-submit.mjs submit|retry|view|wait ...");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
}
