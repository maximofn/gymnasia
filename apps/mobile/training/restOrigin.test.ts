import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildActiveSessionPresentation } from "./sessionPresentationModel";
import {
  listWorkoutExecutionUnits,
  resolveWorkoutExecutionCurrentKey,
} from "./workoutExecution";
import {
  cancelWorkoutRest,
  reconcileWorkoutSessionClock,
  startWorkoutRest,
} from "./workoutSessionClock";
import { normalizeWorkoutSession, type WorkoutSession } from "./workoutSessionModel";
import type { WorkoutTemplate } from "./workoutTemplateOperations";

const exercise = (id: string, name: string) => ({
  id,
  name,
  muscle: "Piernas",
  sets: [],
  series: ["s1", "s2"].map((seriesId) => ({
    id: seriesId,
    type: "normal" as const,
    reps: "10",
    weight_kg: "20",
    rest_seconds: "90",
  })),
});

const template: WorkoutTemplate = {
  id: "template",
  name: "Pierna",
  category: "strength",
  exercises: [
    exercise("a", "Prensa"),
    exercise("b", "Femoral de pie"),
    exercise("c", "Gemelo"),
  ],
};
const units = listWorkoutExecutionUnits(template);
const keyOf = (exerciseId: string, index: number) =>
  units.filter((unit) => unit.exerciseId === exerciseId)[index].key;
const NOW = 1_000_000;

function freshSession(): WorkoutSession {
  return normalizeWorkoutSession(
    { template_id: template.id, status: "running" },
    [template],
    { now: () => NOW, createId: () => "session" },
  )!;
}

// Mirrors App.markSessionUnitAsDone: the rest belongs to the completed
// effort; the session continues after it, independently.
function completeUnit(session: WorkoutSession, unitKey: string): WorkoutSession {
  const completed = [...session.completed_unit_keys, unitKey];
  const nextKey = resolveWorkoutExecutionCurrentKey(units, unitKey, completed)!;
  return startWorkoutRest(
    {
      ...session,
      completed_unit_keys: completed,
      completed_effort_count: completed.length,
      current_unit_key: nextKey,
    },
    90,
    NOW,
    () => "rest",
    unitKey,
  );
}

const restCard = (session: WorkoutSession) =>
  buildActiveSessionPresentation(session, null, [template]).exercises
    .filter((item) => item.showsRestTimer)
    .map((item) => item.exercise.id);

describe("anclaje del descanso a la serie completada", () => {
  it("muestra el descanso en B aunque A siga pendiente", () => {
    const resting = completeUnit(freshSession(), keyOf("b", 0));

    expect(resting.rest_origin_unit_key).toBe(keyOf("b", 0));
    expect(resting.current_unit_key).toBe(keyOf("b", 1));
    expect(restCard(resting)).toEqual(["b"]);
  });

  it("en orden, el descanso queda en el ejercicio que se acaba de terminar", () => {
    let session = completeUnit(freshSession(), keyOf("a", 0));
    expect(restCard(session)).toEqual(["a"]);
    session = completeUnit(cancelWorkoutRest(session, NOW), keyOf("a", 1));
    expect(session.current_unit_key).toBe(keyOf("b", 0));
    expect(restCard(session)).toEqual(["a"]);
  });

  it("al acabar los pendientes posteriores, vuelve al primero que se dejó atrás", () => {
    let session = freshSession();
    for (const key of [keyOf("b", 0), keyOf("b", 1), keyOf("c", 0)]) {
      session = completeUnit(cancelWorkoutRest(session, NOW), key);
    }
    session = completeUnit(cancelWorkoutRest(session, NOW), keyOf("c", 1));
    expect(session.current_unit_key).toBe(keyOf("a", 0));
    expect(restCard(session)).toEqual(["c"]);
  });

  it("omitir o terminar el descanso limpia el origen sin mover el siguiente esfuerzo", () => {
    const resting = completeUnit(freshSession(), keyOf("b", 0));

    const skipped = cancelWorkoutRest(resting, NOW + 1_000);
    expect(skipped.rest_origin_unit_key).toBeNull();
    expect(skipped.current_unit_key).toBe(resting.current_unit_key);
    expect(skipped.completed_unit_keys).toEqual(resting.completed_unit_keys);

    const expired = reconcileWorkoutSessionClock(resting, NOW + 91_000).session;
    expect(expired.is_resting).toBe(false);
    expect(expired.rest_origin_unit_key).toBeNull();
    expect(expired.completed_unit_keys).toEqual(resting.completed_unit_keys);
    expect(restCard(expired)).toEqual([]);
  });

  it("sobrevive a una recarga y degrada claves antiguas o inválidas", () => {
    const resting = completeUnit(freshSession(), keyOf("b", 0));
    const reload = (raw: unknown) =>
      normalizeWorkoutSession(JSON.parse(JSON.stringify(raw)), [template], {
        now: () => NOW,
        createId: () => "x",
      })!;

    expect(reload(resting).rest_origin_unit_key).toBe(keyOf("b", 0));
    expect(restCard(reload(resting))).toEqual(["b"]);

    // Sesión anterior al cambio: sin origen, conserva la ubicación antigua.
    const { rest_origin_unit_key: _omit, ...legacy } = resting;
    expect(reload(legacy).rest_origin_unit_key).toBeNull();
    expect(restCard(reload(legacy))).toEqual(["b"]);

    for (const bad of ["no-existe", 42, keyOf("c", 0)]) {
      const session = reload({ ...resting, rest_origin_unit_key: bad });
      expect(session.rest_origin_unit_key).toBeNull();
      expect(session.completed_unit_keys).toEqual([keyOf("b", 0)]);
    }
    expect(reload({ ...resting, is_resting: false }).rest_origin_unit_key).toBeNull();
  });

  it("si la serie de origen deja de estar completada, no hay temporizador huérfano", () => {
    const resting = completeUnit(freshSession(), keyOf("b", 0));
    const unmarked = { ...resting, completed_unit_keys: [] };
    // La pantalla cae al ejercicio actual en vez de señalar una serie no hecha.
    expect(restCard(unmarked)).toEqual(["b"]);
    expect(cancelWorkoutRest(unmarked, NOW).rest_origin_unit_key).toBeNull();
  });

  it("propiedad: en cualquier orden, el descanso está en la tarjeta de la serie completada", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(units.map((unit) => unit.key), { minLength: 1 }),
        (order) => {
          let session = freshSession();
          for (const key of order) {
            session = completeUnit(cancelWorkoutRest(session, NOW), key);
            const origin = units.find((unit) => unit.key === key)!;
            expect(restCard(session)).toEqual([origin.exerciseId]);
            expect(session.completed_unit_keys.includes(session.rest_origin_unit_key!)).toBe(true);
            expect(new Set(session.completed_unit_keys).size).toBe(session.completed_unit_keys.length);
            if (session.completed_unit_keys.length < units.length) {
              expect(session.completed_unit_keys).not.toContain(session.current_unit_key);
            }
          }
          expect(session.completed_unit_keys).toEqual(order);
        },
      ),
    );
  });
});
