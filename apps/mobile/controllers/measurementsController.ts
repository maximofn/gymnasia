import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteOwnedMeasurementPhotoIfUnreferenced,
  isOwnedMeasurementPhotoUri,
  normalizeAndStoreMeasurementPhoto,
  sweepOrphanedMeasurementPhotos,
} from "../backup/measurementMedia";
import { DIET_MONTH_LABELS_SHORT } from "../diet/model";
import {
  MEASUREMENT_METRIC_KEYS,
  buildPreparedMeasurementChartPoints,
  deleteMeasurementById,
  estimateMeasurementBodyFatPercentage,
  formatMeasurementIssues,
  localDateKey,
  measurementDateAtLocalNoon,
  measurementDuplicateDates,
  prepareMeasurementHistory,
  replaceMeasurementById,
  resolveMeasurementSummary,
  upsertMeasurementByDate,
  validateMeasurementDate,
  type Measurement,
  type MeasurementChartPoint,
  type MeasurementMetricKey,
  type MeasurementPatch,
  type MeasurementSex,
  type MeasurementSummary,
  type MeasurementValues,
  type MeasurementWorkCounters,
  type PreparedMeasurementHistory,
} from "../measurements/measurementContract";
import { measurementPerformanceCounters } from "../measurements/measurementPerformance";
import {
  buildMeasurementHistorySummary,
  buildMeasurementStatCard,
  formatMeasurementHistoryDate,
  formatMeasurementNumber,
  measurementDateFromSelection,
  parseOptionalPositiveMetricInput,
  type MeasurementStatCard,
} from "../measurements/presentationModel";
import type { LocalStoreRuntime } from "../persistence/localStoreRuntime";
import type { AppPlatformServices } from "../platform";
import type {
  MeasuresChartMetricKey,
  MeasuresDashboardPeriodKey,
  UserPreferences,
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
  overlays: {
    bodyFatInfoOpen: boolean;
    expandedPhotoUri: string | null;
    entry: {
      visible: boolean;
      editingMeasurementId: string | null;
      saveBusy: boolean;
      error: string | null;
      latestWeightKg: number | null;
      latestHeightCm: number | null;
      latestWeightMeasuredOn: string | null;
      date: Date;
      dateTextInput: string;
      datePickerOpen: boolean;
      isWeb: boolean;
      isIos: boolean;
      photoUri: string | null;
      fields: Readonly<Record<MeasurementEntryFieldKey, string>>;
    };
  };
};

export type MeasurementEntryFieldKey =
  | "weight"
  | "bodyFat"
  | "neck"
  | "chest"
  | "waist"
  | "hips"
  | "biceps"
  | "quadriceps"
  | "calf"
  | "height";

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
  closeEntry(): void;
  saveEntry(): void;
  openDatePicker(): void;
  changeDateText(value: string): void;
  changeNativeDate(eventType: string, date?: Date): void;
  closeDatePicker(): void;
  pickPhoto(): void;
  takePhoto(): void;
  clearPhoto(): void;
  changeEntryField(field: MeasurementEntryFieldKey, value: string): void;
  closeBodyFatInfo(): void;
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
  editingMeasurementId: string | null;
  saveBusy: boolean;
  error: string | null;
  latestWeightKg: number | null;
  latestHeightCm: number | null;
  latestWeightMeasuredOn: string | null;
  date: Date;
  dateTextInput: string;
  isWeb: boolean;
  isIos: boolean;
  photoUri: string | null;
  entryFields: Readonly<Record<MeasurementEntryFieldKey, string>>;
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
  saveEntry(): void;
  changeDateText(value: string): void;
  changeNativeDate(eventType: string, date?: Date): void;
  pickPhoto(): void;
  takePhoto(): void;
  clearPhoto(): void;
  changeEntryField(field: MeasurementEntryFieldKey, value: string): void;
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
    overlays: {
      bodyFatInfoOpen: input.bodyFatInfoOpen,
      expandedPhotoUri: input.expandedPhotoUri,
      entry: {
        visible: input.entryOpen,
        editingMeasurementId: input.editingMeasurementId,
        saveBusy: input.saveBusy,
        error: input.error,
        latestWeightKg: input.latestWeightKg,
        latestHeightCm: input.latestHeightCm,
        latestWeightMeasuredOn: input.latestWeightMeasuredOn,
        date: input.date,
        dateTextInput: input.dateTextInput,
        datePickerOpen: input.datePickerOpen,
        isWeb: input.isWeb,
        isIos: input.isIos,
        photoUri: input.photoUri,
        fields: input.entryFields,
      },
    },
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
    input.bodyFatInfoOpen,
    input.date,
    input.datePickerOpen,
    input.dateTextInput,
    input.editingMeasurementId,
    input.entryFields,
    input.entryOpen,
    input.error,
    input.expandedPhotoUri,
    input.isIos,
    input.isWeb,
    input.latestHeightCm,
    input.latestWeightKg,
    input.latestWeightMeasuredOn,
    input.photoUri,
    input.saveBusy,
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
  const saveEntry = useCallback(() => targetsRef.current.saveEntry(), []);
  const openDatePicker = useCallback(() => targetsRef.current.setDatePickerOpen(true), []);
  const changeDateText = useCallback((value: string) => targetsRef.current.changeDateText(value), []);
  const changeNativeDate = useCallback((eventType: string, date?: Date) => targetsRef.current.changeNativeDate(eventType, date), []);
  const closeDatePickerAction = useCallback(() => targetsRef.current.setDatePickerOpen(false), []);
  const pickPhoto = useCallback(() => targetsRef.current.pickPhoto(), []);
  const takePhoto = useCallback(() => targetsRef.current.takePhoto(), []);
  const clearPhoto = useCallback(() => targetsRef.current.clearPhoto(), []);
  const changeEntryField = useCallback((field: MeasurementEntryFieldKey, value: string) => targetsRef.current.changeEntryField(field, value), []);
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
    closeEntry: () => targetsRef.current.closeEntry(),
    saveEntry,
    openDatePicker,
    changeDateText,
    changeNativeDate,
    closeDatePicker: closeDatePickerAction,
    pickPhoto,
    takePhoto,
    clearPhoto,
    changeEntryField,
    closeBodyFatInfo: () => targetsRef.current.setBodyFatInfoOpen(false),
  }), [changeDateText, changeEntryField, changeNativeDate, clearPhoto, closeDatePickerAction, editMeasurement, expandPhoto, openBodyFatInfo, openDatePicker, openEntry, pickPhoto, saveEntry, selectMetric, selectPeriod, takePhoto, toggleHistory, toggleMetricDropdown, togglePeriodDropdown]);
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

export type MeasurementsRuntime = {
  controller: ReturnType<typeof useMeasurementsController>;
  latestWeightKg: number | null;
  latestHeightCm: number | null;
  weightSummary: MeasurementSummary["weight_kg"];
  duplicateDateCount: number;
  deleteMeasurement(id: string): Promise<void>;
};

type MeasurementsRuntimeInput = {
  localStore: LocalStoreRuntime;
  services: AppPlatformServices;
  environment: string;
  isHydrated: boolean;
  error: string | null;
  setError(message: string | null): void;
  preferences: UserPreferences;
  updatePreferences(mutator: (previous: UserPreferences) => UserPreferences): void;
  createId(): string;
};

export function useMeasurementsRuntime(input: MeasurementsRuntimeInput): MeasurementsRuntime {
  const store = input.localStore.store;
  const platformOS = input.services.native.Platform.OS;
  const [weightInput, setWeightInput] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(() => measurementDateFromSelection(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateTextInput, setDateTextInput] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedPhotoUri, setExpandedPhotoUri] = useState<string | null>(null);
  const [bodyFatInfoOpen, setBodyFatInfoOpen] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [neckInput, setNeckInput] = useState("");
  const [chestInput, setChestInput] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [hipsInput, setHipsInput] = useState("");
  const [bicepsInput, setBicepsInput] = useState("");
  const [quadricepsInput, setQuadricepsInput] = useState("");
  const [calfInput, setCalfInput] = useState("");
  const storeRef = useRef(store);
  storeRef.current = store;

  const measurementWork = measurementPerformanceCounters(input.environment, platformOS);
  const preparedMeasurements = useMemo(
    () => prepareMeasurementHistory(store.measurements, measurementWork),
    [store.measurements],
  );
  const { latestWeightMeasurement, latestHeightMeasurement } = preparedMeasurements;
  const duplicateDateCount = useMemo(
    () => measurementDuplicateDates(store.measurements).length,
    [store.measurements],
  );
  const latestWeightKg = latestWeightMeasurement?.weight_kg ?? null;
  const dietHeightCm = store.dietSettings.height_cm
    ? parseFloat(store.dietSettings.height_cm)
    : null;
  const latestHeightCm = latestHeightMeasurement?.height_cm
    ?? (Number.isFinite(dietHeightCm) && dietHeightCm! > 0 ? dietHeightCm : null);
  const sex: MeasurementSex = store.dietSettings.sex ?? "male";
  const summary = useMemo(
    () => resolveMeasurementSummary(preparedMeasurements, latestHeightCm, sex, measurementWork),
    [preparedMeasurements, latestHeightCm, sex],
  );

  const resetForm = useCallback(() => {
    setWeightInput("");
    setBodyFatInput("");
    setPhotoUri(null);
    setHeightInput("");
    setNeckInput("");
    setChestInput("");
    setWaistInput("");
    setHipsInput("");
    setBicepsInput("");
    setQuadricepsInput("");
    setCalfInput("");
    setDate(measurementDateFromSelection(new Date()));
    setEditingMeasurementId(null);
  }, []);

  const closeEntry = useCallback(() => {
    setDatePickerOpen(false);
    setEntryOpen(false);
    resetForm();
    input.setError(null);
  }, [input.setError, resetForm]);

  const openEntry = useCallback(() => {
    setDatePickerOpen(false);
    setPeriodDropdownOpen(false);
    setEntryOpen(true);
    setDateTextInput(localDateKey(new Date()));
    input.setError(null);
  }, [input.setError]);

  const editMeasurement = useCallback((measurement: Measurement) => {
    setWeightInput(measurement.weight_kg !== null ? String(measurement.weight_kg) : "");
    setBodyFatInput(measurement.body_fat_pct !== null ? String(measurement.body_fat_pct) : "");
    setHeightInput(measurement.height_cm !== null ? String(measurement.height_cm) : "");
    setNeckInput(measurement.neck_cm !== null ? String(measurement.neck_cm) : "");
    setChestInput(measurement.chest_cm !== null ? String(measurement.chest_cm) : "");
    setWaistInput(measurement.waist_cm !== null ? String(measurement.waist_cm) : "");
    setHipsInput(measurement.hips_cm !== null ? String(measurement.hips_cm) : "");
    setBicepsInput(measurement.biceps_cm !== null ? String(measurement.biceps_cm) : "");
    setQuadricepsInput(measurement.quadriceps_cm !== null ? String(measurement.quadriceps_cm) : "");
    setCalfInput(measurement.calf_cm !== null ? String(measurement.calf_cm) : "");
    setPhotoUri(measurement.photo_uri ?? null);
    setDate(measurementDateAtLocalNoon(measurement.measured_on) ?? new Date(measurement.measured_at));
    setDateTextInput(measurement.measured_on);
    setEditingMeasurementId(measurement.id);
    setEntryOpen(true);
    input.setError(null);
  }, [input.setError]);

  const deleteMeasurement = useCallback(async (id: string) => {
    let removedPhotoUri: string | null = null;
    let referencedPhotoUris: Array<string | null> = [];
    let mutationError: string | null = null;
    try {
      await input.localStore.commit((previous) => {
        const result = deleteMeasurementById(previous.measurements, id);
        if (!result.ok) {
          mutationError = formatMeasurementIssues(result.issues);
          return previous;
        }
        removedPhotoUri = result.removed[0]?.photo_uri ?? null;
        referencedPhotoUris = result.measurements.map((measurement) => measurement.photo_uri);
        return { ...previous, measurements: result.measurements };
      });
      if (mutationError) {
        input.setError(mutationError);
        return;
      }
      deleteOwnedMeasurementPhotoIfUnreferenced(removedPhotoUri, referencedPhotoUris);
      input.setError(null);
    } catch (error) {
      input.setError(
        error instanceof Error
          ? `No se ha eliminado la medición. ${error.message}`
          : "No se ha eliminado la medición.",
      );
    }
  }, [input.localStore, input.setError]);

  const pickPhoto = useCallback(async (source: "library" | "camera") => {
    try {
      const permission = source === "library"
        ? await input.services.imagePicker.requestMediaLibraryPermissionsAsync()
        : await input.services.imagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        input.setError(source === "library"
          ? "Necesitas permitir acceso a fotos para adjuntar una imagen."
          : "Necesitas permitir acceso a la cámara para capturar fotos.");
        return;
      }
      const result = source === "library"
        ? await input.services.imagePicker.launchImageLibraryAsync({
            mediaTypes: input.services.imagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            exif: false,
          })
        : await input.services.imagePicker.launchCameraAsync({
            mediaTypes: input.services.imagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            exif: false,
          });
      if (result.canceled) return;
      const selectedUri = result.assets?.[0]?.uri;
      if (!selectedUri) {
        input.setError(source === "library"
          ? "No se pudo leer la foto seleccionada."
          : "No se pudo leer la foto capturada.");
        return;
      }
      setPhotoUri(selectedUri);
      input.setError(null);
    } catch {
      input.setError(source === "library"
        ? "No se pudo abrir la galería para seleccionar foto."
        : "No se pudo abrir la cámara para capturar foto.");
    }
  }, [input.services.imagePicker, input.setError]);

  const saveEntry = useCallback(async () => {
    const metricInputs: Array<{ field: MeasurementMetricKey; rawValue: string; label: string }> = [
      { field: "weight_kg", rawValue: weightInput, label: "peso" },
      { field: "body_fat_pct", rawValue: bodyFatInput, label: "% grasa corporal" },
      { field: "neck_cm", rawValue: neckInput, label: "contorno de cuello" },
      { field: "chest_cm", rawValue: chestInput, label: "contorno de pecho" },
      { field: "waist_cm", rawValue: waistInput, label: "contorno de cintura" },
      { field: "hips_cm", rawValue: hipsInput, label: "contorno de cadera" },
      { field: "biceps_cm", rawValue: bicepsInput, label: "bíceps" },
      { field: "quadriceps_cm", rawValue: quadricepsInput, label: "cuádriceps" },
      { field: "calf_cm", rawValue: calfInput, label: "gemelo" },
      { field: "height_cm", rawValue: heightInput, label: "altura" },
    ];
    const values = {} as MeasurementValues;
    const patch: MeasurementPatch = {};
    for (const metricInput of metricInputs) {
      const result = parseOptionalPositiveMetricInput(metricInput.field, metricInput.rawValue);
      if (result.invalid) {
        input.setError(`Introduce un valor válido para ${metricInput.label}.`);
        return;
      }
      values[metricInput.field] = result.value;
      if (metricInput.rawValue.trim()) patch[metricInput.field] = result.value;
    }
    if (!MEASUREMENT_METRIC_KEYS.some((field) => values[field] !== null) && !photoUri) {
      input.setError("Añade al menos un dato de medida o una foto.");
      return;
    }

    setSaveBusy(true);
    let portablePhotoUri = photoUri;
    let newlyOwnedPhotoUri: string | null = null;
    try {
      if (photoUri) {
        const currentPhotoUri = editingMeasurementId
          ? storeRef.current.measurements.find((measurement) => measurement.id === editingMeasurementId)?.photo_uri
          : null;
        if (photoUri !== currentPhotoUri || !isOwnedMeasurementPhotoUri(photoUri)) {
          const photo = await normalizeAndStoreMeasurementPhoto(photoUri);
          portablePhotoUri = photo.uri;
          if (photo.owned && photo.uri !== currentPhotoUri) newlyOwnedPhotoUri = photo.uri;
        }
      }

      const dateKey = platformOS === "web" ? dateTextInput.trim() : localDateKey(date);
      const createdId = input.createId();
      let mutationError: string | null = null;
      let previousPhotoUris: Array<string | null> = [];
      let referencedPhotoUris: Array<string | null> = [];
      await input.localStore.commit((previous) => {
        const result = editingMeasurementId
          ? replaceMeasurementById(previous.measurements, {
              id: editingMeasurementId,
              date: dateKey,
              values,
              photoUri: portablePhotoUri,
            })
          : upsertMeasurementByDate(previous.measurements, {
              date: dateKey,
              patch,
              photoUri: portablePhotoUri ?? undefined,
              createId: () => createdId,
            });
        if (!result.ok) {
          mutationError = formatMeasurementIssues(result.issues);
          return previous;
        }
        previousPhotoUris = previous.measurements.map((measurement) => measurement.photo_uri);
        referencedPhotoUris = result.measurements.map((measurement) => measurement.photo_uri);
        return { ...previous, measurements: result.measurements };
      });
      if (mutationError) {
        deleteOwnedMeasurementPhotoIfUnreferenced(
          newlyOwnedPhotoUri,
          storeRef.current.measurements.map((measurement) => measurement.photo_uri),
        );
        input.setError(mutationError);
        return;
      }
      for (const previousPhotoUri of previousPhotoUris) {
        deleteOwnedMeasurementPhotoIfUnreferenced(previousPhotoUri, referencedPhotoUris);
      }
      closeEntry();
    } catch (error) {
      deleteOwnedMeasurementPhotoIfUnreferenced(
        newlyOwnedPhotoUri,
        storeRef.current.measurements.map((measurement) => measurement.photo_uri),
      );
      input.setError(
        error instanceof Error
          ? `No se ha guardado la medición. ${error.message}`
          : "No se ha guardado la medición.",
      );
    } finally {
      setSaveBusy(false);
    }
  }, [
    bicepsInput,
    bodyFatInput,
    calfInput,
    chestInput,
    closeEntry,
    date,
    dateTextInput,
    editingMeasurementId,
    heightInput,
    hipsInput,
    input.createId,
    input.localStore,
    input.setError,
    neckInput,
    photoUri,
    platformOS,
    quadricepsInput,
    waistInput,
    weightInput,
  ]);

  useEffect(() => {
    if (heightInput.trim()) return;
    if (!latestHeightMeasurement || latestHeightMeasurement.height_cm === null) return;
    setHeightInput(formatMeasurementNumber(latestHeightMeasurement.height_cm));
  }, [heightInput, latestHeightMeasurement]);

  useEffect(() => {
    if (!input.isHydrated) return;
    let cancelled = false;
    void (async () => {
      const legacyPhotos = storeRef.current.measurements.filter(
        (measurement) => measurement.photo_uri && !isOwnedMeasurementPhotoUri(measurement.photo_uri),
      );
      if (legacyPhotos.length === 0) {
        sweepOrphanedMeasurementPhotos(
          storeRef.current.measurements.map((measurement) => measurement.photo_uri),
        );
        return;
      }
      if (platformOS === "web") {
        setMediaNotice(
          "La vista web no puede garantizar que las fotos sigan disponibles después de cerrar el navegador. Exporta una copia para conservar los datos.",
        );
        return;
      }
      const migratedUris = new Map<string, string>();
      let failedCount = 0;
      for (const measurement of legacyPhotos) {
        if (cancelled || !measurement.photo_uri) return;
        try {
          const photo = await normalizeAndStoreMeasurementPhoto(measurement.photo_uri);
          if (photo.owned) migratedUris.set(measurement.id, photo.uri);
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      if (cancelled) return;
      if (migratedUris.size > 0) {
        input.localStore.update((previous) => {
          const measurements = previous.measurements.map((measurement) => ({
            ...measurement,
            photo_uri: migratedUris.get(measurement.id) ?? measurement.photo_uri,
          }));
          setTimeout(
            () => sweepOrphanedMeasurementPhotos(measurements.map((measurement) => measurement.photo_uri)),
            0,
          );
          return { ...previous, measurements };
        });
      }
      if (failedCount > 0) {
        setMediaNotice(
          `No se pudieron copiar ${failedCount} foto(s) antigua(s). Las mediciones siguen intactas; revisa las fotos antes de exportar.`,
        );
      }
    })();
    return () => { cancelled = true; };
  }, [input.isHydrated]);

  const entryFields = useMemo(() => ({
    weight: weightInput,
    bodyFat: bodyFatInput,
    neck: neckInput,
    chest: chestInput,
    waist: waistInput,
    hips: hipsInput,
    biceps: bicepsInput,
    quadriceps: quadricepsInput,
    calf: calfInput,
    height: heightInput,
  }), [
    bicepsInput,
    bodyFatInput,
    calfInput,
    chestInput,
    heightInput,
    hipsInput,
    neckInput,
    quadricepsInput,
    waistInput,
    weightInput,
  ]);

  const controller = useMeasurementsController({
    measurements: store.measurements,
    preparedMeasurements,
    summary,
    effectiveHeightCm: latestHeightCm,
    sex,
    measurementWork: measurementWork ?? undefined,
    mediaNotice,
    period: input.preferences.chartPeriod,
    metric: input.preferences.chartMetric,
    periodDropdownOpen,
    metricDropdownOpen,
    showAllHistory,
    bodyFatInfoOpen,
    expandedPhotoUri,
    entryOpen,
    datePickerOpen,
    editingMeasurementId,
    saveBusy,
    error: input.error,
    latestWeightKg,
    latestHeightCm,
    latestWeightMeasuredOn: latestWeightMeasurement?.measured_on ?? null,
    date,
    dateTextInput,
    isWeb: platformOS === "web",
    isIos: platformOS === "ios",
    photoUri,
    entryFields,
    openEntry,
    setPeriodDropdownOpen,
    selectPeriod: (period) => {
      setPeriodDropdownOpen(false);
      input.updatePreferences((previous) => ({ ...previous, chartPeriod: period }));
    },
    setMetricDropdownOpen,
    selectMetric: (metric) => {
      setMetricDropdownOpen(false);
      input.updatePreferences((previous) => ({ ...previous, chartMetric: metric }));
    },
    setBodyFatInfoOpen,
    setShowAllHistory,
    editMeasurement,
    setExpandedPhotoUri,
    closeEntry,
    setDatePickerOpen,
    saveEntry: () => { void saveEntry(); },
    changeDateText: (value) => {
      setDateTextInput(value);
      const validation = validateMeasurementDate(value);
      if (validation.ok) setDate(measurementDateAtLocalNoon(validation.value)!);
    },
    changeNativeDate: (eventType, selectedDate) => {
      if (platformOS === "android") setDatePickerOpen(false);
      if (eventType === "dismissed" || !selectedDate) return;
      setDate(measurementDateFromSelection(selectedDate));
    },
    pickPhoto: () => { void pickPhoto("library"); },
    takePhoto: () => { void pickPhoto("camera"); },
    clearPhoto: () => setPhotoUri(null),
    changeEntryField: (field, value) => {
      const setters: Record<MeasurementEntryFieldKey, (next: string) => void> = {
        weight: setWeightInput,
        bodyFat: setBodyFatInput,
        neck: setNeckInput,
        chest: setChestInput,
        waist: setWaistInput,
        hips: setHipsInput,
        biceps: setBicepsInput,
        quadriceps: setQuadricepsInput,
        calf: setCalfInput,
        height: setHeightInput,
      };
      setters[field](value);
    },
  });

  return useMemo(() => ({
    controller,
    latestWeightKg,
    latestHeightCm,
    weightSummary: summary.weight_kg,
    duplicateDateCount,
    deleteMeasurement,
  }), [controller, deleteMeasurement, duplicateDateCount, latestHeightCm, latestWeightKg, summary.weight_kg]);
}
