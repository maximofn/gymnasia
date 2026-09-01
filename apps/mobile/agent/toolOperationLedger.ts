import { sha256 } from "@noble/hashes/sha2.js";

export type ToolProvider = "openai" | "anthropic" | "google";

export type ToolCallEnvelope = {
  executionId: string;
  provider: ToolProvider;
  providerCallId?: string;
  name: string;
  args: Record<string, unknown>;
  occurrence: number;
};

export type ToolOperationExecutionOutcome = {
  output: string;
  status: "committed" | "no_effect" | "failed_before_commit";
};

export type ToolOperationIdentity = {
  operationId: string;
  fingerprint: string;
};

type ToolOperationLedgerEntry = ToolOperationIdentity & {
  toolName: string;
  output: string;
  committedAt: number;
  expiresAt: number;
};

type ToolOperationLedgerState = {
  schemaVersion: 1;
  entries: ToolOperationLedgerEntry[];
};

type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type TraceToolOperation = (
  message: string,
  data?: Record<string, unknown>,
) => void;

export const TOOL_OPERATION_LEDGER_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const TOOL_OPERATION_LEDGER_MAX_ENTRIES = 256;

const EMPTY_LEDGER: ToolOperationLedgerState = {
  schemaVersion: 1,
  entries: [],
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function sha256Hex(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

function sortJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 64) {
    throw new Error("Tool arguments exceed the supported nesting depth.");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortJsonValue(
          (value as Record<string, unknown>)[key],
          depth + 1,
        );
        return sorted;
      }, {});
  }
  return value;
}

export function canonicalToolJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function toolCallOccurrenceKey(
  name: string,
  args: Record<string, unknown>,
): string {
  return `${name}:${sha256Hex(canonicalToolJson(args))}`;
}

export function identifyToolOperation(
  call: ToolCallEnvelope,
): ToolOperationIdentity {
  const canonicalArgs = canonicalToolJson(call.args);
  const fingerprint = sha256Hex(
    canonicalToolJson({
      name: call.name,
      args: canonicalArgs,
    }),
  );
  const operationId = sha256Hex(
    canonicalToolJson({
      version: 1,
      executionId: call.executionId,
      provider: call.provider,
      name: call.name,
      args: canonicalArgs,
      occurrence: call.occurrence,
    }),
  );
  return { operationId, fingerprint };
}

function isLedgerEntry(value: unknown): value is ToolOperationLedgerEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ToolOperationLedgerEntry>;
  return (
    typeof entry.operationId === "string" &&
    typeof entry.fingerprint === "string" &&
    typeof entry.toolName === "string" &&
    typeof entry.output === "string" &&
    typeof entry.committedAt === "number" &&
    Number.isFinite(entry.committedAt) &&
    typeof entry.expiresAt === "number" &&
    Number.isFinite(entry.expiresAt)
  );
}

function parseLedger(raw: string | null): ToolOperationLedgerState {
  if (!raw) return EMPTY_LEDGER;
  const parsed = JSON.parse(raw) as Partial<ToolOperationLedgerState>;
  if (
    parsed.schemaVersion !== 1 ||
    !Array.isArray(parsed.entries) ||
    !parsed.entries.every(isLedgerEntry)
  ) {
    throw new Error("Invalid tool operation ledger.");
  }
  return {
    schemaVersion: 1,
    entries: parsed.entries,
  };
}

export class ToolOperationLedgerRepository {
  private state: ToolOperationLedgerState | null = null;
  private loadPromise: Promise<ToolOperationLedgerState> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: AsyncKeyValueStorage,
    private readonly storageKey: string,
    private readonly now: () => number = Date.now,
    private readonly trace?: TraceToolOperation,
  ) {}

  private async load(): Promise<ToolOperationLedgerState> {
    if (this.state) return this.state;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        let raw: string | null;
        try {
          raw = await this.storage.getItem(this.storageKey);
        } catch (error) {
          this.trace?.("tool_ledger_read_failed");
          throw error;
        }
        try {
          const parsed = parseLedger(raw);
          this.state = parsed;
        } catch {
          this.trace?.("tool_ledger_corrupt_reset");
          this.state = EMPTY_LEDGER;
        }
        return this.state;
      })();
    }
    return this.loadPromise;
  }

  private prune(entries: ToolOperationLedgerEntry[]): ToolOperationLedgerEntry[] {
    const currentTime = this.now();
    return entries
      .filter((entry) => entry.expiresAt > currentTime)
      .sort((left, right) => left.committedAt - right.committedAt)
      .slice(-TOOL_OPERATION_LEDGER_MAX_ENTRIES);
  }

  private async enqueueWrite(task: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async find(identity: ToolOperationIdentity): Promise<
    | { kind: "miss" }
    | { kind: "replay"; output: string }
    | { kind: "collision" }
  > {
    const state = await this.load();
    const retained = this.prune(state.entries);
    if (retained.length !== state.entries.length) {
      this.state = { schemaVersion: 1, entries: retained };
      void this.enqueueWrite(() =>
        this.storage.setItem(this.storageKey, JSON.stringify(this.state)),
      ).catch(() => this.trace?.("tool_ledger_prune_write_failed"));
    }
    const entry = retained.find(
      (candidate) => candidate.operationId === identity.operationId,
    );
    if (!entry) return { kind: "miss" };
    if (entry.fingerprint !== identity.fingerprint) return { kind: "collision" };
    return { kind: "replay", output: entry.output };
  }

  async record(
    identity: ToolOperationIdentity,
    toolName: string,
    output: string,
  ): Promise<void> {
    await this.load();
    await this.enqueueWrite(async () => {
      const committedAt = this.now();
      const retained = this.prune(this.state?.entries ?? []);
      const existing = retained.find(
        (entry) => entry.operationId === identity.operationId,
      );
      if (existing && existing.fingerprint !== identity.fingerprint) {
        throw new Error("Tool operation identity collision.");
      }
      const entries = existing
        ? retained
        : [
            ...retained,
            {
              ...identity,
              toolName,
              output,
              committedAt,
              expiresAt: committedAt + TOOL_OPERATION_LEDGER_TTL_MS,
            },
          ].slice(-TOOL_OPERATION_LEDGER_MAX_ENTRIES);
      const nextState: ToolOperationLedgerState = {
        schemaVersion: 1,
        entries,
      };
      await this.storage.setItem(this.storageKey, JSON.stringify(nextState));
      this.state = nextState;
    });
  }

  async clear(): Promise<void> {
    await this.enqueueWrite(async () => {
      await this.storage.removeItem(this.storageKey);
      this.state = EMPTY_LEDGER;
      this.loadPromise = Promise.resolve(this.state);
    });
  }
}

export class ToolOperationCoordinator {
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly volatileCommitted = new Map<
    string,
    { fingerprint: string; output: string }
  >();
  private generation = 0;

  constructor(
    private readonly ledger: ToolOperationLedgerRepository,
    private readonly trace?: TraceToolOperation,
  ) {}

  async execute(
    call: ToolCallEnvelope,
    effectful: boolean,
    executor: (operationId: string) => Promise<ToolOperationExecutionOutcome>,
  ): Promise<string> {
    if (!effectful) {
      return (await executor(identifyToolOperation(call).operationId)).output;
    }

    const identity = identifyToolOperation(call);
    const volatile = this.volatileCommitted.get(identity.operationId);
    if (volatile) {
      if (volatile.fingerprint !== identity.fingerprint) {
        this.trace?.("tool_operation_collision", { toolName: call.name });
        return "No se ejecutó la acción porque su identidad no era segura.";
      }
      this.trace?.("tool_operation_replayed", {
        toolName: call.name,
        source: "memory",
      });
      return volatile.output;
    }

    const current = this.inFlight.get(identity.operationId);
    if (current) {
      this.trace?.("tool_operation_joined", { toolName: call.name });
      return current;
    }

    const generation = this.generation;
    const execution = this.executeOnce(call, identity, generation, executor).finally(() => {
      this.inFlight.delete(identity.operationId);
    });
    this.inFlight.set(identity.operationId, execution);
    return execution;
  }

  private async executeOnce(
    call: ToolCallEnvelope,
    identity: ToolOperationIdentity,
    generation: number,
    executor: (operationId: string) => Promise<ToolOperationExecutionOutcome>,
  ): Promise<string> {
    const found = await this.ledger.find(identity);
    if (found.kind === "collision") {
      this.trace?.("tool_operation_collision", { toolName: call.name });
      return "No se ejecutó la acción porque su identidad no era segura.";
    }
    if (found.kind === "replay") {
      this.trace?.("tool_operation_replayed", {
        toolName: call.name,
        source: "ledger",
      });
      return found.output;
    }

    const outcome = await executor(identity.operationId);
    if (outcome.status !== "committed") return outcome.output;
    if (generation !== this.generation) {
      this.trace?.("tool_operation_cleared_while_running", { toolName: call.name });
      return outcome.output;
    }

    this.volatileCommitted.set(identity.operationId, {
      fingerprint: identity.fingerprint,
      output: outcome.output,
    });
    while (this.volatileCommitted.size > TOOL_OPERATION_LEDGER_MAX_ENTRIES) {
      const oldestKey = this.volatileCommitted.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.volatileCommitted.delete(oldestKey);
    }

    try {
      await this.ledger.record(identity, call.name, outcome.output);
      this.trace?.("tool_operation_committed", { toolName: call.name });
    } catch {
      this.trace?.("tool_ledger_write_failed", { toolName: call.name });
    }
    return outcome.output;
  }

  async clear(): Promise<void> {
    this.generation += 1;
    this.inFlight.clear();
    this.volatileCommitted.clear();
    await this.ledger.clear();
  }
}
