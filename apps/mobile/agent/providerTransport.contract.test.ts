import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const providerChatClientSource = readFileSync(
  new URL("./providerChatClient.ts", import.meta.url),
  "utf8",
);
const providerToolClientSource = readFileSync(
  new URL("./providerToolClient.ts", import.meta.url),
  "utf8",
);

describe("provider transport contract", () => {
  it("short-circuits every AI conversation surface in fake mode", () => {
    const chatStart = providerChatClientSource.indexOf("export async function requestProviderText");
    expect(chatStart).toBeGreaterThanOrEqual(0);
    const chat = providerChatClientSource.slice(chatStart);
    const toolChatStart = providerToolClientSource.indexOf(
      "export async function requestProviderToolChat",
    );
    expect(toolChatStart).toBeGreaterThanOrEqual(0);
    const toolChat = providerToolClientSource.slice(toolChatStart);
    const estimatorStart = appSource.indexOf("async function callFoodEstimatorAPI");
    const estimator = appSource.slice(estimatorStart, appSource.indexOf("function ", estimatorStart + 30));

    for (const [source, guardNeedle] of [
      [chat, "if (runtime.fakeMode)"],
      [toolChat, "if (runtime.fakeMode)"],
      [estimator, "if (IS_FAKE_PROVIDER_MODE)"],
    ] as const) {
      const guard = source.indexOf(guardNeedle);
      expect(guard).toBeGreaterThanOrEqual(0);
      const firstProviderNetwork = source.search(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|XMLHttpRequest/);
      expect(firstProviderNetwork === -1 || guard < firstProviderNetwork).toBe(true);
    }
  });

  it("does not embed any real development API key", () => {
    expect(appSource).not.toContain("DEV_PROVIDER_API_KEY");
    expect(appSource).toContain("providerCredential(configured.api_key, IS_FAKE_PROVIDER_MODE)");
  });

  it("never puts Google API keys in request URLs", () => {
    expect(appSource).not.toMatch(/generativelanguage\.googleapis\.com[^"`\n]*(?:\?|&)key=/);
    const transport = readFileSync(new URL("./googleStreamTransport.ts", import.meta.url), "utf8");
    expect(transport).toContain("googleApiHeaders(options.apiKey");
    expect(appSource).not.toContain(":generateContent");
    expect(appSource).not.toContain(":streamGenerateContent");
  });
});
