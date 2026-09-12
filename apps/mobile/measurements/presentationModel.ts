import {
  estimateMeasurementBodyFatPercentage,
  measurementDateAtLocalNoon,
  validateMeasurementMetric,
  type Measurement,
  type MeasurementMetricKey,
  type MeasurementSex,
} from "./measurementContract";

const MONTH_LABELS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export const BODY_FAT_ZONES_MALE = [
  { min: 0, max: 8, color: "rgba(255,75,75,0.12)" },
  { min: 8, max: 12, color: "rgba(203,255,26,0.10)" },
  { min: 12, max: 17, color: "rgba(0,198,107,0.10)" },
  { min: 17, max: 22, color: "rgba(203,255,26,0.10)" },
  { min: 22, max: 27, color: "rgba(255,140,0,0.12)" },
  { min: 27, max: 60, color: "rgba(255,75,75,0.12)" },
] as const;

export const BODY_FAT_ZONES_FEMALE = [
  { min: 0, max: 15, color: "rgba(255,75,75,0.12)" },
  { min: 15, max: 18, color: "rgba(203,255,26,0.10)" },
  { min: 18, max: 23, color: "rgba(0,198,107,0.10)" },
  { min: 23, max: 28, color: "rgba(203,255,26,0.10)" },
  { min: 28, max: 33, color: "rgba(255,140,0,0.12)" },
  { min: 33, max: 60, color: "rgba(255,75,75,0.12)" },
] as const;

export type MeasurementStatCard = {
  label: string;
  valueText: string;
  changeText: string;
  changeColor: string;
  changeIcon: "minus" | "arrow-right" | "trending-down" | "trending-up";
};

export function parsePositiveNumberInput(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function parseOptionalPositiveMetricInput(
  field: MeasurementMetricKey,
  rawValue: string,
): { value: number | null; invalid: boolean } {
  const trimmed = rawValue.trim();
  if (!trimmed) return { value: null, invalid: false };
  const parsed = validateMeasurementMetric(field, trimmed, { allowNumericString: true });
  return {
    value: parsed.ok ? parsed.value : null,
    invalid: !parsed.ok,
  };
}

export function measurementDateFromSelection(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

export function formatMeasurementDate(rawValue: string): string {
  const parsed = measurementDateAtLocalNoon(rawValue) ?? new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "Fecha inválida";
  return parsed.toLocaleDateString();
}

export function formatMeasurementHistoryDate(rawValue: string): string {
  const parsed = measurementDateAtLocalNoon(rawValue) ?? new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "Fecha inválida";
  return `${parsed.getDate()} ${MONTH_LABELS_SHORT[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

export function formatMeasurementNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function buildMeasurementHistorySummary(
  measurement: Measurement,
  fallbackHeightCm: number | null,
  sex: MeasurementSex = "male",
): string {
  const summaryParts: string[] = [];
  if (measurement.weight_kg !== null) {
    summaryParts.push(`${formatMeasurementNumber(measurement.weight_kg)} kg`);
  }
  const bodyFatPercentage = estimateMeasurementBodyFatPercentage(
    measurement,
    fallbackHeightCm,
    sex,
  );
  if (bodyFatPercentage !== null) {
    summaryParts.push(`${formatMeasurementNumber(bodyFatPercentage)}% grasa`);
  }
  if (measurement.waist_cm !== null) {
    summaryParts.push(`Cintura ${formatMeasurementNumber(measurement.waist_cm)} cm`);
  } else if (measurement.chest_cm !== null) {
    summaryParts.push(`Pecho ${formatMeasurementNumber(measurement.chest_cm)} cm`);
  } else if (measurement.biceps_cm !== null) {
    summaryParts.push(`Brazo ${formatMeasurementNumber(measurement.biceps_cm)} cm`);
  } else if (measurement.photo_uri) {
    summaryParts.push("Foto de progreso");
  }
  return summaryParts.join(" · ") || "Sin medidas numéricas";
}

export function buildMeasurementStatCard(
  label: string,
  latest: number | null,
  previous: number | null,
  formatValue: (value: number) => string,
  unitLabel: string,
  prefersDecrease: boolean,
): MeasurementStatCard {
  if (latest === null) {
    return {
      label,
      valueText: "Sin datos",
      changeText: "Registra tu primera medición",
      changeColor: "#6F7785",
      changeIcon: "minus",
    };
  }
  if (previous === null) {
    return {
      label,
      valueText: formatValue(latest),
      changeText: "Primer registro",
      changeColor: "#19C37D",
      changeIcon: "arrow-right",
    };
  }
  const delta = Math.round((latest - previous) * 10) / 10;
  if (Math.abs(delta) < 0.05) {
    return {
      label,
      valueText: formatValue(latest),
      changeText: "=",
      changeColor: "#6F7785",
      changeIcon: "minus",
    };
  }
  const improved = prefersDecrease ? delta < 0 : delta > 0;
  const signedValue = `${delta > 0 ? "+" : ""}${formatMeasurementNumber(delta)}`;
  return {
    label,
    valueText: formatValue(latest),
    changeText: `${signedValue} ${unitLabel}`,
    changeColor: improved ? "#19C37D" : "#CBFF1A",
    changeIcon: delta < 0 ? "trending-down" : "trending-up",
  };
}
