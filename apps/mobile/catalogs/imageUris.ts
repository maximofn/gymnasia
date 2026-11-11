import type { FoodCatalogEntry, RawExerciseCatalogEntry } from "./types";
import ciqualImages from "./generated/ciqualImages.generated.json";

const RAW_BASE_URL = "https://raw.githubusercontent.com/maximofn/gymnasia/main";

export const EXERCISE_CATALOG_IMAGE_BASE_URL = `${RAW_BASE_URL}/ejercicios`;
export const CIQUAL_IMAGE_ATTRIBUTION = ciqualImages.attribution;
const ciqualImagePaths: Readonly<Record<string, string>> = ciqualImages.images;

export function ciqualFoodImageUri(id: string): string | null {
  const path = ciqualImagePaths[id];
  return typeof path === "string" ? `${RAW_BASE_URL}/alimentos/ciqual/${path}` : null;
}

export function foodCatalogImageUri(entry: FoodCatalogEntry | null | undefined): string | null {
  if (!entry || entry.sourceId === "user_personal_foods") return null;
  if (entry.sourceId === "anses_ciqual_2025") return ciqualFoodImageUri(entry.id);
  if (!entry.image) return null;
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
