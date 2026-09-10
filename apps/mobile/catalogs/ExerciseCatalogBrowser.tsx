import { Feather } from "@expo/vector-icons";
import { FlatList, Image, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";

import { mobileTheme } from "../theme";
import { exerciseCatalogImageUri } from "./sources";
import type { ExerciseCatalogResult, ExerciseCatalogSummary } from "./exerciseCatalogRuntime";

export type ExerciseCatalogBrowserMode = "select" | "inspect";

type Props = {
  mode: ExerciseCatalogBrowserMode;
  items: ExerciseCatalogSummary[];
  muscleGroups: string[];
  query: string;
  muscleGroup: string;
  loading: boolean;
  loadingMore: boolean;
  result: ExerciseCatalogResult | null;
  onQueryChange: (value: string) => void;
  onMuscleGroupChange: (value: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onEndReached: () => void;
  onChoose: (entry: ExerciseCatalogSummary) => void;
  onCreateCustom: () => void;
};

const ROW_HEIGHT = 92;

function ResultNotice({ result, hasItems }: { result: ExerciseCatalogResult | null; hasItems: boolean }) {
  if (!result) return null;
  if (!result.globalCoverage && hasItems) {
    return (
      <View accessibilityRole="alert" style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
        <Text style={{ color: "#F1C75B", fontSize: 13 }}>
          Sin conexión: se muestran solo los ejercicios guardados en este dispositivo.
        </Text>
      </View>
    );
  }
  if (result.done && hasItems) {
    return (
      <Text accessibilityLiveRegion="polite" style={{ color: "#778091", textAlign: "center", fontSize: 12, paddingVertical: 12 }}>
        Fin de los resultados
      </Text>
    );
  }
  return null;
}

export function ExerciseCatalogBrowser({
  mode,
  items,
  muscleGroups,
  query,
  muscleGroup,
  loading,
  loadingMore,
  result,
  onQueryChange,
  onMuscleGroupChange,
  onClose,
  onRetry,
  onEndReached,
  onChoose,
  onCreateCustom,
}: Props) {
  const hasRecoverableError = !!result?.warning && items.length === 0;
  return (
    <View
      testID="exercise-catalog-browser"
      style={{ position: "absolute", inset: 0, backgroundColor: "#0D1117", zIndex: 700, elevation: 70 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
          <Pressable accessibilityLabel="Cerrar catálogo" onPress={onClose} style={{ padding: 6 }}>
            <Feather name="arrow-left" size={24} color={mobileTheme.color.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "800" }}>
              {mode === "select" ? "Seleccionar ejercicio" : "Catálogo de ejercicios"}
            </Text>
            {result ? (
              <Text accessibilityLiveRegion="polite" style={{ color: "#778091", fontSize: 12, marginTop: 2 }}>
                {result.globalCoverage ? "Búsqueda en todo el catálogo" : "Cobertura offline limitada"}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 14, marginBottom: 8 }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#171B23",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: mobileTheme.color.borderSubtle,
            paddingHorizontal: 12,
            minHeight: 44,
            gap: 8,
          }}>
            <Feather name="search" size={16} color="#778091" />
            <TextInput
              testID="exercise-catalog-search"
              accessibilityLabel="Buscar ejercicios"
              style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 16 }}
              placeholder="Buscar por nombre o músculo..."
              placeholderTextColor="#5A6270"
              value={query}
              onChangeText={onQueryChange}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable accessibilityLabel="Limpiar búsqueda" onPress={() => onQueryChange("")}>
                <Feather name="x" size={16} color="#778091" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 42, marginBottom: 8, paddingHorizontal: 14 }}
          contentContainerStyle={{ gap: 8, alignItems: "center", paddingRight: 28 }}
        >
          {["all", ...muscleGroups].map((muscle) => {
            const selected = muscleGroup === muscle;
            return (
              <Pressable
                key={muscle}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onMuscleGroupChange(muscle)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: mobileTheme.radius.pill,
                  borderWidth: 1,
                  borderColor: selected ? "rgba(203,255,26,0.82)" : mobileTheme.color.borderSubtle,
                  backgroundColor: selected ? "rgba(160,204,0,0.12)" : "#0D1117",
                }}
              >
                <Text style={{ color: selected ? mobileTheme.color.brandPrimary : "#9EA6B3", fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>
                  {muscle === "all" ? "Todos" : muscle}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View accessibilityRole="progressbar" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 14, fontWeight: "700" }}>
              {query || muscleGroup !== "all" ? "Buscando ejercicios…" : "Cargando catálogo…"}
            </Text>
          </View>
        ) : hasRecoverableError ? (
          <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
            <Feather name="wifi-off" size={24} color="#F1C75B" />
            <Text style={{ color: mobileTheme.color.textPrimary, textAlign: "center", fontSize: 15 }}>
              No se pudo cargar esta parte del catálogo.
            </Text>
            <Pressable onPress={onRetry} style={{ borderRadius: 999, backgroundColor: mobileTheme.color.brandPrimary, paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: "#07090D", fontWeight: "800" }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            key={`${query}:${muscleGroup}`}
            testID="exercise-catalog-list"
            data={items}
            keyExtractor={(item) => `${item.sourceId}:${item.id}`}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews
            getItemLayout={(_data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: mode === "select" ? 92 : 24 }}
            ListEmptyComponent={(
              <View style={{ alignItems: "center", paddingVertical: 42, gap: 8 }}>
                <Feather name="search" size={22} color="#5A6270" />
                <Text accessibilityLiveRegion="polite" style={{ color: "#778091", fontSize: 15, textAlign: "center" }}>
                  No hay ejercicios que coincidan con la búsqueda.
                </Text>
              </View>
            )}
            ListFooterComponent={loadingMore ? (
              <Text accessibilityLiveRegion="polite" style={{ color: mobileTheme.color.brandPrimary, textAlign: "center", padding: 14 }}>
                Cargando más…
              </Text>
            ) : <ResultNotice result={result} hasItems={items.length > 0} />}
            renderItem={({ item }) => (
              <Pressable
                testID={`exercise-catalog-row-${item.id}`}
                onPress={() => onChoose(item)}
                style={{
                  height: ROW_HEIGHT - 8,
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#171B23",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: exerciseCatalogImageUri(item, "male") }}
                  style={{ width: 98, height: ROW_HEIGHT - 8, backgroundColor: "#091219" }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, paddingHorizontal: 12, gap: 4 }}>
                  <Text numberOfLines={2} style={{ color: mobileTheme.color.textPrimary, fontSize: 15, fontWeight: "700" }}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: "#778091", fontSize: 12, textTransform: "capitalize" }}>
                    {item.muscle_group}{item.equipment ? ` · ${item.equipment}` : ""}
                  </Text>
                </View>
                <Feather name={mode === "select" ? "plus" : "chevron-right"} size={20} color={mobileTheme.color.brandPrimary} style={{ marginRight: 14 }} />
              </Pressable>
            )}
          />
        )}

        {mode === "select" ? (
          <View style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
            <Pressable
              testID="training-exercise-custom-open"
              onPress={onCreateCustom}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#171B23",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(203,255,26,0.45)",
                minHeight: 58,
                gap: 8,
              }}
            >
              <Feather name="edit-3" size={18} color={mobileTheme.color.brandPrimary} />
              <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 16, fontWeight: "700" }}>
                Crear ejercicio personalizado
              </Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
