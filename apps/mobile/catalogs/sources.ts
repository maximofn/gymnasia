import { scopedStorageKey } from "../runtimeEnvironment";
import { parseExerciseCatalog, parseFoodCatalog } from "./schemaValidation";
import type {
  ExerciseCatalogEntry,
  FoodCatalogEntry,
  FoodCatalogSourceId,
  LegacyFoodSource,
  RawExerciseCatalogEntry,
  RawFoodCatalogEntry,
} from "./types";
import type { CatalogDefinition } from "./runtime";

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

export const EXERCISE_CATALOG_DEFINITION: CatalogDefinition<ExerciseCatalogEntry> = {
  sourceId: "gymnasia_exercises",
  label: "Ejercicios",
  url: `${RAW_BASE_URL}/ejercicios/all.json`,
  cacheKey: scopedStorageKey("gymnasia.mobile.exercises_repo.v3"),
  legacyCacheKey: scopedStorageKey("gymnasia.mobile.exercises_repo.v2"),
  provenance: {
    repositoryUrl: REPOSITORY_URL,
    catalogPath: "ejercicios",
    attributionUrl: `${REPOSITORY_URL}/blob/main/ejercicios/SOURCES.md`,
    licenseLabel: "Consulta la atribución por fuente",
  },
  parse: (value) => {
    if (!Array.isArray(value)) return null;
    const rawEntries = value.map((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
      const { sourceId, ...raw } = candidate as Record<string, unknown>;
      if (sourceId !== undefined && sourceId !== "gymnasia_exercises") return null;
      return raw;
    });
    if (rawEntries.some((entry) => entry === null)) return null;
    return parseExerciseCatalog(rawEntries)?.map((entry) => ({
      ...entry,
      sourceId: "gymnasia_exercises",
    })) ?? null;
  },
};

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
  gymnasia_exercises: EXERCISE_CATALOG_DEFINITION,
  user_personal_foods: PERSONAL_FOODS_SOURCE_DEFINITION,
} as const;

export function normalizePersonalFood(entry: RawFoodCatalogEntry): FoodCatalogEntry {
  return { ...entry, sourceId: LEGACY_FOOD_SOURCE_IDS.personal, source: "personal" };
}

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
  entry: RawExerciseCatalogEntry,
  gender: "male" | "female",
): string {
  const imagePath = gender === "female" ? entry.image_female : entry.image_male;
  return `${RAW_BASE_URL}/ejercicios/${imagePath}`;
}
