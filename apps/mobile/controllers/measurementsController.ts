import { useCallback, useMemo, useRef } from "react";

import { DIET_MONTH_LABELS_SHORT } from "../diet/model";
import {
  buildPreparedMeasurementChartPoints,
  estimateMeasurementBodyFatPercentage,
  measurementDateAtLocalNoon,
  measurementDuplicateDates,
  type Measurement,
  type MeasurementChartPoint,
  type MeasurementSex,
  type MeasurementSummary,
  type MeasurementWorkCounters,
  type PreparedMeasurementHistory,
} from "../measurements/measurementContract";
import {
  buildMeasurementHistorySummary,
  buildMeasurementStatCard,
  formatMeasurementHistoryDate,
  formatMeasurementNumber,
  type MeasurementStatCard,
} from "../measurements/presentationModel";
import type {
  MeasuresChartMetricKey,
  MeasuresDashboardPeriodKey,
} from "../storage/userPreferences";
import type { ScreenController } from "./types";

export type MeasurementsPeriodOption = {
  key: MeasuresDashboardPeriodKey;
  label: string;
  days: number | null;
};

export type MeasurementsMetricOption = {
  key: MeasuresChartMetricKey;
  label: string;
  unit: string;
  field: keyof Measurement | null;
};

export const MEASUREMENTS_PERIOD_OPTIONS: readonly MeasurementsPeriodOption[] = [
  { key: "1m", label: "1 mes", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "all", label: "Todo", days: null },
];

export const MEASUREMENTS_METRIC_OPTIONS: readonly MeasurementsMetricOption[] = [
  { key: "weight", label: "Peso", unit: "kg", field: "weight_kg" },
  { key: "bodyFat", label: "% Grasa", unit: "%", field: "body_fat_pct" },
  { key: "chest", label: "Pecho", unit: "cm", field: "chest_cm" },
  { key: "waist", label: "Cintura", unit: "cm", field: "waist_cm" },
  { key: "hips", label: "Cadera", unit: "cm", field: "hips_cm" },
  { key: "biceps", label: "Brazo", unit: "cm", field: "biceps_cm" },
  { key: "neck", label: "Cuello", unit: "cm", field: "neck_cm" },
  { key: "quadriceps", label: "Cuádriceps", unit: "cm", field: "quadriceps_cm" },
  { key: "calf", label: "Gemelo", unit: "cm", field: "calf_cm" },
];

type MeasurementsChartPoint = MeasurementChartPoint & {
  label: string;
  heightPercent: number;
  isLatest: boolean;
};

export type MeasurementHistoryRow = {
  measurement: Measurement;
  dateLabel: string;
  summary: string;
  delta: number | null;
  deltaDecreased: boolean;
  deltaColor: string;
  deltaBackground: string;
};

export type MeasurementsScreenModel = {
  duplicateDateCount: number;
  mediaNotice: string | null;
  statCardRows: readonly (readonly MeasurementStatCard[])[];
  periodOptions: readonly MeasurementsPeriodOption[];
  metricOptions: readonly MeasurementsMetricOption[];
  period: MeasuresDashboardPeriodKey;
  periodMeta: MeasurementsPeriodOption;
  metric: MeasuresChartMetricKey;
  metricMeta: MeasurementsMetricOption;
  periodDropdownOpen: boolean;
  metricDropdownOpen: boolean;
  chartPoints: readonly MeasurementsChartPoint[];
  allMetricValues: readonly Pick<MeasurementChartPoint, "timestamp" | "value">[];
  hasMetricMeasurements: boolean;
  sex: MeasurementSex;
  canExpandHistory: boolean;
  showAllHistory: boolean;
  historyRows: readonly MeasurementHistoryRow[];
  photos: readonly Measurement[];
};

export type MeasurementsScreenActions = {
  openEntry(): void;
  togglePeriodDropdown(): void;
  selectPeriod(period: MeasuresDashboardPeriodKey): void;
  toggleMetricDropdown(): void;
  selectMetric(metric: MeasuresChartMetricKey): void;
  openBodyFatInfo(): void;
  toggleHistory(): void;
  editMeasurement(measurement: Measurement): void;
  expandPhoto(uri: string | null): void;
};

type MeasurementsBackLayer =
  | "body-fat-info"
  | "measurement-photo"
  | "measurement-entry"
  | "measurement-date-picker"
  | "measurements-history-expanded"
  | "measures-period-dropdown"
  | "measures-metric-dropdown";

type MeasurementsControllerInput = {
  measurements: Measurement[];
  preparedMeasurements: PreparedMeasurementHistory;
  summary: MeasurementSummary;
  effectiveHeightCm: number | null;
  sex: MeasurementSex;
  measurementWork?: MeasurementWorkCounters;
  mediaNotice: string | null;
  period: MeasuresDashboardPeriodKey;
  metric: MeasuresChartMetricKey;
  periodDropdownOpen: boolean;
  metricDropdownOpen: boolean;
  showAllHistory: boolean;
  bodyFatInfoOpen: boolean;
  expandedPhotoUri: string | null;
  entryOpen: boolean;
  datePickerOpen: boolean;
  openEntry(): void;
  setPeriodDropdownOpen(open: boolean): void;
  selectPeriod(period: MeasuresDashboardPeriodKey): void;
  setMetricDropdownOpen(open: boolean): void;
  selectMetric(metric: MeasuresChartMetricKey): void;
  setBodyFatInfoOpen(open: boolean): void;
  setShowAllHistory(open: boolean): void;
  editMeasurement(measurement: Measurement): void;
  setExpandedPhotoUri(uri: string | null): void;
  closeEntry(): void;
  setDatePickerOpen(open: boolean): void;
};

export function useMeasurementsController(
  input: MeasurementsControllerInput,
): ScreenController<MeasurementsScreenModel, MeasurementsScreenActions, MeasurementsBackLayer> {
  const targetsRef = useRef(input);
  targetsRef.current = input;
  const periodMeta = MEASUREMENTS_PERIOD_OPTIONS.find((option) => option.key === input.period)
    ?? MEASUREMENTS_PERIOD_OPTIONS[1];
  const metricMeta = MEASUREMENTS_METRIC_OPTIONS.find((option) => option.key === input.metric)
    ?? MEASUREMENTS_METRIC_OPTIONS[0];
  const metricValue = useCallback((measurement: Measurement): number | null => {
    if (metricMeta.key === "bodyFat") {
      return estimateMeasurementBodyFatPercentage(
        measurement,
        input.effectiveHeightCm,
        input.sex,
      );
    }
    const field = metricMeta.field;
    if (!field) return null;
    const value = measurement[field];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }, [input.effectiveHeightCm, input.sex, metricMeta]);
  const chartPoints = useMemo<MeasurementsChartPoint[]>(() => {
    const points = buildPreparedMeasurementChartPoints(
      input.preparedMeasurements,
      metricValue,
      { days: periodMeta.days },
      input.measurementWork,
    ).map((point) => {
      const date = measurementDateAtLocalNoon(point.measuredOn)!;
      return {
        ...point,
        label: `${date.getDate()} ${DIET_MONTH_LABELS_SHORT[date.getMonth()]}`,
      };
    });
    if (points.length === 0) return [];
    const values = points.map((point) => point.value);
    const minimum = Math.min(...values);
    const range = Math.max(0.4, Math.max(...values) - minimum);
    return points.map((point, index) => ({
      ...point,
      heightPercent: 24 + ((point.value - minimum) / range) * 64,
      isLatest: index === points.length - 1,
    }));
  }, [input.measurementWork, input.preparedMeasurements, metricValue, periodMeta.days]);
  const allMetricValues = useMemo(
    () => buildPreparedMeasurementChartPoints(
      input.preparedMeasurements,
      metricValue,
      { days: null },
      input.measurementWork,
    ).map(({ timestamp, value }) => ({ timestamp, value })),
    [input.measurementWork, input.preparedMeasurements, metricValue],
  );
  const statCardRows = useMemo(() => {
    if (input.measurementWork) input.measurementWork.cards += 1;
    const summary = input.summary;
    const cards = [
      buildMeasurementStatCard("Peso", summary.weight_kg.latest, summary.weight_kg.previous, (value) => `${formatMeasurementNumber(value)} kg`, "kg", true),
      buildMeasurementStatCard("% Grasa", summary.body_fat_pct.latest, summary.body_fat_pct.previous, (value) => `${formatMeasurementNumber(value)}%`, "%", true),
      buildMeasurementStatCard("Pecho", summary.chest_cm.latest, summary.chest_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
      buildMeasurementStatCard("Cintura", summary.waist_cm.latest, summary.waist_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", true),
      buildMeasurementStatCard("Cadera", summary.hips_cm.latest, summary.hips_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
      buildMeasurementStatCard("Brazo", summary.biceps_cm.latest, summary.biceps_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
      buildMeasurementStatCard("Cuello", summary.neck_cm.latest, summary.neck_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
      buildMeasurementStatCard("Cuádriceps", summary.quadriceps_cm.latest, summary.quadriceps_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
      buildMeasurementStatCard("Gemelo", summary.calf_cm.latest, summary.calf_cm.previous, (value) => `${formatMeasurementNumber(value)} cm`, "cm", false),
    ];
    const rows: MeasurementStatCard[][] = [];
    for (let index = 0; index < cards.length; index += 3) rows.push(cards.slice(index, index + 3));
    return rows;
  }, [input.measurementWork, input.summary]);
  const historyRows = useMemo<MeasurementHistoryRow[]>(() => {
    const visible = input.showAllHistory ? input.measurements : input.measurements.slice(0, 4);
    return visible.map((measurement, sourceIndex) => {
      const current = metricValue(measurement);
      const previousMeasurement = current === null
        ? null
        : input.measurements.slice(sourceIndex + 1).find((entry) => metricValue(entry) !== null) ?? null;
      const previous = previousMeasurement ? metricValue(previousMeasurement) : null;
      const delta = current !== null && previous !== null
        ? Math.round((current - previous) * 10) / 10
        : null;
      const decreased = delta !== null && delta < 0;
      const prefersDecrease = metricMeta.key === "weight"
        || metricMeta.key === "bodyFat"
        || metricMeta.key === "waist";
      const improves = delta !== null && (prefersDecrease ? decreased : !decreased);
      return {
        measurement,
        dateLabel: formatMeasurementHistoryDate(measurement.measured_on),
        summary: buildMeasurementHistorySummary(measurement, input.effectiveHeightCm, input.sex),
        delta,
        deltaDecreased: decreased,
        deltaColor: delta === null ? "#6F7785" : improves ? "#19C37D" : "#CBFF1A",
        deltaBackground: delta === null
          ? "rgba(127,135,149,0.14)"
          : improves
            ? "rgba(25,195,125,0.14)"
            : "rgba(203,255,26,0.12)",
      };
    });
  }, [input.effectiveHeightCm, input.measurements, input.sex, input.showAllHistory, metricMeta.key, metricValue]);
  const model = useMemo<MeasurementsScreenModel>(() => ({
    duplicateDateCount: measurementDuplicateDates(input.measurements).length,
    mediaNotice: input.mediaNotice,
    statCardRows,
    periodOptions: MEASUREMENTS_PERIOD_OPTIONS,
    metricOptions: MEASUREMENTS_METRIC_OPTIONS,
    period: input.period,
    periodMeta,
    metric: input.metric,
    metricMeta,
    periodDropdownOpen: input.periodDropdownOpen,
    metricDropdownOpen: input.metricDropdownOpen,
    chartPoints,
    allMetricValues,
    hasMetricMeasurements: input.measurements.some((measurement) => metricValue(measurement) !== null),
    sex: input.sex,
    canExpandHistory: input.measurements.length > 4,
    showAllHistory: input.showAllHistory,
    historyRows,
    photos: input.measurements.filter((measurement) => measurement.photo_uri),
  }), [
    allMetricValues,
    chartPoints,
    historyRows,
    input.mediaNotice,
    input.measurements,
    input.metric,
    input.metricDropdownOpen,
    input.period,
    input.periodDropdownOpen,
    input.sex,
    input.showAllHistory,
    metricMeta,
    metricValue,
    periodMeta,
    statCardRows,
  ]);
  const openEntry = useCallback(() => targetsRef.current.openEntry(), []);
  const togglePeriodDropdown = useCallback(() => targetsRef.current.setPeriodDropdownOpen(!targetsRef.current.periodDropdownOpen), []);
  const selectPeriod = useCallback((period: MeasuresDashboardPeriodKey) => targetsRef.current.selectPeriod(period), []);
  const toggleMetricDropdown = useCallback(() => targetsRef.current.setMetricDropdownOpen(!targetsRef.current.metricDropdownOpen), []);
  const selectMetric = useCallback((metric: MeasuresChartMetricKey) => targetsRef.current.selectMetric(metric), []);
  const openBodyFatInfo = useCallback(() => targetsRef.current.setBodyFatInfoOpen(true), []);
  const toggleHistory = useCallback(() => targetsRef.current.setShowAllHistory(!targetsRef.current.showAllHistory), []);
  const editMeasurement = useCallback((measurement: Measurement) => targetsRef.current.editMeasurement(measurement), []);
  const expandPhoto = useCallback((uri: string | null) => targetsRef.current.setExpandedPhotoUri(uri), []);
  const actions = useMemo<MeasurementsScreenActions>(() => ({
    openEntry,
    togglePeriodDropdown,
    selectPeriod,
    toggleMetricDropdown,
    selectMetric,
    openBodyFatInfo,
    toggleHistory,
    editMeasurement,
    expandPhoto,
  }), [editMeasurement, expandPhoto, openBodyFatInfo, openEntry, selectMetric, selectPeriod, toggleHistory, toggleMetricDropdown, togglePeriodDropdown]);
  const closeBodyFatInfo = useCallback(() => { targetsRef.current.setBodyFatInfoOpen(false); return true; }, []);
  const closePhoto = useCallback(() => { targetsRef.current.setExpandedPhotoUri(null); return true; }, []);
  const closeEntry = useCallback(() => { targetsRef.current.closeEntry(); return true; }, []);
  const closeDatePicker = useCallback(() => { targetsRef.current.setDatePickerOpen(false); return true; }, []);
  const closeHistory = useCallback(() => { targetsRef.current.setShowAllHistory(false); return true; }, []);
  const closePeriod = useCallback(() => { targetsRef.current.setPeriodDropdownOpen(false); return true; }, []);
  const closeMetric = useCallback(() => { targetsRef.current.setMetricDropdownOpen(false); return true; }, []);
  const layers = useMemo(() => ({
    "body-fat-info": input.bodyFatInfoOpen,
    "measurement-photo": input.expandedPhotoUri !== null,
    "measurement-entry": input.entryOpen,
    "measurement-date-picker": input.datePickerOpen,
    "measurements-history-expanded": input.showAllHistory,
    "measures-period-dropdown": input.periodDropdownOpen,
    "measures-metric-dropdown": input.metricDropdownOpen,
  }), [input.bodyFatInfoOpen, input.datePickerOpen, input.entryOpen, input.expandedPhotoUri, input.metricDropdownOpen, input.periodDropdownOpen, input.showAllHistory]);
  const handlers = useMemo(() => ({
    "body-fat-info": closeBodyFatInfo,
    "measurement-photo": closePhoto,
    "measurement-entry": closeEntry,
    "measurement-date-picker": closeDatePicker,
    "measurements-history-expanded": closeHistory,
    "measures-period-dropdown": closePeriod,
    "measures-metric-dropdown": closeMetric,
  }), [closeBodyFatInfo, closeDatePicker, closeEntry, closeHistory, closeMetric, closePeriod, closePhoto]);
  const back = useMemo(() => ({ layers, handlers }), [handlers, layers]);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
