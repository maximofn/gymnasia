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
import type { WorkoutSessionSummary } from "../training/workoutHistory";

const exercisesRepo: ToolExerciseRepoEntry[] = [{
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

function routineInput(name: string) {
  return {
    data: {
      name,
      category: "strength",
      icon: "activity",
      duration_minutes: 45,
      exercises: [{
        kind: "catalog",
        source_id: "gymnasia_exercises",
        item_id: "sentadilla",
        series: [{ type: "normal", reps: 8, weight_kg: 60 }, { type: "normal", reps: 8, weight_kg: 60 }],
      }],
    },
  };
}

function operationId(seed: number): string {
  return seed.toString(16).padStart(8, "0").padEnd(64, "a");
}

function harness() {
  let store: ToolStore = { templates: [], dietByDate: {}, measurements: [] };
  let activeTemplateId: string | null = null;
  const dependencies: ToolExecutorDependencies = {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => store.measurements,
    createId: (prefix) => `${prefix}_test`,
    getExerciseImageUrl: () => "",
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
    }).then((outcome) => ({ ...outcome, markEffectCommitted }));
  };
  const createRoutine = async (name: string): Promise<string> => {
    const outcome = await run("create_routine", routineInput(name));
    expect(outcome.isError).not.toBe(true);
    return JSON.parse(outcome.output).template_id as string;
  };
  return {
    run,
    createRoutine,
    commitStore,
    startSession: (templateId: string | null) => { activeTemplateId = templateId; },
    get store() { return store; },
    set store(value: ToolStore) { store = value; },
  };
}

function historyEntry(templateId: string, templateName: string): WorkoutSessionSummary {
  return {
    id: "session_done",
    template_id: templateId,
    template_name: templateName,
    finished_at: "2026-11-20T18:00:00.000Z",
    elapsed_seconds: 2400,
    completion_status: "completed",
    summary_schema_version: 1,
    calculation_version: 1,
    can_recalculate: false,
    prescription_snapshot: null,
    completed_effort_count: 2,
    total_effort_count: 2,
    effort_breakdown: null,
    estimated_calories: 200,
    total_volume_kg: 960,
    total_reps: 16,
  } as WorkoutSessionSummary;
}

describe("update_routine", () => {
  it("renombra la rutina, conserva sus ejercicios y deja recibo", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const exercisesBefore = h.store.templates[0].exercises;
    const outcome = await h.run("update_routine", { routine_id: id, data: { name: "Pierna A" } });
    expect(outcome.isError).not.toBe(true);
    expect(JSON.parse(outcome.output)).toMatchObject({
      status: "updated",
      written: true,
      routine_id: id,
      antes: { nombre: "Pierna" },
      despues: { nombre: "Pierna A", categoria: "strength", icono: "activity", duracion_minutos: "45" },
      ejercicios: 1,
    });
    expect(h.store.templates[0]).toMatchObject({ id, name: "Pierna A", category: "strength", icon: "activity", duration_minutes: "45" });
    expect(h.store.templates[0].exercises).toEqual(exercisesBefore);
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
    expect(h.store.toolOperationReceipts?.map((receipt) => receipt.toolName)).toContain("update_routine");
  });

  it.each([
    [{ category: "cardio" }, { category: "cardio" }],
    [{ icon: "heart" }, { icon: "heart" }],
    [{ duration_minutes: 60 }, { duration_minutes: "60" }],
  ])("cambia solo el campo indicado (%o)", async (data, expected) => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const before = h.store.templates[0];
    const outcome = await h.run("update_routine", { routine_id: id, data });
    expect(outcome.isError).not.toBe(true);
    expect(h.store.templates[0]).toEqual({ ...before, ...expected });
  });

  it("cambia varios campos a la vez", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    await h.run("update_routine", { routine_id: id, data: { name: "Full body", category: "cardio", duration_minutes: 30 } });
    expect(h.store.templates[0]).toMatchObject({ name: "Full body", category: "cardio", duration_minutes: "30", icon: "activity" });
  });

  it("quita la duración con clear_fields", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const outcome = await h.run("update_routine", { routine_id: id, clear_fields: ["duration_minutes"] });
    expect(outcome.isError).not.toBe(true);
    expect(h.store.templates[0].duration_minutes).toBeUndefined();
  });

  it("no acepta cambiar y quitar la duración a la vez", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const before = h.store;
    const outcome = await h.run("update_routine", { routine_id: id, data: { duration_minutes: 30 }, clear_fields: ["duration_minutes"] });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "invalid_routine", recoverable: true });
    expect(h.store).toBe(before);
  });

  it("rechaza una petición sin cambios", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const outcome = await h.run("update_routine", { routine_id: id, data: {} });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "invalid_routine" });
  });

  it("no guarda un nombre vacío: pasa la misma validación que una rutina creada", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const before = h.store;
    const outcome = await h.run("update_routine", { routine_id: id, data: { name: "   " } });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "invalid_routine", status: "invalid_input", written: false });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("devuelve not_found con un id inexistente y no cambia nada", async () => {
    const h = harness();
    await h.createRoutine("Pierna");
    const before = h.store;
    const outcome = await h.run("update_routine", { routine_id: "template_nope", data: { name: "Otra" } });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", status: "not_found", written: false });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("no toca una rutina que se está entrenando", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    h.startSession(id);
    const before = h.store;
    const outcome = await h.run("update_routine", { routine_id: id, data: { name: "Pierna A" } });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "routine_in_active_session", status: "in_active_session", written: false });
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("sí edita otra rutina distinta de la que se está entrenando", async () => {
    const h = harness();
    const training = await h.createRoutine("Pierna");
    const other = await h.createRoutine("Torso");
    h.startSession(training);
    const outcome = await h.run("update_routine", { routine_id: other, data: { name: "Torso A" } });
    expect(outcome.isError).not.toBe(true);
    expect(h.store.templates.map((template) => template.name)).toEqual(["Pierna", "Torso A"]);
  });

  it("un reintento con la misma operación no vuelve a aplicar el cambio", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const op = operationId(999);
    await h.run("update_routine", { routine_id: id, data: { name: "Pierna A" } }, op);
    h.store = { ...h.store, templates: h.store.templates.map((template) => ({ ...template, name: "Cambiada a mano" })) };
    const retry = await h.run("update_routine", { routine_id: id, data: { name: "Pierna A" } }, op);
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.templates[0].name).toBe("Cambiada a mano");
  });

  it("informa sin escribir si los valores ya eran esos", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const before = h.store;
    const outcome = await h.run("update_routine", { routine_id: id, data: { name: "Pierna" } });
    expect(JSON.parse(outcome.output)).toMatchObject({ status: "unchanged", written: false });
    expect(h.store).toBe(before);
  });
});

describe("delete_routine", () => {
  it("borra la rutina, deja recibo y conserva las demás", async () => {
    const h = harness();
    const keep = await h.createRoutine("Torso");
    const remove = await h.createRoutine("Pierna");
    const outcome = await h.run("delete_routine", { routine_id: remove });
    expect(JSON.parse(outcome.output)).toEqual({
      status: "deleted",
      written: true,
      routine_id: remove,
      nombre: "Pierna",
      ejercicios: 1,
      historial_conservado: true,
    });
    expect(h.store.templates.map((template) => template.id)).toEqual([keep]);
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
    expect(h.store.toolOperationReceipts?.map((receipt) => receipt.toolName)).toContain("delete_routine");
  });

  it("conserva el historial de entrenamientos hechos con esa rutina", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const history = [historyEntry(id, "Pierna")];
    h.store = { ...h.store, workoutHistory: history };
    await h.run("delete_routine", { routine_id: id });
    expect(h.store.templates).toEqual([]);
    expect(h.store.workoutHistory).toBe(history);
    const read = await h.run("read_workout_history", { from: "2026-11-01", to: "2026-11-30" });
    expect(read.output).toContain("Pierna");
  });

  it("devuelve not_found con un id inexistente y no cambia nada", async () => {
    const h = harness();
    await h.createRoutine("Pierna");
    const before = h.store;
    const outcome = await h.run("delete_routine", { routine_id: "template_nope" });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", written: false });
    expect(h.store).toBe(before);
  });

  it("no borra una rutina que se está entrenando", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    h.startSession(id);
    const before = h.store;
    const outcome = await h.run("delete_routine", { routine_id: id });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "routine_in_active_session", recoverable: false });
    // Corta el turno: el mensaje llega tal cual al usuario, así que se le habla a él, no al modelo.
    const message = JSON.parse(outcome.output).message as string;
    expect(message).toContain("la estás entrenando");
    expect(message).not.toMatch(/al usuario|Explica/);
    expect(h.store).toBe(before);
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
  });

  it("un reintento con la misma operación responde ya aplicado", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const op = operationId(777);
    await h.run("delete_routine", { routine_id: id }, op);
    const retry = await h.run("delete_routine", { routine_id: id }, op);
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
  });
});

describe("contrato de las herramientas de rutina", () => {
  it.each(["update_routine", "delete_routine"])("%s es una escritura local con handler registrado", (name) => {
    expect(AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === name)).toBeDefined();
    expect(agentToolEffect(name)).toBe("local_write");
    expect(AGENT_TOOL_HANDLER_NAMES).toContain(name);
  });

  it("el schema de update_routine no permite tocar ejercicios", () => {
    const definition = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "update_routine")!;
    expect(validateToolInput(definition.inputSchema, { routine_id: "t", data: { exercises: [] } }).valid).toBe(false);
    expect(validateToolInput(definition.inputSchema, { routine_id: "t", data: { name: "Pierna A" } }).valid).toBe(true);
  });

  it("read_routines expone el id y el icono que necesitan las herramientas", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    const read = await h.run("read_routines", {});
    expect(JSON.parse(read.output)).toEqual([expect.objectContaining({ id, nombre: "Pierna", icono: "activity" })]);
  });

  it("una rutina editada sigue pasando la validación de escritura", async () => {
    const h = harness();
    const id = await h.createRoutine("Pierna");
    await h.run("update_routine", { routine_id: id, data: { name: "Pierna A", category: "cardio", icon: "heart" } });
    expect(validateWorkoutTemplateForWrite(h.store.templates[0]).ok).toBe(true);
  });
});

describe("propiedades", () => {
  it("borrar un id elimina exactamente esa rutina y editar una nunca altera las demás", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.nat(),
      fc.boolean(),
      fc.string({ minLength: 1, maxLength: 40 }).filter((name) => name.trim().length > 0),
      async (count, pick, shouldDelete, newName) => {
        const h = harness();
        const ids: string[] = [];
        for (let index = 0; index < count; index++) ids.push(await h.createRoutine(`Rutina ${index}`));
        const target = ids[pick % count];
        const others = h.store.templates.filter((template) => template.id !== target);
        if (shouldDelete) {
          await h.run("delete_routine", { routine_id: target });
          expect(h.store.templates).toEqual(others);
        } else {
          await h.run("update_routine", { routine_id: target, data: { name: newName } });
          expect(h.store.templates.filter((template) => template.id !== target)).toEqual(others);
          expect(h.store.templates.map((template) => template.id)).toEqual(ids);
        }
      },
    ), { numRuns: 60, seed: 273273 });
  });
});
