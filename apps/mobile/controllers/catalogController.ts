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
  EXERCISE_CATALOG_SOURCE,
  FOOD_CATALOG_DEFINITIONS,
  PERSONAL_FOODS_SOURCE_DEFINITION,
  normalizePersonalFood,
} from "../catalogs/sources";
import type { ExerciseCatalogBrowserMode } from "../catalogs/ExerciseCatalogBrowser";
import {
  createExerciseCatalogService,
  normalizeExerciseCatalogSearch,
  type ExerciseCatalogResult,
  type ExerciseCatalogService,
  type ExerciseCatalogState,
  type ExerciseCatalogSummary,
  type ExerciseSearchCriteria,
} from "../catalogs/exerciseCatalogRuntime";
import {
  linkLegacyExercisesFromFreshCatalog,
  synchronizeLinkedExercises,
} from "../catalogs/migrations";
import type {
  CatalogSearchAvailability,
  CatalogSnapshot,
  ExerciseCatalogEntry,
  FoodCatalogEntry,
} from "../catalogs/types";
import type { LocalStoreRuntime } from "../persistence/localStoreRuntime";
import type { AppPlatformServices } from "../platform";

export type ExerciseCatalogRuntime = {
  entries: ExerciseCatalogEntry[];
  availability: CatalogSearchAvailability;
  state: ExerciseCatalogState;
  catalogSummary: string;
  picker: {
    open: boolean;
    mode: ExerciseCatalogBrowserMode;
    query: string;
    muscleGroup: string;
    muscleGroups: string[];
    results: ExerciseCatalogSummary[];
    result: ExerciseCatalogResult | null;
    loading: boolean;
    loadingMore: boolean;
  };
  actions: {
    openPicker(mode: ExerciseCatalogBrowserMode): void;
    closePicker(): void;
    setQuery(query: string): void;
    setMuscleGroup(muscleGroup: string): void;
    retry(): Promise<void>;
    loadMore(): Promise<void>;
    choose(summary: ExerciseCatalogSummary): Promise<ExerciseCatalogEntry | null>;
    search(criteria: ExerciseSearchCriteria): Promise<ExerciseCatalogEntry[]>;
    resolveIds(ids: string[]): Promise<ExerciseCatalogEntry[]>;
    hasExactName(name: string): Promise<{ exact: boolean; globalCoverage: boolean }>;
    currentAvailability(): CatalogSearchAvailability;
  };
};

export function useExerciseCatalogRuntime(input: {
  isHydrated: boolean;
  localStore: LocalStoreRuntime;
  services: AppPlatformServices;
  getRuntimeGeneration(): number;
  isRuntimeBlocked(): boolean;
  getImageUri(entry: ExerciseCatalogEntry): string;
}): ExerciseCatalogRuntime {
  const [entries, setEntries] = useState<ExerciseCatalogEntry[]>([]);
  const [snapshot, setSnapshot] = useState<CatalogSnapshot<ExerciseCatalogEntry>>(() => ({
    ...EXERCISE_CATALOG_SOURCE,
    availability: "unavailable",
    data: [],
    fetchedAt: null,
    refreshing: false,
    cachePersisted: false,
    warning: null,
  }));
  const [state, setState] = useState<ExerciseCatalogState>({
    availability: "unavailable",
    manifest: null,
    fetchedAt: null,
    warning: null,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<ExerciseCatalogBrowserMode>("select");
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("all");
  const [results, setResults] = useState<ExerciseCatalogSummary[]>([]);
  const [result, setResult] = useState<ExerciseCatalogResult | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;
  const serviceRef = useRef<ExerciseCatalogService | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pickerOpenRef = useRef(pickerOpen);
  pickerOpenRef.current = pickerOpen;
  const queryRevisionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  const getService = useCallback((): ExerciseCatalogService => {
    if (!serviceRef.current) {
      serviceRef.current = createExerciseCatalogService({
        storage: {
          getItem: (key) => inputRef.current.services.storage.getItem(key),
          setItem: async (key, value) => {
            if (inputRef.current.isRuntimeBlocked()) {
              throw new Error("Catalog runtime invalidated.");
            }
            await inputRef.current.services.storage.setItem(key, value);
          },
          removeItem: (key) => inputRef.current.services.storage.removeItem(key),
          getAllKeys: () => inputRef.current.services.storage.getAllKeys(),
        },
        fetcher: (url, init) => inputRef.current.services.network.fetch(url, init),
      });
    }
    return serviceRef.current;
  }, []);

  const applyState = useCallback((next: ExerciseCatalogState, refreshing = false): void => {
    stateRef.current = next;
    setState(next);
    setSnapshot((previous) => ({
      ...previous,
      availability: next.availability,
      fetchedAt: next.fetchedAt,
      refreshing,
      warning: next.warning,
    }));
  }, []);

  const mergeResolved = useCallback((resolved: ExerciseCatalogEntry[], migrateLegacy = false): void => {
    if (resolved.length === 0) return;
    setEntries((previous) => {
      const byKey = new Map(previous.map((entry) => [`${entry.sourceId}:${entry.id}`, entry]));
      for (const entry of resolved) byKey.set(`${entry.sourceId}:${entry.id}`, entry);
      return [...byKey.values()];
    });
    inputRef.current.localStore.update((previous) => {
      const synchronized = synchronizeLinkedExercises(
        previous.templates,
        resolved,
        inputRef.current.getImageUri,
      );
      const migrated = migrateLegacy
        ? linkLegacyExercisesFromFreshCatalog(synchronized.templates, resolved)
        : { templates: synchronized.templates, changed: false };
      return synchronized.changed || migrated.changed
        ? { ...previous, templates: migrated.templates }
        : previous;
    });
  }, []);

  const linkedExerciseIds = useCallback((): string[] => (
    inputRef.current.localStore.store.templates.flatMap((template) => (
      template.exercises.flatMap((exercise) => [
        exercise.catalog_link?.status === "linked" ? exercise.catalog_link.ref.itemId : null,
        ...(exercise.series ?? []).flatMap((series) => (series.sub_series ?? []).map((subSeries) => (
          subSeries.catalog_link?.status === "linked" ? subSeries.catalog_link.ref.itemId : null
        ))),
      ])
    )).filter((id): id is string => !!id)
  ), []);

  const unlinkedExerciseNames = useCallback((): string[] => ([...new Set(
    inputRef.current.localStore.store.templates.flatMap((template) => (
      template.exercises.flatMap((exercise) => [
        exercise.catalog_link?.status === "linked" ? null : exercise.name?.trim() || null,
        ...(exercise.series ?? []).flatMap((series) => (series.sub_series ?? []).map((subSeries) => (
          subSeries.catalog_link?.status === "linked" ? null : subSeries.exercise_name?.trim() || null
        ))),
      ])
    )).filter((name): name is string => !!name),
  )]), []);

  const refreshRoutineLinks = useCallback(async (): Promise<void> => {
    const service = getService();
    const linked = [...(await service.resolveByIds(linkedExerciseIds())).values()];
    const searched = await Promise.all(unlinkedExerciseNames().map(async (name) => {
      const searchResult = await service.search({ query: name, queryFields: ["name"] }, undefined, 15);
      const resolved = await Promise.all(searchResult.items.map((item) => service.getEntry(item)));
      return resolved.filter((entry): entry is ExerciseCatalogEntry => !!entry);
    }));
    mergeResolved([...linked, ...searched.flat()], true);
  }, [getService, linkedExerciseIds, mergeResolved, unlinkedExerciseNames]);

  const currentAvailability = useCallback((): CatalogSearchAvailability => {
    const current = getService().getState();
    return {
      availability: current.availability,
      fetchedAt: current.fetchedAt,
      sources: [{
        sourceId: EXERCISE_CATALOG_SOURCE.sourceId,
        label: EXERCISE_CATALOG_SOURCE.label,
        availability: current.availability,
        fetchedAt: current.fetchedAt,
        refreshing: false,
        cachePersisted: current.warning !== "cache_write_failed",
        warning: current.warning,
      }],
      warnings: current.warning === "remote_failed"
        ? ["Ejercicios: usando la cobertura disponible en el dispositivo."]
        : [],
    };
  }, [getService]);

  const retry = useCallback(async (): Promise<void> => {
    const generation = inputRef.current.getRuntimeGeneration();
    if (pickerOpenRef.current) {
      setReady(false);
      setLoading(true);
    }
    applyState(stateRef.current, true);
    const refreshed = await getService().open();
    if (inputRef.current.getRuntimeGeneration() !== generation) return;
    applyState(refreshed);
    if (pickerOpenRef.current) setReady(true);
  }, [applyState, getService]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!result?.nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const revision = queryRevisionRef.current;
    const cursor = result.nextCursor;
    const signal = abortRef.current?.signal;
    try {
      const criteria = {
        query,
        muscleGroup: muscleGroup === "all" ? "" : muscleGroup,
      };
      const next = query.trim() || muscleGroup !== "all"
        ? await getService().search(criteria, cursor, 30, signal)
        : await getService().browse(cursor, signal);
      if (revision !== queryRevisionRef.current) return;
      setResults((previous) => {
        const seen = new Set(previous.map((item) => `${item.sourceId}:${item.id}`));
        return [...previous, ...next.items.filter((item) => !seen.has(`${item.sourceId}:${item.id}`))];
      });
      setResult(next);
    } catch {
      if (revision === queryRevisionRef.current) {
        setResult((previous) => previous ? { ...previous, warning: "remote_failed" } : previous);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [getService, muscleGroup, query, result]);

  const choose = useCallback(async (summary: ExerciseCatalogSummary): Promise<ExerciseCatalogEntry | null> => {
    const entry = await getService().getEntry(summary);
    if (entry) mergeResolved([entry]);
    return entry;
  }, [getService, mergeResolved]);

  const search = useCallback(async (criteria: ExerciseSearchCriteria): Promise<ExerciseCatalogEntry[]> => {
    const nextState = await getService().open();
    applyState(nextState);
    const searchResult = await getService().search({ ...criteria, queryFields: ["name"] }, undefined, 15);
    const candidates = await Promise.all(searchResult.items.map((item) => getService().getEntry(item)));
    const resolved = candidates.filter((entry): entry is ExerciseCatalogEntry => !!entry);
    mergeResolved(resolved);
    return resolved;
  }, [applyState, getService, mergeResolved]);

  const resolveIds = useCallback(async (ids: string[]): Promise<ExerciseCatalogEntry[]> => {
    const nextState = await getService().open();
    applyState(nextState);
    const resolved = [...(await getService().resolveByIds(ids)).values()];
    mergeResolved(resolved);
    return resolved;
  }, [applyState, getService, mergeResolved]);

  const hasExactName = useCallback(async (name: string): Promise<{ exact: boolean; globalCoverage: boolean }> => {
    const nextState = await getService().open();
    applyState(nextState);
    if (!nextState.manifest) return { exact: false, globalCoverage: false };
    const searchResult = await getService().search({ query: name, queryFields: ["name"] }, undefined, 15);
    const normalizedName = normalizeExerciseCatalogSearch(name);
    return {
      exact: searchResult.items.some(
        (entry) => normalizeExerciseCatalogSearch(entry.name) === normalizedName,
      ),
      globalCoverage: searchResult.globalCoverage,
    };
  }, [applyState, getService]);

  useEffect(() => {
    if (!input.isHydrated || input.isRuntimeBlocked()) return;
    let cancelled = false;
    const generation = input.getRuntimeGeneration();
    void getService().initialize().then(async (cached) => {
      if (cancelled || inputRef.current.getRuntimeGeneration() !== generation) return;
      applyState(cached);
      if (!cached.manifest) return;
      const firstPage = await getService().browse();
      if (cancelled || inputRef.current.getRuntimeGeneration() !== generation) return;
      const firstEntries = await Promise.all(firstPage.items.map((item) => getService().getEntry(item)));
      const linked = [...(await getService().resolveCachedByIds(linkedExerciseIds())).values()];
      mergeResolved([
        ...firstEntries.filter((entry): entry is ExerciseCatalogEntry => !!entry),
        ...linked,
      ], true);
    }).catch((catalogError) => {
      console.error("[Catalogs] exercise runtime failed:", catalogError);
    });
    return () => {
      cancelled = true;
    };
  }, [applyState, getService, input.isHydrated, linkedExerciseIds, mergeResolved]);

  useEffect(() => {
    if (!pickerOpen) {
      abortRef.current?.abort();
      setReady(false);
      return;
    }
    const generation = inputRef.current.getRuntimeGeneration();
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setReady(false);
    void getService().open(controller.signal).then((next) => {
      if (controller.signal.aborted || generation !== inputRef.current.getRuntimeGeneration()) return;
      applyState(next);
      setReady(true);
      void refreshRoutineLinks().catch(() => {});
    }).catch(() => {
      if (!controller.signal.aborted) setReady(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [applyState, getService, pickerOpen, refreshRoutineLinks]);

  useEffect(() => {
    if (!pickerOpen || !ready) return;
    const revision = queryRevisionRef.current + 1;
    queryRevisionRef.current = revision;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setResults([]);
    setResult(null);
    const timer = setTimeout(() => {
      const criteria = {
        query,
        muscleGroup: muscleGroup === "all" ? "" : muscleGroup,
      };
      const operation = query.trim() || muscleGroup !== "all"
        ? getService().search(criteria, undefined, 30, controller.signal)
        : getService().browse(undefined, controller.signal);
      void operation.then((next) => {
        if (controller.signal.aborted || revision !== queryRevisionRef.current) return;
        setResult(next);
        setResults(next.items);
      }).catch(() => {
        if (controller.signal.aborted || revision !== queryRevisionRef.current) return;
        const current = getService().getState();
        setResult({
          availability: current.availability,
          globalCoverage: false,
          cachedResults: false,
          items: [],
          nextCursor: null,
          done: true,
          warning: "remote_failed",
        });
      }).finally(() => {
        if (!controller.signal.aborted && revision === queryRevisionRef.current) setLoading(false);
      });
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [getService, muscleGroup, pickerOpen, query, ready]);

  const availability = useMemo<CatalogSearchAvailability>(() => ({
    availability: snapshot.availability,
    fetchedAt: snapshot.fetchedAt,
    sources: catalogStatuses([snapshot]),
    warnings: catalogWarnings([snapshot]),
  }), [snapshot]);
  const muscleGroups = useMemo(
    () => state.manifest?.muscleGroups.map((group) => group.value) ?? [],
    [state.manifest],
  );
  const catalogSummary = state.manifest
    ? `${state.manifest.itemCount.toLocaleString("es-ES")} ejercicios · ${state.manifest.pageSize} por página`
    : "Abre el catálogo para descargar su índice y consultar los ejercicios disponibles.";
  const openPicker = useCallback((mode: ExerciseCatalogBrowserMode) => {
    setQuery("");
    setMuscleGroup("all");
    setPickerMode(mode);
    setReady(false);
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const actions = useMemo(() => ({
    openPicker,
    closePicker,
    setQuery,
    setMuscleGroup,
    retry,
    loadMore,
    choose,
    search,
    resolveIds,
    hasExactName,
    currentAvailability,
  }), [
    choose,
    closePicker,
    currentAvailability,
    hasExactName,
    loadMore,
    openPicker,
    resolveIds,
    retry,
    search,
  ]);
  const picker = useMemo(() => ({
    open: pickerOpen,
    mode: pickerMode,
    query,
    muscleGroup,
    muscleGroups,
    results,
    result,
    loading,
    loadingMore,
  }), [
    loading,
    loadingMore,
    muscleGroup,
    muscleGroups,
    pickerMode,
    pickerOpen,
    query,
    result,
    results,
  ]);

  return useMemo(() => ({
    entries,
    availability,
    state,
    catalogSummary,
    picker,
    actions,
  }), [actions, availability, catalogSummary, entries, picker, state]);
}

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
