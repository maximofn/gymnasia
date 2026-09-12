import { Feather, Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import ConfettiCannon from "react-native-confetti-cannon";
import { Pressable, Text, View } from "react-native";

import type {
  TrainingResolutionActions,
  TrainingResolutionModel,
} from "../controllers/trainingController";
import { formatClock } from "../training/presentationModel";
import { diffWorkoutTemplates } from "../training/workoutTemplateOperations";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

export const TrainingResolutionOverlays = memo(function TrainingResolutionOverlays({
  model,
  actions,
}: {
  model: Readonly<TrainingResolutionModel>;
  actions: Readonly<TrainingResolutionActions>;
}) {
  const completion = model.completion;
  return (
    <>
      {model.discardDraftOpen ? (
        <View testID={shellSurfaceTestId("training-template-discard")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center", zIndex: 620, elevation: 62 }}>
          <View style={{ width: "100%", maxWidth: 370, borderRadius: 24, borderWidth: 1, borderColor: "#252B35", backgroundColor: "#141820", padding: 20, gap: 14 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 24, fontWeight: "800" }}>¿Descartar cambios?</Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, lineHeight: 21 }}>El borrador no se ha guardado. La rutina original no se modificará.</Text>
            <Pressable testID="training-editor-keep-editing" onPress={actions.keepEditing} style={{ minHeight: 50, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#06090D", fontSize: 17, fontWeight: "800" }}>Seguir editando</Text>
            </Pressable>
            <Pressable testID="training-editor-confirm-discard" onPress={actions.discardDraft} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,77,79,0.55)", backgroundColor: "rgba(255,77,79,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FF8A8A", fontSize: 16, fontWeight: "800" }}>Descartar cambios</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {model.conflictOpen ? (
        <View testID={shellSurfaceTestId("training-template-conflict")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center", zIndex: 621, elevation: 63 }}>
          <View style={{ width: "100%", maxWidth: 390, borderRadius: 24, borderWidth: 1, borderColor: "#3B424E", backgroundColor: "#141820", padding: 20, gap: 12 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 24, fontWeight: "800" }}>La rutina cambió fuera del editor</Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, lineHeight: 21 }}>Hay una versión más reciente. Elige qué contenido quieres conservar; no sobrescribiremos nada sin tu permiso.</Text>
            <Pressable testID="training-editor-conflict-load-current" onPress={actions.loadCurrentTemplate} style={{ minHeight: 50, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#06090D", fontSize: 16, fontWeight: "800" }}>Cargar versión actual</Text>
            </Pressable>
            <Pressable testID="training-editor-conflict-overwrite" onPress={actions.overwriteTemplate} style={{ minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#1B1F27", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#E7EBF3", fontSize: 16, fontWeight: "800" }}>Guardar mis cambios</Text>
            </Pressable>
            <Pressable testID="training-editor-conflict-continue" onPress={actions.continueAfterConflict} style={{ minHeight: 42, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#A6AFBC", fontSize: 15, fontWeight: "700" }}>Seguir editando</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {model.partialFinishOpen ? (
        <View testID={shellSurfaceTestId("training-partial-finish")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center", zIndex: 610, elevation: 61 }}>
          <View style={{ width: "100%", maxWidth: 370, borderRadius: 26, borderWidth: 1, borderColor: "rgba(245,197,66,0.24)", backgroundColor: "#12151C", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, alignItems: "center", gap: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 999, backgroundColor: "rgba(245,197,66,0.16)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="alert-circle-outline" size={32} color="#F5C542" />
            </View>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "center" }}>Entrenamiento incompleto</Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 16, lineHeight: 22, textAlign: "center" }}>
              Has completado {model.completedEffortCount} de {model.totalEffortCount} esfuerzos. Puedes continuar o guardar lo realizado como una sesión parcial.
            </Text>
            <Pressable testID="training-partial-continue" onPress={actions.continuePartialSession} style={{ width: "100%", minHeight: 52, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#06090D", fontSize: 18, fontWeight: "800" }}>Seguir entrenando</Text>
            </Pressable>
            <Pressable testID="training-partial-save" onPress={actions.savePartialSession} style={{ width: "100%", minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,197,66,0.34)", backgroundColor: "rgba(245,197,66,0.08)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#F5D66D", fontSize: 17, fontWeight: "800" }}>Guardar como parcial</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {completion ? (
        <View testID={shellSurfaceTestId("workout-completion")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center", zIndex: 600, elevation: 60 }}>
          <View style={{ width: "100%", maxWidth: 370, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#12151C", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, alignItems: "center", gap: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 999, backgroundColor: completion.kind === "partial" ? "rgba(245,197,66,0.16)" : completion.kind === "discard" ? "rgba(255,75,75,0.16)" : "rgba(0,198,107,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={completion.kind === "completed" ? "trophy-outline" : completion.kind === "partial" ? "save-outline" : "exit-outline"} size={30} color={completion.kind === "partial" ? "#F5C542" : completion.kind === "discard" ? "#FF6B6B" : "#00D06E"} />
            </View>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "800", textAlign: "center" }}>
              {completion.kind === "completed" ? "¡Sesión completada!" : completion.kind === "partial" ? model.hasActiveSession ? "Guardar sesión parcial" : "Sesión parcial guardada" : "Abandonar sesión"}
            </Text>
            {completion.summary ? (
              <View style={{ width: "100%", gap: 9 }}>
                <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>{formatClock(completion.summary.elapsed_seconds)}</Text>
                    <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Duración</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                    <Text style={{ color: completion.kind === "partial" ? "#F5C542" : mobileTheme.color.brandPrimary, fontSize: 22, fontWeight: "800" }}>{completion.summary.completed_effort_count}/{completion.summary.total_effort_count}</Text>
                    <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Esfuerzos</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "800" }}>{completion.summary.estimated_calories}</Text>
                    <Text style={{ color: "#8B94A3", fontSize: 14, fontWeight: "600" }}>Calorías</Text>
                  </View>
                </View>
                {completion.summary.effort_breakdown ? (
                  <Text testID="training-complete-effort-breakdown" style={{ color: "#9CA6B5", fontSize: 12, textAlign: "center" }}>
                    {completion.summary.effort_breakdown.completed_primary} principales · {completion.summary.effort_breakdown.completed_sub_series} mini-series
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={{ width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
            {completion.has_template_changes ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="sync-outline" size={20} color="#F5C542" />
                  <Text style={{ color: "#F5C542", fontSize: 20, fontWeight: "700" }}>{completion.canonical_conflict ? "La rutina también cambió fuera de la sesión" : "Cambios de rutina detectados"}</Text>
                </View>
                <Text style={{ color: "#9CA6B5", fontSize: 16, textAlign: "center", lineHeight: 22 }}>
                  {completion.canonical_conflict ? "Hay dos versiones distintas. Elige expresamente cuál debe quedar como rutina futura." : "La sesión tiene cambios que todavía no afectan a tu rutina. Elige qué versión quieres conservar."}
                </Text>
                {completion.original_template && completion.draft_template
                  ? diffWorkoutTemplates(completion.original_template, completion.draft_template).summaries.slice(0, 3).map((summary) => (
                      <Text key={summary} style={{ width: "100%", color: "#D7DDE7", fontSize: 13 }}>• {summary}</Text>
                    ))
                  : null}
                <Pressable onPress={() => actions.finalizeWithTemplateChanges(completion.canonical_conflict)} testID="training-complete-apply-changes" style={{ width: "100%", minHeight: 52, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                  <Feather name="check" size={16} color="#06090D" />
                  <Text style={{ color: "#06090D", fontSize: completion.kind === "partial" ? 17 : 22, fontWeight: "800", textAlign: "center" }}>
                    {completion.kind === "completed" ? "Conservar cambios" : completion.kind === "partial" ? "Guardar parcial y conservar cambios" : "Abandonar y conservar cambios"}
                  </Text>
                </Pressable>
                <Pressable onPress={actions.revertTemplateChanges} testID="training-complete-revert-changes" style={{ width: "100%", minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#1A1F28", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#E5EAF3", fontSize: completion.kind === "partial" ? 17 : 22, fontWeight: "700", textAlign: "center" }}>
                    {completion.kind === "completed" ? "Mantener rutina actual" : completion.kind === "partial" ? "Guardar parcial y mantener rutina" : "Abandonar y mantener rutina"}
                  </Text>
                </Pressable>
                <Pressable onPress={actions.continueSessionResolution} testID="training-resolution-continue" style={{ minHeight: 42, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#A6AFBC", fontSize: 15, fontWeight: "700" }}>Seguir entrenando</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: "#9CA6B5", fontSize: 16, textAlign: "center", lineHeight: 22 }}>
                  {completion.kind === "partial" ? "Guardamos lo que has realizado sin contarlo como un entrenamiento completado." : "Buen trabajo. La sesión quedó registrada correctamente."}
                </Text>
                <Pressable onPress={actions.finishOrClose} testID="training-complete-close" style={{ width: "100%", minHeight: 52, borderRadius: 14, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#06090D", fontSize: 22, fontWeight: "800" }}>{model.hasActiveSession ? "Finalizar" : "Cerrar"}</Text>
                </Pressable>
              </>
            )}
          </View>
          {completion.kind === "completed" ? (
            <ConfettiCannon count={120} origin={{ x: -10, y: 0 }} autoStart fadeOut explosionSpeed={400} fallSpeed={2800} colors={["#CBFF1A", "#00D06E", "#4ECDC4", "#FFE66D", "#FF6B6B", "#FFFFFF"]} />
          ) : null}
        </View>
      ) : null}
    </>
  );
});
