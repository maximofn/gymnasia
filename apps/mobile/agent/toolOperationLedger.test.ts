import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  TOOL_OPERATION_LEDGER_MAX_ENTRIES,
  TOOL_OPERATION_LEDGER_TTL_MS,
  ToolOperationCoordinator,
  ToolOperationLedgerRepository,
  identifyToolOperation,
  type ToolCallEnvelope,
} from "./toolOperationLedger";

class MemoryStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const key = "tool-ledger";

function call(
  overrides: Partial<ToolCallEnvelope> = {},
): ToolCallEnvelope {
  return {
    executionId: "message-1",
    provider: "openai",
    providerCallId: "provider-call-1",
    name: "add_meal_food",
    args: { date: "2026-09-01", meal: "Comida" },
    occurrence: 0,
    ...overrides,
  };
}

describe("registro idempotente de operaciones de tools", () => {
  it("mantiene la identidad con argumentos reordenados y cambia por ocurrencia", () => {
    const first = identifyToolOperation(call({
      args: { meal: "Comida", nested: { z: 2, a: 1 }, date: "2026-09-01" },
    }));
    const providerRetry = identifyToolOperation(call({
      providerCallId: "provider-call-retry",
      args: { date: "2026-09-01", nested: { a: 1, z: 2 }, meal: "Comida" },
    }));
    const repeatedInSameTurn = identifyToolOperation(call({
      occurrence: 1,
      args: { date: "2026-09-01", nested: { a: 1, z: 2 }, meal: "Comida" },
    }));

    expect(providerRetry).toEqual(first);
    expect(repeatedInSameTurn.operationId).not.toBe(first.operationId);
  });

  it("conserva la identidad canónica para muchas permutaciones de claves", () => {
    const source = { alpha: 1, beta: 2, gamma: 3, delta: 4 };
    const expected = identifyToolOperation(call({ args: source })).operationId;
    fc.assert(fc.property(
      fc.shuffledSubarray(Object.keys(source), { minLength: 4, maxLength: 4 }),
      (keys) => {
        const shuffled = Object.fromEntries(
          keys.map((property) => [property, source[property as keyof typeof source]]),
        );
        expect(identifyToolOperation(call({ args: shuffled })).operationId).toBe(expected);
      },
    ));
  });

  it("ejecuta una escritura una vez, incluso tras recrear el coordinador", async () => {
    const storage = new MemoryStorage();
    const firstExecutor = vi.fn(async () => ({
      output: "guardado",
      status: "committed" as const,
    }));
    const firstCoordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );

    await expect(firstCoordinator.execute(call(), true, firstExecutor)).resolves.toBe(
      "guardado",
    );

    const replayExecutor = vi.fn(async () => ({
      output: "duplicado",
      status: "committed" as const,
    }));
    const restartedCoordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    await expect(restartedCoordinator.execute(
      call({ providerCallId: "new-provider-id" }),
      true,
      replayExecutor,
    )).resolves.toBe("guardado");

    expect(firstExecutor).toHaveBeenCalledTimes(1);
    expect(replayExecutor).not.toHaveBeenCalled();
  });

  it("une reintentos simultáneos y deja pasar siempre las lecturas", async () => {
    const storage = new MemoryStorage();
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writeExecutor = vi.fn(async () => {
      await gate;
      return { output: "hecho", status: "committed" as const };
    });
    const first = coordinator.execute(call(), true, writeExecutor);
    const second = coordinator.execute(call(), true, writeExecutor);
    release?.();
    await expect(Promise.all([first, second])).resolves.toEqual(["hecho", "hecho"]);
    expect(writeExecutor).toHaveBeenCalledTimes(1);

    const readExecutor = vi.fn(async () => ({
      output: "lectura",
      status: "no_effect" as const,
    }));
    await coordinator.execute(call({ name: "read_routines" }), false, readExecutor);
    await coordinator.execute(call({ name: "read_routines" }), false, readExecutor);
    expect(readExecutor).toHaveBeenCalledTimes(2);
  });

  it("no registra validaciones ni fallos anteriores al efecto", async () => {
    const storage = new MemoryStorage();
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    const executor = vi.fn()
      .mockResolvedValueOnce({ output: "faltan datos", status: "no_effect" })
      .mockResolvedValueOnce({ output: "falló", status: "failed_before_commit" })
      .mockResolvedValueOnce({ output: "guardado", status: "committed" });

    await coordinator.execute(call(), true, executor);
    await coordinator.execute(call(), true, executor);
    await coordinator.execute(call(), true, executor);
    await coordinator.execute(call(), true, executor);

    expect(executor).toHaveBeenCalledTimes(3);
  });

  it("caduca a los siete días y conserva como máximo 256 operaciones", async () => {
    const storage = new MemoryStorage();
    let now = 1_000;
    const repository = new ToolOperationLedgerRepository(storage, key, () => now);
    for (let index = 0; index < TOOL_OPERATION_LEDGER_MAX_ENTRIES + 5; index += 1) {
      const identity = identifyToolOperation(call({ executionId: `message-${index}` }));
      await repository.record(identity, "add_meal_food", `resultado-${index}`);
      now += 1;
    }
    const state = JSON.parse(storage.values.get(key) ?? "{}") as { entries: unknown[] };
    expect(state.entries).toHaveLength(TOOL_OPERATION_LEDGER_MAX_ENTRIES);

    const newestIdentity = identifyToolOperation(call({ executionId: "message-260" }));
    now += TOOL_OPERATION_LEDGER_TTL_MS;
    await expect(repository.find(newestIdentity)).resolves.toEqual({ kind: "miss" });
  });

  it("falla cerrado ante una colisión y se recupera de datos corruptos", async () => {
    const storage = new MemoryStorage();
    const identity = identifyToolOperation(call());
    storage.values.set(key, JSON.stringify({
      schemaVersion: 1,
      entries: [{
        ...identity,
        fingerprint: "different-fingerprint",
        toolName: "add_meal_food",
        output: "previo",
        committedAt: Date.now(),
        expiresAt: Date.now() + TOOL_OPERATION_LEDGER_TTL_MS,
      }],
    }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    const executor = vi.fn(async () => ({ output: "nuevo", status: "committed" as const }));
    await expect(coordinator.execute(call(), true, executor)).resolves.toContain(
      "identidad no era segura",
    );
    expect(executor).not.toHaveBeenCalled();

    storage.values.set("corrupt", "no-json");
    const corruptRepository = new ToolOperationLedgerRepository(storage, "corrupt");
    await expect(corruptRepository.find(identity)).resolves.toEqual({ kind: "miss" });
  });

  it("no ejecuta el efecto si el registro no puede leerse", async () => {
    const unavailableStorage = {
      getItem: async () => {
        throw new Error("storage unavailable");
      },
      setItem: async () => {},
      removeItem: async () => {},
    };
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(unavailableStorage, key),
    );
    const executor = vi.fn(async () => ({ output: "nuevo", status: "committed" as const }));

    await expect(coordinator.execute(call(), true, executor)).rejects.toThrow(
      "storage unavailable",
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it("no repuebla el registro si se borra mientras una operación termina", async () => {
    const storage = new MemoryStorage();
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    let markStarted: (() => void) | undefined;
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execution = coordinator.execute(call(), true, async () => {
      markStarted?.();
      await gate;
      return { output: "guardado", status: "committed" };
    });

    await started;
    await coordinator.clear();
    release?.();
    await execution;

    expect(storage.values.has(key)).toBe(false);
  });
});
