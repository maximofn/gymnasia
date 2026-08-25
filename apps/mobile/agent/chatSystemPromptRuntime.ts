import * as Crypto from "expo-crypto";

import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT } from "../runtimeEnvironment";
import {
  selectChatSystemPrompt,
  type ChatSystemPromptDiagnostic,
  type ChatSystemPromptSelection,
} from "./chatSystemPrompt";
import {
  BUNDLED_CHAT_SYSTEM_PROMPT,
  BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
  BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
} from "./generated/chatSystemPrompt.generated";
import { loadSignedPolicy } from "./signedPolicyRuntime";

function traceChatSystemPrompt(diagnostic: ChatSystemPromptDiagnostic): void {
  const { event, ...data } = diagnostic;
  void pushTrace("chatPrompt", event, data);
}

function loadLocalPrompt(): Promise<ChatSystemPromptSelection> {
  return selectChatSystemPrompt({
    readCurrentCache: async () => null,
    readLegacyCache: async () => null,
    writeCurrentCache: async () => undefined,
    sha256: (value) => Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      value,
    ),
    bundled: {
      content: BUNDLED_CHAT_SYSTEM_PROMPT,
      sha256: BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
      version: BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
      normalizationVersion: CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
      environment: RUNTIME_ENVIRONMENT.environment,
      channel: RUNTIME_ENVIRONMENT.policyChannel,
      candidate: RUNTIME_ENVIRONMENT.policyCandidate,
      deploymentId: null,
    },
    scope: {
      environment: RUNTIME_ENVIRONMENT.environment,
      channel: RUNTIME_ENVIRONMENT.policyChannel,
    },
    allowLegacyCache: false,
    diagnostic: traceChatSystemPrompt,
  });
}

export async function loadChatSystemPrompt(): Promise<ChatSystemPromptSelection> {
  if (RUNTIME_ENVIRONMENT.policyChannel === "Local") return loadLocalPrompt();
  const selected = await loadSignedPolicy();
  const { bundle } = selected;
  const value: ChatSystemPromptSelection = {
    content: bundle.prompt.content,
    source: selected.source === "remote"
      ? "remote"
      : selected.source === "bundled" ? "bundled" : "cache",
    sha256: bundle.prompt.sha256,
    version: `sha256:${bundle.prompt.sha256}`,
    environment: RUNTIME_ENVIRONMENT.environment,
    channel: selected.activation.channel,
    candidate: bundle.id,
    deploymentId: selected.package.deploymentId,
  };
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
  return value;
}
