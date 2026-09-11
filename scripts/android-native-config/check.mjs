#!/usr/bin/env node

import { runProductionPrebuild } from "./native-config.mjs";

const mode = process.argv[2] ?? "--check";
if (!["--check", "--json"].includes(mode)) {
  console.error("Uso: node scripts/android-native-config/check.mjs --check|--json");
  process.exit(2);
}

const result = runProductionPrebuild();

if (mode === "--json") {
  console.log(JSON.stringify({
    manifest: result.manifest ?? null,
    notificationSounds: result.notificationSounds ?? [],
    warnings: result.warnings ?? [],
    violations: result.violations,
  }, null, 2));
  process.exit(result.violations.length > 0 ? 1 : 0);
}

if (result.violations.length > 0) {
  console.error("La configuración Android generada se ha desviado del contrato revisado:\n");
  for (const violation of result.violations) {
    console.error(`  [${violation.code}] ${violation.message}`);
  }
  if (result.output) console.error(`\nSalida de expo prebuild:\n${result.output}`);
  console.error("\nPolítica: scripts/android-native-config/policy.json");
  process.exit(1);
}

console.log(
  `Configuración Android conforme: ${result.manifest.declaredPermissions.length} permisos, `
  + `${result.manifest.removalDirectives.length} bloqueos y `
  + `${result.notificationSounds.length} sonidos generados sin advertencias.`,
);

