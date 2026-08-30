import {
  buildIdempotencyKey,
  sanitizeFeedbackDraft,
  type FeedbackIssueDraft,
  type FeedbackIssueKind,
  type FeedbackIssueOutcome,
} from "./feedbackIssues";

/**
 * Propuestas pendientes de que el usuario las envíe.
 *
 * Existe porque los caminos de alimento y ejercicio NO pasan por el agente: se
 * disparan desde la UI y hasta ahora enviaban sin preguntar. Aquí se encolan y
 * no sale nada hasta que se toca el botón.
 *
 * Es un store observable mínimo y puro para que Vitest lo cubra; `App.tsx` se
 * limita a suscribirse y pintar.
 *
 * NO se persiste: un borrador guardado añadiría una clave de almacenamiento al
 * inventario de datos y dejaría estado zombie tras reinstalar.
 */

export type FeedbackProposalStatus = "pending" | "submitting" | "settled";

export type FeedbackProposal = {
  id: string;
  draft: FeedbackIssueDraft;
  idempotencyKey: string;
  status: FeedbackProposalStatus;
  outcome: FeedbackIssueOutcome | null;
  createdAt: number;
};

export const MAX_PENDING_PROPOSALS = 3;
export const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export type FeedbackProposalStore = {
  getSnapshot: () => readonly FeedbackProposal[];
  subscribe: (listener: () => void) => () => void;
  /** Encola una propuesta. Síncrono y sin red: conserva el patrón dispara-y-olvida. */
  propose: (input: {
    kind: FeedbackIssueKind;
    title: string;
    summary: string;
    now?: number;
  }) => FeedbackProposal | null;
  dismiss: (id: string) => void;
  markSubmitting: (id: string) => void;
  settle: (id: string, outcome: FeedbackIssueOutcome) => void;
  expire: (now?: number) => void;
  clear: () => void;
};

export function createFeedbackProposalStore(options: {
  createId?: () => string;
} = {}): FeedbackProposalStore {
  let proposals: FeedbackProposal[] = [];
  const listeners = new Set<() => void>();
  let counter = 0;
  const createId = options.createId ?? (() => {
    counter += 1;
    return "proposal_" + counter;
  });

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const store: FeedbackProposalStore = {
    getSnapshot: () => proposals,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    propose({ kind, title, summary, now = Date.now() }) {
      const draft = sanitizeFeedbackDraft({ kind, title, summary });
      if (!draft) return null;
      const idempotencyKey = buildIdempotencyKey(draft);

      // Misma clave => misma propuesta. Evita que el debounce del renombrado
      // de ejercicios apile avisos idénticos.
      const existing = proposals.find(
        (proposal) => proposal.idempotencyKey === idempotencyKey,
      );
      if (existing) return existing;

      const proposal: FeedbackProposal = {
        id: createId(),
        draft,
        idempotencyKey,
        status: "pending",
        outcome: null,
        createdAt: now,
      };

      const pending = proposals.filter((item) => item.status === "pending");
      let next = [...proposals, proposal];
      if (pending.length + 1 > MAX_PENDING_PROPOSALS) {
        const oldest = pending[0];
        next = next.filter((item) => item.id !== oldest.id);
      }
      proposals = next;
      emit();
      return proposal;
    },
    dismiss(id) {
      const before = proposals.length;
      proposals = proposals.filter((proposal) => proposal.id !== id);
      if (proposals.length !== before) emit();
    },
    markSubmitting(id) {
      proposals = proposals.map((proposal) =>
        proposal.id === id && proposal.status === "pending"
          ? { ...proposal, status: "submitting" }
          : proposal,
      );
      emit();
    },
    settle(id, outcome) {
      proposals = proposals.map((proposal) =>
        proposal.id === id ? { ...proposal, status: "settled", outcome } : proposal,
      );
      emit();
    },
    expire(now = Date.now()) {
      const before = proposals.length;
      proposals = proposals.filter(
        (proposal) =>
          proposal.status !== "pending" || now - proposal.createdAt < PROPOSAL_TTL_MS,
      );
      if (proposals.length !== before) emit();
    },
    clear() {
      if (proposals.length === 0) return;
      proposals = [];
      emit();
    },
  };

  return store;
}
