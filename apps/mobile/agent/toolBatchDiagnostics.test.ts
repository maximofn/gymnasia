import { afterEach, describe, expect, it, vi } from "vitest";
import { executeToolBatch } from "./toolBatch";
import type { ToolBatchTraceEvent } from "./toolBatchDiagnostics";

describe("tiempos locales de los lotes de tools", () => {
  afterEach(() => vi.useRealTimers());

  it.each([{ concurrency: 1, elapsed: 600, peak: 1 }, { concurrency: 4, elapsed: 300, peak: 3 }])(
    "mide $elapsed ms de lote con límite $concurrency sin sumar esperas solapadas",
    async ({ concurrency, elapsed, peak }) => {
      vi.useFakeTimers();
      const events: ToolBatchTraceEvent[] = [];
      const clockStart = Date.now();
      const batch = executeToolBatch([100, 200, 300].map((delay) => ({ name: "search_exercises", delay })),
        (call) => new Promise<number>((resolve) => setTimeout(() => resolve(call.delay), call.delay)),
        concurrency, { now: () => Date.now() - clockStart, onEvent: (event) => events.push(event) });
      await vi.runAllTimersAsync();
      expect(await batch).toEqual([100, 200, 300]);
      const started = events.filter((event) => event.phase === "tool_started");
      expect(started.map((event) => event.offsetMs)).toEqual(concurrency === 1 ? [0, 100, 300] : [0, 0, 0]);
      expect(events.filter((event) => event.phase === "tool_finished").map((event) => event.durationMs))
        .toEqual([100, 200, 300]);
      expect(events.at(-1)).toEqual({ phase: "batch_finished", batchId: events[0].batchId,
        durationMs: elapsed, totalToolDurationMs: 600, startedCount: 3, returnedCount: 3,
        thrownCount: 0, peakActiveTools: peak, outcome: "returned" });
    },
  );

  it("usa el reloj monotónico aunque cambie la hora del dispositivo", async () => {
    vi.useFakeTimers();
    let monotonic = 10;
    const events: ToolBatchTraceEvent[] = [];
    await executeToolBatch([{ name: "read_routines" }], async () => {
      vi.setSystemTime(Date.now() - 60_000);
      monotonic = 35;
      return "ok";
    }, 4, { now: () => monotonic, onEvent: (event) => events.push(event) });
    expect(events.at(-1)).toMatchObject({ durationMs: 25 });
    expect(events.find((event) => event.phase === "tool_finished")).toMatchObject({ durationMs: 25 });
  });

  it("cierra la medición fatal después de drenar las lecturas activas y cuenta las no iniciadas", async () => {
    vi.useFakeTimers();
    const events: ToolBatchTraceEvent[] = [];
    const execute = vi.fn((_: { name: string }, index: number) => new Promise<string>((resolve, reject) => {
      setTimeout(() => index === 0 ? reject(new Error("private failure")) : resolve("private result"), index === 0 ? 10 : 100);
    }));
    const batch = executeToolBatch(Array.from({ length: 6 }, () => ({ name: "read_routines" })), execute,
      4, { now: Date.now, onEvent: (event) => events.push(event) }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(events.some((event) => event.phase === "batch_finished")).toBe(false);
    await vi.runAllTimersAsync();
    expect(await batch).toBeInstanceOf(Error);
    expect(execute).toHaveBeenCalledTimes(4);
    expect(events.at(-1)).toMatchObject({ phase: "batch_finished", durationMs: 100,
      startedCount: 4, returnedCount: 3, thrownCount: 1, peakActiveTools: 4, outcome: "threw" });
    expect(JSON.stringify(events)).not.toContain("private");
  });

  it("no filtra nombres desconocidos, argumentos, IDs del proveedor ni resultados", async () => {
    const events: ToolBatchTraceEvent[] = [];
    const result = { output: "private result", isError: true };
    expect(await executeToolBatch([{ name: "private unknown name", args: { key: "private argument" }, id: "private id" }],
      async () => result, 4, { now: () => 0, onEvent: (event) => events.push(event) })).toEqual([result]);
    expect(events.find((event) => event.phase === "tool_started"))
      .toMatchObject({ toolName: "unknown", effect: "unknown", index: 0 });
    expect(events.at(-1)).toMatchObject({ returnedCount: 1, thrownCount: 0, outcome: "returned" });
    expect(JSON.stringify(events)).not.toContain("private");
  });

  it("un fallo del registro de trazas no cambia el resultado ni oculta una excepción de la tool", async () => {
    const diagnostics = { onEvent: () => { throw new Error("broken trace sink"); } };
    expect(await executeToolBatch([{ name: "read_routines" }], async () => "ok", 4, diagnostics)).toEqual(["ok"]);
    const failure = new Error("uncertain write");
    await expect(executeToolBatch([{ name: "write_measurement" }], async () => { throw failure; }, 4, diagnostics))
      .rejects.toBe(failure);
  });
});
