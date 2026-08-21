#!/usr/bin/env node
// Verifica que el inventario de datos publicable siga describiendo lo que la app
// hace de verdad: claves de almacenamiento, destinos de red y permisos (GYM-190).
//
//   node scripts/data-inventory/check.mjs --check
//   node scripts/data-inventory/check.mjs --json

import { checkDataInventory } from "./inventory.mjs";

const mode = process.argv[2] ?? "--check";
if (!["--check", "--json"].includes(mode)) {
  console.error("Uso: node scripts/data-inventory/check.mjs --check|--json");
  process.exit(2);
}

const { inventory, files, permissions, violations } = checkDataInventory();

if (mode === "--json") {
  console.log(JSON.stringify(
    {
      policyVersion: inventory.policyVersion,
      scannedFiles: files.length,
      storageKeys: inventory.storageKeys,
      secureStoreKeys: inventory.secureStoreKeys,
      networkEndpoints: inventory.networkEndpoints,
      configurableEndpoints: inventory.configurableEndpoints ?? [],
      permissions,
      permissionDataSafetyImpact: inventory.permissionDataSafetyImpact ?? {},
      mergedManifestDataSafetyImpact: inventory.mergedManifestDataSafetyImpact ?? {},
      violations,
      notes: inventory.notes ?? [],
    },
    null,
    2,
  ));
  process.exit(violations.length > 0 ? 1 : 0);
}

if (violations.length > 0) {
  console.error("El inventario de datos ya no describe el código:\n");
  for (const violation of violations) {
    console.error(`  [${violation.code}] ${violation.message}`);
  }
  console.error("\nInventario: scripts/data-inventory/inventory.json");
  console.error("Al cambiarlo, revisa también docs/legal/privacy-change-checklist.md.");
  process.exit(1);
}

const personalKeys = (inventory.storageKeys ?? []).filter((entry) => entry.personal).length;
console.log(
  `Inventario de datos conforme: ${inventory.storageKeys.length} claves de almacenamiento ` +
  `(${personalKeys} con datos personales), ${inventory.secureStoreKeys.length} entradas de SecureStore, ` +
  `${inventory.networkEndpoints.length} destinos de red, ${files.length} ficheros escaneados.`,
);
