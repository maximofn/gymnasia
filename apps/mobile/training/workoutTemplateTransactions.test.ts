import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { WorkoutTemplate } from "./workoutTemplateOperations";
import {
  createWorkoutSessionTemplateDraftRecord,
  createWorkoutTemplateDraft,
  isWorkoutTemplateDraftDirty,
  parseWorkoutSessionTemplateDraftRecord,
  resolveWorkoutTemplateCommit,
  updateWorkoutSessionTemplateDraft,
  validateWorkoutTemplateDraft,
  withWorkoutSessionTemplateDraft,
  workoutTemplateDraftReducer,
} from "./workoutTemplateTransactions";

function fixture(): WorkoutTemplate {
  return {
    id: "tpl",
    name: "Fuerza",
    category: "strength",
    exercises: [{
      id: "exercise",
      name: "Press",
      sets: [10],
      series: [{ id: "set", reps: "10", weight_kg: "20", rest_seconds: "60" }],
    }],
  };
}

describe("transacciones de plantillas", () => {
  it("edita una copia, cancela sin mutar el original y aplica la copia exacta", () => {
    const original = fixture();
    const state = createWorkoutTemplateDraft(original, "edit");
    state.draft.name = "Borrador";

    expect(original.name).toBe("Fuerza");
    expect(isWorkoutTemplateDraftDirty(state)).toBe(true);
    expect(resolveWorkoutTemplateCommit(state, original)).toMatchObject({
      status: "applied",
      template: { name: "Borrador" },
    });
  });

  it("rebasa automáticamente un borrador limpio y conserva uno sucio", () => {
    const state = createWorkoutTemplateDraft(fixture(), "edit");
    const current = { ...fixture(), name: "Catálogo actualizado" };
    const rebased = workoutTemplateDraftReducer(state, { type: "rebase", current });
    expect(rebased.draft.name).toBe("Catálogo actualizado");

    const dirty = workoutTemplateDraftReducer(rebased, {
      type: "replace_draft",
      draft: { ...rebased.draft, name: "Mi cambio" },
    });
    expect(workoutTemplateDraftReducer(dirty, {
      type: "rebase",
      current: { ...current, name: "Cambio externo" },
    })).toBe(dirty);
  });

  it("bloquea conflictos, desapariciones y creaciones con id repetido", () => {
    const state = createWorkoutTemplateDraft(fixture(), "edit");
    state.draft.name = "Mi cambio";
    expect(resolveWorkoutTemplateCommit(state, { ...fixture(), name: "Externo" }).status).toBe("conflict");
    expect(resolveWorkoutTemplateCommit(state, null).status).toBe("missing");

    const creation = createWorkoutTemplateDraft({ ...fixture(), id: "new" }, "create");
    expect(resolveWorkoutTemplateCommit(creation, { ...fixture(), id: "new" }).status).toBe("conflict");
  });

  it("exige nombre, ejercicio y al menos una serie ejecutable", () => {
    expect(validateWorkoutTemplateDraft(fixture()).valid).toBe(true);
    expect(validateWorkoutTemplateDraft({ ...fixture(), name: " " }).name).toBe(false);
    expect(validateWorkoutTemplateDraft({ ...fixture(), exercises: [] }).exercise).toBe(false);
    expect(validateWorkoutTemplateDraft({
      ...fixture(),
      exercises: [{ ...fixture().exercises[0], series: [] }],
    }).runnableSeries).toBe(false);
  });

  it("versiona, serializa y valida el borrador de una sesión", () => {
    const record = createWorkoutSessionTemplateDraftRecord("session", fixture());
    const changed = updateWorkoutSessionTemplateDraft(record, (draft) => ({
      ...draft,
      name: "Sesión",
    }));
    expect(changed.draft_revision).toBe(1);
    expect(record.draft.name).toBe("Fuerza");
    expect(parseWorkoutSessionTemplateDraftRecord(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
    expect(parseWorkoutSessionTemplateDraftRecord({ ...changed, session_id: 1 })).toBeNull();
  });

  it("mantiene ejecutable el borrador si la plantilla canónica cambia o desaparece", () => {
    const record = updateWorkoutSessionTemplateDraft(
      createWorkoutSessionTemplateDraftRecord("session", fixture()),
      (draft) => ({ ...draft, name: "Versión de la sesión" }),
    );
    expect(withWorkoutSessionTemplateDraft([
      { ...fixture(), name: "Versión externa" },
    ], record)).toEqual([record.draft]);
    expect(withWorkoutSessionTemplateDraft([], record)).toEqual([record.draft]);
  });

  it("cualquier edición se cancela exactamente o se aplica exactamente", () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 40 }), (name) => {
      const original = fixture();
      const transaction = workoutTemplateDraftReducer(
        createWorkoutTemplateDraft(original, "edit"),
        { type: "replace_draft", draft: { ...original, name } },
      );
      expect(original).toEqual(fixture());
      const result = resolveWorkoutTemplateCommit(transaction, original);
      expect(result.status).toBe("applied");
      if (result.status === "applied") expect(result.template).toEqual(transaction.draft);
    }), { numRuns: 200, seed: 174 });
  });
});
