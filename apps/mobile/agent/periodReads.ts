/**
 * Lecturas por periodo para Coach (GYM-270, ticket para leer un periodo de
 * fechas de una vez con los totales calculados por la app).
 *
 * Todo lo que se calcula aquí es determinista y no depende de la interfaz: la
 * tool solo serializa lo que devuelven estas funciones. Los totales de dieta
 * salen de las mismas funciones que usa la pantalla de Dieta, para que Coach
 * nunca dé una cifra distinta de la que ve el usuario.
 */
import {
  roundNutritionValue,
  sumDayCalories,
  sumDayMacroGrams,
  type DietDay,
} from "../diet/model";
import {
  localDateKey,
  MEASUREMENT_METRIC_KEYS,
  type Measurement,
  type MeasurementMetricKey,
} from "../measurements/measurementContract";
import type { WorkoutSessionSummary } from "../training/workoutHistory";

/** Días máximos por llamada. Un periodo mayor se rechaza; nunca se recorta. */
export const PERIOD_READ_MAX_DAYS = {
  measurements: 366,
  diet: 92,
  dietWithFoods: 14,
  workouts: 366,
} as const;

/** Red de seguridad sobre el tamaño del resultado serializado. */
export const PERIOD_READ_MAX_OUTPUT_CHARS = 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type PeriodReadError = {
  code: "invalid_period" | "period_too_long" | "result_too_large";
  message: string;
  details?: Record<string, unknown>;
};

export type ValidatedPeriod = { from: string; to: string; days: number };

export type PeriodValidation =
  | { ok: true; value: ValidatedPeriod }
  | { ok: false; error: PeriodReadError };

function dateKeyToUtcMs(rawValue: unknown): number | null {
  if (typeof rawValue !== "string") return null;
  const match = DATE_KEY_PATTERN.exec(rawValue.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day
  ) return null;
  return ms;
}

/** Fecha civil válida en formato YYYY-MM-DD (rechaza, por ejemplo, el 31 de febrero). */
export function isCalendarDateKey(rawValue: unknown): rawValue is string {
  return typeof rawValue === "string" && rawValue === rawValue.trim() && dateKeyToUtcMs(rawValue) !== null;
}

function utcMsToDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Fechas civiles del periodo, ambas incluidas. Aritmética UTC: sin saltos por horario de verano. */
export function enumeratePeriodDates(period: ValidatedPeriod): string[] {
  const start = dateKeyToUtcMs(period.from)!;
  return Array.from({ length: period.days }, (_, index) => utcMsToDateKey(start + index * DAY_MS));
}

export function validatePeriod(
  rawFrom: unknown,
  rawTo: unknown,
  maxDays: number,
): PeriodValidation {
  const fromMs = dateKeyToUtcMs(rawFrom);
  const toMs = dateKeyToUtcMs(rawTo);
  if (fromMs === null || toMs === null) {
    return {
      ok: false,
      error: {
        code: "invalid_period",
        message: "Las fechas from y to deben existir y usar el formato YYYY-MM-DD.",
      },
    };
  }
  if (fromMs > toMs) {
    return {
      ok: false,
      error: {
        code: "invalid_period",
        message: "La fecha from no puede ser posterior a la fecha to. Intercámbialas.",
      },
    };
  }
  const from = utcMsToDateKey(fromMs);
  const to = utcMsToDateKey(toMs);
  const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
  if (days > maxDays) {
    const suggestedFrom = utcMsToDateKey(toMs - (maxDays - 1) * DAY_MS);
    return {
      ok: false,
      error: {
        code: "period_too_long",
        message:
          `El periodo pedido tiene ${days} días y el máximo por consulta es ${maxDays}. ` +
          `Acórtalo, por ejemplo a los ${maxDays} días más recientes (from=${suggestedFrom}, to=${to}), ` +
          "o divídelo en varias consultas.",
        details: {
          requested_days: days,
          max_days: maxDays,
          suggested_from: suggestedFrom,
          suggested_to: to,
        },
      },
    };
  }
  return { ok: true, value: { from, to, days } };
}

export function serializePeriodResult(
  value: unknown,
  maxChars: number = PERIOD_READ_MAX_OUTPUT_CHARS,
): { ok: true; output: string } | { ok: false; error: PeriodReadError } {
  const output = JSON.stringify(value);
  if (output.length <= maxChars) return { ok: true, output };
  return {
    ok: false,
    error: {
      code: "result_too_large",
      message:
        "El resultado de este periodo es demasiado grande para enviarlo de una vez. " +
        "Pide un periodo más corto o, en dieta, consulta sin el detalle de alimentos.",
      details: { max_chars: maxChars },
    },
  };
}

// ---------------------------------------------------------------------------
// Medidas

type MetricPoint = { fecha: string; valor: number };

export type MeasurementMetricChange =
  | { sin_datos: true }
  | {
      sin_datos: false;
      primero: MetricPoint;
      ultimo: MetricPoint;
      diferencia: number;
      registros: number;
    };

export type MeasurementPeriodResult = {
  from: string;
  to: string;
  dias_del_periodo: number;
  dias_con_registro: number;
  registros: Array<{ fecha: string } & Partial<Record<MeasurementMetricKey, number>>>;
  evolucion: Record<MeasurementMetricKey, MeasurementMetricChange>;
  fechas_ambiguas: string[];
  nota?: string;
};

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMeasurementPeriod(
  measurements: readonly Measurement[],
  period: ValidatedPeriod,
): MeasurementPeriodResult {
  const byDate = new Map<string, Measurement[]>();
  for (const measurement of measurements) {
    if (measurement.measured_on < period.from || measurement.measured_on > period.to) continue;
    const list = byDate.get(measurement.measured_on) ?? [];
    list.push(measurement);
    byDate.set(measurement.measured_on, list);
  }
  const dates = [...byDate.keys()].sort();
  // Dos registros el mismo día: no se elige uno a ciegas, igual que read_measurement.
  const ambiguous = dates.filter((date) => byDate.get(date)!.length > 1);
  const usable = dates
    .filter((date) => byDate.get(date)!.length === 1)
    .map((date) => byDate.get(date)![0]);

  const registros = usable.map((measurement) => {
    const record: { fecha: string } & Partial<Record<MeasurementMetricKey, number>> = {
      fecha: measurement.measured_on,
    };
    for (const key of MEASUREMENT_METRIC_KEYS) {
      const value = measurement[key];
      if (value !== null && Number.isFinite(value)) record[key] = value;
    }
    return record;
  });

  const evolucion = {} as Record<MeasurementMetricKey, MeasurementMetricChange>;
  for (const key of MEASUREMENT_METRIC_KEYS) {
    const points: MetricPoint[] = [];
    for (const record of registros) {
      const value = record[key];
      if (value !== undefined) points.push({ fecha: record.fecha, valor: value });
    }
    if (points.length === 0) {
      evolucion[key] = { sin_datos: true };
      continue;
    }
    const primero = points[0];
    const ultimo = points[points.length - 1];
    evolucion[key] = {
      sin_datos: false,
      primero,
      ultimo,
      diferencia: roundMetric(ultimo.valor - primero.valor),
      registros: points.length,
    };
  }

  return {
    from: period.from,
    to: period.to,
    dias_del_periodo: period.days,
    dias_con_registro: registros.length,
    registros,
    evolucion,
    fechas_ambiguas: ambiguous,
    ...(ambiguous.length > 0
      ? {
          nota:
            "Las fechas_ambiguas tienen varias mediciones y no se han usado en el cálculo. " +
            "El usuario puede revisarlas en el historial de medidas.",
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Dieta

export type NutritionTotals = {
  calorias_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  grasa_g: number;
};

type RawNutritionTotals = NutritionTotals;

export type DietPeriodFood = {
  /** Identificador de la entrada, para corregirla o quitarla sin confundirla con otra igual. */
  entrada_id: string;
  nombre: string;
  gramos: number;
  calorias_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  grasa_g: number;
};

export type DietPeriodDay =
  | { fecha: string; sin_registro: true }
  | ({
      fecha: string;
      sin_registro: false;
      comidas?: Array<{ comida: string; alimentos: DietPeriodFood[] }>;
    } & NutritionTotals);

export type DietPeriodResult = {
  from: string;
  to: string;
  dias: DietPeriodDay[];
  resumen: {
    dias_del_periodo: number;
    dias_con_registro: number;
    dias_sin_registro: number;
    total: NutritionTotals;
    media_por_dia_registrado: NutritionTotals | null;
  };
  nota: string;
};

/** Un día cuenta como registrado si tiene al menos un alimento apuntado. */
export function isDietDayRecorded(day: DietDay | null | undefined): day is DietDay {
  return Boolean(day?.meals.some((meal) => meal.items.length > 0));
}

/** Totales sin redondear de un día, con las funciones de la pantalla de Dieta. */
export function dietDayRawTotals(day: DietDay | null): RawNutritionTotals {
  return {
    calorias_kcal: sumDayCalories(day),
    proteina_g: sumDayMacroGrams(day, "protein_g"),
    carbohidratos_g: sumDayMacroGrams(day, "carbs_g"),
    grasa_g: sumDayMacroGrams(day, "fat_g"),
  };
}

function roundTotals(totals: RawNutritionTotals): NutritionTotals {
  return {
    calorias_kcal: roundNutritionValue(totals.calorias_kcal),
    proteina_g: roundNutritionValue(totals.proteina_g),
    carbohidratos_g: roundNutritionValue(totals.carbohidratos_g),
    grasa_g: roundNutritionValue(totals.grasa_g),
  };
}

export function buildDietPeriod(
  dietByDate: Readonly<Record<string, DietDay | undefined>>,
  period: ValidatedPeriod,
  options: { includeFoods?: boolean } = {},
): DietPeriodResult {
  const total: RawNutritionTotals = {
    calorias_kcal: 0,
    proteina_g: 0,
    carbohidratos_g: 0,
    grasa_g: 0,
  };
  let recordedDays = 0;
  const dias: DietPeriodDay[] = enumeratePeriodDates(period).map((date) => {
    const day = Object.hasOwn(dietByDate, date) ? dietByDate[date] : undefined;
    if (!isDietDayRecorded(day)) return { fecha: date, sin_registro: true };
    recordedDays += 1;
    const raw = dietDayRawTotals(day);
    total.calorias_kcal += raw.calorias_kcal;
    total.proteina_g += raw.proteina_g;
    total.carbohidratos_g += raw.carbohidratos_g;
    total.grasa_g += raw.grasa_g;
    return {
      fecha: date,
      sin_registro: false,
      ...roundTotals(raw),
      ...(options.includeFoods
        ? {
            comidas: day.meals
              .filter((meal) => meal.items.length > 0)
              .map((meal) => ({
                comida: meal.title,
                alimentos: meal.items.map((item) => ({
                  entrada_id: item.id,
                  nombre: item.title,
                  gramos: item.grams,
                  calorias_kcal: item.calories_kcal,
                  proteina_g: item.protein_g,
                  carbohidratos_g: item.carbs_g,
                  grasa_g: item.fat_g,
                })),
              })),
          }
        : {}),
    };
  });

  return {
    from: period.from,
    to: period.to,
    dias,
    resumen: {
      dias_del_periodo: period.days,
      dias_con_registro: recordedDays,
      dias_sin_registro: period.days - recordedDays,
      total: roundTotals(total),
      media_por_dia_registrado: recordedDays === 0
        ? null
        : roundTotals({
            calorias_kcal: total.calorias_kcal / recordedDays,
            proteina_g: total.proteina_g / recordedDays,
            carbohidratos_g: total.carbohidratos_g / recordedDays,
            grasa_g: total.grasa_g / recordedDays,
          }),
    },
    nota:
      "Los días con sin_registro: true no tienen nada apuntado: no significa que el usuario no comiera. " +
      "No los cuentes como 0 kcal. La media solo usa los días con registro.",
  };
}

// ---------------------------------------------------------------------------
// Entrenamientos realizados

export type WorkoutPeriodSession = {
  fecha: string;
  terminado_en: string;
  rutina: string;
  duracion_minutos: number;
  estado: "completado" | "parcial";
  series_completadas: number;
  series_totales: number;
  volumen_kg: number;
  repeticiones: number;
};

export type WorkoutPeriodResult = {
  from: string;
  to: string;
  sesiones: WorkoutPeriodSession[];
  resumen: {
    dias_del_periodo: number;
    sesiones: number;
    sesiones_completadas: number;
    sesiones_parciales: number;
    dias_con_entrenamiento: number;
    volumen_total_kg: number;
    repeticiones_totales: number;
  };
};

/** Fecha civil local en que terminó la sesión: un entreno a las 23:30 cuenta ese día. */
export function workoutSessionLocalDate(session: Pick<WorkoutSessionSummary, "finished_at">): string | null {
  const finished = new Date(session.finished_at);
  if (!Number.isFinite(finished.getTime())) return null;
  return localDateKey(finished);
}

export function buildWorkoutPeriod(
  history: readonly WorkoutSessionSummary[],
  period: ValidatedPeriod,
): WorkoutPeriodResult {
  const inPeriod = history
    .map((session) => ({ session, date: workoutSessionLocalDate(session) }))
    .filter((entry): entry is { session: WorkoutSessionSummary; date: string } => (
      entry.date !== null && entry.date >= period.from && entry.date <= period.to
    ))
    .sort((a, b) => (
      new Date(a.session.finished_at).getTime() - new Date(b.session.finished_at).getTime()
    ));
  const sesiones = inPeriod
    .map(({ session, date }): WorkoutPeriodSession => ({
      fecha: date,
      terminado_en: session.finished_at,
      rutina: session.template_name,
      duracion_minutos: Math.round(Math.max(0, session.elapsed_seconds) / 60),
      estado: session.completion_status === "completed" ? "completado" : "parcial",
      series_completadas: session.completed_effort_count,
      series_totales: session.total_effort_count,
      volumen_kg: roundMetric(session.total_volume_kg),
      repeticiones: session.total_reps,
    }));

  const completed = sesiones.filter((session) => session.estado === "completado").length;
  return {
    from: period.from,
    to: period.to,
    sesiones,
    resumen: {
      dias_del_periodo: period.days,
      sesiones: sesiones.length,
      sesiones_completadas: completed,
      sesiones_parciales: sesiones.length - completed,
      dias_con_entrenamiento: new Set(sesiones.map((session) => session.fecha)).size,
      volumen_total_kg: roundMetric(inPeriod.reduce((sum, { session }) => sum + session.total_volume_kg, 0)),
      repeticiones_totales: sesiones.reduce((sum, session) => sum + session.repeticiones, 0),
    },
  };
}
