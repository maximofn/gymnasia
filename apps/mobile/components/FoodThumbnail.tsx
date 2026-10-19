import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Text, View } from "react-native";

import { foodCatalogImageUri } from "../catalogs/sources";
import type { FoodCatalogEntry } from "../catalogs/types";
import { mobileTheme } from "../theme";

function ThumbnailImage({ uri, size, fallback }: { uri?: string | null; size: number; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed
    ? <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />
    : fallback;
}

export function DietItemThumbnail({ uri, dotColor, size = 36 }: { uri?: string | null; dotColor: string; size?: number }) {
  return <ThumbnailImage uri={uri} size={size} fallback={<View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dotColor, marginTop: 8 }} />} />;
}

export function FoodThumbnail({ food, size = 36, fallback = "category", emojiSize = size * 0.44 }: { food: FoodCatalogEntry; size?: number; fallback?: "category" | "icon"; emojiSize?: number }) {
  const emoji = food.category === "proteína" ? "🥩" : food.category === "carbohidrato" ? "🍚" : food.category === "grasa" ? "🫒" : food.category === "fruta" ? "🍎" : food.category === "verdura" ? "🥦" : food.category === "lácteo" ? "🥛" : food.category === "legumbre" ? "🫘" : food.category === "fruto-seco" ? "🥜" : "🍽️";
  return <ThumbnailImage uri={foodCatalogImageUri(food)} size={size} fallback={
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: "rgba(203,255,26,0.1)", alignItems: "center", justifyContent: "center" }}>
      {fallback === "icon" ? <Feather name="coffee" size={15} color={mobileTheme.color.brandPrimary} /> : <Text style={{ fontSize: emojiSize }}>{emoji}</Text>}
    </View>
  } />;
}
