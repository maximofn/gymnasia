import { describe, expect, it, vi } from "vitest";

import { catalogRef, linkedCatalog, unresolvedCatalog } from "../catalogs/types";
import { AGENT_TOOL_DEFINITIONS, agentToolEffect } from "./toolDefinitions";
import {
  AGENT_TOOL_HANDLER_NAMES,
  createDetailedAgentToolExecutor,
  type ToolDietItem,
  type ToolExecutorDependencies,
  type ToolFoodRepoEntry,
  type ToolStore,
} from "./toolExecutor";

const rice: ToolFoodRepoEntry = {
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

const dependencies: ToolExecutorDependencies = {
  loadPersonalData: async () => [],
  savePersonalData: async () => {},
  loadMeasurements: async () => [],
  createId: (prefix) => `${prefix}_test`,
  getExerciseImageUrl: () => "",
  submitFeedbackIssue: async () => ({ status: "canceled" as const }),
};

function riceEntry(id: string, grams = 150): ToolDietItem {
  return {
    id,
    title: "Arroz blanco",
    grams,
    calories_kcal: 195,
    protein_g: 4.1,
    carbs_g: 42,
    fat_g: 0.5,
    catalog_link: linkedCatalog(catalogRef("gymnasia_foods", "rice"), "tool"),
  };
}

function createStore(): ToolStore {
  return {
    templates: [],
    measurements: [],
    dietByDate: {
      "2026-11-20": {
        day_date: "2026-11-20",
        meals: [
          { id: "meal_comida", title: "Comida", items: [riceEntry("comida_rice")] },
          {
            id: "meal_cena",
            title: "Cena",
            items: [
              riceEntry("cena_rice_1"),
              riceEntry("cena_rice_2"),
              {
                id: "cena_tortilla",
                title: "Tortilla casera",
                grams: 200,
                calories_kcal: 300,
                protein_g: 20,
                carbs_g: 4,
                fat_g: 22,
                catalog_link: unresolvedCatalog("manual"),
              },
            ],
          },
        ],
      },
    },
  };
}

function harness(initial: ToolStore = createStore()) {
  let store = initial;
  const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => { store = updater(store); });
  const execute = createDetailedAgentToolExecutor(dependencies);
  const run = (name: string, args: Record<string, unknown>, operationId?: string) => {
    const markEffectCommitted = vi.fn();
    return execute(name, args, { store, foodsRepo: [rice], commitStore, operationId, markEffectCommitted })
      .then((outcome) => ({ ...outcome, markEffectCommitted }));
  };
  return { run, commitStore, get store() { return store; } };
}

function mealIds(store: ToolStore, date: string, title: string): string[] | undefined {
  return store.dietByDate[date]?.meals.find((meal) => meal.title === title)?.items.map((entry) => entry.id);
}

describe("lecturas con identificador de entrada", () => {
  it("read_meal_foods y read_diet_period devuelven el entrada_id de cada alimento", async () => {
    const { run } = harness();
    const meal = JSON.parse((await run("read_meal_foods", { date: "2026-11-20", meal: "Cena" })).output);
    expect(meal.map((entry: { entrada_id: string }) => entry.entrada_id)).toEqual(["cena_rice_1", "cena_rice_2", "cena_tortilla"]);
    const period = JSON.parse((await run("read_diet_period", { from: "2026-11-20", to: "2026-11-20", include_foods: true })).output);
    expect(period.dias[0].comidas[0].alimentos[0]).toMatchObject({ entrada_id: "comida_rice", nombre: "Arroz blanco" });
  });
});

describe("remove_meal_food", () => {
  it("quita exactamente la entrada pedida aunque haya otra igual", async () => {
    const h = harness();
    const outcome = await h.run("remove_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_rice_2" }, "a".repeat(64));
    expect(outcome.status).toBe("committed");
    expect(JSON.parse(outcome.output)).toMatchObject({ status: "removed", nombre: "Arroz blanco", comida: "Cena" });
    expect(mealIds(h.store, "2026-11-20", "Cena")).toEqual(["cena_rice_1", "cena_tortilla"]);
    expect(mealIds(h.store, "2026-11-20", "Comida")).toEqual(["comida_rice"]);
    expect(h.store.toolOperationReceipts).toEqual([expect.objectContaining({ toolName: "remove_meal_food" })]);
  });

  it("no toca nada si la entrada no está en la comida indicada", async () => {
    const h = harness();
    const before = h.store;
    const outcome = await h.run("remove_meal_food", { date: "2026-11-20", meal: "Comida", entry_id: "cena_rice_1" });
    expect(outcome).toMatchObject({ isError: true, status: "no_effect" });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", written: false });
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
    expect(h.store).toBe(before);
  });

  it("un reintento con el mismo operationId no falla ni borra otra cosa", async () => {
    const h = harness();
    const operationId = "b".repeat(64);
    await h.run("remove_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_rice_1" }, operationId);
    const afterFirst = h.store.dietByDate;
    const retry = await h.run("remove_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_rice_1" }, operationId);
    expect(retry.status).toBe("committed");
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.dietByDate).toBe(afterFirst);
  });
});

describe("update_meal_food", () => {
  it("«eran 100 gramos» deja una única entrada con macros de la ficha", async () => {
    const h = harness();
    const outcome = await h.run("update_meal_food", { date: "2026-11-20", meal: "Comida", entry_id: "comida_rice", grams: 100 });
    expect(JSON.parse(outcome.output)).toMatchObject({
      status: "updated",
      antes: { gramos: 150, calorias_kcal: 195 },
      ahora: { gramos: 100, calorias_kcal: 130, proteina_g: 2.7, carbohidratos_g: 28, grasa_g: 0.3 },
    });
    expect(h.store.dietByDate["2026-11-20"].meals[0].items).toEqual([
      expect.objectContaining({ id: "comida_rice", grams: 100, calories_kcal: 130 }),
    ]);
  });

  it("escala en proporción un alimento manual", async () => {
    const h = harness();
    await h.run("update_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_tortilla", grams: 100 });
    expect(h.store.dietByDate["2026-11-20"].meals[1].items[2]).toMatchObject({ grams: 100, calories_kcal: 150, protein_g: 10, carbs_g: 2, fat_g: 11 });
  });

  it("«eso era la comida, no la cena» lo mueve sin duplicarlo", async () => {
    const h = harness();
    await h.run("update_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_tortilla", to_meal: "Comida" });
    expect(mealIds(h.store, "2026-11-20", "Comida")).toEqual(["comida_rice", "cena_tortilla"]);
    expect(mealIds(h.store, "2026-11-20", "Cena")).toEqual(["cena_rice_1", "cena_rice_2"]);
  });

  it("mueve a otro día y cambia gramos en un solo paso, creando la comida de destino", async () => {
    const h = harness();
    const operationId = "c".repeat(64);
    await h.run("update_meal_food", { date: "2026-11-20", meal: "Comida", entry_id: "comida_rice", grams: 200, to_date: "2026-11-19", to_meal: "Cena" }, operationId);
    expect(h.store.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Cena"]);
    expect(h.store.dietByDate["2026-11-19"]).toEqual({
      day_date: "2026-11-19",
      meals: [{ id: `meal_op_${operationId.slice(0, 24)}`, title: "Cena", items: [expect.objectContaining({ id: "comida_rice", grams: 200, calories_kcal: 260 })] }],
    });
  });

  it("no escribe si la entrada ya estaba así", async () => {
    const h = harness();
    const before = h.store;
    const outcome = await h.run("update_meal_food", { date: "2026-11-20", meal: "Comida", entry_id: "comida_rice", grams: 150, to_meal: "Comida" });
    expect(outcome.status).toBe("no_effect");
    expect(JSON.parse(outcome.output)).toMatchObject({ status: "unchanged", written: false });
    expect(h.store).toBe(before);
  });

  it("pide qué cambiar y valida fechas y gramos antes de tocar el almacén", async () => {
    const h = harness();
    const cases: Array<[Record<string, unknown>, string]> = [
      [{}, "no_change"],
      [{ to_date: "2026-02-31" }, "invalid_date"],
      [{ grams: 0 }, "invalid_tool_arguments"],
    ];
    for (const [extra, error] of cases) {
      const outcome = await h.run("update_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "cena_rice_1", ...extra });
      expect(JSON.parse(outcome.output).error).toBe(error);
    }
    const badDate = await h.run("update_meal_food", { date: "20-11-2026", meal: "Cena", entry_id: "cena_rice_1", grams: 10 });
    expect(JSON.parse(badDate.output).error).toBe("invalid_date");
    expect(h.commitStore).not.toHaveBeenCalled();
  });

  it("falla sin tocar nada si la entrada ya no está donde Coach cree", async () => {
    const h = harness();
    const before = h.store;
    const outcome = await h.run("update_meal_food", { date: "2026-11-20", meal: "Cena", entry_id: "comida_rice", grams: 100 });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", written: false });
    expect(h.store).toBe(before);
  });

  it("un reintento con el mismo operationId no repite el movimiento", async () => {
    const h = harness();
    const operationId = "d".repeat(64);
    const args = { date: "2026-11-20", meal: "Cena", entry_id: "cena_rice_1", to_meal: "Comida" };
    await h.run("update_meal_food", args, operationId);
    const afterFirst = h.store.dietByDate;
    const retry = await h.run("update_meal_food", args, operationId);
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.dietByDate).toBe(afterFirst);
  });
});

describe("contrato de las tools de corrección", () => {
  it("están declaradas como escrituras locales, con schema cerrado y handler registrado", () => {
    for (const name of ["remove_meal_food", "update_meal_food"]) {
      const definition = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name);
      expect(definition, name).toBeDefined();
      expect(agentToolEffect(name)).toBe("local_write");
      expect(definition!.inputSchema).toMatchObject({ required: ["date", "meal", "entry_id"], additionalProperties: false });
      expect(definition!.description).toMatch(/nunca por iniciativa propia/);
      expect(AGENT_TOOL_HANDLER_NAMES).toContain(name);
    }
  });
});
