import { describe, expect, it } from "vitest";

import { parseSSEEvent, splitSSEEvents } from "./sse";

describe("helpers SSE", () => {
  it("conserva eventos incompletos entre chunks", () => {
    const parsed = splitSSEEvents(
      "event: first\r\ndata: {\"ok\":true}\r\n\r\nevent: second\ndata: incompleto",
    );
    expect(parsed.events).toEqual(["event: first\ndata: {\"ok\":true}"]);
    expect(parsed.rest).toBe("event: second\ndata: incompleto");
  });

  it("une líneas data y omite comentarios", () => {
    expect(parseSSEEvent(": ping\nevent: delta\ndata: uno\ndata: dos")).toEqual({
      event: "delta",
      data: "uno\ndos",
    });
  });
});
