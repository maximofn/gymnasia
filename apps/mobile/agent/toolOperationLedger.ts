import { sha256 } from "@noble/hashes/sha2.js";

export type ToolProvider = "openai" | "anthropic" | "google" | "custom_openai";

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
  status: "committed" | "no_effect" | "failed_before_commit" | "indeterminate";
};

export type ToolOperationIdentity = {
  operationId: string;
  fingerprint: string;
};

type ToolOperationLedgerEntry = ToolOperationIdentity & {
  toolName: string;
  state: "prepared" | "committed" | "indeterminate";
  preparedAt: number;
  committedAt?: number;
  updatedAt: number;
  expiresAt: number;
  output?: string;
};

type ToolOperationLedgerState = {
  schemaVersion: 2;
  entries: ToolOperationLedgerEntry[];
};

type LegacyToolOperationLedgerState = {
  schemaVersion: 1;
  entries: Array<ToolOperationIdentity & {
    toolName: string;
    output: string;
    committedAt: number;
    expiresAt: number;
  }>;
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

export type ToolOperationReconciliationOutcome =
  | { status: "committed"; output: string }
  | { status: "not_committed" }
  | { status: "indeterminate" };

export type ToolOperationReconciliationContext = {
  source: "fresh" | "unresolved" | "post_commit";
  preparedAt?: number;
};

export type ToolOperationReconciler = (
  operationId: string,
  toolName: string,
  context: ToolOperationReconciliationContext,
) => Promise<ToolOperationReconciliationOutcome>;

export const TOOL_OPERATION_LEDGER_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const TOOL_OPERATION_LEDGER_MAX_ENTRIES = 256;
export const TOOL_OPERATION_INDETERMINATE_MESSAGE =
  "Gymnasia no puede confirmar si la acción llegó a completarse. Para evitar duplicarla, no la ha repetido. Revisa tus datos antes de solicitarla de nuevo.";

const EMPTY_LEDGER: ToolOperationLedgerState = {
  schemaVersion: 2,
  entries: [],
};

export class ToolOperationLedgerCorruptError extends Error {
  constructor() {
    super("El registro de operaciones no puede leerse de forma segura.");
    this.name = "ToolOperationLedgerCorruptError";
  }
}

export class ToolOperationLedgerCapacityError extends Error {
  constructor() {
    super("El registro de operaciones contiene demasiadas acciones sin resolver.");
    this.name = "ToolOperationLedgerCapacityError";
  }
}

export class ToolOperationIndeterminateError extends Error {
  constructor() {
    super(TOOL_OPERATION_INDETERMINATE_MESSAGE);
    this.name = "ToolOperationIndeterminateError";
  }
}

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

function isIdentity(value: Record<string, unknown>): boolean {
  return (
    typeof value.operationId === "string"
    && /^[a-f0-9]{64}$/.test(value.operationId)
    && typeof value.fingerprint === "string"
    && /^[a-f0-9]{64}$/.test(value.fingerprint)
    && typeof value.toolName === "string"
    && value.toolName.length > 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLedgerEntry(value: unknown): value is ToolOperationLedgerEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (!isIdentity(entry)) return false;
  if (!["prepared", "committed", "indeterminate"].includes(String(entry.state))) return false;
  if (
    !isFiniteNumber(entry.preparedAt)
    || !isFiniteNumber(entry.updatedAt)
    || !isFiniteNumber(entry.expiresAt)
  ) return false;
  if (entry.state === "committed") {
    return isFiniteNumber(entry.committedAt) && typeof entry.output === "string";
  }
  return entry.committedAt === undefined && entry.output === undefined;
}

function isLegacyLedgerEntry(
  value: unknown,
): value is LegacyToolOperationLedgerState["entries"][number] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    isIdentity(entry)
    && typeof entry.output === "string"
    && isFiniteNumber(entry.committedAt)
    && isFiniteNumber(entry.expiresAt)
  );
}

function parseLedger(raw: string | null): ToolOperationLedgerState {
  if (!raw) return EMPTY_LEDGER;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolOperationLedgerCorruptError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ToolOperationLedgerCorruptError();
  }
  const candidate = parsed as { schemaVersion?: unknown; entries?: unknown };
  if (candidate.schemaVersion === 2 && Array.isArray(candidate.entries)) {
    if (!candidate.entries.every(isLedgerEntry)) throw new ToolOperationLedgerCorruptError();
    return { schemaVersion: 2, entries: candidate.entries };
  }
  if (candidate.schemaVersion === 1 && Array.isArray(candidate.entries)) {
    if (!candidate.entries.every(isLegacyLedgerEntry)) {
      throw new ToolOperationLedgerCorruptError();
    }
    return {
      schemaVersion: 2,
      entries: candidate.entries.map((entry) => ({
        operationId: entry.operationId,
        fingerprint: entry.fingerprint,
        toolName: entry.toolName,
        state: "committed",
        preparedAt: entry.committedAt,
        committedAt: entry.committedAt,
        updatedAt: entry.committedAt,
        expiresAt: entry.expiresAt,
        output: entry.output,
      })),
    };
  }
  throw new ToolOperationLedgerCorruptError();
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
          this.trace?.("tool_operation_ledger", { phase: "read", status: "failed" });
          throw error;
        }
        try {
          this.state = parseLedger(raw);
          return this.state;
        } catch (error) {
          this.trace?.("tool_operation_ledger", { phase: "read", status: "corrupt" });
          throw error;
        }
      })();
    }
    return this.loadPromise;
  }

  private retained(entries: ToolOperationLedgerEntry[]): ToolOperationLedgerEntry[] {
    const currentTime = this.now();
    return entries.filter(
      (entry) => entry.state !== "committed" || entry.expiresAt > currentTime,
    );
  }

  private bounded(entries: ToolOperationLedgerEntry[]): ToolOperationLedgerEntry[] {
    const retained = this.retained(entries);
    if (retained.length <= TOOL_OPERATION_LEDGER_MAX_ENTRIES) return retained;
    const removable = retained
      .filter((entry) => entry.state === "committed")
      .sort((left, right) => left.updatedAt - right.updatedAt);
    const removeCount = retained.length - TOOL_OPERATION_LEDGER_MAX_ENTRIES;
    if (removable.length < removeCount) throw new ToolOperationLedgerCapacityError();
    const removed = new Set(removable.slice(0, removeCount).map((entry) => entry.operationId));
    return retained.filter((entry) => !removed.has(entry.operationId));
  }

  private async enqueueWrite(task: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  private async persist(nextState: ToolOperationLedgerState): Promise<void> {
    const raw = JSON.stringify(nextState);
    await this.storage.setItem(this.storageKey, raw);
    const verified = await this.storage.getItem(this.storageKey);
    if (verified !== raw) throw new Error("Tool operation ledger write could not be verified.");
    this.state = nextState;
    this.loadPromise = Promise.resolve(nextState);
  }

  async find(identity: ToolOperationIdentity): Promise<
    | { kind: "miss" }
    | { kind: "replay"; output: string }
    | { kind: "prepared"; toolName: string; preparedAt: number }
    | { kind: "indeterminate"; toolName: string; preparedAt: number }
    | { kind: "collision" }
  > {
    const state = await this.load();
    const retained = this.retained(state.entries);
    this.state = { schemaVersion: 2, entries: retained };
    const entry = retained.find(
      (candidate) => candidate.operationId === identity.operationId,
    );
    if (!entry) return { kind: "miss" };
    if (entry.fingerprint !== identity.fingerprint) return { kind: "collision" };
    if (entry.state === "committed") return { kind: "replay", output: entry.output ?? "" };
    return { kind: entry.state, toolName: entry.toolName, preparedAt: entry.preparedAt };
  }

  async prepare(identity: ToolOperationIdentity, toolName: string): Promise<void> {
    await this.load();
    await this.enqueueWrite(async () => {
      const now = this.now();
      const retained = this.retained(this.state?.entries ?? []);
      const existing = retained.find((entry) => entry.operationId === identity.operationId);
      if (existing && existing.fingerprint !== identity.fingerprint) {
        throw new Error("Tool operation identity collision.");
      }
      if (existing?.state === "committed") return;
      const prepared: ToolOperationLedgerEntry = {
        ...identity,
        toolName,
        state: "prepared",
        preparedAt: existing?.preparedAt ?? now,
        updatedAt: now,
        expiresAt: now + TOOL_OPERATION_LEDGER_TTL_MS,
      };
      const entries = this.bounded([
        ...retained.filter((entry) => entry.operationId !== identity.operationId),
        prepared,
      ]);
      await this.persist({ schemaVersion: 2, entries });
    });
  }

  async commit(
    identity: ToolOperationIdentity,
    toolName: string,
    output: string,
  ): Promise<void> {
    await this.load();
    await this.enqueueWrite(async () => {
      const now = this.now();
      const retained = this.retained(this.state?.entries ?? []);
      const existing = retained.find((entry) => entry.operationId === identity.operationId);
      if (existing && existing.fingerprint !== identity.fingerprint) {
        throw new Error("Tool operation identity collision.");
      }
      const committed: ToolOperationLedgerEntry = {
        ...identity,
        toolName,
        state: "committed",
        preparedAt: existing?.preparedAt ?? now,
        committedAt: now,
        updatedAt: now,
        expiresAt: now + TOOL_OPERATION_LEDGER_TTL_MS,
        output,
      };
      const entries = this.bounded([
        ...retained.filter((entry) => entry.operationId !== identity.operationId),
        committed,
      ]);
      await this.persist({ schemaVersion: 2, entries });
    });
  }

  async markIndeterminate(
    identity: ToolOperationIdentity,
    toolName: string,
  ): Promise<void> {
    await this.load();
    await this.enqueueWrite(async () => {
      const now = this.now();
      const retained = this.retained(this.state?.entries ?? []);
      const existing = retained.find((entry) => entry.operationId === identity.operationId);
      if (existing && existing.fingerprint !== identity.fingerprint) {
        throw new Error("Tool operation identity collision.");
      }
      const indeterminate: ToolOperationLedgerEntry = {
        ...identity,
        toolName,
        state: "indeterminate",
        preparedAt: existing?.preparedAt ?? now,
        updatedAt: now,
        expiresAt: now + TOOL_OPERATION_LEDGER_TTL_MS,
      };
      const entries = this.bounded([
        ...retained.filter((entry) => entry.operationId !== identity.operationId),
        indeterminate,
      ]);
      await this.persist({ schemaVersion: 2, entries });
    });
  }

  async discard(identity: ToolOperationIdentity): Promise<void> {
    await this.load();
    await this.enqueueWrite(async () => {
      const retained = this.retained(this.state?.entries ?? []);
      const existing = retained.find((entry) => entry.operationId === identity.operationId);
      if (existing && existing.fingerprint !== identity.fingerprint) {
        throw new Error("Tool operation identity collision.");
      }
      await this.persist({
        schemaVersion: 2,
        entries: retained.filter((entry) => entry.operationId !== identity.operationId),
      });
    });
  }

  async listUnresolved(): Promise<ToolOperationLedgerEntry[]> {
    const state = await this.load();
    return this.retained(state.entries).filter((entry) => entry.state !== "committed");
  }

  async clear(): Promise<void> {
    await this.enqueueWrite(async () => {
      await this.storage.removeItem(this.storageKey);
      this.state = EMPTY_LEDGER;
      this.loadPromise = Promise.resolve(this.state);
    });
  }
}

export type ToolOperationReconciliationSummary = {
  committed: number;
  notCommitted: number;
  indeterminate: number;
};

export class ToolOperationCoordinator {
  private readonly inFlight = new Map<string, Promise<ToolOperationExecutionOutcome>>();
  private readonly volatileCommitted = new Map<
    string,
    { fingerprint: string; output: string; expiresAt: number }
  >();
  private generation = 0;

  constructor(
    private readonly ledger: ToolOperationLedgerRepository,
    private readonly trace?: TraceToolOperation,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(
    call: ToolCallEnvelope,
    effectful: boolean,
    executor: (operationId: string) => Promise<ToolOperationExecutionOutcome>,
    reconciler?: ToolOperationReconciler,
  ): Promise<ToolOperationExecutionOutcome> {
    if (!effectful) {
      return executor(identifyToolOperation(call).operationId);
    }

    const identity = identifyToolOperation(call);
    const volatile = this.volatileCommitted.get(identity.operationId);
    if (volatile) {
      if (volatile.expiresAt <= this.now()) {
        this.volatileCommitted.delete(identity.operationId);
      } else {
        if (volatile.fingerprint !== identity.fingerprint) {
          this.trace?.("tool_operation", {
            phase: "reconcile",
            status: "collision",
            toolName: call.name,
          });
          return {
            output: "No se ejecutó la acción porque su identidad no era segura.",
            status: "no_effect",
          };
        }
        this.trace?.("tool_operation", {
          phase: "reconcile",
          status: "committed",
          source: "memory",
          toolName: call.name,
        });
        return { output: volatile.output, status: "committed" };
      }
    }

    const current = this.inFlight.get(identity.operationId);
    if (current) {
      this.trace?.("tool_operation", { phase: "prepare", status: "joined", toolName: call.name });
      return current;
    }

    const generation = this.generation;
    const execution = this.executeOnce(
      call,
      identity,
      generation,
      executor,
      reconciler,
    ).finally(() => {
      this.inFlight.delete(identity.operationId);
    });
    this.inFlight.set(identity.operationId, execution);
    return execution;
  }

  private remember(identity: ToolOperationIdentity, output: string): void {
    this.volatileCommitted.set(identity.operationId, {
      fingerprint: identity.fingerprint,
      output,
      expiresAt: this.now() + TOOL_OPERATION_LEDGER_TTL_MS,
    });
    while (this.volatileCommitted.size > TOOL_OPERATION_LEDGER_MAX_ENTRIES) {
      const oldestKey = this.volatileCommitted.keys().next().value;
      if (typeof oldestKey !== "string") break;
      this.volatileCommitted.delete(oldestKey);
    }
  }

  private async reconcile(
    identity: ToolOperationIdentity,
    toolName: string,
    context: ToolOperationReconciliationContext,
    reconciler?: ToolOperationReconciler,
  ): Promise<ToolOperationReconciliationOutcome> {
    if (!reconciler) return { status: "indeterminate" };
    this.trace?.("tool_operation", { phase: "reconcile", status: "started", toolName });
    try {
      const outcome = await reconciler(identity.operationId, toolName, context);
      this.trace?.("tool_operation", {
        phase: "reconcile",
        status: outcome.status,
        source: "domain",
        toolName,
      });
      return outcome;
    } catch {
      this.trace?.("tool_operation", { phase: "reconcile", status: "failed", toolName });
      return { status: "indeterminate" };
    }
  }

  private async persistIndeterminate(
    identity: ToolOperationIdentity,
    toolName: string,
  ): Promise<void> {
    await this.ledger.markIndeterminate(identity, toolName).catch(() => {
      this.trace?.("tool_operation", { phase: "record", status: "failed", toolName });
    });
  }

  private async executeOnce(
    call: ToolCallEnvelope,
    identity: ToolOperationIdentity,
    generation: number,
    executor: (operationId: string) => Promise<ToolOperationExecutionOutcome>,
    reconciler?: ToolOperationReconciler,
  ): Promise<ToolOperationExecutionOutcome> {
    const found = await this.ledger.find(identity);
    if (found.kind === "collision") {
      this.trace?.("tool_operation", { phase: "reconcile", status: "collision", toolName: call.name });
      return {
        output: "No se ejecutó la acción porque su identidad no era segura.",
        status: "no_effect",
      };
    }
    if (found.kind === "replay") {
      this.remember(identity, found.output);
      this.trace?.("tool_operation", {
        phase: "reconcile",
        status: "committed",
        source: "ledger",
        toolName: call.name,
      });
      return { output: found.output, status: "committed" };
    }

    const reconciliationContext: ToolOperationReconciliationContext =
      found.kind === "prepared" || found.kind === "indeterminate"
        ? { source: "unresolved", preparedAt: found.preparedAt }
        : { source: "fresh" };
    const reconciliation = await this.reconcile(
      identity,
      call.name,
      reconciliationContext,
      reconciler,
    );
    if (reconciliation.status === "committed") {
      this.remember(identity, reconciliation.output);
      await this.ledger.commit(identity, call.name, reconciliation.output).catch(() => {
        this.trace?.("tool_operation", { phase: "record", status: "failed", toolName: call.name });
      });
      return { output: reconciliation.output, status: "committed" };
    }
    if (reconciliation.status === "indeterminate") {
      await this.persistIndeterminate(identity, call.name);
      return { output: TOOL_OPERATION_INDETERMINATE_MESSAGE, status: "indeterminate" };
    }

    this.trace?.("tool_operation", { phase: "prepare", status: "started", toolName: call.name });
    await this.ledger.prepare(identity, call.name);
    this.trace?.("tool_operation", { phase: "prepare", status: "persisted", toolName: call.name });

    const outcome = await executor(identity.operationId);
    this.trace?.("tool_operation", { phase: "commit", status: outcome.status, toolName: call.name });
    if (outcome.status === "no_effect" || outcome.status === "failed_before_commit") {
      await this.ledger.discard(identity).catch(() => {
        this.trace?.("tool_operation", { phase: "record", status: "failed", toolName: call.name });
      });
      return outcome;
    }
    if (outcome.status === "indeterminate") {
      await this.persistIndeterminate(identity, call.name);
      return { output: TOOL_OPERATION_INDETERMINATE_MESSAGE, status: "indeterminate" };
    }
    if (generation !== this.generation) {
      this.trace?.("tool_operation", { phase: "record", status: "cleared", toolName: call.name });
      return outcome;
    }

    try {
      await this.ledger.commit(identity, call.name, outcome.output);
      this.remember(identity, outcome.output);
      this.trace?.("tool_operation", { phase: "record", status: "committed", toolName: call.name });
      return outcome;
    } catch {
      this.trace?.("tool_operation", { phase: "record", status: "failed", toolName: call.name });
    }

    const afterCommit = await this.reconcile(
      identity,
      call.name,
      { source: "post_commit" },
      reconciler,
    );
    if (afterCommit.status === "committed") {
      this.remember(identity, afterCommit.output);
      return { output: afterCommit.output, status: "committed" };
    }
    await this.persistIndeterminate(identity, call.name);
    return { output: TOOL_OPERATION_INDETERMINATE_MESSAGE, status: "indeterminate" };
  }

  async reconcileUnresolved(
    reconciler: ToolOperationReconciler,
  ): Promise<ToolOperationReconciliationSummary> {
    const summary: ToolOperationReconciliationSummary = {
      committed: 0,
      notCommitted: 0,
      indeterminate: 0,
    };
    for (const entry of await this.ledger.listUnresolved()) {
      const identity = {
        operationId: entry.operationId,
        fingerprint: entry.fingerprint,
      };
      const outcome = await this.reconcile(
        identity,
        entry.toolName,
        { source: "unresolved", preparedAt: entry.preparedAt },
        reconciler,
      );
      if (outcome.status === "committed") {
        await this.ledger.commit(identity, entry.toolName, outcome.output).catch(() => {});
        this.remember(identity, outcome.output);
        summary.committed += 1;
      } else if (outcome.status === "not_committed") {
        await this.ledger.discard(identity).catch(() => {});
        summary.notCommitted += 1;
      } else {
        await this.persistIndeterminate(identity, entry.toolName);
        summary.indeterminate += 1;
      }
    }
    return summary;
  }

  async clear(): Promise<void> {
    this.generation += 1;
    this.inFlight.clear();
    this.volatileCommitted.clear();
    await this.ledger.clear();
  }
}
