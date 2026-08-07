import { describe, expect, it, vi } from "vitest";

import {
  createAgentToolExecutor,
  type ToolExecutorDependencies,
  type ToolFoodRepoEntry,
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
    createFeatureIssue: async () => {},
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
});
