import { useMemo, useRef } from "react";

import type {
  WorkoutSessionSummary,
  WorkoutSummaryRecalculation,
} from "../training/workoutHistory";
import type { ExerciseSeries, SubSeries } from "../training/seriesContract";
import type { WorkoutEffortBreakdown, WorkoutExecutionUnit } from "../training/workoutExecution";
import type {
  RoutineIconName,
  TrainingCategory,
  WorkoutExercise,
  WorkoutTemplate,
} from "../training/workoutTemplateOperations";
import { resolveTrainingCategory } from "../training/workoutSessionModel";
import type {
  TrainingStatsMetricKey,
  TrainingStatsPeriodKey,
} from "../training/presentationModel";
import type { CatalogLink } from "../catalogs/types";
import type { WorkoutTemplateValidation } from "../training/workoutTemplateTransactions";
import type { WorkoutSession, WorkoutSessionResolutionKind } from "../training/workoutSessionModel";
import type { ScreenController } from "./types";

export type WorkoutCompletionModalState = {
  kind: WorkoutSessionResolutionKind;
  summary: WorkoutSessionSummary | null;
  has_template_changes: boolean;
  original_template: WorkoutTemplate | null;
  draft_template: WorkoutTemplate | null;
  canonical_conflict: boolean;
};

export type TrainingResolutionModel = {
  discardDraftOpen: boolean;
  conflictOpen: boolean;
  partialFinishOpen: boolean;
  completedEffortCount: number;
  totalEffortCount: number;
  completion: WorkoutCompletionModalState | null;
  hasActiveSession: boolean;
};

export type TrainingResolutionActions = {
  keepEditing(): void;
  discardDraft(): void;
  loadCurrentTemplate(): void;
  overwriteTemplate(): void;
  continueAfterConflict(): void;
  continuePartialSession(): void;
  savePartialSession(): void;
  finalizeWithTemplateChanges(canonicalConflict: boolean): void;
  revertTemplateChanges(): void;
  continueSessionResolution(): void;
  finishOrClose(): void;
};

export type TrainingResolutionControllerInput = TrainingResolutionModel & TrainingResolutionActions;

export function useTrainingResolutionController(
  input: TrainingResolutionControllerInput,
): ScreenController<TrainingResolutionModel, TrainingResolutionActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingResolutionModel>(() => ({
    discardDraftOpen: input.discardDraftOpen,
    conflictOpen: input.conflictOpen,
    partialFinishOpen: input.partialFinishOpen,
    completedEffortCount: input.completedEffortCount,
    totalEffortCount: input.totalEffortCount,
    completion: input.completion,
    hasActiveSession: input.hasActiveSession,
  }), [
    input.completedEffortCount,
    input.completion,
    input.conflictOpen,
    input.discardDraftOpen,
    input.hasActiveSession,
    input.partialFinishOpen,
    input.totalEffortCount,
  ]);
  const actions = useMemo<TrainingResolutionActions>(() => ({
    keepEditing: () => inputRef.current.keepEditing(),
    discardDraft: () => inputRef.current.discardDraft(),
    loadCurrentTemplate: () => inputRef.current.loadCurrentTemplate(),
    overwriteTemplate: () => inputRef.current.overwriteTemplate(),
    continueAfterConflict: () => inputRef.current.continueAfterConflict(),
    continuePartialSession: () => inputRef.current.continuePartialSession(),
    savePartialSession: () => inputRef.current.savePartialSession(),
    finalizeWithTemplateChanges: (canonicalConflict) => inputRef.current.finalizeWithTemplateChanges(canonicalConflict),
    revertTemplateChanges: () => inputRef.current.revertTemplateChanges(),
    continueSessionResolution: () => inputRef.current.continueSessionResolution(),
    finishOrClose: () => inputRef.current.finishOrClose(),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingSessionSubSeriesState = {
  key: string;
  unit: WorkoutExecutionUnit;
  subSeries: SubSeries;
  subSeriesIndex: number;
  isCompleted: boolean;
  isCurrent: boolean;
};

export type TrainingSessionSeriesState = {
  key: string;
  series: ExerciseSeries;
  seriesIndex: number;
  subSeriesStates: TrainingSessionSubSeriesState[];
  isCompleted: boolean;
  isCurrent: boolean;
};

export type TrainingSessionExercise = {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  seriesStates: TrainingSessionSeriesState[];
  completedEffortCount: number;
  totalEffortCount: number;
  isCurrentExercise: boolean;
  isCompletedExercise: boolean;
  muscle: string;
};

export type TrainingSessionModel = {
  session: WorkoutSession | null;
  exercises: ReadonlyArray<TrainingSessionExercise>;
  progressPercent: number;
  currentUnit: WorkoutExecutionUnit | null;
  restTargetSeconds: number;
  restProgressRatio: number;
  discardConfirmationOpen: boolean;
  activeSeriesMenuId: string | null;
};

export type TrainingSessionActions = {
  openExercisePicker(): void;
  finish(): void;
  discard(): void;
  closeDiscardConfirmation(): void;
  focusExercise(exerciseId: string): void;
  moveExercise(exerciseId: string, direction: "up" | "down"): void;
  removeExercise(exerciseId: string): void;
  markUnitDone(key: string): void;
  markUnitNotDone(key: string): void;
  openSeriesTypePicker(exerciseId: string, seriesId: string): void;
  closeSeriesTypePicker(): void;
  updateSeriesField(exerciseId: string, seriesId: string, field: ExerciseSeriesField, value: string): void;
  toggleSeriesMenu(key: string): void;
  closeSeriesMenu(): void;
  moveSeries(exerciseId: string, seriesId: string, direction: "up" | "down"): void;
  deleteSeries(exerciseId: string, seriesId: string): void;
  addSeries(exerciseId: string): void;
  pause(): void;
  resume(): void;
  skipRest(): void;
  closePartialFinish(): void;
  closeCompletion(): void;
};

export type TrainingSessionControllerInput = TrainingSessionModel & TrainingSessionActions & {
  seriesTypePickerOpen: boolean;
  partialFinishOpen: boolean;
  completionOpen: boolean;
};

export function useTrainingSessionController(
  input: TrainingSessionControllerInput,
): ScreenController<
  TrainingSessionModel,
  TrainingSessionActions,
  "training-partial-finish" | "workout-completion" | "workout-discard-confirmation" | "training-series-menu" | "series-type-picker"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingSessionModel>(() => ({
    session: input.session,
    exercises: input.exercises,
    progressPercent: input.progressPercent,
    currentUnit: input.currentUnit,
    restTargetSeconds: input.restTargetSeconds,
    restProgressRatio: input.restProgressRatio,
    discardConfirmationOpen: input.discardConfirmationOpen,
    activeSeriesMenuId: input.activeSeriesMenuId,
  }), [
    input.activeSeriesMenuId,
    input.currentUnit,
    input.discardConfirmationOpen,
    input.exercises,
    input.progressPercent,
    input.restProgressRatio,
    input.restTargetSeconds,
    input.session,
  ]);
  const actions = useMemo<TrainingSessionActions>(() => ({
    openExercisePicker: () => inputRef.current.openExercisePicker(),
    finish: () => inputRef.current.finish(),
    discard: () => inputRef.current.discard(),
    closeDiscardConfirmation: () => inputRef.current.closeDiscardConfirmation(),
    focusExercise: (exerciseId) => inputRef.current.focusExercise(exerciseId),
    moveExercise: (exerciseId, direction) => inputRef.current.moveExercise(exerciseId, direction),
    removeExercise: (exerciseId) => inputRef.current.removeExercise(exerciseId),
    markUnitDone: (key) => inputRef.current.markUnitDone(key),
    markUnitNotDone: (key) => inputRef.current.markUnitNotDone(key),
    openSeriesTypePicker: (exerciseId, seriesId) => inputRef.current.openSeriesTypePicker(exerciseId, seriesId),
    closeSeriesTypePicker: () => inputRef.current.closeSeriesTypePicker(),
    updateSeriesField: (exerciseId, seriesId, field, value) => inputRef.current.updateSeriesField(exerciseId, seriesId, field, value),
    toggleSeriesMenu: (key) => inputRef.current.toggleSeriesMenu(key),
    closeSeriesMenu: () => inputRef.current.closeSeriesMenu(),
    moveSeries: (exerciseId, seriesId, direction) => inputRef.current.moveSeries(exerciseId, seriesId, direction),
    deleteSeries: (exerciseId, seriesId) => inputRef.current.deleteSeries(exerciseId, seriesId),
    addSeries: (exerciseId) => inputRef.current.addSeries(exerciseId),
    pause: () => inputRef.current.pause(),
    resume: () => inputRef.current.resume(),
    skipRest: () => inputRef.current.skipRest(),
    closePartialFinish: () => inputRef.current.closePartialFinish(),
    closeCompletion: () => inputRef.current.closeCompletion(),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "training-partial-finish": input.partialFinishOpen,
      "workout-completion": input.completionOpen,
      "workout-discard-confirmation": input.discardConfirmationOpen,
      "training-series-menu": input.session !== null && input.activeSeriesMenuId !== null,
      "series-type-picker": input.session !== null && input.seriesTypePickerOpen,
    },
    handlers: {
      "training-partial-finish": () => {
        if (!inputRef.current.partialFinishOpen) return false;
        inputRef.current.closePartialFinish();
        return true;
      },
      "workout-completion": () => {
        if (!inputRef.current.completionOpen) return false;
        inputRef.current.closeCompletion();
        return true;
      },
      "workout-discard-confirmation": () => {
        if (!inputRef.current.discardConfirmationOpen) return false;
        inputRef.current.closeDiscardConfirmation();
        return true;
      },
      "training-series-menu": () => {
        if (inputRef.current.session === null || inputRef.current.activeSeriesMenuId === null) return false;
        inputRef.current.closeSeriesMenu();
        return true;
      },
      "series-type-picker": () => {
        if (inputRef.current.session === null || !inputRef.current.seriesTypePickerOpen) return false;
        inputRef.current.closeSeriesTypePicker();
        return true;
      },
    },
  }), [
    input.activeSeriesMenuId,
    input.completionOpen,
    input.discardConfirmationOpen,
    input.partialFinishOpen,
    input.seriesTypePickerOpen,
    input.session,
  ]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingFilter = "all" | TrainingCategory;

export type TrainingListModel = {
  search: string;
  filter: TrainingFilter;
  totalTemplateCount: number;
  templates: ReadonlyArray<WorkoutTemplate>;
  menuTemplateId: string | null;
  lastWorkoutSummary: WorkoutSessionSummary | null;
};

export type TrainingListActions = {
  updateSearch(value: string): void;
  updateFilter(value: TrainingFilter): void;
  createTemplate(): void;
  openTemplate(id: string): void;
  editTemplate(id: string): void;
  cloneTemplate(id: string): void;
  moveTemplate(id: string): void;
  deleteTemplate(id: string): void;
  startTemplate(id: string): void;
  toggleTemplateMenu(id: string): void;
  closeTemplateMenu(): void;
  closeLastWorkoutSummary(): void;
};

export type TrainingListControllerInput = Omit<TrainingListModel, "templates" | "totalTemplateCount"> &
  TrainingListActions & {
    allTemplates: ReadonlyArray<WorkoutTemplate>;
  };

export function useTrainingListController(
  input: TrainingListControllerInput,
): ScreenController<TrainingListModel, TrainingListActions, "training-template-menu"> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const templates = useMemo(() => {
    const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const search = normalize(input.search.trim());
    return input.allTemplates.filter((template) => {
      const matchesSearch = !search || normalize(template.name).includes(search);
      const matchesFilter = input.filter === "all" || resolveTrainingCategory(template) === input.filter;
      return matchesSearch && matchesFilter;
    });
  }, [input.allTemplates, input.filter, input.search]);
  const model = useMemo<TrainingListModel>(() => ({
    search: input.search,
    filter: input.filter,
    totalTemplateCount: input.allTemplates.length,
    templates,
    menuTemplateId: input.menuTemplateId,
    lastWorkoutSummary: input.lastWorkoutSummary,
  }), [input.allTemplates.length, input.filter, input.lastWorkoutSummary, input.menuTemplateId, input.search, templates]);
  const actions = useMemo<TrainingListActions>(() => ({
    updateSearch: (value) => inputRef.current.updateSearch(value),
    updateFilter: (value) => inputRef.current.updateFilter(value),
    createTemplate: () => inputRef.current.createTemplate(),
    openTemplate: (id) => inputRef.current.openTemplate(id),
    editTemplate: (id) => inputRef.current.editTemplate(id),
    cloneTemplate: (id) => inputRef.current.cloneTemplate(id),
    moveTemplate: (id) => inputRef.current.moveTemplate(id),
    deleteTemplate: (id) => inputRef.current.deleteTemplate(id),
    startTemplate: (id) => inputRef.current.startTemplate(id),
    toggleTemplateMenu: (id) => inputRef.current.toggleTemplateMenu(id),
    closeTemplateMenu: () => inputRef.current.closeTemplateMenu(),
    closeLastWorkoutSummary: () => inputRef.current.closeLastWorkoutSummary(),
  }), []);
  const back = useMemo(() => ({
    layers: { "training-template-menu": input.menuTemplateId !== null },
    handlers: {
      "training-template-menu": () => {
        if (inputRef.current.menuTemplateId === null) return false;
        inputRef.current.closeTemplateMenu();
        return true;
      },
    },
  }), [input.menuTemplateId]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingEditorModel = {
  template: WorkoutTemplate | null;
  category: import("../training/workoutTemplateOperations").TrainingCategory | null;
  categoryMeta: { label: string; color: string; iconBg: string } | null;
  icon: RoutineIconName | null;
  durationMinutes: number;
  seriesTotal: number;
  draftDirty: boolean;
  draftValidation: WorkoutTemplateValidation | null;
  saveBusy: boolean;
  activeExerciseMenuId: string | null;
  activeSeriesMenuId: string | null;
  expandedCompoundSeriesId: string | null;
};

type ExerciseSeriesField =
  | "reps"
  | "weight_kg"
  | "rest_seconds"
  | "type"
  | "tempo_contraction"
  | "tempo_pause"
  | "tempo_relaxation";

type SubSeriesField =
  | "reps"
  | "weight_kg"
  | "rest_seconds"
  | "exercise_name"
  | "exercise_id"
  | "catalog_link";

export type TrainingEditorActions = {
  requestClose(): void;
  save(): void;
  updateName(value: string): void;
  updateDuration(value: string): void;
  updateCategory(value: import("../training/workoutTemplateOperations").TrainingCategory): void;
  updateIcon(value: RoutineIconName): void;
  start(): void;
  openExercisePicker(): void;
  toggleExerciseMenu(exerciseId: string): void;
  closeExerciseMenu(): void;
  editExercise(exerciseId: string): void;
  cloneExercise(exerciseId: string): void;
  moveExercise(exerciseId: string): void;
  deleteExercise(exerciseId: string): void;
  addSeries(exerciseId: string): void;
  openSeriesTypePicker(exerciseId: string, seriesId: string): void;
  updateSeriesField(exerciseId: string, seriesId: string, field: ExerciseSeriesField, value: string): void;
  toggleSeriesMenu(key: string): void;
  closeSeriesMenu(): void;
  duplicateSeries(exerciseId: string, seriesId: string): void;
  deleteSeries(exerciseId: string, seriesId: string): void;
  toggleCompoundSeries(seriesId: string): void;
  openSupersetPicker(exerciseId: string, seriesId: string, subSeriesId: string): void;
  updateSubSeriesField(exerciseId: string, seriesId: string, subSeriesId: string, field: SubSeriesField, value: string | CatalogLink): void;
  removeSubSeries(exerciseId: string, seriesId: string, subSeriesId: string): void;
  addSubSeries(exerciseId: string, seriesId: string): void;
  updateExerciseName(exerciseId: string, value: string): void;
  closeSeriesTypePicker(): void;
};

export type TrainingEditorControllerInput = TrainingEditorModel & TrainingEditorActions & {
  seriesTypePickerOpen: boolean;
};

export function useTrainingEditorController(
  input: TrainingEditorControllerInput,
): ScreenController<
  TrainingEditorModel,
  TrainingEditorActions,
  "training-exercise-menu" | "training-series-menu" | "series-type-picker"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingEditorModel>(() => ({
    template: input.template,
    category: input.category,
    categoryMeta: input.categoryMeta,
    icon: input.icon,
    durationMinutes: input.durationMinutes,
    seriesTotal: input.seriesTotal,
    draftDirty: input.draftDirty,
    draftValidation: input.draftValidation,
    saveBusy: input.saveBusy,
    activeExerciseMenuId: input.activeExerciseMenuId,
    activeSeriesMenuId: input.activeSeriesMenuId,
    expandedCompoundSeriesId: input.expandedCompoundSeriesId,
  }), [
    input.activeExerciseMenuId,
    input.activeSeriesMenuId,
    input.category,
    input.categoryMeta,
    input.draftDirty,
    input.draftValidation,
    input.durationMinutes,
    input.expandedCompoundSeriesId,
    input.icon,
    input.saveBusy,
    input.seriesTotal,
    input.template,
  ]);
  const actions = useMemo<TrainingEditorActions>(() => ({
    requestClose: () => inputRef.current.requestClose(),
    save: () => inputRef.current.save(),
    updateName: (value) => inputRef.current.updateName(value),
    updateDuration: (value) => inputRef.current.updateDuration(value),
    updateCategory: (value) => inputRef.current.updateCategory(value),
    updateIcon: (value) => inputRef.current.updateIcon(value),
    start: () => inputRef.current.start(),
    openExercisePicker: () => inputRef.current.openExercisePicker(),
    toggleExerciseMenu: (exerciseId) => inputRef.current.toggleExerciseMenu(exerciseId),
    closeExerciseMenu: () => inputRef.current.closeExerciseMenu(),
    editExercise: (exerciseId) => inputRef.current.editExercise(exerciseId),
    cloneExercise: (exerciseId) => inputRef.current.cloneExercise(exerciseId),
    moveExercise: (exerciseId) => inputRef.current.moveExercise(exerciseId),
    deleteExercise: (exerciseId) => inputRef.current.deleteExercise(exerciseId),
    addSeries: (exerciseId) => inputRef.current.addSeries(exerciseId),
    openSeriesTypePicker: (exerciseId, seriesId) => inputRef.current.openSeriesTypePicker(exerciseId, seriesId),
    updateSeriesField: (exerciseId, seriesId, field, value) => inputRef.current.updateSeriesField(exerciseId, seriesId, field, value),
    toggleSeriesMenu: (key) => inputRef.current.toggleSeriesMenu(key),
    closeSeriesMenu: () => inputRef.current.closeSeriesMenu(),
    duplicateSeries: (exerciseId, seriesId) => inputRef.current.duplicateSeries(exerciseId, seriesId),
    deleteSeries: (exerciseId, seriesId) => inputRef.current.deleteSeries(exerciseId, seriesId),
    toggleCompoundSeries: (seriesId) => inputRef.current.toggleCompoundSeries(seriesId),
    openSupersetPicker: (exerciseId, seriesId, subSeriesId) => inputRef.current.openSupersetPicker(exerciseId, seriesId, subSeriesId),
    updateSubSeriesField: (exerciseId, seriesId, subSeriesId, field, value) => inputRef.current.updateSubSeriesField(exerciseId, seriesId, subSeriesId, field, value),
    removeSubSeries: (exerciseId, seriesId, subSeriesId) => inputRef.current.removeSubSeries(exerciseId, seriesId, subSeriesId),
    addSubSeries: (exerciseId, seriesId) => inputRef.current.addSubSeries(exerciseId, seriesId),
    updateExerciseName: (exerciseId, value) => inputRef.current.updateExerciseName(exerciseId, value),
    closeSeriesTypePicker: () => inputRef.current.closeSeriesTypePicker(),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "training-exercise-menu": input.activeExerciseMenuId !== null,
      "training-series-menu": input.activeSeriesMenuId !== null,
      "series-type-picker": input.seriesTypePickerOpen,
    },
    handlers: {
      "training-exercise-menu": () => {
        if (inputRef.current.activeExerciseMenuId === null) return false;
        inputRef.current.closeExerciseMenu();
        return true;
      },
      "training-series-menu": () => {
        if (inputRef.current.activeSeriesMenuId === null) return false;
        inputRef.current.closeSeriesMenu();
        return true;
      },
      "series-type-picker": () => {
        if (!inputRef.current.seriesTypePickerOpen) return false;
        inputRef.current.closeSeriesTypePicker();
        return true;
      },
    },
  }), [input.activeExerciseMenuId, input.activeSeriesMenuId, input.seriesTypePickerOpen]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingDetailExercise = {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  exerciseName: string;
  imageUri: string | null;
  muscle: string;
  previewMeta: {
    icon: RoutineIconName;
    label: string;
    accentColor: string;
    backgroundColor: string;
  };
  instructions: string;
  seriesItems: ExerciseSeries[];
  setsCount: number;
  repsLabel: string;
  weightLabel: string;
  restLabel: string;
  volumeLabel: string;
};

export type TrainingDetailModel = {
  template: WorkoutTemplate | null;
  previewImageUri: string | null;
  categoryMeta: { label: string; color: string; iconBg: string } | null;
  icon: RoutineIconName | null;
  summary: string;
  statsMetricMeta: { key: TrainingStatsMetricKey; label: string; shortLabel: string };
  statsMetric: TrainingStatsMetricKey;
  statsPeriod: TrainingStatsPeriodKey;
  metricDropdownOpen: boolean;
  periodDropdownOpen: boolean;
  chartBars: ReadonlyArray<{
    id: string;
    label: string;
    metricValue: number;
    metricValueLabel: string;
    isLatest: boolean;
    heightPercent: number;
  }>;
  completedHistoryCount: number;
  historyCount: number;
  filteredHistoryCount: number;
  effortDetail: { detailedCount: number; breakdown: WorkoutEffortBreakdown };
  legacySummaryCount: number;
  canExpandHistory: boolean;
  showAllHistory: boolean;
  historyEntries: ReadonlyArray<WorkoutSessionSummary>;
  durationMinutes: number;
  estimatedCalories: number;
  muscleFilters: ReadonlyArray<string>;
  muscleFilter: string;
  detailExercises: ReadonlyArray<TrainingDetailExercise>;
};

export type TrainingDetailActions = {
  close(): void;
  edit(): void;
  start(): void;
  toggleMetricDropdown(): void;
  closeMetricDropdown(): void;
  selectMetric(metric: TrainingStatsMetricKey): void;
  togglePeriodDropdown(): void;
  closePeriodDropdown(): void;
  selectPeriod(period: TrainingStatsPeriodKey): void;
  toggleAllHistory(): void;
  collapseHistory(): void;
  openHistory(id: string): void;
  selectMuscle(muscle: string): void;
  openExercise(index: number): void;
  closeExercise(): void;
};

export type TrainingDetailControllerInput = TrainingDetailModel & TrainingDetailActions & {
  exerciseDetailOpen: boolean;
};

export function useTrainingDetailController(
  input: TrainingDetailControllerInput,
): ScreenController<
  TrainingDetailModel,
  TrainingDetailActions,
  "training-history-expanded" | "training-exercise-detail" | "training-period-dropdown" | "training-metric-dropdown"
> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingDetailModel>(() => ({
    template: input.template,
    previewImageUri: input.previewImageUri,
    categoryMeta: input.categoryMeta,
    icon: input.icon,
    summary: input.summary,
    statsMetricMeta: input.statsMetricMeta,
    statsMetric: input.statsMetric,
    statsPeriod: input.statsPeriod,
    metricDropdownOpen: input.metricDropdownOpen,
    periodDropdownOpen: input.periodDropdownOpen,
    chartBars: input.chartBars,
    completedHistoryCount: input.completedHistoryCount,
    historyCount: input.historyCount,
    filteredHistoryCount: input.filteredHistoryCount,
    effortDetail: input.effortDetail,
    legacySummaryCount: input.legacySummaryCount,
    canExpandHistory: input.canExpandHistory,
    showAllHistory: input.showAllHistory,
    historyEntries: input.historyEntries,
    durationMinutes: input.durationMinutes,
    estimatedCalories: input.estimatedCalories,
    muscleFilters: input.muscleFilters,
    muscleFilter: input.muscleFilter,
    detailExercises: input.detailExercises,
  }), [
    input.canExpandHistory,
    input.categoryMeta,
    input.chartBars,
    input.completedHistoryCount,
    input.detailExercises,
    input.durationMinutes,
    input.effortDetail,
    input.estimatedCalories,
    input.filteredHistoryCount,
    input.historyCount,
    input.historyEntries,
    input.icon,
    input.legacySummaryCount,
    input.metricDropdownOpen,
    input.muscleFilter,
    input.muscleFilters,
    input.periodDropdownOpen,
    input.previewImageUri,
    input.showAllHistory,
    input.statsMetric,
    input.statsMetricMeta,
    input.statsPeriod,
    input.summary,
    input.template,
  ]);
  const actions = useMemo<TrainingDetailActions>(() => ({
    close: () => inputRef.current.close(),
    edit: () => inputRef.current.edit(),
    start: () => inputRef.current.start(),
    toggleMetricDropdown: () => inputRef.current.toggleMetricDropdown(),
    closeMetricDropdown: () => inputRef.current.closeMetricDropdown(),
    selectMetric: (metric) => inputRef.current.selectMetric(metric),
    togglePeriodDropdown: () => inputRef.current.togglePeriodDropdown(),
    closePeriodDropdown: () => inputRef.current.closePeriodDropdown(),
    selectPeriod: (period) => inputRef.current.selectPeriod(period),
    toggleAllHistory: () => inputRef.current.toggleAllHistory(),
    collapseHistory: () => inputRef.current.collapseHistory(),
    openHistory: (id) => inputRef.current.openHistory(id),
    selectMuscle: (muscle) => inputRef.current.selectMuscle(muscle),
    openExercise: (index) => inputRef.current.openExercise(index),
    closeExercise: () => inputRef.current.closeExercise(),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "training-history-expanded": input.showAllHistory,
      "training-exercise-detail": input.exerciseDetailOpen,
      "training-period-dropdown": input.periodDropdownOpen,
      "training-metric-dropdown": input.metricDropdownOpen,
    },
    handlers: {
      "training-history-expanded": () => {
        if (!inputRef.current.showAllHistory) return false;
        inputRef.current.collapseHistory();
        return true;
      },
      "training-exercise-detail": () => {
        if (!inputRef.current.exerciseDetailOpen) return false;
        inputRef.current.closeExercise();
        return true;
      },
      "training-period-dropdown": () => {
        if (!inputRef.current.periodDropdownOpen) return false;
        inputRef.current.closePeriodDropdown();
        return true;
      },
      "training-metric-dropdown": () => {
        if (!inputRef.current.metricDropdownOpen) return false;
        inputRef.current.closeMetricDropdown();
        return true;
      },
    },
  }), [input.exerciseDetailOpen, input.metricDropdownOpen, input.periodDropdownOpen, input.showAllHistory]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type TrainingHistoryModel = {
  historyOpen: boolean;
  selectedSummary: WorkoutSessionSummary | null;
  selectedRecalculation: WorkoutSummaryRecalculation;
  selectedHasCurrentTemplate: boolean;
  history: ReadonlyArray<WorkoutSessionSummary>;
};

export type TrainingHistoryActions = {
  closeHistory(): void;
  openHistory(id: string): void;
  openCurrentTemplate(): void;
};

export type TrainingHistoryControllerInput = TrainingHistoryModel & TrainingHistoryActions;

export function useTrainingHistoryController(
  input: TrainingHistoryControllerInput,
): ScreenController<TrainingHistoryModel, TrainingHistoryActions, "training-history" | "workout-history-detail"> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<TrainingHistoryModel>(() => ({
    historyOpen: input.historyOpen,
    selectedSummary: input.selectedSummary,
    selectedRecalculation: input.selectedRecalculation,
    selectedHasCurrentTemplate: input.selectedHasCurrentTemplate,
    history: input.history,
  }), [input.history, input.historyOpen, input.selectedHasCurrentTemplate, input.selectedRecalculation, input.selectedSummary]);
  const actions = useMemo<TrainingHistoryActions>(() => ({
    closeHistory: () => inputRef.current.closeHistory(),
    openHistory: (id) => inputRef.current.openHistory(id),
    openCurrentTemplate: () => inputRef.current.openCurrentTemplate(),
  }), []);
  const back = useMemo(() => ({
    layers: {
      "training-history": input.historyOpen,
      "workout-history-detail": input.selectedSummary !== null,
    },
    handlers: {
      "training-history": () => {
        if (!inputRef.current.historyOpen) return false;
        inputRef.current.closeHistory();
        return true;
      },
      "workout-history-detail": () => {
        if (!inputRef.current.selectedSummary) return false;
        inputRef.current.closeHistory();
        return true;
      },
    },
  }), [input.historyOpen, input.selectedSummary]);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
