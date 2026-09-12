import { describe, expect, it } from "vitest";

import type { FoodCatalogEntry } from "../catalogs/types";
import { dietItemFromCatalog, findDietFoodInCatalog } from "./catalogModel";

const food: FoodCatalogEntry = {
  id: "apple",
  sourceId: "gymnasia_foods",
  source: "alimento",
  name: "Manzana",
  category: "Fruta",
  calories_per_100g: 52,
  protein_per_100g: 0.3,
  carbs_per_100g: 14,
  fat_per_100g: 0.2,
  fiber_per_100g: 2.4,
  serving_size_g: 100,
  serving_description: "1 unidad",
  image: "manzana.png",
};

describe("diet catalog model", () => {
  it("busca en catálogos remotos y personales como una sola colección", () => {
    const personal = { ...food, id: "personal", sourceId: "user_personal_foods" as const };
    expect(findDietFoodInCatalog("Manzana", [], [personal])).toMatchObject({
      kind: "exact",
      candidate: personal,
    });
  });

  it("escala nutrientes y conserva un enlace canónico al catálogo", () => {
    expect(dietItemFromCatalog(food, 150, "item-1", "selection")).toMatchObject({
      id: "item-1",
      title: "Manzana",
      grams: 150,
      calories_kcal: 78,
      protein_g: 0.5,
      carbs_g: 21,
      fat_g: 0.3,
      catalog_link: {
        status: "linked",
        linkedBy: "selection",
        ref: { sourceId: "gymnasia_foods", itemId: "apple" },
      },
    });
  });
});
