import type { PolicyRuntimeStatus } from "./signedPolicySelection";

export type PolicyStatusPresentation = {
  degradationMessage: string | null;
  pendingInstruction: string | null;
  sourceLabel: string;
  title: string;
  tone: "healthy" | "warning";
};

export function policyStatusPresentation(status: PolicyRuntimeStatus): PolicyStatusPresentation {
  const sourceLabel = status.active.source === "remote"
    ? "Remota verificada"
    : status.active.source === "bundled"
      ? "Integrada en la app"
      : status.active.source === "cache-previous"
        ? "Caché de recuperación"
        : "Caché verificada";
  const pendingInstruction = status.pending
    ? status.pending.action === "rollback" || status.pending.critical
      ? "Se aplicará al comenzar el siguiente envío seguro."
      : "Se aplicará en el primer envío de una conversación nueva."
    : null;
  const degradationMessage = status.degradation === "none"
    ? null
    : status.degradation === "offline"
      ? "Sin conexión: se mantiene la última política verificada disponible en este dispositivo."
      : "La comprobación no pudo sustituir la política segura que ya estaba activa.";
  return {
    degradationMessage,
    pendingInstruction,
    sourceLabel,
    title: status.state === "pending"
      ? "Actualización pendiente"
      : status.state === "degraded"
        ? "Política segura en modo degradado"
        : "Política verificada",
    tone: status.state === "active" ? "healthy" : "warning",
  };
}
