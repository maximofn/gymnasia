import { describe, expect, it } from "vitest";
import {
  buildSeriesFromLegacyExercise,
  createIssueSink,
  formatTrainingIssues,
  resolveTrainingIssues,
  sealedSeriesSchemaVersion,
  seriesToLegacySets,
  summarizeTrainingIssues,
  type TrainingNormalizationMode,
} from "./seriesContract";

/** Identificadores predecibles: los tests comparan valores, no azar. */
function deterministicIds(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => `${prefix}_${++counter}`;
}

function normalize(exercise: unknown, mode: TrainingNormalizationMode = "repair") {
  const sink = createIssueSink(mode);
  const series = buildSeriesFromLegacyExercise(
    exercise,
    "templates[0].exercises[0]",
    deterministicIds(),
    sink,
  );
  return { series, issues: sink.issues, sink };
}

const dropsetExercise = {
  series: [
    {
      id: "s1",
      type: "dropset",
      reps: "8",
      weight_kg: "60",
      rest_seconds: "90",
      tempo_contraction: "3",
      tempo_pause: "1",
      tempo_relaxation: "2",
      sub_series: [
        { id: "ss1", reps: "6", weight_kg: "50", rest_seconds: "0" },
        { id: "ss2", reps: "4", weight_kg: "40", rest_seconds: "0" },
      ],
    },
  ],
};

describe("normalización de series", () => {
  it("conserva intactos el tipo, los tres tempos y las mini-series de un drop-set", () => {
    const { series, issues } = normalize(dropsetExercise);

    expect(issues).toEqual([]);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      id: "s1",
      type: "dropset",
      reps: "8",
      weight_kg: "60",
      rest_seconds: "90",
      tempo_contraction: "3",
      tempo_pause: "1",
      tempo_relaxation: "2",
    });
    expect(series[0].sub_series).toHaveLength(2);
    expect(series[0].sub_series?.map((sub) => sub.id)).toEqual(["ss1", "ss2"]);
    expect(series[0].sub_series?.[1]).toMatchObject({ reps: "4", weight_kg: "40" });
  });

  it("sobrevive al ciclo de serializar y volver a hidratar sin perder nada", () => {
    const first = normalize(dropsetExercise).series;
    const roundTripped = normalize({ series: JSON.parse(JSON.stringify(first)) });

    expect(roundTripped.issues).toEqual([]);
    expect(roundTripped.series).toEqual(first);
  });

  it("es idempotente: normalizar dos veces no cambia nada ni vuelve a quejarse", () => {
    const once = normalize(dropsetExercise).series;
    const twice = normalize({ series: once });

    expect(twice.series).toEqual(once);
    expect(twice.issues).toEqual([]);
  });

  it("degrada a normal un tipo de serie inexistente y dice exactamente dónde estaba", () => {
    const { series, issues } = normalize({
      series: [{ id: "s1", type: "supersett", reps: "8", weight_kg: "", rest_seconds: "" }],
    });

    expect(series[0].type).toBeUndefined();
    expect(series[0].id).toBe("s1");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      field: "templates[0].exercises[0].series[0].type",
      code: "unknown_series_type",
      severity: "repaired",
    });
  });

  it("conserva las mini-series de una serie simple en vez de borrarlas", () => {
    const { series, issues } = normalize({
      series: [
        {
          id: "s1",
          type: "normal",
          reps: "10",
          weight_kg: "",
          rest_seconds: "",
          sub_series: [{ id: "ss1", reps: "5", weight_kg: "20", rest_seconds: "0" }],
        },
      ],
    });

    expect(issues).toEqual([]);
    expect(series[0].sub_series).toHaveLength(1);
  });

  it("acepta repeticiones y pesos numéricos de almacenes antiguos sin romperse", () => {
    const { series, issues } = normalize({
      series: [{ id: "s1", reps: 12, weight_kg: 60, rest_seconds: 90 }],
    });

    expect(issues).toEqual([]);
    expect(series[0]).toMatchObject({ reps: "12", weight_kg: "60", rest_seconds: "90" });
  });

  it("vacía un campo de texto ilegible en vez de reventar al recortarlo", () => {
    const { series, issues } = normalize({
      series: [{ id: "s1", reps: { valor: 8 }, weight_kg: "", rest_seconds: "" }],
    });

    // Sin repeticiones legibles cae al valor por posición, que es lo que ve el usuario.
    expect(series[0].reps).toBe("1");
    expect(issues[0]).toMatchObject({
      field: "templates[0].exercises[0].series[0].reps",
      code: "expected_string",
    });
  });

  it("descarta unas mini-series que no son una lista y lo cuenta", () => {
    const { series, issues } = normalize({
      series: [{ id: "s1", type: "dropset", reps: "8", weight_kg: "", rest_seconds: "", sub_series: "no soy una lista" }],
    });

    expect(series[0].sub_series).toBeUndefined();
    expect(issues[0]).toMatchObject({
      field: "templates[0].exercises[0].series[0].sub_series",
      code: "expected_array",
      severity: "repaired",
    });
  });

  it("renumera los identificadores repetidos y genera los que faltan", () => {
    const { series, issues } = normalize({
      series: [
        { id: "s1", reps: "8", weight_kg: "", rest_seconds: "" },
        { id: "s1", reps: "8", weight_kg: "", rest_seconds: "" },
        { reps: "8", weight_kg: "", rest_seconds: "" },
      ],
    });

    const ids = series.map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe("s1");
    expect(issues.map((issue) => issue.code)).toEqual(["duplicate_id", "missing_id"]);
  });

  it("descarta un tempo que no es un número, porque no significa nada", () => {
    const { series, issues } = normalize({
      series: [{ id: "s1", reps: "8", weight_kg: "", rest_seconds: "", tempo_pause: "despacio" }],
    });

    expect(series[0].tempo_pause).toBeUndefined();
    expect(issues[0]).toMatchObject({ code: "invalid_tempo" });
  });

  it("deriva las series del formato heredado restando dos kilos por serie", () => {
    const { series, issues } = normalize({
      sets: [12, 10, 8],
      load_kg: 40,
      rest_seconds: 90,
    });

    expect(issues).toEqual([]);
    expect(series.map((item) => item.reps)).toEqual(["12", "10", "8"]);
    expect(series.map((item) => item.weight_kg)).toEqual(["40", "38", "36"]);
    expect(series.map((item) => item.rest_seconds)).toEqual(["90", "90", "90"]);
    expect(new Set(series.map((item) => item.id)).size).toBe(3);
  });

  it("proyecta al formato heredado saltando las series sin repeticiones legibles", () => {
    const { series } = normalize({
      series: [
        { id: "a", reps: "12", weight_kg: "", rest_seconds: "" },
        { id: "b", reps: "sin número", weight_kg: "", rest_seconds: "" },
        { id: "c", reps: "8-10", weight_kg: "", rest_seconds: "" },
      ],
    });

    expect(seriesToLegacySets(series)).toEqual([12, 8]);
    expect(seriesToLegacySets(series).length).toBeLessThanOrEqual(series.length);
  });

  it("en modo reparar nunca bloquea, ni siquiera con una serie que no es un objeto", () => {
    const { series, sink } = normalize({ series: ["no soy una serie", 42, null] }, "repair");
    const result = resolveTrainingIssues(series, sink);

    expect(result.ok).toBe(true);
    expect(series).toHaveLength(3);
    expect(sink.issues.every((issue) => issue.severity === "repaired")).toBe(true);
  });

  it("en modo estricto sí bloquea lo que no es interpretable", () => {
    const { series, sink } = normalize({ series: ["no soy una serie"] }, "strict");
    const result = resolveTrainingIssues(series, sink);

    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(sink.issues[0]).toMatchObject({ code: "expected_object", severity: "unrecoverable" });
  });

  it("en modo estricto sigue reparando lo semántico, para no rechazar una copia antigua", () => {
    const { series, sink } = normalize({
      series: [{ id: "s1", type: "supersett", reps: "8", weight_kg: "", rest_seconds: "" }],
    }, "strict");
    const result = resolveTrainingIssues(series, sink);

    expect(result.ok).toBe(true);
    expect(sink.issues[0].severity).toBe("repaired");
  });

  it("conserva una versión de esquema posterior en vez de rebajarla", () => {
    expect(sealedSeriesSchemaVersion({})).toBe(1);
    expect(sealedSeriesSchemaVersion({ series_schema_version: 1 })).toBe(1);
    expect(sealedSeriesSchemaVersion({ series_schema_version: 7 })).toBe(7);
    expect(sealedSeriesSchemaVersion({ series_schema_version: "7" })).toBe(1);
  });

  it("resume y redacta las incidencias para poder enseñarlas", () => {
    const { sink } = normalize({
      series: [
        { id: "s1", type: "supersett", reps: "8", weight_kg: "", rest_seconds: "" },
        { id: "s1", type: "amrap", reps: "8", weight_kg: "", rest_seconds: "" },
      ],
    });

    expect(summarizeTrainingIssues(sink.issues)).toEqual({
      repaired: 2,
      unrecoverable: 0,
      byCode: { unknown_series_type: 1, duplicate_id: 1 },
    });
    expect(formatTrainingIssues(sink.issues)).toContain("supersett");
    expect(formatTrainingIssues([])).toBe("");
  });
});
