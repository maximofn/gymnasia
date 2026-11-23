import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildDietPeriod,
  buildMeasurementPeriod,
  buildWorkoutPeriod,
  enumeratePeriodDates,
  PERIOD_READ_MAX_DAYS,
  PERIOD_READ_MAX_OUTPUT_CHARS,
  serializePeriodResult,
  validatePeriod,
  workoutSessionLocalDate,
  type ValidatedPeriod,
} from "./periodReads";
import { buildDietDailyPresentationModel } from "../diet/dailyPresentationModel";
import { formatNutritionNumber, type DietDay } from "../diet/model";
import type { Measurement } from "../measurements/measurementContract";
import type { WorkoutSessionSummary } from "../training/workoutHistory";

function period(from: string, to: string, max = 400): ValidatedPeriod {
  const result = validatePeriod(from, to, max);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function measurement(id: string, measuredOn: string, values: Partial<Measurement> = {}): Measurement {
  return {
    id,
    measured_on: measuredOn,
    measured_at: `${measuredOn}T12:00:00.000Z`,
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
    ...values,
  };
}

function dietDay(date: string, items: Array<[number, number, number, number]>, meal = "Comida"): DietDay {
  return {
    day_date: date,
    meals: [{
      id: `${date}-${meal}`,
      title: meal,
      items: items.map(([calories, protein, carbs, fat], index) => ({
        id: `${date}-${index}`,
        title: `Alimento ${index}`,
        grams: 100,
        calories_kcal: calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      })),
    }],
  };
}

function session(id: string, finishedAt: string, values: Partial<WorkoutSessionSummary> = {}): WorkoutSessionSummary {
  return {
    id,
    template_id: "tpl",
    template_name: "Pierna",
    finished_at: finishedAt,
    elapsed_seconds: 3600,
    completion_status: "completed",
    summary_schema_version: 2,
    calculation_version: 2,
    can_recalculate: false,
    prescription_snapshot: null,
    completed_effort_count: 12,
    total_effort_count: 12,
    effort_breakdown: null,
    estimated_calories: 300,
    total_volume_kg: 4200,
    total_reps: 96,
    ...values,
  } as WorkoutSessionSummary;
}

describe("validatePeriod", () => {
  it("acepta un periodo válido e incluye ambos extremos", () => {
    const result = validatePeriod("2026-11-01", "2026-11-07", 30);
    expect(result).toEqual({ ok: true, value: { from: "2026-11-01", to: "2026-11-07", days: 7 } });
  });

  it("cuenta bien los días al cruzar el cambio de hora y los años bisiestos", () => {
    expect(period("2026-03-28", "2026-03-30").days).toBe(3);
    expect(period("2026-10-24", "2026-10-26").days).toBe(3);
    expect(period("2028-02-28", "2028-03-01").days).toBe(3);
    expect(enumeratePeriodDates(period("2028-02-28", "2028-03-01")))
      .toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("rechaza fechas inexistentes, mal formadas o que no son texto", () => {
    for (const [from, to] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-1-01", "2026-01-02"],
      ["ayer", "hoy"],
      [20261101, "2026-11-02"],
      [undefined, "2026-11-02"],
    ]) {
      const result = validatePeriod(from, to, 30);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("invalid_period");
    }
  });

  it("rechaza un periodo invertido", () => {
    const result = validatePeriod("2026-11-10", "2026-11-01", 30);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_period");
      expect(result.error.message).toContain("posterior");
    }
  });

  it("rechaza un periodo mayor que el tope y propone el tramo más reciente que cabe", () => {
    const result = validatePeriod("2026-01-01", "2026-12-31", PERIOD_READ_MAX_DAYS.diet);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("period_too_long");
    expect(result.error.details).toEqual({
      requested_days: 365,
      max_days: 92,
      suggested_from: "2026-10-01",
      suggested_to: "2026-12-31",
    });
    expect(result.error.message).toContain("92");
    const suggestion = validatePeriod("2026-10-01", "2026-12-31", PERIOD_READ_MAX_DAYS.diet);
    expect(suggestion.ok).toBe(true);
  });

  it("acepta exactamente el tope", () => {
    expect(validatePeriod("2026-01-01", "2026-01-14", PERIOD_READ_MAX_DAYS.dietWithFoods).ok).toBe(true);
    expect(validatePeriod("2026-01-01", "2026-01-15", PERIOD_READ_MAX_DAYS.dietWithFoods).ok).toBe(false);
  });
});

describe("buildMeasurementPeriod", () => {
  it("devuelve primer y último valor de cada medida y su diferencia", () => {
    const result = buildMeasurementPeriod([
      measurement("a", "2026-11-20", { weight_kg: 79.4, waist_cm: 84 }),
      measurement("b", "2026-11-01", { weight_kg: 81.2 }),
      measurement("c", "2026-11-10", { weight_kg: 80.1, waist_cm: 86.5 }),
      measurement("fuera", "2026-10-31", { weight_kg: 90 }),
    ], period("2026-11-01", "2026-11-30"));

    expect(result.dias_con_registro).toBe(3);
    expect(result.registros.map((record) => record.fecha)).toEqual(["2026-11-01", "2026-11-10", "2026-11-20"]);
    expect(result.evolucion.weight_kg).toEqual({
      sin_datos: false,
      primero: { fecha: "2026-11-01", valor: 81.2 },
      ultimo: { fecha: "2026-11-20", valor: 79.4 },
      diferencia: -1.8,
      registros: 3,
    });
    expect(result.evolucion.waist_cm).toMatchObject({ diferencia: -2.5, registros: 2 });
    expect(result.evolucion.chest_cm).toEqual({ sin_datos: true });
    expect(result.registros[0]).toEqual({ fecha: "2026-11-01", weight_kg: 81.2 });
  });

  it("no usa los días con mediciones duplicadas y los señala", () => {
    const result = buildMeasurementPeriod([
      measurement("a", "2026-11-01", { weight_kg: 81 }),
      measurement("b", "2026-11-05", { weight_kg: 70 }),
      measurement("c", "2026-11-05", { weight_kg: 90 }),
      measurement("d", "2026-11-09", { weight_kg: 80 }),
    ], period("2026-11-01", "2026-11-30"));
    expect(result.fechas_ambiguas).toEqual(["2026-11-05"]);
    expect(result.registros.map((record) => record.fecha)).toEqual(["2026-11-01", "2026-11-09"]);
    expect(result.nota).toBeDefined();
  });

  it("indica sin datos cuando el periodo no tiene mediciones", () => {
    const result = buildMeasurementPeriod([], period("2026-11-01", "2026-11-30"));
    expect(result.dias_con_registro).toBe(0);
    expect(result.evolucion.weight_kg).toEqual({ sin_datos: true });
  });
});

describe("buildDietPeriod", () => {
  it("regresión: los días sin registro no cuentan como 0 kcal ni rebajan la media", () => {
    const dietByDate: Record<string, DietDay> = {
      "2026-11-16": dietDay("2026-11-16", [[2000, 150, 200, 60]]),
      "2026-11-17": dietDay("2026-11-17", [[2200, 160, 220, 70]]),
      // 18 y 19 sin apuntar; el 19 existe pero vacío.
      "2026-11-19": { day_date: "2026-11-19", meals: [{ id: "x", title: "Cena", items: [] }] },
      "2026-11-20": dietDay("2026-11-20", [[1800, 140, 180, 50]]),
      "2026-11-21": dietDay("2026-11-21", [[2100, 150, 210, 65]]),
      "2026-11-22": dietDay("2026-11-22", [[1900, 145, 190, 55]]),
    };
    const result = buildDietPeriod(dietByDate, period("2026-11-16", "2026-11-22"));

    expect(result.dias.find((day) => day.fecha === "2026-11-18")).toEqual({ fecha: "2026-11-18", sin_registro: true });
    expect(result.dias.find((day) => day.fecha === "2026-11-19")).toEqual({ fecha: "2026-11-19", sin_registro: true });
    expect(result.resumen.dias_con_registro).toBe(5);
    expect(result.resumen.dias_sin_registro).toBe(2);
    expect(result.resumen.total.calorias_kcal).toBe(10000);
    expect(result.resumen.media_por_dia_registrado?.calorias_kcal).toBe(2000);
    expect(JSON.stringify(result.dias.filter((day) => day.sin_registro))).not.toContain("calorias");
  });

  it("devuelve media nula cuando no hay ningún día registrado", () => {
    const result = buildDietPeriod({}, period("2026-11-01", "2026-11-03"));
    expect(result.resumen.media_por_dia_registrado).toBeNull();
    expect(result.dias.every((day) => day.sin_registro)).toBe(true);
  });

  it("solo incluye los alimentos si se piden", () => {
    const dietByDate = { "2026-11-01": dietDay("2026-11-01", [[300, 10, 40, 5]], "Desayuno") };
    const summary = buildDietPeriod(dietByDate, period("2026-11-01", "2026-11-01"));
    expect(summary.dias[0]).not.toHaveProperty("comidas");
    const detailed = buildDietPeriod(dietByDate, period("2026-11-01", "2026-11-01"), { includeFoods: true });
    expect(detailed.dias[0]).toMatchObject({
      comidas: [{ comida: "Desayuno", alimentos: [{ nombre: "Alimento 0", calorias_kcal: 300 }] }],
    });
  });

  it("no lee propiedades heredadas como si fueran días", () => {
    const result = buildDietPeriod(Object.create({ "2026-11-01": dietDay("2026-11-01", [[1, 1, 1, 1]]) }), period("2026-11-01", "2026-11-01"));
    expect(result.dias[0]).toEqual({ fecha: "2026-11-01", sin_registro: true });
  });
});

describe("contrato con la pantalla de Dieta", () => {
  const itemArb = fc.tuple(
    fc.double({ min: 0, max: 2000, noNaN: true }),
    fc.double({ min: 0, max: 200, noNaN: true }),
    fc.double({ min: 0, max: 300, noNaN: true }),
    fc.double({ min: 0, max: 150, noNaN: true }),
  );

  it("las cifras de cada día coinciden con las que muestra la pantalla", () => {
    fc.assert(fc.property(fc.array(itemArb, { minLength: 1, maxLength: 12 }), (items) => {
      const day = dietDay("2026-11-01", items);
      const toolDay = buildDietPeriod({ "2026-11-01": day }, period("2026-11-01", "2026-11-01")).dias[0];
      if (toolDay.sin_registro) return false;
      const screen = buildDietDailyPresentationModel({
        selectedDate: "2026-11-01",
        referenceDate: "2026-11-01",
        day,
        dailyCaloriesTarget: 2000,
        macroTargets: { protein: 150, carbs: 250, fat: 70 },
        foods: [],
        personalFoods: [],
        foodSearch: "",
        selectedFood: null,
        selectedGrams: "",
        nutritionIssues: [],
        manualFields: { name: "", grams: "", calories_kcal: "", protein_g: "", carbs_g: "", fat_g: "" },
      } as Parameters<typeof buildDietDailyPresentationModel>[0]);
      const macro = (key: string) => screen.macroOverview.find((entry) => entry.key === key)!.consumed;
      return formatNutritionNumber(toolDay.calorias_kcal) === formatNutritionNumber(screen.caloriesConsumed)
        && formatNutritionNumber(toolDay.proteina_g) === formatNutritionNumber(macro("protein"))
        && formatNutritionNumber(toolDay.carbohidratos_g) === formatNutritionNumber(macro("carbs"))
        && formatNutritionNumber(toolDay.grasa_g) === formatNutritionNumber(macro("fat"));
    }));
  });
});

describe("buildWorkoutPeriod", () => {
  it("cuenta sesiones y días entrenados con datos reales del historial", () => {
    const result = buildWorkoutPeriod([
      session("a", new Date(2026, 10, 3, 19, 0).toISOString()),
      session("b", new Date(2026, 10, 3, 20, 30).toISOString(), { completion_status: "partial", total_volume_kg: 1000.005 }),
      session("c", new Date(2026, 10, 10, 9, 0).toISOString()),
      session("fuera", new Date(2026, 9, 31, 9, 0).toISOString()),
    ], period("2026-11-01", "2026-11-30"));
    expect(result.resumen).toMatchObject({
      sesiones: 3,
      sesiones_completadas: 2,
      sesiones_parciales: 1,
      dias_con_entrenamiento: 2,
      repeticiones_totales: 288,
    });
    expect(result.sesiones.map((entry) => entry.fecha)).toEqual(["2026-11-03", "2026-11-03", "2026-11-10"]);
    expect(result.sesiones[0]).toMatchObject({ rutina: "Pierna", duracion_minutos: 60, estado: "completado" });
  });

  it("asigna la sesión al día local en que terminó, no al día UTC", () => {
    const lateNight = new Date(2026, 10, 3, 23, 30);
    expect(workoutSessionLocalDate({ finished_at: lateNight.toISOString() })).toBe("2026-11-03");
  });

  it("descarta fechas de fin inválidas en vez de fallar", () => {
    const result = buildWorkoutPeriod([session("x", "no-es-fecha")], period("2026-11-01", "2026-11-30"));
    expect(result.resumen.sesiones).toBe(0);
  });
});

describe("serializePeriodResult", () => {
  it("rechaza un resultado demasiado grande en vez de recortarlo", () => {
    const result = serializePeriodResult({ texto: "x".repeat(200) }, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("result_too_large");
  });
});

describe("propiedades (property-based)", () => {
  const dayOffsetArb = fc.integer({ min: 0, max: PERIOD_READ_MAX_DAYS.diet - 1 });
  const entryArb = fc.record({
    offset: dayOffsetArb,
    calories: fc.integer({ min: 0, max: 4000 }),
    protein: fc.integer({ min: 0, max: 300 }),
  });

  it("la suma de los totales diarios coincide con el total del periodo y el resultado cabe en el tope", () => {
    fc.assert(fc.property(
      fc.array(entryArb, { maxLength: 120 }),
      fc.integer({ min: 1, max: PERIOD_READ_MAX_DAYS.diet }),
      fc.boolean(),
      (entries, days, includeFoods) => {
        const from = "2026-01-01";
        const dates = enumeratePeriodDates({ from, to: from, days: PERIOD_READ_MAX_DAYS.diet });
        const dietByDate: Record<string, DietDay> = {};
        for (const entry of entries) {
          const date = dates[entry.offset];
          const day = dietByDate[date] ?? dietDay(date, []);
          day.meals[0].items.push({
            id: `${date}-${day.meals[0].items.length}`,
            title: "Alimento",
            grams: 100,
            calories_kcal: entry.calories,
            protein_g: entry.protein,
            carbs_g: 0,
            fat_g: 0,
          });
          dietByDate[date] = day;
        }
        const maxDays = includeFoods ? PERIOD_READ_MAX_DAYS.dietWithFoods : PERIOD_READ_MAX_DAYS.diet;
        const validated = validatePeriod(from, dates[Math.min(days, maxDays) - 1], maxDays);
        if (!validated.ok) return false;
        const result = buildDietPeriod(dietByDate, validated.value, { includeFoods });
        const recorded = result.dias.filter((day) => !day.sin_registro);
        const daySum = recorded.reduce((sum, day) => sum + (day.sin_registro ? 0 : day.calorias_kcal), 0);
        const serialized = serializePeriodResult(result);
        return Math.abs(daySum - result.resumen.total.calorias_kcal) < 1e-6
          && result.resumen.dias_con_registro === recorded.length
          && result.dias.length === validated.value.days
          && serialized.ok
          && serialized.output.length <= PERIOD_READ_MAX_OUTPUT_CHARS;
      },
    ));
  });

  it("validatePeriod nunca acepta un periodo mayor que el tope ni invertido", () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 3000 }),
      fc.integer({ min: -50, max: 800 }),
      fc.integer({ min: 1, max: 400 }),
      (startOffset, length, maxDays) => {
        const start = Date.UTC(2020, 0, 1) + startOffset * 86_400_000;
        const end = start + length * 86_400_000;
        const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
        const result = validatePeriod(key(start), key(end), maxDays);
        if (length < 0 || length + 1 > maxDays) return !result.ok;
        return result.ok && result.value.days === length + 1;
      },
    ));
  });
});
