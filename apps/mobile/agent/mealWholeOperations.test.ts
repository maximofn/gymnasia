import { describe, expect, it, vi } from "vitest";

import { catalogRef, linkedCatalog, unresolvedCatalog } from "../catalogs/types";
import { AGENT_TOOL_DEFINITIONS, MEAL_FOODS_BATCH_MAX, agentToolEffect } from "./toolDefinitions";
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


// GYM-275 (ticket para que Coach pueda crear, mover y vaciar una comida entera).

const OP_A = "a".repeat(64);
const OP_B = "b".repeat(64);
const riceRef = { kind: "catalog", source_id: "gymnasia_foods", item_id: "rice" };

describe("add_meal_foods", () => {
  it("añade varios alimentos de una vez a una comida que ya tenía, con ids por operación", async () => {
    const h = harness();
    const outcome = await h.run("add_meal_foods", {
      date: "2026-11-20",
      meal: "Comida",
      foods: [
        { ...riceRef, grams: 100 },
        { kind: "manual", name: "Ensalada", grams: 120, calories_kcal: 40, protein_g: 2, carbs_g: 6, fat_g: 1 },
      ],
    }, OP_A);
    expect(outcome.status).toBe("committed");
    expect(JSON.parse(outcome.output)).toMatchObject({
      status: "added",
      comida: "Comida",
      alimentos: [{ nombre: "Arroz blanco", gramos: 100, calorias_kcal: 130 }, { nombre: "Ensalada", gramos: 120 }],
      total_kcal_anadidas: 170,
    });
    const suffix = OP_A.slice(0, 24);
    expect(mealIds(h.store, "2026-11-20", "Comida")).toEqual(["comida_rice", `food_op_${suffix}_0`, `food_op_${suffix}_1`]);
    expect(h.store.toolOperationReceipts).toEqual([expect.objectContaining({ toolName: "add_meal_foods" })]);
  });

  it("crea la comida si ese día no existía", async () => {
    const h = harness();
    await h.run("add_meal_foods", { date: "2026-11-21", meal: "Desayuno", foods: [{ ...riceRef, grams: 50 }] }, OP_A);
    expect(h.store.dietByDate["2026-11-21"]).toEqual({
      day_date: "2026-11-21",
      meals: [{ id: `meal_op_${OP_A.slice(0, 24)}`, title: "Desayuno", items: [expect.objectContaining({ grams: 50, calories_kcal: 65 })] }],
    });
  });

  it("si un alimento no es válido no guarda ninguno y dice cuál falló", async () => {
    const h = harness();
    const before = h.store;
    const outcome = await h.run("add_meal_foods", {
      date: "2026-11-20",
      meal: "Cena",
      foods: [{ ...riceRef, grams: 100 }, { kind: "catalog", source_id: "gymnasia_foods", item_id: "no-existe", grams: 80 }],
    }, OP_A);
    expect(outcome).toMatchObject({ isError: true, status: "no_effect" });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", posicion: 2, written: false });
    expect(JSON.parse(outcome.output).message).toMatch(/^Alimento 2 de 2: .*No se ha guardado ninguno/);
    expect(h.commitStore).not.toHaveBeenCalled();
    expect(h.store).toBe(before);
  });

  it("rechaza un manual sin macros y una lista demasiado larga sin tocar el almacén", async () => {
    const h = harness();
    const manual = await h.run("add_meal_foods", { date: "2026-11-20", meal: "Cena", foods: [{ kind: "manual", name: "Algo", grams: 100 }] });
    expect(JSON.parse(manual.output)).toMatchObject({ error: "invalid_food", posicion: 1 });
    const many = Array.from({ length: MEAL_FOODS_BATCH_MAX + 1 }, () => ({ ...riceRef, grams: 10 }));
    const tooMany = await h.run("add_meal_foods", { date: "2026-11-20", meal: "Cena", foods: many });
    expect(JSON.parse(tooMany.output).error).toBe("too_many_foods");
    const badDate = await h.run("add_meal_foods", { date: "2026-02-31", meal: "Cena", foods: [{ ...riceRef, grams: 10 }] });
    expect(JSON.parse(badDate.output).error).toBe("invalid_date");
    expect(h.commitStore).not.toHaveBeenCalled();
  });

  it("un reintento con el mismo operationId no duplica los alimentos", async () => {
    const h = harness();
    const args = { date: "2026-11-20", meal: "Comida", foods: [{ ...riceRef, grams: 100 }, { ...riceRef, grams: 50 }] };
    await h.run("add_meal_foods", args, OP_A);
    const afterFirst = h.store.dietByDate;
    const retry = await h.run("add_meal_foods", args, OP_A);
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.dietByDate).toBe(afterFirst);
    expect(mealIds(h.store, "2026-11-20", "Comida")).toHaveLength(3);
  });
});

describe("copy_meal", () => {
  it("«hoy he cenado lo mismo que el lunes» copia la cena con los mismos gramos y macros", async () => {
    const h = harness();
    const outcome = await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-23", to_meal: "Cena", mode: "copy" }, OP_A);
    expect(outcome.status).toBe("committed");
    expect(JSON.parse(outcome.output)).toMatchObject({
      status: "copied",
      origen: { fecha: "2026-11-20", comida: "Cena", queda_vacia: false },
      destino: { fecha: "2026-11-23", comida: "Cena" },
      total_kcal: 690,
      sustituidos: [],
    });
    const strip = ({ id: _id, ...rest }: ToolDietItem) => rest;
    const source = h.store.dietByDate["2026-11-20"].meals.find((meal) => meal.title === "Cena")!.items;
    const copied = h.store.dietByDate["2026-11-23"].meals[0].items;
    expect(copied.map(strip)).toEqual(source.map(strip));
    expect(copied.map((entry) => entry.id)).toEqual([0, 1, 2].map((index) => `food_op_${OP_A.slice(0, 24)}_${index}`));
    expect(mealIds(h.store, "2026-11-20", "Cena")).toEqual(["cena_rice_1", "cena_rice_2", "cena_tortilla"]);
  });

  it("«lo de la cena era la merienda» mueve los alimentos conservando sus ids y vacía la cena", async () => {
    const h = harness();
    const outcome = await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Merienda", mode: "move" });
    expect(JSON.parse(outcome.output)).toMatchObject({ status: "moved", origen: { queda_vacia: true } });
    expect(mealIds(h.store, "2026-11-20", "Merienda")).toEqual(["cena_rice_1", "cena_rice_2", "cena_tortilla"]);
    expect(h.store.dietByDate["2026-11-20"].meals.map((meal) => meal.title)).toEqual(["Comida", "Merienda"]);
  });

  it("si el destino tiene alimentos y no se dijo qué hacer, no cambia nada y devuelve lo que hay", async () => {
    const h = harness();
    const before = h.store;
    for (const mode of ["copy", "move"]) {
      const outcome = await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Comida", mode }, OP_A);
      expect(outcome).toMatchObject({ isError: true, status: "no_effect" });
      const payload = JSON.parse(outcome.output);
      expect(payload).toMatchObject({ error: "destination_not_empty", written: false, alimentos_en_destino: [{ entrada_id: "comida_rice" }] });
      expect(payload.message).toMatch(/Pregunta al usuario/);
      expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
    }
    expect(h.store).toBe(before);
  });

  it("mover sobre una comida con alimentos solo los quita si se pide sustituir, y dice cuáles", async () => {
    const appended = harness();
    await appended.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Comida", mode: "move", if_destination_has_foods: "append" });
    expect(mealIds(appended.store, "2026-11-20", "Comida")).toEqual(["comida_rice", "cena_rice_1", "cena_rice_2", "cena_tortilla"]);

    const replaced = harness();
    const outcome = await replaced.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Comida", mode: "move", if_destination_has_foods: "replace" });
    expect(JSON.parse(outcome.output)).toMatchObject({ status: "moved", sustituidos: [{ entrada_id: "comida_rice", nombre: "Arroz blanco" }] });
    expect(mealIds(replaced.store, "2026-11-20", "Comida")).toEqual(["cena_rice_1", "cena_rice_2", "cena_tortilla"]);
  });

  it("rechaza la misma comida, un origen vacío y fechas inválidas sin tocar nada", async () => {
    const h = harness();
    const before = h.store;
    const same = await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Cena", mode: "copy" });
    expect(JSON.parse(same.output)).toMatchObject({ error: "same_meal", recovery: "correct_arguments" });
    const empty = await h.run("copy_meal", { from_date: "2026-11-19", from_meal: "Cena", to_date: "2026-11-20", to_meal: "Desayuno", mode: "copy" });
    expect(JSON.parse(empty.output)).toMatchObject({ error: "meal_empty", written: false });
    const badDate = await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-13-01", to_meal: "Cena", mode: "copy" });
    expect(JSON.parse(badDate.output).error).toBe("invalid_date");
    expect(h.store).toBe(before);
  });

  it("un reintento con el mismo operationId no vuelve a copiar", async () => {
    const h = harness();
    const args = { from_date: "2026-11-20", from_meal: "Comida", to_date: "2026-11-21", to_meal: "Comida", mode: "copy" };
    await h.run("copy_meal", args, OP_A);
    const afterFirst = h.store.dietByDate;
    const retry = await h.run("copy_meal", args, OP_A);
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.dietByDate).toBe(afterFirst);
  });
});

describe("clear_meal", () => {
  it("«borra todo lo de la cena» vacía la cena de ese día y nada más", async () => {
    const h = harness();
    const comida = h.store.dietByDate["2026-11-20"].meals[0];
    const outcome = await h.run("clear_meal", { date: "2026-11-20", meal: "Cena" }, OP_A);
    expect(outcome.status).toBe("committed");
    expect(JSON.parse(outcome.output)).toMatchObject({
      status: "cleared",
      comida: "Cena",
      quitados: [{ entrada_id: "cena_rice_1" }, { entrada_id: "cena_rice_2" }, { entrada_id: "cena_tortilla" }],
      total_kcal_quitadas: 690,
    });
    expect(h.store.dietByDate["2026-11-20"].meals).toEqual([comida]);
  });

  it("no hace nada si la comida ya estaba vacía", async () => {
    const h = harness();
    const before = h.store;
    const outcome = await h.run("clear_meal", { date: "2026-11-20", meal: "Desayuno" });
    expect(outcome).toMatchObject({ isError: true, status: "no_effect" });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "meal_empty", written: false });
    expect(h.store).toBe(before);
  });

  it("un reintento con el mismo operationId no falla aunque la comida ya esté vacía", async () => {
    const h = harness();
    await h.run("clear_meal", { date: "2026-11-20", meal: "Cena" }, OP_B);
    const retry = await h.run("clear_meal", { date: "2026-11-20", meal: "Cena" }, OP_B);
    expect(retry.status).toBe("committed");
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
  });
});

describe("flujo de Coach con comidas enteras", () => {
  it("lee la cena, la copia a otro día, vacía la original y la lectura refleja el resultado", async () => {
    const h = harness();
    const read = JSON.parse((await h.run("read_meal_foods", { date: "2026-11-20", meal: "Cena" })).output);
    expect(read).toHaveLength(3);
    await h.run("copy_meal", { from_date: "2026-11-20", from_meal: "Cena", to_date: "2026-11-22", to_meal: "Cena", mode: "copy" }, OP_A);
    await h.run("clear_meal", { date: "2026-11-20", meal: "Cena" }, OP_B);
    const copied = JSON.parse((await h.run("read_meal_foods", { date: "2026-11-22", meal: "Cena" })).output);
    expect(copied.map((entry: { nombre: string }) => entry.nombre)).toEqual(read.map((entry: { nombre: string }) => entry.nombre));
    const cleared = (await h.run("read_meal_foods", { date: "2026-11-20", meal: "Cena" })).output;
    expect(cleared).not.toContain("cena_rice_1");
    expect(mealIds(h.store, "2026-11-20", "Comida")).toEqual(["comida_rice"]);
  });
});

describe("contrato de las tools de comida entera", () => {
  it("están declaradas como escrituras locales, con schema cerrado y handler registrado", () => {
    const expected: Record<string, string[]> = {
      add_meal_foods: ["date", "meal", "foods"],
      copy_meal: ["from_date", "from_meal", "to_date", "to_meal", "mode"],
      clear_meal: ["date", "meal"],
    };
    for (const [name, required] of Object.entries(expected)) {
      const definition = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name);
      expect(definition, name).toBeDefined();
      expect(agentToolEffect(name)).toBe("local_write");
      expect(definition!.inputSchema).toMatchObject({ required, additionalProperties: false });
      expect(AGENT_TOOL_HANDLER_NAMES).toContain(name);
    }
    for (const name of ["copy_meal", "clear_meal"]) {
      expect(AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name)!.description).toMatch(/nunca por iniciativa propia/);
    }
    expect(AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "copy_meal")!.description).toMatch(/pregunta al usuario/);
  });
});
