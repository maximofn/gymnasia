import { useMemo, useRef } from "react";

import type {
  WorkoutSessionSummary,
  WorkoutSummaryRecalculation,
} from "../training/workoutHistory";
import type { ExerciseSeries } from "../training/seriesContract";
import type { WorkoutEffortBreakdown } from "../training/workoutExecution";
import type {
  RoutineIconName,
  WorkoutExercise,
  WorkoutTemplate,
} from "../training/workoutTemplateOperations";
import type {
  TrainingStatsMetricKey,
  TrainingStatsPeriodKey,
} from "../training/presentationModel";
import type { ScreenController } from "./types";

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
