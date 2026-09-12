import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SHELL_BACK_LAYERS,
  SYSTEM_OWNED_SHELL_SURFACES,
} from "./shellRegistry";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const chatScreenSource = readFileSync(new URL("../screens/ChatScreen.tsx", import.meta.url), "utf8");
const measurementsScreenSource = readFileSync(
  new URL("../screens/MeasurementsScreen.tsx", import.meta.url),
  "utf8",
);
const dietScreenSource = readFileSync(new URL("../screens/DietScreen.tsx", import.meta.url), "utf8");
const settingsScreenSource = readFileSync(
  new URL("../screens/SettingsScreen.tsx", import.meta.url),
  "utf8",
);
const shellUiSource = `${appSource}\n${chatScreenSource}\n${measurementsScreenSource}\n${dietScreenSource}\n${settingsScreenSource}`;
const reportModalSource = readFileSync(new URL("../AiResponseReportModal.tsx", import.meta.url), "utf8");
const recoverySource = readFileSync(new URL("../LocalStoreRecoveryScreen.tsx", import.meta.url), "utf8");

describe("contrato estático del shell", () => {
  it("mantiene una sola suscripción estable de BackHandler", () => {
    expect(appSource.match(/BackHandler\.addEventListener/g)).toHaveLength(1);
    expect(appSource).toMatch(
      /BackHandler\.addEventListener\([\s\S]*?createHardwareBackPressCallback\(shellBackPressRef\)[\s\S]*?return \(\) => handler\.remove\(\);\s*}\, \[\]\);/,
    );
    expect(appSource).not.toContain("if (trainingTemplateConflict) { setTrainingTemplateConflict");
  });

  it("deriva las dos barras de TAB_DESTINATIONS", () => {
    expect(appSource.match(/TAB_DESTINATIONS\.map/g)).toHaveLength(2);
    expect(appSource).not.toContain('["home", "training", "diet", "measures", "chat", "settings"]');
    expect(appSource).toContain("type TabKey,");
    expect(appSource).not.toContain('type TabKey = "home"');
  });

  it("declara estado y handler exhaustivos para cada capa global", () => {
    expect(appSource).toContain("satisfies ShellLayerState");
    expect(appSource).toContain("satisfies Record<ShellBackCommand, () => boolean>");
    for (const surface of SHELL_BACK_LAYERS) {
      const references = appSource.match(new RegExp(`"${surface.id}"`, "g"))?.length ?? 0;
      expect(references, `${surface.id} debe declarar estado y handler`).toBeGreaterThanOrEqual(2);
      const registryTestIdIsAttached = shellUiSource.includes(`shellSurfaceTestId("${surface.id}")`)
        || shellUiSource.includes(`testID="${surface.testId}"`)
        || (
          shellUiSource.includes(`surfaceId: "${surface.id}"`)
          && shellUiSource.includes("shellSurfaceTestId(dropdown.surfaceId)")
        );
      expect(registryTestIdIsAttached, `${surface.id} debe aplicar su test ID`).toBe(true);
    }
  });

  it("usa cierres canónicos para estados acoplados y bloquea el borrado en curso", () => {
    expect(appSource).toMatch(
      /function closeExercisePicker\(\) \{\s*setExercisePickerOpen\(false\);\s*setSupersetPickerTarget\(null\);\s*\}/,
    );
    expect(appSource.match(/setExercisePickerOpen\(false\)/g)).toHaveLength(1);
    expect(appSource).toContain('"exercise-picker": () => { closeExercisePicker(); return true; }');
    expect(appSource).toContain(
      '"data-deletion": () => { if (!dataDeletionBusyRef.current) closeDataDeletion(); return true; }',
    );
  });

  it("conserva los contratos nativos fuera del listener global", () => {
    const nativeSources = `${reportModalSource}\n${recoverySource}`;
    for (const surface of SYSTEM_OWNED_SHELL_SURFACES) {
      expect(nativeSources).toContain(`testID="${surface.testId}"`);
    }
    expect(reportModalSource).toContain("onRequestClose={submitting ? undefined : onClose}");
    expect(recoverySource).toContain("onRequestClose={() => {");
  });
});
