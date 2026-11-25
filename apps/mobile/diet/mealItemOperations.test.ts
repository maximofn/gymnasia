import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { catalogRef, linkedCatalog, unresolvedCatalog, type FoodCatalogEntry } from "../catalogs/types";
import type { DietItem } from "./model";
import { DIET_MEAL_CATEGORIES } from "./nutritionContract";
import {
  clearDietMeal,
  copyDietMeal,
  dietMealItems,
  locateDietItem,
  moveDietMeal,
  placeItemsInMeal,
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

const copyIds = { createItemId: (index: number) => `copy_${index}`, createMealId };

function categoryItems(diet: DietByDate, date: string, category: string): string[] {
  return diet[date]?.meals.find((meal) => meal.title === category)?.items.map((entry) => entry.id) ?? [];
}

describe("operaciones sobre una comida entera", () => {
  it("coloca varias entradas creando la comida si no existe, en el orden de categorías", () => {
    const diet = sampleDiet();
    const placed = placeItemsInMeal(diet, { date: "2026-11-20", category: "Desayuno" }, [item("a"), item("b")], "append", createMealId);
    expect(placed.replaced).toEqual([]);
    expect(placed.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Desayuno", "Comida", "Cena"]);
    expect(categoryItems(placed.dietByDate, "2026-11-20", "Desayuno")).toEqual(["a", "b"]);
    expect(placed.dietByDate["2026-11-20"].meals[0].id).toBe("meal_new");
    expect(diet["2026-11-20"].meals).toHaveLength(2);
  });

  it("al sumar conserva lo que había y al sustituir devuelve lo que quita", () => {
    const appended = placeItemsInMeal(sampleDiet(), { date: "2026-11-20", category: "Comida" }, [item("a")], "append", createMealId);
    expect(categoryItems(appended.dietByDate, "2026-11-20", "Comida")).toEqual(["comida_rice", "a"]);
    const replaced = placeItemsInMeal(sampleDiet(), { date: "2026-11-20", category: "Comida" }, [item("a")], "replace", createMealId);
    expect(categoryItems(replaced.dietByDate, "2026-11-20", "Comida")).toEqual(["a"]);
    expect(replaced.replaced.map((entry) => entry.id)).toEqual(["comida_rice"]);
    expect(replaced.dietByDate["2026-11-20"].meals.find((meal) => meal.title === "Comida")?.id).toBe("meal_comida");
  });

  it("copia una comida a otro día con los mismos gramos y macros e ids nuevos", () => {
    const diet = sampleDiet();
    const result = copyDietMeal(diet, { date: "2026-11-20", category: "Cena" }, { date: "2026-11-21", category: "Cena" }, copyIds);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copied = dietMealItems(result.value.dietByDate, { date: "2026-11-21", category: "Cena" });
    const original = diet["2026-11-20"].meals[1].items;
    expect(copied.map((entry) => entry.id)).toEqual(["copy_0", "copy_1", "copy_2"]);
    expect(copied.map(({ id: _id, ...rest }) => rest)).toEqual(original.map(({ id: _id, ...rest }) => rest));
    expect(categoryItems(result.value.dietByDate, "2026-11-20", "Cena")).toEqual(["cena_rice_1", "cena_rice_2", "cena_chicken"]);
  });

  it("copia a otra categoría del mismo día", () => {
    const result = copyDietMeal(sampleDiet(), { date: "2026-11-20", category: "Comida" }, { date: "2026-11-20", category: "Merienda" }, copyIds);
    expect(result.ok && categoryItems(result.value.dietByDate, "2026-11-20", "Merienda")).toEqual(["copy_0"]);
    expect(result.ok && categoryItems(result.value.dietByDate, "2026-11-20", "Comida")).toEqual(["comida_rice"]);
  });

  it("mueve una comida a otra categoría conservando los ids y vacía la de origen", () => {
    const result = moveDietMeal(sampleDiet(), { date: "2026-11-20", category: "Cena" }, { date: "2026-11-20", category: "Merienda" }, { createMealId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(categoryItems(result.value.dietByDate, "2026-11-20", "Merienda")).toEqual(["cena_rice_1", "cena_rice_2", "cena_chicken"]);
    expect(result.value.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Comida", "Merienda"]);
    expect(result.value.moved).toHaveLength(3);
  });

  it("mueve una comida a otro día", () => {
    const result = moveDietMeal(sampleDiet(), { date: "2026-11-20", category: "Comida" }, { date: "2026-11-22", category: "Comida" }, { createMealId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(categoryItems(result.value.dietByDate, "2026-11-22", "Comida")).toEqual(["comida_rice"]);
    expect(result.value.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Cena"]);
  });

  it("si el destino tiene alimentos y no se indica qué hacer, no toca nada y dice qué hay", () => {
    const diet = sampleDiet();
    const copy = copyDietMeal(diet, { date: "2026-11-20", category: "Cena" }, { date: "2026-11-20", category: "Comida" }, copyIds);
    expect(copy).toMatchObject({ ok: false, error: { code: "destination_not_empty", existing: [expect.objectContaining({ id: "comida_rice" })] } });
    const move = moveDietMeal(diet, { date: "2026-11-20", category: "Cena" }, { date: "2026-11-20", category: "Comida" }, { createMealId });
    expect(move).toMatchObject({ ok: false, error: { code: "destination_not_empty" } });
  });

  it("mover sobre una comida con alimentos solo pierde lo que había si se pide sustituir", () => {
    const appended = moveDietMeal(sampleDiet(), { date: "2026-11-20", category: "Cena" }, { date: "2026-11-20", category: "Comida" }, { placement: "append", createMealId });
    expect(appended.ok && categoryItems(appended.value.dietByDate, "2026-11-20", "Comida")).toEqual(["comida_rice", "cena_rice_1", "cena_rice_2", "cena_chicken"]);
    expect(appended.ok && appended.value.replaced).toEqual([]);
    const replaced = moveDietMeal(sampleDiet(), { date: "2026-11-20", category: "Cena" }, { date: "2026-11-20", category: "Comida" }, { placement: "replace", createMealId });
    expect(replaced.ok && categoryItems(replaced.value.dietByDate, "2026-11-20", "Comida")).toEqual(["cena_rice_1", "cena_rice_2", "cena_chicken"]);
    expect(replaced.ok && replaced.value.replaced.map((entry) => entry.id)).toEqual(["comida_rice"]);
  });

  it("rechaza copiar o mover una comida sobre sí misma", () => {
    const locator = { date: "2026-11-20", category: "Cena" as const };
    expect(copyDietMeal(sampleDiet(), locator, { ...locator }, copyIds)).toMatchObject({ ok: false, error: { code: "same_meal" } });
    expect(moveDietMeal(sampleDiet(), locator, { ...locator }, { createMealId })).toMatchObject({ ok: false, error: { code: "same_meal" } });
  });

  it("rechaza copiar, mover o vaciar una comida o un día sin alimentos", () => {
    const target = { date: "2026-11-21", category: "Cena" as const };
    expect(copyDietMeal(sampleDiet(), { date: "2026-11-20", category: "Desayuno" }, target, copyIds)).toMatchObject({ ok: false, error: { code: "meal_empty" } });
    expect(moveDietMeal(sampleDiet(), { date: "2026-11-25", category: "Cena" }, target, { createMealId })).toMatchObject({ ok: false, error: { code: "meal_empty" } });
    expect(clearDietMeal(sampleDiet(), { date: "2026-11-25", category: "Cena" })).toMatchObject({ ok: false, error: { code: "meal_empty" } });
    expect(clearDietMeal(sampleDiet(), { date: "2026-11-20", category: "Desayuno" })).toMatchObject({ ok: false, error: { code: "meal_empty" } });
  });

  it("vacía una comida sin tocar las demás y devuelve lo que quitó", () => {
    const diet = sampleDiet();
    const result = clearDietMeal(diet, { date: "2026-11-20", category: "Cena" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cleared.map((entry) => entry.id)).toEqual(["cena_rice_1", "cena_rice_2", "cena_chicken"]);
    expect(result.value.dietByDate["2026-11-20"].meals).toEqual([diet["2026-11-20"].meals[0]]);
    expect(diet["2026-11-20"].meals).toHaveLength(2);
  });
});

describe("propiedades de las operaciones sobre comidas enteras", () => {
  it("mover una comida a una vacía y devolverla deja los datos igual", () => {
    fc.assert(fc.property(
      dietArbitrary,
      fc.nat(),
      fc.constantFrom(...dates),
      fc.constantFrom(...DIET_MEAL_CATEGORIES),
      (diet, pick, toDate, toCategory) => {
        const entries = allEntries(diet);
        const picked = entries[pick % entries.length];
        const source = { date: picked.date, category: picked.category as (typeof DIET_MEAL_CATEGORIES)[number] };
        const target = { date: toDate, category: toCategory };
        fc.pre(dietMealItems(diet, target).length === 0);
        const there = moveDietMeal(diet, source, target, { createMealId });
        expect(there.ok).toBe(true);
        if (!there.ok) return;
        const back = moveDietMeal(there.value.dietByDate, target, source, { createMealId });
        expect(back.ok).toBe(true);
        if (!back.ok) return;
        expect(canonical(back.value.dietByDate)).toEqual(canonical(diet));
      },
    ), { seed: 275275, numRuns: 300 });
  });

  it("vaciar una comida nunca cambia las demás ni sus totales", () => {
    fc.assert(fc.property(dietArbitrary, fc.nat(), (diet, pick) => {
      const entries = allEntries(diet);
      const picked = entries[pick % entries.length];
      const result = clearDietMeal(diet, { date: picked.date, category: picked.category as never });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const prefix = `${picked.date}|${picked.category}|`;
      expect(canonical(result.value.dietByDate)).toEqual(canonical(diet).filter((line) => !line.startsWith(prefix)));
    }), { seed: 275276, numRuns: 300 });
  });

  it("copiar una comida no cambia el origen ni las comidas ajenas al destino", () => {
    fc.assert(fc.property(
      dietArbitrary,
      fc.nat(),
      fc.constantFrom(...dates),
      fc.constantFrom(...DIET_MEAL_CATEGORIES),
      fc.constantFrom("replace" as const, "append" as const),
      (diet, pick, toDate, toCategory, placement) => {
        const entries = allEntries(diet);
        const picked = entries[pick % entries.length];
        const source = { date: picked.date, category: picked.category as (typeof DIET_MEAL_CATEGORIES)[number] };
        fc.pre(source.date !== toDate || source.category !== toCategory);
        const result = copyDietMeal(diet, source, { date: toDate, category: toCategory }, { ...copyIds, placement });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const targetPrefix = `${toDate}|${toCategory}|`;
        expect(canonical(result.value.dietByDate).filter((line) => !line.startsWith(targetPrefix)))
          .toEqual(canonical(diet).filter((line) => !line.startsWith(targetPrefix)));
        const expectedTarget = placement === "append"
          ? dietMealItems(diet, { date: toDate, category: toCategory }).length + dietMealItems(diet, source).length
          : dietMealItems(diet, source).length;
        expect(dietMealItems(result.value.dietByDate, { date: toDate, category: toCategory })).toHaveLength(expectedTarget);
      },
    ), { seed: 275277, numRuns: 300 });
  });
});
