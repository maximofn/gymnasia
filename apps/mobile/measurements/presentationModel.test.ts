import { describe, expect, it } from "vitest";

import {
  buildMeasurementStatCard,
  formatMeasurementHistoryDate,
  formatMeasurementNumber,
  measurementDateFromSelection,
  parseOptionalPositiveMetricInput,
} from "./presentationModel";

describe("measurement presentation model", () => {
  it("normalizes inputs and local dates", () => {
    expect(parseOptionalPositiveMetricInput("weight_kg", "72,5")).toEqual({
      value: 72.5,
      invalid: false,
    });
    expect(measurementDateFromSelection(new Date(2026, 8, 12, 22)).getHours()).toBe(12);
    expect(formatMeasurementHistoryDate("2026-09-12")).toBe("12 Sep 2026");
  });

  it("keeps compact number formatting", () => {
    expect(formatMeasurementNumber(72)).toBe("72");
    expect(formatMeasurementNumber(72.54)).toBe("72.5");
  });

  it("builds stat cards without UI dependencies", () => {
    expect(buildMeasurementStatCard("Peso", 70, 71, String, "kg", true)).toMatchObject({
      valueText: "70",
      changeText: "-1 kg",
      changeColor: "#19C37D",
      changeIcon: "trending-down",
    });
  });
});
