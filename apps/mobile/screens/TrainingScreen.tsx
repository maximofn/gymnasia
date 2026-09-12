import { Feather, Ionicons } from "@expo/vector-icons";
import { memo, useRef } from "react";
import { Animated, Image, PanResponder, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type {
  TrainingDetailActions,
  TrainingDetailModel,
  TrainingEditorActions,
  TrainingEditorModel,
  TrainingHistoryActions,
  TrainingHistoryModel,
  TrainingListActions,
  TrainingListModel,
  TrainingFilter,
} from "../controllers/trainingController";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { isCompoundSeriesType, type ExerciseSeries } from "../training/seriesContract";
import { SERIES_TYPE_META } from "../training/seriesPresentation";
import { isCompletedWorkoutSummary, type WorkoutSessionSummary, type WorkoutSummaryRecalculation } from "../training/workoutHistory";
import { ROUTINE_ICON_OPTIONS, formatClock, formatPrescriptionNumber, formatTrainingHistoryDate, formatWorkoutHistoryVolume, inferExerciseMuscle, inferTemplateDurationMinutes, normalizeExerciseImageUri, normalizeTemplateIcon, trainingCategoryMeta, workoutPrescriptionSeriesDetail, type TrainingStatsMetricKey, type TrainingStatsPeriodKey } from "../training/presentationModel";
import { resolveTrainingCategory, templateHasRunnableSeries } from "../training/workoutSessionModel";
import type { TrainingCategory } from "../training/workoutTemplateOperations";
import { mobileTheme } from "../theme";

export const TrainingHistoryScreen = memo(function TrainingHistoryScreen({ model, actions }: { model: Readonly<TrainingHistoryModel>; actions: Readonly<TrainingHistoryActions> }) {
  if (model.selectedSummary) {
    return <WorkoutHistoryDetail summary={model.selectedSummary} recalculation={model.selectedRecalculation} hasCurrentTemplate={model.selectedHasCurrentTemplate} onBack={actions.closeHistory} onOpenTemplate={actions.openCurrentTemplate} />;
  }
  return (
    <View testID={shellSurfaceTestId("training-history")} style={{ gap: 18, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={actions.closeHistory} testID="training-global-history-back" accessibilityRole="button" accessibilityLabel="Volver a mis rutinas" style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: mobileTheme.color.bgSurface, alignItems: "center", justifyContent: "center" }}>
          <Feather name="arrow-left" size={18} color={mobileTheme.color.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "800" }}>Historial</Text>
          <Text style={{ color: "#8B94A3", fontSize: 12, lineHeight: 17 }}>{model.history.length === 0 ? "Tus sesiones guardadas aparecerán aquí." : `${model.history.length} ${model.history.length === 1 ? "sesión guardada" : "sesiones guardadas"}`}</Text>
        </View>
      </View>
      {model.history.length === 0 ? (
        <View style={{ minHeight: 320, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, gap: 12 }}>
          <View style={{ width: 62, height: 62, borderRadius: 18, backgroundColor: "rgba(203,255,26,0.1)", alignItems: "center", justifyContent: "center" }}><Feather name="clock" size={25} color={mobileTheme.color.brandPrimary} /></View>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Aún no hay entrenamientos</Text>
          <Text style={{ color: "#8B94A3", fontSize: 14, lineHeight: 20, textAlign: "center" }}>Completa una rutina o guarda una sesión parcial para consultar aquí exactamente lo que hiciste.</Text>
        </View>
      ) : <View style={{ gap: 10 }}>{model.history.map((summary) => <WorkoutHistoryEntryCard key={summary.id} summary={summary} onPress={() => actions.openHistory(summary.id)} showTemplateName testID={`training-global-history-${summary.id}`} />)}</View>}
    </View>
  );
});

export function WorkoutHistoryEntryCard({ summary, onPress, showTemplateName, testID }: { summary: WorkoutSessionSummary; onPress(): void; showTemplateName: boolean; testID: string }) {
  const completed = isCompletedWorkoutSummary(summary);
  const statusColor = completed ? mobileTheme.color.brandPrimary : "#F5C542";
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={`Abrir ${summary.template_name}, ${formatTrainingHistoryDate(summary.finished_at)}`} style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", backgroundColor: mobileTheme.color.bgSurface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: showTemplateName ? 3 : 0 }}>
          {showTemplateName ? <Text numberOfLines={1} style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "800" }}>{summary.template_name}</Text> : null}
          <Text style={{ color: showTemplateName ? "#8B94A3" : mobileTheme.color.textPrimary, fontSize: showTemplateName ? 12 : 15, fontWeight: "700" }}>{formatTrainingHistoryDate(summary.finished_at)}</Text>
        </View>
        <View testID={`training-history-status-${summary.id}`} style={{ minHeight: 28, borderRadius: mobileTheme.radius.pill, borderWidth: 1, borderColor: completed ? "rgba(203,255,26,0.34)" : "rgba(245,197,66,0.34)", backgroundColor: completed ? "rgba(203,255,26,0.1)" : "rgba(245,197,66,0.1)", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}><Text style={{ color: statusColor, fontSize: 12, fontWeight: "800" }}>{completed ? "Completo" : "Parcial"}</Text></View>
        <Feather name="chevron-right" size={17} color="#697383" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Feather name="check-circle" size={14} color={statusColor} /><Text style={{ color: "#A6AFBC", fontSize: 13, fontWeight: "600" }}>{summary.completed_effort_count}/{summary.total_effort_count} esfuerzos</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Feather name="clock" size={14} color="#8B94A3" /><Text style={{ color: "#A6AFBC", fontSize: 13, fontWeight: "600" }}>{formatClock(summary.elapsed_seconds)}</Text></View>
      </View>
    </Pressable>
  );
}

function WorkoutHistoryDetail({ summary, recalculation, hasCurrentTemplate, onBack, onOpenTemplate }: { summary: WorkoutSessionSummary; recalculation: WorkoutSummaryRecalculation; hasCurrentTemplate: boolean; onBack(): void; onOpenTemplate(): void }) {
  const completed = isCompletedWorkoutSummary(summary);
  const snapshot = summary.prescription_snapshot;
  return (
    <View testID={shellSurfaceTestId("workout-history-detail")} style={{ gap: 18, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBack} testID="training-history-detail-back" accessibilityRole="button" accessibilityLabel="Volver al historial" style={{ width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: mobileTheme.color.bgSurface, alignItems: "center", justifyContent: "center" }}><Feather name="arrow-left" size={18} color={mobileTheme.color.textPrimary} /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "700" }}>{formatTrainingHistoryDate(summary.finished_at)}</Text><Text numberOfLines={1} style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>{summary.template_name}</Text></View>
        <View style={{ minHeight: 30, borderRadius: mobileTheme.radius.pill, backgroundColor: completed ? "rgba(203,255,26,0.12)" : "rgba(245,197,66,0.12)", paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }}><Text style={{ color: completed ? mobileTheme.color.brandPrimary : "#F5C542", fontSize: 12, fontWeight: "800" }}>{completed ? "Completo" : "Parcial"}</Text></View>
      </View>
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#151A22", overflow: "hidden" }}>
        {[["Duración", formatClock(summary.elapsed_seconds)], ["Esfuerzos", `${summary.completed_effort_count}/${summary.total_effort_count}`], ["Repeticiones", `${summary.total_reps}`], ["Volumen", formatWorkoutHistoryVolume(summary.total_volume_kg)], ["Calorías estimadas", `${summary.estimated_calories} kcal`]].map(([label, value], index) => <View key={label} style={{ minHeight: 45, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: "rgba(255,255,255,0.05)" }}><Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "600" }}>{label}</Text><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "800" }}>{value}</Text></View>)}
      </View>
      <RecalculationNotice summary={summary} recalculation={recalculation} />
      <View style={{ gap: 9 }}><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>Rutina de aquella sesión</Text>{hasCurrentTemplate ? <Pressable onPress={onOpenTemplate} testID="training-history-open-template" style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "800" }}>Ver rutina actual</Text></Pressable> : <View testID="training-history-template-deleted" style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Feather name="archive" size={14} color="#8B94A3" /><Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "700" }}>Rutina eliminada</Text></View>}</View>
      {snapshot ? <View testID="training-history-prescription" style={{ gap: 12 }}>{snapshot.exercises.map((exercise, exerciseIndex) => <View key={`${exercise.name}-${exerciseIndex}`} style={{ borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: mobileTheme.color.bgSurface, overflow: "hidden" }}><View style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(203,255,26,0.045)" }}><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "800" }}>{exercise.name}</Text></View>{exercise.series.map((series, seriesIndex) => <View key={`${exerciseIndex}-${seriesIndex}`} style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 7, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: series.completed ? mobileTheme.color.brandPrimary : "#252C37", alignItems: "center", justifyContent: "center" }}><Feather name={series.completed ? "check" : "minus"} size={13} color={series.completed ? "#06090D" : "#8B94A3"} /></View><Text style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "800" }}>Serie {seriesIndex + 1} · {SERIES_TYPE_META[series.type].label}</Text></View><Text style={{ marginLeft: 33, color: "#9DA7B5", fontSize: 12, lineHeight: 18 }}>{workoutPrescriptionSeriesDetail(series)}</Text>{series.sub_series.length > 0 ? <View style={{ marginLeft: 33, borderLeftWidth: 2, borderLeftColor: "rgba(203,255,26,0.24)", paddingLeft: 10, gap: 8 }}>{series.sub_series.map((subSeries, subSeriesIndex) => <View key={`${exerciseIndex}-${seriesIndex}-${subSeriesIndex}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}><Feather name={subSeries.completed ? "check-circle" : "circle"} size={14} color={subSeries.completed ? mobileTheme.color.brandPrimary : "#697383"} style={{ marginTop: 2 }} /><View style={{ flex: 1, gap: 2 }}><Text style={{ color: "#D5DBE4", fontSize: 12, fontWeight: "700" }}>{subSeries.exercise_name || `Mini-serie ${subSeriesIndex + 1}`}</Text><Text style={{ color: "#818B99", fontSize: 11, lineHeight: 16 }}>{formatPrescriptionNumber(subSeries.reps, "reps")} · {formatPrescriptionNumber(subSeries.weight_kg, "kg")} · {subSeries.rest_seconds === null ? "pausa —" : `pausa ${formatClock(subSeries.rest_seconds)}`}</Text></View></View>)}</View> : null}</View>)}</View>)}</View> : null}
    </View>
  );
}

function RecalculationNotice({ summary, recalculation }: { summary: WorkoutSessionSummary; recalculation: WorkoutSummaryRecalculation }) {
  if (recalculation.status === "match") return <View testID="training-history-recalculation-status" style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(203,255,26,0.26)", backgroundColor: "rgba(203,255,26,0.07)", padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }}><Feather name="check-circle" size={17} color={mobileTheme.color.brandPrimary} /><View style={{ flex: 1, gap: 2 }}><Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "800" }}>Cálculo verificado</Text><Text style={{ color: "#A6AFBC", fontSize: 12, lineHeight: 17 }}>La prescripción guardada reproduce los totales originales.</Text></View></View>;
  if (recalculation.status === "mismatch") return <View testID="training-history-recalculation-status" accessibilityRole="alert" style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,197,66,0.32)", backgroundColor: "rgba(245,197,66,0.08)", padding: 12, gap: 7 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="alert-triangle" size={16} color="#F5C542" /><Text style={{ color: "#F5C542", fontSize: 13, fontWeight: "800" }}>El cálculo actual no coincide</Text></View><Text style={{ color: "#D5C889", fontSize: 12, lineHeight: 18 }}>Conservamos como referencia los totales guardados al terminar la sesión.</Text><Text testID="training-history-stored-totals" style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>Guardado: {summary.total_reps} reps · {formatWorkoutHistoryVolume(summary.total_volume_kg)}</Text><Text testID="training-history-recalculated-totals" style={{ color: "#C0A94F", fontSize: 12, fontWeight: "700" }}>Cálculo actual: {recalculation.recalculated.totalReps} reps · {formatWorkoutHistoryVolume(recalculation.recalculated.totalVolumeKg)}</Text></View>;
  return <View testID="training-history-legacy-message" style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.025)", padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 9 }}><Feather name="info" size={16} color="#8B94A3" style={{ marginTop: 1 }} /><Text style={{ flex: 1, color: "#A6AFBC", fontSize: 12, lineHeight: 18 }}>Esta sesión se guardó antes de conservar la prescripción. Sus totales originales siguen disponibles, pero no se puede reconstruir el detalle ni verificarlos.</Text></View>;
}

export const TrainingDetailScreen = memo(function TrainingDetailScreen({
  model,
  actions,
}: {
  model: Readonly<TrainingDetailModel>;
  actions: Readonly<TrainingDetailActions>;
}) {
  const {
    template: activeTrainingTemplate,
    previewImageUri: activeTrainingPreviewImageUri,
    categoryMeta: activeTrainingCategoryMeta,
    icon: activeTrainingIcon,
    summary: activeTrainingSummary,
    statsMetricMeta: activeTrainingStatsMetricMeta,
    statsMetric: trainingStatsMetric,
    statsPeriod: trainingStatsPeriod,
    metricDropdownOpen: trainingStatsMetricDropdownOpen,
    periodDropdownOpen: trainingStatsPeriodDropdownOpen,
    chartBars: activeTrainingChartBars,
    completedHistoryCount: activeTrainingCompletedHistoryCount,
    historyCount: activeTrainingHistoryCount,
    filteredHistoryCount: activeTrainingFilteredHistoryCount,
    effortDetail: activeTrainingEffortDetail,
    legacySummaryCount: activeTrainingLegacySummaryCount,
    canExpandHistory: canExpandTrainingHistory,
    showAllHistory: showAllTrainingHistory,
    historyEntries: activeTrainingHistoryEntries,
    durationMinutes: activeTrainingDurationMinutes,
    estimatedCalories: activeTrainingEstimatedCalories,
    muscleFilters: activeTrainingMuscleFilters,
    muscleFilter: trainingDetailMuscleFilter,
    detailExercises: activeTrainingDetailExercises,
  } = model;
  if (!activeTrainingTemplate) return null;
  return (
                <View style={{ gap: 16, paddingBottom: 110 }}>
                  <View
                    style={{
                      height: 228,
                      borderRadius: 26,
                      overflow: "hidden",
                      backgroundColor: "#0F141B",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {activeTrainingPreviewImageUri ? (
                      <Image
                        source={{ uri: activeTrainingPreviewImageUri }}
                        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bottom: 0,
                          left: 0,
                          backgroundColor: "#10161F",
                          justifyContent: "flex-end",
                          padding: 20,
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: 26,
                            right: 24,
                            width: 84,
                            height: 84,
                            borderRadius: 999,
                            backgroundColor:
                              activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.12)",
                          }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            top: 58,
                            left: 24,
                            width: 120,
                            height: 120,
                            borderRadius: 30,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.05)",
                            backgroundColor: "rgba(255,255,255,0.03)",
                            transform: [{ rotate: "-12deg" }],
                          }}
                        />
                        <View
                          style={{
                            width: 82,
                            height: 82,
                            borderRadius: 24,
                            backgroundColor:
                              activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.12)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather
                            name={activeTrainingIcon ?? "activity"}
                            size={34}
                            color={activeTrainingCategoryMeta?.color ?? mobileTheme.color.brandPrimary}
                          />
                        </View>
                      </View>
                    )}
  
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        backgroundColor: activeTrainingPreviewImageUri
                          ? "rgba(6,9,13,0.42)"
                          : "rgba(6,9,13,0.18)",
                      }}
                    />
  
                    <View
                      style={{
                        position: "absolute",
                        top: 14,
                        left: 14,
                        right: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Pressable
                        onPress={actions.close}
                        testID="training-detail-back"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          backgroundColor: "rgba(8,11,16,0.48)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name="arrow-left" size={18} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        onPress={actions.edit}
                        testID="training-detail-edit"
                        style={{
                          minHeight: 40,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          backgroundColor: "rgba(8,11,16,0.48)",
                          paddingHorizontal: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Feather name="edit-2" size={14} color="#FFFFFF" />
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                          {"Editar\nrutina"}
                        </Text>
                      </Pressable>
                    </View>
  
                    <View
                      style={{
                        position: "absolute",
                        left: 16,
                        right: 16,
                        bottom: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor:
                            activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.14)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather
                          name={activeTrainingIcon ?? "activity"}
                          size={18}
                          color={activeTrainingCategoryMeta?.color ?? mobileTheme.color.brandPrimary}
                        />
                      </View>
                      <View
                        style={{
                          minHeight: 34,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.12)",
                          backgroundColor: "rgba(8,11,16,0.46)",
                          paddingHorizontal: 12,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                          {activeTrainingCategoryMeta?.label ?? "Rutina"}
                        </Text>
                      </View>
                    </View>
                  </View>
  
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 34, fontWeight: "700" }}>
                      {activeTrainingTemplate.name}
                    </Text>
                    <Text style={{ color: "#8B94A3", fontSize: 16, lineHeight: 22 }}>
                      {activeTrainingSummary}
                    </Text>
                  </View>
  
                  <TrainingPrimaryButton
                    label="Empezar rutina"
                    onPress={actions.start}
                    disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                    icon={<Feather name="play" size={14} color="#06090D" />}
                  />
  
                  <TrainingChartCard
                    zIndex={trainingStatsMetricDropdownOpen || trainingStatsPeriodDropdownOpen ? 10 : 1}
                    title={
                      <Pressable
                        onPress={actions.toggleMetricDropdown}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "800" }}>
                          {activeTrainingStatsMetricMeta.label}
                        </Text>
                        <Ionicons
                          name={trainingStatsMetricDropdownOpen ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={mobileTheme.color.textSecondary}
                        />
                      </Pressable>
                    }
                    periodSelector={
                      <Pressable
                        onPress={actions.togglePeriodDropdown}
                        style={{
                          minHeight: 34,
                          borderRadius: mobileTheme.radius.pill,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.06)",
                          backgroundColor: "#1B2029",
                          paddingHorizontal: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: "#9EA6B3", fontSize: 12, fontWeight: "700" }}>
                          {TRAINING_STATS_PERIOD_OPTIONS.find((o) => o.key === trainingStatsPeriod)?.label ?? "3M"}
                        </Text>
                        <Ionicons
                          name={trainingStatsPeriodDropdownOpen ? "chevron-up" : "chevron-down"}
                          size={14}
                          color="#6F7785"
                        />
                      </Pressable>
                    }
                  >
                    {trainingStatsPeriodDropdownOpen ? (
                      <View
                        testID={shellSurfaceTestId("training-period-dropdown")}
                        style={{ position: "absolute", top: 56, right: 14, zIndex: 20, elevation: 12 }}
                      >
                        <View
                          style={{
                            minWidth: 128,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.06)",
                            backgroundColor: "#1B2029",
                            shadowColor: "#000000",
                            shadowOpacity: 0.28,
                            shadowRadius: 14,
                            shadowOffset: { width: 0, height: 8 },
                            padding: 6,
                            gap: 4,
                          }}
                        >
                          {TRAINING_STATS_PERIOD_OPTIONS.map((option) => {
                            const isActive = trainingStatsPeriod === option.key;
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => { actions.selectPeriod(option.key); actions.closePeriodDropdown(); }}
                                style={{
                                  minHeight: 34,
                                  borderRadius: 10,
                                  paddingHorizontal: 10,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  backgroundColor: isActive ? "rgba(203,255,26,0.12)" : "transparent",
                                }}
                              >
                                <Text style={{ color: isActive ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                                  {option.label}
                                </Text>
                                {isActive ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
  
                    {trainingStatsMetricDropdownOpen ? (
                      <View
                        testID={shellSurfaceTestId("training-metric-dropdown")}
                        style={{ position: "absolute", top: 56, left: 14, zIndex: 20, elevation: 12 }}
                      >
                        <View
                          style={{
                            minWidth: 150,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.06)",
                            backgroundColor: "#1B2029",
                            shadowColor: "#000000",
                            shadowOpacity: 0.28,
                            shadowRadius: 14,
                            shadowOffset: { width: 0, height: 8 },
                            padding: 6,
                            gap: 4,
                          }}
                        >
                          {TRAINING_STATS_METRIC_OPTIONS.map((option) => {
                            const isActive = trainingStatsMetric === option.key;
                            return (
                              <Pressable
                                key={option.key}
                                onPress={() => { actions.selectMetric(option.key); actions.closeMetricDropdown(); }}
                                style={{
                                  minHeight: 34,
                                  borderRadius: 10,
                                  paddingHorizontal: 10,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  backgroundColor: isActive ? "rgba(203,255,26,0.12)" : "transparent",
                                }}
                              >
                                <Text style={{ color: isActive ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                                  {option.label}
                                </Text>
                                {isActive ? <Ionicons name="checkmark" size={14} color={mobileTheme.color.brandPrimary} /> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
  
                    <View
                      style={{
                        minHeight: 196,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.04)",
                        backgroundColor: "#121720",
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      {activeTrainingChartBars.length === 0 ? (
                        <View
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: "#8B94A3",
                              fontSize: 14,
                              textAlign: "center",
                              lineHeight: 20,
                            }}
                          >
                            {activeTrainingCompletedHistoryCount > 0
                              ? "No hay sesiones completadas de esta rutina en el periodo seleccionado."
                              : activeTrainingHistoryCount > 0
                                ? "Todavía no hay sesiones completadas para mostrar estadísticas."
                                : "Todavía no hay ejecuciones guardadas de esta rutina."}
                          </Text>
                        </View>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{
                            gap: 12,
                            alignItems: "flex-end",
                            paddingRight: 10,
                            minHeight: 172,
                          }}
                        >
                          {activeTrainingChartBars.map((bar) => (
                            <View
                              key={bar.id}
                              style={{
                                width: 42,
                                alignItems: "center",
                                justifyContent: "flex-end",
                              }}
                            >
                              <Text
                                style={{
                                  color: bar.isLatest ? mobileTheme.color.brandPrimary : "#8B94A3",
                                  fontSize: 10,
                                  fontWeight: "700",
                                  textAlign: "center",
                                  minHeight: 28,
                                }}
                                numberOfLines={2}
                              >
                                {bar.metricValueLabel}
                              </Text>
                              <View
                                style={{
                                  marginTop: 6,
                                  width: "100%",
                                  height: 108,
                                  justifyContent: "flex-end",
                                  alignItems: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: 18,
                                    height: `${bar.heightPercent}%`,
                                    minHeight: 10,
                                    borderRadius: 999,
                                    backgroundColor: bar.isLatest
                                      ? mobileTheme.color.brandPrimary
                                      : "rgba(203,255,26,0.38)",
                                  }}
                                />
                              </View>
                              <Text
                                style={{
                                  marginTop: 8,
                                  color: "#8B94A3",
                                  fontSize: 10,
                                  fontWeight: bar.isLatest ? "700" : "500",
                                  textAlign: "center",
                                }}
                                numberOfLines={1}
                              >
                                {bar.label}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      )}
                    </View>
  
                    {activeTrainingEffortDetail.detailedCount > 0 ? (
                      <View
                        testID="training-stats-effort-breakdown"
                        style={{
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(203,255,26,0.18)",
                          backgroundColor: "rgba(203,255,26,0.06)",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          gap: 3,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "800" }}>
                          Desglose de esfuerzos completados
                        </Text>
                        <Text style={{ color: "#D7DEE8", fontSize: 13, lineHeight: 18 }}>
                          {activeTrainingEffortDetail.breakdown.completed_primary} principales ·{" "}
                          {activeTrainingEffortDetail.breakdown.completed_sub_series} mini-series
                        </Text>
                        {activeTrainingEffortDetail.detailedCount < activeTrainingFilteredHistoryCount ? (
                          <Text style={{ color: "#8B94A3", fontSize: 11, lineHeight: 16 }}>
                            Desglose disponible para {activeTrainingEffortDetail.detailedCount} de{" "}
                            {activeTrainingFilteredHistoryCount} entrenamientos.
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
  
                    {activeTrainingLegacySummaryCount > 0 ? (
                      <View
                        testID="training-stats-legacy-warning"
                        style={{
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(245,197,66,0.28)",
                          backgroundColor: "rgba(245,197,66,0.08)",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <Feather name="info" size={14} color="#F5C542" style={{ marginTop: 2 }} />
                        <Text style={{ flex: 1, color: "#D5C889", fontSize: 12, lineHeight: 18 }}>
                          Algunos entrenamientos se calcularon antes de incluir las mini-series. Conservamos sus totales originales porque no hay detalle suficiente para recalcularlos.
                        </Text>
                      </View>
                    ) : null}
  
                  </TrainingChartCard>
  
                  <View testID="training-history" style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
                        Historial reciente
                      </Text>
                      {canExpandTrainingHistory ? (
                        <Pressable
                          testID={shellSurfaceTestId("training-history-expanded")}
                          onPress={actions.toggleAllHistory}
                        >
                          <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "800" }}>
                            {showAllTrainingHistory ? "Ver menos" : "Ver todo"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
  
                    {activeTrainingHistoryEntries.length === 0 ? (
                      <View
                        style={{
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.04)",
                          backgroundColor: mobileTheme.color.bgSurface,
                          padding: 14,
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
                          Todavía no hay sesiones
                        </Text>
                        <Text style={{ color: "#8B94A3", fontSize: 13, lineHeight: 18 }}>
                          Las sesiones completadas y las que guardes como parciales aparecerán aquí.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {activeTrainingHistoryEntries.map((summary) => (
                          <WorkoutHistoryEntryCard
                            key={summary.id}
                            summary={summary}
                            onPress={() => actions.openHistory(summary.id)}
                            showTemplateName={false}
                            testID={`training-history-${summary.id}`}
                          />
                        ))}
                      </View>
                    )}
                  </View>
  
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <View
                      style={{
                        minHeight: 44,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        backgroundColor: "#171B23",
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="clock" size={14} color={mobileTheme.color.brandPrimary} />
                      <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                        {activeTrainingDurationMinutes > 0 ? `${activeTrainingDurationMinutes} min` : "-- min"}
                      </Text>
                    </View>
                    <View
                      style={{
                        minHeight: 44,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        backgroundColor: "#171B23",
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="repeat" size={14} color={mobileTheme.color.brandPrimary} />
                      <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                        {activeTrainingTemplate.exercises.length} ejercicios
                      </Text>
                    </View>
                    <View
                      style={{
                        minHeight: 44,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                        backgroundColor: "#171B23",
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="zap" size={14} color={mobileTheme.color.brandPrimary} />
                      <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>
                        ~{activeTrainingEstimatedCalories} kcal
                      </Text>
                    </View>
                  </View>
  
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                  >
                    <Pressable
                      onPress={() => actions.selectMuscle("all")}
                      style={{
                        minHeight: 38,
                        borderRadius: mobileTheme.radius.pill,
                        borderWidth: 1,
                        borderColor:
                          trainingDetailMuscleFilter === "all"
                            ? "rgba(203,255,26,0.82)"
                            : mobileTheme.color.borderSubtle,
                        backgroundColor:
                          trainingDetailMuscleFilter === "all"
                            ? "rgba(160,204,0,0.12)"
                            : "#0D1117",
                        paddingHorizontal: 16,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            trainingDetailMuscleFilter === "all"
                              ? mobileTheme.color.brandPrimary
                              : "#9EA6B3",
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        Todas
                      </Text>
                    </Pressable>
                    {activeTrainingMuscleFilters.map((muscle) => {
                      const isActive = trainingDetailMuscleFilter === muscle;
                      return (
                        <Pressable
                          key={muscle}
                          onPress={() => actions.selectMuscle(muscle)}
                          style={{
                            minHeight: 38,
                            borderRadius: mobileTheme.radius.pill,
                            borderWidth: 1,
                            borderColor: isActive
                              ? "rgba(203,255,26,0.82)"
                              : mobileTheme.color.borderSubtle,
                            backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                            paddingHorizontal: 16,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          >
                            {muscle}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
  
                  <View style={{ gap: 10 }}>
                    {activeTrainingDetailExercises.length === 0 ? (
                      <View
                        style={{
                          minHeight: 140,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: mobileTheme.color.borderSubtle,
                          backgroundColor: "#171B23",
                          alignItems: "center",
                          justifyContent: "center",
                          paddingHorizontal: 18,
                        }}
                      >
                        <Text style={{ color: "#8B94A3", fontSize: 16, textAlign: "center", lineHeight: 22 }}>
                          No hay ejercicios para este grupo muscular en la rutina.
                        </Text>
                      </View>
                    ) : (
                      activeTrainingDetailExercises.map((exercise, cardIndex) => (
                        <Pressable
                          key={exercise.exercise.id}
                          onPress={() => actions.openExercise(cardIndex)}
                          style={{
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.06)",
                            backgroundColor: "#171B23",
                            borderRadius: 20,
                            padding: 12,
                            gap: 8,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <View
                              style={{
                                width: 58,
                                height: 58,
                                borderRadius: 16,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                                backgroundColor: exercise.previewMeta.backgroundColor,
                                flexShrink: 0,
                              }}
                            >
                              {exercise.imageUri ? (
                                <Image
                                  source={{ uri: exercise.imageUri }}
                                  style={{ width: "100%", height: "100%" }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View
                                  style={{
                                    flex: 1,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                    paddingHorizontal: 4,
                                  }}
                                >
                                  <Feather
                                    name={exercise.previewMeta.icon}
                                    size={18}
                                    color={exercise.previewMeta.accentColor}
                                  />
                                  <Text
                                    style={{
                                      color: "#E8EDF5",
                                      fontSize: 9,
                                      fontWeight: "700",
                                      textAlign: "center",
                                    }}
                                    numberOfLines={1}
                                  >
                                    {exercise.previewMeta.label}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "700" }}
                                numberOfLines={2}
                              >
                                {exercise.exerciseName}
                              </Text>
                              <Text style={{ color: "#8B94A3", fontSize: 13, marginTop: 2 }}>
                                {exercise.volumeLabel}
                              </Text>
                            </View>
                            <Feather name="chevron-right" size={18} color="#636B78" />
                          </View>
                          {exercise.seriesItems.length > 0 && (
                            <View style={{ gap: 0 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  paddingVertical: 4,
                                  borderBottomWidth: 1,
                                  borderBottomColor: "rgba(255,255,255,0.06)",
                                }}
                              >
                                <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", width: 40, textAlign: "center" }}>Serie</Text>
                                <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Reps</Text>
                                <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Peso</Text>
                                <Text style={{ color: "#636B78", fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" }}>Descanso</Text>
                              </View>
                              {exercise.seriesItems.map((s: ExerciseSeries, sIdx: number) => (
                                <View
                                  key={s.id}
                                  style={{
                                    flexDirection: "row",
                                    paddingVertical: 4,
                                    borderBottomWidth: sIdx < exercise.seriesItems.length - 1 ? 1 : 0,
                                    borderBottomColor: "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700", width: 40, textAlign: "center" }}>
                                    {sIdx + 1}
                                  </Text>
                                  <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                    {s.reps.trim() || "--"}
                                  </Text>
                                  <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                    {s.weight_kg.trim() ? `${s.weight_kg.trim()} kg` : "--"}
                                  </Text>
                                  <Text style={{ color: "#8B94A3", fontSize: 12, flex: 1, textAlign: "center" }}>
                                    {s.rest_seconds.trim() ? `${s.rest_seconds.trim()}s` : "--"}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </Pressable>
                      ))
                    )}
                  </View>
  
                  <TrainingPrimaryButton
                    label="Empezar rutina"
                    onPress={actions.start}
                    disabled={!templateHasRunnableSeries(activeTrainingTemplate)}
                    icon={<Feather name="play" size={14} color="#06090D" />}
                    testID="training-detail-start-session"
                  />
                </View>
  
  );
});

const TRAINING_STATS_PERIOD_OPTIONS: Array<{ key: TrainingStatsPeriodKey; label: string }> = [
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "1 año" },
  { key: "all", label: "Todo" },
];

const TRAINING_STATS_METRIC_OPTIONS: Array<{
  key: TrainingStatsMetricKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "volume", label: "Volumen", shortLabel: "kg" },
  { key: "reps", label: "Repeticiones", shortLabel: "reps" },
  { key: "duration", label: "Duración", shortLabel: "min" },
];

function TrainingChartCard({
  title,
  periodSelector,
  children,
  zIndex,
}: {
  title: React.ReactNode;
  periodSelector: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
}) {
  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: mobileTheme.color.bgSurface, position: "relative", overflow: "visible", zIndex: zIndex ?? 1, padding: 14, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, zIndex: 2 }}>
        <View style={{ flex: 1, gap: 4 }}>{title}</View>
        {periodSelector}
      </View>
      {children}
    </View>
  );
}

function TrainingPrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  testID,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} testID={testID} accessibilityLabel={label} accessibilityRole="button" style={{ height: 46, borderRadius: 12, backgroundColor: mobileTheme.color.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: icon ? 10 : 0, opacity: disabled ? 0.6 : 1 }}>
      {icon}
      <Text style={{ color: "#06090D", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export const TrainingEditorScreen = memo(function TrainingEditorScreen({
  model,
  actions,
}: {
  model: Readonly<TrainingEditorModel>;
  actions: Readonly<TrainingEditorActions>;
}) {
  const {
    template: activeTrainingTemplate,
    category: activeTrainingCategory,
    categoryMeta: activeTrainingCategoryMeta,
    icon: activeTrainingIcon,
    durationMinutes: activeTrainingDurationMinutes,
    seriesTotal: activeTrainingSeriesTotal,
    draftDirty: trainingTemplateDraftDirty,
    draftValidation: trainingTemplateDraftValidation,
    saveBusy: trainingTemplateSaveBusy,
    activeExerciseMenuId,
    activeSeriesMenuId,
    expandedCompoundSeriesId,
  } = model;
  if (!activeTrainingTemplate) return null;
  return (
                <View style={{ gap: 12, paddingBottom: 110 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Pressable
                      onPress={actions.requestClose}
                      testID="training-editor-cancel"
                      style={{
                        minHeight: 36,
                        paddingHorizontal: 2,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "600" }}>
                        Cancelar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={actions.save}
                      disabled={trainingTemplateSaveBusy}
                      style={{
                        minHeight: 46,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(203,255,26,0.75)",
                        backgroundColor: trainingTemplateDraftValidation?.valid
                          ? mobileTheme.color.brandPrimary
                          : "#303641",
                        paddingHorizontal: 18,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Feather name="check" size={14} color={trainingTemplateDraftValidation?.valid ? "#06090D" : "#8B94A3"} />
                      <Text style={{ color: trainingTemplateDraftValidation?.valid ? "#06090D" : "#8B94A3", fontSize: 16, fontWeight: "800" }}>
                        {trainingTemplateSaveBusy ? "Guardando…" : "Guardar"}
                      </Text>
                    </Pressable>
                  </View>
  
                  {trainingTemplateDraftDirty ? (
                    <View
                      testID="training-editor-dirty-banner"
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(203,255,26,0.28)",
                        backgroundColor: "rgba(203,255,26,0.08)",
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                      }}
                    >
                      <Text style={{ color: "#DDFE70", fontSize: 13, fontWeight: "700" }}>
                        Cambios sin guardar. La rutina original sigue intacta.
                      </Text>
                    </View>
                  ) : null}
  
                  <TextInput
                    testID="training-editor-name"
                    value={activeTrainingTemplate.name}
                    onChangeText={actions.updateName}
                    placeholder="Nombre de rutina"
                    placeholderTextColor="#7D8798"
                    style={{
                      marginTop: 4,
                      color: mobileTheme.color.textPrimary,
                      fontSize: 28,
                      fontWeight: "700",
                      minHeight: 42,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255,255,255,0.12)",
                      paddingBottom: 6,
                    }}
                  />
  
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {activeTrainingIcon ? (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: activeTrainingCategoryMeta?.iconBg ?? "rgba(203,255,26,0.2)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Feather name={activeTrainingIcon} size={16} color={mobileTheme.color.brandPrimary} />
                      </View>
                    ) : null}
                    {activeTrainingCategoryMeta ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            backgroundColor: activeTrainingCategoryMeta.color,
                          }}
                        />
                        <Text
                          style={{
                            color: activeTrainingCategoryMeta.color,
                            fontSize: 17,
                            fontWeight: "700",
                          }}
                        >
                          {activeTrainingCategoryMeta.label}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={{ color: "#8B94A3", fontSize: 15 }}>
                      {activeTrainingTemplate.exercises.length} ejercicios
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TextInput
                        value={activeTrainingTemplate.duration_minutes ?? ""}
                        onChangeText={actions.updateDuration}
                        placeholder={activeTrainingDurationMinutes > 0 ? `${activeTrainingDurationMinutes}` : "min"}
                        placeholderTextColor="#8B94A3"
                        keyboardType="number-pad"
                        style={{
                          minWidth: 44,
                          minHeight: 30,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          paddingHorizontal: 10,
                          color: mobileTheme.color.textPrimary,
                          fontSize: 15,
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      />
                      <Text style={{ color: "#8B94A3", fontSize: 15 }}>min</Text>
                    </View>
                    <Text style={{ color: "#8B94A3", fontSize: 15 }}>
                      {activeTrainingSeriesTotal} series
                    </Text>
                  </View>
  
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {TRAINING_CATEGORY_EDIT_OPTIONS.map((option) => {
                      const isActive = activeTrainingCategory === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => actions.updateCategory(option.key)}
                          style={{
                            minHeight: 38,
                            borderRadius: mobileTheme.radius.pill,
                            borderWidth: 1,
                            borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                            backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                            paddingHorizontal: 14,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
  
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: "#8B94A3", fontSize: 13, fontWeight: "700" }}>Icono de la rutina</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                      testID="training-icon-picker"
                    >
                      {ROUTINE_ICON_OPTIONS.map((iconName) => {
                        const isActive = activeTrainingIcon === iconName;
                        return (
                          <Pressable
                            key={iconName}
                            onPress={() => actions.updateIcon(iconName)}
                            testID={`training-icon-option-${iconName}`}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                              backgroundColor: isActive ? "rgba(160,204,0,0.14)" : "#0D1117",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Feather
                              name={iconName}
                              size={16}
                              color={isActive ? mobileTheme.color.brandPrimary : "#96A0B0"}
                            />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
  
                  <TrainingPrimaryButton
                    label={trainingTemplateDraftDirty ? "Guarda para empezar" : "Empezar rutina"}
                    onPress={actions.start}
                    disabled={trainingTemplateDraftDirty || !templateHasRunnableSeries(activeTrainingTemplate)}
                    icon={<Feather name="play" size={14} color="#06090D" />}
                    testID="training-editor-start-session"
                  />
  
                  <Pressable
                    onPress={actions.openExercisePicker}
                    testID="training-editor-add-exercise"
                    style={{
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(203,255,26,0.75)",
                      backgroundColor: "transparent",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <Feather name="plus" size={14} color={mobileTheme.color.brandPrimary} />
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 16, fontWeight: "800" }}>
                      Agregar ejercicio
                    </Text>
                  </Pressable>
  
                  {activeTrainingTemplate.exercises.length === 0 ? (
                    <View
                      style={{
                        minHeight: 140,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: mobileTheme.color.borderSubtle,
                        backgroundColor: "#171B23",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 18,
                      }}
                    >
                      <Text style={{ color: "#8B94A3", fontSize: 22, textAlign: "center", lineHeight: 28 }}>
                        Esta rutina aún no tiene ejercicios.
                      </Text>
                      <Text style={{ color: "#8B94A3", fontSize: 22, textAlign: "center", lineHeight: 28 }}>
                        Pulsa en "Agregar ejercicio" para empezar.
                      </Text>
                    </View>
                  ) : (
                    activeTrainingTemplate.exercises.map((exercise, index) => {
                    const isMenuOpen = activeExerciseMenuId === exercise.id;
                    const exerciseSeries = exercise.series ?? [];
                    const firstWeight = exerciseSeries.find((seriesItem) => seriesItem.weight_kg.trim())
                      ?.weight_kg;
                    const exerciseMuscle = exercise.muscle?.trim()
                      ? exercise.muscle
                      : inferExerciseMuscle(exercise.name ?? "", activeTrainingCategory ?? "strength");
                    return (
                      <View
                        key={exercise.id}
                        style={{
                          position: "relative",
                          zIndex: isMenuOpen ? 120 : 1,
                          elevation: isMenuOpen ? 20 : 0,
                        }}
                      >
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: mobileTheme.color.borderSubtle,
                            backgroundColor: "#171B23",
                            borderRadius: 20,
                            paddingHorizontal: 12,
                            paddingTop: 12,
                            paddingBottom: 10,
                            gap: 10,
                            overflow: "visible",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{ width: 8, alignItems: "center", gap: 3 }}>
                              {Array.from({ length: 6 }).map((_, dotIndex) => (
                                <View
                                  key={`${exercise.id}_drag_${dotIndex}`}
                                  style={{
                                    width: 2,
                                    height: 2,
                                    borderRadius: 999,
                                    backgroundColor: "#6F7786",
                                  }}
                                />
                              ))}
                            </View>
                            <View
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                backgroundColor: mobileTheme.color.brandPrimary,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: "#06090D", fontSize: 14, fontWeight: "800" }}>
                                {index + 1}
                              </Text>
                            </View>
                            {exercise.image_uri ? (
                              <Image
                                source={{ uri: normalizeExerciseImageUri(exercise.image_uri) ?? undefined }}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: "rgba(255,255,255,0.08)",
                                }}
                                resizeMode="cover"
                              />
                            ) : null}
                            <View style={{ flex: 1, gap: 1 }}>
                              <TextInput
                                value={exercise.name ?? ""}
                                onChangeText={(value) => actions.updateExerciseName(exercise.id, value)}
                                placeholder={`Ejercicio ${index + 1}`}
                                placeholderTextColor="#8B94A3"
                                multiline
                                style={{
                                  color: mobileTheme.color.textPrimary,
                                  fontSize: 18,
                                  fontWeight: "700",
                                  minHeight: 30,
                                  paddingVertical: 0,
                                  textAlignVertical: "center",
                                }}
                              />
                              <Text style={{ color: "#8B94A3", fontSize: 13 }}>
                                {exerciseMuscle} • {exerciseSeries.length} series
                                {firstWeight ? ` • ${firstWeight} kg` : ""}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => actions.toggleExerciseMenu(exercise.id)}
                              testID={`training-exercise-menu-${exercise.id}`}
                              style={{
                                width: 28,
                                height: 28,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <View style={{ alignItems: "center", gap: 3 }}>
                                {Array.from({ length: 3 }).map((_, dotIndex) => (
                                  <View
                                    key={`${exercise.id}_menu_${dotIndex}`}
                                    style={{
                                      width: 3,
                                      height: 3,
                                      borderRadius: 999,
                                      backgroundColor: "#98A2B3",
                                    }}
                                  />
                                ))}
                              </View>
                            </Pressable>
                          </View>
  
                          <View style={{ gap: 0 }}>
                              <View
                                style={{
                                  minHeight: 28,
                                  borderRadius: 8,
                                  backgroundColor: "#202630",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  paddingHorizontal: 10,
                                  gap: 6,
                                }}
                              >
                                <Text
                                  style={{
                                    width: 24,
                                    color: "#7D8798",
                                    fontSize: 11,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  #
                                </Text>
                                <Text
                                  style={{
                                    width: 32,
                                    color: "#7D8798",
                                    fontSize: 10,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  Tipo
                                </Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    color: "#7D8798",
                                    fontSize: 10,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  Repeticiones
                                </Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    color: "#7D8798",
                                    fontSize: 10,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  Peso (kg)
                                </Text>
                                <Text
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    color: "#7D8798",
                                    fontSize: 10,
                                    fontWeight: "700",
                                    textAlign: "center",
                                  }}
                                >
                                  Fin bloque
                                </Text>
                                <View style={{ width: 16 }} />
                              </View>
  
                              {exerciseSeries.map((seriesItem, setIndex) => {
                                const canDelete = exerciseSeries.length > 1;
                                const seriesMenuKey = `${exercise.id}:${seriesItem.id}`;
                                const isSeriesMenuOpen = activeSeriesMenuId === seriesMenuKey;
                                const handleDelete = () => {
                                  if (!canDelete) return;
                                  actions.deleteSeries(exercise.id, seriesItem.id);
                                };
                                return (
                                  <View key={seriesItem.id} style={{ position: "relative", zIndex: isSeriesMenuOpen ? 100 : 0 }}>
                                  <SwipeableSetRow
                                    onDelete={handleDelete}
                                    enabled={canDelete}
                                  >
                                  <View
                                    style={{
                                      minHeight: 36,
                                      borderBottomWidth:
                                        setIndex === exerciseSeries.length - 1 ? 0 : 1,
                                      borderBottomColor: "rgba(255,255,255,0.08)",
                                      flexDirection: "row",
                                      alignItems: "center",
                                      paddingHorizontal: 10,
                                      backgroundColor: (seriesItem.type ?? "normal") === "warmup" ? "rgba(255,74,74,0.06)" : "transparent",
                                      gap: 6,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        width: 24,
                                        color: "#8C95A4",
                                        fontSize: 13,
                                        fontWeight: "700",
                                        textAlign: "center",
                                      }}
                                    >
                                      {setIndex + 1}
                                    </Text>
                                    <Pressable
                                      onPress={() => actions.openSeriesTypePicker(exercise.id, seriesItem.id)}
                                      testID={`training-editor-series-type-${exercise.id}-${seriesItem.id}`}
                                      style={{
                                        width: 32,
                                        height: 24,
                                        borderRadius: 6,
                                        backgroundColor: (seriesItem.type ?? "normal") === "warmup" ? "rgba(255,74,74,0.2)" : "#202630",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Text style={{
                                        color: (seriesItem.type ?? "normal") === "warmup" ? "#FF4A4A" : "#8C95A4",
                                        fontSize: 10,
                                        fontWeight: "700",
                                      }}>
                                        {SERIES_TYPE_META[seriesItem.type ?? "normal"].short}
                                      </Text>
                                    </Pressable>
                                    {(seriesItem.type ?? "normal") === "tempo" ? (
                                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 1 }}>
                                        <TextInput
                                          value={seriesItem.tempo_contraction ?? ""}
                                          onChangeText={(v) => actions.updateSeriesField(exercise.id, seriesItem.id, "tempo_contraction", v)}
                                          placeholder="C"
                                          placeholderTextColor="#8C95A4"
                                          keyboardType="number-pad"
                                          style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                        />
                                        <Text style={{ color: "#7D8798", fontSize: 10 }}>-</Text>
                                        <TextInput
                                          value={seriesItem.tempo_pause ?? ""}
                                          onChangeText={(v) => actions.updateSeriesField(exercise.id, seriesItem.id, "tempo_pause", v)}
                                          placeholder="P"
                                          placeholderTextColor="#8C95A4"
                                          keyboardType="number-pad"
                                          style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                        />
                                        <Text style={{ color: "#7D8798", fontSize: 10 }}>-</Text>
                                        <TextInput
                                          value={seriesItem.tempo_relaxation ?? ""}
                                          onChangeText={(v) => actions.updateSeriesField(exercise.id, seriesItem.id, "tempo_relaxation", v)}
                                          placeholder="R"
                                          placeholderTextColor="#8C95A4"
                                          keyboardType="number-pad"
                                          style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "700", textAlign: "center", paddingVertical: 0, paddingHorizontal: 0 }}
                                        />
                                      </View>
                                    ) : (
                                      <TextInput
                                        value={seriesItem.reps}
                                        onChangeText={(value) =>
                                          actions.updateSeriesField(
                                            exercise.id,
                                            seriesItem.id,
                                            "reps",
                                            value,
                                          )
                                        }
                                        placeholder={(seriesItem.type ?? "normal") === "isometric" ? "(s)" : "-"}
                                        placeholderTextColor="#8C95A4"
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          color: mobileTheme.color.textPrimary,
                                          fontSize: 13,
                                          fontWeight: "700",
                                          paddingVertical: 0,
                                          paddingHorizontal: 0,
                                          textAlign: "center",
                                        }}
                                      />
                                    )}
                                    <TextInput
                                      value={seriesItem.weight_kg}
                                      onChangeText={(value) =>
                                        actions.updateSeriesField(
                                          exercise.id,
                                          seriesItem.id,
                                          "weight_kg",
                                          value,
                                        )
                                      }
                                      placeholder="-"
                                      placeholderTextColor="#8C95A4"
                                      keyboardType="numbers-and-punctuation"
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: mobileTheme.color.textPrimary,
                                        fontSize: 13,
                                        fontWeight: "600",
                                        paddingVertical: 0,
                                        paddingHorizontal: 0,
                                        textAlign: "center",
                                      }}
                                    />
                                    <TextInput
                                      value={seriesItem.rest_seconds}
                                      onChangeText={(value) =>
                                        actions.updateSeriesField(
                                          exercise.id,
                                          seriesItem.id,
                                          "rest_seconds",
                                          value,
                                        )
                                      }
                                      placeholder="-"
                                      placeholderTextColor="#8C95A4"
                                      keyboardType="number-pad"
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        color: "#8C95A4",
                                        fontSize: 13,
                                        fontWeight: "600",
                                        paddingVertical: 0,
                                        paddingHorizontal: 0,
                                        textAlign: "center",
                                      }}
                                    />
                                    <Pressable
                                      onPress={() => actions.toggleSeriesMenu(seriesMenuKey)}
                                      testID={`training-editor-series-menu-${exercise.id}-${seriesItem.id}`}
                                      hitSlop={8}
                                      style={{ width: 16, alignItems: "center", justifyContent: "center", gap: 2 }}
                                    >
                                      {Array.from({ length: 3 }).map((_, rowIndex) => (
                                        <View
                                          key={`${seriesItem.id}_drag_row_${rowIndex}`}
                                          style={{ flexDirection: "row", gap: 2 }}
                                        >
                                          <View
                                            style={{
                                              width: 3,
                                              height: 3,
                                              borderRadius: 999,
                                              backgroundColor: "#7D8798",
                                            }}
                                          />
                                          <View
                                            style={{
                                              width: 3,
                                              height: 3,
                                              borderRadius: 999,
                                              backgroundColor: "#7D8798",
                                            }}
                                          />
                                        </View>
                                      ))}
                                    </Pressable>
                                  </View>
                                  </SwipeableSetRow>
                                  {isSeriesMenuOpen && (
                                    <View
                                      testID={shellSurfaceTestId("training-series-menu")}
                                      style={{
                                        position: "absolute",
                                        top: 36,
                                        right: 4,
                                        width: 190,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.1)",
                                        backgroundColor: "rgba(12,14,19,0.98)",
                                        paddingVertical: 8,
                                        zIndex: 240,
                                        elevation: 24,
                                        shadowColor: "#000",
                                        shadowOpacity: 0.36,
                                        shadowRadius: 10,
                                        shadowOffset: { width: 0, height: 6 },
                                      }}
                                    >
                                      <Pressable
                                        onPress={() => {
                                          actions.closeSeriesMenu();
                                          actions.duplicateSeries(exercise.id, seriesItem.id);
                                        }}
                                        testID={`training-editor-series-duplicate-${exercise.id}-${seriesItem.id}`}
                                        style={{
                                          minHeight: 40,
                                          paddingHorizontal: 12,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 10,
                                        }}
                                      >
                                        <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                                        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16 }}>
                                          Duplicar serie
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={handleDelete}
                                        style={{
                                          minHeight: 40,
                                          borderTopWidth: 1,
                                          borderTopColor: "rgba(255,255,255,0.2)",
                                          marginTop: 4,
                                          paddingTop: 8,
                                          paddingHorizontal: 12,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 10,
                                          opacity: canDelete ? 1 : 0.35,
                                        }}
                                        disabled={!canDelete}
                                      >
                                        <Feather name="trash-2" size={14} color="#FF4A4A" />
                                        <Text style={{ color: "#FF4A4A", fontSize: 16, fontWeight: "600" }}>
                                          Eliminar serie
                                        </Text>
                                      </Pressable>
                                    </View>
                                  )}
                                  {isCompoundSeriesType(seriesItem.type ?? "normal") && (
                                    <View style={{ marginLeft: 24, borderLeftWidth: 2, borderLeftColor: "#2A3240", paddingLeft: 8, paddingVertical: 4 }}>
                                      <Pressable
                                        onPress={() => actions.toggleCompoundSeries(seriesItem.id)}
                                        style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                                      >
                                        <Feather
                                          name={expandedCompoundSeriesId === seriesItem.id ? "chevron-down" : "chevron-right"}
                                          size={12}
                                          color="#7D8798"
                                        />
                                        <Text style={{ color: "#7D8798", fontSize: 11, fontWeight: "600" }}>
                                          {(seriesItem.sub_series ?? []).length} mini-series · pausa antes
                                        </Text>
                                      </Pressable>
                                      {expandedCompoundSeriesId === seriesItem.id && (
                                        <>
                                          {(seriesItem.sub_series ?? []).map((sub, subIdx) => (
                                            <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 30, gap: 4, paddingRight: 4 }}>
                                              <Text style={{ width: 18, color: "#7D8798", fontSize: 10, textAlign: "center" }}>
                                                {subIdx + 1}
                                              </Text>
                                              {(seriesItem.type ?? "normal") === "superset" && (
                                                <Pressable
                                                  onPress={() => actions.openSupersetPicker(exercise.id, seriesItem.id, sub.id)}
                                                  style={{ flex: 1, minHeight: 26, borderRadius: 6, backgroundColor: "#202630", justifyContent: "center", paddingHorizontal: 6 }}
                                                >
                                                  <Text style={{ color: sub.exercise_name ? "#C7CED9" : "#7D8798", fontSize: 11 }} numberOfLines={1}>
                                                    {sub.exercise_name || "Ejercicio..."}
                                                  </Text>
                                                </Pressable>
                                              )}
                                              <TextInput
                                                value={sub.reps}
                                                onChangeText={(v) => actions.updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "reps", v)}
                                                placeholder="reps"
                                                placeholderTextColor="#7D8798"
                                                keyboardType="number-pad"
                                                style={{ flex: 1, color: "#C7CED9", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                              />
                                              <TextInput
                                                value={sub.weight_kg}
                                                onChangeText={(v) => actions.updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "weight_kg", v)}
                                                placeholder="kg"
                                                placeholderTextColor="#7D8798"
                                                keyboardType="numbers-and-punctuation"
                                                style={{ flex: 1, color: "#C7CED9", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                              />
                                              {(seriesItem.type ?? "normal") !== "dropset" && (
                                                <TextInput
                                                  value={sub.rest_seconds}
                                                  onChangeText={(v) => actions.updateSubSeriesField(exercise.id, seriesItem.id, sub.id, "rest_seconds", v)}
                                                  placeholder="Pausa"
                                                  placeholderTextColor="#7D8798"
                                                  keyboardType="number-pad"
                                                  style={{ flex: 1, color: "#8C95A4", fontSize: 12, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
                                                />
                                              )}
                                              {(seriesItem.sub_series ?? []).length > 1 && (
                                                <Pressable
                                                  onPress={() => actions.removeSubSeries(exercise.id, seriesItem.id, sub.id)}
                                                  hitSlop={6}
                                                >
                                                  <Feather name="x" size={12} color="#7D8798" />
                                                </Pressable>
                                              )}
                                            </View>
                                          ))}
                                          <Pressable
                                            onPress={() => actions.addSubSeries(exercise.id, seriesItem.id)}
                                            style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                                          >
                                            <Feather name="plus" size={11} color="#7D8798" />
                                            <Text style={{ color: "#7D8798", fontSize: 11, fontWeight: "600" }}>Mini-serie</Text>
                                          </Pressable>
                                        </>
                                      )}
                                    </View>
                                  )}
                                  </View>
                                );
                              })}
  
                              <Pressable
                                onPress={() => actions.addSeries(exercise.id)}
                                testID={`training-editor-series-add-${exercise.id}`}
                                style={{
                                  marginTop: 6,
                                  minHeight: 36,
                                  borderRadius: 14,
                                  borderWidth: 1,
                                  borderColor: "rgba(255,255,255,0.08)",
                                  backgroundColor: "#171B23",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                }}
                              >
                                <Feather name="plus" size={13} color="#7F8896" />
                                <Text style={{ color: "#7F8896", fontSize: 14, fontWeight: "700" }}>
                                  Añadir serie
                                </Text>
                              </Pressable>
                            </View>
                        </View>
  
                        {isMenuOpen ? (
                          <View
                            testID={shellSurfaceTestId("training-exercise-menu")}
                            style={{
                              position: "absolute",
                              top: 56,
                              right: 12,
                              width: 216,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: "rgba(255,255,255,0.1)",
                              backgroundColor: "rgba(12,14,19,0.98)",
                              paddingVertical: 8,
                              zIndex: 240,
                              elevation: 24,
                              shadowColor: "#000",
                              shadowOpacity: 0.36,
                              shadowRadius: 10,
                              shadowOffset: { width: 0, height: 6 },
                            }}
                          >
                            <Pressable
                              onPress={() => actions.editExercise(exercise.id)}
                              testID={`training-exercise-edit-${exercise.id}`}
                              style={{
                                minHeight: 40,
                                paddingHorizontal: 12,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Feather name="edit-2" size={14} color={mobileTheme.color.textSecondary} />
                              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                                Editar ejercicio
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => actions.cloneExercise(exercise.id)}
                              testID={`training-exercise-clone-${exercise.id}`}
                              style={{
                                minHeight: 40,
                                paddingHorizontal: 12,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                                Clonar ejercicio
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => actions.moveExercise(exercise.id)}
                              testID={`training-exercise-move-${exercise.id}`}
                              style={{
                                minHeight: 40,
                                paddingHorizontal: 12,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Feather name="move" size={14} color={mobileTheme.color.textSecondary} />
                              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18 }}>
                                Mover posición
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => actions.deleteExercise(exercise.id)}
                              testID={`training-exercise-delete-${exercise.id}`}
                              style={{
                                minHeight: 40,
                                borderTopWidth: 1,
                                borderTopColor: "rgba(255,255,255,0.2)",
                                marginTop: 6,
                                paddingTop: 10,
                                paddingHorizontal: 12,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <Feather name="trash-2" size={14} color="#FF4A4A" />
                              <Text style={{ color: "#FF4A4A", fontSize: 18, fontWeight: "600" }}>
                                Eliminar ejercicio
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  }))} 
  
                  <Pressable
                    onPress={actions.openExercisePicker}
                    testID="training-editor-add-exercise-bottom"
                    style={{
                      marginTop: 6,
                      minHeight: 54,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: "rgba(203,255,26,0.75)",
                      backgroundColor: "rgba(203,255,26,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 25, fontWeight: "800" }}>
                      + Agregar ejercicio
                    </Text>
                  </Pressable>
  
                  <Pressable
                    onPress={actions.save}
                    disabled={trainingTemplateSaveBusy}
                    testID="training-editor-save"
                    style={{
                      marginTop: 6,
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: "rgba(203,255,26,0.75)",
                      backgroundColor: trainingTemplateDraftValidation?.valid
                        ? mobileTheme.color.brandPrimary
                        : "#303641",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Feather name="check" size={14} color={trainingTemplateDraftValidation?.valid ? "#06090D" : "#8B94A3"} />
                    <Text style={{ color: trainingTemplateDraftValidation?.valid ? "#06090D" : "#8B94A3", fontSize: 16, fontWeight: "800" }}>
                      {trainingTemplateSaveBusy ? "Guardando…" : "Guardar cambios"}
                    </Text>
                  </Pressable>
                </View>
  
  );
});

const TRAINING_CATEGORY_EDIT_OPTIONS: Array<{ key: TrainingCategory; label: string }> = [
  { key: "strength", label: "Fuerza" },
  { key: "hypertrophy", label: "Hipertrofia" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Flexibilidad" },
];

function SwipeableSetRow({
  children,
  onDelete,
  enabled,
}: {
  children: React.ReactNode;
  onDelete(): void;
  enabled: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteThreshold = -80;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        enabled && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < deleteThreshold) {
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(onDelete);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;
  return (
    <View style={{ overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#E53935", justifyContent: "center", alignItems: "center" }}>
        <Feather name="trash-2" size={18} color="#fff" />
      </View>
      <Animated.View style={{ transform: [{ translateX }], backgroundColor: "#171B23" }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export const TrainingListScreen = memo(function TrainingListScreen({
  model,
  actions,
}: {
  model: Readonly<TrainingListModel>;
  actions: Readonly<TrainingListActions>;
}) {
  return (
                <View style={{ gap: 14 }}>
                  {model.lastWorkoutSummary ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: "rgba(203,255,26,0.35)",
                        backgroundColor: "#171B23",
                        borderRadius: 16,
                        padding: 12,
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "800" }}>
                        Último entrenamiento completado
                      </Text>
                      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17, fontWeight: "700" }}>
                        {model.lastWorkoutSummary.template_name}
                      </Text>
                      <Text style={{ color: "#8B94A3", fontSize: 13 }}>
                        {model.lastWorkoutSummary.completed_effort_count}/
                        {model.lastWorkoutSummary.total_effort_count} esfuerzos ·{" "}
                        {formatClock(model.lastWorkoutSummary.elapsed_seconds)}
                      </Text>
                      <Pressable
                        onPress={() => actions.closeLastWorkoutSummary()}
                        style={{
                          marginTop: 4,
                          minHeight: 32,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.14)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#D7DEE8", fontSize: 13, fontWeight: "700" }}>
                          Cerrar resumen
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
  
                  <View
                    style={{
                      minHeight: 48,
                      borderRadius: mobileTheme.radius.pill,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      backgroundColor: "#12151C",
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 14,
                    }}
                  >
                    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
                      <View
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 999,
                          borderWidth: 1.8,
                          borderColor: mobileTheme.color.textSecondary,
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          right: 0.5,
                          bottom: 2,
                          width: 6,
                          height: 1.8,
                          borderRadius: 999,
                          backgroundColor: mobileTheme.color.textSecondary,
                          transform: [{ rotate: "45deg" }],
                        }}
                      />
                    </View>
                    <TextInput
                      style={{
                        flex: 1,
                        marginLeft: 8,
                        color: mobileTheme.color.textPrimary,
                        paddingVertical: 0,
                      }}
                      value={model.search}
                      onChangeText={actions.updateSearch}
                      placeholder="Buscar rutinas..."
                      placeholderTextColor="#717985"
                    />
                  </View>
  
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {TRAINING_FILTER_OPTIONS.map((option) => {
                      const isActive = model.filter === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => actions.updateFilter(option.key)}
                          style={{
                            height: 38,
                            borderRadius: mobileTheme.radius.pill,
                            borderWidth: 1,
                            borderColor: isActive ? "rgba(203,255,26,0.85)" : mobileTheme.color.borderSubtle,
                            backgroundColor: isActive ? "rgba(160,204,0,0.12)" : "#0D1117",
                            paddingHorizontal: 16,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: isActive ? mobileTheme.color.brandPrimary : "#9EA6B3",
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
  
                  {model.templates.length === 0 ? (
                    <View
                      style={{
                        minHeight: 430,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 18,
                        paddingTop: 16,
                      }}
                    >
                      <View
                        style={{
                          width: 74,
                          height: 74,
                          borderRadius: 22,
                          backgroundColor: "rgba(133,170,6,0.24)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View style={{ width: 32, gap: 5 }}>
                          {[0, 1, 2].map((row) => (
                            <View
                              key={row}
                              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                            >
                              <View
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor: mobileTheme.color.brandPrimary,
                                }}
                              />
                              <View
                                style={{
                                  flex: 1,
                                  height: 3,
                                  borderRadius: 2,
                                  backgroundColor: mobileTheme.color.brandPrimary,
                                }}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                      <Text
                        style={{
                          marginTop: 24,
                          color: mobileTheme.color.textPrimary,
                          fontSize: 32,
                          fontWeight: "700",
                          textAlign: "center",
                        }}
                      >
                        {model.totalTemplateCount === 0 ? "Sin rutinas aún" : "Sin resultados"}
                      </Text>
                      <Text
                        style={{
                          marginTop: 10,
                          color: "#8B94A3",
                          fontSize: 20,
                          textAlign: "center",
                          lineHeight: 26,
                        }}
                      >
                        {model.totalTemplateCount === 0
                          ? "Crea tu primera rutina personalizada\ny empieza a entrenar"
                          : "Prueba con otro texto de búsqueda\no cambia los filtros"}
                      </Text>
  
                      <Pressable
                        onPress={actions.createTemplate}
                        testID="training-create-first"
                        style={{
                          marginTop: 30,
                          minHeight: 58,
                          borderRadius: 16,
                          backgroundColor: mobileTheme.color.brandPrimary,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          paddingHorizontal: 24,
                        }}
                      >
                        <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "700", lineHeight: 24 }}>
                          +
                        </Text>
                        <Text style={{ color: "#06090D", fontSize: 19, fontWeight: "800" }}>
                          CREAR RUTINA
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ gap: 10, paddingBottom: 110 }}>
                      {model.templates.map((tpl, tplIndex) => {
                        const category = resolveTrainingCategory(tpl);
                        const categoryMeta = trainingCategoryMeta(category);
                        const routineIcon = normalizeTemplateIcon(tpl.icon, category, tplIndex);
                        const durationMinutes = inferTemplateDurationMinutes(tpl);
                        const canStartTemplate = templateHasRunnableSeries(tpl);
                        const isMenuOpen = model.menuTemplateId === tpl.id;
                        return (
                          <View
                            key={tpl.id}
                            style={{
                              position: "relative",
                              zIndex: isMenuOpen ? 140 : 1,
                              elevation: isMenuOpen ? 22 : 0,
                            }}
                          >
                            <View
                              style={{
                                borderWidth: 1,
                                borderColor: isMenuOpen
                                  ? "rgba(203,255,26,0.8)"
                                  : mobileTheme.color.borderSubtle,
                                backgroundColor: "#171B23",
                                borderRadius: 18,
                              }}
                            >
                              <Pressable
                                onPress={() => actions.openTemplate(tpl.id)}
                                testID={`training-template-open-${tpl.id}`}
                                style={{
                                  minHeight: 92,
                                  paddingLeft: 14,
                                  paddingRight: 56,
                                  paddingTop: 14,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                <View style={{ width: 10, alignItems: "center", justifyContent: "center", gap: 2 }}>
                                  {Array.from({ length: 3 }).map((_, rowIndex) => (
                                    <View
                                      key={`${tpl.id}_dot_row_${rowIndex}`}
                                      style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
                                    >
                                      <View
                                        style={{
                                          width: 2,
                                          height: 2,
                                          borderRadius: 999,
                                          backgroundColor: "#707887",
                                        }}
                                      />
                                      <View
                                        style={{
                                          width: 2,
                                          height: 2,
                                          borderRadius: 999,
                                          backgroundColor: "#707887",
                                        }}
                                      />
                                    </View>
                                  ))}
                                </View>
                                <View
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: categoryMeta.iconBg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Feather name={routineIcon} size={20} color={mobileTheme.color.brandPrimary} />
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text
                                    style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}
                                    numberOfLines={1}
                                  >
                                    {tpl.name}
                                  </Text>
                                  <View
                                    style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                                  >
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                      <View
                                        style={{
                                          width: 7,
                                          height: 7,
                                          borderRadius: 999,
                                          backgroundColor: categoryMeta.color,
                                        }}
                                      />
                                      <Text style={{ color: categoryMeta.color, fontSize: 12, fontWeight: "700" }}>
                                        {categoryMeta.label}
                                      </Text>
                                    </View>
                                    <Text style={{ color: "#8892A2", fontSize: 12 }}>
                                      {durationMinutes > 0 ? `${durationMinutes} min` : "-- min"}
                                    </Text>
                                    <Text style={{ color: "#8892A2", fontSize: 12 }}>
                                      {tpl.exercises.length} ejercicios
                                    </Text>
                                  </View>
                                </View>
                              </Pressable>
  
                              <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
                                <Pressable
                                  onPress={() => actions.startTemplate(tpl.id)}
                                  disabled={!canStartTemplate}
                                  testID={`training-template-inline-start-${tpl.id}`}
                                  style={{
                                    minHeight: 44,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: canStartTemplate
                                      ? "rgba(203,255,26,0.55)"
                                      : "rgba(255,255,255,0.1)",
                                    backgroundColor: canStartTemplate
                                      ? "rgba(203,255,26,0.1)"
                                      : "rgba(255,255,255,0.04)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: canStartTemplate
                                        ? mobileTheme.color.brandPrimary
                                        : "#7F8896",
                                      fontSize: 16,
                                      fontWeight: "800",
                                    }}
                                  >
                                    Empezar rutina
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
  
                            <Pressable
                              onPress={() => actions.toggleTemplateMenu(tpl.id)}
                              testID={`training-template-menu-${tpl.id}`}
                              style={{
                                position: "absolute",
                                right: 14,
                                top: 14,
                                width: 30,
                                height: 30,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <View style={{ alignItems: "center", gap: 3 }}>
                                {Array.from({ length: 3 }).map((_, dotIndex) => (
                                  <View
                                    key={`${tpl.id}_kebab_${dotIndex}`}
                                    style={{
                                      width: 3,
                                      height: 3,
                                      borderRadius: 999,
                                      backgroundColor: "#98A2B3",
                                    }}
                                  />
                                ))}
                              </View>
                            </Pressable>
  
                            {isMenuOpen ? (
                              <View
                                testID={shellSurfaceTestId("training-template-menu")}
                                style={{
                                  position: "absolute",
                                  top: 56,
                                  right: 10,
                                  width: 192,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: "rgba(255,255,255,0.1)",
                                  backgroundColor: "rgba(12,14,19,0.98)",
                                  paddingVertical: 8,
                                  zIndex: 280,
                                  elevation: 28,
                                  shadowColor: "#000",
                                  shadowOpacity: 0.36,
                                  shadowRadius: 10,
                                  shadowOffset: { width: 0, height: 6 },
                                }}
                              >
                                <Pressable
                                  onPress={() => actions.startTemplate(tpl.id)}
                                  testID={`training-template-start-${tpl.id}`}
                                  style={{
                                    minHeight: 40,
                                    paddingHorizontal: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Feather name="play" size={14} color={mobileTheme.color.brandPrimary} />
                                  <Text
                                    style={{
                                      color: mobileTheme.color.brandPrimary,
                                      fontSize: 17,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Iniciar entrenamiento
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => actions.editTemplate(tpl.id)}
                                  testID={`training-template-edit-${tpl.id}`}
                                  style={{
                                    minHeight: 40,
                                    paddingHorizontal: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Feather name="edit-2" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                    Editar rutina
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => actions.cloneTemplate(tpl.id)}
                                  testID={`training-template-clone-${tpl.id}`}
                                  style={{
                                    minHeight: 40,
                                    paddingHorizontal: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Feather name="copy" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                    Clonar rutina
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => actions.moveTemplate(tpl.id)}
                                  testID={`training-template-move-${tpl.id}`}
                                  style={{
                                    minHeight: 40,
                                    paddingHorizontal: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Feather name="move" size={14} color={mobileTheme.color.textSecondary} />
                                  <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 17 }}>
                                    Mover posición
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => actions.deleteTemplate(tpl.id)}
                                  testID={`training-template-delete-${tpl.id}`}
                                  style={{
                                    minHeight: 40,
                                    borderTopWidth: 1,
                                    borderTopColor: "rgba(255,255,255,0.2)",
                                    marginTop: 6,
                                    paddingTop: 10,
                                    paddingHorizontal: 12,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Feather name="trash-2" size={14} color="#FF4A4A" />
                                  <Text style={{ color: "#FF4A4A", fontSize: 17, fontWeight: "600" }}>
                                    Eliminar rutina
                                  </Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
  
  );
});

const TRAINING_FILTER_OPTIONS: Array<{ key: TrainingFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "strength", label: "Fuerza" },
  { key: "hypertrophy", label: "Hipertrofia" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Flexibilidad" },
];
