// Inventario de tratamiento de datos publicable (GYM-190).
//
// La política de privacidad publicada afirma qué guarda Gymnasia y a quién se lo
// envía. Ese texto no puede validarse solo leyéndolo: se queda obsoleto en cuanto
// alguien añade una clave de almacenamiento o llama a un host nuevo, y nadie se
// entera hasta que la revisión de Google Play contrasta la declaración con el
// artefacto. Este módulo compara el inventario declarado con lo que el código
// hace de verdad, para que esa deriva rompa el CI en vez de la revisión.
//
// Sin dependencias externas y sin efectos secundarios, para que el chequeo pueda
// correr en cualquier workflow sin red ni SDK de Android.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, "..", "..");
export const inventoryPath = join(here, "inventory.json");

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

// Los tests no se ejecutan en el dispositivo: sus literales describen casos, no
// tratamiento de datos. Escanearlos haría que cada aserción sobre una URL pidiera
// declararla como destino real.
const TEST_FILE_PATTERN = /\.(test|spec|e2e)\.tsx?$/;

// Los literales de clave empiezan por `gymnasia.` o `gymnasia_`. El separador es
// obligatorio a propósito: BACKUP_APP_ID vale exactamente "gymnasia" y no es una
// clave de almacenamiento.
const STORAGE_KEY_PATTERN = /["'`](gymnasia[._][A-Za-z0-9_.]+)["'`]/g;
const HTTPS_HOST_PATTERN = /https:\/\/([A-Za-z0-9.-]+)/g;

export function loadInventory(path = inventoryPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walkForSources(directory, ignoreDirectories, accumulator) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries) {
    // No seguimos symlinks: con install-strategy=nested pueden formar ciclos, y
    // lo que enlazan ya se visita por su ruta real.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (ignoreDirectories.includes(entry.name)) continue;
      walkForSources(join(directory, entry.name), ignoreDirectories, accumulator);
    } else if (
      SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
      !TEST_FILE_PATTERN.test(entry.name)
    ) {
      accumulator.push(join(directory, entry.name));
    }
  }
  return accumulator;
}

/** Ficheros TypeScript de la app que el inventario dice cubrir. */
export function collectSourceFiles(inventory, root = repoRoot) {
  const ignoreDirectories = inventory.scanIgnoreDirectories ?? [];
  const files = [];
  for (const scanRoot of inventory.scanRoots ?? []) {
    walkForSources(join(root, scanRoot), ignoreDirectories, files);
  }
  return files;
}

/**
 * Quita comentarios antes de escanear. Un ejemplo dentro de un comentario —una URL
 * de documentación, o el `https://user:pass@host` que ilustra un ataque— no es una
 * conexión que la app haga, y pedir declararlo entrenaría a ignorar el chequeo.
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/**
 * Deshace los escapes de las expresiones regulares escritas como cadena. Sin esto,
 * `https://github\\.com/...` dentro de un `new RegExp(...)` se lee como el host
 * "github", que no existe.
 */
export function unescapeRegexDots(source) {
  return source.replace(/\\\\\./g, ".");
}

/** Lee cada fichero una sola vez: App.tsx pesa 1 MB y se escanea tres veces. */
export function readSources(files) {
  return files.map((path) => ({
    path,
    source: unescapeRegexDots(stripComments(readFileSync(path, "utf8"))),
  }));
}

export function scanStorageKeys(sources) {
  const found = new Map();
  for (const { path, source } of sources) {
    for (const [, key] of source.matchAll(STORAGE_KEY_PATTERN)) {
      if (!found.has(key)) found.set(key, path);
    }
  }
  return found;
}

export function scanHosts(sources) {
  const found = new Map();
  for (const { path, source } of sources) {
    for (const [, host] of source.matchAll(HTTPS_HOST_PATTERN)) {
      if (!found.has(host)) found.set(host, path);
    }
  }
  return found;
}

export function findLiteral(sources, literal) {
  const needle = `"${literal}"`;
  const alternatives = [needle, `'${literal}'`, `\`${literal}\``];
  for (const { path, source } of sources) {
    if (alternatives.some((candidate) => source.includes(candidate))) return path;
  }
  return null;
}

function relativeToRoot(path, root) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

/**
 * Contrasta el inventario declarado con lo que aparece en el código.
 * Devuelve la lista de infracciones; vacía significa que la política publicada
 * sigue describiendo la aplicación.
 */
export function evaluateDataInventory({ inventory, sources, permissions, root = repoRoot }) {
  const violations = [];

  const declaredAsyncKeys = new Set(
    (inventory.storageKeys ?? []).map((entry) => entry.key),
  );
  // Los namespaces no son claves: son el prefijo que scopedStorageKey antepone para
  // que cada entorno (development, staging, production) tenga su propio almacén.
  const declaredNamespaces = new Set(inventory.storageNamespaces ?? []);
  const declaredSecureKeys = inventory.secureStoreKeys ?? [];
  const declaredSecureLiterals = new Set(declaredSecureKeys.map((entry) => entry.key));
  const foundKeys = scanStorageKeys(sources);

  for (const [key, path] of foundKeys) {
    if (declaredAsyncKeys.has(key) || declaredSecureLiterals.has(key)) continue;
    if (declaredNamespaces.has(key)) continue;
    violations.push({
      code: "storage-key-undeclared",
      subject: key,
      message: `${relativeToRoot(path, root)} usa la clave de almacenamiento ${key}, que el inventario no declara. Añádela con su propósito y su categoría, y revisa si la política publicada debe mencionarla.`,
    });
  }

  for (const entry of inventory.storageKeys ?? []) {
    if (foundKeys.has(entry.key)) continue;
    violations.push({
      code: "storage-key-stale",
      subject: entry.key,
      message: `El inventario declara la clave ${entry.key}, que ya no aparece en el código. Si la retirada es intencionada, quítala del inventario y actualiza la política.`,
    });
  }

  for (const entry of declaredSecureKeys) {
    if (findLiteral(sources, entry.key)) continue;
    violations.push({
      code: "securestore-key-stale",
      subject: entry.key,
      message: `El inventario declara la entrada de SecureStore ${entry.key}, que ya no aparece en el código. Si la retirada es intencionada, quítala del inventario y actualiza la política.`,
    });
  }

  const declaredHosts = new Set((inventory.networkEndpoints ?? []).map((entry) => entry.host));
  const foundHosts = scanHosts(sources);

  for (const [host, path] of foundHosts) {
    if (declaredHosts.has(host)) continue;
    violations.push({
      code: "endpoint-undeclared",
      subject: host,
      message: `${relativeToRoot(path, root)} contacta con ${host}, que el inventario no declara. Declara qué se le envía y con qué disparador, y refleja el tercero en la política publicada.`,
    });
  }

  for (const entry of inventory.networkEndpoints ?? []) {
    if (foundHosts.has(entry.host)) continue;
    violations.push({
      code: "endpoint-stale",
      subject: entry.host,
      message: `El inventario declara el destino ${entry.host}, que ya no aparece en el código${entry.plannedRemoval ? ` (retirada prevista en ${entry.plannedRemoval})` : ""}. Quítalo del inventario y actualiza la política.`,
    });
  }

  const impact = inventory.permissionDataSafetyImpact ?? {};
  for (const permission of permissions.allowedPermissions) {
    if (permission in impact) continue;
    violations.push({
      code: "permission-impact-missing",
      subject: permission,
      message: `${inventory.permissionsSource} aprueba el permiso ${permission}, pero el inventario no dice cómo afecta a Data safety. Añádelo a permissionDataSafetyImpact.`,
    });
  }
  for (const permission of Object.keys(impact)) {
    if (permissions.allowedPermissions.includes(permission)) continue;
    violations.push({
      code: "permission-impact-stale",
      subject: permission,
      message: `El inventario califica el permiso ${permission}, que ${inventory.permissionsSource} ya no aprueba. Quítalo de permissionDataSafetyImpact.`,
    });
  }

  const mergedImpact = inventory.mergedManifestDataSafetyImpact ?? {};
  for (const permission of permissions.expectedMergedExtras) {
    if (permission in mergedImpact) continue;
    violations.push({
      code: "merged-permission-impact-missing",
      subject: permission,
      message: `${inventory.permissionsSource} espera que las dependencias aporten ${permission} al manifest fusionado, pero el inventario no dice cómo afecta a Data safety. Añádelo a mergedManifestDataSafetyImpact.`,
    });
  }

  return violations;
}

/** Lee del guard rail de permisos, que es la fuente de verdad de esa lista. */
export function readPermissionSources(inventory, root = repoRoot) {
  const policy = JSON.parse(readFileSync(join(root, inventory.permissionsSource), "utf8"));
  return {
    allowedPermissions: policy.allowedPermissions ?? [],
    expectedMergedExtras: policy.expectedMergedExtras ?? [],
  };
}

/**
 * Chequeo completo. Un escaneo sin ficheros se trata como error: si el árbol no
 * se pudo leer, todas las comprobaciones pasarían en verde sin haber mirado nada.
 */
export function checkDataInventory(root = repoRoot) {
  const inventory = loadInventory();
  const files = collectSourceFiles(inventory, root);
  const sources = readSources(files);
  const permissions = readPermissionSources(inventory, root);

  const violations = evaluateDataInventory({ inventory, sources, permissions, root });
  if (files.length === 0) {
    violations.push({
      code: "scanner-empty",
      subject: null,
      message: `No se encontró ningún fichero TypeScript bajo ${(inventory.scanRoots ?? []).join(", ")}. El escaneo no ha comprobado nada: revisa scanRoots antes de dar el inventario por bueno.`,
    });
  }

  return { inventory, files, permissions, violations };
}
