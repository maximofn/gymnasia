import { Feather } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { TrainingHistoryActions, TrainingHistoryModel } from "../controllers/trainingController";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { SERIES_TYPE_META } from "../training/seriesPresentation";
import { isCompletedWorkoutSummary, type WorkoutSessionSummary, type WorkoutSummaryRecalculation } from "../training/workoutHistory";
import { formatClock, formatPrescriptionNumber, formatTrainingHistoryDate, formatWorkoutHistoryVolume, workoutPrescriptionSeriesDetail } from "../training/presentationModel";
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
