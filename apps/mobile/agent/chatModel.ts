import {
  AI_DISCLOSURE_MESSAGE_KIND,
  createAiDisclosureMessage,
  getAiTransparencyCopy,
  type AiConversationSurface,
  type AiDisclosureMessageKind,
} from "./aiTransparency";
import type { AiReportResponseOrigin } from "./feedbackIssues";
import {
  createLocalHealthSafetyResponse,
  type HealthSafetyDecision,
  type HealthSafetyMessageMetadata,
  type HealthSafetyRuntimePolicy,
} from "./healthSafety";
import {
  isGoogleConversationTurn,
  type GoogleContent,
  type GoogleConversationTurn,
} from "./googleInteractions";
import { normalizePolicyContext, type PolicyContext } from "./policyContext";

export type ChatThread = { id: string; title: string | null };
export type ChatMessageKind =
  | AiDisclosureMessageKind
  | "health_safety_intervention"
  | "technical_error";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  kind?: ChatMessageKind;
  health_safety?: HealthSafetyMessageMetadata;
  policy_context?: PolicyContext;
  report_context?: {
    provider?: string | null;
    model?: string | null;
    origin: AiReportResponseOrigin;
  };
  thinking?: string | null;
  googleTurn?: GoogleConversationTurn;
  googleInput?: GoogleContent[];
  is_streaming?: boolean;
  created_at: string;
};

export type ChatModelRuntime = {
  now(): number;
  createId(prefix: string): string;
};

const defaultRuntime: ChatModelRuntime = {
  now: () => Date.now(),
  createId: (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

export function createAiIdentityChatMessage(
  prefix = "msg",
  surface: AiConversationSurface = "main-chat",
  runtime: ChatModelRuntime = defaultRuntime,
): ChatMessage {
  return {
    id: runtime.createId(prefix),
    ...createAiDisclosureMessage(surface),
    created_at: new Date(runtime.now()).toISOString(),
  };
}

export function createHealthSafetyChatMessage(
  decision: HealthSafetyDecision,
  policy: HealthSafetyRuntimePolicy,
  prefix = "msg",
  runtime: ChatModelRuntime = defaultRuntime,
): ChatMessage {
  const response = createLocalHealthSafetyResponse(decision, policy);
  return {
    id: runtime.createId(prefix),
    role: "assistant",
    kind: "health_safety_intervention",
    health_safety: response.metadata,
    report_context: { origin: "health_safety" },
    content: `${response.reason}\n\n${response.message}`,
    created_at: new Date(runtime.now()).toISOString(),
  };
}

export function normalizeThreadTitle(title: string | null, index: number): string | null {
  if (typeof title !== "string") return title;
  const normalized = title.trim();
  const coachMatch = normalized.match(
    /^(?:Coach|Agente|Gymnasia Coach)(?:\s+(\d+))?$/i,
  );
  if (!coachMatch) return normalized || null;
  const suffix = coachMatch[1] ?? (index > 0 ? `${index + 1}` : "");
  return suffix ? `Gymnasia Coach ${suffix}` : "Gymnasia Coach";
}

export function chatRoleLabel(role: ChatMessage["role"]): string {
  if (role === "assistant") return getAiTransparencyCopy("main-chat").agentName;
  if (role === "user") return "Tú";
  return "Sistema";
}

export function normalizeChatMessage(
  raw: ChatMessage,
  index: number,
  runtime: ChatModelRuntime = defaultRuntime,
): ChatMessage {
  const role =
    raw?.role === "assistant" || raw?.role === "system" || raw?.role === "user"
      ? raw.role
      : "assistant";
  const thinking = typeof raw?.thinking === "string" ? raw.thinking : null;
  const kind: ChatMessageKind | undefined = [
    AI_DISCLOSURE_MESSAGE_KIND,
    "health_safety_intervention",
    "technical_error",
  ].includes(raw?.kind ?? "")
    ? raw.kind
    : undefined;
  const healthSafety =
    kind === "health_safety_intervention" &&
    raw.health_safety &&
    ["elevated", "high", "critical"].includes(raw.health_safety.level) &&
    ["es", "en", "pt"].includes(raw.health_safety.locale) &&
    Array.isArray(raw.health_safety.ruleIds) &&
    typeof raw.health_safety.reasonCode === "string" &&
    typeof raw.health_safety.policyVersion === "string"
      ? raw.health_safety
      : undefined;
  const rawReportContext = raw?.report_context;
  const reportOrigin: AiReportResponseOrigin | null =
    rawReportContext &&
    ["model", "health_safety", "unknown"].includes(rawReportContext.origin)
      ? rawReportContext.origin
      : kind === "health_safety_intervention"
        ? "health_safety"
        : null;
  const reportContext = reportOrigin
    ? {
        provider:
          typeof rawReportContext?.provider === "string"
            ? rawReportContext.provider
            : undefined,
        model:
          typeof rawReportContext?.model === "string"
            ? rawReportContext.model
            : undefined,
        origin: reportOrigin,
      }
    : undefined;
  const policyContext = normalizePolicyContext(raw?.policy_context);
  return {
    id: raw?.id?.trim() || runtime.createId(`msg-${index}`),
    role,
    content: typeof raw?.content === "string" ? raw.content : "",
    kind,
    health_safety: healthSafety,
    report_context: reportContext,
    policy_context: policyContext,
    thinking,
    ...(isGoogleConversationTurn(raw.googleTurn) ? { googleTurn: raw.googleTurn } : {}),
    ...(Array.isArray(raw.googleInput) ? { googleInput: raw.googleInput } : {}),
    is_streaming: false,
    created_at:
      typeof raw?.created_at === "string" && raw.created_at.trim()
        ? raw.created_at
        : new Date(runtime.now()).toISOString(),
  };
}

export function normalizeMessagesByThread(
  rawMessagesByThread: Record<string, ChatMessage[]> | null | undefined,
  runtime: ChatModelRuntime = defaultRuntime,
): Record<string, ChatMessage[]> {
  if (!rawMessagesByThread || typeof rawMessagesByThread !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawMessagesByThread).map(([threadId, threadMessages]) => [
      threadId,
      Array.isArray(threadMessages)
        ? threadMessages.map((message, index) =>
            normalizeChatMessage(message, index, runtime),
          )
        : [],
    ]),
  );
}
