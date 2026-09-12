import { describe, expect, it } from "vitest";

import { requestProviderText } from "./providerChatClient";

describe("provider chat client", () => {
  it("conserva el proveedor determinista sin tocar la red", async () => {
    const content = await requestProviderText(
      {
        provider: "openai",
        api_key: "fixture",
        model: "fixture-openai",
        is_active: true,
        reasoning_effort: "medium",
      },
      [{ role: "user", content: "  prepara mi sesión  " }],
      { fakeMode: true, platform: "web" },
    );

    expect(content).toContain("prepara mi sesión");
  });
});
