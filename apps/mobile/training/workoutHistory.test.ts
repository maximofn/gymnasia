import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  WORKOUT_SUMMARY_SCHEMA_VERSION,
  buildWorkoutPrescriptionSnapshot,
  buildHomeWeekProgress,
  calculateWorkoutStreak,
  classifyWorkoutCompletion,
  normalizeWorkoutSessionSummary,
  recalculateWorkoutSessionSummary,
  summarizeWorkoutPrescriptionSnapshot,
  type WorkoutSessionSummary,
} from "./workoutHistory";
import { listWorkoutExecutionUnits } from "./workoutExecution";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

function prescriptionTemplate(): WorkoutTemplate {
  return {
    id: "template",
    name: "Fuerza",
    icon: "activity",
    exercises: [{
      id: "bench",
      name: "Press banca",
      image_uri: "file:///private/press.jpg",
      muscle: "Pecho",
      catalog_link: {
        schemaVersion: 1,
        status: "unresolved",
        reason: "legacy_unknown",
      },
      sets: [8, 10],
      series: [
        {
          id: "normal",
          type: "tempo",
          reps: "8",
          weight_kg: "0",
          rest_seconds: "1:30",
          tempo_contraction: "2",
          tempo_pause: "",
          tempo_relaxation: "3",
        },
        {
          id: "compound",
          type: "superset",
          reps: "10",
          weight_kg: "50",
          rest_seconds: "60",
          sub_series: [{
            id: "sub",
            exercise_name: "Aperturas",
            reps: "12",
            weight_kg: "",
            rest_seconds: "0",
          }],
        },
      ],
    }],
  };
}

function summary(
  id: string,
  finishedAt: string,
  completionStatus: WorkoutSessionSummary["completion_status"],
): WorkoutSessionSummary {
  return {
    id,
    template_id: "template",
    template_name: "Fuerza",
    finished_at: finishedAt,
    elapsed_seconds: 600,
    completion_status: completionStatus,
    summary_schema_version: 1,
    calculation_version: 2,
    can_recalculate: false,
    prescription_snapshot: null,
    completed_effort_count: completionStatus === "completed" ? 4 : 2,
    total_effort_count: 4,
    effort_breakdown: {
      completed_primary: completionStatus === "completed" ? 4 : 2,
      completed_sub_series: 0,
      total_primary: 4,
      total_sub_series: 0,
    },
    estimated_calories: 80,
    total_volume_kg: 400,
    total_reps: 40,
  };
}

describe("workoutHistory", () => {
  it("solo clasifica como completa una sesión con todos sus esfuerzos", () => {
    expect(classifyWorkoutCompletion(4, 4)).toBe("completed");
    expect(classifyWorkoutCompletion(5, 4)).toBe("completed");
    expect(classifyWorkoutCompletion(3, 4)).toBe("partial");
    expect(classifyWorkoutCompletion(0, 0)).toBe("partial");
  });

  it("infiere el estado heredado, limita los contadores y no confía en un estado contradictorio", () => {
    const completed = normalizeWorkoutSessionSummary({
      id: "legacy-completed",
      template_id: "template",
      completed_series_count: 7,
      total_series_count: 4,
      completion_status: "partial",
    }, 0, "fallback", "2026-09-07T10:00:00.000Z");
    const partial = normalizeWorkoutSessionSummary({
      id: "legacy-partial",
      template_id: "template",
      completed_series_count: 2,
      total_series_count: 4,
      completion_status: "completed",
    }, 1, "fallback", "2026-09-07T10:00:00.000Z");

    expect(completed).toMatchObject({
      completion_status: "completed",
      completed_effort_count: 4,
      total_effort_count: 4,
    });
    expect(partial).toMatchObject({
      completion_status: "partial",
      completed_effort_count: 2,
      total_effort_count: 4,
    });
  });

  it("normaliza resúmenes actuales de forma idempotente", () => {
    const first = normalizeWorkoutSessionSummary({
      ...summary("current", "2026-09-07T08:00:00.000Z", "partial"),
      completed_effort_count: 2,
    }, 0, "fallback");
    const second = normalizeWorkoutSessionSummary(first, 0, "fallback");

    expect(second).toEqual(first);
  });

  it("guarda la prescripción ejecutada sin imágenes, catálogo ni datos musculares", () => {
    const template = prescriptionTemplate();
    const units = listWorkoutExecutionUnits(template);
    const snapshot = buildWorkoutPrescriptionSnapshot(template, [units[0].key, units[2].key]);

    expect(snapshot).toMatchObject({
      schema_version: 1,
      execution_schema_version: 1,
      weight_unit: "kg",
      exercises: [{
        name: "Press banca",
        series: [
          {
            type: "tempo",
            reps: 8,
            weight_kg: 0,
            rest_seconds: 90,
            tempo_contraction: 2,
            tempo_pause: null,
            tempo_relaxation: 3,
            completed: true,
            sub_series: [],
          },
          {
            type: "superset",
            completed: false,
            sub_series: [{
              exercise_name: "Aperturas",
              reps: 12,
              weight_kg: null,
              rest_seconds: 0,
              completed: true,
            }],
          },
        ],
      }],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/image|catalog|muscle|file:\/\//);
  });

  it("mantiene la instantánea independiente de ediciones posteriores de la rutina", () => {
    const template = prescriptionTemplate();
    const originalTemplate = structuredClone(template);
    const units = listWorkoutExecutionUnits(template);
    const snapshot = buildWorkoutPrescriptionSnapshot(template, units.map((unit) => unit.key));

    expect(template).toEqual(originalTemplate);

    template.name = "Rutina cambiada";
    template.exercises[0].name = "Ejercicio cambiado";
    template.exercises[0].series![0].reps = "99";

    expect(snapshot.exercises[0].name).toBe("Press banca");
    expect(snapshot.exercises[0].series[0].reps).toBe(8);
    expect(summarizeWorkoutPrescriptionSnapshot(snapshot)).toMatchObject({
      completedEffortCount: 3,
      totalEffortCount: 3,
      totalReps: 30,
      totalVolumeKg: 500,
    });
  });

  it("verifica totales sin sobrescribirlos y explica las discrepancias", () => {
    const template = prescriptionTemplate();
    const units = listWorkoutExecutionUnits(template);
    const snapshot = buildWorkoutPrescriptionSnapshot(template, units.map((unit) => unit.key));
    const recalculated = summarizeWorkoutPrescriptionSnapshot(snapshot);
    const current: WorkoutSessionSummary = {
      ...summary("snapshot", "2026-09-09T08:00:00.000Z", "completed"),
      summary_schema_version: WORKOUT_SUMMARY_SCHEMA_VERSION,
      prescription_snapshot: snapshot,
      can_recalculate: true,
      completed_effort_count: recalculated.completedEffortCount,
      total_effort_count: recalculated.totalEffortCount,
      effort_breakdown: recalculated.effortBreakdown,
      total_reps: recalculated.totalReps,
      total_volume_kg: recalculated.totalVolumeKg,
    };
    const mismatched = { ...current, total_reps: current.total_reps + 1 };

    expect(recalculateWorkoutSessionSummary(current).status).toBe("match");
    expect(recalculateWorkoutSessionSummary(mismatched)).toMatchObject({
      status: "mismatch",
      recalculated: { totalReps: 30, totalVolumeKg: 500 },
    });
    expect(mismatched.total_reps).toBe(31);
  });

  it("migra resúmenes v1 y v2 sin inventar una prescripción", () => {
    const legacy = normalizeWorkoutSessionSummary({
      completed_series_count: 1,
      total_series_count: 1,
    }, 0, "legacy");
    const currentWithoutSnapshot = normalizeWorkoutSessionSummary({
      calculation_version: 2,
      can_recalculate: true,
      completed_effort_count: 1,
      total_effort_count: 1,
    }, 1, "current");

    expect(legacy).toMatchObject({
      summary_schema_version: 1,
      calculation_version: 1,
      prescription_snapshot: null,
      can_recalculate: false,
    });
    expect(currentWithoutSnapshot).toMatchObject({
      summary_schema_version: 1,
      calculation_version: 2,
      prescription_snapshot: null,
      can_recalculate: false,
    });
    expect(normalizeWorkoutSessionSummary(
      currentWithoutSnapshot,
      1,
      "current",
      undefined,
      { mode: "strict" },
    )).toEqual(currentWithoutSnapshot);
  });

  it("degrada instantáneas inválidas al hidratar y las rechaza en backups", () => {
    const issues: string[] = [];
    const invalid = {
      ...summary("invalid", "2026-09-09T08:00:00.000Z", "completed"),
      summary_schema_version: 2,
      prescription_snapshot: { schema_version: 99 },
      can_recalculate: true,
    };
    const repaired = normalizeWorkoutSessionSummary(
      invalid,
      0,
      "fallback",
      undefined,
      { onSnapshotIssue: (message) => issues.push(message) },
    );

    expect(repaired.prescription_snapshot).toBeNull();
    expect(repaired.can_recalculate).toBe(false);
    expect(repaired.total_reps).toBe(invalid.total_reps);
    expect(issues).toHaveLength(1);
    expect(() => normalizeWorkoutSessionSummary(
      invalid,
      0,
      "fallback",
      undefined,
      { mode: "strict" },
    )).toThrow(/prescripción no compatible/);
    expect(() => normalizeWorkoutSessionSummary(
      { ...invalid, summary_schema_version: 99, prescription_snapshot: undefined },
      0,
      "fallback",
      undefined,
      { mode: "strict" },
    )).toThrow(/prescripción no compatible/);
  });

  it("excluye parciales de la racha y del progreso semanal", () => {
    const now = new Date(2026, 8, 8, 12, 0, 0);
    const yesterday = new Date(2026, 8, 7, 12, 0, 0).toISOString();
    const today = new Date(2026, 8, 8, 12, 0, 0).toISOString();
    const summaries = [
      summary("completed-yesterday", yesterday, "completed"),
      summary("partial-today", today, "partial"),
    ];

    expect(calculateWorkoutStreak(summaries, now)).toBe(1);
    const week = buildHomeWeekProgress(summaries, now);
    expect(week.find((day) => day.isToday)?.completed).toBe(false);
    expect(week.filter((day) => day.completed)).toHaveLength(1);
  });

  it("nunca normaliza como completa una secuencia con esfuerzos pendientes", () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 200 }),
      fc.integer({ min: 0, max: 199 }),
      (total, completedCandidate) => {
        const completed = completedCandidate % total;
        const normalized = normalizeWorkoutSessionSummary({
          completed_effort_count: completed,
          total_effort_count: total,
          completion_status: "completed",
        }, 0, "property", "2026-09-07T10:00:00.000Z");

        expect(normalized.completion_status).toBe("partial");
      },
    ));
  });

  it("produce instantáneas deterministas y totales finitos para prescripciones acotadas", () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        reps: fc.integer({ min: 0, max: 100 }),
        weight: fc.integer({ min: 0, max: 500 }),
        completed: fc.boolean(),
      }), { minLength: 1, maxLength: 24 }),
      (items) => {
        const template: WorkoutTemplate = {
          id: "property",
          name: "Propiedad",
          exercises: [{
            id: "exercise",
            name: "Ejercicio",
            sets: items.map((item) => item.reps),
            series: items.map((item, index) => ({
              id: `series-${index}`,
              reps: `${item.reps}`,
              weight_kg: `${item.weight}`,
              rest_seconds: "0",
            })),
          }],
        };
        const units = listWorkoutExecutionUnits(template);
        const completed = units
          .filter((_, index) => items[index].completed)
          .map((unit) => unit.key);
        const first = buildWorkoutPrescriptionSnapshot(template, completed);
        const second = buildWorkoutPrescriptionSnapshot(template, completed);
        const totals = summarizeWorkoutPrescriptionSnapshot(first);

        expect(second).toEqual(first);
        expect(Number.isFinite(totals.totalReps)).toBe(true);
        expect(Number.isFinite(totals.totalVolumeKg)).toBe(true);
        expect(totals.completedEffortCount).toBe(new Set(completed).size);
      },
    ));
  });
});
