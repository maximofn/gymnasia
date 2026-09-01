#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluateProductionVersionChange,
  latestSemver,
  repositoryRoot,
} from "./production-release.mjs";

const appJsonPath = join(repositoryRoot, "apps", "mobile", "app.json");

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || !["check", "prepare"].includes(command)) {
    throw new Error("Uso: release-version.mjs check|prepare [--base SHA] [--head SHA].");
  }
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Argumento inválido: ${key || "(vacío)"}.`);
    }
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} terminó con código ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function splitLines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function versionAt(ref) {
  const contents = runGit(["show", `${ref}:apps/mobile/app.json`]);
  return JSON.parse(contents).expo.version;
}

function localPublishedVersions() {
  return splitLines(runGit(["tag", "--list", "v*"]));
}

function publishedVersion(options) {
  const declared = String(options["published-versions"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return latestSemver(declared.length > 0 ? declared : localPublishedVersions());
}

function evaluateRange({ base, head, headVersion, options, extraFiles = [], extraSubjects = [] }) {
  const changedFiles = [
    ...splitLines(runGit(["diff", "--name-only", `${base}...${head}`])),
    ...extraFiles,
  ];
  const subjects = [
    ...splitLines(runGit(["log", "--format=%s", `${base}..${head}`])),
    ...extraSubjects,
  ];
  return evaluateProductionVersionChange({
    baseVersion: versionAt(base),
    latestPublishedVersion: publishedVersion(options),
    headVersion,
    changedFiles: [...new Set(changedFiles)],
    subjects,
  });
}

function printResult(result) {
  if (!result.applies) {
    console.log("El cambio no produce un binario Android distinto; no necesita incrementar versión.");
    return;
  }
  console.log(
    `Versión Production: base ${result.baseline}, incremento ${result.bump}, esperada ${result.expectedVersion}.`,
  );
}

function check(options) {
  const base = options.base;
  const head = options.head ?? "HEAD";
  if (!base) throw new Error("check exige --base con el SHA base del PR o push.");
  const result = evaluateRange({ base, head, headVersion: versionAt(head), options });
  printResult(result);
  if (result.violations.length > 0) {
    for (const violation of result.violations) console.error(`[${violation.code}] ${violation.message}`);
    process.exitCode = 1;
  }
}

function prepare(options) {
  const base = options.base ?? "origin/main";
  const head = options.head ?? "HEAD";
  const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const workingFiles = splitLines(runGit(["diff", "--name-only", base], { allowFailure: true }));
  const result = evaluateRange({
    base,
    head,
    headVersion: appJson.expo.version,
    options,
    extraFiles: workingFiles,
    extraSubjects: options.subject ? [options.subject] : [],
  });
  if (!result.applies) throw new Error("No hay cambios que disparen un binario Production.");
  appJson.expo.version = result.expectedVersion;
  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, "utf8");
  printResult(result);
  console.log(`apps/mobile/app.json actualizado a ${result.expectedVersion}.`);
}

try {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === "check") check(options);
  else prepare(options);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
