import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(here, "..", "..");
export const nativeConfigPolicyPath = join(here, "policy.json");

const ANDROID_PERMISSION_PREFIX = "android.permission.";
const COPIED_MOBILE_IGNORES = new Set([".expo", "android", "dist", "ios", "node_modules"]);

export function normalizePermission(permission) {
  return String(permission ?? "")
    .trim()
    .replace(new RegExp(`^${ANDROID_PERMISSION_PREFIX.replaceAll(".", "\\.")}`), "");
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

export function loadNativeConfigPolicy(path = nativeConfigPolicyPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function parseSourceManifest(xml) {
  const declaredPermissions = [];
  const removalDirectives = [];
  for (const [tag] of xml.matchAll(/<uses-permission\b[^>]*\/?>/g)) {
    const name = tag.match(/android:name\s*=\s*"([^"]+)"/)?.[1];
    if (!name) continue;
    const target = /tools:node\s*=\s*"remove"/.test(tag)
      ? removalDirectives
      : declaredPermissions;
    target.push(normalizePermission(name));
  }

  const attributesFromTag = (tag) => {
    const attributes = {};
    for (const [, name, value] of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
      attributes[name] = value;
    }
    return attributes;
  };
  const applicationTag = xml.match(/<application\b[^>]*>/)?.[0] ?? "";
  const activityTag = [...xml.matchAll(/<activity\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => /android:name\s*=\s*"\.MainActivity"/.test(tag)) ?? "";

  return {
    declaredPermissions: sortedUnique(declaredPermissions),
    removalDirectives: sortedUnique(removalDirectives),
    applicationAttributes: attributesFromTag(applicationTag),
    activityAttributes: attributesFromTag(activityTag),
  };
}

export function extractPrebuildWarnings(output) {
  return String(output ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:!|»|⚠|warning\b|warn\b)/i.test(line));
}

export function isWarningAllowed(warning, patterns) {
  return patterns.some((pattern) => new RegExp(pattern, "u").test(warning));
}

function compareExactSet({ actual, expected, code, label, violations }) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0 || unexpected.length > 0) {
    violations.push({
      code,
      message: `${label}: faltan [${missing.join(", ")}], sobran [${unexpected.join(", ")}].`,
      missing,
      unexpected,
    });
  }
}

export function evaluateNativeConfig({
  policy,
  manifest,
  mainActivity,
  notificationSounds,
  warnings = [],
}) {
  const violations = [];
  compareExactSet({
    actual: sortedUnique(manifest.declaredPermissions),
    expected: sortedUnique(policy.expectedSourcePermissions),
    code: "source-permissions",
    label: "Permisos declarados por el manifest fuente",
    violations,
  });
  compareExactSet({
    actual: sortedUnique(manifest.removalDirectives),
    expected: sortedUnique(policy.expectedRemovalDirectives),
    code: "removal-directives",
    label: "Directivas de retirada del manifest fuente",
    violations,
  });
  compareExactSet({
    actual: sortedUnique(notificationSounds),
    expected: sortedUnique(policy.expectedNotificationSounds),
    code: "notification-sounds",
    label: "Sonidos nativos de notificación",
    violations,
  });

  for (const permission of policy.forbiddenSourcePermissions) {
    if (manifest.declaredPermissions.includes(permission)) {
      violations.push({
        code: "forbidden-source-permission",
        message: `El manifest fuente declara el permiso prohibido ${permission}.`,
        permission,
      });
    }
  }

  for (const [name, expected] of Object.entries(policy.application.attributes)) {
    const actual = manifest.applicationAttributes[name];
    if (actual !== expected) {
      violations.push({
        code: "application-attribute",
        message: `La aplicación debe tener ${name}=\"${expected}\"; se generó ${actual ? `\"${actual}\"` : "sin el atributo"}.`,
        attribute: name,
      });
    }
  }

  for (const [name, expected] of Object.entries(policy.mainActivity.attributes)) {
    const actual = manifest.activityAttributes[name];
    if (actual !== expected) {
      violations.push({
        code: "main-activity-attribute",
        message: `MainActivity debe tener ${name}=\"${expected}\"; se generó ${actual ? `\"${actual}\"` : "sin el atributo"}.`,
        attribute: name,
      });
    }
  }
  for (const marker of policy.mainActivity.requiredMarkers) {
    if (!mainActivity.includes(marker)) {
      violations.push({
        code: "main-activity-marker",
        message: `MainActivity ya no contiene el marcador revisado: ${marker}`,
        marker,
      });
    }
  }
  for (const warning of warnings) {
    if (!isWarningAllowed(warning, policy.allowedPrebuildWarnings ?? [])) {
      violations.push({
        code: "prebuild-warning",
        message: `expo prebuild emitió una advertencia no aprobada: ${warning}`,
        warning,
      });
    }
  }

  return violations;
}

function copyMobileSource(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    filter(path) {
      if (path === source) return true;
      const relative = path.slice(source.length + 1);
      return !COPIED_MOBILE_IGNORES.has(relative.split(/[\\/]/)[0]);
    },
  });
}

export function runProductionPrebuild({ keepTemporary = false } = {}) {
  const policy = loadNativeConfigPolicy();
  const mobileRoot = join(repositoryRoot, "apps", "mobile");
  const temporaryRoot = mkdtempSync(join(tmpdir(), "gymnasia-native-config-"));
  const temporaryMobile = join(temporaryRoot, "mobile");
  const expoCli = join(mobileRoot, "node_modules", "expo", "bin", "cli");

  try {
    if (!existsSync(expoCli)) {
      throw new Error("No se encontró Expo CLI. Ejecuta 'npm ci' antes del contrato nativo.");
    }
    copyMobileSource(mobileRoot, temporaryMobile);
    symlinkSync(join(repositoryRoot, "node_modules"), join(temporaryRoot, "node_modules"), "dir");
    symlinkSync(join(mobileRoot, "node_modules"), join(temporaryMobile, "node_modules"), "dir");

    const prebuild = spawnSync(
      process.execPath,
      [expoCli, "prebuild", "--platform", "android", "--clean", "--no-install"],
      {
        cwd: temporaryMobile,
        env: {
          ...process.env,
          APP_ENV: "production",
          CI: "1",
          EXPO_NO_GIT_STATUS: "1",
        },
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    const output = `${prebuild.stdout ?? ""}\n${prebuild.stderr ?? ""}`.trim();
    if (prebuild.status !== 0) {
      return {
        policy,
        temporaryRoot: keepTemporary ? temporaryRoot : null,
        output,
        violations: [{
          code: "prebuild-failed",
          message: `expo prebuild falló con código ${prebuild.status ?? "desconocido"}.`,
        }],
      };
    }

    const androidRoot = join(temporaryMobile, "android");
    const manifestXml = readFileSync(join(androidRoot, "app", "src", "main", "AndroidManifest.xml"), "utf8");
    const mainActivity = readFileSync(
      join(androidRoot, "app", "src", "main", "java", "com", "maximofn", "gymnasia", "MainActivity.kt"),
      "utf8",
    );
    const rawRoot = join(androidRoot, "app", "src", "main", "res", "raw");
    const notificationSounds = existsSync(rawRoot)
      ? readdirSync(rawRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".wav"))
        .map((entry) => entry.name)
        .sort()
      : [];
    const manifest = parseSourceManifest(manifestXml);
    const warnings = extractPrebuildWarnings(output);
    const violations = evaluateNativeConfig({
      policy,
      manifest,
      mainActivity,
      notificationSounds,
      warnings,
    });

    return {
      policy,
      temporaryRoot: keepTemporary ? temporaryRoot : null,
      output,
      manifest,
      notificationSounds,
      warnings,
      violations,
    };
  } finally {
    if (!keepTemporary) rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
