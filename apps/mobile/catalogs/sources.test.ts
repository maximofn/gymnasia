import { describe, expect, it, vi } from "vitest";

vi.mock("../runtimeEnvironment", () => ({
  scopedStorageKey: (key: string) => `test:${key}`,
}));

import {
  CATALOG_SOURCE_REGISTRY,
  EXERCISE_CATALOG_DEFINITION,
  FOOD_CATALOG_DEFINITIONS,
  exerciseCatalogImageUri,
} from "./sources";

describe("registro cerrado de fuentes", () => {
  it("declara exactamente las cinco fuentes confiables", () => {
    expect(Object.keys(CATALOG_SOURCE_REGISTRY).sort()).toEqual([
      "gymnasia_exercises",
      "gymnasia_foods",
      "gymnasia_products",
      "gymnasia_recipes",
      "user_personal_foods",
    ]);
    expect(FOOD_CATALOG_DEFINITIONS.map((definition) => definition.cacheKey)).toEqual([
      "test:gymnasia.mobile.foods_repo.v2",
      "test:gymnasia.mobile.products_repo.v2",
      "test:gymnasia.mobile.recipes_repo.v2",
    ]);
  });

  it("enlaza los ejercicios a la atribución por fuente sin asignar una licencia global", () => {
    expect(EXERCISE_CATALOG_DEFINITION.provenance.attributionUrl).toContain("ejercicios/SOURCES.md");
    expect(EXERCISE_CATALOG_DEFINITION.provenance.licenseLabel).toBe("Consulta la atribución por fuente");
  });

  it("rechaza metadatos de fuente discordantes en vez de reasignarlos silenciosamente", () => {
    const food = {
      id: "arroz", name: "Arroz", category: "cereal", calories_per_100g: 130,
      protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3,
      fiber_per_100g: 0.4, serving_size_g: 100, serving_description: "100 g",
      sourceId: "gymnasia_products", source: "producto_comercial",
    };
    expect(FOOD_CATALOG_DEFINITIONS[0].parse([food])).toBeNull();
  });

  it("resuelve las imágenes de ambos géneros desde el mismo ID estable", () => {
    const exercise = {
      id: "press-banca", name: "Press banca",
      image_male: "images/press-banca-male.webp",
      image_female: "images/press-banca-female.webp",
      muscle_group: "Pecho", secondary_muscles: ["Tríceps"], equipment: "Barra",
      difficulty: "Intermedio", instructions: "Empuja con control.",
    };
    expect(exerciseCatalogImageUri(exercise, "male")).toMatch(/press-banca-male\.webp$/);
    expect(exerciseCatalogImageUri(exercise, "female")).toMatch(/press-banca-female\.webp$/);
  });
});
