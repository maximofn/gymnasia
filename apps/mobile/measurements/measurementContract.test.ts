import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_MEASUREMENTS,
  buildMeasurementChartPoints,
  deleteMeasurementById,
  estimateMeasurementBodyFatPercentage,
  measurementDuplicateDates,
  normalizeMeasurement,
  parseMeasurementToolPatch,
  replaceMeasurementById,
  resolveMeasurementMetricPair,
  selectLatestMeasurementWithMetric,
  sortMeasurementsDesc,
  upsertMeasurementByDate,
  validateMeasurementDate,
  validateMeasurementMetric,
  type Measurement,
  type MeasurementValues,
} from "./measurementContract";

const TODAY = new Date(2026, 8, 3, 18, 0, 0);

const EMPTY_VALUES: MeasurementValues = {
  weight_kg: null,
  body_fat_pct: null,
  neck_cm: null,
  chest_cm: null,
  waist_cm: null,
  hips_cm: null,
  biceps_cm: null,
  quadriceps_cm: null,
  calf_cm: null,
  height_cm: null,
};

function measurement(
  id: string,
  measuredOn: string,
  values: Partial<MeasurementValues> = {},
): Measurement {
  return {
    id,
    measured_on: measuredOn,
    measured_at: `${measuredOn}T12:00:00.000Z`,
    photo_uri: null,
    ...EMPTY_VALUES,
    ...values,
  };
}

describe("contrato de mediciones", () => {
  it("valida fechas de calendario reales y no futuras", () => {
    expect(validateMeasurementDate("2024-02-29", TODAY)).toEqual({
      ok: true,
      value: "2024-02-29",
      issues: [],
    });
    expect(validateMeasurementDate("2026-02-29", TODAY)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid_date" }],
    });
    expect(validateMeasurementDate("2026-09-04", TODAY)).toMatchObject({
      ok: false,
      issues: [{ code: "future_date" }],
    });
  });

  it("aplica el mismo redondeo y los límites semánticos a todas las métricas", () => {
    expect(validateMeasurementMetric("weight_kg", 72.345)).toEqual({
      ok: true,
      value: 72.35,
      issues: [],
    });
    expect(validateMeasurementMetric("weight_kg", 0)).toMatchObject({
      ok: false,
      issues: [{ code: "not_positive" }],
    });
    expect(validateMeasurementMetric("body_fat_pct", 100.01)).toMatchObject({
      ok: false,
      issues: [{ code: "above_maximum" }],
    });
    expect(validateMeasurementMetric("height_cm", 450)).toMatchObject({
      ok: true,
      value: 450,
    });
  });

  it("migra measured_on desde un timestamp válido y nunca inventa ahora para uno inválido", () => {
    const migrated = normalizeMeasurement({
      id: "legacy",
      measured_at: "2026-08-17T10:00:00.000Z",
      weight_kg: "81,235",
    }, 0, () => "unused", TODAY);
    expect(migrated).toMatchObject({
      ok: true,
      value: {
        id: "legacy",
        measured_on: "2026-08-17",
        weight_kg: 81.24,
      },
    });

    expect(normalizeMeasurement({
      id: "broken",
      measured_at: "no-es-una-fecha",
      weight_kg: 80,
    }, 0, () => "unused", TODAY)).toMatchObject({
      ok: false,
      issues: [{ code: "required", field: "measurements[0].measured_on" }],
    });
  });

  it("interpreta la entrada estructurada y mantiene compatibilidad con el JSON antiguo", () => {
    expect(parseMeasurementToolPatch({ weight_kg: 80.126 }, ["waist_cm"])).toEqual({
      ok: true,
      value: { weight_kg: 80.13, waist_cm: null },
      issues: [],
    });
    expect(parseMeasurementToolPatch('{"weight_kg":"79,5","body_fat_pct":null}', undefined)).toEqual({
      ok: true,
      value: { weight_kg: 79.5, body_fat_pct: null },
      issues: [],
    });
    expect(parseMeasurementToolPatch({ weight_kg: 80 }, ["weight_kg"])).toMatchObject({
      ok: false,
      issues: [{ field: "weight_kg" }],
    });
    expect(parseMeasurementToolPatch({ desconocido: 10 }, undefined)).toMatchObject({
      ok: false,
      issues: [{ code: "unknown_field" }],
    });
  });

  it("crea una medición y completa la existente sin borrar los campos omitidos", () => {
    const created = upsertMeasurementByDate([], {
      date: "2026-09-03",
      patch: { weight_kg: 80.126, waist_cm: 90 },
      createId: () => "new-id",
      today: TODAY,
    });
    expect(created).toMatchObject({
      ok: true,
      action: "created",
      measurement: { id: "new-id", measured_on: "2026-09-03", weight_kg: 80.13 },
    });
    if (!created.ok) throw new Error("creation failed");

    const updated = upsertMeasurementByDate(created.measurements, {
      date: "2026-09-03",
      patch: { body_fat_pct: 18.5 },
      createId: () => "must-not-change",
      today: TODAY,
    });
    expect(updated).toMatchObject({
      ok: true,
      action: "updated",
      measurement: {
        id: "new-id",
        weight_kg: 80.13,
        waist_cm: 90,
        body_fat_pct: 18.5,
      },
    });
  });

  it("conserva duplicados antiguos pero bloquea un upsert ambiguo", () => {
    const duplicates = [
      measurement("a", "2026-09-03", { weight_kg: 80 }),
      measurement("b", "2026-09-03", { weight_kg: 81 }),
    ];
    expect(measurementDuplicateDates(duplicates)).toEqual(["2026-09-03"]);
    expect(upsertMeasurementByDate(duplicates, {
      date: "2026-09-03",
      patch: { waist_cm: 90 },
      createId: () => "unused",
      today: TODAY,
    })).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate_date_conflict" }],
    });
  });

  it("permite editar un duplicado sin agravarlo y rechaza moverlo a otra fecha ocupada", () => {
    const duplicates = [
      measurement("a", "2026-09-03", { weight_kg: 80 }),
      measurement("b", "2026-09-03", { weight_kg: 81 }),
      measurement("c", "2026-09-02", { weight_kg: 82 }),
    ];
    expect(replaceMeasurementById(duplicates, {
      id: "a",
      date: "2026-09-03",
      values: { ...EMPTY_VALUES, weight_kg: 79 },
      photoUri: null,
      today: TODAY,
    })).toMatchObject({ ok: true, measurement: { id: "a", weight_kg: 79 } });
    expect(replaceMeasurementById(duplicates, {
      id: "a",
      date: "2026-09-02",
      values: { ...EMPTY_VALUES, weight_kg: 79 },
      photoUri: null,
      today: TODAY,
    })).toMatchObject({ ok: false, issues: [{ code: "duplicate_date_conflict" }] });
  });

  it("no permite dejar un registro vacío y elimina por identidad estable", () => {
    const existing = measurement("a", "2026-09-03", { weight_kg: 80 });
    expect(upsertMeasurementByDate([existing], {
      date: "2026-09-03",
      patch: { weight_kg: null },
      createId: () => "unused",
      today: TODAY,
    })).toMatchObject({ ok: false, issues: [{ code: "empty_measurement" }] });
    expect(deleteMeasurementById([existing], "a")).toMatchObject({
      ok: true,
      action: "deleted",
      measurements: [],
      removed: [{ id: "a" }],
    });
  });

  it("ordena con desempate estable, limita la colección y selecciona por fecha, no por posición", () => {
    const unordered = [
      measurement("b", "2026-09-02", { weight_kg: 82 }),
      measurement("c", "2026-09-03", { height_cm: 180 }),
      measurement("a", "2026-09-03", { weight_kg: 80 }),
    ];
    expect(sortMeasurementsDesc(unordered).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(selectLatestMeasurementWithMetric(unordered, "weight_kg")?.id).toBe("a");
    expect(resolveMeasurementMetricPair(unordered, (item) => item.weight_kg)).toEqual({
      latest: 80,
      previous: 82,
    });

    const many = Array.from({ length: MAX_MEASUREMENTS }, (_, index) => (
      measurement(`id-${index}`, "2026-09-01", { weight_kg: 80 })
    ));
    const capped = upsertMeasurementByDate(many, {
      date: "2026-09-03",
      patch: { weight_kg: 79 },
      createId: () => "new",
      today: TODAY,
    });
    expect(capped).toMatchObject({ ok: true });
    if (capped.ok) {
      expect(capped.measurements).toHaveLength(MAX_MEASUREMENTS);
      expect(capped.removed).toHaveLength(1);
    }
  });

  it("calcula periodos por días de calendario y conserva las fórmulas de grasa corporal", () => {
    const values = [
      measurement("old", "2026-08-04", { weight_kg: 82 }),
      measurement("first", "2026-08-05", { weight_kg: 81 }),
      measurement("latest", "2026-09-03", { weight_kg: 80 }),
    ];
    expect(buildMeasurementChartPoints(values, (item) => item.weight_kg, {
      days: 30,
      today: TODAY,
    }).map((point) => point.key)).toEqual(["first", "latest"]);

    const male = measurement("male", "2026-09-03", {
      height_cm: 180,
      waist_cm: 90,
      neck_cm: 40,
    });
    expect(estimateMeasurementBodyFatPercentage(male, null, "male")).toBeCloseTo(18.5, 1);
    expect(estimateMeasurementBodyFatPercentage(
      { ...male, body_fat_pct: 17.25 },
      null,
      "male",
    )).toBe(17.25);
  });

  it("mantiene selectores invariantes ante cualquier permutación", () => {
    fc.assert(fc.property(
      fc.shuffledSubarray([
        measurement("d1", "2026-09-03", { weight_kg: 80 }),
        measurement("d2", "2026-09-02", { weight_kg: 81 }),
        measurement("d3", "2026-09-01", { weight_kg: 82 }),
      ], { minLength: 3, maxLength: 3 }),
      (permutation) => {
        const pair = resolveMeasurementMetricPair(permutation, (item) => item.weight_kg);
        return pair.latest === 80 && pair.previous === 81;
      },
    ), { numRuns: 100, seed: 171 });
  });
});
