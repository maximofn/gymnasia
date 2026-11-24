import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { AGENT_TOOL_DEFINITIONS, agentToolEffect, validateToolInput } from "./toolDefinitions";
import {
  AGENT_TOOL_HANDLER_NAMES,
  createDetailedAgentToolExecutor,
  type ToolExecutorDependencies,
  type ToolExerciseRepoEntry,
  type ToolStore,
} from "./toolExecutor";
import { validateWorkoutTemplateForWrite } from "../training/workoutTemplateContract";

function catalogEntry(id: string, name: string, muscle: string): ToolExerciseRepoEntry {
  return {
    id,
    sourceId: "gymnasia_exercises",
    name,
    image_male: `images/${id}-male.webp`,
    image_female: `images/${id}-female.webp`,
    muscle_group: muscle,
    secondary_muscles: [],
    equipment: "Barra",
    difficulty: "Intermedio",
    instructions: "Con control.",
  };
}

const exercisesRepo: ToolExerciseRepoEntry[] = [
  catalogEntry("remo", "Remo con barra", "Espalda"),
  catalogEntry("sentadilla", "Sentadilla", "Cuádriceps"),
  catalogEntry("press", "Press de banca", "Pecho"),
  catalogEntry("dominadas", "Dominadas", "Espalda"),
];

const catalog = (itemId: string) => ({ kind: "catalog", source_id: "gymnasia_exercises", item_id: itemId });

function normalSeries(count: number, reps: number, weight?: number) {
  return Array.from({ length: count }, () => ({ type: "normal", reps, ...(weight !== undefined ? { weight_kg: weight } : {}) }));
}

/** Remo, sentadilla y press, cada uno con dos o tres series. */
function routineInput(name = "Espalda") {
  return {
    data: {
      name,
      category: "strength",
      icon: "activity",
      exercises: [
        { ...catalog("remo"), series: normalSeries(2, 10, 50) },
        { ...catalog("sentadilla"), series: normalSeries(3, 8, 80) },
        { ...catalog("press"), series: [{ type: "normal", reps: 10, weight_kg: 50, rest_seconds: 90 }, { type: "normal", reps: 8, weight_kg: 55, rest_seconds: 90 }] },
      ],
    },
  };
}

function operationId(seed: number): string {
  return seed.toString(16).padStart(8, "0").padEnd(64, "b");
}

function harness() {
  let store: ToolStore = { templates: [], dietByDate: {}, measurements: [] };
  let activeTemplateId: string | null = null;
  let idCounter = 0;
  const dependencies: ToolExecutorDependencies = {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => store.measurements,
    createId: (prefix) => `${prefix}_${++idCounter}`,
    getExerciseImageUrl: (exercise) => `https://img/${exercise.id}`,
    submitFeedbackIssue: async () => ({ status: "canceled" as const }),
  };
  const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => { store = updater(store); });
  const execute = createDetailedAgentToolExecutor(dependencies);
  let nextOperation = 1;
  const run = (name: string, args: Record<string, unknown>, opId: string = operationId(nextOperation++)) => {
    const markEffectCommitted = vi.fn();
    return execute(name, args, {
      store,
      commitStore,
      operationId: opId,
      markEffectCommitted,
      exercisesRepo,
      getActiveWorkoutTemplateId: () => activeTemplateId,
    }).then((outcome) => ({ ...outcome, markEffectCommitted, json: () => JSON.parse(outcome.output) }));
  };
  const createRoutine = async (input: Record<string, unknown> = routineInput()): Promise<string> => {
    const outcome = await run("create_routine", input);
    expect(outcome.isError).not.toBe(true);
    return JSON.parse(outcome.output).template_id as string;
  };
  return {
    run,
    createRoutine,
    startSession: (templateId: string | null) => { activeTemplateId = templateId; },
    routine: (id: string) => store.templates.find((template) => template.id === id)!,
    exerciseId: (routineId: string, index: number) => store.templates.find((template) => template.id === routineId)!.exercises[index].id,
    names: (id: string) => store.templates.find((template) => template.id === id)!.exercises.map((exercise) => exercise.name),
    get store() { return store; },
    set store(value: ToolStore) { store = value; },
  };
}

describe("read_routines", () => {
  it("expone ids estables de ejercicio y de serie que coinciden con el almacén", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const [routine] = (await h.run("read_routines", {})).json();
    const stored = h.routine(id);
    expect(routine.ejercicios.map((exercise: { ejercicio_id: string }) => exercise.ejercicio_id))
      .toEqual(stored.exercises.map((exercise) => exercise.id));
    expect(routine.ejercicios[1].series.map((series: { serie_id: string }) => series.serie_id))
      .toEqual(stored.exercises[1].series!.map((series) => series.id));
  });
});

describe("add_routine_exercise", () => {
  it("«añade dominadas, 3x8» las añade al final con tres series de 8", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.routine(id).exercises;
    const outcome = await h.run("add_routine_exercise", {
      routine_id: id,
      exercise: { ...catalog("dominadas"), series: normalSeries(3, 8) },
    });
    expect(outcome.isError).not.toBe(true);
    const result = outcome.json();
    expect(result).toMatchObject({ status: "updated", written: true, routine_id: id, despues: { nombre: "Dominadas", posicion: 4 } });
    expect(result.orden).toEqual(["Remo con barra", "Sentadilla", "Press de banca", "Dominadas"]);
    const after = h.routine(id).exercises;
    expect(after.slice(0, 3)).toEqual(before);
    expect(after[3]).toMatchObject({
      name: "Dominadas",
      muscle: "Espalda",
      image_uri: "https://img/dominadas",
      catalog_link: { status: "linked", ref: { sourceId: "gymnasia_exercises", itemId: "dominadas" } },
    });
    expect(after[3].series!.map((series) => [series.type, series.reps])).toEqual([["normal", "8"], ["normal", "8"], ["normal", "8"]]);
    expect(new Set(after[3].series!.map((series) => series.id)).size).toBe(3);
    expect(validateWorkoutTemplateForWrite(h.routine(id)).ok).toBe(true);
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
    expect(h.store.toolOperationReceipts?.map((receipt) => receipt.toolName)).toContain("add_routine_exercise");
  });

  it("con position lo coloca ahí y conserva el orden relativo de los demás", async () => {
    const h = harness();
    const id = await h.createRoutine();
    await h.run("add_routine_exercise", { routine_id: id, exercise: { ...catalog("dominadas"), series: normalSeries(1, 8) }, position: 2 });
    expect(h.names(id)).toEqual(["Remo con barra", "Dominadas", "Sentadilla", "Press de banca"]);
  });

  it("acepta un ejercicio personalizado", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const outcome = await h.run("add_routine_exercise", {
      routine_id: id,
      exercise: { kind: "custom", name: "Face pull", muscle: "Hombro", series: normalSeries(2, 15) },
    });
    expect(outcome.isError).not.toBe(true);
    expect(h.routine(id).exercises[3]).toMatchObject({ name: "Face pull", muscle: "Hombro", catalog_link: { status: "unresolved" } });
  });

  it("una superserie del ejercicio nuevo apunta al ejercicio que ya está en la rutina", async () => {
    const h = harness();
    const id = await h.createRoutine();
    await h.run("add_routine_exercise", {
      routine_id: id,
      exercise: {
        ...catalog("dominadas"),
        series: [{ type: "superset", reps: 8, sub_series: [{ reps: 10, target: catalog("remo") }] }],
      },
    });
    const added = h.routine(id).exercises[3];
    expect(added.series![0].sub_series![0]).toMatchObject({ exercise_name: "Remo con barra", exercise_id: h.exerciseId(id, 0) });
  });

  it("rechaza un ejercicio que no está en el catálogo sin cambiar nada", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.store;
    const outcome = await h.run("add_routine_exercise", { routine_id: id, exercise: { ...catalog("inventado"), series: normalSeries(1, 8) } });
    expect(outcome.json()).toMatchObject({ error: "invalid_routine", written: false, issues: [expect.objectContaining({ code: "catalog_not_found" })] });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("devuelve not_found si la rutina no existe", async () => {
    const h = harness();
    await h.createRoutine();
    const before = h.store;
    const outcome = await h.run("add_routine_exercise", { routine_id: "template_nope", exercise: { ...catalog("dominadas"), series: normalSeries(1, 8) } });
    expect(outcome.json()).toMatchObject({ error: "not_found", status: "not_found", written: false });
    expect(h.store).toBe(before);
  });

  it("no toca una rutina que se está entrenando", async () => {
    const h = harness();
    const id = await h.createRoutine();
    h.startSession(id);
    const before = h.store;
    const outcome = await h.run("add_routine_exercise", { routine_id: id, exercise: { ...catalog("dominadas"), series: normalSeries(1, 8) } });
    expect(outcome.json()).toMatchObject({ error: "routine_in_active_session", written: false });
    expect(h.store).toBe(before);
  });

  it("un reintento con la misma operación no lo añade dos veces", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const op = operationId(4242);
    const args = { routine_id: id, exercise: { ...catalog("dominadas"), series: normalSeries(3, 8) } };
    await h.run("add_routine_exercise", args, op);
    const retry = await h.run("add_routine_exercise", args, op);
    expect(retry.json()).toEqual({ status: "already_applied", written: true });
    expect(h.names(id)).toEqual(["Remo con barra", "Sentadilla", "Press de banca", "Dominadas"]);
  });
});

describe("update_routine_exercise", () => {
  it("«súbele el peso del press a 60» cambia el peso de sus series y nada más", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.routine(id);
    const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 2), all_series: { weight_kg: 60 } });
    expect(outcome.isError).not.toBe(true);
    const result = outcome.json();
    expect(result.antes.series.map((series: { peso_kg: string }) => series.peso_kg)).toEqual(["50", "55"]);
    expect(result.despues.series.map((series: { peso_kg: string }) => series.peso_kg)).toEqual(["60", "60"]);
    const after = h.routine(id);
    expect(after.exercises.slice(0, 2)).toEqual(before.exercises.slice(0, 2));
    expect(after.exercises[2].series).toEqual(before.exercises[2].series!.map((series) => ({ ...series, weight_kg: "60" })));
    expect(after.exercises[2].load_kg).toBe(60);
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ reps: 12 }, { reps: "12" }],
    [{ weight_kg: 62.5 }, { weight_kg: "62.5" }],
    [{ rest_seconds: 120 }, { rest_seconds: "120" }],
    [{ type: "warmup" }, { type: "warmup" }],
    [{ type: "tempo", tempo_contraction: 3, tempo_pause: 1, tempo_relaxation: 2 }, { type: "tempo", tempo_contraction: "3", tempo_pause: "1", tempo_relaxation: "2" }],
  ])("series_updates cambia solo el campo indicado de esa serie (%o)", async (patch, expected) => {
    const h = harness();
    const id = await h.createRoutine();
    const exercise = h.routine(id).exercises[2];
    const [first, second] = exercise.series!;
    const outcome = await h.run("update_routine_exercise", {
      routine_id: id,
      exercise_id: exercise.id,
      series_updates: [{ series_id: first.id, ...patch }],
    });
    expect(outcome.isError).not.toBe(true);
    const after = h.routine(id).exercises[2].series!;
    expect(after[0]).toEqual({ ...first, ...expected });
    expect(after[1]).toEqual(second);
  });

  it("quita series concretas y añade otras al final", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const exercise = h.routine(id).exercises[1];
    const [first, , third] = exercise.series!;
    await h.run("update_routine_exercise", {
      routine_id: id,
      exercise_id: exercise.id,
      remove_series_ids: [exercise.series![1].id],
      add_series: [{ type: "normal", reps: 5, weight_kg: 100 }],
    });
    const after = h.routine(id).exercises[1].series!;
    expect(after.slice(0, 2)).toEqual([first, third]);
    expect(after[2]).toMatchObject({ type: "normal", reps: "5", weight_kg: "100" });
  });

  it("«pon las sentadillas la primera» la mueve y conserva el orden relativo de los demás", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 1), position: 1 });
    expect(outcome.json()).toMatchObject({ antes: { posicion: 2 }, despues: { posicion: 1 } });
    expect(h.names(id)).toEqual(["Sentadilla", "Remo con barra", "Press de banca"]);
  });

  it("una posición mayor que la rutina lo lleva al final", async () => {
    const h = harness();
    const id = await h.createRoutine();
    await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0), position: 99 });
    expect(h.names(id)).toEqual(["Sentadilla", "Press de banca", "Remo con barra"]);
  });

  it("rechaza entera una edición que dejaría el ejercicio sin series", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const exercise = h.routine(id).exercises[0];
    const before = h.store;
    const outcome = await h.run("update_routine_exercise", {
      routine_id: id,
      exercise_id: exercise.id,
      all_series: { weight_kg: 70 },
      remove_series_ids: exercise.series!.map((series) => series.id),
    });
    expect(outcome.json()).toMatchObject({ error: "invalid_routine", written: false, issues: [expect.objectContaining({ code: "empty_collection" })] });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("rechaza pasar a tempo sin los tiempos, o a superserie sin ejercicio objetivo", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.store;
    for (const type of ["tempo", "superset"]) {
      const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0), all_series: { type } });
      expect(outcome.json()).toMatchObject({ error: "invalid_routine", written: false });
    }
    expect(h.store).toBe(before);
  });

  it("devuelve not_found con un ejercicio o una serie inexistentes, sin cambiar nada", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.store;
    const missingExercise = await h.run("update_routine_exercise", { routine_id: id, exercise_id: "exercise_nope", all_series: { reps: 5 } });
    expect(missingExercise.json()).toMatchObject({ error: "not_found", status: "not_found", written: false });
    const missingSeries = await h.run("update_routine_exercise", {
      routine_id: id,
      exercise_id: h.exerciseId(id, 0),
      all_series: { reps: 5 },
      series_updates: [{ series_id: "series_nope", reps: 6 }],
    });
    expect(missingSeries.json()).toMatchObject({ error: "not_found", written: false });
    expect(missingSeries.json().message).toContain("series_nope");
    expect(h.store).toBe(before);
  });

  it("una serie de otro ejercicio cuenta como inexistente", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const foreignSeries = h.routine(id).exercises[1].series![0].id;
    const outcome = await h.run("update_routine_exercise", {
      routine_id: id,
      exercise_id: h.exerciseId(id, 0),
      series_updates: [{ series_id: foreignSeries, reps: 6 }],
    });
    expect(outcome.json()).toMatchObject({ error: "not_found" });
  });

  it.each([
    ["sin cambios", {}],
    ["all_series vacío", { all_series: {} }],
    ["una serie sin campos", { series_updates: [{ series_id: "x" }] }],
  ])("rechaza una petición %s", async (_label, extra) => {
    const h = harness();
    const id = await h.createRoutine();
    const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0), ...extra });
    expect(outcome.json()).toMatchObject({ error: "invalid_routine", written: false });
  });

  it("rechaza cambiar y quitar la misma serie, o repetirla en series_updates", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const seriesId = h.routine(id).exercises[0].series![0].id;
    const both = await h.run("update_routine_exercise", {
      routine_id: id, exercise_id: h.exerciseId(id, 0),
      series_updates: [{ series_id: seriesId, reps: 6 }], remove_series_ids: [seriesId],
    });
    expect(both.json()).toMatchObject({ error: "invalid_routine" });
    const repeated = await h.run("update_routine_exercise", {
      routine_id: id, exercise_id: h.exerciseId(id, 0),
      series_updates: [{ series_id: seriesId, reps: 6 }, { series_id: seriesId, weight_kg: 10 }],
    });
    expect(repeated.json()).toMatchObject({ error: "invalid_routine" });
  });

  it("informa sin escribir si los valores ya eran esos", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.store;
    const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0), all_series: { weight_kg: 50 } });
    expect(outcome.json()).toMatchObject({ status: "unchanged", written: false });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("no toca una rutina que se está entrenando", async () => {
    const h = harness();
    const id = await h.createRoutine();
    h.startSession(id);
    const before = h.store;
    const outcome = await h.run("update_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0), all_series: { weight_kg: 60 } });
    expect(outcome.json()).toMatchObject({ error: "routine_in_active_session", written: false });
    expect(h.store).toBe(before);
  });

  it("un reintento con la misma operación no repite el cambio", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const op = operationId(5151);
    const args = { routine_id: id, exercise_id: h.exerciseId(id, 1), add_series: [{ type: "normal", reps: 5 }] };
    await h.run("update_routine_exercise", args, op);
    const retry = await h.run("update_routine_exercise", args, op);
    expect(retry.json()).toEqual({ status: "already_applied", written: true });
    expect(h.routine(id).exercises[1].series).toHaveLength(4);
  });
});

describe("remove_routine_exercise", () => {
  it("«quita las sentadillas» la elimina y conserva los demás en su orden", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const [remo, sentadilla, press] = h.routine(id).exercises;
    const outcome = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: sentadilla.id });
    expect(outcome.json()).toMatchObject({
      status: "updated",
      written: true,
      quitado: { ejercicio_id: sentadilla.id, nombre: "Sentadilla" },
      orden: ["Remo con barra", "Press de banca"],
    });
    expect(h.routine(id).exercises).toEqual([remo, press]);
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
    expect(h.store.toolOperationReceipts?.map((receipt) => receipt.toolName)).toContain("remove_routine_exercise");
  });

  it("no quita el único ejercicio de una rutina", async () => {
    const h = harness();
    const id = await h.createRoutine({ data: { ...routineInput().data, exercises: [{ ...catalog("remo"), series: normalSeries(1, 10) }] } });
    const before = h.store;
    const outcome = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0) });
    expect(outcome.json()).toMatchObject({ error: "invalid_routine", status: "last_exercise", written: false });
    expect(outcome.json().message).toContain("delete_routine");
    expect(h.store).toBe(before);
  });

  it("no quita un ejercicio que forma parte de una superserie de otro", async () => {
    const h = harness();
    const id = await h.createRoutine({
      data: {
        ...routineInput().data,
        exercises: [
          { ...catalog("remo"), series: normalSeries(1, 10) },
          { ...catalog("dominadas"), series: [{ type: "superset", reps: 8, sub_series: [{ reps: 10, target: catalog("remo") }] }] },
        ],
      },
    });
    const before = h.store;
    const outcome = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0) });
    expect(outcome.json()).toMatchObject({
      error: "exercise_in_superset",
      status: "in_superset",
      written: false,
      recoverable: true,
      referenciado_por: [h.exerciseId(id, 1)],
    });
    expect(outcome.json().message).toContain("Dominadas");
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
    // El ejercicio que contiene la superserie sí se puede quitar.
    const ownerRemoval = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 1) });
    expect(ownerRemoval.isError).not.toBe(true);
  });

  it("devuelve not_found con un ejercicio inexistente", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const before = h.store;
    const outcome = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: "exercise_nope" });
    expect(outcome.json()).toMatchObject({ error: "not_found", written: false });
    expect(h.store).toBe(before);
  });

  it("no toca una rutina que se está entrenando", async () => {
    const h = harness();
    const id = await h.createRoutine();
    h.startSession(id);
    const before = h.store;
    const outcome = await h.run("remove_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 1) });
    expect(outcome.json()).toMatchObject({ error: "routine_in_active_session" });
    expect(h.store).toBe(before);
  });
});

describe("regresión: el mismo ejercicio dos veces", () => {
  async function duplicatedRoutine() {
    const h = harness();
    const id = await h.createRoutine({
      data: {
        ...routineInput().data,
        exercises: [
          { ...catalog("sentadilla"), series: normalSeries(2, 10, 60) },
          { ...catalog("remo"), series: normalSeries(2, 10, 50) },
          { ...catalog("sentadilla"), series: normalSeries(2, 5, 100) },
        ],
      },
    });
    return { h, id };
  }

  it("read_routines los distingue y editar uno no toca el otro", async () => {
    const { h, id } = await duplicatedRoutine();
    const [routine] = (await h.run("read_routines", {})).json();
    const ids = routine.ejercicios.map((exercise: { ejercicio_id: string }) => exercise.ejercicio_id);
    expect(new Set(ids).size).toBe(3);
    const firstBefore = h.routine(id).exercises[0];
    await h.run("update_routine_exercise", { routine_id: id, exercise_id: ids[2], all_series: { weight_kg: 110 } });
    expect(h.routine(id).exercises[0]).toEqual(firstBefore);
    expect(h.routine(id).exercises[2].series!.map((series) => series.weight_kg)).toEqual(["110", "110"]);
  });

  it("quitar uno deja el otro", async () => {
    const { h, id } = await duplicatedRoutine();
    const kept = h.routine(id).exercises[2];
    await h.run("remove_routine_exercise", { routine_id: id, exercise_id: h.exerciseId(id, 0) });
    expect(h.routine(id).exercises.map((exercise) => exercise.id)).toEqual([h.exerciseId(id, 0), kept.id]);
    expect(h.routine(id).exercises[1]).toEqual(kept);
  });
});

describe("integración con el catálogo", () => {
  it("read_routines → search_exercises → add_routine_exercise con los ids devueltos", async () => {
    const h = harness();
    const id = await h.createRoutine();
    const [routine] = (await h.run("read_routines", {})).json();
    const search = (await h.run("search_exercises", { query: "dominadas" })).json();
    const hit = search.results[0];
    expect(hit).toMatchObject({ source_id: "gymnasia_exercises", item_id: "dominadas" });
    const outcome = await h.run("add_routine_exercise", {
      routine_id: routine.id,
      exercise: { kind: "catalog", source_id: hit.source_id, item_id: hit.item_id, series: normalSeries(3, 8) },
    });
    expect(outcome.isError).not.toBe(true);
    const [after] = (await h.run("read_routines", {})).json();
    expect(after.ejercicios.at(-1)).toMatchObject({ nombre: "Dominadas", item_id: "dominadas", series: [{ repeticiones: "8" }, { repeticiones: "8" }, { repeticiones: "8" }] });
    expect(h.routine(id).exercises).toHaveLength(4);
  });
});

describe("contrato", () => {
  const names = ["add_routine_exercise", "update_routine_exercise", "remove_routine_exercise"];

  it.each(names)("%s es una escritura local con handler registrado", (name) => {
    expect(AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name)).toBeDefined();
    expect(agentToolEffect(name)).toBe("local_write");
    expect(AGENT_TOOL_HANDLER_NAMES).toContain(name);
  });

  it("los schemas aceptan las llamadas típicas y rechazan campos desconocidos", () => {
    const schema = (name: string) => AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name)!.inputSchema;
    expect(validateToolInput(schema("add_routine_exercise"), { routine_id: "t", exercise: { ...catalog("x"), series: normalSeries(1, 8) }, position: 1 }).valid).toBe(true);
    expect(validateToolInput(schema("add_routine_exercise"), { routine_id: "t", exercise: { ...catalog("x"), series: [] } }).valid).toBe(false);
    expect(validateToolInput(schema("update_routine_exercise"), {
      routine_id: "t", exercise_id: "e",
      all_series: { weight_kg: 60 },
      series_updates: [{ series_id: "s", reps: 8 }],
      remove_series_ids: ["s2"],
      add_series: normalSeries(1, 8),
      position: 2,
    }).valid).toBe(true);
    expect(validateToolInput(schema("update_routine_exercise"), { routine_id: "t", exercise_id: "e", all_series: { sub_series: [] } }).valid).toBe(false);
    expect(validateToolInput(schema("update_routine_exercise"), { routine_id: "t", exercise_id: "e", position: 0 }).valid).toBe(false);
    expect(validateToolInput(schema("remove_routine_exercise"), { routine_id: "t", exercise_id: "e", extra: 1 }).valid).toBe(false);
  });
});

type Operation =
  | { tool: "add"; position?: number; reps: number; valid: boolean }
  | { tool: "update"; exercise: number; weight?: number; reps?: number; removeSeries: number; addSeries: number; position?: number; bogusSeries: boolean }
  | { tool: "remove"; exercise: number };

const operationArbitrary: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({
    tool: fc.constant("add" as const),
    position: fc.option(fc.integer({ min: 1, max: 8 }), { nil: undefined }),
    reps: fc.integer({ min: 1, max: 20 }),
    valid: fc.boolean(),
  }),
  fc.record({
    tool: fc.constant("update" as const),
    exercise: fc.integer({ min: -1, max: 6 }),
    weight: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
    reps: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
    removeSeries: fc.integer({ min: 0, max: 4 }),
    addSeries: fc.integer({ min: 0, max: 2 }),
    position: fc.option(fc.integer({ min: 1, max: 8 }), { nil: undefined }),
    bogusSeries: fc.boolean(),
  }),
  fc.record({ tool: fc.constant("remove" as const), exercise: fc.integer({ min: -1, max: 6 }) }),
);

describe("propiedades", () => {
  it("cualquier secuencia deja una rutina válida o se rechaza sin cambios, y nunca toca otras rutinas", async () => {
    await fc.assert(fc.asyncProperty(fc.array(operationArbitrary, { minLength: 1, maxLength: 8 }), async (operations) => {
      const h = harness();
      const id = await h.createRoutine();
      const otherId = await h.createRoutine(routineInput("Otra"));
      const other = h.routine(otherId);
      for (const operation of operations) {
        const routine = h.routine(id);
        const exerciseIdAt = (index: number) => (index < 0 ? "exercise_nope" : routine.exercises[index % routine.exercises.length].id);
        let args: Record<string, unknown>;
        let tool: string;
        if (operation.tool === "add") {
          tool = "add_routine_exercise";
          args = {
            routine_id: id,
            exercise: { ...catalog(operation.valid ? "dominadas" : "inventado"), series: normalSeries(2, operation.reps) },
            ...(operation.position !== undefined ? { position: operation.position } : {}),
          };
        } else if (operation.tool === "update") {
          tool = "update_routine_exercise";
          const exerciseId = exerciseIdAt(operation.exercise);
          const series = routine.exercises.find((exercise) => exercise.id === exerciseId)?.series ?? [];
          const removeIds = series.slice(0, operation.removeSeries).map((item) => item.id);
          args = {
            routine_id: id,
            exercise_id: exerciseId,
            ...(operation.weight !== undefined || operation.reps !== undefined ? {
              all_series: {
                ...(operation.weight !== undefined ? { weight_kg: operation.weight } : {}),
                ...(operation.reps !== undefined ? { reps: operation.reps } : {}),
              },
            } : {}),
            ...(removeIds.length > 0 || operation.bogusSeries
              ? { remove_series_ids: [...removeIds, ...(operation.bogusSeries ? ["series_nope"] : [])] }
              : {}),
            ...(operation.addSeries > 0 ? { add_series: normalSeries(operation.addSeries, 6) } : {}),
            ...(operation.position !== undefined ? { position: operation.position } : {}),
          };
        } else {
          tool = "remove_routine_exercise";
          args = { routine_id: id, exercise_id: exerciseIdAt(operation.exercise) };
        }
        const before = h.store;
        const outcome = await h.run(tool, args);
        if (outcome.isError || outcome.json().written === false) {
          expect(h.store).toBe(before);
        } else {
          expect(validateWorkoutTemplateForWrite(h.routine(id)).ok).toBe(true);
          const ids = h.routine(id).exercises.map((exercise) => exercise.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
        expect(h.routine(otherId)).toEqual(other);
      }
    }), { numRuns: 60 });
  });

  it("mover un ejercicio conserva el orden relativo de los demás", async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 2 }), fc.integer({ min: 1, max: 5 }), async (index, position) => {
      const h = harness();
      const id = await h.createRoutine();
      const ids = h.routine(id).exercises.map((exercise) => exercise.id);
      const moved = ids[index];
      await h.run("update_routine_exercise", { routine_id: id, exercise_id: moved, position });
      const after = h.routine(id).exercises.map((exercise) => exercise.id);
      expect(after.filter((item) => item !== moved)).toEqual(ids.filter((item) => item !== moved));
      expect(after.indexOf(moved)).toBe(Math.min(position, ids.length) - 1);
    }));
  });
});
