import { Feather, Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import ConfettiCannon from "react-native-confetti-cannon";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ExerciseCatalogBrowser } from "../catalogs/ExerciseCatalogBrowser";
import type {
  TrainingCatalogActions,
  TrainingCatalogModel,
  TrainingResolutionActions,
  TrainingResolutionModel,
  TrainingDetailExercise,
} from "../controllers/trainingController";
import { ALL_SERIES_TYPES, SERIES_TYPE_META } from "../training/seriesPresentation";
import { formatClock } from "../training/presentationModel";
import { diffWorkoutTemplates } from "../training/workoutTemplateOperations";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

const EXERCISE_EQUIPMENT_OPTIONS = [
  "Peso corporal", "Barra", "Mancuernas", "Máquina", "Cable",
  "Kettlebell", "Banda elástica", "Polea", "Otro",
];
const EXERCISE_DIFFICULTY_OPTIONS = ["Principiante", "Intermedio", "Avanzado"];
const EXERCISE_MUSCLE_OPTIONS = [
  "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps",
  "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos",
  "Core", "Antebrazos", "Trapecio", "Aductores", "Abductores",
];

export const TrainingCatalogOverlays = memo(function TrainingCatalogOverlays({
  model,
  actions,
}: {
  model: Readonly<TrainingCatalogModel>;
  actions: Readonly<TrainingCatalogActions>;
}) {
  const draft = model.customDraft;
  return (
    <>
      {model.pickerOpen ? (
        <ExerciseCatalogBrowser
          testID={shellSurfaceTestId("exercise-picker")}
          mode={model.pickerMode}
          items={model.results}
          muscleGroups={model.muscleGroups}
          query={model.query}
          muscleGroup={model.muscleGroup}
          loading={model.loading}
          loadingMore={model.loadingMore}
          result={model.result}
          onQueryChange={actions.updateQuery}
          onMuscleGroupChange={actions.updateMuscleGroup}
          onClose={actions.closePicker}
          onRetry={actions.retry}
          onEndReached={actions.loadMore}
          onChoose={actions.choose}
          onCreateCustom={actions.openCustomForm}
        />
      ) : null}

      {model.customFormOpen ? (
        <View testID={shellSurfaceTestId("custom-exercise-form")} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#0D1117", zIndex: 750, elevation: 75 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
                <Pressable onPress={actions.closeCustomForm} hitSlop={10}>
                  <Feather name="arrow-left" size={24} color={mobileTheme.color.textPrimary} />
                </Pressable>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "700", flex: 1 }}>Nuevo ejercicio</Text>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 6 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>Nombre *</Text>
                  <TextInput
                    testID="training-exercise-custom-name"
                    value={draft.name}
                    onChangeText={(name) => actions.updateCustomDraft((current) => ({ ...current, name }))}
                    placeholder="Ej: Flexiones, Sentadilla búlgara..."
                    placeholderTextColor={mobileTheme.color.textSecondary}
                    style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, paddingHorizontal: 12, paddingVertical: 10, color: mobileTheme.color.textPrimary, fontSize: 16, backgroundColor: "#171B23", minHeight: 48 }}
                  />
                </View>

                <OptionChips
                  label="Grupo muscular principal"
                  options={EXERCISE_MUSCLE_OPTIONS}
                  selected={(option) => draft.muscle_group === option}
                  onToggle={(option, active) => actions.updateCustomDraft((current) => ({ ...current, muscle_group: active ? "" : option }))}
                />
                <OptionChips
                  label="Músculos secundarios"
                  options={EXERCISE_MUSCLE_OPTIONS.filter((option) => option !== draft.muscle_group)}
                  selected={(option) => draft.secondary_muscles.includes(option)}
                  onToggle={(option, active) => actions.updateCustomDraft((current) => ({
                    ...current,
                    secondary_muscles: active
                      ? current.secondary_muscles.filter((muscle) => muscle !== option)
                      : [...current.secondary_muscles, option],
                  }))}
                />
                <OptionChips
                  label="Equipamiento"
                  options={EXERCISE_EQUIPMENT_OPTIONS}
                  selected={(option) => draft.equipment === option}
                  onToggle={(option, active) => actions.updateCustomDraft((current) => ({ ...current, equipment: active ? "" : option }))}
                />
                <OptionChips
                  label="Dificultad"
                  options={EXERCISE_DIFFICULTY_OPTIONS}
                  selected={(option) => draft.difficulty === option}
                  onToggle={(option, active) => actions.updateCustomDraft((current) => ({ ...current, difficulty: active ? "" : option }))}
                />

                <View style={{ gap: 6 }}>
                  <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>Instrucciones</Text>
                  <TextInput
                    value={draft.instructions}
                    onChangeText={(instructions) => actions.updateCustomDraft((current) => ({ ...current, instructions }))}
                    placeholder="Describe cómo realizar el ejercicio..."
                    placeholderTextColor={mobileTheme.color.textSecondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, paddingHorizontal: 12, paddingVertical: 10, color: mobileTheme.color.textPrimary, fontSize: 14, backgroundColor: "#171B23", minHeight: 100 }}
                  />
                </View>

                <Pressable
                  testID="training-exercise-custom-save"
                  onPress={actions.saveCustomExercise}
                  disabled={!draft.name.trim()}
                  style={{ backgroundColor: draft.name.trim() ? mobileTheme.color.brandPrimary : "rgba(203,255,26,0.2)", borderRadius: mobileTheme.radius.lg, paddingVertical: 16, alignItems: "center", opacity: draft.name.trim() ? 1 : 0.5 }}
                >
                  <Text style={{ color: "#07090D", fontSize: 17, fontWeight: "800" }}>Guardar ejercicio</Text>
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      ) : null}

      {model.seriesTypePickerOpen ? (
        <Pressable testID={shellSurfaceTestId("series-type-picker")} onPress={actions.closeSeriesTypePicker} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.76)", alignItems: "center", justifyContent: "center", zIndex: 610, elevation: 61 }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ width: "85%", maxWidth: 340, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#12151C", paddingVertical: 12, paddingHorizontal: 4 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700", paddingHorizontal: 12, marginBottom: 10 }}>Tipo de serie</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {ALL_SERIES_TYPES.map((seriesType) => {
                const meta = SERIES_TYPE_META[seriesType];
                const selected = model.selectedSeriesType === seriesType;
                return (
                  <Pressable
                    key={seriesType}
                    onPress={() => actions.selectSeriesType(seriesType)}
                    testID={`training-series-type-option-${seriesType}`}
                    style={{ minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: selected ? "rgba(203,255,26,0.1)" : "transparent", borderRadius: 10, marginHorizontal: 4 }}
                  >
                    <View style={{ width: 32, height: 24, borderRadius: 6, backgroundColor: seriesType === "warmup" ? "rgba(255,74,74,0.2)" : "#202630", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: seriesType === "warmup" ? "#FF4A4A" : "#8C95A4", fontSize: 10, fontWeight: "700" }}>{meta.short}</Text>
                    </View>
                    <Text style={{ flex: 1, color: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 15, fontWeight: selected ? "700" : "500" }}>{meta.label}</Text>
                    {selected ? <Feather name="check" size={16} color={mobileTheme.color.brandPrimary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}
    </>
  );
});

function OptionChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: ReadonlyArray<string>;
  selected(option: string): boolean;
  onToggle(option: string, selected: boolean): void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected(option);
          return (
            <Pressable key={option} onPress={() => onToggle(option, active)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: mobileTheme.radius.pill, borderWidth: 1, borderColor: active ? "rgba(203,255,26,0.82)" : mobileTheme.color.borderSubtle, backgroundColor: active ? "rgba(160,204,0,0.12)" : "#0D1117" }}>
              <Text style={{ color: active ? mobileTheme.color.brandPrimary : "#9EA6B3", fontSize: 14, fontWeight: "600" }}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const TrainingExerciseDetailOverlay = memo(function TrainingExerciseDetailOverlay({
  exercise,
  onClose,
}: {
  exercise: TrainingDetailExercise | null;
  onClose(): void;
}) {
  if (!exercise) return null;
  return (
    <View testID={shellSurfaceTestId("training-exercise-detail")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#06090D", zIndex: 200 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={{ position: "relative" }}>
            {exercise.imageUri ? (
              <Image source={{ uri: exercise.imageUri }} style={{ width: "100%", aspectRatio: 16 / 10 }} resizeMode="cover" />
            ) : (
              <View style={{ width: "100%", aspectRatio: 16 / 10, backgroundColor: exercise.previewMeta.backgroundColor, alignItems: "center", justifyContent: "center" }}>
                <Feather name={exercise.previewMeta.icon} size={64} color={exercise.previewMeta.accentColor} />
              </View>
            )}
            <Pressable onPress={onClose} style={{ position: "absolute", top: 14, left: 14, width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(8,11,16,0.48)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 28, fontWeight: "700" }}>
              {exercise.exerciseName}
            </Text>
            {exercise.muscle ? (
              <View style={{ flexDirection: "row" }}>
                <View style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#171B23", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="target" size={14} color={mobileTheme.color.brandPrimary} />
                  <Text style={{ color: "#E8EDF5", fontSize: 14, fontWeight: "700" }}>{exercise.muscle}</Text>
                </View>
              </View>
            ) : null}
            {exercise.instructions ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>Instrucciones</Text>
                <Text style={{ color: "#8B94A3", fontSize: 15, lineHeight: 22 }}>{exercise.instructions}</Text>
              </View>
            ) : null}
            {exercise.seriesItems.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 18, fontWeight: "700" }}>Series</Text>
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#171B23", overflow: "hidden" }}>
                  <View style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", backgroundColor: "#1C212A" }}>
                    <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", width: 40, textAlign: "center" }}>#</Text>
                    <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Reps</Text>
                    <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Peso</Text>
                    <Text style={{ color: "#636B78", fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" }}>Descanso</Text>
                  </View>
                  {exercise.seriesItems.map((series, index) => (
                    <View key={series.id} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: index < exercise.seriesItems.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.04)" }}>
                      <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700", width: 40, textAlign: "center" }}>{index + 1}</Text>
                      <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>{series.reps.trim() || "--"}</Text>
                      <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>{series.weight_kg.trim() ? `${series.weight_kg.trim()} kg` : "--"}</Text>
                      <Text style={{ color: "#8B94A3", fontSize: 14, flex: 1, textAlign: "center" }}>{series.rest_seconds.trim() ? `${series.rest_seconds.trim()}s` : "--"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
});

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
