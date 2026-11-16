import { describe, expect, it } from "vitest";

import bundledFoods from "../../../alimentos/all.json";
import type { FoodCatalogEntry } from "../catalogs/types";
import { answerCatalogCaloriesLookup } from "./catalogLookup";

const foods: FoodCatalogEntry[] = bundledFoods.map((food) => ({
  ...food,
  sourceId: "gymnasia_foods",
  source: "alimento",
}));

describe("consultas explícitas al catálogo de alimentos", () => {
  it("responde con el dato publicado de arroz blanco incluso sin red ni proveedor", () => {
    expect(answerCatalogCaloriesLookup(
      "Busca arroz blanco en el catálogo y dime sus calorías por 100 g",
      foods,
    )).toBe("En el catálogo, Arroz blanco (cocido) tiene 130 kcal por 100 g.");
  });

  it("deja al proveedor las consultas que no son de calorías de un alimento concreto", () => {
    expect(answerCatalogCaloriesLookup("Busca arroz blanco en el catálogo y prepara una receta", foods)).toBeNull();
    expect(answerCatalogCaloriesLookup("¿Cuántas calorías debería comer al día?", foods)).toBeNull();
    expect(answerCatalogCaloriesLookup(
      "Busca arroz blanco en el catálogo y dime sus calorías por 100 g y añádelo a mi comida",
      foods,
    )).toBeNull();
  });
});
