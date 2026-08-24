import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const buildWorkflow = readFileSync(
  new URL("../../../.github/workflows/build-apk.yml", import.meta.url),
  "utf8",
);

const LEGACY_KEY = "gymnasia.mobile.lastUpdateCheck";

describe("retirada completa del actualizador de APK", () => {
  it("no conserva servicio, estado ni acciones del actualizador", () => {
    for (const symbol of [
      "GITHUB_RELEASES_API",
      "UPDATE_CHECK_INTERVAL_MS",
      "UPDATE_CHECK_KEY",
      "compareVersions",
      "checkForUpdate",
      "runManualUpdateCheck",
      "updateInfo",
      "updatesCheckResult",
      "updatesConfirmInfo",
      "browser_download_url",
    ]) {
      expect(appSource).not.toContain(symbol);
    }
    expect(appSource).not.toContain("/releases/latest");
  });

  it("no conserva interfaz ni navegación para descargar APK", () => {
    for (const copy of [
      'key: "updates"',
      'settingsTab === "updates"',
      "Comprobar nuevas versiones",
      "Versión en GitHub",
      "Nueva versión disponible",
      "¿Actualizar la app?",
      "Actualizar app",
    ]) {
      expect(appSource).not.toContain(copy);
    }
  });

  it("solo conserva la marca antigua para borrarla al arrancar", () => {
    expect(appSource.split(LEGACY_KEY)).toHaveLength(2);
    const legacyKeys = appSource.match(/const LEGACY_STORAGE_KEYS = \[([\s\S]*?)\];/)?.[1];
    expect(legacyKeys).toContain(`scopedStorageKey("${LEGACY_KEY}")`);
    expect(appSource).toContain("await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS)");
  });

  it("mantiene la publicación manual de Production separada del cliente", () => {
    expect(buildWorkflow).toContain('PROFILE="production-apk"');
    expect(buildWorkflow).not.toContain("Upload internal Staging APK");
    expect(buildWorkflow).toContain("Create draft APK release");
    expect(buildWorkflow).toContain("Publish immutable APK release");
  });
});
