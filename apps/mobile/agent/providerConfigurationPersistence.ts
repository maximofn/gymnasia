import {
  normalizeProviderConfigurations,
  type ProviderConfiguration,
} from "./providerConfiguration";

export type AsyncKeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type SecureKeyValueStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type ProviderConfigurationSnapshot = {
  schemaVersion: 1;
  revision: number;
  keys: ProviderConfiguration[];
};

type ProviderConfigurationJournal = {
  schemaVersion: 1;
  committed: ProviderConfigurationSnapshot | null;
  pending: ProviderConfigurationSnapshot | null;
};

export type ProviderConfigurationCommitResult =
  | { status: "committed"; snapshot: ProviderConfigurationSnapshot }
  | { status: "stale"; snapshot: ProviderConfigurationSnapshot | null };

export type ProviderConfigurationHydrationResult = {
  snapshot: ProviderConfigurationSnapshot;
  migrated: boolean;
};

type RepositoryOptions = {
  asyncStorage: AsyncKeyValueStorage;
  asyncStorageKey: string;
  secureStorage?: SecureKeyValueStorage;
  secureStorageKey?: string;
};

function snapshotWithRevision(
  revision: number,
  keys: readonly ProviderConfiguration[],
): ProviderConfigurationSnapshot {
  return {
    schemaVersion: 1,
    revision,
    keys: normalizeProviderConfigurations(keys),
  };
}

function sanitizeSnapshot(
  snapshot: ProviderConfigurationSnapshot | null,
): ProviderConfigurationSnapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    keys: snapshot.keys.map((item) => ({ ...item, api_key: "" })),
  };
}

function sanitizeJournal(journal: ProviderConfigurationJournal): ProviderConfigurationJournal {
  return {
    ...journal,
    committed: sanitizeSnapshot(journal.committed),
    pending: sanitizeSnapshot(journal.pending),
  };
}

function parseSnapshot(value: unknown): ProviderConfigurationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<ProviderConfigurationSnapshot>;
  if (
    candidate.schemaVersion !== 1
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision ?? -1) < 0
    || !Array.isArray(candidate.keys)
  ) {
    return null;
  }
  return snapshotWithRevision(candidate.revision as number, candidate.keys);
}

function parseJournal(raw: string | null): ProviderConfigurationJournal | null {
  if (!raw) return null;
  try {
    const candidate = JSON.parse(raw) as Partial<ProviderConfigurationJournal>;
    if (candidate?.schemaVersion !== 1) return null;
    const committed = parseSnapshot(candidate.committed);
    const pending = parseSnapshot(candidate.pending);
    if (!committed && !pending) return null;
    return { schemaVersion: 1, committed, pending };
  } catch {
    return null;
  }
}

export class ProviderConfigurationRepository {
  private readonly asyncStorage: AsyncKeyValueStorage;
  private readonly asyncStorageKey: string;
  private readonly secureStorage?: SecureKeyValueStorage;
  private readonly secureStorageKey?: string;
  private current: ProviderConfigurationSnapshot | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: RepositoryOptions) {
    this.asyncStorage = options.asyncStorage;
    this.asyncStorageKey = options.asyncStorageKey;
    this.secureStorage = options.secureStorage;
    this.secureStorageKey = options.secureStorageKey;
    if (!!this.secureStorage !== !!this.secureStorageKey) {
      throw new Error("SecureStore y su clave deben configurarse juntos.");
    }
  }

  private get isNativeSecure(): boolean {
    return !!this.secureStorage && !!this.secureStorageKey;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async writeJournal(journal: ProviderConfigurationJournal): Promise<void> {
    if (this.isNativeSecure) {
      await this.secureStorage!.setItemAsync(
        this.secureStorageKey!,
        JSON.stringify(journal),
      );
      await this.asyncStorage.setItem(
        this.asyncStorageKey,
        JSON.stringify(sanitizeJournal(journal)),
      );
      return;
    }
    await this.asyncStorage.setItem(this.asyncStorageKey, JSON.stringify(journal));
  }

  private async writeFinalJournal(journal: ProviderConfigurationJournal): Promise<void> {
    if (this.isNativeSecure) {
      // El espejo saneado se escribe primero. El registro seguro es el marcador
      // canónico final: si falla, la hidratación conserva el commit anterior.
      await this.asyncStorage.setItem(
        this.asyncStorageKey,
        JSON.stringify(sanitizeJournal(journal)),
      );
      await this.secureStorage!.setItemAsync(
        this.secureStorageKey!,
        JSON.stringify(journal),
      );
      return;
    }
    await this.asyncStorage.setItem(this.asyncStorageKey, JSON.stringify(journal));
  }

  private async restore(snapshot: ProviderConfigurationSnapshot | null): Promise<void> {
    if (!snapshot) {
      await this.asyncStorage.removeItem(this.asyncStorageKey);
      if (this.isNativeSecure) {
        await this.secureStorage!.deleteItemAsync(this.secureStorageKey!);
      }
      return;
    }
    const journal: ProviderConfigurationJournal = {
      schemaVersion: 1,
      committed: snapshot,
      pending: null,
    };
    await this.writeFinalJournal(journal);
  }

  async hydrate(
    legacyKeys: readonly ProviderConfiguration[],
  ): Promise<ProviderConfigurationHydrationResult> {
    return this.enqueue(async () => {
      const raw = this.isNativeSecure
        ? await this.secureStorage!.getItemAsync(this.secureStorageKey!)
        : await this.asyncStorage.getItem(this.asyncStorageKey);
      const journal = parseJournal(raw);
      if (journal?.committed) {
        this.current = journal.committed;
        // Un pending sobreviviente nunca se promociona automáticamente. La
        // elección conservadora es reparar ambos almacenes al último commit.
        await this.restore(this.current).catch(() => {});
        return { snapshot: this.current, migrated: false };
      }

      const legacySnapshot = snapshotWithRevision(0, legacyKeys);
      const finalJournal: ProviderConfigurationJournal = {
        schemaVersion: 1,
        committed: legacySnapshot,
        pending: null,
      };
      try {
        await this.writeFinalJournal(finalJournal);
        this.current = legacySnapshot;
        return { snapshot: legacySnapshot, migrated: true };
      } catch {
        // No impedir el arranque. El llamador puede seguir usando la última
        // configuración legible y reintentará la migración en otra sesión.
        this.current = legacySnapshot;
        return { snapshot: legacySnapshot, migrated: false };
      }
    });
  }

  async commit(
    keysOrUpdate:
      | readonly ProviderConfiguration[]
      | ((current: readonly ProviderConfiguration[]) => readonly ProviderConfiguration[]),
    isCurrent: () => boolean = () => true,
  ): Promise<ProviderConfigurationCommitResult> {
    return this.enqueue(async () => {
      const previous = this.current;
      if (!isCurrent()) return { status: "stale", snapshot: previous };

      const candidateKeys = typeof keysOrUpdate === "function"
        ? keysOrUpdate(previous?.keys ?? [])
        : keysOrUpdate;
      const candidate = snapshotWithRevision((previous?.revision ?? 0) + 1, candidateKeys);
      const pendingJournal: ProviderConfigurationJournal = {
        schemaVersion: 1,
        committed: previous,
        pending: candidate,
      };
      try {
        await this.writeJournal(pendingJournal);
        if (!isCurrent()) {
          await this.restore(previous).catch(() => {});
          return { status: "stale", snapshot: previous };
        }

        const finalJournal: ProviderConfigurationJournal = {
          schemaVersion: 1,
          committed: candidate,
          pending: null,
        };
        await this.writeFinalJournal(finalJournal);
        if (!isCurrent()) {
          await this.restore(previous).catch(() => {});
          return { status: "stale", snapshot: previous };
        }
        this.current = candidate;
        return { status: "committed", snapshot: candidate };
      } catch (error) {
        await this.restore(previous).catch(() => {});
        throw error;
      }
    });
  }

  async clear(): Promise<void> {
    return this.enqueue(async () => {
      await this.asyncStorage.removeItem(this.asyncStorageKey);
      if (this.isNativeSecure) {
        await this.secureStorage!.deleteItemAsync(this.secureStorageKey!);
      }
      this.current = null;
    });
  }

  getCurrent(): ProviderConfigurationSnapshot | null {
    return this.current;
  }
}
