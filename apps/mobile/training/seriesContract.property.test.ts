import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildSeriesFromLegacyExercise,
  createIssueSink,
  resolveTrainingIssues,
  seriesToLegacySets,
  SERIES_TYPES,
} from "./seriesContract";

const RUNS = { numRuns: 500, seed: 173 } as const;

function deterministicIds(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `${prefix}_${++counter}`;
}

function normalize(exercise: unknown, mode: "repair" | "strict" = "repair") {
  const sink = createIssueSink(mode);
  const series = buildSeriesFromLegacyExercise(exercise, "templates[0].exercises[0]", deterministicIds(), sink);
  return { series, sink, result: resolveTrainingIssues(series, sink) };
}

/** Series plausibles, incluidas las compuestas con mini-series. */
const arbitrarySeries = fc.record(
  {
    id: fc.string({ minLength: 1, maxLength: 8 }),
    type: fc.constantFrom(...SERIES_TYPES),
    reps: fc.string({ maxLength: 6 }),
    weight_kg: fc.string({ maxLength: 6 }),
    rest_seconds: fc.string({ maxLength: 6 }),
    tempo_contraction: fc.integer({ min: 0, max: 9 }).map(String),
    sub_series: fc.array(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 8 }),
        reps: fc.string({ maxLength: 6 }),
        weight_kg: fc.string({ maxLength: 6 }),
        rest_seconds: fc.string({ maxLength: 6 }),
      }),
      { maxLength: 4 },
    ),
  },
  { requiredKeys: ["id", "reps", "weight_kg", "rest_seconds"] },
);

describe("propiedades de la normalización de series", () => {
  it("en modo reparar nunca lanza y nunca bloquea, sea cual sea la entrada", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const { result } = normalize(value, "repair");
        expect(result.ok).toBe(true);
        expect(result.issues.every((issue) => issue.severity === "repaired")).toBe(true);
      }),
      RUNS,
    );
  });

  it("el resultado bloquea exactamente cuando hay una incidencia irrecuperable", () => {
    fc.assert(
      fc.property(fc.anything(), fc.constantFrom("repair" as const, "strict" as const), (value, mode) => {
        const { result } = normalize(value, mode);
        const blocked = result.issues.some((issue) => issue.severity === "unrecoverable");
        expect(result.ok).toBe(!blocked);
      }),
      RUNS,
    );
  });

  it("normalizar es idempotente sobre cualquier entrada", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const first = normalize(value).series;
        const second = normalize({ series: first });
        expect(second.series).toEqual(first);
        expect(second.sink.issues).toEqual([]);
      }),
      RUNS,
    );
  });

  it("los identificadores de salida son siempre únicos dentro de su ámbito", () => {
    fc.assert(
      fc.property(fc.array(arbitrarySeries, { maxLength: 8 }), (series) => {
        const normalized = normalize({ series }).series;
        const ids = normalized.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const item of normalized) {
          const subIds = (item.sub_series ?? []).map((sub) => sub.id);
          expect(new Set(subIds).size).toBe(subIds.length);
        }
      }),
      RUNS,
    );
  });

  it("ninguna serie bien formada pierde su tipo, su tempo ni sus mini-series", () => {
    fc.assert(
      fc.property(fc.array(arbitrarySeries, { minLength: 1, maxLength: 6 }), (series) => {
        const normalized = normalize({ series }).series;
        expect(normalized).toHaveLength(series.length);
        series.forEach((original, index) => {
          const result = normalized[index];
          if (original.type) expect(result.type).toBe(original.type);
          if (original.tempo_contraction) {
            expect(result.tempo_contraction).toBe(original.tempo_contraction);
          }
          if (original.sub_series) {
            expect(result.sub_series ?? []).toHaveLength(original.sub_series.length);
          }
        });
      }),
      RUNS,
    );
  });

  it("toda incidencia apunta a una ruta bajo el ejercicio que se estaba normalizando", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        for (const issue of normalize(value).sink.issues) {
          expect(issue.field.startsWith("templates[0].exercises[0]")).toBe(true);
          expect(issue.message.trim().length).toBeGreaterThan(0);
        }
      }),
      RUNS,
    );
  });

  it("la proyección al formato heredado nunca inventa entradas", () => {
    fc.assert(
      fc.property(fc.array(arbitrarySeries, { maxLength: 8 }), (series) => {
        const normalized = normalize({ series }).series;
        const legacy = seriesToLegacySets(normalized);
        expect(legacy.length).toBeLessThanOrEqual(normalized.length);
        expect(legacy.every((value) => Number.isInteger(value) && value > 0)).toBe(true);
      }),
      RUNS,
    );
  });
});
