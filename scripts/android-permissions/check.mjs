#!/usr/bin/env node
// Verifica que la configuración Android publicable no declare permisos prohibidos
// y que ninguna dependencia los aporte por manifest merger (GYM-191).
//
//   node scripts/android-permissions/check.mjs --check
//   node scripts/android-permissions/check.mjs --json

import { checkAndroidPermissions } from "./permissions.mjs";

const mode = process.argv[2] ?? "--check";
if (!["--check", "--json"].includes(mode)) {
  console.error("Uso: node scripts/android-permissions/check.mjs --check|--json");
  process.exit(2);
}

const { policy, configured, manifests, violations } = checkAndroidPermissions();

if (mode === "--json") {
  console.log(JSON.stringify(
    {
      configPath: policy.configPath,
      allowedPermissions: policy.allowedPermissions,
      blockedPermissions: policy.blockedPermissions,
      expectedMergedExtras: policy.expectedMergedExtras ?? [],
      configured,
      scannedManifests: manifests.length,
      dependencyPermissions: [...new Set(manifests.flatMap((m) => m.permissions))].sort(),
      violations,
      notes: policy.notes ?? [],
    },
    null,
    2,
  ));
  process.exit(violations.length > 0 ? 1 : 0);
}

if (violations.length > 0) {
  console.error("Política de permisos Android incumplida:\n");
  for (const violation of violations) {
    console.error(`  [${violation.code}] ${violation.message}`);
  }
  console.error("\nPolítica: scripts/android-permissions/policy.json");
  process.exit(1);
}

console.log(
  `Permisos Android conformes: ${configured.permissions.length} aprobados, ` +
  `${configured.blockedPermissions.length} bloqueados, ` +
  `${manifests.length} manifests de dependencias escaneados.`,
);
