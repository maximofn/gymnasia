import { Feather } from "@expo/vector-icons";
import { memo } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import type { ExerciseCatalogEntry } from "../catalogs/types";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import { mobileTheme } from "../theme";

export const ExerciseCatalogDetailOverlay = memo(function ExerciseCatalogDetailOverlay({
  exercise,
  imageBaseUrl,
  onClose,
}: {
  exercise: ExerciseCatalogEntry | null;
  imageBaseUrl: string;
  onClose(): void;
}) {
  if (!exercise) return null;
  return (
    <View testID={shellSurfaceTestId("exercise-catalog-detail")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.88)", zIndex: 998, justifyContent: "center", alignItems: "center" }}>
      <View style={{ width: "92%", maxHeight: "90%", backgroundColor: mobileTheme.color.bgSurface, borderRadius: 20, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "800", fontSize: 20, flex: 1 }}>
            {exercise.name}
          </Text>
          <Pressable testID="exercise-detail-close" onPress={onClose} style={{ padding: 6 }}>
            <Feather name="x" size={22} color={mobileTheme.color.textSecondary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {exercise.image_male ? (
            <View style={{ flex: 1, gap: 4 }}>
              <Image source={{ uri: `${imageBaseUrl}/${exercise.image_male}` }} style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#1a1a1a" }} resizeMode="cover" />
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, textAlign: "center" }}>Hombre</Text>
            </View>
          ) : null}
          {exercise.image_female ? (
            <View style={{ flex: 1, gap: 4 }}>
              <Image source={{ uri: `${imageBaseUrl}/${exercise.image_female}` }} style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#1a1a1a" }} resizeMode="cover" />
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, textAlign: "center" }}>Mujer</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {[exercise.muscle_group, ...(exercise.secondary_muscles || [])].map((muscle) => (
            <View key={muscle} style={{ backgroundColor: mobileTheme.color.accent + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ color: mobileTheme.color.accent, fontSize: 11, fontWeight: "600" }}>{muscle}</Text>
            </View>
          ))}
          <View style={{ backgroundColor: "#ffffff15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{exercise.equipment}</Text>
          </View>
          <View style={{ backgroundColor: "#ffffff15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{exercise.difficulty}</Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 150 }}>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 20 }}>
            {exercise.instructions}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
});
