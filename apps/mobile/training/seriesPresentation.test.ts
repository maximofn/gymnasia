import { describe, expect, it } from "vitest";
import { SERIES_TYPES } from "./seriesContract";
import {
  ALL_SERIES_TYPES,
  SERIES_TYPE_META,
  seriesTypeShortLabel,
} from "./seriesPresentation";

describe("presentación de series", () => {
  it("etiqueta exactamente los tipos que existen en el dominio, sin sobras ni faltas", () => {
    expect(Object.keys(SERIES_TYPE_META).sort()).toEqual([...SERIES_TYPES].sort());
  });

  it("da a cada tipo una etiqueta y una abreviatura no vacías", () => {
    for (const type of SERIES_TYPES) {
      expect(SERIES_TYPE_META[type].label.trim().length).toBeGreaterThan(0);
      expect(SERIES_TYPE_META[type].short.trim().length).toBeGreaterThan(0);
    }
  });

  it("ordena el selector por el dominio, no por el orden de las etiquetas", () => {
    expect([...ALL_SERIES_TYPES]).toEqual([...SERIES_TYPES]);
  });

  it("trata una serie sin tipo como normal al pedir su abreviatura", () => {
    expect(seriesTypeShortLabel(undefined)).toBe(SERIES_TYPE_META.normal.short);
    expect(seriesTypeShortLabel("dropset")).toBe("DS");
  });
});
