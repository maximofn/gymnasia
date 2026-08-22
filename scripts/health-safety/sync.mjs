import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import {
  loadHealthSafetyPolicy,
  promptPath,
  renderManagedBlock,
  replaceManagedBlock,
} from "./policy.mjs";

function usage() {
  console.error("Uso: node scripts/health-safety/sync.mjs --write|--check");
}

export function expectedPromptSource() {
  const data = loadHealthSafetyPolicy();
  const source = readFileSync(promptPath, "utf8");
  return replaceManagedBlock(source, renderManagedBlock(data));
}

function main() {
  const [mode, ...extra] = process.argv.slice(2);
  if (!["--write", "--check"].includes(mode) || extra.length > 0) {
    usage();
    process.exitCode = 2;
    return;
  }
  const data = loadHealthSafetyPolicy();
  const source = readFileSync(promptPath, "utf8");
  const expected = replaceManagedBlock(source, renderManagedBlock(data));
  if (mode === "--write") {
    writeFileSync(promptPath, expected, "utf8");
    console.log("Bloque sanitario actualizado en prompts/AGENTS.md.");
    return;
  }
  if (expected !== source) {
    console.error("El bloque sanitario no está sincronizado. Ejecuta: npm run sync:health-safety");
    process.exitCode = 1;
    return;
  }
  console.log("Bloque sanitario sincronizado con policy/health-safety/.");
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
