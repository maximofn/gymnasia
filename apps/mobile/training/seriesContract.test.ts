import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  COMPOUND_SERIES_TYPES,
  SERIES_TYPES,
  TRAINING_SERIES_SCHEMA_VERSION,
  isCompoundSeriesType,
  isSeriesType,
  readSeriesSchemaVersion,
} from "./seriesContract";

describe("contrato de series", () => {
  it("reconoce los catorce tipos de serie y rechaza cualquier otro valor", () => {
    expect(SERIES_TYPES).toHaveLength(14);
    for (const type of SERIES_TYPES) {
      expect(isSeriesType(type)).toBe(true);
    }
    for (const notAType of ["supersett", "", "NORMAL", null, undefined, 3, {}, []]) {
      expect(isSeriesType(notAType)).toBe(false);
    }
  });

  it("trata como compuestos solo los cinco tipos que llevan mini-series", () => {
    expect([...COMPOUND_SERIES_TYPES]).toEqual([
      "dropset",
      "restpause",
      "myoreps",
      "cluster",
      "superset",
    ]);
    for (const type of COMPOUND_SERIES_TYPES) {
      expect(isCompoundSeriesType(type)).toBe(true);
      expect(isSeriesType(type)).toBe(true);
    }
    for (const simple of ["normal", "warmup", "tempo", "isometric"]) {
      expect(isCompoundSeriesType(simple)).toBe(false);
    }
  });

  it("no admite duplicados ni valores vacíos en la lista de tipos", () => {
    expect(new Set(SERIES_TYPES).size).toBe(SERIES_TYPES.length);
    for (const type of SERIES_TYPES) {
      expect(type.trim()).toBe(type);
      expect(type.length).toBeGreaterThan(0);
    }
  });

  it("solo acepta como versión sellada un entero positivo, y nada más", () => {
    expect(readSeriesSchemaVersion({ series_schema_version: 1 })).toBe(1);
    expect(readSeriesSchemaVersion({ series_schema_version: 2 })).toBe(2);
    expect(readSeriesSchemaVersion({})).toBeNull();
    expect(readSeriesSchemaVersion({ series_schema_version: "1" })).toBeNull();
    expect(readSeriesSchemaVersion({ series_schema_version: 0 })).toBeNull();
    expect(readSeriesSchemaVersion({ series_schema_version: 1.5 })).toBeNull();
    expect(readSeriesSchemaVersion({ series_schema_version: -1 })).toBeNull();
    expect(readSeriesSchemaVersion({ series_schema_version: Number.NaN })).toBeNull();
    expect(readSeriesSchemaVersion(null)).toBeNull();
    expect(readSeriesSchemaVersion(undefined)).toBeNull();
    expect(readSeriesSchemaVersion("rutina")).toBeNull();
  });

  it("sella la versión 1 y nunca lee una versión de una entrada arbitraria", () => {
    expect(TRAINING_SERIES_SCHEMA_VERSION).toBe(1);
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const version = readSeriesSchemaVersion(value);
        return version === null || (Number.isInteger(version) && version >= 1);
      }),
      { numRuns: 500, seed: 173 },
    );
  });

  it("mantiene el contrato libre de colores de marca", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./seriesContract.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});
