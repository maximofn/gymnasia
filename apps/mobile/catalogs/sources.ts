import { scopedStorageKey } from "../runtimeEnvironment";
import { parseFoodCatalog } from "./schemaValidation";
import type {
  FoodCatalogEntry,
  FoodCatalogSourceId,
  LegacyFoodSource,
  RawFoodCatalogEntry,
} from "./types";
import type { CatalogDefinition } from "./runtime";
export {
  EXERCISE_CATALOG_IMAGE_BASE_URL,
  exerciseCatalogImageUri,
  foodCatalogImageUri,
} from "./imageUris";

const REPOSITORY_URL = "https://github.com/maximofn/gymnasia";
const RAW_BASE_URL = "https://raw.githubusercontent.com/maximofn/gymnasia/main";

export const LEGACY_FOOD_SOURCE_IDS = {
  alimento: "gymnasia_foods",
  producto_comercial: "gymnasia_products",
  receta: "gymnasia_recipes",
  personal: "user_personal_foods",
} as const satisfies Record<LegacyFoodSource, FoodCatalogSourceId>;

function foodDefinition(
  legacySource: Exclude<LegacyFoodSource, "personal">,
  label: string,
  path: string,
  cacheKey: string,
  legacyCacheKey: string,
): CatalogDefinition<FoodCatalogEntry> {
  const sourceId = LEGACY_FOOD_SOURCE_IDS[legacySource];
  const parse = (value: unknown): FoodCatalogEntry[] | null => {
    if (!Array.isArray(value)) return null;
    const rawEntries = value.map((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
      const { sourceId: cachedSourceId, source: cachedSource, ...raw } = candidate as Record<string, unknown>;
      if ((cachedSourceId !== undefined && cachedSourceId !== sourceId)
        || (cachedSource !== undefined && cachedSource !== legacySource)) {
        return null;
      }
      return raw;
    });
    if (rawEntries.some((entry) => entry === null)) return null;
    return parseFoodCatalog(rawEntries)?.map((entry) => ({
      ...entry,
      sourceId,
      source: legacySource,
    })) ?? null;
  };
  return {
    sourceId,
    label,
    url: `${RAW_BASE_URL}/${path}/all.json`,
    cacheKey: scopedStorageKey(cacheKey),
    legacyCacheKey: scopedStorageKey(legacyCacheKey),
    provenance: { repositoryUrl: REPOSITORY_URL, catalogPath: path },
    parse,
  };
}

export const FOOD_CATALOG_DEFINITIONS = [
  foodDefinition(
    "alimento",
    "Alimentos",
    "alimentos",
    "gymnasia.mobile.foods_repo.v2",
    "gymnasia.mobile.foods_repo.v1",
  ),
  foodDefinition(
    "producto_comercial",
    "Productos comerciales",
    "productos_comerciales",
    "gymnasia.mobile.products_repo.v2",
    "gymnasia.mobile.products_repo.v1",
  ),
  foodDefinition(
    "receta",
    "Recetas",
    "recetas",
    "gymnasia.mobile.recipes_repo.v2",
    "gymnasia.mobile.recipes_repo.v1",
  ),
] as const;

export const EXERCISE_CATALOG_SOURCE = {
  sourceId: "gymnasia_exercises",
  label: "Ejercicios",
  provenance: {
    repositoryUrl: REPOSITORY_URL,
    catalogPath: "ejercicios",
    attributionUrl: `${REPOSITORY_URL}/blob/main/ejercicios/SOURCES.md`,
    licenseLabel: "Consulta la atribución por fuente",
  },
} as const;

export const PERSONAL_FOODS_SOURCE_DEFINITION = {
  sourceId: "user_personal_foods",
  label: "Alimentos personales",
  url: null,
  cacheKey: scopedStorageKey("gymnasia.mobile.personal_foods.v1"),
  provenance: {
    repositoryUrl: "local://device",
    catalogPath: "personal_foods",
    licenseLabel: "Datos privados creados por el usuario",
  },
} as const;

export const CATALOG_SOURCE_REGISTRY = {
  gymnasia_foods: FOOD_CATALOG_DEFINITIONS[0],
  gymnasia_products: FOOD_CATALOG_DEFINITIONS[1],
  gymnasia_recipes: FOOD_CATALOG_DEFINITIONS[2],
  gymnasia_exercises: EXERCISE_CATALOG_SOURCE,
  user_personal_foods: PERSONAL_FOODS_SOURCE_DEFINITION,
} as const;

export function normalizePersonalFood(entry: RawFoodCatalogEntry): FoodCatalogEntry {
  return { ...entry, sourceId: LEGACY_FOOD_SOURCE_IDS.personal, source: "personal" };
}
