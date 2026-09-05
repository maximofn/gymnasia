import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCAL_STORE_ROOT_FIELDS } from "../persistence/localStoreRecovery";

// App.tsx no es importable en Node, así que el contrato se asserta sobre su fuente.
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const policySource = readFileSync(new URL("../dev-store/policy.json", import.meta.url), "utf8");

/**
 * Cada llamada a `normalizeStore` con su bloque de opciones. Se localiza por la
 * llamada y no por la función que la contiene: delimitar el cuerpo de una función
 * de App.tsx por texto es frágil, y aquí lo que importa es cada punto de entrada.
 */
function normalizeStoreCallSites(): string[] {
  const sites: string[] = [];
  let from = 0;
  for (;;) {
    const index = appSource.indexOf("normalizeStore(", from);
    if (index === -1) break;
    sites.push(appSource.slice(index, index + 700));
    from = index + 1;
  }
  return sites.filter((site) => !site.startsWith("normalizeStore(\n  raw"));
}

describe("contrato de series con App.tsx", () => {
  it("App.tsx ya no declara los tipos ni la normalización de series por su cuenta", () => {
    expect(appSource).not.toContain("type ExerciseSeries = {");
    expect(appSource).not.toContain("type SubSeries = {");
    expect(appSource).not.toContain("type SeriesType =\n");
    expect(appSource).not.toContain("function buildSeriesFromLegacyExercise");
    expect(appSource).not.toContain("function seriesToLegacySets");
    expect(appSource).not.toContain("SERIES_TYPE_META: Record");
  });

  it("App.tsx consume el módulo extraído", () => {
    expect(appSource).toContain('from "./training/seriesContract"');
    expect(appSource).toContain('from "./training/seriesPresentation"');
  });

  it("solo la importación exige estructura; el arranque siempre repara", () => {
    // Si el arranque pasara a "strict", una copia rara mandaría el almacén del
    // usuario a cuarentena y lo dejaría en la pantalla de recuperación.
    const sites = normalizeStoreCallSites();
    expect(sites).toHaveLength(2);
    const strict = sites.filter((site) => site.includes('training: "strict"'));
    expect(strict).toHaveLength(1);
    expect(strict[0]).toContain("data.store");
    const hydration = sites.find((site) => !site.includes('training: "strict"'));
    expect(hydration).toContain("sourceCandidate");
  });

  it("la versión del esquema de series no se cuela en la raíz del almacén", () => {
    // Una clave raíz desconocida hace que validateLocalStoreTree emita
    // unknown_root_field y la app arranque en la pantalla de recuperación.
    expect(LOCAL_STORE_ROOT_FIELDS).toHaveLength(10);
    expect(LOCAL_STORE_ROOT_FIELDS).not.toContain("series_schema_version");
    const policy = JSON.parse(policySource) as { allowedRootFields: string[] };
    expect(policy.allowedRootFields).toHaveLength(10);
    expect(policy.allowedRootFields).not.toContain("series_schema_version");
  });

  it("el portero de persistencia valida la versión sellada dentro de la rutina", () => {
    const recoverySource = readFileSync(
      new URL("../persistence/localStoreRecovery.ts", import.meta.url),
      "utf8",
    );
    expect(recoverySource).toContain('"series_schema_version"');
  });
});
