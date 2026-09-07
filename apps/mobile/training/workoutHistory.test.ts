import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildHomeWeekProgress,
  calculateWorkoutStreak,
  classifyWorkoutCompletion,
  normalizeWorkoutSessionSummary,
  type WorkoutSessionSummary,
} from "./workoutHistory";

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
    calculation_version: 2,
    can_recalculate: false,
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
});
