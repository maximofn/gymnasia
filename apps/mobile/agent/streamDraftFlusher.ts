// Un stream emite decenas de deltas por segundo. Pintar cada uno re-renderiza el
// hilo entero; agrupados, el borrador se pinta como mucho una vez por ventana.
export const STREAM_DRAFT_FLUSH_MS = 40;

export type StreamDraftFlusher = {
  /** Pide pintar el borrador; si ya hay un pintado pendiente en la ventana, no hace nada. */
  schedule: () => void;
  /** Pinta ya y descarta el pintado pendiente, para no repetirlo al vencer la ventana. */
  flushNow: () => void;
  /** Descarta el pintado pendiente sin pintar: la respuesta final o el error lo sustituyen. */
  cancel: () => void;
};

export function createStreamDraftFlusher(
  apply: () => void,
  intervalMs = STREAM_DRAFT_FLUSH_MS,
): StreamDraftFlusher {
  let pending: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (pending === null) return;
    clearTimeout(pending);
    pending = null;
  };
  return {
    schedule: () => {
      if (pending !== null) return;
      pending = setTimeout(() => {
        pending = null;
        apply();
      }, intervalMs);
    },
    flushNow: () => {
      cancel();
      apply();
    },
    cancel,
  };
}
