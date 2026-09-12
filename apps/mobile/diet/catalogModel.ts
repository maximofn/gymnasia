import { matchFoodCatalog } from "../catalogs/matching";
import { foodCatalogImageUri } from "../catalogs/imageUris";
import {
  catalogRef,
  linkedCatalog,
  type CatalogLink,
  type FoodCatalogEntry,
} from "../catalogs/types";
import type { DietItem } from "./model";

export function findDietFoodInCatalog(
  name: string,
  foods: readonly FoodCatalogEntry[],
  personalFoods: readonly FoodCatalogEntry[],
): ReturnType<typeof matchFoodCatalog<FoodCatalogEntry>> {
  return matchFoodCatalog([...foods, ...personalFoods], name);
}

export function dietItemFromCatalog(
  entry: FoodCatalogEntry,
  grams: number,
  id: string,
  linkedBy: Extract<CatalogLink, { status: "linked" }>["linkedBy"],
): DietItem {
  const ratio = grams / 100;
  return {
    id,
    title: entry.name,
    grams,
    calories_kcal: Math.round(entry.calories_per_100g * ratio * 10) / 10,
    protein_g: Math.round(entry.protein_per_100g * ratio * 10) / 10,
    carbs_g: Math.round(entry.carbs_per_100g * ratio * 10) / 10,
    fat_g: Math.round(entry.fat_per_100g * ratio * 10) / 10,
    image_uri: foodCatalogImageUri(entry),
    catalog_link: linkedCatalog(catalogRef(entry.sourceId, entry.id), linkedBy),
  };
}
