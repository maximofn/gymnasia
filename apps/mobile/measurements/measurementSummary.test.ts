import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_MEASUREMENTS, MEASUREMENT_METRIC_KEYS, MEASUREMENT_SUMMARY_KEYS,
  buildMeasurementChartPoints, buildPreparedMeasurementChartPoints,
  deleteMeasurementById, estimateMeasurementBodyFatPercentage,
  localDateKey, measurementDateAtLocalNoon, prepareMeasurementHistory,
  replaceMeasurementById, resolveMeasurementMetricPair, resolveMeasurementSummary,
  selectLatestMeasurementWithMetric, sortMeasurementsDesc, upsertMeasurementByDate,
  type Measurement, type MeasurementSex, type MeasurementValues, type MeasurementWorkCounters,
} from "./measurementContract";
import { measurementPerformanceCounters } from "./measurementPerformance";

const TODAY = new Date(2026, 8, 9, 12);
const emptyValues = Object.fromEntries(MEASUREMENT_METRIC_KEYS.map((key) => [key, null]));

function measurement(id: string, date: string, values: Partial<Measurement> = {}): Measurement {
  return {
    ...emptyValues, id, measured_on: date, measured_at: `${date}T12:00:00.000Z`, photo_uri: null,
    ...values,
  } as Measurement;
}

function workCounters(): MeasurementWorkCounters {
  return {
    preparations: 0, sorts: 0, preparationVisits: 0, summaries: 0,
    summaryVisits: 0, metricEvaluations: 0, charts: 0, cards: 0,
  };
}

// Frozen reference of the previous algorithm: deliberately quadratic and test-only.
function previousValues(measurements: readonly Measurement[], selector: (m: Measurement) => number | null) {
  const results: Array<{ measurement: Measurement; value: number }> = [];
  let currentDate: string | null = null;
  for (const item of sortMeasurementsDesc(measurements)) {
    if (item.measured_on !== currentDate) {
      currentDate = item.measured_on;
      const sameDay = sortMeasurementsDesc(measurements.filter((m) => m.measured_on === currentDate));
      const candidate = sameDay.map((m) => ({ measurement: m, value: selector(m) }))
        .find((m): m is { measurement: Measurement; value: number } => (
          m.value !== null && Number.isFinite(m.value)
        ));
      if (candidate) results.push(candidate);
    }
  }
  return results;
}

function assertEquivalent(measurements: Measurement[], fallbackHeight: number | null, sex: MeasurementSex) {
  const history = prepareMeasurementHistory(measurements);
  const height = previousValues(measurements, (m) => m.height_cm)[0]?.measurement ?? null;
  expect(history.latestHeightMeasurement).toBe(height);
  expect(history.latestWeightMeasurement).toBe(previousValues(measurements, (m) => m.weight_kg)[0]?.measurement ?? null);
  const effectiveHeight = height?.height_cm ?? fallbackHeight;
  const summary = resolveMeasurementSummary(history, effectiveHeight, sex);
  for (const key of MEASUREMENT_SUMMARY_KEYS) {
    const selector = (m: Measurement) => key === "body_fat_pct"
      ? estimateMeasurementBodyFatPercentage(m, effectiveHeight, sex) : m[key];
    const previous = previousValues(measurements, selector);
    const expected = { latest: previous[0]?.value ?? null, previous: previous[1]?.value ?? null };
    expect(summary[key]).toEqual(expected);
    expect(resolveMeasurementMetricPair(measurements, selector)).toEqual(expected);
    for (const days of [null, 1, 7, 30]) {
      const cutoff = new Date(TODAY);
      if (days !== null) cutoff.setDate(cutoff.getDate() - (days - 1));
      const points = previous.filter(({ measurement: m }) => days === null || m.measured_on >= localDateKey(cutoff))
        .map(({ measurement: m, value }) => ({
          key: m.id, measuredOn: m.measured_on,
          timestamp: measurementDateAtLocalNoon(m.measured_on)!.getTime(), value,
        })).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn) || a.key.localeCompare(b.key));
      expect(buildPreparedMeasurementChartPoints(history, selector, { days, today: TODAY })).toEqual(points);
      expect(buildMeasurementChartPoints(measurements, selector, { days, today: TODAY })).toEqual(points);
    }
  }
  for (const field of MEASUREMENT_METRIC_KEYS) {
    expect(selectLatestMeasurementWithMetric(measurements, field)).toBe(
      previousValues(measurements, (m) => m[field])[0]?.measurement ?? null,
    );
  }
}

describe("resumen de medidas compartido", () => {
  it("conserva desempates, valores ausentes/no finitos y la identidad sin mutar el historial", () => {
    const values = [
      measurement("old", "2026-08-01", { weight_kg: 85, neck_cm: 39, waist_cm: 91, hips_cm: 100 }),
      measurement("z", "2026-09-09", { weight_kg: 80, height_cm: 180, body_fat_pct: 20 }),
      measurement("a", "2026-09-09", { weight_kg: NaN, chest_cm: 101, neck_cm: Infinity }),
      measurement("newer-time", "2026-09-09", { measured_at: "2026-09-09T13:00:00Z", weight_kg: 0 }),
      measurement("yesterday", "2026-09-08", { weight_kg: 82, neck_cm: 40, waist_cm: 90, hips_cm: 99 }),
      measurement("empty-day", "2026-09-07", { photo_uri: "photo", weight_kg: -Infinity }),
    ];
    const before = structuredClone(values);
    for (const item of values) Object.freeze(item);
    Object.freeze(values);
    for (const sex of ["male", "female"] as const) assertEquivalent(values, 170, sex);
    expect(values).toEqual(before);
  });

  it("no combina contornos de entradas diferentes y permite completar cada métrica por separado", () => {
    const history = prepareMeasurementHistory([
      measurement("a", "2026-09-09", { waist_cm: 90 }),
      measurement("b", "2026-09-09", { neck_cm: 40 }),
      measurement("c", "2026-09-08", { body_fat_pct: 21 }),
    ]);
    const summary = resolveMeasurementSummary(history, 180, "male");
    expect(summary.waist_cm.latest).toBe(90);
    expect(summary.neck_cm.latest).toBe(40);
    expect(summary.body_fat_pct).toEqual({ latest: 21, previous: null });
  });

  it("recalcula tras alta, edición, borrado y reemplazo completo, sin cambiar el contrato de mutación", () => {
    let values = [measurement("a", "2026-09-07", { weight_kg: 80 })];
    const original = prepareMeasurementHistory(values);
    const added = upsertMeasurementByDate(values, {
      date: "2026-09-08", patch: { weight_kg: 79 }, today: TODAY, createId: () => "b",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.measurements).not.toBe(values);
    values = added.measurements;
    expect(resolveMeasurementSummary(prepareMeasurementHistory(values), null, "male").weight_kg)
      .toEqual({ latest: 79, previous: 80 });
    const validEdit = replaceMeasurementById(values, {
      id: "b", date: "2026-09-08",
      values: Object.fromEntries(MEASUREMENT_METRIC_KEYS.map((key) => [key, key === "weight_kg" ? 78 : null])) as MeasurementValues,
      photoUri: null, today: TODAY,
    });
    expect(validEdit.ok).toBe(true);
    if (!validEdit.ok) return;
    expect(validEdit.measurements).not.toBe(values);
    expect(resolveMeasurementSummary(prepareMeasurementHistory(validEdit.measurements), null, "male").weight_kg.latest).toBe(78);
    const deleted = deleteMeasurementById(validEdit.measurements, "b");
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.measurements).not.toBe(validEdit.measurements);
    expect(resolveMeasurementSummary(prepareMeasurementHistory(deleted.measurements), null, "male").weight_kg.latest).toBe(80);
    expect(resolveMeasurementSummary(original, null, "male").weight_kg.latest).toBe(80);
    expect(resolveMeasurementSummary(prepareMeasurementHistory([]), null, "male").weight_kg.latest).toBeNull();
  });

  it.each([0, 1, 100, 500, MAX_MEASUREMENTS])("acota el trabajo real con %i registros", (size) => {
    let reads = 0;
    const values = Array.from({ length: size }, (_, index) => {
      const date = new Date(TODAY);
      date.setDate(date.getDate() - index);
      return new Proxy(measurement(`${index}`, localDateKey(date), { photo_uri: "photo" }), {
        get(target, key, receiver) {
          if (MEASUREMENT_METRIC_KEYS.includes(key as typeof MEASUREMENT_METRIC_KEYS[number])) reads += 1;
          return Reflect.get(target, key, receiver);
        },
      });
    });
    const work = workCounters();
    const sort = vi.spyOn(Array.prototype, "sort");
    const history = prepareMeasurementHistory(values, work);
    resolveMeasurementSummary(history, 180, "female", work);
    buildPreparedMeasurementChartPoints(history, (m) => m.weight_kg, { days: null }, work);
    expect(sort).toHaveBeenCalledTimes(1);
    sort.mockRestore();
    expect(work).toMatchObject({ preparations: 1, sorts: 1, preparationVisits: size, summaries: 1, summaryVisits: size, charts: 1 });
    expect(work.metricEvaluations).toBeLessThanOrEqual(9 * size);
    expect(reads).toBeLessThanOrEqual(24 * size);
  });

  it("mantiene equivalencia sobre historiales generados y permutados", () => {
    const metric = fc.oneof(fc.constant(null), fc.constant(NaN), fc.constant(Infinity), fc.integer({ min: 0, max: 220 }));
    const row = fc.record({
      day: fc.integer({ min: 0, max: 40 }), hour: fc.integer({ min: 0, max: 23 }),
      values: fc.tuple(...MEASUREMENT_METRIC_KEYS.map(() => metric)),
    });
    fc.assert(fc.property(fc.array(row, { maxLength: 35 }), fc.boolean(), (rows, female) => {
      const values = rows.map((row, index) => {
        const date = new Date(TODAY);
        date.setDate(date.getDate() - row.day);
        return measurement(`id-${index}`, localDateKey(date), {
          ...Object.fromEntries(MEASUREMENT_METRIC_KEYS.map((key, i) => [key, row.values[i]])),
          measured_at: `${localDateKey(date)}T${String(row.hour).padStart(2, "0")}:00:00Z`,
        });
      });
      assertEquivalent(values, 175, female ? "female" : "male");
    }), { numRuns: 80, seed: 230 });
  });
});

describe("sonda de rendimiento exclusiva de pruebas web", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("no se activa sin flag ni en Staging, Producción o plataformas nativas", () => {
    vi.stubEnv("EXPO_PUBLIC_MEASUREMENT_PERF_TEST", "");
    expect(measurementPerformanceCounters("development", "web")).toBeUndefined();
    vi.stubEnv("EXPO_PUBLIC_MEASUREMENT_PERF_TEST", "1");
    for (const [environment, platform] of [["staging", "web"], ["production", "web"], ["development", "android"], ["development", "ios"]]) {
      expect(measurementPerformanceCounters(environment, platform)).toBeUndefined();
    }
    const work = measurementPerformanceCounters("development", "web");
    expect(work).toEqual(workCounters());
    expect(measurementPerformanceCounters("development", "web")).toBe(work);
  });
});
