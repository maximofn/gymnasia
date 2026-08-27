import { pushTrace } from "../trace";
import {
  type ChatSystemPromptDiagnostic,
  type ChatSystemPromptSelection,
} from "./chatSystemPrompt";
import { acquireAgentPolicyLease } from "./agentPolicyRuntime";

function traceChatSystemPrompt(diagnostic: ChatSystemPromptDiagnostic): void {
  const { event, ...data } = diagnostic;
  void pushTrace("chatPrompt", event, data);
}

export async function loadChatSystemPrompt(): Promise<ChatSystemPromptSelection> {
  const value = (await acquireAgentPolicyLease("background")).prompt;
  traceChatSystemPrompt({
    event: "selected",
    source: value.source,
    sha256: value.sha256,
    version: value.version,
    environment: value.environment,
    channel: value.channel,
    candidate: value.candidate,
    deploymentId: value.deploymentId,
  });
  return { ...value };
}
