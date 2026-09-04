export const MAX_MEASUREMENTS = 1826;

export const MEASUREMENT_METRIC_KEYS = [
  "weight_kg",
  "body_fat_pct",
  "neck_cm",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "biceps_cm",
  "quadriceps_cm",
  "calf_cm",
  "height_cm",
] as const;

export type MeasurementMetricKey = (typeof MEASUREMENT_METRIC_KEYS)[number];
export type MeasurementSex = "male" | "female";

export type Measurement = {
  id: string;
  measured_on: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_uri: string | null;
  neck_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  biceps_cm: number | null;
  quadriceps_cm: number | null;
  calf_cm: number | null;
  height_cm: number | null;
};

export type MeasurementValues = Pick<Measurement, MeasurementMetricKey>;
export type MeasurementPatch = Partial<MeasurementValues>;

export type MeasurementIssueCode =
  | "required"
  | "invalid_type"
  | "invalid_date"
  | "future_date"
  | "not_finite"
  | "not_positive"
  | "above_maximum"
  | "unknown_field"
  | "empty_patch"
  | "empty_measurement"
  | "not_found"
  | "duplicate_date_conflict";

export type MeasurementValidationIssue = {
  field: string;
  code: MeasurementIssueCode;
  message: string;
};

export type MeasurementValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; value: null; issues: MeasurementValidationIssue[] };

export type MeasurementMutationResult =
  | {
      ok: true;
      action: "created" | "updated" | "deleted";
      measurement: Measurement | null;
      measurements: Measurement[];
      removed: Measurement[];
      issues: [];
    }
  | {
      ok: false;
      value: null;
      issues: MeasurementValidationIssue[];
    };

export type MeasurementMetricPair = {
  latest: number | null;
  previous: number | null;
};

export type MeasurementChartPoint = {
  key: string;
  measuredOn: string;
  timestamp: number;
  value: number;
};

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const METRIC_KEY_SET = new Set<string>(MEASUREMENT_METRIC_KEYS);

function failed<T>(issues: MeasurementValidationIssue[]): MeasurementValidationResult<T> {
  return { ok: false, value: null, issues };
}

function succeeded<T>(value: T): MeasurementValidationResult<T> {
  return { ok: true, value, issues: [] };
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function localDateKey(date: Date): string {
  const year = `${date.getFullYear()}`.padStart(4, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarParts(dateKey: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function validateMeasurementDate(
  rawValue: unknown,
  today: Date = new Date(),
): MeasurementValidationResult<string> {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return failed([{
      field: "date",
      code: "required",
      message: "Indica una fecha para la medición.",
    }]);
  }
  const dateKey = rawValue.trim();
  if (!calendarParts(dateKey)) {
    return failed([{
      field: "date",
      code: "invalid_date",
      message: "La fecha debe existir y usar el formato AAAA-MM-DD.",
    }]);
  }
  if (dateKey > localDateKey(today)) {
    return failed([{
      field: "date",
      code: "future_date",
      message: "La fecha de una medición no puede estar en el futuro.",
    }]);
  }
  return succeeded(dateKey);
}

export function measurementDateAtLocalNoon(dateKey: string): Date | null {
  const parts = calendarParts(dateKey);
  if (!parts) return null;
  const date = new Date(0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function dateKeyFromMeasuredAt(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") return null;
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : localDateKey(date);
}

export function validateMeasurementMetric(
  field: MeasurementMetricKey,
  rawValue: unknown,
  options: { allowNumericString?: boolean } = {},
): MeasurementValidationResult<number | null> {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return succeeded(null);
  }
  let value = rawValue;
  if (options.allowNumericString && typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return succeeded(null);
    value = Number(normalized);
  }
  if (typeof value !== "number") {
    return failed([{
      field,
      code: "invalid_type",
      message: `El campo ${field} debe ser un número.`,
    }]);
  }
  if (!Number.isFinite(value)) {
    return failed([{
      field,
      code: "not_finite",
      message: `El campo ${field} debe ser un número finito.`,
    }]);
  }
  if (value <= 0) {
    return failed([{
      field,
      code: "not_positive",
      message: `El campo ${field} debe ser mayor que cero.`,
    }]);
  }
  if (field === "body_fat_pct" && value > 100) {
    return failed([{
      field,
      code: "above_maximum",
      message: "El porcentaje de grasa corporal no puede superar el 100 %.",
    }]);
  }
  const rounded = roundMetric(value);
  if (rounded <= 0) {
    return failed([{
      field,
      code: "not_positive",
      message: `El campo ${field} debe ser al menos 0,01.`,
    }]);
  }
  return succeeded(rounded);
}

function normalizePhotoUri(rawValue: unknown): string | null {
  return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
}

function hasMeasurementContent(measurement: Pick<Measurement, MeasurementMetricKey | "photo_uri">): boolean {
  return Boolean(measurement.photo_uri)
    || MEASUREMENT_METRIC_KEYS.some((field) => measurement[field] !== null);
}

export function normalizeMeasurement(
  rawValue: unknown,
  index: number,
  createId: (prefix: string) => string,
  today: Date = new Date(),
): MeasurementValidationResult<Measurement> {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return failed([{
      field: `measurements[${index}]`,
      code: "invalid_type",
      message: "La medición guardada debe ser un objeto.",
    }]);
  }
  const raw = rawValue as Record<string, unknown>;
  const measuredOnCandidate = typeof raw.measured_on === "string"
    ? raw.measured_on
    : dateKeyFromMeasuredAt(raw.measured_at);
  const dateResult = validateMeasurementDate(measuredOnCandidate, today);
  if (!dateResult.ok) {
    return failed(dateResult.issues.map((issue) => ({
      ...issue,
      field: `measurements[${index}].measured_on`,
    })));
  }

  let measuredAt: string;
  if (typeof raw.measured_at === "string" && !Number.isNaN(new Date(raw.measured_at).getTime())) {
    measuredAt = new Date(raw.measured_at).toISOString();
  } else {
    measuredAt = measurementDateAtLocalNoon(dateResult.value)!.toISOString();
  }

  const issues: MeasurementValidationIssue[] = [];
  const values = {} as MeasurementValues;
  for (const field of MEASUREMENT_METRIC_KEYS) {
    const result = validateMeasurementMetric(field, raw[field], { allowNumericString: true });
    if (!result.ok) issues.push(...result.issues.map((issue) => ({
      ...issue,
      field: `measurements[${index}].${field}`,
    })));
    else values[field] = result.value;
  }
  if (issues.length > 0) return failed(issues);

  return succeeded({
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createId(`measurement_${index}`),
    measured_on: dateResult.value,
    measured_at: measuredAt,
    photo_uri: normalizePhotoUri(raw.photo_uri),
    ...values,
  });
}

export function compareMeasurementsDesc(a: Measurement, b: Measurement): number {
  const dateOrder = b.measured_on.localeCompare(a.measured_on);
  if (dateOrder !== 0) return dateOrder;
  const timestampOrder = new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime();
  if (timestampOrder !== 0) return timestampOrder;
  return a.id.localeCompare(b.id);
}

export function sortMeasurementsDesc(measurements: readonly Measurement[]): Measurement[] {
  return [...measurements].sort(compareMeasurementsDesc);
}

export function normalizeMeasurements(
  rawValue: unknown,
  createId: (prefix: string) => string,
  today: Date = new Date(),
): MeasurementValidationResult<Measurement[]> {
  if (!Array.isArray(rawValue)) {
    return failed([{
      field: "measurements",
      code: "invalid_type",
      message: "Las mediciones guardadas deben formar una lista.",
    }]);
  }
  const normalized: Measurement[] = [];
  const issues: MeasurementValidationIssue[] = [];
  rawValue.forEach((measurement, index) => {
    const result = normalizeMeasurement(measurement, index, createId, today);
    if (result.ok) normalized.push(result.value);
    else issues.push(...result.issues);
  });
  if (issues.length > 0) return failed(issues);
  return succeeded(sortMeasurementsDesc(normalized).slice(0, MAX_MEASUREMENTS));
}

export function measurementDuplicateDates(measurements: readonly Measurement[]): string[] {
  const counts = new Map<string, number>();
  for (const measurement of measurements) {
    counts.set(measurement.measured_on, (counts.get(measurement.measured_on) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([date]) => date)
    .sort((a, b) => b.localeCompare(a));
}

function normalizePatch(
  rawPatch: unknown,
  options: { allowNumericString?: boolean } = {},
): MeasurementValidationResult<MeasurementPatch> {
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
    return failed([{
      field: "data",
      code: "invalid_type",
      message: "Las medidas deben formar un objeto.",
    }]);
  }
  const raw = rawPatch as Record<string, unknown>;
  const issues: MeasurementValidationIssue[] = [];
  const patch: MeasurementPatch = {};
  for (const field of Object.keys(raw)) {
    if (!METRIC_KEY_SET.has(field)) {
      issues.push({
        field,
        code: "unknown_field",
        message: `El campo ${field} no es una medida reconocida.`,
      });
      continue;
    }
    const metric = field as MeasurementMetricKey;
    const result = validateMeasurementMetric(metric, raw[field], options);
    if (result.ok) patch[metric] = result.value;
    else issues.push(...result.issues);
  }
  if (issues.length > 0) return failed(issues);
  return succeeded(patch);
}

export function parseMeasurementToolPatch(
  rawData: unknown,
  rawClearFields: unknown,
): MeasurementValidationResult<MeasurementPatch> {
  let parsedData = rawData;
  let legacy = false;
  if (typeof rawData === "string") {
    legacy = true;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      return failed([{
        field: "data",
        code: "invalid_type",
        message: "El JSON de medidas no es válido.",
      }]);
    }
  }
  const patchResult = normalizePatch(parsedData, { allowNumericString: legacy });
  if (!patchResult.ok) return patchResult;

  const patch = { ...patchResult.value };
  if (rawClearFields !== undefined && !Array.isArray(rawClearFields)) {
    return failed([{
      field: "clear_fields",
      code: "invalid_type",
      message: "clear_fields debe ser una lista de campos de medición.",
    }]);
  }
  const issues: MeasurementValidationIssue[] = [];
  for (const rawField of (rawClearFields ?? []) as unknown[]) {
    if (typeof rawField !== "string" || !METRIC_KEY_SET.has(rawField)) {
      issues.push({
        field: "clear_fields",
        code: "unknown_field",
        message: `El campo ${String(rawField)} no se puede borrar porque no es una medida reconocida.`,
      });
      continue;
    }
    const field = rawField as MeasurementMetricKey;
    if (Object.prototype.hasOwnProperty.call(patch, field) && patch[field] !== null) {
      issues.push({
        field,
        code: "invalid_type",
        message: `El campo ${field} no puede actualizarse y borrarse a la vez.`,
      });
      continue;
    }
    patch[field] = null;
  }
  if (issues.length > 0) return failed(issues);
  if (Object.keys(patch).length === 0) {
    return failed([{
      field: "data",
      code: "empty_patch",
      message: "Indica al menos una medida para guardar o borrar.",
    }]);
  }
  return succeeded(patch);
}

function mutationFailed(issues: MeasurementValidationIssue[]): MeasurementMutationResult {
  return { ok: false, value: null, issues };
}

function mutationSucceeded(
  action: "created" | "updated" | "deleted",
  measurement: Measurement | null,
  measurements: Measurement[],
  removed: Measurement[],
): MeasurementMutationResult {
  return { ok: true, action, measurement, measurements, removed, issues: [] };
}

function applyCollectionLimit(measurements: Measurement[]): { kept: Measurement[]; removed: Measurement[] } {
  const sorted = sortMeasurementsDesc(measurements);
  return {
    kept: sorted.slice(0, MAX_MEASUREMENTS),
    removed: sorted.slice(MAX_MEASUREMENTS),
  };
}

export function upsertMeasurementByDate(
  measurements: readonly Measurement[],
  input: {
    date: unknown;
    patch: MeasurementPatch;
    photoUri?: string | null;
    createId: (prefix: string) => string;
    today?: Date;
  },
): MeasurementMutationResult {
  const dateResult = validateMeasurementDate(input.date, input.today);
  if (!dateResult.ok) return mutationFailed(dateResult.issues);
  if (Object.keys(input.patch).length === 0 && input.photoUri === undefined) {
    return mutationFailed([{
      field: "data",
      code: "empty_patch",
      message: "Indica al menos una medida o una foto.",
    }]);
  }
  const patchResult = normalizePatch(input.patch);
  if (!patchResult.ok) return mutationFailed(patchResult.issues);

  const matches = measurements.filter((measurement) => measurement.measured_on === dateResult.value);
  if (matches.length > 1) {
    return mutationFailed([{
      field: "date",
      code: "duplicate_date_conflict",
      message: `Hay varias mediciones para ${dateResult.value}. Edítalas desde el historial antes de añadir más datos.`,
    }]);
  }
  const existing = matches[0] ?? null;
  const baseValues = Object.fromEntries(
    MEASUREMENT_METRIC_KEYS.map((field) => [field, existing?.[field] ?? null]),
  ) as MeasurementValues;
  const nextValues = { ...baseValues, ...patchResult.value };
  const measurement: Measurement = {
    id: existing?.id ?? input.createId("measurement"),
    measured_on: dateResult.value,
    measured_at: existing?.measured_at ?? measurementDateAtLocalNoon(dateResult.value)!.toISOString(),
    photo_uri: input.photoUri === undefined ? (existing?.photo_uri ?? null) : normalizePhotoUri(input.photoUri),
    ...nextValues,
  };
  if (!hasMeasurementContent(measurement)) {
    return mutationFailed([{
      field: "measurement",
      code: "empty_measurement",
      message: "La medición no puede quedar vacía; elimínala desde el historial.",
    }]);
  }
  const base = existing
    ? measurements.filter((candidate) => candidate.id !== existing.id)
    : [...measurements];
  const limited = applyCollectionLimit([measurement, ...base]);
  return mutationSucceeded(existing ? "updated" : "created", measurement, limited.kept, limited.removed);
}

export function replaceMeasurementById(
  measurements: readonly Measurement[],
  input: {
    id: string;
    date: unknown;
    values: MeasurementValues;
    photoUri: string | null;
    today?: Date;
  },
): MeasurementMutationResult {
  const existing = measurements.find((measurement) => measurement.id === input.id);
  if (!existing) {
    return mutationFailed([{
      field: "id",
      code: "not_found",
      message: "La medición que intentas editar ya no existe.",
    }]);
  }
  const dateResult = validateMeasurementDate(input.date, input.today);
  if (!dateResult.ok) return mutationFailed(dateResult.issues);
  if (
    dateResult.value !== existing.measured_on
    && measurements.some((measurement) => (
      measurement.id !== existing.id && measurement.measured_on === dateResult.value
    ))
  ) {
    return mutationFailed([{
      field: "date",
      code: "duplicate_date_conflict",
      message: `Ya existe una medición para ${dateResult.value}.`,
    }]);
  }
  const valuesResult = normalizePatch(input.values);
  if (!valuesResult.ok) return mutationFailed(valuesResult.issues);
  const measurement: Measurement = {
    id: existing.id,
    measured_on: dateResult.value,
    measured_at: dateResult.value === existing.measured_on
      ? existing.measured_at
      : measurementDateAtLocalNoon(dateResult.value)!.toISOString(),
    photo_uri: normalizePhotoUri(input.photoUri),
    ...(valuesResult.value as MeasurementValues),
  };
  if (!hasMeasurementContent(measurement)) {
    return mutationFailed([{
      field: "measurement",
      code: "empty_measurement",
      message: "Añade al menos un dato de medida o una foto.",
    }]);
  }
  const limited = applyCollectionLimit([
    measurement,
    ...measurements.filter((candidate) => candidate.id !== existing.id),
  ]);
  return mutationSucceeded("updated", measurement, limited.kept, limited.removed);
}

export function deleteMeasurementById(
  measurements: readonly Measurement[],
  id: string,
): MeasurementMutationResult {
  const existing = measurements.find((measurement) => measurement.id === id);
  if (!existing) {
    return mutationFailed([{
      field: "id",
      code: "not_found",
      message: "La medición ya no existe.",
    }]);
  }
  return mutationSucceeded(
    "deleted",
    null,
    measurements.filter((measurement) => measurement.id !== id),
    [existing],
  );
}

function uniqueMetricValuesByDate(
  measurements: readonly Measurement[],
  selector: (measurement: Measurement) => number | null,
): Array<{ measurement: Measurement; value: number }> {
  const results: Array<{ measurement: Measurement; value: number }> = [];
  let currentDate: string | null = null;
  for (const measurement of sortMeasurementsDesc(measurements)) {
    if (measurement.measured_on !== currentDate) {
      currentDate = measurement.measured_on;
      const sameDay = sortMeasurementsDesc(
        measurements.filter((candidate) => candidate.measured_on === currentDate),
      );
      const candidate = sameDay
        .map((item) => ({ measurement: item, value: selector(item) }))
        .find((item): item is { measurement: Measurement; value: number } => (
          item.value !== null && Number.isFinite(item.value)
        ));
      if (candidate) results.push(candidate);
    }
  }
  return results;
}

export function resolveMeasurementMetricPair(
  measurements: readonly Measurement[],
  selector: (measurement: Measurement) => number | null,
): MeasurementMetricPair {
  const values = uniqueMetricValuesByDate(measurements, selector);
  return {
    latest: values[0]?.value ?? null,
    previous: values[1]?.value ?? null,
  };
}

export function selectLatestMeasurementWithMetric(
  measurements: readonly Measurement[],
  field: MeasurementMetricKey,
): Measurement | null {
  return uniqueMetricValuesByDate(measurements, (measurement) => measurement[field])[0]?.measurement ?? null;
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = measurementDateAtLocalNoon(dateKey)!;
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function buildMeasurementChartPoints(
  measurements: readonly Measurement[],
  selector: (measurement: Measurement) => number | null,
  options: { days: number | null; today?: Date },
): MeasurementChartPoint[] {
  const todayKey = localDateKey(options.today ?? new Date());
  const cutoff = options.days === null ? null : shiftDateKey(todayKey, -(options.days - 1));
  return uniqueMetricValuesByDate(measurements, selector)
    .filter(({ measurement }) => cutoff === null || measurement.measured_on >= cutoff)
    .map(({ measurement, value }) => ({
      key: measurement.id,
      measuredOn: measurement.measured_on,
      timestamp: measurementDateAtLocalNoon(measurement.measured_on)!.getTime(),
      value,
    }))
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn) || a.key.localeCompare(b.key));
}

export function estimateMeasurementBodyFatPercentage(
  measurement: Measurement,
  fallbackHeightCm: number | null,
  sex: MeasurementSex = "male",
): number | null {
  if (measurement.body_fat_pct !== null) return measurement.body_fat_pct;
  const heightCm = measurement.height_cm ?? fallbackHeightCm;
  if (heightCm === null || measurement.waist_cm === null || measurement.neck_cm === null) {
    return null;
  }

  const heightIn = heightCm / 2.54;
  let estimate: number;
  if (sex === "female") {
    if (measurement.hips_cm === null) return null;
    const circumferenceCm = measurement.waist_cm + measurement.hips_cm - measurement.neck_cm;
    if (!(circumferenceCm > 0)) return null;
    estimate = 163.205 * Math.log10(circumferenceCm / 2.54)
      - 97.684 * Math.log10(heightIn)
      - 78.387;
  } else {
    const waistMinusNeckCm = measurement.waist_cm - measurement.neck_cm;
    if (!(waistMinusNeckCm > 0)) return null;
    estimate = 86.01 * Math.log10(waistMinusNeckCm / 2.54)
      - 70.041 * Math.log10(heightIn)
      + 36.76;
  }
  if (!Number.isFinite(estimate)) return null;
  return Math.max(3, Math.min(60, Math.round(estimate * 10) / 10));
}

export function formatMeasurementIssues(issues: readonly MeasurementValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}
