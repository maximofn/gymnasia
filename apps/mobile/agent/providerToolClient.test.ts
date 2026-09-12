import { describe, expect, it, vi } from "vitest";

import { requestProviderToolChat } from "./providerToolClient";

describe("provider tool client", () => {
  it("conserva el cortocircuito determinista y emite el contenido", async () => {
    const onContentDelta = vi.fn();
    const result = await requestProviderToolChat(
      {
        provider: "openai",
        api_key: "fixture",
        model: "fixture-openai",
        is_active: true,
        reasoning_effort: "medium",
      },
      [{ role: "user", content: "mi rutina" }],
      { fakeMode: true, platform: "web" },
      { executeTool: vi.fn(), onContentDelta },
    );

    expect(result.content).toContain("mi rutina");
    expect(onContentDelta).toHaveBeenCalledWith(result.content, result.content);
  });
});
