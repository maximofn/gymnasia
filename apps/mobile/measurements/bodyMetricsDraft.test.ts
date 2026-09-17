import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatBodyMetricInput,
  parseBodyMetricInput,
  resolveBodyMetricsDraft,
} from "./bodyMetricsDraft";
import {
  upsertMeasurementByDate,
  type Measurement,
} from "./measurementContract";

const noLatest = { latestWeightKg: null, latestHeightCm: null };

function measurement(overrides: Partial<Measurement>): Measurement {
  return {
    id: "m1",
    measured_on: "2026-09-17",
    measured_at: "2026-09-17T12:00:00.000Z",
    weight_kg: null,
    body_fat_pct: null,
    photo_uri: null,
    neck_cm: null,
    chest_cm: null,
    waist_cm: null,
    hips_cm: null,
    biceps_cm: null,
    quadriceps_cm: null,
    calf_cm: null,
    height_cm: null,
    ...overrides,
  };
}

describe("parseBodyMetricInput", () => {
  it("acepta coma y punto decimal", () => {
    expect(parseBodyMetricInput("weight_kg", "82,5")).toEqual({ value: 82.5, invalid: false });
    expect(parseBodyMetricInput("weight_kg", " 82.5 ")).toEqual({ value: 82.5, invalid: false });
  });

  it("trata el vacío como ausencia, no como error", () => {
    expect(parseBodyMetricInput("weight_kg", "")).toEqual({ value: null, invalid: false });
    expect(parseBodyMetricInput("height_cm", "   ")).toEqual({ value: null, invalid: false });
  });

  it.each(["0", "-5", "abc", "1e400", "Infinity", "NaN", "0.001"])("rechaza %s", (raw) => {
    expect(parseBodyMetricInput("weight_kg", raw)).toEqual({ value: null, invalid: true });
  });
});

describe("resolveBodyMetricsDraft", () => {
  it("usa el borrador cuando es válido y el último registrado cuando está vacío", () => {
    const resolved = resolveBodyMetricsDraft(
      { weightInput: "80", heightInput: "" },
      { latestWeightKg: 75, latestHeightCm: 178 },
    );
    expect(resolved.weightKg).toBe(80);
    expect(resolved.heightCm).toBe(178);
    expect(resolved.hasIssues).toBe(false);
  });

  it("solo incluye en el parche los campos que cambian respecto al último registrado", () => {
    const resolved = resolveBodyMetricsDraft(
      { weightInput: "80", heightInput: "178" },
      { latestWeightKg: 75, latestHeightCm: 178 },
    );
    expect(resolved.patch).toEqual({ weight_kg: 80 });
  });

  it("un borrador vacío no genera parche ni borra nada", () => {
    const resolved = resolveBodyMetricsDraft(
      { weightInput: "", heightInput: "" },
      { latestWeightKg: 75, latestHeightCm: 178 },
    );
    expect(resolved.patch).toEqual({});
    expect(resolved.weightKg).toBe(75);
  });

  it("un valor inválido marca el campo, anula el valor efectivo y no escribe", () => {
    const resolved = resolveBodyMetricsDraft(
      { weightInput: "abc", heightInput: "-3" },
      { latestWeightKg: 75, latestHeightCm: 178 },
    );
    expect(resolved.weightKg).toBeNull();
    expect(resolved.heightCm).toBeNull();
    expect(resolved.weightIssue).toMatch(/peso/);
    expect(resolved.heightIssue).toMatch(/altura/);
    expect(resolved.hasIssues).toBe(true);
    expect(resolved.patch).toEqual({});
  });

  it("el parche aplicado a la medición de hoy conserva los demás campos", () => {
    const today = measurement({ waist_cm: 82, body_fat_pct: 18 });
    const resolved = resolveBodyMetricsDraft({ weightInput: "80,4", heightInput: "" }, noLatest);
    const result = upsertMeasurementByDate([today], {
      date: "2026-09-17",
      patch: resolved.patch,
      createId: () => "new",
      today: new Date(2026, 8, 17, 12),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0]).toMatchObject({ id: "m1", weight_kg: 80.4, waist_cm: 82, body_fat_pct: 18 });
  });
});

describe("formatBodyMetricInput", () => {
  it("vuelve al texto que escribió el usuario tras el redondeo del contrato", () => {
    expect(formatBodyMetricInput(null)).toBe("");
    expect(formatBodyMetricInput(82.5)).toBe("82.5");
    expect(formatBodyMetricInput(180)).toBe("180");
  });
});

describe("propiedades", () => {
  it("nunca lanza y solo acepta números finitos mayores que cero", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (raw) => {
        const parsed = parseBodyMetricInput("weight_kg", raw);
        if (parsed.value !== null) {
          expect(Number.isFinite(parsed.value)).toBe(true);
          expect(parsed.value).toBeGreaterThan(0);
          expect(parsed.invalid).toBe(false);
        }
        const resolved = resolveBodyMetricsDraft({ weightInput: raw, heightInput: raw }, noLatest);
        expect(resolved.hasIssues).toBe(parsed.invalid);
        if (parsed.invalid) expect(resolved.patch).toEqual({});
      }),
    );
  });

  it("acepta cualquier número positivo escrito con coma, punto o espacios", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(".", ","),
        fc.constantFrom("", " ", "  "),
        (value, separator, padding) => {
          const raw = `${padding}${value.toFixed(2).replace(".", separator)}${padding}`;
          const parsed = parseBodyMetricInput("height_cm", raw);
          expect(parsed.invalid).toBe(false);
          expect(parsed.value).toBeCloseTo(Number(value.toFixed(2)), 2);
        },
      ),
    );
  });
});
