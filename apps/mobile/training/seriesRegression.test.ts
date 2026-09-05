import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSeriesFromLegacyExercise,
  createIssueSink,
  seriesToLegacySets,
} from "./seriesContract";

function loadFixture(name: string): { descripcion: string; exercise: unknown } {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"),
  );
}

function normalize(exercise: unknown) {
  const sink = createIssueSink("repair");
  let counter = 0;
  const series = buildSeriesFromLegacyExercise(
    exercise,
    "templates[0].exercises[0]",
    (prefix) => `${prefix}_${++counter}`,
    sink,
  );
  return { series, issues: sink.issues };
}

describe("regresión de series avanzadas", () => {
  it("no vuelve a aplanar las series que el fallo anterior a 84ef6f2 descartaba", () => {
    const { series, issues } = normalize(loadFixture("legacy-pre-84ef6f2").exercise);

    expect(issues).toEqual([]);
    expect(series).toHaveLength(4);

    // Lo que el fallo histórico borraba, campo por campo.
    expect(series.map((item) => item.type)).toEqual([
      "warmup",
      "tempo",
      "dropset",
      "superset",
    ]);
    expect(series[1]).toMatchObject({
      tempo_contraction: "3",
      tempo_pause: "1",
      tempo_relaxation: "2",
    });
    expect(series[2].sub_series?.map((sub) => sub.weight_kg)).toEqual(["55", "40"]);
    expect(series[3].sub_series?.[0].exercise_name).toBe("Aperturas con mancuernas");

    // Y los identificadores originales se respetan: no se renumera lo que ya vale.
    expect(series.map((item) => item.id)).toEqual([
      "set_calentamiento",
      "set_tempo",
      "set_dropset",
      "set_superserie",
    ]);
  });

  it("no dice nada de un ejercicio sano, para que el registro signifique algo", () => {
    const { series, issues } = normalize(loadFixture("healthy-current").exercise);

    expect(issues).toEqual([]);
    expect(series).toHaveLength(3);
    expect(seriesToLegacySets(series)).toEqual([10, 8, 8]);
  });

  it("prefiere las series guardadas al formato heredado cuando existen ambos", () => {
    // El fixture trae `sets` y `series` a la vez, como los almacenes reales.
    const fixture = loadFixture("legacy-pre-84ef6f2").exercise as { sets: number[] };
    const { series } = normalize(fixture);

    expect(series).toHaveLength(4);
    expect(fixture.sets).toHaveLength(3);
    expect(series[0].weight_kg).toBe("20");
  });
});
