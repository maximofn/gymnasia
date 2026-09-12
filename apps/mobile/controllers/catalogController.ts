import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  aggregateCatalogAvailability,
  catalogStatuses,
  catalogWarnings,
  initialCatalogSnapshot,
  latestCatalogFetch,
  readCatalogCache,
  refreshCatalog,
} from "../catalogs/runtime";
import {
  FOOD_CATALOG_DEFINITIONS,
  PERSONAL_FOODS_SOURCE_DEFINITION,
  normalizePersonalFood,
} from "../catalogs/sources";
import type {
  CatalogSearchAvailability,
  CatalogSnapshot,
  FoodCatalogEntry,
} from "../catalogs/types";
import type { AppPlatformServices } from "../platform";

export function useFoodCatalogRuntime(input: {
  isHydrated: boolean;
  services: AppPlatformServices;
  getRuntimeGeneration(): number;
  isRuntimeBlocked(): boolean;
}): {
  foods: FoodCatalogEntry[];
  availability: CatalogSearchAvailability;
  retry(): Promise<void>;
} {
  const [snapshots, setSnapshots] = useState<Array<CatalogSnapshot<FoodCatalogEntry>>>(
    () => FOOD_CATALOG_DEFINITIONS.map((definition) => initialCatalogSnapshot(definition)),
  );
  const inputRef = useRef(input);
  inputRef.current = input;
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  const runtimeDependencies = useCallback((generation: number) => ({
    storage: {
      getItem: (key: string) => inputRef.current.services.storage.getItem(key),
      setItem: async (key: string, value: string) => {
        if (
          inputRef.current.isRuntimeBlocked()
          || inputRef.current.getRuntimeGeneration() !== generation
        ) {
          throw new Error("Catalog runtime invalidated.");
        }
        await inputRef.current.services.storage.setItem(key, value);
      },
    },
    fetcher: (url: string) => inputRef.current.services.network.fetch(url),
  }), []);

  const retry = useCallback(async () => {
    const generation = inputRef.current.getRuntimeGeneration();
    const pending = snapshotsRef.current.map((snapshot) => ({ ...snapshot, refreshing: true }));
    setSnapshots(pending);
    const refreshed = await Promise.all(FOOD_CATALOG_DEFINITIONS.map((definition, index) => (
      refreshCatalog(definition, pending[index], runtimeDependencies(generation))
    )));
    if (inputRef.current.getRuntimeGeneration() !== generation) return;
    setSnapshots(refreshed);
  }, [runtimeDependencies]);

  useEffect(() => {
    if (!input.isHydrated || input.isRuntimeBlocked()) return;
    let cancelled = false;
    const generation = input.getRuntimeGeneration();
    const dependencies = runtimeDependencies(generation);
    void Promise.all(FOOD_CATALOG_DEFINITIONS.map((definition) => (
      readCatalogCache(definition, dependencies)
    ))).then(async (cached) => {
      if (cancelled || inputRef.current.getRuntimeGeneration() !== generation) return;
      const pending = cached.map((snapshot) => ({ ...snapshot, refreshing: true }));
      setSnapshots(pending);
      const refreshed = await Promise.all(FOOD_CATALOG_DEFINITIONS.map((definition, index) => (
        refreshCatalog(definition, pending[index], dependencies)
      )));
      if (cancelled || inputRef.current.getRuntimeGeneration() !== generation) return;
      setSnapshots(refreshed);
    }).catch((catalogError) => {
      console.error("[Catalogs] nutrition runtime failed:", catalogError);
    });
    return () => {
      cancelled = true;
    };
  }, [input.isHydrated, runtimeDependencies]);

  const foods = useMemo(
    () => snapshots.flatMap((snapshot) => snapshot.data),
    [snapshots],
  );
  const availability = useMemo<CatalogSearchAvailability>(() => ({
    availability: aggregateCatalogAvailability(snapshots),
    fetchedAt: latestCatalogFetch(snapshots),
    sources: [
      ...catalogStatuses(snapshots),
      {
        sourceId: "user_personal_foods",
        label: "Alimentos personales",
        availability: "cached",
        fetchedAt: null,
        refreshing: false,
        cachePersisted: true,
        warning: null,
      },
    ],
    warnings: catalogWarnings(snapshots),
  }), [snapshots]);

  return useMemo(() => ({ foods, availability, retry }), [availability, foods, retry]);
}

export function usePersonalFoodsRuntime(input: {
  isHydrated: boolean;
  services: AppPlatformServices;
  isRuntimeBlocked(): boolean;
}): {
  foods: FoodCatalogEntry[];
  update(updater: (previous: FoodCatalogEntry[]) => FoodCatalogEntry[]): void;
  replace(foods: FoodCatalogEntry[]): void;
} {
  const [foods, setFoods] = useState<FoodCatalogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!input.isHydrated || input.isRuntimeBlocked()) return;
    let cancelled = false;
    void input.services.storage.getItem(PERSONAL_FOODS_SOURCE_DEFINITION.cacheKey)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setFoods([]);
          setHydrated(true);
          return;
        }
        const value: unknown = JSON.parse(raw);
        const loaded = Array.isArray(value)
          ? value.flatMap((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
              const {
                sourceId: _sourceId,
                source: _source,
                ...rawEntry
              } = entry as Record<string, unknown>;
              return normalizePersonalFood(rawEntry as unknown as FoodCatalogEntry);
            })
          : [];
        setFoods(loaded);
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFoods([]);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [input.isHydrated, input.services.storage]);

  useEffect(() => {
    if (!input.isHydrated || !hydrated || input.isRuntimeBlocked()) return;
    input.services.storage.setItem(
      PERSONAL_FOODS_SOURCE_DEFINITION.cacheKey,
      JSON.stringify(foods),
    ).catch(() => {});
  }, [foods, hydrated, input.isHydrated, input.services.storage]);

  const update = useCallback(
    (updater: (previous: FoodCatalogEntry[]) => FoodCatalogEntry[]) => setFoods(updater),
    [],
  );
  const replace = useCallback((nextFoods: FoodCatalogEntry[]) => setFoods(nextFoods), []);
  return useMemo(() => ({ foods, update, replace }), [foods, replace, update]);
}
