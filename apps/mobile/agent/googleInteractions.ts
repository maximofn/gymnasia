/** Google Interactions wire data is also the local continuation format.
 * Keep provider fields intact: in particular signatures are opaque, not text.
 */
export type GoogleContent = Record<string, unknown> & { type: string };
export type GoogleFunctionCall = Record<string, unknown> & {
  type: "function_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};
export type GoogleStep =
  | (Record<string, unknown> & { type: "user_input" | "model_output"; content: GoogleContent[] })
  | (Record<string, unknown> & { type: "thought"; signature?: string; summary?: GoogleContent[] })
  | GoogleFunctionCall
  | (Record<string, unknown> & {
      type: "function_result"; name: string; call_id: string; result: GoogleContent[];
    });

export type GoogleInteractionTurn = {
  interactionId: string;
  status: "completed" | "requires_action";
  steps: GoogleStep[];
  content: string;
  thinking: string | null;
  usage: Record<string, unknown>;
};

/** Only completed user turns are attached to a message. No replay on hydration. */
export type GoogleConversationTurn = {
  version: 1;
  model: string;
  steps: GoogleStep[];
  interactions: Array<{ id: string; usage: Record<string, unknown> }>;
};

export function isGoogleRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isContent(value: unknown): value is GoogleContent[] {
  return Array.isArray(value) && value.every((part) => isGoogleRecord(part)
    && typeof part.type === "string"
    && (part.type !== "text" || typeof part.text === "string"));
}

export function isGoogleStep(value: unknown): value is GoogleStep {
  if (!isGoogleRecord(value)) return false;
  switch (value.type) {
    case "user_input":
    case "model_output": return isContent(value.content);
    case "thought": return (value.signature === undefined || typeof value.signature === "string")
      && (value.summary === undefined || isContent(value.summary));
    case "function_call": return typeof value.id === "string" && !!value.id.trim()
      && typeof value.name === "string" && !!value.name.trim() && isGoogleRecord(value.arguments);
    case "function_result": return typeof value.call_id === "string" && !!value.call_id.trim()
      && typeof value.name === "string" && !!value.name.trim() && isContent(value.result);
    default: return false;
  }
}

export function isGoogleConversationTurn(value: unknown): value is GoogleConversationTurn {
  if (!isGoogleRecord(value) || value.version !== 1 || typeof value.model !== "string"
    || !Array.isArray(value.steps) || !value.steps.every(isGoogleStep)
    || !Array.isArray(value.interactions) || !value.interactions.every((item) =>
      isGoogleRecord(item) && typeof item.id === "string" && isGoogleRecord(item.usage))) return false;
  // Never restore an unresolved call as executable work or a valid conversation.
  const pending = new Map<string, string>();
  const callIds = new Set<string>();
  for (const step of value.steps) {
    if (step.type === "user_input") return false;
    if (step.type === "thought" && !step.signature) return false;
    if (step.type === "function_call") {
      if (callIds.has(step.id)) return false;
      callIds.add(step.id);
      pending.set(step.id, step.name);
    } else if (step.type === "function_result") {
      if (pending.get(step.call_id) !== step.name) return false;
      pending.delete(step.call_id);
    }
  }
  return pending.size === 0;
}

export type GoogleHistoryMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  googleTurn?: GoogleConversationTurn;
  googleInput?: GoogleContent[];
};

export function buildGoogleHistory(messages: readonly GoogleHistoryMessage[]): GoogleStep[] {
  return messages.flatMap((message): GoogleStep[] => {
    if (message.role === "system") return [];
    if (message.role === "assistant" && message.googleTurn) {
      if (!isGoogleConversationTurn(message.googleTurn)) {
        throw new Error("El historial de Google está dañado. Recupera una copia de la conversación.");
      }
      // Copy before giving mutable wire objects to a request or a parser.
      return JSON.parse(JSON.stringify(message.googleTurn.steps)) as GoogleStep[];
    }
    return [{
      type: message.role === "user" ? "user_input" : "model_output",
      content: message.googleInput
        ? JSON.parse(JSON.stringify(message.googleInput)) as GoogleContent[]
        : [{ type: "text", text: message.content }],
    }];
  });
}

export function googleText(parts: GoogleContent[] | undefined): string {
  return (parts ?? []).filter((part) => part.type === "text")
    .map((part) => typeof part.text === "string" ? part.text : "").join("");
}
