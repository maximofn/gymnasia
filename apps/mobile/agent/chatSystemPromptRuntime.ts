import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import { pushTrace } from "../trace";
import { RUNTIME_ENVIRONMENT, scopedStorageKey } from "../runtimeEnvironment";
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
import { fetchActivePolicyDeployment } from "./policyDeployment";

const CHAT_SYSTEM_PROMPT_CACHE_KEY = scopedStorageKey("gymnasia.mobile.chat.system_prompt.v3");
const LEGACY_CHAT_SYSTEM_PROMPT_CACHE_KEY = scopedStorageKey("gymnasia.mobile.chat.system_prompt.v2");

function traceChatSystemPrompt(diagnostic: ChatSystemPromptDiagnostic): void {
  const { event, ...data } = diagnostic;
  void pushTrace("chatPrompt", event, data);
}

export async function loadChatSystemPrompt(): Promise<ChatSystemPromptSelection> {
  const policyChannel = RUNTIME_ENVIRONMENT.policyChannel;
  const localPolicyOnly = policyChannel === "Local";
  const fetchRemote = localPolicyOnly
    ? undefined
    : async () => {
        const deployment = await fetchActivePolicyDeployment(
          policyChannel,
        );
        const response = await fetch(deployment.assetUrl, {
          headers: { Accept: "text/markdown, text/plain;q=0.9" },
        });
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type"),
          body: response.ok ? await response.text() : "",
          expectedSha256: deployment.assetSha256,
          environment: RUNTIME_ENVIRONMENT.environment,
          channel: deployment.channel,
          candidate: deployment.candidate,
          deploymentId: deployment.deploymentId,
        };
      };

  return selectChatSystemPrompt({
    fetchRemote,
    readCurrentCache: () => localPolicyOnly
      ? Promise.resolve(null)
      : AsyncStorage.getItem(CHAT_SYSTEM_PROMPT_CACHE_KEY),
    readLegacyCache: () => localPolicyOnly
      ? Promise.resolve(null)
      : AsyncStorage.getItem(LEGACY_CHAT_SYSTEM_PROMPT_CACHE_KEY),
    writeCurrentCache: (value) => AsyncStorage.setItem(CHAT_SYSTEM_PROMPT_CACHE_KEY, value),
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
