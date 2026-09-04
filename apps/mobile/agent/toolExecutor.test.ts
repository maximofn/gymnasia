import { describe, expect, it, vi } from "vitest";

import {
  createAgentToolExecutor,
  createDetailedAgentToolExecutor,
  type ToolExecutorDependencies,
  type ToolExerciseRepoEntry,
  type ToolFoodRepoEntry,
  type ToolStore,
} from "./toolExecutor";
import type { CatalogSearchAvailability } from "../catalogs/types";

function createDependencies(
  overrides: Partial<ToolExecutorDependencies> = {},
): ToolExecutorDependencies {
  return {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => [],
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
    sourceId: "gymnasia_foods",
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
    sourceId: "gymnasia_foods",
    calories_per_100g: 165,
    protein_per_100g: 31,
    carbs_per_100g: 0,
    fat_per_100g: 3.6,
    fiber_per_100g: 0,
    serving_size_g: 150,
    serving_description: "1 filete",
  },
];

const exercises: ToolExerciseRepoEntry[] = [{
  id: "sentadilla",
  sourceId: "gymnasia_exercises",
  name: "Sentadilla",
  image_male: "images/sentadilla-male.webp",
  image_female: "images/sentadilla-female.webp",
  muscle_group: "Cuádriceps",
  secondary_muscles: ["Glúteos"],
  equipment: "Barra",
  difficulty: "Intermedio",
  instructions: "Baja con control.",
}];

function createEmptyStore(): ToolStore {
  return { templates: [], dietByDate: {}, measurements: [] };
}

function createMeasurement(id: string, measuredOn: string, weightKg: number | null = null) {
  return {
    id,
    measured_on: measuredOn,
    measured_at: `${measuredOn}T12:00:00.000Z`,
    weight_kg: weightKg,
    body_fat_pct: null,
    photo_uri: null,
    neck_cm: null,
    chest_cm: null,
    waist_cm: null,
    hips_cm: null,
    biceps_cm: null,
    quadriceps_cm: null,
    calf_cm: null,
    height_cm: null,
  };
}

describe("ejecutor de tools", () => {
  it("despacha una búsqueda pura con filtros y ordenación", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    const result = await execute("search_foods", {
      min_protein: 2,
      sort_by: "protein_desc",
    }, { foodsRepo: foods });
    const parsed = JSON.parse(result) as { results: Array<{ item_id: string; proteina_por_100g: number }> };
    expect(parsed.results.map((food) => food.item_id)).toEqual(["chicken", "rice"]);
    expect(parsed.results[0].proteina_por_100g).toBe(31);
  });

  it("expone disponibilidad, fecha, fuentes y referencias en ambas búsquedas", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    for (const availability of ["fresh", "cached", "partial", "unavailable"] as const) {
      const sourceAvailability = availability === "partial" ? "cached" : availability;
      const foodMetadata: CatalogSearchAvailability = {
        availability,
        fetchedAt: "2026-09-03T10:00:00.000Z",
        sources: [{
          sourceId: "gymnasia_foods",
          label: "Alimentos",
          availability: sourceAvailability,
          fetchedAt: "2026-09-03T10:00:00.000Z",
          refreshing: false,
          cachePersisted: true,
          warning: availability === "unavailable" ? "remote_failed" : null,
        }],
        warnings: availability === "unavailable" ? ["Alimentos: no disponible."] : [],
      };
      const exerciseMetadata: CatalogSearchAvailability = {
        ...foodMetadata,
        sources: foodMetadata.sources.map((source) => ({
          ...source,
          sourceId: "gymnasia_exercises",
          label: "Ejercicios",
        })),
      };
      const foodOutput = JSON.parse(await execute("search_foods", {}, {
        foodsRepo: foods,
        foodCatalogAvailability: foodMetadata,
      }));
      const exerciseOutput = JSON.parse(await execute("search_exercises", {}, {
        exercisesRepo: exercises,
        exerciseCatalogAvailability: exerciseMetadata,
      }));
      expect(foodOutput).toMatchObject({
        availability,
        fetched_at: "2026-09-03T10:00:00.000Z",
        sources: [{ source_id: "gymnasia_foods" }],
      });
      expect(foodOutput.results[0]).toMatchObject({ source_id: "gymnasia_foods", item_id: "rice" });
      expect(exerciseOutput).toMatchObject({
        availability,
        sources: [{ source_id: "gymnasia_exercises" }],
        results: [{ source_id: "gymnasia_exercises", item_id: "sentadilla" }],
      });
    }
  });

  it("mantiene respuestas controladas para tools y JSON desconocidos", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    await expect(execute("unknown_tool", {})).resolves.toBe("Herramienta no reconocida.");
    await expect(execute("write_measurement", {
      date: "2026-04-11",
      data: "{json roto",
    })).resolves.toBe("El JSON de medidas no es válido.");
  });

  it("crea y completa la medición del día con entrada estructurada sin borrar lo omitido", async () => {
    let store = createEmptyStore();
    const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => {
      store = updater(store);
    });
    const execute = createAgentToolExecutor(createDependencies({
      loadMeasurements: async () => store.measurements,
    }));

    await expect(execute("write_measurement", {
      date: "2024-04-11",
      data: { weight_kg: 75.555, waist_cm: 82 },
    }, { commitStore })).resolves.toContain("guardadas correctamente");
    const id = store.measurements[0].id;
    expect(store.measurements[0]).toMatchObject({
      measured_on: "2024-04-11",
      weight_kg: 75.56,
      waist_cm: 82,
      body_fat_pct: null,
    });

    await expect(execute("write_measurement", {
      date: "2024-04-11",
      data: { body_fat_pct: 18.5 },
    }, { commitStore })).resolves.toContain("actualizadas correctamente");
    expect(store.measurements).toHaveLength(1);
    expect(store.measurements[0]).toMatchObject({
      id,
      weight_kg: 75.56,
      waist_cm: 82,
      body_fat_pct: 18.5,
    });

    expect(JSON.parse(await execute("read_measurement", { date: "2024-04-11" }))).toMatchObject({
      measured_on: "2024-04-11",
      weight_kg: 75.56,
      body_fat_pct: 18.5,
    });
  });

  it("acepta el JSON heredado durante la transición y permite borrar un campo explícito", async () => {
    let store: ToolStore = {
      ...createEmptyStore(),
      measurements: [{ ...createMeasurement("existing", "2024-04-11", 75), waist_cm: 82 }],
    };
    const execute = createAgentToolExecutor(createDependencies());
    const context = {
      commitStore: async (updater: (previous: ToolStore) => ToolStore) => {
        store = updater(store);
      },
    };
    await expect(execute("write_measurement", {
      date: "2024-04-11",
      data: '{"body_fat_pct":"18,5"}',
      clear_fields: ["weight_kg"],
    }, context)).resolves.toContain("actualizadas correctamente");
    expect(store.measurements[0]).toMatchObject({
      id: "existing",
      weight_kg: null,
      waist_cm: 82,
      body_fat_pct: 18.5,
    });
  });

  it("rechaza valores inválidos y fechas duplicadas heredadas sin persistir", async () => {
    let store: ToolStore = {
      ...createEmptyStore(),
      measurements: [
        createMeasurement("a", "2024-04-11", 75),
        createMeasurement("b", "2024-04-11", 76),
      ],
    };
    const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => {
      store = updater(store);
    });
    const execute = createAgentToolExecutor(createDependencies({
      loadMeasurements: async () => store.measurements,
    }));

    await expect(execute("write_measurement", {
      date: "2024-04-11",
      data: { body_fat_pct: 101 },
    }, { commitStore })).resolves.toContain("no puede superar el 100");
    expect(commitStore).not.toHaveBeenCalled();

    await expect(execute("write_measurement", {
      date: "2024-04-11",
      data: { waist_cm: 80 },
    }, { commitStore })).resolves.toContain("Hay varias mediciones");
    expect(store.measurements).toHaveLength(2);
    await expect(execute("read_measurement", { date: "2024-04-11" })).resolves.toContain(
      "Hay varias mediciones",
    );
  });

  it("no confirma ni muestra éxito si falla la persistencia de una medición", async () => {
    const execute = createDetailedAgentToolExecutor(createDependencies());
    const result = await execute("write_measurement", {
      date: "2024-04-11",
      data: { weight_kg: 75 },
    }, {
      commitStore: async () => {
        throw new Error("storage unavailable");
      },
    });
    expect(result.status).toBe("failed_before_commit");
    expect(result.output).not.toContain("correctamente");
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

  it("guarda una selección por referencia y calcula la instantánea para sus gramos", async () => {
    let store = createEmptyStore();
    const execute = createAgentToolExecutor(createDependencies());
    await execute("add_meal_food", {
      date: "2026-09-03",
      meal: "Comida",
      data: JSON.stringify({
        kind: "catalog",
        source_id: "gymnasia_foods",
        item_id: "rice",
        grams: 150,
      }),
    }, {
      foodsRepo: foods,
      setStore: (updater) => { store = updater(store); },
    });

    expect(store.dietByDate["2026-09-03"].meals[0].items[0]).toEqual(expect.objectContaining({
      title: "Arroz blanco",
      grams: 150,
      calories_kcal: 195,
      catalog_link: expect.objectContaining({
        status: "linked",
        ref: { schemaVersion: 1, sourceId: "gymnasia_foods", itemId: "rice" },
      }),
    }));
  });

  it("devuelve candidatos y no escribe ante un nombre de alimento ambiguo", async () => {
    const duplicate = { ...foods[0], id: "rice-product", sourceId: "gymnasia_products" as const, source: "producto_comercial" as const };
    const setStore = vi.fn();
    const execute = createAgentToolExecutor(createDependencies());
    const output = await execute("add_meal_food", {
      date: "2026-09-03",
      meal: "Comida",
      data: JSON.stringify({ name: "Arroz blanco", grams: 100, calories_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }),
    }, { foodsRepo: [...foods, duplicate], setStore });
    expect(JSON.parse(output)).toMatchObject({ status: "ambiguous", written: false });
    expect(setStore).not.toHaveBeenCalled();
  });

  it("crea rutinas por referencia y no guarda parcialmente si una referencia falla", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    const setStore = vi.fn();
    const failed = await execute("create_routine", {
      data: JSON.stringify({
        name: "Pierna",
        exercises: [
          { kind: "catalog", source_id: "gymnasia_exercises", item_id: "sentadilla", series: [] },
          { kind: "catalog", source_id: "gymnasia_exercises", item_id: "ausente", series: [] },
        ],
      }),
    }, { exercisesRepo: exercises, setStore });
    expect(JSON.parse(failed)).toMatchObject({ status: "not_found", written: false });
    expect(setStore).not.toHaveBeenCalled();

    let store = createEmptyStore();
    await execute("create_routine", {
      data: JSON.stringify({
        name: "Pierna",
        exercises: [{ kind: "catalog", source_id: "gymnasia_exercises", item_id: "sentadilla", series: [] }],
      }),
    }, { exercisesRepo: exercises, setStore: (updater) => { store = updater(store); } });
    expect(store.templates[0].exercises[0].catalog_link).toEqual(expect.objectContaining({ status: "linked" }));
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

  it("confirma el efecto solo después de persistir y usa ids estables", async () => {
    const execute = createDetailedAgentToolExecutor(createDependencies());
    let store: ToolStore = {
      templates: [],
      dietByDate: {},
      measurements: [],
    };
    const context = {
      operationId: "a".repeat(64),
      store,
      commitStore: async (updater: (previous: ToolStore) => ToolStore) => {
        store = updater(store);
      },
    };
    const args = {
      date: "2026-09-01",
      meal: "Comida",
      data: JSON.stringify({
        name: "Arroz blanco",
        grams: 150,
        calories_kcal: 195,
        protein_g: 4.1,
        carbs_g: 43.4,
        fat_g: 0.4,
      }),
    };

    await expect(execute("add_meal_food", args, context)).resolves.toMatchObject({
      status: "committed",
    });
    await expect(execute("add_meal_food", args, context)).resolves.toMatchObject({
      status: "committed",
    });

    expect(store.dietByDate["2026-09-01"].meals[0].items).toHaveLength(1);
    expect(store.dietByDate["2026-09-01"].meals[0].items[0].id).toBe(
      `food_op_${"a".repeat(24)}`,
    );
  });

  it("no confirma una escritura si la persistencia falla", async () => {
    const execute = createDetailedAgentToolExecutor(createDependencies());
    const result = await execute("create_routine", {
      data: JSON.stringify({
        name: "Pierna",
        exercises: [{
          kind: "custom",
          name: "Sentadilla",
          series: [{ reps: "10", weight_kg: "60", rest_seconds: "90" }],
        }],
      }),
    }, {
      operationId: "b".repeat(64),
      commitStore: async () => {
        throw new Error("storage unavailable");
      },
    });

    expect(result.status).toBe("failed_before_commit");
    expect(result.output).toContain("no se ha completado");
  });

  it("solo confirma la incidencia cuando el backend devuelve una issue verificada", async () => {
    const unavailable = createDetailedAgentToolExecutor(createDependencies({
      submitFeedbackIssue: async () => ({ status: "unavailable", reason: "disabled" }),
    }));
    const created = createDetailedAgentToolExecutor(createDependencies({
      submitFeedbackIssue: async () => ({
        status: "created",
        issueNumber: 42,
        issueUrl: "https://example.test/42",
        deduplicated: false,
      }),
    }));
    const args = { title: "Mejora", summary: "Añadir una mejora solicitada." };

    await expect(unavailable("create_feature_issue", args)).resolves.toMatchObject({
      status: "no_effect",
    });
    await expect(created("create_feature_issue", args)).resolves.toMatchObject({
      status: "committed",
    });
  });
});
