import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// GYM-249: el SafeAreaView de react-native core es un View normal en Android y solo
// aplica insets en iOS. Con el edge-to-edge obligatorio del SDK 54, Android 15+ dibuja
// la app bajo la barra de estado y la de gestos, así que los insets tienen que venir de
// react-native-safe-area-context. Este contrato impide que el import de core vuelva a
// colarse, porque el fallo no se ve en web, en iOS ni en Android 14 o anterior.

const mobileRoot = fileURLToPath(new URL("..", import.meta.url));
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", ".expo", "scripts", "generated"]);

function collectSourceFiles(directory: string, result: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    if (statSync(absolutePath).isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry)) collectSourceFiles(absolutePath, result);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      result.push(relative(mobileRoot, absolutePath));
    }
  }
  return result.sort();
}

const sourceFiles = collectSourceFiles(mobileRoot);
const sources = new Map(sourceFiles.map((file) => [file, readFileSync(join(mobileRoot, file), "utf8")]));

function importsFromReactNativeCore(source: string, name: string): boolean {
  const importPattern = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']react-native["']/g;
  for (const match of source.matchAll(importPattern)) {
    const names = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0]);
    if (names.includes(name)) return true;
  }
  return false;
}

describe("contrato estático de los insets del sistema (GYM-249)", () => {
  it("encuentra el código fuente de la app", () => {
    expect(sourceFiles).toContain("App.tsx");
    expect(sourceFiles).toContain("LocalStoreRecoveryScreen.tsx");
  });

  it("ningún fichero importa SafeAreaView desde react-native core", () => {
    const offenders = sourceFiles.filter((file) =>
      importsFromReactNativeCore(sources.get(file) ?? "", "SafeAreaView"),
    );
    expect(offenders).toEqual([]);
  });

  it("nadie compensa la barra de estado a mano con StatusBar.currentHeight", () => {
    // Era el parche de #208 en el catálogo. Con el contenedor raíz aplicando insets,
    // cualquier compensación manual dentro de él se convierte en margen doble.
    const offenders = sourceFiles.filter((file) => /StatusBar\.currentHeight/.test(sources.get(file) ?? ""));
    expect(offenders).toEqual([]);
  });

  it("el contenedor raíz usa el SafeAreaView de react-native-safe-area-context", () => {
    const appSource = sources.get("App.tsx") ?? "";
    expect(appSource).toMatch(
      /import \{ SafeAreaProvider, SafeAreaView \} from "react-native-safe-area-context";/,
    );
    expect(appSource).toMatch(/<SafeAreaProvider>\s*<GymnasiaApp[\s\S]*?\/>\s*<\/SafeAreaProvider>/);
    expect(appSource.match(/<SafeAreaProvider>/g)).toHaveLength(1);
  });

  it("cada Modal nativo aplica sus propios insets, porque se dibuja fuera del contenedor raíz", () => {
    const filesWithNativeModal = sourceFiles.filter((file) => /<Modal[\s>]/.test(sources.get(file) ?? ""));
    expect(filesWithNativeModal).toEqual([
      "AiResponseReportModal.tsx",
      "LocalStoreRecoveryScreen.tsx",
      "backup/PortablePasswordModal.tsx",
    ]);
    for (const file of filesWithNativeModal) {
      expect(sources.get(file), file).toMatch(
        /import \{ SafeAreaView \} from "react-native-safe-area-context";/,
      );
    }
  });
});
