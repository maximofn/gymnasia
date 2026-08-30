#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../..");
export const devStorePath = "apps/mobile/.dev-store.json";

export function evaluateDevStoreGuard({ gitignore, trackedOutput }) {
  const violations = [];
  const ignored = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".dev-store.json" || line === devStorePath || line === `/${devStorePath}`);
  if (!ignored) violations.push(".dev-store.json no está protegido por .gitignore");
  if (trackedOutput.trim()) violations.push(`${devStorePath} está versionado`);
  return violations;
}

export function checkDevStoreGuard(root = repoRoot) {
  const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
  const trackedOutput = execFileSync(
    "git",
    ["ls-files", "--stage", "--", devStorePath],
    { cwd: root, encoding: "utf8" },
  );
  return evaluateDevStoreGuard({ gitignore, trackedOutput });
}

export function runCheck() {
  const violations = checkDevStoreGuard();
  if (violations.length > 0) {
    console.error("El espejo de desarrollo no es seguro para confirmar:");
    violations.forEach((violation) => console.error(`- ${violation}`));
    return 1;
  }
  console.log("Espejo de desarrollo protegido: ignorado y fuera del índice Git.");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCheck();
}
