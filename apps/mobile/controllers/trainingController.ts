import { useMemo, useRef } from "react";

import type {
  WorkoutSessionSummary,
  WorkoutSummaryRecalculation,
} from "../training/workoutHistory";
import type { ScreenController } from "./types";

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
