#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  assertWorkflowPolicy,
  codeownersPath,
  loadPolicy,
  renderCodeowners,
  renderRuleset,
  rulesetPath,
} from "./policy.mjs";

const mode = process.argv[2];
if (!["--write", "--check"].includes(mode)) {
  console.error("Uso: node scripts/prompt-policy/generate.mjs --write|--check");
  process.exit(2);
}

const policy = loadPolicy();
const artifacts = [
  [codeownersPath, renderCodeowners(policy)],
  [rulesetPath, renderRuleset(policy)],
];

if (mode === "--write") {
  for (const [path, contents] of artifacts) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  console.log("Política de prompt sincronizada.");
} else {
  const drift = [];
  for (const [path, expected] of artifacts) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      drift.push(`${path}: no existe`);
      continue;
    }
    if (current !== expected) {
      drift.push(`${path}: no corresponde a .github/prompt-policy.json`);
    }
  }
  assertWorkflowPolicy();
  if (drift.length > 0) {
    console.error(drift.join("\n"));
    console.error("Ejecuta: npm run sync:prompt-policy");
    process.exit(1);
  }
  console.log("Política, CODEOWNERS, ruleset y workflows verificados.");
}
