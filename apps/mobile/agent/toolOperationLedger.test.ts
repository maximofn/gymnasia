import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  TOOL_OPERATION_INDETERMINATE_MESSAGE,
  TOOL_OPERATION_LEDGER_MAX_ENTRIES,
  TOOL_OPERATION_LEDGER_TTL_MS,
  ToolOperationCoordinator,
  ToolOperationLedgerCapacityError,
  ToolOperationLedgerCorruptError,
  ToolOperationLedgerRepository,
  identifyToolOperation,
  type ToolCallEnvelope,
  type ToolOperationReconciler,
} from "./toolOperationLedger";

class MemoryStorage {
  readonly values = new Map<string, string>();
  failAllWrites = false;
  failCommittedWrites = 0;

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failAllWrites) throw new Error("storage unavailable");
    if (this.failCommittedWrites > 0 && value.includes('"state":"committed"')) {
      this.failCommittedWrites -= 1;
      throw new Error("commit record unavailable");
    }
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const key = "tool-ledger";

function call(overrides: Partial<ToolCallEnvelope> = {}): ToolCallEnvelope {
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

const notCommitted: ToolOperationReconciler = async () => ({
  status: "not_committed",
});

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

  it("prepara de forma verificada antes de invocar el efecto", async () => {
    const storage = new MemoryStorage();
    storage.failAllWrites = true;
    const executor = vi.fn(async () => ({ output: "guardado", status: "committed" as const }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );

    await expect(coordinator.execute(call(), true, executor, notCommitted)).rejects.toThrow(
      "storage unavailable",
    );
    expect(executor).not.toHaveBeenCalled();
  });

  it("reconcilia el commit de dominio si falla el registro final y no duplica al reiniciar", async () => {
    const storage = new MemoryStorage();
    storage.failCommittedWrites = 1;
    let receiptExists = false;
    const reconcile: ToolOperationReconciler = async () => receiptExists
      ? { status: "committed", output: "ya estaba guardado" }
      : { status: "not_committed" };
    const executor = vi.fn(async () => {
      receiptExists = true;
      return { output: "guardado", status: "committed" as const };
    });

    const firstCoordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    await expect(firstCoordinator.execute(call(), true, executor, reconcile)).resolves.toEqual({
      output: "ya estaba guardado",
      status: "committed",
    });

    const replayExecutor = vi.fn(async () => ({ output: "duplicado", status: "committed" as const }));
    const restartedCoordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    await expect(restartedCoordinator.execute(
      call({ providerCallId: "new-provider-id" }),
      true,
      replayExecutor,
      reconcile,
    )).resolves.toMatchObject({ status: "committed" });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(replayExecutor).not.toHaveBeenCalled();
  });

  it("nunca reejecuta un prepared o indeterminate que no puede reconciliar", async () => {
    const storage = new MemoryStorage();
    const repository = new ToolOperationLedgerRepository(storage, key);
    const identity = identifyToolOperation(call());
    await repository.prepare(identity, call().name);
    const executor = vi.fn(async () => ({ output: "duplicado", status: "committed" as const }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );

    await expect(coordinator.execute(
      call(),
      true,
      executor,
      async () => ({ status: "indeterminate" }),
    )).resolves.toEqual({
      output: TOOL_OPERATION_INDETERMINATE_MESSAGE,
      status: "indeterminate",
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it("permite ejecutar un prepared cuando el dominio demuestra que no hubo efecto", async () => {
    const storage = new MemoryStorage();
    const identity = identifyToolOperation(call());
    await new ToolOperationLedgerRepository(storage, key).prepare(identity, call().name);
    const executor = vi.fn(async () => ({ output: "guardado", status: "committed" as const }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );

    await expect(coordinator.execute(call(), true, executor, notCommitted)).resolves.toEqual({
      output: "guardado",
      status: "committed",
    });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it("entrega al reconciliador el origen y la fecha del prepared persistido", async () => {
    const storage = new MemoryStorage();
    const identity = identifyToolOperation(call());
    await new ToolOperationLedgerRepository(storage, key, () => 123).prepare(
      identity,
      call().name,
    );
    const reconcile = vi.fn<ToolOperationReconciler>(async () => ({
      status: "indeterminate",
    }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );

    await coordinator.execute(
      call(),
      true,
      async () => ({ output: "duplicado", status: "committed" }),
      reconcile,
    );

    expect(reconcile).toHaveBeenCalledWith(
      identity.operationId,
      call().name,
      { source: "unresolved", preparedAt: 123 },
    );
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
    const first = coordinator.execute(call(), true, writeExecutor, notCommitted);
    const second = coordinator.execute(call(), true, writeExecutor, notCommitted);
    release?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { output: "hecho", status: "committed" },
      { output: "hecho", status: "committed" },
    ]);
    expect(writeExecutor).toHaveBeenCalledTimes(1);

    const readExecutor = vi.fn(async () => ({
      output: "lectura",
      status: "no_effect" as const,
    }));
    await coordinator.execute(call({ name: "read_routines" }), false, readExecutor);
    await coordinator.execute(call({ name: "read_routines" }), false, readExecutor);
    expect(readExecutor).toHaveBeenCalledTimes(2);
  });

  it("no memoriza validaciones ni fallos anteriores al efecto", async () => {
    const storage = new MemoryStorage();
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    const executor = vi.fn()
      .mockResolvedValueOnce({ output: "faltan datos", status: "no_effect" })
      .mockResolvedValueOnce({ output: "falló", status: "failed_before_commit" })
      .mockResolvedValueOnce({ output: "guardado", status: "committed" });

    await coordinator.execute(call(), true, executor, notCommitted);
    await coordinator.execute(call(), true, executor, notCommitted);
    await coordinator.execute(call(), true, executor, notCommitted);
    await coordinator.execute(call(), true, executor, notCommitted);

    expect(executor).toHaveBeenCalledTimes(3);
  });

  it("migra v1, caduca confirmados y conserva como máximo 256 operaciones", async () => {
    const storage = new MemoryStorage();
    let now = 1_000;
    const legacyIdentity = identifyToolOperation(call({ executionId: "legacy" }));
    storage.values.set(key, JSON.stringify({
      schemaVersion: 1,
      entries: [{
        ...legacyIdentity,
        toolName: "add_meal_food",
        output: "legado",
        committedAt: now,
        expiresAt: now + TOOL_OPERATION_LEDGER_TTL_MS,
      }],
    }));
    const repository = new ToolOperationLedgerRepository(storage, key, () => now);
    await expect(repository.find(legacyIdentity)).resolves.toEqual({
      kind: "replay",
      output: "legado",
    });

    for (let index = 0; index < TOOL_OPERATION_LEDGER_MAX_ENTRIES + 5; index += 1) {
      const identity = identifyToolOperation(call({ executionId: `message-${index}` }));
      await repository.prepare(identity, "add_meal_food");
      await repository.commit(identity, "add_meal_food", `resultado-${index}`);
      now += 1;
    }
    const state = JSON.parse(storage.values.get(key) ?? "{}") as { entries: unknown[] };
    expect(state.entries).toHaveLength(TOOL_OPERATION_LEDGER_MAX_ENTRIES);

    const newestIdentity = identifyToolOperation(call({ executionId: "message-260" }));
    now += TOOL_OPERATION_LEDGER_TTL_MS;
    await expect(repository.find(newestIdentity)).resolves.toEqual({ kind: "miss" });
  });

  it("caduca también la caché volátil de operaciones confirmadas", async () => {
    const storage = new MemoryStorage();
    let now = 1_000;
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key, () => now),
      undefined,
      () => now,
    );
    const executor = vi.fn(async () => ({ output: "guardado", status: "committed" as const }));

    await coordinator.execute(call(), true, executor, notCommitted);
    now += TOOL_OPERATION_LEDGER_TTL_MS + 1;
    await coordinator.execute(call(), true, executor, notCommitted);

    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("no expulsa operaciones sin resolver para abrir hueco", async () => {
    const storage = new MemoryStorage();
    const repository = new ToolOperationLedgerRepository(storage, key);
    for (let index = 0; index < TOOL_OPERATION_LEDGER_MAX_ENTRIES; index += 1) {
      await repository.prepare(
        identifyToolOperation(call({ executionId: `pending-${index}` })),
        "add_meal_food",
      );
    }
    await expect(repository.prepare(
      identifyToolOperation(call({ executionId: "one-too-many" })),
      "add_meal_food",
    )).rejects.toBeInstanceOf(ToolOperationLedgerCapacityError);
  });

  it("falla cerrado ante colisiones, corrupción o lecturas fallidas", async () => {
    const storage = new MemoryStorage();
    const identity = identifyToolOperation(call());
    storage.values.set(key, JSON.stringify({
      schemaVersion: 2,
      entries: [{
        ...identity,
        fingerprint: "b".repeat(64),
        toolName: "add_meal_food",
        state: "prepared",
        preparedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + TOOL_OPERATION_LEDGER_TTL_MS,
      }],
    }));
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    const executor = vi.fn(async () => ({ output: "nuevo", status: "committed" as const }));
    await expect(coordinator.execute(call(), true, executor, notCommitted)).resolves.toEqual({
      output: expect.stringContaining("identidad no era segura"),
      status: "no_effect",
    });
    expect(executor).not.toHaveBeenCalled();

    storage.values.set("corrupt", "no-json");
    await expect(
      new ToolOperationLedgerRepository(storage, "corrupt").find(identity),
    ).rejects.toBeInstanceOf(ToolOperationLedgerCorruptError);

    const unavailableStorage = {
      getItem: async () => { throw new Error("storage unavailable"); },
      setItem: async () => {},
      removeItem: async () => {},
    };
    const unavailableCoordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(unavailableStorage, key),
    );
    await expect(unavailableCoordinator.execute(call(), true, executor, notCommitted)).rejects.toThrow(
      "storage unavailable",
    );
  });

  it("no repuebla el journal si se borra mientras una operación termina", async () => {
    const storage = new MemoryStorage();
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
    );
    let markStarted: (() => void) | undefined;
    let release: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const execution = coordinator.execute(call(), true, async () => {
      markStarted?.();
      await gate;
      return { output: "guardado", status: "committed" };
    }, notCommitted);

    await started;
    await coordinator.clear();
    release?.();
    await execution;

    expect(storage.values.has(key)).toBe(false);
  });

  it("las trazas de fases no incluyen identidad, argumentos, contenido ni resultado", async () => {
    const storage = new MemoryStorage();
    const events: Array<{ message: string; data?: Record<string, unknown> }> = [];
    const coordinator = new ToolOperationCoordinator(
      new ToolOperationLedgerRepository(storage, key),
      (message, data) => events.push({ message, data }),
    );
    await coordinator.execute(
      call({ args: { secret: "no-trace" } }),
      true,
      async () => ({ output: "sensitive-output", status: "committed" }),
      notCommitted,
    );

    const serialized = JSON.stringify(events);
    expect(serialized).toContain("prepare");
    expect(serialized).toContain("commit");
    expect(serialized).toContain("record");
    expect(serialized).not.toContain("no-trace");
    expect(serialized).not.toContain("sensitive-output");
    expect(serialized).not.toContain(identifyToolOperation(call()).operationId);
  });
});
