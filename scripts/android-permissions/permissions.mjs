// Política de permisos Android publicables (GYM-191).
//
// Google Play reserva android.permission.USE_EXACT_ALARM a las apps cuya función
// principal es despertador o calendario. Gymnasia no lo es, así que declararlo
// hace que la revisión rechace el AAB. Este módulo comprueba dos vías de entrada
// del permiso: la configuración de Expo y los AndroidManifest.xml que las
// dependencias aportan al manifest merger.
//
// Sin dependencias externas y sin efectos secundarios, para que el chequeo pueda
// correr en cualquier workflow sin SDK de Android ni red.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, "..", "..");
export const policyPath = join(here, "policy.json");

const ANDROID_PERMISSION_PREFIX = "android.permission.";
const MANIFEST_FILENAME = "AndroidManifest.xml";

/** Quita el prefijo `android.permission.` para poder comparar formas corta y larga. */
export function normalizePermission(permission) {
  const trimmed = String(permission).trim();
  return trimmed.startsWith(ANDROID_PERMISSION_PREFIX)
    ? trimmed.slice(ANDROID_PERMISSION_PREFIX.length)
    : trimmed;
}

export function loadPermissionPolicy(path = policyPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Lee `expo.android.permissions` y `expo.android.blockedPermissions` de app.json. */
export function readConfiguredPermissions(policy, root = repoRoot) {
  const config = JSON.parse(readFileSync(join(root, policy.configPath), "utf8"));
  const android = config?.expo?.android ?? {};
  return {
    permissions: (android.permissions ?? []).map(normalizePermission),
    blockedPermissions: (android.blockedPermissions ?? []).map(normalizePermission),
  };
}

/**
 * Extrae los `android:name` de cada `<uses-permission>` de un manifest.
 * Ignora las entradas con `tools:node="remove"`: no declaran el permiso, ordenan
 * al manifest merger que lo elimine.
 */
export function extractManifestPermissions(xml) {
  const found = [];
  const tagPattern = /<uses-permission\b[^>]*\/?>/g;
  for (const [tag] of xml.matchAll(tagPattern)) {
    if (/tools:node\s*=\s*"remove"/.test(tag)) continue;
    const name = tag.match(/android:name\s*=\s*"([^"]+)"/);
    if (name) found.push(normalizePermission(name[1]));
  }
  return found;
}

/** Nombre del paquete npm al que pertenece un manifest, para poder señalarlo. */
export function packageNameForManifest(manifestPath, nodeModulesRoot) {
  const relative = manifestPath.slice(nodeModulesRoot.length).split(sep).filter(Boolean);
  if (relative.length === 0) return "(desconocido)";
  return relative[0].startsWith("@") && relative.length > 1
    ? `${relative[0]}/${relative[1]}`
    : relative[0];
}

function walkForManifests(directory, ignoreFragments, accumulator) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    // No seguimos symlinks: en un árbol con install-strategy=nested pueden
    // formar ciclos, y lo que enlazan ya se visita por su ruta real.
    if (entry.isSymbolicLink()) continue;
    if (ignoreFragments.some((fragment) => fullPath.includes(fragment))) continue;
    if (entry.isDirectory()) {
      walkForManifests(fullPath, ignoreFragments, accumulator);
    } else if (entry.name === MANIFEST_FILENAME) {
      accumulator.push(fullPath);
    }
  }
  return accumulator;
}

/** Recorre los node_modules declarados y devuelve los permisos que aporta cada manifest. */
export function collectManifestPermissions(policy, root = repoRoot) {
  const ignoreFragments = policy.scanIgnorePathFragments ?? [];
  const manifests = [];
  for (const relativeRoot of policy.nodeModulesRoots ?? []) {
    const nodeModulesRoot = join(root, relativeRoot);
    for (const manifestPath of walkForManifests(nodeModulesRoot, ignoreFragments, [])) {
      let xml = "";
      try {
        xml = readFileSync(manifestPath, "utf8");
      } catch {
        continue;
      }
      manifests.push({
        path: manifestPath,
        packageName: packageNameForManifest(manifestPath, nodeModulesRoot),
        permissions: extractManifestPermissions(xml),
      });
    }
  }
  return manifests;
}

/**
 * Contrasta la configuración y las dependencias con la política.
 * Devuelve la lista de infracciones; vacía significa que el build es publicable.
 */
export function evaluatePermissionPolicy({ policy, configured, manifests }) {
  const violations = [];
  const allowed = policy.allowedPermissions.map(normalizePermission);
  const blocked = policy.blockedPermissions.map(normalizePermission);
  const acknowledged = new Set(policy.acknowledgedContributors ?? []);

  for (const permission of configured.permissions) {
    if (blocked.includes(permission)) {
      violations.push({
        code: "config-blocked",
        permission,
        message: `${policy.configPath} declara el permiso prohibido ${permission}: ${policy.rationale?.[permission] ?? "no es publicable en Google Play."}`,
      });
    }
  }

  for (const permission of configured.permissions) {
    if (!allowed.includes(permission) && !blocked.includes(permission)) {
      violations.push({
        code: "config-drift",
        permission,
        message: `${policy.configPath} declara ${permission}, que no está en allowedPermissions. Añádelo a la política con su motivo o retíralo de la configuración.`,
      });
    }
  }
  for (const permission of allowed) {
    if (!configured.permissions.includes(permission)) {
      violations.push({
        code: "config-drift",
        permission,
        message: `${policy.configPath} ya no declara ${permission}, que la política da por aprobado. Si la retirada es intencionada, actualiza allowedPermissions.`,
      });
    }
  }

  for (const permission of blocked) {
    if (!configured.blockedPermissions.includes(permission)) {
      violations.push({
        code: "config-missing-block",
        permission,
        message: `${policy.configPath} no lista ${permission} en expo.android.blockedPermissions. Sin esa entrada, una dependencia puede reintroducirlo vía manifest merger.`,
      });
    }
  }

  for (const manifest of manifests) {
    for (const permission of manifest.permissions) {
      if (blocked.includes(permission) && !acknowledged.has(manifest.packageName)) {
        violations.push({
          code: "dependency-contribution",
          permission,
          message: `El paquete ${manifest.packageName} declara ${permission} en ${manifest.path}. Confirma que expo.android.blockedPermissions lo neutraliza y añádelo a acknowledgedContributors.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Chequeo completo. `manifests` vacío se trata como error: sin node_modules el
 * escaneo de dependencias pasaría en verde sin haber comprobado nada.
 */
export function checkAndroidPermissions(root = repoRoot) {
  const policy = loadPermissionPolicy();
  const configured = readConfiguredPermissions(policy, root);
  const manifests = collectManifestPermissions(policy, root);

  const violations = evaluatePermissionPolicy({ policy, configured, manifests });
  if (manifests.length === 0) {
    violations.push({
      code: "scanner-empty",
      permission: null,
      message: "No se encontró ningún AndroidManifest.xml en node_modules. El escaneo de dependencias no ha comprobado nada: ejecuta 'npm ci' antes del chequeo.",
    });
  }

  return { policy, configured, manifests, violations };
}
