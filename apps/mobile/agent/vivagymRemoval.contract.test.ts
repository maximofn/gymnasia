import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { RETAINED_LEGACY_SECURE_STORE_KEYS } from "../legacySecureStorage";

const mobileRoot = fileURLToPath(new URL("../", import.meta.url));
const appPath = join(mobileRoot, "App.tsx");
const legacyStoragePath = join(mobileRoot, "legacySecureStorage.ts");

function readRuntimeSources(directory: string): Array<{ path: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["dist", "node_modules", "public", "scripts"].includes(entry.name)) return [];
      return readRuntimeSources(path);
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".test.ts")) return [];
    return [{ path, source: readFileSync(path, "utf8") }];
  });
}

const runtimeSources = readRuntimeSources(mobileRoot);
const activeRuntimeSource = runtimeSources
  .filter(({ path }) => path !== legacyStoragePath)
  .map(({ source }) => source)
  .join("\n");
const appSource = readFileSync(appPath, "utf8");
const packageManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { dependencies?: Record<string, string> };
const publicComplianceCopy = [
  "../../../docs/legal/privacy-policy.es.md",
  "../../../docs/legal/privacy-policy.en.md",
  "../../../docs/legal/play-declarations.md",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

describe("retirada temporal de VivaGym", () => {
  it("elimina la superficie y el protocolo del runtime", () => {
    for (const forbidden of [
      '"vivagym"',
      "VIVAGYM_",
      "getVivaGymQr",
      "fetchVivaGymAppToken",
      "loginVivaGym",
      "fetchVivaGymQrValue",
      "vivagym.myvitale.com",
      "/oauth/v2/token",
      "/api/v2.0/exerp/newAuth",
      "/api/v2.0/exerp/qr",
      "react-native-qrcode-svg",
      "Acceso VivaGym",
    ]) {
      expect(activeRuntimeSource).not.toContain(forbidden);
    }
    expect(packageManifest.dependencies).not.toHaveProperty("react-native-qrcode-svg");
  });

  it("conserva una lista cerrada de claves heredadas", () => {
    expect(RETAINED_LEGACY_SECURE_STORE_KEYS).toEqual([
      "vivagym.email",
      "vivagym.password",
    ]);
    expect(
      runtimeSources
        .filter(({ source }) => source.includes("RETAINED_LEGACY_SECURE_STORE_KEYS"))
        .map(({ path }) => relative(mobileRoot, path))
        .sort(),
    ).toEqual(["App.tsx", "legacySecureStorage.ts"]);
  });

  it("solo consume las claves heredadas desde el restablecimiento explícito", () => {
    const resetStart = appSource.indexOf("async function resetLocalData()");
    const resetEnd = appSource.indexOf("\n  return (", resetStart);
    expect(resetStart).toBeGreaterThan(-1);
    expect(resetEnd).toBeGreaterThan(resetStart);

    const resetSource = appSource.slice(resetStart, resetEnd);
    expect(resetSource).toContain(
      "...RETAINED_LEGACY_SECURE_STORE_KEYS.map(scopedSecureStoreKey)",
    );
    expect(
      appSource.match(/RETAINED_LEGACY_SECURE_STORE_KEYS/g),
    ).toHaveLength(2);
  });

  it("no anuncia la integración retirada en la política ni en las declaraciones", () => {
    for (const copy of publicComplianceCopy) {
      expect(copy).not.toMatch(/VivaGym|vivagym\.myvitale\.com/i);
    }
  });
});
