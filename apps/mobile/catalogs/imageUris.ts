import type { FoodCatalogEntry, RawExerciseCatalogEntry } from "./types";

const RAW_BASE_URL = "https://raw.githubusercontent.com/maximofn/gymnasia/main";

export const EXERCISE_CATALOG_IMAGE_BASE_URL = `${RAW_BASE_URL}/ejercicios`;

export function foodCatalogImageUri(entry: FoodCatalogEntry | null | undefined): string | null {
  if (!entry?.image || entry.sourceId === "user_personal_foods") return null;
  const path = entry.sourceId === "gymnasia_products"
    ? "productos_comerciales"
    : entry.sourceId === "gymnasia_recipes"
      ? "recetas"
      : "alimentos";
  return `${RAW_BASE_URL}/${path}/images/${entry.image}`;
}

export function exerciseCatalogImageUri(
  entry: Pick<RawExerciseCatalogEntry, "image_male" | "image_female">,
  gender: "male" | "female",
): string {
  const imagePath = gender === "female" ? entry.image_female : entry.image_male;
  return `${EXERCISE_CATALOG_IMAGE_BASE_URL}/${imagePath}`;
}
