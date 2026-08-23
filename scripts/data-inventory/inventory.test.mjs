// Tests del guard rail del inventario de datos (GYM-190).
//
// Lo que importa aquí no es que el inventario actual pase, sino que el chequeo
// FALLE cuando alguien añade una clave o un destino sin declararlo. Un guard rail
// que solo sabe decir que sí no protege de nada.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkDataInventory,
  collectSourceFiles,
  evaluateDataInventory,
  findLiteral,
  loadInventory,
  readPermissionSources,
  readSources,
  repoRoot,
  scanHosts,
  scanStorageKeys,
  stripComments,
  unescapeRegexDots,
} from "./inventory.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "App.fixture.tsx");
const fixtureSources = [{ path: fixturePath, source: readFileSync(fixturePath, "utf8") }];

const emptyPermissions = { allowedPermissions: [], expectedMergedExtras: [] };

function codesFor(violations) {
  return violations.map((violation) => violation.code);
}

test("el escáner reconoce ambos separadores de clave", () => {
  const keys = scanStorageKeys(fixtureSources);
  assert.ok(keys.has("gymnasia.mobile.fixture.v1"));
  assert.ok(keys.has("gymnasia_fixture_traces"));
});

test("el escáner no confunde BACKUP_APP_ID con una clave de almacenamiento", () => {
  // "gymnasia" a secas es el identificador del formato de copia de seguridad.
  // Sin el separador obligatorio, cada ejecución pediría declararlo como clave.
  assert.equal(scanStorageKeys(fixtureSources).has("gymnasia"), false);
});

test("el escáner encuentra los hosts https del código", () => {
  const hosts = scanHosts(fixtureSources);
  assert.ok(hosts.has("fixture.example.com"));
  assert.ok(hosts.has("api.openai.com"));
});

test("una clave de almacenamiento sin declarar rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: { storageKeys: [], secureStoreKeys: [], networkEndpoints: [] },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  const undeclared = violations.filter((v) => v.code === "storage-key-undeclared");
  assert.deepEqual(
    undeclared.map((v) => v.subject).sort(),
    ["gymnasia.mobile.fixture.v1", "gymnasia_fixture_traces"],
  );
  assert.match(undeclared[0].message, /App\.fixture\.tsx/);
});

test("una clave declarada que ya no existe en el código rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [{ key: "gymnasia.mobile.retirada.v1" }],
      secureStoreKeys: [],
      networkEndpoints: [],
    },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  assert.ok(codesFor(violations).includes("storage-key-stale"));
});

test("un destino de red sin declarar rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [],
      networkEndpoints: [{ host: "api.openai.com" }],
    },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  const undeclared = violations.filter((v) => v.code === "endpoint-undeclared");
  assert.deepEqual(undeclared.map((v) => v.subject), ["fixture.example.com"]);
});

test("un destino declarado que ya no existe menciona su ticket de retirada", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [],
      networkEndpoints: [{ host: "vivagym.myvitale.com", plannedRemoval: "GYM-192" }],
    },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  const stale = violations.find((v) => v.code === "endpoint-stale");
  assert.ok(stale);
  assert.match(stale.message, /GYM-192/);
});

test("una entrada de SecureStore que ya no existe rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [{ key: "vivagym.email" }],
      networkEndpoints: [{ host: "api.openai.com" }, { host: "fixture.example.com" }],
    },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  assert.ok(codesFor(violations).includes("securestore-key-stale"));
});

test("un permiso aprobado sin calificar para Data safety rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [],
      networkEndpoints: [{ host: "api.openai.com" }, { host: "fixture.example.com" }],
      permissionsSource: "scripts/android-permissions/policy.json",
      permissionDataSafetyImpact: {},
    },
    sources: fixtureSources,
    permissions: { allowedPermissions: ["VIBRATE"], expectedMergedExtras: ["CAMERA"] },
  });
  const codes = codesFor(violations);
  assert.ok(codes.includes("permission-impact-missing"));
  assert.ok(codes.includes("merged-permission-impact-missing"));
});

test("un permiso calificado que la política ya no aprueba rompe el chequeo", () => {
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [],
      networkEndpoints: [{ host: "api.openai.com" }, { host: "fixture.example.com" }],
      permissionsSource: "scripts/android-permissions/policy.json",
      permissionDataSafetyImpact: { USE_EXACT_ALARM: "none" },
    },
    sources: fixtureSources,
    permissions: emptyPermissions,
  });
  assert.ok(codesFor(violations).includes("permission-impact-stale"));
});

test("un ejemplo dentro de un comentario no cuenta como conexión real", () => {
  const withComments = [
    { path: "/fake/a.ts", source: '// Ejemplo de ataque: https://user:pass@malicioso.example\nconst x = 1;' },
    { path: "/fake/b.ts", source: '/* Docs: https://docs.example.com */\nconst y = "https://real.example/x";' },
  ].map(({ path, source }) => ({ path, source: stripComments(source) }));
  const hosts = scanHosts(withComments);
  assert.equal(hosts.has("user"), false);
  assert.equal(hosts.has("docs.example.com"), false);
  assert.ok(hosts.has("real.example"));
});

test("un host escrito como expresión regular se lee entero", () => {
  // `https://github\\.com/...` dentro de un new RegExp se leía como el host "github".
  const sources = [
    { path: "/fake/a.ts", source: 'new RegExp(`^https://github\\\\.com/owner/repo$`)' },
  ].map(({ path, source }) => ({ path, source: unescapeRegexDots(source) }));
  const hosts = scanHosts(sources);
  assert.ok(hosts.has("github.com"));
  assert.equal(hosts.has("github"), false);
});

test("un namespace de entorno no es una clave de almacenamiento", () => {
  // scopedStorageKey antepone "gymnasia.production" a cada clave: es el prefijo del
  // almacén, no una entrada con datos dentro.
  const sources = [{ path: "/fake/app.config.ts", source: 'storageNamespace: "gymnasia.production"' }];
  const violations = evaluateDataInventory({
    inventory: {
      storageKeys: [],
      secureStoreKeys: [],
      networkEndpoints: [],
      storageNamespaces: ["gymnasia.production"],
    },
    sources,
    permissions: emptyPermissions,
  });
  assert.deepEqual(violations, []);
});

test("un namespace sin declarar sí rompe el chequeo", () => {
  const sources = [{ path: "/fake/app.config.ts", source: 'storageNamespace: "gymnasia.qa"' }];
  const violations = evaluateDataInventory({
    inventory: { storageKeys: [], secureStoreKeys: [], networkEndpoints: [], storageNamespaces: [] },
    sources,
    permissions: emptyPermissions,
  });
  assert.ok(codesFor(violations).includes("storage-key-undeclared"));
});

test("los ficheros de test no se escanean", () => {
  // Sus literales describen casos —una URL de ejemplo, un host que se rechaza— y
  // declararlos como tratamiento real vaciaría de sentido el inventario.
  const inventory = loadInventory();
  const files = collectSourceFiles(inventory, repoRoot);
  assert.equal(files.some((file) => /\.(test|spec|e2e)\.tsx?$/.test(file)), false);
  assert.ok(files.some((file) => file.endsWith("App.tsx")));
});

test("findLiteral distingue presencia de ausencia", () => {
  assert.ok(findLiteral(fixtureSources, "gymnasia.mobile.fixture.v1"));
  assert.equal(findLiteral(fixtureSources, "gymnasia.mobile.inexistente"), null);
});

test("un scanRoots que no existe no puede pasar en verde", () => {
  const inventory = { ...loadInventory(), scanRoots: ["directorio/que/no/existe"] };
  assert.deepEqual(collectSourceFiles(inventory, repoRoot), []);
});

test("el fixture no se cuela en el escaneo real", () => {
  // scripts/ no está en scanRoots. Si alguien lo añadiera, el fixture metería
  // una clave y un host inventados en el inventario de producción.
  const inventory = loadInventory();
  const files = collectSourceFiles(inventory, repoRoot);
  assert.equal(files.some((file) => file.includes("App.fixture.tsx")), false);
});

test("el inventario declarado describe el árbol real", () => {
  const { violations, files } = checkDataInventory();
  assert.deepEqual(violations, []);
  assert.ok(files.length > 0);
});

test("cada entrada declarada explica su propósito y su ciclo de vida", () => {
  const inventory = loadInventory();
  const validLifecycles = ["reset", "startup-migration", "traces-button", "never"];
  for (const entry of [...inventory.storageKeys, ...inventory.secureStoreKeys]) {
    assert.ok(entry.purpose?.length > 20, `${entry.key} necesita un propósito legible`);
    assert.ok(typeof entry.personal === "boolean", `${entry.key} debe decir si es personal`);
    assert.ok(
      validLifecycles.includes(entry.clearedBy),
      `${entry.key} tiene un clearedBy desconocido: ${entry.clearedBy}`,
    );
  }
  for (const endpoint of inventory.networkEndpoints) {
    assert.ok(endpoint.sends?.length > 20, `${endpoint.host} necesita decir qué envía`);
    assert.ok(
      ["automatic", "user-initiated", "model-initiated"].includes(endpoint.trigger),
      `${endpoint.host} tiene un disparador desconocido: ${endpoint.trigger}`,
    );
  }
});

test("los permisos no se duplican: se leen del guard rail que los gobierna", () => {
  const inventory = loadInventory();
  assert.equal(inventory.permissions, undefined);
  const permissions = readPermissionSources(inventory, repoRoot);
  assert.ok(permissions.allowedPermissions.includes("SCHEDULE_EXACT_ALARM"));
});

test("readSources lee cada fichero una sola vez", () => {
  const sources = readSources([fixturePath, fixturePath]);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].source, sources[1].source);
});
