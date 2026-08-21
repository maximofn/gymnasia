import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

function functionSource(name: string, nextName: string): string {
  const start = appSource.indexOf(`async function ${name}`);
  const end = appSource.indexOf(`async function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return appSource.slice(start, end);
}

describe("provider transport contract", () => {
  it("short-circuits every AI conversation surface in fake mode", () => {
    const chat = functionSource("callProviderChatAPI", "callProviderChatAPIWithTools");
    const toolChat = functionSource("callProviderChatAPIWithTools", "callFoodEstimatorAPI");
    const estimatorStart = appSource.indexOf("async function callFoodEstimatorAPI");
    const estimator = appSource.slice(estimatorStart, appSource.indexOf("function ", estimatorStart + 30));

    for (const source of [chat, toolChat, estimator]) {
      const guard = source.indexOf("if (IS_FAKE_PROVIDER_MODE)");
      expect(guard).toBeGreaterThanOrEqual(0);
      const firstProviderNetwork = source.search(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|XMLHttpRequest/);
      expect(firstProviderNetwork === -1 || guard < firstProviderNetwork).toBe(true);
    }
  });

  it("does not embed any real development API key", () => {
    expect(appSource).not.toContain("DEV_PROVIDER_API_KEY");
    expect(appSource).toContain("providerCredential(configured.api_key, IS_FAKE_PROVIDER_MODE)");
  });
});
