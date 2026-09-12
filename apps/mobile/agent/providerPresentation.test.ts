import { describe, expect, it } from "vitest";

import {
  OPENAI_REASONING_EFFORT_LABELS,
  providerConnectionBadge,
  providerDetailColorBySeverity,
} from "./providerPresentation";

describe("provider presentation", () => {
  it("preserves the visible reasoning labels", () => {
    expect(OPENAI_REASONING_EFFORT_LABELS).toEqual({
      none: "Ninguno",
      minimal: "Minimo",
      low: "Bajo",
      medium: "Medio",
      high: "Alto",
      xhigh: "Muy alto",
    });
  });

  it.each([
    ["success", "connected", "Conectado", "#24D68B"],
    ["warning", "disconnected", "Atención", "#FFCD4D"],
    ["error", "disconnected", "Error", "#FF6E6E"],
    ["info", "checking", "Comprobando", "#77A8FF"],
    ["info", "unknown", "Sin verificar", "#77A8FF"],
    ["info", "disconnected", "No conectado", "#77A8FF"],
  ] as const)(
    "maps %s/%s to the existing badge copy and color",
    (severity, state, text, color) => {
      expect(providerConnectionBadge({ severity, state, detail: "" })).toMatchObject({
        text,
        dotColor: color,
        textColor: color,
      });
      expect(providerDetailColorBySeverity(severity)).toBe(color);
    },
  );
});
