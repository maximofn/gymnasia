import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import { pushTrace } from "../trace";
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

const CHAT_SYSTEM_PROMPT_URL =
  "https://raw.githubusercontent.com/maximofn/gymnasia/main/prompts/AGENTS.md";
const CHAT_SYSTEM_PROMPT_CACHE_KEY = "gymnasia.mobile.chat.system_prompt.v2";
const LEGACY_CHAT_SYSTEM_PROMPT_CACHE_KEY = "gymnasia.mobile.chat.system_prompt.v1";

function traceChatSystemPrompt(diagnostic: ChatSystemPromptDiagnostic): void {
  const { event, ...data } = diagnostic;
  void pushTrace("chatPrompt", event, data);
}

export async function loadChatSystemPrompt(): Promise<ChatSystemPromptSelection> {
  return selectChatSystemPrompt({
    fetchRemote: async () => {
      const response = await fetch(`${CHAT_SYSTEM_PROMPT_URL}?ts=${Date.now()}`);
      return {
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: response.ok ? await response.text() : "",
      };
    },
    readCurrentCache: () => AsyncStorage.getItem(CHAT_SYSTEM_PROMPT_CACHE_KEY),
    readLegacyCache: () => AsyncStorage.getItem(LEGACY_CHAT_SYSTEM_PROMPT_CACHE_KEY),
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
    },
    diagnostic: traceChatSystemPrompt,
  });
}
