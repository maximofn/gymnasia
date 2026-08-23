// Tests de la política de permisos Android publicables (GYM-191).
//
// Cubren tres cosas distintas: que el repositorio real cumple la política
// (contrato), que el evaluador detecta cada forma de incumplimiento (unidad),
// y que el escáner de manifests realmente lee ficheros (vivacidad). Este último
// es el que impide que un walker roto deje pasar el chequeo para siempre.

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import fc from "fast-check";

import {
  checkAndroidPermissions,
  collectManifestPermissions,
  evaluatePermissionPolicy,
  extractManifestPermissions,
  loadPermissionPolicy,
  normalizePermission,
  packageNameForManifest,
  readConfiguredPermissions,
  repoRoot,
} from "./permissions.mjs";

const policy = loadPermissionPolicy();

// --- Contrato sobre el repositorio real -------------------------------------

test("el repositorio cumple la política de permisos Android", () => {
  const { violations } = checkAndroidPermissions();
  assert.deepEqual(violations, [], violations.map((v) => v.message).join("\n"));
});

test("USE_EXACT_ALARM no se declara y sí se bloquea", () => {
  const configured = readConfiguredPermissions(policy);
  assert.equal(configured.permissions.includes("USE_EXACT_ALARM"), false,
    "Google Play rechaza el AAB si la app declara USE_EXACT_ALARM.");
  assert.equal(configured.blockedPermissions.includes("USE_EXACT_ALARM"), true,
    "Sin blockedPermissions, una dependencia puede reintroducirlo por manifest merger.");
});

test("REQUEST_INSTALL_PACKAGES no se declara y sí se bloquea", () => {
  const configured = readConfiguredPermissions(policy);
  assert.equal(configured.permissions.includes("REQUEST_INSTALL_PACKAGES"), false,
    "La variante de Google Play no puede solicitar instalación de paquetes externos.");
  assert.equal(configured.blockedPermissions.includes("REQUEST_INSTALL_PACKAGES"), true,
    "Sin blockedPermissions, una dependencia puede reintroducirlo por manifest merger.");
});

test("SCHEDULE_EXACT_ALARM sigue declarado", () => {
  const configured = readConfiguredPermissions(policy);
  assert.equal(configured.permissions.includes("SCHEDULE_EXACT_ALARM"), true,
    "Es el permiso concedible por el usuario que conserva la puntualidad del aviso de descanso.");
});

test("ninguna dependencia instalada declara hoy un permiso prohibido", () => {
  const manifests = collectManifestPermissions(policy);
  const blocked = policy.blockedPermissions.map(normalizePermission);
  const offenders = manifests.filter((m) => m.permissions.some((p) => blocked.includes(p)));
  assert.deepEqual(offenders.map((m) => m.packageName), []);
});

// --- Vivacidad del escáner ---------------------------------------------------

test("el escáner encuentra manifests reales y lee sus permisos", () => {
  const manifests = collectManifestPermissions(policy);
  assert.ok(manifests.length > 0, "Sin manifests el escaneo no comprueba nada: falta 'npm ci'.");

  const notifications = manifests.find((m) => m.packageName === "expo-notifications");
  assert.ok(notifications, "expo-notifications debería aportar un AndroidManifest.xml.");
  assert.ok(
    notifications.permissions.includes("RECEIVE_BOOT_COMPLETED"),
    "Permiso conocido de expo-notifications; si no aparece, el parser está roto.",
  );
});

// --- Unidad: cada código de infracción ---------------------------------------

const baseConfigured = { permissions: [...policy.allowedPermissions], blockedPermissions: [...policy.blockedPermissions] };
const codesOf = (violations) => violations.map((v) => v.code);

test("config-blocked: el permiso prohibido vuelve a la configuración", () => {
  const violations = evaluatePermissionPolicy({
    policy,
    configured: { ...baseConfigured, permissions: [...baseConfigured.permissions, "USE_EXACT_ALARM"] },
    manifests: [],
  });
  assert.ok(codesOf(violations).includes("config-blocked"));
});

test("config-drift: detecta tanto un permiso extra como uno retirado", () => {
  const extra = evaluatePermissionPolicy({
    policy,
    configured: { ...baseConfigured, permissions: [...baseConfigured.permissions, "ACCESS_FINE_LOCATION"] },
    manifests: [],
  });
  assert.ok(codesOf(extra).includes("config-drift"));

  const removed = evaluatePermissionPolicy({
    policy,
    configured: { ...baseConfigured, permissions: baseConfigured.permissions.filter((p) => p !== "SCHEDULE_EXACT_ALARM") },
    manifests: [],
  });
  assert.ok(codesOf(removed).includes("config-drift"),
    "Retirar SCHEDULE_EXACT_ALARM sin actualizar la política debe fallar.");
});

test("config-missing-block: falta la entrada en blockedPermissions", () => {
  const violations = evaluatePermissionPolicy({
    policy,
    configured: { ...baseConfigured, blockedPermissions: [] },
    manifests: [],
  });
  assert.ok(codesOf(violations).includes("config-missing-block"));
});

test("dependency-contribution: una dependencia reintroduce el permiso", () => {
  const manifests = collectManifestPermissions(
    { ...policy, nodeModulesRoots: ["scripts/android-permissions/fixtures/deps"] },
    repoRoot,
  );
  assert.equal(manifests.length, 1, "El fixture debería aportar exactamente un manifest.");
  assert.equal(manifests[0].packageName, "fake-alarm-lib");

  const violations = evaluatePermissionPolicy({ policy, configured: baseConfigured, manifests });
  assert.ok(codesOf(violations).includes("dependency-contribution"));
});

test("acknowledgedContributors silencia una aportación ya neutralizada", () => {
  const manifests = collectManifestPermissions(
    { ...policy, nodeModulesRoots: ["scripts/android-permissions/fixtures/deps"] },
    repoRoot,
  );
  const violations = evaluatePermissionPolicy({
    policy: { ...policy, acknowledgedContributors: ["fake-alarm-lib"] },
    configured: baseConfigured,
    manifests,
  });
  assert.equal(codesOf(violations).includes("dependency-contribution"), false);
});

// --- Parseo del manifest -----------------------------------------------------

test("las entradas con tools:node=remove no cuentan como declaración", () => {
  const xml = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" tools:node="remove"/>
    <uses-permission android:name="android.permission.VIBRATE"/>
  </manifest>`;
  assert.deepEqual(extractManifestPermissions(xml), ["VIBRATE"],
    "tools:node=remove ordena eliminar el permiso; tratarlo como declaración daría un falso positivo.");
});

test("packageNameForManifest resuelve paquetes con y sin scope", () => {
  const root = join(repoRoot, "node_modules");
  assert.equal(packageNameForManifest(join(root, "expo-av", "android", "AndroidManifest.xml"), root), "expo-av");
  assert.equal(
    packageNameForManifest(join(root, "@react-native-community", "datetimepicker", "android", "AndroidManifest.xml"), root),
    "@react-native-community/datetimepicker",
  );
});

// --- Property-based ----------------------------------------------------------

test("normalizePermission es idempotente y equipara forma corta y larga", () => {
  fc.assert(fc.property(fc.stringMatching(/^[A-Z][A-Z0-9_]{0,30}$/), (name) => {
    assert.equal(normalizePermission(name), name);
    assert.equal(normalizePermission(`android.permission.${name}`), name);
    assert.equal(normalizePermission(normalizePermission(`android.permission.${name}`)), name);
  }));
});

test("ningún permiso aprobado está a la vez prohibido", () => {
  const allowed = new Set(policy.allowedPermissions.map(normalizePermission));
  for (const blocked of policy.blockedPermissions.map(normalizePermission)) {
    assert.equal(allowed.has(blocked), false, `${blocked} no puede estar aprobado y prohibido a la vez.`);
  }
});

test("cada permiso de la política tiene motivo documentado", () => {
  for (const permission of [...policy.allowedPermissions, ...policy.blockedPermissions]) {
    assert.ok(policy.rationale?.[normalizePermission(permission)],
      `Falta el motivo de ${permission} en policy.json; sin él nadie sabe si puede retirarse.`);
  }
});
