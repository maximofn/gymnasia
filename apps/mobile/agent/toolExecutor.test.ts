import { describe, expect, it, vi } from "vitest";

import {
  createAgentToolExecutor,
  type ToolExecutorDependencies,
  type ToolFoodRepoEntry,
  type ToolStore,
} from "./toolExecutor";

function createDependencies(
  overrides: Partial<ToolExecutorDependencies> = {},
): ToolExecutorDependencies {
  return {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => [],
    saveMeasurements: async () => {},
    sortMeasurements: (measurements) => measurements,
    createId: (prefix) => `${prefix}_test`,
    getExerciseImageUrl: (exercise, sex) => `${sex}/${exercise.image_male}`,
    submitFeedbackIssue: async () => ({ status: "canceled" as const }),
    ...overrides,
  };
}

const foods: ToolFoodRepoEntry[] = [
  {
    id: "rice",
    name: "Arroz blanco",
    category: "cereal",
    source: "alimento",
    calories_per_100g: 130,
    protein_per_100g: 2.7,
    carbs_per_100g: 28,
    fat_per_100g: 0.3,
    fiber_per_100g: 0.4,
    serving_size_g: 100,
    serving_description: "100 g",
  },
  {
    id: "chicken",
    name: "Pechuga de pollo",
    category: "proteína",
    source: "alimento",
    calories_per_100g: 165,
    protein_per_100g: 31,
    carbs_per_100g: 0,
    fat_per_100g: 3.6,
    fiber_per_100g: 0,
    serving_size_g: 150,
    serving_description: "1 filete",
  },
];

function createEmptyStore(): ToolStore {
  return { templates: [], dietByDate: {}, measurements: [] };
}

describe("ejecutor de tools", () => {
  it("despacha una búsqueda pura con filtros y ordenación", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    const result = await execute("search_foods", {
      min_protein: 2,
      sort_by: "protein_desc",
    }, { foodsRepo: foods });
    const parsed = JSON.parse(result) as Array<{ id: string; proteina_por_100g: number }>;
    expect(parsed.map((food) => food.id)).toEqual(["chicken", "rice"]);
    expect(parsed[0].proteina_por_100g).toBe(31);
  });

  it("mantiene respuestas controladas para tools y JSON desconocidos", async () => {
    const saveMeasurements = vi.fn(async () => {});
    const execute = createAgentToolExecutor(createDependencies({ saveMeasurements }));
    await expect(execute("unknown_tool", {})).resolves.toBe("Herramienta no reconocida.");
    await expect(execute("write_measurement", {
      date: "2026-04-11",
      data: "{json roto",
    })).resolves.toBe("El JSON de medidas no es válido.");
    expect(saveMeasurements).not.toHaveBeenCalled();
  });

  it("inyecta almacenamiento y efectos externos para poder probarlos sin Expo", async () => {
    const savePersonalData = vi.fn(async () => {});
    const execute = createAgentToolExecutor(createDependencies({ savePersonalData }));
    const serialized = JSON.stringify([
      { key: "Objetivo", description: "Meta", value: "Ganar músculo" },
    ]);
    await expect(execute("save_personal_data", { personal_data: serialized })).resolves.toBe(
      "Datos personales guardados correctamente.",
    );
    expect(savePersonalData).toHaveBeenCalledWith([
      { key: "Objetivo", description: "Meta", value: "Ganar músculo" },
    ]);
  });

  it("guarda un alimento válido aunque todos sus valores nutricionales sean cero", async () => {
    let store = createEmptyStore();
    const setStore = vi.fn((updater: (previous: ToolStore) => ToolStore) => {
      store = updater(store);
    });
    const execute = createAgentToolExecutor(createDependencies());
    const result = await execute("add_meal_food", {
      date: "2026-04-11",
      meal: "Desayuno",
      data: JSON.stringify({
        name: "Agua",
        grams: 0,
        calories_kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      }),
    }, { setStore });

    expect(result).toContain('Alimento "Agua"');
    expect(setStore).toHaveBeenCalledOnce();
    expect(store.dietByDate["2026-04-11"].meals[0]).toEqual(expect.objectContaining({
      title: "Desayuno",
      items: [expect.objectContaining({ title: "Agua", calories_kcal: 0 })],
    }));
  });

  it("no escribe ni crea ids cuando un nutriente es inválido", async () => {
    const setStore = vi.fn();
    const createId = vi.fn((prefix: string) => `${prefix}_test`);
    const execute = createAgentToolExecutor(createDependencies({ createId }));
    const result = await execute("add_meal_food", {
      date: "2026-04-11",
      meal: "Cena",
      data: JSON.stringify({
        name: "Cena imposible",
        grams: 100,
        calories_kcal: -20,
        protein_g: 10,
        carbs_g: 5,
        fat_g: 2,
      }),
    }, { setStore });

    expect(result).toContain("No se añadió el alimento");
    expect(result).toContain("Las calorías deben ser 0 o más");
    expect(setStore).not.toHaveBeenCalled();
    expect(createId).not.toHaveBeenCalled();
  });

  it("rechaza categorías arbitrarias sin alterar la dieta", async () => {
    const setStore = vi.fn();
    const execute = createAgentToolExecutor(createDependencies());
    const result = await execute("add_meal_food", {
      date: "2026-04-11",
      meal: "Picoteo nocturno",
      data: JSON.stringify({
        name: "Yogur",
        grams: 125,
        calories_kcal: 80,
        protein_g: 5,
        carbs_g: 8,
        fat_g: 3,
      }),
    }, { setStore });

    expect(result).toContain("no es una categoría reconocida");
    expect(setStore).not.toHaveBeenCalled();
  });

  it("normaliza una categoría conocida al leer", async () => {
    const store = createEmptyStore();
    store.dietByDate["2026-04-11"] = {
      day_date: "2026-04-11",
      meals: [{
        id: "meal_test",
        title: "Desayuno",
        items: [{
          id: "food_test",
          title: "Agua",
          grams: 0,
          calories_kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        }],
      }],
    };
    const execute = createAgentToolExecutor(createDependencies());
    const result = await execute("read_meal_foods", {
      date: "2026-04-11",
      meal: "  desayuno ",
    }, { store });

    expect(JSON.parse(result)).toEqual([expect.objectContaining({ nombre: "Agua" })]);
  });
});
