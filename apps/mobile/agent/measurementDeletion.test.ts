import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { AGENT_TOOL_DEFINITIONS, agentToolEffect } from "./toolDefinitions";
import {
  AGENT_TOOL_HANDLER_NAMES,
  createDetailedAgentToolExecutor,
  type ToolExecutorDependencies,
  type ToolMeasurement,
  type ToolStore,
} from "./toolExecutor";

function measurement(
  id: string,
  measuredOn: string,
  values: Partial<ToolMeasurement> = {},
): ToolMeasurement {
  return {
    id,
    measured_on: measuredOn,
    measured_at: `${measuredOn}T12:00:00.000Z`,
    weight_kg: 72,
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
    ...values,
  };
}

function harness(measurements: ToolMeasurement[]) {
  let store: ToolStore = { templates: [], dietByDate: {}, measurements };
  const releaseMeasurementPhoto = vi.fn();
  const dependencies: ToolExecutorDependencies = {
    loadPersonalData: async () => [],
    savePersonalData: async () => {},
    loadMeasurements: async () => store.measurements,
    createId: (prefix) => `${prefix}_test`,
    getExerciseImageUrl: () => "",
    submitFeedbackIssue: async () => ({ status: "canceled" as const }),
    releaseMeasurementPhoto,
  };
  const commitStore = vi.fn(async (updater: (previous: ToolStore) => ToolStore) => { store = updater(store); });
  const execute = createDetailedAgentToolExecutor(dependencies);
  const run = (name: string, args: Record<string, unknown>, operationId?: string) => {
    const markEffectCommitted = vi.fn();
    return execute(name, args, { store, commitStore, operationId, markEffectCommitted })
      .then((outcome) => ({ ...outcome, markEffectCommitted }));
  };
  return { run, releaseMeasurementPhoto, get store() { return store; } };
}

describe("delete_measurement", () => {
  it("borra la medición de esa fecha, deja recibo y conserva las demás", async () => {
    const other = measurement("m_other", "2026-11-22", { weight_kg: 71 });
    const h = harness([measurement("m_target", "2026-11-23", { waist_cm: 80 }), other]);
    const outcome = await h.run("delete_measurement", { date: "2026-11-23" }, "a".repeat(64));

    expect(outcome.status).toBe("committed");
    expect(JSON.parse(outcome.output)).toEqual({
      status: "deleted",
      written: true,
      fecha: "2026-11-23",
      medidas_borradas: expect.objectContaining({ weight_kg: 72, waist_cm: 80 }),
      tenia_foto: false,
    });
    expect(outcome.markEffectCommitted).toHaveBeenCalledTimes(1);
    expect(h.store.measurements).toEqual([other]);
    expect(h.store.toolOperationReceipts).toEqual([expect.objectContaining({ toolName: "delete_measurement" })]);
  });

  it("retira la foto con la misma política que el historial", async () => {
    const h = harness([
      measurement("m_target", "2026-11-23", { photo_uri: "file:///media/a.jpg" }),
      measurement("m_other", "2026-11-22", { photo_uri: "file:///media/b.jpg" }),
    ]);
    const outcome = await h.run("delete_measurement", { date: "2026-11-23" });
    expect(JSON.parse(outcome.output)).toMatchObject({ tenia_foto: true });
    expect(h.releaseMeasurementPhoto).toHaveBeenCalledWith("file:///media/a.jpg", ["file:///media/b.jpg"]);
  });

  it("sin medición ese día devuelve not_found y no toca otra fecha", async () => {
    const h = harness([measurement("m_other", "2026-11-22")]);
    const before = h.store;
    const outcome = await h.run("delete_measurement", { date: "2026-11-23" });
    expect(outcome).toMatchObject({ isError: true, status: "no_effect" });
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "not_found", written: false });
    expect(outcome.markEffectCommitted).not.toHaveBeenCalled();
    expect(h.store).toBe(before);
    expect(h.releaseMeasurementPhoto).not.toHaveBeenCalled();
  });

  it("con varias mediciones el mismo día no borra ninguna y usa el código de read_measurement", async () => {
    const h = harness([measurement("m_1", "2026-11-23"), measurement("m_2", "2026-11-23", { weight_kg: 73 })]);
    const before = h.store;
    const deletion = await h.run("delete_measurement", { date: "2026-11-23" });
    const read = await h.run("read_measurement", { date: "2026-11-23" });
    expect(JSON.parse(deletion.output)).toMatchObject({ error: "ambiguous_measurement", written: false });
    expect(JSON.parse(read.output)).toMatchObject({ error: "ambiguous_measurement" });
    expect(h.store).toBe(before);
  });

  it("rechaza una fecha inválida sin tocar nada", async () => {
    const h = harness([measurement("m_target", "2026-11-23")]);
    const before = h.store;
    const outcome = await h.run("delete_measurement", { date: "2026-02-30" });
    expect(outcome.isError).toBe(true);
    expect(JSON.parse(outcome.output)).toMatchObject({ error: "invalid_measurement" });
    expect(h.store).toBe(before);
  });

  it("un reintento con el mismo operationId no falla ni borra otra cosa", async () => {
    const h = harness([measurement("m_target", "2026-11-23"), measurement("m_other", "2026-11-22")]);
    const operationId = "b".repeat(64);
    await h.run("delete_measurement", { date: "2026-11-23" }, operationId);
    const afterFirst = h.store.measurements;
    const retry = await h.run("delete_measurement", { date: "2026-11-23" }, operationId);
    expect(retry.status).toBe("committed");
    expect(JSON.parse(retry.output)).toEqual({ status: "already_applied", written: true });
    expect(h.store.measurements).toBe(afterFirst);
    expect(h.releaseMeasurementPhoto).toHaveBeenCalledTimes(1);
  });

  it("regresión: mover el peso del día equivocado al correcto deja el equivocado sin medición", async () => {
    const h = harness([measurement("m_wrong", "2026-11-22", { weight_kg: 74 })]);
    await h.run("write_measurement", { date: "2026-11-23", data: { weight_kg: 74 } }, "c".repeat(64));
    // Antes de esta tool, vaciar el último campo se rechazaba y el día equivocado se quedaba.
    const cleared = await h.run("write_measurement", { date: "2026-11-22", data: {}, clear_fields: ["weight_kg"] }, "d".repeat(64));
    expect(cleared.isError).toBe(true);
    await h.run("delete_measurement", { date: "2026-11-22" }, "e".repeat(64));
    expect(h.store.measurements).toEqual([expect.objectContaining({ measured_on: "2026-11-23", weight_kg: 74 })]);
  });

  it("propiedad: con fechas únicas, borrar una elimina exactamente esa y conserva las demás intactas", async () => {
    const dateArb = fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2025-12-31T00:00:00Z"), noInvalidDate: true })
      .map((date) => date.toISOString().slice(0, 10));
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(dateArb, { minLength: 1, maxLength: 12 }),
      fc.nat(),
      async (dates, pick) => {
        const initial = dates.map((date, index) => measurement(`m_${index}`, date, { weight_kg: 60 + index }));
        const target = dates[pick % dates.length];
        const h = harness(initial);
        const outcome = await h.run("delete_measurement", { date: target });
        expect(outcome.status).toBe("committed");
        expect(h.store.measurements).toHaveLength(initial.length - 1);
        expect(h.store.measurements).toEqual(initial.filter((item) => item.measured_on !== target));
      },
    ), { numRuns: 60 });
  });

  it("contrato: escritura local, schema cerrado, handler registrado y uso solo bajo petición", () => {
    const definition = AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "delete_measurement");
    expect(definition).toBeDefined();
    expect(agentToolEffect("delete_measurement")).toBe("local_write");
    expect(definition!.inputSchema).toMatchObject({ required: ["date"], additionalProperties: false });
    expect(definition!.description).toMatch(/nunca por iniciativa propia/);
    expect(AGENT_TOOL_HANDLER_NAMES).toContain("delete_measurement");
  });
});
