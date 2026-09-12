import { useCallback, useMemo, useRef, useState } from "react";

import type { LocalStore } from "./localStoreModel";

export type LocalStoreRuntime = {
  store: LocalStore;
  isHydrated: boolean;
  update(mutator: (previous: LocalStore) => LocalStore): void;
  commit(mutator: (previous: LocalStore) => LocalStore): Promise<void>;
};

type LocalStoreRuntimeOptions = {
  initialStore: () => LocalStore;
  isHydrated: boolean;
  persist(store: LocalStore): Promise<void>;
};

export type LocalStoreRuntimeHandle = {
  runtime: LocalStoreRuntime;
  current(): LocalStore;
  replace(store: LocalStore): void;
  enqueuePersistence(task: () => Promise<void>): Promise<void>;
};

export function useLocalStoreRuntime({
  initialStore,
  isHydrated,
  persist,
}: LocalStoreRuntimeOptions): LocalStoreRuntimeHandle {
  const [store, setStore] = useState<LocalStore>(initialStore);
  const storeRef = useRef(store);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  storeRef.current = store;

  const update = useCallback((mutator: (previous: LocalStore) => LocalStore): void => {
    setStore(mutator);
  }, []);

  const replace = useCallback((next: LocalStore): void => {
    storeRef.current = next;
    setStore(next);
  }, []);

  const enqueuePersistence = useCallback((task: () => Promise<void>): Promise<void> => {
    const run = persistenceQueueRef.current.then(task);
    persistenceQueueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const commit = useCallback(
    async (mutator: (previous: LocalStore) => LocalStore): Promise<void> => {
      const run = enqueuePersistence(async () => {
        const previous = storeRef.current;
        const next = mutator(previous);
        if (next === previous) return;
        await persist(next);
        storeRef.current = next;
        setStore((current) => (current === previous ? next : mutator(current)));
      });
      await run;
    },
    [enqueuePersistence, persist],
  );

  const current = useCallback((): LocalStore => storeRef.current, []);
  const runtime = useMemo<LocalStoreRuntime>(
    () => ({ store, isHydrated, update, commit }),
    [commit, isHydrated, store, update],
  );

  return useMemo(
    () => ({ runtime, current, replace, enqueuePersistence }),
    [current, enqueuePersistence, replace, runtime],
  );
}
