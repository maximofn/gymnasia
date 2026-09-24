import fc from "fast-check";
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
import { AGENT_TOOL_DEFINITIONS, AGENT_TOOL_NAMES, validateToolInput } from "./toolDefinitions";

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

async function runDispatchScenario(name: string, args: Record<string, unknown>) {
  let store: ToolStore = {
    ...createEmptyStore(),
    dietByDate: {
      "2026-09-01": {
        day_date: "2026-09-01",
        meals: [{
          id: "meal_existing",
          title: "Comida",
          items: [{
            id: "food_existing",
            title: "Arroz blanco",
            grams: 100,
            calories_kcal: 130,
            protein_g: 2.7,
            carbs_g: 28,
            fat_g: 0.3,
          }],
        }],
      },
    },
  };
  const savedFields: unknown[] = [];
  const submittedDrafts: unknown[] = [];
  const execute = createAgentToolExecutor(createDependencies({
    loadPersonalData: async () => [{
      key: "Objetivo",
      description: "Meta principal",
      value: "Ganar masa",
    }],
    savePersonalData: async (fields) => { savedFields.push(fields); },
    loadMeasurements: async () => [createMeasurement("measurement_existing", "2026-09-01", 72)],
    submitFeedbackIssue: async (draft) => {
      submittedDrafts.push(draft);
      return { status: "canceled" };
    },
  }));
  const output = await execute(name, args, {
    store,
    foodsRepo: foods,
    exercisesRepo: exercises,
    commitStore: async (updater) => { store = updater(store); },
  });
  return { output, store, savedFields, submittedDrafts };
}

type DispatchResult = Awaited<ReturnType<typeof runDispatchScenario>>;

const dispatchScenarios: Record<string, {
  args: Record<string, unknown>;
  verify: (result: DispatchResult) => void;
}> = {
  save_personal_data: {
    args: { personal_data: JSON.stringify([{ key: "Objetivo", description: "Meta principal", value: "Ganar masa" }]) },
    verify: ({ output, savedFields }) => {
      expect(output).toBe("Datos personales guardados correctamente.");
      expect(savedFields).toEqual([[{ key: "Objetivo", description: "Meta principal", value: "Ganar masa" }]]);
    },
  },
  list_personal_data_keys: {
    args: {},
    verify: ({ output }) => { expect(JSON.parse(output)).toEqual(["Objetivo"]); },
  },
  read_field_description: {
    args: { key: "Objetivo" },
    verify: ({ output }) => { expect(output).toBe("Meta principal"); },
  },
  read_field_value: {
    args: { key: "Objetivo" },
    verify: ({ output }) => { expect(output).toBe("Ganar masa"); },
  },
  read_measurement: {
    args: { date: "2026-09-01" },
    verify: ({ output }) => { expect(JSON.parse(output)).toMatchObject({ measured_on: "2026-09-01", weight_kg: 72 }); },
  },
  write_measurement: {
    args: { date: "2026-09-02", data: { weight_kg: 73 } },
    verify: ({ output, store }) => {
      expect(output).toContain("Medidas guardadas correctamente");
      expect(store.measurements).toEqual([expect.objectContaining({ measured_on: "2026-09-02", weight_kg: 73 })]);
    },
  },
  read_meal_foods: {
    args: { date: "2026-09-01", meal: "Comida" },
    verify: ({ output }) => { expect(JSON.parse(output)).toEqual([expect.objectContaining({ nombre: "Arroz blanco" })]); },
  },
  search_foods: {
    args: { query: "Arroz" },
    verify: ({ output }) => { expect(JSON.parse(output).results).toEqual([expect.objectContaining({ item_id: "rice" })]); },
  },
  add_meal_food: {
    args: {
      date: "2026-09-01",
      meal: "Cena",
      data: JSON.stringify({ kind: "catalog", source_id: "gymnasia_foods", item_id: "rice", grams: 150 }),
    },
    verify: ({ output, store }) => {
      expect(output).toContain("añadido a Cena");
      expect(store.dietByDate["2026-09-01"].meals.find((meal) => meal.title === "Cena")?.items).toEqual([
        expect.objectContaining({ title: "Arroz blanco", grams: 150 }),
      ]);
    },
  },
  search_exercises: {
    args: { query: "sentadilla" },
    verify: ({ output }) => { expect(JSON.parse(output).results).toEqual([expect.objectContaining({ item_id: "sentadilla" })]); },
  },
  read_routines: {
    args: {},
    verify: ({ output }) => { expect(output).toBe("No hay rutinas de entrenamiento creadas."); },
  },
  create_routine: {
    args: { data: {
      name: "Pierna",
      category: "strength",
      icon: "activity",
      exercises: [{ kind: "catalog", source_id: "gymnasia_exercises", item_id: "sentadilla", series: [{ type: "normal", reps: 8 }] }],
    } },
    verify: ({ output, store }) => {
      expect(JSON.parse(output)).toMatchObject({ status: "created", written: true, name: "Pierna" });
      expect(store.templates).toEqual([expect.objectContaining({ name: "Pierna" })]);
    },
  },
  create_feature_issue: {
    args: { title: "Mejorar el historial", summary: "Permitir filtrar el historial de entrenamiento por fecha." },
    verify: ({ output, submittedDrafts }) => {
      expect(output.length).toBeGreaterThan(0);
      expect(submittedDrafts).toEqual([expect.objectContaining({ title: "Mejorar el historial" })]);
    },
  },
};

describe("contrato del despachador", () => {
  it("cubre todas las tools declaradas con llamadas válidas y rutas estables", async () => {
    expect(Object.keys(dispatchScenarios).sort()).toEqual([...AGENT_TOOL_NAMES].sort());
    for (const [name, scenario] of Object.entries(dispatchScenarios)) {
      const definition = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name);
      expect(definition, name).toBeDefined();
      expect(validateToolInput(definition!.inputSchema, scenario.args), name).toEqual({ valid: true, errors: [] });
      const first = await runDispatchScenario(name, scenario.args);
      const repeated = await runDispatchScenario(name, scenario.args);
      expect(first.output, name).toBeTypeOf("string");
      expect(repeated.output, name).toBe(first.output);
      scenario.verify(first);
    }
  });

  it("rechaza cualquier nombre no declarado, incluidos los heredados del objeto", async () => {
    const savePersonalData = vi.fn(async () => {});
    const submitFeedbackIssue = vi.fn(async () => ({ status: "canceled" as const }));
    const execute = createDetailedAgentToolExecutor(createDependencies({
      savePersonalData,
      submitFeedbackIssue,
    }));
    const assertUnknown = async (name: string) => {
      const result = await execute(name, {});
      expect(result, name).toEqual({ output: "Herramienta no reconocida.", status: "no_effect" });
    };

    for (const name of ["unknown_tool", "constructor", "toString", "__proto__"]) {
      await assertUnknown(name);
    }
    await fc.assert(fc.asyncProperty(
      fc.string().filter((name) => !AGENT_TOOL_NAMES.includes(name)),
      assertUnknown,
    ), { numRuns: 100 });
    expect(savePersonalData).not.toHaveBeenCalled();
    expect(submitFeedbackIssue).not.toHaveBeenCalled();
  });
});

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

  it("busca y resuelve ejercicios mediante el catálogo paginado", async () => {
    const execute = createAgentToolExecutor(createDependencies());
    const searchExerciseCatalog = vi.fn(async () => exercises);
    const searchOutput = JSON.parse(await execute("search_exercises", { query: "sentadilla" }, {
      searchExerciseCatalog,
      getExerciseCatalogAvailability: () => ({
        availability: "fresh",
        fetchedAt: "2026-09-10T10:00:00.000Z",
        sources: [],
        warnings: [],
      }),
    }));
    expect(searchExerciseCatalog).toHaveBeenCalledWith(expect.objectContaining({ query: "sentadilla" }));
    expect(searchOutput).toMatchObject({
      availability: "fresh",
      results: [{ item_id: "sentadilla" }],
    });

    let store = createEmptyStore();
    const resolveExerciseCatalogIds = vi.fn(async () => exercises);
    const routineOutput = JSON.parse(await execute("create_routine", {
      data: {
        name: "Pierna paginada",
        category: "strength",
        icon: "activity",
        exercises: [{
          kind: "catalog",
          source_id: "gymnasia_exercises",
          item_id: "sentadilla",
          series: [{ type: "normal", reps: 8 }],
        }],
      },
    }, {
      exercisesRepo: [],
      resolveExerciseCatalogIds,
      commitStore: async (updater) => { store = updater(store); },
    }));
    expect(resolveExerciseCatalogIds).toHaveBeenCalledWith(["sentadilla"]);
    expect(routineOutput.status).toBe("created");
    expect(store.templates[0].exercises[0].catalog_link).toMatchObject({ status: "linked" });
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
    expect(result.status).toBe("indeterminate");
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
    const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => {
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
    }, { commitStore });

    expect(result).toContain('Alimento "Agua"');
    expect(commitStore).toHaveBeenCalledOnce();
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
      commitStore: async (updater) => { store = updater(store); },
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
      data: {
        name: "Pierna",
        category: "strength",
        icon: "activity",
        exercises: [
          {
            kind: "catalog",
            source_id: "gymnasia_exercises",
            item_id: "sentadilla",
            series: [{ type: "normal", reps: 8 }],
          },
          {
            kind: "catalog",
            source_id: "gymnasia_exercises",
            item_id: "ausente",
            series: [{ type: "normal", reps: 10 }],
          },
        ],
      },
    }, { exercisesRepo: exercises, setStore });
    expect(JSON.parse(failed)).toMatchObject({
      status: "invalid_input",
      written: false,
      issues: [expect.objectContaining({ code: "catalog_not_found" })],
    });
    expect(setStore).not.toHaveBeenCalled();

    let store = createEmptyStore();
    const created = await execute("create_routine", {
      data: {
        name: "Pierna",
        category: "strength",
        icon: "activity",
        exercises: [{
          kind: "catalog",
          source_id: "gymnasia_exercises",
          item_id: "sentadilla",
          series: [{ type: "normal", reps: 10, weight_kg: 60, rest_seconds: 90 }],
        }],
      },
    }, {
      exercisesRepo: exercises,
      commitStore: async (updater) => { store = updater(store); },
    });
    expect(JSON.parse(created)).toMatchObject({
      status: "created",
      written: true,
      exercise_count: 1,
      execution_unit_count: 1,
    });
    expect(store.templates[0].exercises[0].catalog_link).toEqual(expect.objectContaining({ status: "linked" }));
    expect(store.templates[0].exercises[0].sets).toEqual([10]);
  });

  it("devuelve todas las incidencias de una rutina inválida sin mutar ni confirmar efectos", async () => {
    const createId = vi.fn((prefix: string) => `${prefix}_test`);
    const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => {
      updater(createEmptyStore());
    });
    const markEffectCommitted = vi.fn();
    const execute = createDetailedAgentToolExecutor(createDependencies({ createId }));
    const result = await execute("create_routine", {
      data: {
        name: "Pierna",
        category: "strength",
        icon: "activity",
        exercises: [{
          kind: "custom",
          name: "Sentadilla",
          series: [{ type: "tempo", reps: 0, weight_kg: -1 }],
        }],
      },
    }, { commitStore, markEffectCommitted });

    expect(result.status).toBe("no_effect");
    const output = JSON.parse(result.output);
    expect(output).toMatchObject({ status: "invalid_input", written: false });
    expect(output.issues.map((issue: { code: string }) => issue.code)).toEqual(expect.arrayContaining([
      "not_positive",
      "negative",
      "required",
    ]));
    expect(commitStore).not.toHaveBeenCalled();
    expect(markEffectCommitted).not.toHaveBeenCalled();
    expect(createId).not.toHaveBeenCalled();
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
    expect(store.toolOperationReceipts).toEqual([
      expect.objectContaining({
        operationId: "a".repeat(64),
        toolName: "add_meal_food",
      }),
    ]);
  });

  it("no confirma una escritura si la persistencia falla", async () => {
    const execute = createDetailedAgentToolExecutor(createDependencies());
    const result = await execute("create_routine", {
      data: {
        name: "Pierna",
        category: "strength",
        icon: "activity",
        exercises: [{
          kind: "custom",
          name: "Sentadilla",
          series: [{ type: "normal", reps: 10, weight_kg: 60, rest_seconds: 90 }],
        }],
      },
    }, {
      operationId: "b".repeat(64),
      commitStore: async () => {
        throw new Error("storage unavailable");
      },
    });

    expect(result.status).toBe("indeterminate");
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
    const ambiguous = createDetailedAgentToolExecutor(createDependencies({
      submitFeedbackIssue: async () => ({ status: "error", reason: "operation_pending" }),
    }));
    const args = { title: "Mejora", summary: "Añadir una mejora solicitada." };

    await expect(unavailable("create_feature_issue", args)).resolves.toMatchObject({
      status: "no_effect",
    });
    await expect(created("create_feature_issue", args)).resolves.toMatchObject({
      status: "committed",
    });
    await expect(ambiguous("create_feature_issue", args)).resolves.toMatchObject({
      status: "indeterminate",
    });
  });
});
