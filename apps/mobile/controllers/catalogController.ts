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
import { FOOD_CATALOG_DEFINITIONS } from "../catalogs/sources";
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
