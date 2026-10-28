import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import {
  evaluateNativeConfig,
  extractPrebuildWarnings,
  loadNativeConfigPolicy,
  normalizePermission,
  parseSourceManifest,
} from "./native-config.mjs";

const policy = loadNativeConfigPolicy();
const validManifest = {
  declaredPermissions: [...policy.expectedSourcePermissions],
  removalDirectives: [...policy.expectedRemovalDirectives],
  applicationAttributes: { ...policy.application.attributes },
  activityAttributes: { ...policy.mainActivity.attributes },
};
const validMainActivity = policy.mainActivity.requiredMarkers.join("\n");

function validInput(overrides = {}) {
  return {
    policy,
    manifest: validManifest,
    mainActivity: validMainActivity,
    notificationSounds: [...policy.expectedNotificationSounds],
    gradleProperties: "AsyncStorage_db_size_in_MB=64\n",
    warnings: [],
    ...overrides,
  };
}

test("acepta el contrato semántico revisado", () => {
  assert.deepEqual(evaluateNativeConfig(validInput()), []);
});

test("impide volver a la cuota Android de 6 MiB o perderla durante prebuild", () => {
  for (const gradleProperties of [
    "",
    "# AsyncStorage_db_size_in_MB=64\n",
    "AsyncStorage_db_size_in_MB=6\n",
    "AsyncStorage_db_size_in_MB=64\nAsyncStorage_db_size_in_MB=6\n",
  ]) {
    const violations = evaluateNativeConfig(validInput({ gradleProperties }));
    assert.equal(violations.length, 1);
    assert.equal(violations[0].code, "gradle-property");
  }
});

test("detecta permisos, bloqueos y sonidos ausentes o inesperados", () => {
  const violations = evaluateNativeConfig(validInput({
    manifest: {
      ...validManifest,
      declaredPermissions: ["FOREGROUND_SERVICE", ...validManifest.declaredPermissions.slice(1)],
      removalDirectives: validManifest.removalDirectives.slice(1),
    },
    notificationSounds: ["rest_finished.wav", "surprise.wav"],
  }));
  const codes = new Set(violations.map(({ code }) => code));
  for (const code of [
    "source-permissions",
    "removal-directives",
    "notification-sounds",
    "forbidden-source-permission",
  ]) {
    assert.ok(codes.has(code), code);
  }
});

test("detecta cambios en MainActivity y advertencias de prebuild", () => {
  const violations = evaluateNativeConfig(validInput({
    manifest: {
      ...validManifest,
      activityAttributes: { ...validManifest.activityAttributes, "android:launchMode": "standard" },
    },
    mainActivity: validMainActivity.replace("moveTaskToBack(false)", "finish()"),
    warnings: ["» android: unexpected native fallback"],
  }));
  const codes = new Set(violations.map(({ code }) => code));
  assert.ok(codes.has("main-activity-attribute"));
  assert.ok(codes.has("main-activity-marker"));
  assert.ok(codes.has("prebuild-warning"));
});

test("parsea declaraciones, retiradas y atributos sin confundir tools:node=remove", () => {
  const manifest = parseSourceManifest(`<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.VIBRATE"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>
    <application android:enableOnBackInvokedCallback="false"><activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask"/></application>
  </manifest>`);
  assert.deepEqual(manifest.declaredPermissions, ["VIBRATE"]);
  assert.deepEqual(manifest.removalDirectives, ["RECORD_AUDIO"]);
  assert.equal(manifest.applicationAttributes["android:enableOnBackInvokedCallback"], "false");
  assert.equal(manifest.activityAttributes["android:exported"], "true");
});

test("solo extrae advertencias explícitas de la salida de prebuild", () => {
  assert.deepEqual(
    extractPrebuildWarnings("✔ Created native directory\n» android: falta un módulo\nWarning dependency drift"),
    ["» android: falta un módulo", "Warning dependency drift"],
  );
});

test("normalizar permisos es idempotente para cualquier nombre Android válido", () => {
  fc.assert(fc.property(fc.stringMatching(/^[A-Z][A-Z0-9_]{0,40}$/), (permission) => {
    assert.equal(normalizePermission(permission), permission);
    assert.equal(normalizePermission(`android.permission.${permission}`), permission);
    assert.equal(normalizePermission(normalizePermission(permission)), permission);
  }));
});

test("el orden y los duplicados no alteran los conjuntos exactos", () => {
  fc.assert(fc.property(fc.shuffledSubarray(policy.expectedNotificationSounds, {
    minLength: policy.expectedNotificationSounds.length,
    maxLength: policy.expectedNotificationSounds.length,
  }), (sounds) => {
    assert.deepEqual(evaluateNativeConfig(validInput({ notificationSounds: [...sounds, sounds[0]] })), []);
  }));
});
