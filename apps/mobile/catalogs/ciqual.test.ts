import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { CIQUAL_FOODS, CIQUAL_SOURCE } from "./ciqual";
import { formatFoodNutrient, hasCompleteFoodNutrition } from "./foodNutrition";
import { missingCatalogNutritionIssues } from "../diet/nutritionContract";
import { foodCatalogImageUri } from "./imageUris";
import { dietItemFromCatalog, findDietFoodInCatalog } from "../diet/catalogModel";
import { normalizeCatalogLink } from "./migrations";
import { catalogRef, linkedCatalog } from "./types";
import { createAgentToolExecutor, type ToolStore } from "../agent/toolExecutor";

const rice = CIQUAL_FOODS.find((food) => food.id === "ciqual-9100")!;
const incomplete = CIQUAL_FOODS.find((food) => food.calories_per_100g !== null && food.fat_per_100g === null)!;
const execute = () => createAgentToolExecutor({ loadPersonalData: async () => [], savePersonalData: async () => {}, loadMeasurements: async () => [], createId: (prefix) => `${prefix}_ciqual`, getExerciseImageUrl: () => "", submitFeedbackIssue: async () => ({ status: "canceled" }) });

describe("CIQUAL local y sus consumidores", () => {
  it("exige valores explícitos al completar una ficha incompleta y admite ceros reales", () => {
    const fields = { grams: "100", calories_kcal: "159", protein_g: "0.6", carbs_g: "17.8", fat_g: "" };
    expect(missingCatalogNutritionIssues(fields)).toEqual([expect.objectContaining({ field: "fat_g", code: "required" })]);
    expect(missingCatalogNutritionIssues({ ...fields, fat_g: "0" })).toEqual([]);
  });
  it("incluye 3.484 alimentos sin inventar imágenes ni raciones", () => {
    expect(CIQUAL_FOODS).toHaveLength(3484);
    expect(CIQUAL_FOODS.filter(hasCompleteFoodNutrition)).toHaveLength(3006);
    expect(CIQUAL_SOURCE.provenance.licenseLabel).toContain("Licence Ouverte 2.0");
    for (const food of CIQUAL_FOODS) {
      expect(food.serving_size_g).toBeNull();
      expect(foodCatalogImageUri(food)).toBeNull();
    }
  });
  it("conserva referencias al normalizar datos o backups", () => {
    const link = linkedCatalog(catalogRef(rice.sourceId, rice.id), "selection");
    expect(normalizeCatalogLink(link)).toEqual(link);
  });
  it("escala los valores exactos por gramos y bloquea fichas incompletas", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5000 }), (grams) => {
      const item = dietItemFromCatalog(rice, grams, "test", "selection");
      expect(item.calories_kcal).toBe(Math.round(350 * grams / 100 * 10) / 10);
      expect(item.catalog_link).toMatchObject({ ref: { sourceId: "anses_ciqual_2025", itemId: "ciqual-9100" } });
    }));
    expect(() => dietItemFromCatalog(incomplete, 100, "test", "selection")).toThrow(/Faltan datos/);
    expect(findDietFoodInCatalog(incomplete.name, [incomplete], [])).toEqual({ kind: "not_found" });
  });
  it("presenta límites, trazas y ausencias sin convertirlos en cero", () => {
    for (const qualifier of ["less_than", "trace", "missing"] as const) {
      const food = CIQUAL_FOODS.find((food) => food.ciqual?.qualifiers.fat_per_100g.qualifier === qualifier)!;
      expect(food.fat_per_100g).toBeNull();
      expect(formatFoodNutrient(food, "fat_per_100g")).toBe(qualifier === "trace" ? "Trazas" : qualifier === "missing" ? "No disponible" : `<${food.ciqual!.qualifiers.fat_per_100g.limit}`);
    }
  });
  it("Coach devuelve nulos y calificadores, excluye desconocidos de filtros y los ordena al final", async () => {
    const call = execute();
    const context = { foodsRepo: [incomplete, rice] };
    const search = JSON.parse(await call("search_foods", { source: "anses_ciqual_2025", sort_by: "fat_asc" }, context));
    expect(search.results[0].item_id).toBe(rice.id);
    expect(search.results[1]).toMatchObject({ grasa_por_100g: null, racion_g: null, nutricion_completa: false });
    expect(search.results[1].calificadores.fat_per_100g).toEqual(incomplete.ciqual!.qualifiers.fat_per_100g);
    const filtered = JSON.parse(await call("search_foods", { min_fat: 0 }, context));
    expect(filtered.results.map((food: { item_id: string }) => food.item_id)).toEqual([rice.id]);
  });
  it("Coach guarda una instantánea válida y no escribe sin datos exactos", async () => {
    let store: ToolStore = { templates: [], dietByDate: {}, measurements: [] };
    const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => { store = updater(store); });
    const call = execute();
    const args = (itemId: string) => ({ date: "2026-10-29", meal: "Comida", data: JSON.stringify({ kind: "catalog", source_id: "anses_ciqual_2025", item_id: itemId, grams: 150 }) });
    const context = { foodsRepo: [rice, incomplete], commitStore };
    expect(JSON.parse(await call("add_meal_food", args(incomplete.id), context))).toMatchObject({ error: "incomplete_nutrition", written: false });
    expect(commitStore).not.toHaveBeenCalled();
    await call("add_meal_food", args(rice.id), context);
    expect(commitStore).toHaveBeenCalledOnce();
    expect(store.dietByDate["2026-10-29"].meals[0].items[0]).toMatchObject({ grams: 150, calories_kcal: 525, protein_g: 10.5, carbs_g: 116.3, fat_g: 1.2, catalog_link: { ref: { sourceId: "anses_ciqual_2025", itemId: "ciqual-9100" } } });
  });
});
