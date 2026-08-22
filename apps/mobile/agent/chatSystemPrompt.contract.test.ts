import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeChatSystemPromptContent } from "./chatSystemPrompt";
import {
  BUNDLED_CHAT_SYSTEM_PROMPT,
  BUNDLED_CHAT_SYSTEM_PROMPT_SHA256,
  BUNDLED_CHAT_SYSTEM_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
} from "./generated/chatSystemPrompt.generated";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const promptSource = readFileSync(
  new URL("../../../prompts/AGENTS.md", import.meta.url),
  "utf8",
);
const snapshotMetadata = JSON.parse(readFileSync(
  new URL("./generated/policySnapshot.generated.json", import.meta.url),
  "utf8",
));

describe("contrato del snapshot integrado del system prompt", () => {
  it("empaqueta exactamente la fuente normalizada del mismo commit", () => {
    const normalizedSource = normalizeChatSystemPromptContent(promptSource);

    expect(CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION).toBe(1);
    expect(normalizedSource.trim().length).toBeGreaterThan(0);
    expect(BUNDLED_CHAT_SYSTEM_PROMPT).toBe(normalizedSource);
  });

  it("publica el SHA-256 reproducible del contenido empaquetado", () => {
    const calculatedHash = createHash("sha256")
      .update(BUNDLED_CHAT_SYSTEM_PROMPT, "utf8")
      .digest("hex");

    expect(BUNDLED_CHAT_SYSTEM_PROMPT_SHA256).toBe(calculatedHash);
    expect(BUNDLED_CHAT_SYSTEM_PROMPT_VERSION).toBe(`sha256:${calculatedHash}`);
    expect(snapshotMetadata).toMatchObject({
      schemaVersion: 1,
      environment: "development",
      channel: "Local",
      sha256: calculatedHash,
      deploymentId: null,
    });
  });

  it("impide que App.tsx vuelva a mantener un fallback manual", () => {
    expect(appSource).toContain('from "./agent/chatSystemPromptRuntime"');
    expect(appSource).not.toContain("DEFAULT_CHAT_SYSTEM_PROMPT");
    expect(appSource).not.toContain("gymnasia.mobile.chat.system_prompt.v1");
    expect(appSource).toContain("FOOD_ESTIMATOR_SYSTEM_PROMPT");
    expect(appSource).toContain("FOOD_AI_SYSTEM_PROMPT");
  });
});
