import type { MeasurementWorkCounters } from "./measurementContract";

let counters: MeasurementWorkCounters | undefined;

/** Opt-in, web-only test probe. No values, persistence, logging or network. */
export function measurementPerformanceCounters(
  environment: string,
  platform: string,
): MeasurementWorkCounters | undefined {
  if (
    process.env.EXPO_PUBLIC_MEASUREMENT_PERF_TEST !== "1"
    || environment !== "development"
    || platform !== "web"
  ) return undefined;
  if (!counters) {
    counters = {
      preparations: 0, sorts: 0, preparationVisits: 0,
      summaries: 0, summaryVisits: 0, metricEvaluations: 0, charts: 0, cards: 0,
    };
    Object.defineProperty(globalThis, "__GYMNASIA_MEASUREMENT_WORK__", {
      value: counters,
      configurable: true,
    });
  }
  return counters;
}
