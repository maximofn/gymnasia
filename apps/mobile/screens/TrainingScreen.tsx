import { Feather, Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import type {
  TrainingDetailActions,
  TrainingDetailModel,
  TrainingHistoryActions,
  TrainingHistoryModel,
} from "../controllers/trainingController";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import type { ExerciseSeries } from "../training/seriesContract";
import { SERIES_TYPE_META } from "../training/seriesPresentation";
import { isCompletedWorkoutSummary, type WorkoutSessionSummary, type WorkoutSummaryRecalculation } from "../training/workoutHistory";
import { formatClock, formatPrescriptionNumber, formatTrainingHistoryDate, formatWorkoutHistoryVolume, workoutPrescriptionSeriesDetail, type TrainingStatsMetricKey, type TrainingStatsPeriodKey } from "../training/presentationModel";
import { templateHasRunnableSeries } from "../training/workoutSessionModel";
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
