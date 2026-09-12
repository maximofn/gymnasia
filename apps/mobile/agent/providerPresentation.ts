import type { OpenAIReasoningEffort, Provider } from "./providerConfiguration";

export type ProviderConnectionState = "connected" | "disconnected" | "checking" | "unknown";
export type ProviderStatusSeverity = "success" | "warning" | "error" | "info";
export type ProviderConnectionStatus = {
  state: ProviderConnectionState;
  detail: string;
  severity: ProviderStatusSeverity;
};

export const OPENAI_REASONING_EFFORT_LABELS: Record<OpenAIReasoningEffort, string> = {
  none: "Ninguno",
  minimal: "Minimo",
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  xhigh: "Muy alto",
};

export const PROVIDER_UI_META: Record<
  Provider,
  { label: string; models_hint: string; avatar_bg: string; avatar_text: string }
> = {
  anthropic: {
    label: "Anthropic",
    models_hint: "Claude Sonnet 4.5, Opus 4",
    avatar_bg: "#CFA06D",
    avatar_text: "#F8F0E5",
  },
  openai: {
    label: "OpenAI",
    models_hint: "GPT-4o, o1, o3",
    avatar_bg: "#18B894",
    avatar_text: "#E9FFF9",
  },
  google: {
    label: "Google",
    models_hint: "Gemini 2.5 Pro, Flash",
    avatar_bg: "#4D84FF",
    avatar_text: "#EFF4FF",
  },
};

export const PROVIDER_STATUS_COPY = {
  warningNoKey: "Atención: guarda una API key para conectar el proveedor.",
  warningPending: "Configurada, pendiente de comprobar en esta sesión.",
  warningDirty: "Atención: hay cambios sin guardar.",
  warningChecking: "Atención: comprobando conexión...",
  warningSaving: "Atención: guardando de forma segura...",
  warningModelsUnavailable: "Atención: no se pudieron cargar los modelos de Anthropic.",
  errorSaving: "No se pudo guardar. La configuración anterior sigue activa; puedes reintentarlo.",
  errorFallback: "Error: no se pudo comprobar la conexión.",
} as const;

function providerStatusPalette(
  severity: ProviderStatusSeverity,
): { backgroundColor: string; dotColor: string; textColor: string } {
  if (severity === "success") {
    return { backgroundColor: "rgba(16,185,129,0.18)", dotColor: "#24D68B", textColor: "#24D68B" };
  }
  if (severity === "warning") {
    return { backgroundColor: "rgba(255,205,77,0.2)", dotColor: "#FFCD4D", textColor: "#FFCD4D" };
  }
  if (severity === "error") {
    return { backgroundColor: "rgba(255,110,110,0.2)", dotColor: "#FF6E6E", textColor: "#FF6E6E" };
  }
  return { backgroundColor: "rgba(69,141,255,0.2)", dotColor: "#77A8FF", textColor: "#77A8FF" };
}

export function providerDetailColorBySeverity(severity: ProviderStatusSeverity): string {
  if (severity === "success") return "#24D68B";
  if (severity === "warning") return "#FFCD4D";
  if (severity === "error") return "#FF6E6E";
  return "#77A8FF";
}

export function providerConnectionBadge(status: ProviderConnectionStatus): {
  text: string;
  backgroundColor: string;
  dotColor: string;
  textColor: string;
} {
  const palette = providerStatusPalette(status.severity);
  let text = "Sin estado";
  if (status.state === "checking") text = "Comprobando";
  else if (status.severity === "success") text = "Conectado";
  else if (status.severity === "warning") text = "Atención";
  else if (status.severity === "error") text = "Error";
  else if (status.state === "unknown") text = "Sin verificar";
  else text = "No conectado";
  return { text, ...palette };
}
