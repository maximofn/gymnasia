import { exerciseCatalogMatchKey, findByCatalogRef, matchExerciseCatalog } from "../catalogs/matching";
import type { CatalogLink, ExerciseCatalogEntry } from "../catalogs/types";
import {
  estimateTemplateCalories,
  formatSpanishList,
  formatTrainingStatsHistoryLabel,
  formatTrainingStatsMetricValue,
  inferExerciseMuscle,
  inferTemplateDurationMinutes,
  normalizeExerciseImageUri,
  normalizeTemplateIcon,
  resolveExercisePreviewMeta,
  resolveTrainingStatsPeriodStart,
  totalSeriesCount,
  trainingCategoryMeta,
  type TrainingStatsMetricKey,
  type TrainingStatsPeriodKey,
} from "./presentationModel";
import type { WorkoutEffortBreakdown } from "./workoutExecution";
import {
  isCompletedWorkoutSummary,
  recalculateWorkoutSessionSummary,
  sortWorkoutHistoryDesc,
  type WorkoutSessionSummary,
  type WorkoutSummaryRecalculation,
} from "./workoutHistory";
import { resolveTrainingCategory } from "./workoutSessionModel";
import {
  isWorkoutTemplateDraftDirty,
  validateWorkoutTemplateDraft,
  type WorkoutTemplateDraftState,
} from "./workoutTemplateTransactions";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

const TRAINING_STATS_METRIC_OPTIONS: Array<{
  key: TrainingStatsMetricKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "volume", label: "Volumen", shortLabel: "kg" },
  { key: "reps", label: "Repeticiones", shortLabel: "reps" },
  { key: "duration", label: "Duración", shortLabel: "min" },
];

function resolveRepoExercise(
  repo: ExerciseCatalogEntry[],
  rawName: string | null | undefined,
  catalogLink?: CatalogLink,
): ExerciseCatalogEntry | null {
  if (catalogLink?.status === "linked") return findByCatalogRef(repo, catalogLink.ref);
  const match = matchExerciseCatalog(repo, rawName);
  return match.kind === "exact" || match.kind === "alias" ? match.candidate : null;
}

export type TrainingDetailPresentationInput = {
  activeTemplateId: string | null;
  activeTemplateMode: "detail" | "edit";
  templateDraft: WorkoutTemplateDraftState | null;
  templates: readonly WorkoutTemplate[];
  exercisesRepo: ExerciseCatalogEntry[];
  exerciseImageBaseUrl: string;
  workoutHistory: readonly WorkoutSessionSummary[];
  muscleFilter: string;
  statsPeriod: TrainingStatsPeriodKey;
  statsMetric: TrainingStatsMetricKey;
  showAllHistory: boolean;
  selectedHistoryId: string | null;
};

export function buildTrainingDetailPresentation(input: TrainingDetailPresentationInput) {
  const activeTemplate = input.activeTemplateMode === "edit"
    && input.templateDraft?.draft.id === input.activeTemplateId
    ? input.templateDraft.draft
    : input.templates.find((template) => template.id === input.activeTemplateId) ?? null;
  const draftDirty = !!input.templateDraft && isWorkoutTemplateDraftDirty(input.templateDraft);
  const draftValidation = input.templateDraft
    ? validateWorkoutTemplateDraft(input.templateDraft.draft)
    : null;
  const category = activeTemplate ? resolveTrainingCategory(activeTemplate) : null;
  const categoryMeta = category ? trainingCategoryMeta(category) : null;
  const icon = activeTemplate && category
    ? normalizeTemplateIcon(activeTemplate.icon, category, 0)
    : null;
  const durationMinutes = activeTemplate ? inferTemplateDurationMinutes(activeTemplate) : 0;
  const seriesTotal = activeTemplate ? totalSeriesCount(activeTemplate) : 0;
  const previewExercises = !activeTemplate || !category ? [] : activeTemplate.exercises.map(
    (exercise, exerciseIndex) => {
      const exerciseName = exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`;
      const seriesItems = exercise.series ?? [];
      const repoMatch = resolveRepoExercise(input.exercisesRepo, exerciseName, exercise.catalog_link);
      const muscle = exercise.muscle?.trim()
        || repoMatch?.muscle_group
        || inferExerciseMuscle(exerciseName, category);
      const firstSeries = seriesItems[0] ?? null;
      const firstWeight = seriesItems.find((seriesItem) => seriesItem.weight_kg.trim())
        ?.weight_kg.trim() ?? "";
      const repsLabel = firstSeries?.reps.trim() || "--";
      const firstRest = seriesItems.find((seriesItem) => seriesItem.rest_seconds.trim())
        ?.rest_seconds.trim() ?? "";
      const storedImage = normalizeExerciseImageUri(exercise.image_uri);
      const repoImageUri = repoMatch
        ? `${input.exerciseImageBaseUrl.replace(/\/$/, "")}/${repoMatch.image_male}`
        : null;
      const isStoredRepoImage = !!storedImage && storedImage.startsWith(input.exerciseImageBaseUrl);
      const imageUri = (!storedImage || isStoredRepoImage) && repoImageUri
        ? repoImageUri
        : storedImage;
      return {
        exercise,
        exerciseIndex,
        exerciseName,
        imageUri,
        muscle,
        previewMeta: resolveExercisePreviewMeta(exerciseName, muscle, category),
        instructions: repoMatch?.instructions ?? "",
        seriesItems,
        setsCount: seriesItems.length,
        repsLabel,
        weightLabel: firstWeight,
        restLabel: firstRest,
        volumeLabel: seriesItems.length > 0
          ? `${seriesItems.length} x ${repsLabel} reps${firstWeight ? ` • ${firstWeight}kg` : ""}`
          : "Sin series configuradas",
      };
    },
  );
  const muscleFilters = Array.from(new Set(previewExercises.map((exercise) => exercise.muscle)));
  const detailExercises = previewExercises.filter(
    (exercise) => input.muscleFilter === "all" || exercise.muscle === input.muscleFilter,
  );
  const localOnlyExercises = input.exercisesRepo.length === 0 ? [] : (() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; muscle: string }> = [];
    for (const template of input.templates) {
      for (const exercise of template.exercises) {
        const name = exercise.name?.trim();
        if (!name) continue;
        if (exercise.catalog_link?.status === "linked"
          || resolveRepoExercise(input.exercisesRepo, name, exercise.catalog_link)) continue;
        const key = exerciseCatalogMatchKey(name);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ name, muscle: exercise.muscle?.trim() || "" });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  })();
  const activeHistory = !activeTemplate ? [] : [...input.workoutHistory]
    .filter((summary) => summary.template_id === activeTemplate.id)
    .sort((a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime());
  const completedHistory = activeHistory.filter(isCompletedWorkoutSummary);
  const cutoff = resolveTrainingStatsPeriodStart(input.statsPeriod);
  const filteredHistory = cutoff === null
    ? completedHistory
    : completedHistory.filter((summary) => new Date(summary.finished_at).getTime() >= cutoff);
  const recentHistory = sortWorkoutHistoryDesc(activeHistory);
  const historyEntries = input.showAllHistory ? recentHistory : recentHistory.slice(0, 4);
  const selectedHistorySummary = input.selectedHistoryId
    ? input.workoutHistory.find((summary) => summary.id === input.selectedHistoryId) ?? null
    : null;
  const selectedHistoryRecalculation: WorkoutSummaryRecalculation = selectedHistorySummary
    ? recalculateWorkoutSessionSummary(selectedHistorySummary)
    : { status: "unavailable" };
  const selectedHistoryTemplate = selectedHistorySummary
    ? input.templates.find((template) => template.id === selectedHistorySummary.template_id) ?? null
    : null;
  const detailedSummaries = filteredHistory.filter((summary) => summary.effort_breakdown !== null);
  const effortBreakdown = detailedSummaries.reduce<WorkoutEffortBreakdown>(
    (total, summary) => ({
      completed_primary: total.completed_primary + (summary.effort_breakdown?.completed_primary ?? 0),
      completed_sub_series: total.completed_sub_series + (summary.effort_breakdown?.completed_sub_series ?? 0),
      total_primary: total.total_primary + (summary.effort_breakdown?.total_primary ?? 0),
      total_sub_series: total.total_sub_series + (summary.effort_breakdown?.total_sub_series ?? 0),
    }),
    { completed_primary: 0, completed_sub_series: 0, total_primary: 0, total_sub_series: 0 },
  );
  const chartPoints = filteredHistory.map((summary) => {
    const metricValue = input.statsMetric === "volume"
      ? summary.total_volume_kg
      : input.statsMetric === "reps"
        ? summary.total_reps
        : Math.round((summary.elapsed_seconds / 60) * 10) / 10;
    return {
      id: summary.id,
      label: formatTrainingStatsHistoryLabel(summary.finished_at),
      metricValue,
      metricValueLabel: formatTrainingStatsMetricValue(input.statsMetric, metricValue),
    };
  });
  const maxChartValue = chartPoints.reduce((maximum, point) => Math.max(maximum, point.metricValue), 0);

  return {
    activeTemplate,
    draftDirty,
    draftValidation,
    category,
    categoryMeta,
    icon,
    durationMinutes,
    seriesTotal,
    previewExercises,
    muscleFilters,
    detailExercises,
    localOnlyExercises,
    previewImageUri: previewExercises.find((exercise) => exercise.imageUri)?.imageUri ?? null,
    estimatedCalories: activeTemplate ? estimateTemplateCalories(activeTemplate) : 0,
    summary: muscleFilters.length === 0
      ? "Configura los ejercicios y prepara tu próxima sesión."
      : `Trabaja ${formatSpanishList(muscleFilters.slice(0, 3).map((muscle) => muscle.toLowerCase()))} con una sesión estructurada y lista para empezar.`,
    statsMetricMeta: TRAINING_STATS_METRIC_OPTIONS.find((option) => option.key === input.statsMetric)
      ?? TRAINING_STATS_METRIC_OPTIONS[0],
    activeHistory,
    completedHistory,
    filteredHistory,
    historyEntries,
    canExpandHistory: activeHistory.length > 4,
    globalHistory: sortWorkoutHistoryDesc(input.workoutHistory),
    selectedHistorySummary,
    selectedHistoryRecalculation,
    selectedHistoryTemplate,
    legacySummaryCount: filteredHistory.filter((summary) => summary.calculation_version === 1).length,
    effortDetail: { detailedCount: detailedSummaries.length, breakdown: effortBreakdown },
    chartBars: chartPoints.map((point, index) => ({
      ...point,
      isLatest: index === chartPoints.length - 1,
      heightPercent: maxChartValue > 0
        ? Math.max(10, (point.metricValue / maxChartValue) * 100)
        : 10,
    })),
  };
}
