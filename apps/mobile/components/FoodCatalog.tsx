import { Feather } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { foodCatalogImageUri } from "../catalogs/sources";
import type { FoodCatalogEntry } from "../catalogs/types";
import { mobileTheme } from "../theme";
import { FoodThumbnail } from "./FoodThumbnail";

export function FoodCatalogRow({ food, onPress, showCategory = false }: { food: FoodCatalogEntry; onPress(): void; showCategory?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle }}>
      <FoodThumbnail food={food} emojiSize={16} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{food.name}</Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{food.calories_per_100g} kcal · P:{food.protein_per_100g}g · C:{food.carbs_per_100g}g · G:{food.fat_per_100g}g</Text>
      </View>
      {showCategory ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{food.category}</Text> : null}
    </Pressable>
  );
}

export function FoodCatalogDetail({ food, testID, onClose, showTitle = false }: { food: FoodCatalogEntry; testID: string; onClose?: () => void; showTitle?: boolean }) {
  const servingCalories = Math.round(food.calories_per_100g * food.serving_size_g / 100);
  return (
    <View testID={testID} style={{ backgroundColor: mobileTheme.color.bgSurface, borderRadius: 12, padding: 16, gap: 12, marginTop: showTitle ? 0 : 6, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle }}>
      {showTitle ? <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18, flex: 1 }}>{food.name}</Text><Pressable onPress={onClose} style={{ padding: 4 }}><Feather name="x" size={20} color={mobileTheme.color.textSecondary} /></Pressable></View> : null}
      {showTitle && food.image ? <Image source={{ uri: foodCatalogImageUri(food)! }} style={{ width: "100%", height: 160, borderRadius: 8 }} resizeMode="contain" /> : null}
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Por 100g</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ label: "Calorías", value: food.calories_per_100g, unit: "kcal", color: "#FF6B6B" }, { label: "Proteína", value: food.protein_per_100g, unit: "g", color: "#4ECDC4" }, { label: "Carbos", value: food.carbs_per_100g, unit: "g", color: "#FFE66D" }, { label: "Grasa", value: food.fat_per_100g, unit: "g", color: "#FF8A5C" }].map((macro) => <View key={macro.label} style={{ flex: 1, backgroundColor: `${macro.color}15`, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 }}><Text style={{ color: macro.color, fontSize: 16, fontWeight: "700" }}>{macro.value}</Text><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.unit}</Text><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.label}</Text></View>)}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Fibra</Text><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>{food.fiber_per_100g}g</Text></View>
      {food.serving_size_g > 0 ? <View style={{ backgroundColor: "#ffffff08", borderRadius: 8, padding: 10, gap: 4 }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>{showTitle ? `Ración típica (${food.serving_size_g}g)` : "Ración típica"}</Text>{!showTitle ? <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13 }}>{food.serving_description || `${food.serving_size_g}g`}</Text> : null}<Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{servingCalories} kcal · P:{(food.protein_per_100g * food.serving_size_g / 100).toFixed(1)}g · C:{(food.carbs_per_100g * food.serving_size_g / 100).toFixed(1)}g · G:{(food.fat_per_100g * food.serving_size_g / 100).toFixed(1)}g</Text></View> : null}
    </View>
  );
}

