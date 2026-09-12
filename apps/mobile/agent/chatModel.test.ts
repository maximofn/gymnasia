import { describe, expect, it } from "vitest";

import {
  createAiIdentityChatMessage,
  normalizeChatMessage,
  normalizeThreadTitle,
} from "./chatModel";

const runtime = {
  now: () => Date.parse("2026-09-12T10:00:00.000Z"),
  createId: (prefix: string) => `${prefix}-fixed`,
};

describe("chat model", () => {
  it("normalizes historical thread titles", () => {
    expect(normalizeThreadTitle("Coach", 0)).toBe("Gymnasia Coach");
    expect(normalizeThreadTitle("Agente", 2)).toBe("Gymnasia Coach 3");
  });

  it("removes transient streaming state during hydration", () => {
    expect(
      normalizeChatMessage(
        {
          id: "",
          role: "assistant",
          content: "hola",
          is_streaming: true,
          created_at: "",
        },
        1,
        runtime,
      ),
    ).toMatchObject({
      id: "msg-1-fixed",
      is_streaming: false,
      created_at: "2026-09-12T10:00:00.000Z",
    });
  });

  it("creates the local AI disclosure without provider state", () => {
    expect(createAiIdentityChatMessage("msg", "main-chat", runtime)).toMatchObject({
      id: "msg-fixed",
      role: "assistant",
    });
  });
});
