#!/usr/bin/env node
// Genera la política publicada y el módulo que consume la app a partir de la
// fuente única en docs/legal/ (GYM-190).
//
//   node scripts/legal/generate.mjs --write
//   node scripts/legal/generate.mjs --check

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

import { buildArtifacts, loadPolicies, repoRoot, validatePolicies } from "./policy.mjs";

const mode = process.argv[2];
if (!["--write", "--check"].includes(mode)) {
  console.error("Uso: node scripts/legal/generate.mjs --write|--check");
  process.exit(2);
}

const policies = loadPolicies();
const violations = validatePolicies(policies);

// La validación corre en ambos modos: escribir una política inválida es peor que
// no escribirla, porque el artefacto malo queda commiteado y parece revisado.
if (violations.length > 0) {
  console.error("La política de privacidad no puede publicarse todavía:\n");
  for (const violation of violations) {
    console.error(`  [${violation.code}] ${violation.message}`);
  }
  console.error("\nFuente: docs/legal/privacy-policy.{es,en}.md");
  process.exit(1);
}

const artifacts = buildArtifacts(policies);

if (mode === "--write") {
  for (const [path, contents] of artifacts) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  console.log(
    `Política sincronizada (${policies.map((policy) => policy.locale).join(", ")}): ` +
    `${artifacts.length} artefactos generados.`,
  );
} else {
  const drift = [];
  for (const [path, expected] of artifacts) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      drift.push(`${relative(repoRoot, path)}: no existe`);
      continue;
    }
    if (current !== expected) {
      drift.push(`${relative(repoRoot, path)}: no corresponde a docs/legal/privacy-policy.{es,en}.md`);
    }
  }
  if (drift.length > 0) {
    console.error(drift.join("\n"));
    console.error("Ejecuta: npm run sync:legal");
    process.exit(1);
  }
  console.log(
    `Política de privacidad verificada: ${policies.length} idiomas, ` +
    `${policies[0].sections.length} secciones, artefactos al día.`,
  );
}
