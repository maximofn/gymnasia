import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { matchExerciseCatalog, matchFoodCatalog, normalizeCatalogName } from "./matching";
import type { ExerciseCatalogEntry, FoodCatalogEntry } from "./types";

function food(id: string, name: string, sourceId: FoodCatalogEntry["sourceId"]): FoodCatalogEntry {
  return {
    id, name, sourceId,
    source: sourceId === "gymnasia_products" ? "producto_comercial" : "alimento",
    category: "test", calories_per_100g: 1, protein_per_100g: 1,
    carbs_per_100g: 1, fat_per_100g: 1, fiber_per_100g: 1,
    serving_size_g: 100, serving_description: "100 g",
  };
}

function exercise(id: string, name: string): ExerciseCatalogEntry {
  return {
    id, name, sourceId: "gymnasia_exercises",
    image_male: `images/${id}-male.webp`, image_female: `images/${id}-female.webp`,
    muscle_group: "Pecho", secondary_muscles: [], equipment: "Barra",
    difficulty: "Intermedio", instructions: "Control.",
  };
}

describe("matcher de catálogos", () => {
  it("normaliza Unicode, diacríticos, mayúsculas y espacios", () => {
    expect(normalizeCatalogName("  CAFÉ\u00a0 con   LECHE ")).toBe("cafe con leche");
  });

  it("trata como ambiguas las coincidencias exactas duplicadas entre fuentes", () => {
    const match = matchFoodCatalog([
      food("zeta", "Yogur natural", "gymnasia_products"),
      food("alfa", "Yógur natural", "gymnasia_foods"),
    ], "yogur natural");
    expect(match).toEqual({
      kind: "ambiguous",
      candidates: [
        expect.objectContaining({ sourceId: "gymnasia_foods", id: "alfa" }),
        expect.objectContaining({ sourceId: "gymnasia_products", id: "zeta" }),
      ],
    });
  });

  it("no depende del orden de entrada", () => {
    const entries = [food("b", "Arroz blanco", "gymnasia_products"), food("a", "Arroz blanco", "gymnasia_foods")];
    fc.assert(fc.property(fc.shuffledSubarray(entries, { minLength: 2, maxLength: 2 }), (permutation) => {
      const match = matchFoodCatalog(permutation, "ARROZ BLANCO");
      expect(match.kind).toBe("ambiguous");
      if (match.kind === "ambiguous") {
        expect(match.candidates.map((entry) => `${entry.sourceId}/${entry.id}`)).toEqual([
          "gymnasia_foods/a", "gymnasia_products/b",
        ]);
      }
    }));
  });

  it("reconoce el alias tolerante de ejercicios sin elegir entre duplicados", () => {
    expect(matchExerciseCatalog([exercise("lateral", "Elevaciones laterales con mancuernas")], "Elevación lateral (mancuerna)")).toEqual({
      kind: "alias",
      candidate: expect.objectContaining({ id: "lateral" }),
    });
  });
});
