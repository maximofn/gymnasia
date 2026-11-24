import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { catalogRef, linkedCatalog, unresolvedCatalog, type FoodCatalogEntry } from "../catalogs/types";
import type { DietItem } from "./model";
import { DIET_MEAL_CATEGORIES } from "./nutritionContract";
import {
  locateDietItem,
  moveDietItem,
  removeDietItem,
  replaceDietItem,
  rescaleDietItem,
  type DietByDate,
} from "./mealItemOperations";

const rice: FoodCatalogEntry = {
  id: "rice",
  name: "Arroz blanco",
  category: "cereal",
  source: "alimento",
  sourceId: "gymnasia_foods",
  calories_per_100g: 130,
  protein_per_100g: 2.7,
  carbs_per_100g: 28,
  fat_per_100g: 0.3,
  fiber_per_100g: 0.4,
  serving_size_g: 100,
  serving_description: "100 g",
};

function item(id: string, overrides: Partial<DietItem> = {}): DietItem {
  return {
    id,
    title: "Arroz blanco",
    grams: 150,
    calories_kcal: 195,
    protein_g: 4.1,
    carbs_g: 42,
    fat_g: 0.5,
    catalog_link: linkedCatalog(catalogRef("gymnasia_foods", "rice"), "tool"),
    ...overrides,
  };
}

function sampleDiet(): DietByDate {
  return {
    "2026-11-20": {
      day_date: "2026-11-20",
      meals: [
        { id: "meal_comida", title: "Comida", items: [item("comida_rice")] },
        { id: "meal_cena", title: "Cena", items: [item("cena_rice_1"), item("cena_rice_2"), item("cena_chicken", { title: "Pollo" })] },
      ],
    },
  };
}

const createMealId = () => "meal_new";

describe("operaciones sobre una entrada de una comida", () => {
  it("localiza por id y comida, no por nombre", () => {
    const diet = sampleDiet();
    expect(locateDietItem(diet, { date: "2026-11-20", meal: { category: "Cena" }, itemId: "cena_rice_2" })?.item.id).toBe("cena_rice_2");
    expect(locateDietItem(diet, { date: "2026-11-20", meal: { category: "Comida" }, itemId: "cena_rice_2" })).toBeNull();
    expect(locateDietItem(diet, { date: "2026-11-20", meal: { id: "meal_cena" }, itemId: "cena_rice_1" })?.meal.title).toBe("Cena");
    expect(locateDietItem(diet, { date: "2026-11-21", meal: { category: "Cena" }, itemId: "cena_rice_1" })).toBeNull();
  });

  it("quita una de dos entradas iguales y deja intacta la otra y la de otra comida", () => {
    const diet = sampleDiet();
    const result = removeDietItem(diet, { date: "2026-11-20", meal: { category: "Cena" }, itemId: "cena_rice_1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meals = result.value.dietByDate["2026-11-20"].meals;
    expect(meals.find((meal) => meal.title === "Cena")?.items.map((entry) => entry.id)).toEqual(["cena_rice_2", "cena_chicken"]);
    expect(meals.find((meal) => meal.title === "Comida")?.items.map((entry) => entry.id)).toEqual(["comida_rice"]);
    expect(result.value.removed.id).toBe("cena_rice_1");
    expect(diet["2026-11-20"].meals[1].items).toHaveLength(3);
  });

  it("falla sin tocar nada si la entrada no está en esa comida", () => {
    const diet = sampleDiet();
    const result = removeDietItem(diet, { date: "2026-11-20", meal: { category: "Comida" }, itemId: "cena_rice_1" });
    expect(result).toMatchObject({ ok: false, error: { code: "entry_not_found" } });
  });

  it("elimina la comida que se queda vacía", () => {
    const result = removeDietItem(sampleDiet(), { date: "2026-11-20", meal: { category: "Comida" }, itemId: "comida_rice" });
    expect(result.ok && result.value.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Cena"]);
  });

  it("sustituye conservando id y posición", () => {
    const result = replaceDietItem(
      sampleDiet(),
      { date: "2026-11-20", meal: { id: "meal_cena" }, itemId: "cena_rice_1" },
      item("otro_id", { grams: 100 }),
    );
    expect(result.ok && result.value.dietByDate["2026-11-20"].meals[1].items.map((entry) => [entry.id, entry.grams])).toEqual([
      ["cena_rice_1", 100], ["cena_rice_2", 150], ["cena_chicken", 150],
    ]);
  });

  it("mueve a una comida existente, a una nueva y a otro día", () => {
    const toComida = moveDietItem(sampleDiet(), { date: "2026-11-20", meal: { category: "Cena" }, itemId: "cena_chicken" }, { date: "2026-11-20", category: "Comida" }, createMealId);
    expect(toComida.ok && toComida.value.dietByDate["2026-11-20"].meals.map((meal) => [meal.title, meal.items.map((entry) => entry.id)])).toEqual([
      ["Comida", ["comida_rice", "cena_chicken"]],
      ["Cena", ["cena_rice_1", "cena_rice_2"]],
    ]);
    const toBreakfast = moveDietItem(sampleDiet(), { date: "2026-11-20", meal: { category: "Comida" }, itemId: "comida_rice" }, { date: "2026-11-20", category: "Desayuno" }, createMealId);
    expect(toBreakfast.ok && toBreakfast.value.dietByDate["2026-11-20"].meals.map((meal) => [meal.id, meal.title])).toEqual([
      ["meal_new", "Desayuno"], ["meal_cena", "Cena"],
    ]);
    const toYesterday = moveDietItem(sampleDiet(), { date: "2026-11-20", meal: { category: "Cena" }, itemId: "cena_rice_1" }, { date: "2026-11-19", category: "Cena" }, createMealId);
    expect(toYesterday.ok && toYesterday.value.dietByDate["2026-11-19"]).toEqual({
      day_date: "2026-11-19",
      meals: [{ id: "meal_new", title: "Cena", items: [expect.objectContaining({ id: "cena_rice_1" })] }],
    });
  });

  it("recalcula los gramos desde la ficha del catálogo", () => {
    const result = rescaleDietItem(item("a"), 100, [rice]);
    expect(result).toEqual({ ok: true, value: expect.objectContaining({ grams: 100, calories_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }) });
  });

  it("escala en proporción un alimento manual o con la ficha ya no disponible", () => {
    const manual = item("m", { grams: 200, calories_kcal: 300, protein_g: 10, carbs_g: 40, fat_g: 8, catalog_link: unresolvedCatalog("manual") });
    expect(rescaleDietItem(manual, 100, [rice])).toEqual({ ok: true, value: expect.objectContaining({ grams: 100, calories_kcal: 150, protein_g: 5, carbs_g: 20, fat_g: 4 }) });
    expect(rescaleDietItem(item("a"), 100, [])).toEqual({ ok: true, value: expect.objectContaining({ grams: 100, calories_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }) });
  });

  it("rechaza gramos no positivos y entradas sin gramos de referencia", () => {
    expect(rescaleDietItem(item("a"), 0, [rice])).toMatchObject({ ok: false, error: { code: "invalid_grams" } });
    expect(rescaleDietItem(item("a", { grams: 0, catalog_link: unresolvedCatalog("manual") }), 100, [])).toMatchObject({ ok: false, error: { code: "cannot_scale" } });
  });
});

const dates = ["2026-11-19", "2026-11-20"] as const;

const dietArbitrary = fc.uniqueArray(
  fc.record({
    date: fc.constantFrom(...dates),
    category: fc.constantFrom(...DIET_MEAL_CATEGORIES),
    grams: fc.integer({ min: 1, max: 500 }),
  }),
  { minLength: 1, maxLength: 12, selector: (value) => `${value.date}:${value.category}:${value.grams}` },
).map((entries) => {
  const diet: DietByDate = {};
  entries.forEach((entry, index) => {
    const day = diet[entry.date] ?? (diet[entry.date] = { day_date: entry.date, meals: [] });
    let meal = day.meals.find((candidate) => candidate.title === entry.category);
    if (!meal) {
      meal = { id: `meal_${entry.date}_${entry.category}`, title: entry.category, items: [] };
      day.meals.push(meal);
    }
    meal.items.push(item(`food_${index}`, { grams: entry.grams }));
  });
  return diet;
});

function allEntries(diet: DietByDate): Array<{ date: string; category: string; item: DietItem }> {
  return Object.values(diet).flatMap((day) => day.meals.flatMap((meal) => meal.items.map((entry) => ({ date: day.day_date, category: meal.title, item: entry }))));
}

/** Contenido del día sin depender del orden dentro de cada comida ni de los ids de comida. */
function canonical(diet: DietByDate) {
  return allEntries(diet)
    .map((entry) => `${entry.date}|${entry.category}|${JSON.stringify(entry.item)}`)
    .sort();
}

describe("propiedades de las operaciones sobre entradas", () => {
  it("mover una entrada y devolverla deja los datos igual", () => {
    fc.assert(fc.property(
      dietArbitrary,
      fc.nat(),
      fc.constantFrom(...dates),
      fc.constantFrom(...DIET_MEAL_CATEGORIES),
      (diet, pick, toDate, toCategory) => {
        const entries = allEntries(diet);
        const source = entries[pick % entries.length];
        const there = moveDietItem(diet, { date: source.date, meal: { category: source.category as never }, itemId: source.item.id }, { date: toDate, category: toCategory }, createMealId);
        expect(there.ok).toBe(true);
        if (!there.ok) return;
        const back = moveDietItem(there.value.dietByDate, { date: toDate, meal: { category: toCategory }, itemId: source.item.id }, { date: source.date, category: source.category as never }, createMealId);
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(canonical(back.value.dietByDate)).toEqual(canonical(diet));
      },
    ), { seed: 271271, numRuns: 300 });
  });

  it("quitar una entrada nunca afecta a las demás", () => {
    fc.assert(fc.property(dietArbitrary, fc.nat(), (diet, pick) => {
      const entries = allEntries(diet);
      const target = entries[pick % entries.length];
      const result = removeDietItem(diet, { date: target.date, meal: { category: target.category as never }, itemId: target.item.id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const expected = canonical(diet).filter((line) => !line.includes(`"id":"${target.item.id}"`));
      expect(canonical(result.value.dietByDate)).toEqual(expected);
    }), { seed: 271272, numRuns: 300 });
  });
});
