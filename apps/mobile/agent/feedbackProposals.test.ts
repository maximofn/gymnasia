import { describe, expect, it, vi } from "vitest";
import {
  MAX_PENDING_PROPOSALS,
  PROPOSAL_TTL_MS,
  createFeedbackProposalStore,
} from "./feedbackProposals";

function proposeFood(store: ReturnType<typeof createFeedbackProposalStore>, name: string) {
  return store.propose({ kind: "food", title: name, summary: "Resumen de " + name });
}

describe("createFeedbackProposalStore", () => {
  it("encola una propuesta saneada", () => {
    const store = createFeedbackProposalStore();
    const proposal = proposeFood(store, "  Yogur   griego ");
    expect(proposal?.draft.title).toBe("Yogur griego");
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("descarta lo que no deja contenido útil", () => {
    const store = createFeedbackProposalStore();
    expect(store.propose({ kind: "food", title: "   ", summary: "x" })).toBeNull();
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it("no duplica: misma clave, misma propuesta", () => {
    const store = createFeedbackProposalStore();
    const first = proposeFood(store, "Yogur");
    const second = proposeFood(store, "Yogur");
    expect(second?.id).toBe(first?.id);
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("el debounce del renombrado no apila avisos idénticos", () => {
    const store = createFeedbackProposalStore();
    for (let index = 0; index < 10; index += 1) proposeFood(store, "Press Arnold");
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("respeta el tope de pendientes descartando la más vieja", () => {
    const store = createFeedbackProposalStore();
    for (let index = 0; index < MAX_PENDING_PROPOSALS + 2; index += 1) {
      proposeFood(store, "Alimento " + index);
    }
    expect(store.getSnapshot().length).toBeLessThanOrEqual(MAX_PENDING_PROPOSALS);
    expect(store.getSnapshot().some((item) => item.draft.title === "Alimento 0")).toBe(false);
  });

  it("notifica a los suscriptores en cada cambio", () => {
    const store = createFeedbackProposalStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    proposeFood(store, "Yogur");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    proposeFood(store, "Avena");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("recorre el ciclo pendiente -> enviando -> resuelto", () => {
    const store = createFeedbackProposalStore();
    const proposal = proposeFood(store, "Yogur");
    expect(proposal?.status).toBe("pending");

    store.markSubmitting(proposal!.id);
    expect(store.getSnapshot()[0].status).toBe("submitting");

    store.settle(proposal!.id, {
      status: "created",
      issueNumber: 5,
      issueUrl: "https://github.com/a/b/issues/5",
      deduplicated: false,
    });
    const settled = store.getSnapshot()[0];
    expect(settled.status).toBe("settled");
    expect(settled.outcome).toMatchObject({ status: "created", issueNumber: 5 });
  });

  it("markSubmitting no revive una propuesta ya resuelta", () => {
    const store = createFeedbackProposalStore();
    const proposal = proposeFood(store, "Yogur");
    store.settle(proposal!.id, { status: "canceled" });
    store.markSubmitting(proposal!.id);
    expect(store.getSnapshot()[0].status).toBe("settled");
  });

  it("dismiss elimina la propuesta", () => {
    const store = createFeedbackProposalStore();
    const proposal = proposeFood(store, "Yogur");
    store.dismiss(proposal!.id);
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it("expira las pendientes pero no las resueltas", () => {
    const store = createFeedbackProposalStore();
    const stale = store.propose({
      kind: "food",
      title: "Viejo",
      summary: "Resumen",
      now: 0,
    });
    const settled = store.propose({
      kind: "food",
      title: "Resuelto",
      summary: "Resumen",
      now: 0,
    });
    store.settle(settled!.id, { status: "canceled" });

    store.expire(PROPOSAL_TTL_MS + 1);
    const remaining = store.getSnapshot();
    expect(remaining.some((item) => item.id === stale!.id)).toBe(false);
    expect(remaining.some((item) => item.id === settled!.id)).toBe(true);
  });
});
