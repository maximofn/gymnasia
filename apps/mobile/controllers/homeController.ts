import { useCallback, useMemo, useRef } from "react";

import { findByCatalogRef, matchExerciseCatalog } from "../catalogs/matching";
import {
  EXERCISE_CATALOG_IMAGE_BASE_URL,
  exerciseCatalogImageUri,
} from "../catalogs/sources";
import type { ExerciseCatalogEntry } from "../catalogs/types";
import { formatMeasurementNumber } from "../measurements/presentationModel";
import {
  formatHomeExerciseVolume,
  inferExerciseMuscle,
  inferTemplateDurationMinutes,
  normalizeExerciseImageUri,
  normalizeTemplateIcon,
  resolveExercisePreviewMeta,
  trainingCategoryMeta,
} from "../training/presentationModel";
import {
  buildHomeWeekProgress,
  calculateWorkoutStreak,
  type HomeWeekProgressDay,
  type WorkoutSessionSummary,
} from "../training/workoutHistory";
import {
  resolveTrainingCategory,
  templateHasRunnableSeries,
  type WorkoutSession,
} from "../training/workoutSessionModel";
import type {
  RoutineIconName,
  WorkoutTemplate,
} from "../training/workoutTemplateOperations";
import type { ScreenController } from "./types";

export type HomeExerciseModel = {
  id: string;
  exerciseName: string;
  imageUri: string | null;
  volumeLabel: string;
  previewMeta: {
    backgroundColor: string;
    accentColor: string;
    label: string;
    icon: RoutineIconName;
  };
};

export type HomeScreenModel = {
  featuredTemplateName: string | null;
  featuredCategoryMeta: ReturnType<typeof trainingCategoryMeta> | null;
  featuredIcon: RoutineIconName | null;
  featuredDurationMinutes: number;
  featuredExercises: readonly HomeExerciseModel[];
  featuredHeroImageUri: string | null;
  primaryActionLabel: string;
  caloriesConsumed: number;
  caloriesTarget: number;
  latestWeightKg: number | null;
  weightChangeText: string;
  workoutStreak: number;
  weekProgress: readonly HomeWeekProgressDay[];
  weekCompletedCount: number;
};

export type HomeScreenActions = {
  openTraining(): void;
  runPrimaryTrainingAction(): void;
};

type HomeControllerInput = {
  templates: readonly WorkoutTemplate[];
  workoutHistory: readonly WorkoutSessionSummary[];
  activeWorkoutSession: WorkoutSession | null;
  exercisesRepo: ExerciseCatalogEntry[];
  todayCaloriesConsumed: number;
  dietDailyCaloriesTarget: number;
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  openTraining(): void;
  startTrainingSession(templateId: string): void;
};

function resolveRepoExercise(
  repo: ExerciseCatalogEntry[],
  template: WorkoutTemplate["exercises"][number],
): ExerciseCatalogEntry | null {
  if (template.catalog_link?.status === "linked") {
    return findByCatalogRef(repo, template.catalog_link.ref);
  }
  const match = matchExerciseCatalog(repo, template.name);
  return match.kind === "exact" || match.kind === "alias" ? match.candidate : null;
}

export function useHomeController({
  templates,
  workoutHistory,
  activeWorkoutSession,
  exercisesRepo,
  todayCaloriesConsumed,
  dietDailyCaloriesTarget,
  latestWeightKg,
  previousWeightKg,
  openTraining,
  startTrainingSession,
}: HomeControllerInput): ScreenController<HomeScreenModel, HomeScreenActions> {
  const actionTargetsRef = useRef({ openTraining, startTrainingSession });
  actionTargetsRef.current = { openTraining, startTrainingSession };
  const featuredTemplate = useMemo(() => {
    if (activeWorkoutSession) {
      const activeTemplate = templates.find(
        (template) => template.id === activeWorkoutSession.template_id,
      ) ?? null;
      if (activeTemplate) return activeTemplate;
    }
    return templates.find(templateHasRunnableSeries) ?? templates[0] ?? null;
  }, [activeWorkoutSession, templates]);
  const featuredCategory = useMemo(
    () => (featuredTemplate ? resolveTrainingCategory(featuredTemplate) : null),
    [featuredTemplate],
  );
  const featuredExercises = useMemo<HomeExerciseModel[]>(() => {
    if (!featuredTemplate || !featuredCategory) return [];
    return featuredTemplate.exercises.slice(0, 3).map((exercise, exerciseIndex) => {
      const exerciseName = exercise.name?.trim() || `Ejercicio ${exerciseIndex + 1}`;
      const repoMatch = resolveRepoExercise(exercisesRepo, exercise);
      const muscle = exercise.muscle?.trim()
        || repoMatch?.muscle_group
        || inferExerciseMuscle(exerciseName, featuredCategory);
      const storedImage = normalizeExerciseImageUri(exercise.image_uri);
      const repoImageUri = repoMatch ? exerciseCatalogImageUri(repoMatch, "male") : null;
      const isStoredRepoImage = !!storedImage
        && storedImage.startsWith(EXERCISE_CATALOG_IMAGE_BASE_URL);
      return {
        id: exercise.id,
        exerciseName,
        imageUri: (!storedImage || isStoredRepoImage) && repoImageUri
          ? repoImageUri
          : storedImage,
        volumeLabel: formatHomeExerciseVolume(exercise.series ?? []),
        previewMeta: resolveExercisePreviewMeta(exerciseName, muscle, featuredCategory),
      };
    });
  }, [exercisesRepo, featuredCategory, featuredTemplate]);

  const model = useMemo<HomeScreenModel>(() => {
    let weightChangeText = "Sin histórico";
    if (latestWeightKg !== null && previousWeightKg !== null) {
      const delta = Math.round((latestWeightKg - previousWeightKg) * 10) / 10;
      weightChangeText = Math.abs(delta) < 0.05
        ? "Sin cambios"
        : `${delta > 0 ? "+" : "-"}${formatMeasurementNumber(Math.abs(delta))} kg`;
    }
    const weekProgress = buildHomeWeekProgress(workoutHistory);
    const featuredDurationMinutes = featuredTemplate
      ? inferTemplateDurationMinutes(featuredTemplate)
      : 0;
    const featuredIcon = featuredTemplate && featuredCategory
      ? normalizeTemplateIcon(
          featuredTemplate.icon,
          featuredCategory,
          Math.max(0, templates.findIndex((template) => template.id === featuredTemplate.id)),
        )
      : null;
    return {
      featuredTemplateName: featuredTemplate?.name ?? null,
      featuredCategoryMeta: featuredCategory ? trainingCategoryMeta(featuredCategory) : null,
      featuredIcon,
      featuredDurationMinutes,
      featuredExercises,
      featuredHeroImageUri: featuredExercises.find((exercise) => exercise.imageUri)?.imageUri ?? null,
      primaryActionLabel: activeWorkoutSession
        ? "Continuar entrenamiento"
        : featuredTemplate && templateHasRunnableSeries(featuredTemplate)
          ? "Iniciar entrenamiento"
          : "Crear rutina",
      caloriesConsumed: todayCaloriesConsumed,
      caloriesTarget: dietDailyCaloriesTarget,
      latestWeightKg,
      weightChangeText,
      workoutStreak: calculateWorkoutStreak(workoutHistory),
      weekProgress,
      weekCompletedCount: weekProgress.filter((day) => day.completed).length,
    };
  }, [
    activeWorkoutSession,
    dietDailyCaloriesTarget,
    featuredCategory,
    featuredExercises,
    featuredTemplate,
    latestWeightKg,
    previousWeightKg,
    templates,
    todayCaloriesConsumed,
    workoutHistory,
  ]);

  const primaryTargetRef = useRef({ activeWorkoutSession, featuredTemplate });
  primaryTargetRef.current = { activeWorkoutSession, featuredTemplate };
  const openTrainingAction = useCallback(() => {
    actionTargetsRef.current.openTraining();
  }, []);
  const runPrimaryTrainingAction = useCallback(() => {
    const target = primaryTargetRef.current;
    if (target.activeWorkoutSession) {
      actionTargetsRef.current.openTraining();
      return;
    }
    if (target.featuredTemplate && templateHasRunnableSeries(target.featuredTemplate)) {
      actionTargetsRef.current.startTrainingSession(target.featuredTemplate.id);
      return;
    }
    actionTargetsRef.current.openTraining();
  }, []);
  const actions = useMemo<HomeScreenActions>(
    () => ({ openTraining: openTrainingAction, runPrimaryTrainingAction }),
    [openTrainingAction, runPrimaryTrainingAction],
  );
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
