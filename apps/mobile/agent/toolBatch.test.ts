import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeToolBatch, MAX_CONCURRENT_TOOL_READS } from "./toolBatch";
import { agentToolEffect } from "./toolDefinitions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("lotes de tools", () => {
  afterEach(() => vi.useRealTimers());

  it("solapa como máximo cuatro lecturas y conserva el orden de los resultados", async () => {
    const pending = Array.from({ length: 6 }, () => deferred<string>());
    const started: number[] = [];
    const calls = pending.map((_, index) => ({ name: "read_field_value", index }));
    const batch = executeToolBatch(calls, (call) => {
      started.push(call.index);
      return pending[call.index].promise;
    });
    expect(started).toEqual([0, 1, 2, 3]);
    pending[3].resolve("three");
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3, 4]);
    pending[1].resolve("one");
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3, 4, 5]);
    pending[5].resolve("five");
    pending[4].resolve("four");
    pending[2].resolve("two");
    pending[0].resolve("zero");
    expect(await batch).toEqual(["zero", "one", "two", "three", "four", "five"]);
  });

  it("las escrituras locales, externas y las tools desconocidas separan los lotes", async () => {
    const names = ["read_field_value", "read_measurement", "write_measurement",
      "write_measurement", "create_feature_issue", "future_tool", "read_routines", "search_foods"];
    const pending = names.map(() => deferred<number>());
    const started: number[] = [];
    const batch = executeToolBatch(names.map((name, index) => ({ name, index })), (call) => {
      started.push(call.index);
      return pending[call.index].promise;
    });
    expect(started).toEqual([0, 1]);
    pending[1].resolve(1);
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    pending[0].resolve(0);
    // The drain and the batch continuation each take a microtask.
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    for (const index of [2, 3, 4, 5]) {
      pending[index].resolve(index);
      await vi.waitFor(() => expect(started).toEqual(
        index === 5 ? [0, 1, 2, 3, 4, 5, 6, 7] : Array.from({ length: index + 2 }, (_, i) => i),
      ));
    }
    pending[7].resolve(7);
    pending[6].resolve(6);
    expect(await batch).toEqual(names.map((_, index) => index));
  });

  it("ante un fallo fatal deja de lanzar lecturas y espera las que ya arrancaron", async () => {
    const pending = Array.from({ length: 6 }, () => deferred<number>());
    const execute = vi.fn((_: { name: string }, index: number) => pending[index].promise);
    let finished = false;
    const failure = new Error("fatal");
    const batch = executeToolBatch(pending.map(() => ({ name: "read_routines" })), execute)
      .catch((error) => { finished = true; return error; });
    pending[1].reject(failure);
    await Promise.resolve();
    expect(finished).toBe(false);
    for (const index of [3, 0, 2]) pending[index].resolve(index);
    expect(await batch).toBe(failure);
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("no ejecuta otra tool tras una escritura que falla", async () => {
    const execute = vi.fn(async () => { throw new Error("uncertain write"); });
    await expect(executeToolBatch([
      { name: "write_measurement" }, { name: "read_measurement" },
    ], execute)).rejects.toThrow("uncertain write");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("tres esperas de 100/200/300 ms pasan de 600 a 300 ms", async () => {
    vi.useFakeTimers();
    async function duration(concurrency: number) {
      const started = Date.now();
      const batch = executeToolBatch([100, 200, 300].map((delay) => ({ name: "read_routines", delay })),
        (call) => new Promise<number>((resolve) => setTimeout(() => resolve(call.delay), call.delay)), concurrency);
      await vi.runAllTimersAsync();
      expect(await batch).toEqual([100, 200, 300]);
      return Date.now() - started;
    }
    expect(await duration(1)).toBe(600);
    expect(await duration(MAX_CONCURRENT_TOOL_READS)).toBe(300);
  });

  it("rechaza límites inválidos antes de ejecutar", async () => {
    const execute = vi.fn(async () => "ok");
    for (const limit of [0, -1, 5, 1.5, NaN, Infinity]) {
      await expect(executeToolBatch([{ name: "read_routines" }], execute, limit))
        .rejects.toThrow("Invalid tool read concurrency");
    }
    expect(execute).not.toHaveBeenCalled();
    expect(await executeToolBatch([], execute)).toEqual([]);
  });

  it("mantiene los límites y las barreras para secuencias arbitrarias", async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.record({
      name: fc.constantFrom("read_routines", "search_foods", "write_measurement", "save_personal_data", "unknown"),
      ticks: fc.integer({ min: 0, max: 5 }),
    }), { maxLength: 40 }), fc.integer({ min: 1, max: 4 }), async (calls, cap) => {
      const active = new Set<number>();
      const completed = new Set<number>();
      const results = await executeToolBatch(calls, async (call, index) => {
        const read = agentToolEffect(call.name) === "read";
        if (!read) {
          expect(active.size).toBe(0);
          expect(completed.size).toBe(index);
        } else {
          expect([...active].every((i) => agentToolEffect(calls[i].name) === "read")).toBe(true);
          expect(active.size).toBeLessThan(cap);
          const previousBarrier = calls.slice(0, index).findLastIndex((item) => agentToolEffect(item.name) !== "read");
          if (previousBarrier >= 0) expect(completed.has(previousBarrier)).toBe(true);
        }
        active.add(index);
        for (let tick = 0; tick < call.ticks; tick += 1) await Promise.resolve();
        active.delete(index);
        completed.add(index);
        return index;
      }, cap);
      expect(results).toEqual(calls.map((_, index) => index));
      expect(active.size).toBe(0);
    }), { numRuns: 100 });
  });
});
