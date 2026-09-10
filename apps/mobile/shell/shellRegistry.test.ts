import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DESKTOP_WEB_MIN_WIDTH,
  SHELL_BACK_LAYERS,
  SHELL_BACK_LAYER_IDS,
  SHELL_SURFACES,
  SYSTEM_OWNED_SHELL_SURFACES,
  TAB_DESTINATIONS,
  createHardwareBackPressCallback,
  resolveShellBackCommand,
  tabDestination,
  usesDesktopNavigation,
  type ShellLayerId,
  type ShellLayerState,
  type ShellTemplateRoute,
  type TabKey,
} from "./shellRegistry";

function layerState(active: readonly ShellLayerId[] = []): ShellLayerState {
  const activeIds = new Set(active);
  return Object.fromEntries(
    SHELL_BACK_LAYER_IDS.map((id) => [id, activeIds.has(id)]),
  ) as ShellLayerState;
}

function resolveFallback(
  trainingTemplateRoute: ShellTemplateRoute,
  hasActiveWorkoutSession: boolean,
  tab: TabKey,
) {
  return resolveShellBackCommand({
    layers: layerState(),
    trainingTemplateRoute,
    hasActiveWorkoutSession,
    tab,
  });
}

describe("registro de navegación", () => {
  it("declara una sola vez los seis destinos y sus contratos visuales", () => {
    expect(TAB_DESTINATIONS.map((destination) => destination.key)).toEqual([
      "home",
      "training",
      "diet",
      "measures",
      "chat",
      "settings",
    ]);
    expect(new Set(TAB_DESTINATIONS.map((destination) => destination.compactTestId)).size).toBe(6);
    expect(new Set(TAB_DESTINATIONS.map((destination) => destination.desktopTestId)).size).toBe(6);
    expect(tabDestination("chat").compactLabel).toBe("Coach");
    expect(tabDestination("chat").label).toBe("Gymnasia Coach");
  });

  it("reserva la navegación de escritorio para web desde 960 px", () => {
    expect(DESKTOP_WEB_MIN_WIDTH).toBe(960);
    expect(usesDesktopNavigation("web", 959)).toBe(false);
    expect(usesDesktopNavigation("web", 960)).toBe(true);
    expect(usesDesktopNavigation("android", 1600)).toBe(false);
    expect(usesDesktopNavigation("ios", 1600)).toBe(false);
  });
});

describe("registro de superficies", () => {
  it("mantiene prioridades globales únicas, descendentes y test IDs únicos", () => {
    const priorities = SHELL_BACK_LAYERS.map((surface) => surface.priority);
    expect(priorities).toEqual(Array.from({ length: SHELL_BACK_LAYERS.length }, (_, index) => 470 - index * 10));
    expect(SHELL_BACK_LAYER_IDS).toEqual([
      "training-template-conflict",
      "training-template-discard",
      "backup-import-confirmation",
      "data-deletion",
      "training-partial-finish",
      "workout-completion",
      "workout-discard-confirmation",
      "food-catalog-ambiguity",
      "food-estimator",
      "body-fat-info",
      "custom-exercise-form",
      "exercise-catalog-detail",
      "exercise-picker",
      "personal-food-ai-chat",
      "personal-food-form",
      "measurement-photo",
      "measurement-entry",
      "byok-explanation",
      "provider-delete",
      "diet-copy-confirmation",
      "diet-copy-date-picker",
      "diet-date-picker",
      "birth-date-picker",
      "measurement-date-picker",
      "measurements-history-expanded",
      "training-history-expanded",
      "workout-history-detail",
      "training-history",
      "training-exercise-menu",
      "training-series-menu",
      "series-type-picker",
      "training-exercise-detail",
      "chat-provider-dropdown",
      "food-provider-dropdown",
      "anthropic-model-dropdown",
      "openai-model-dropdown",
      "google-model-dropdown",
      "measures-period-dropdown",
      "measures-metric-dropdown",
      "training-period-dropdown",
      "training-metric-dropdown",
      "diet-item-menu",
      "training-template-menu",
      "settings-food-detail",
      "settings-product-detail",
      "settings-personal-food-detail",
      "diet-meal-editor",
    ]);
    expect(new Set(priorities).size).toBe(priorities.length);
    expect(new Set(SHELL_SURFACES.map((surface) => surface.id)).size).toBe(SHELL_SURFACES.length);
    expect(new Set(SHELL_SURFACES.map((surface) => surface.testId)).size).toBe(SHELL_SURFACES.length);
  });

  it("deja los Modal nativos y las pantallas de arranque fuera del BackHandler", () => {
    const globalIds = new Set<string>(SHELL_BACK_LAYER_IDS);
    expect(SYSTEM_OWNED_SHELL_SURFACES.every((surface) => !globalIds.has(surface.id))).toBe(true);
    expect(SYSTEM_OWNED_SHELL_SURFACES.map((surface) => surface.owner)).toEqual([
      "native",
      "native",
      "system",
      "system",
    ]);
  });

  it("elige la capa activa de mayor prioridad", () => {
    const result = resolveShellBackCommand({
      layers: layerState(["diet-item-menu", "backup-import-confirmation", "exercise-picker"]),
      trainingTemplateRoute: "edit-dirty",
      hasActiveWorkoutSession: true,
      tab: "settings",
    });
    expect(result).toEqual({
      command: "backup-import-confirmation",
      handled: true,
      layerId: "backup-import-confirmation",
    });
  });

  it("cierra el detalle del catálogo antes que su navegador subyacente", () => {
    expect(resolveShellBackCommand({
      layers: layerState(["exercise-catalog-detail", "exercise-picker"]),
      trainingTemplateRoute: "closed",
      hasActiveWorkoutSession: false,
      tab: "settings",
    }).command).toBe("exercise-catalog-detail");
  });

  it("resuelve individualmente cada orden de capa registrada", () => {
    for (const surface of SHELL_BACK_LAYERS) {
      expect(resolveShellBackCommand({
        layers: layerState([surface.id]),
        trainingTemplateRoute: "closed",
        hasActiveWorkoutSession: false,
        tab: "home",
      })).toEqual({
        command: surface.id,
        handled: true,
        layerId: surface.id,
      });
    }
  });

  it("aplica las transiciones de plantilla, sesión, pestaña y sistema", () => {
    expect(resolveFallback("edit-dirty", true, "settings").command).toBe("request-template-discard");
    expect(resolveFallback("edit-clean", true, "settings").command).toBe("close-training-template");
    expect(resolveFallback("detail", true, "settings").command).toBe("close-training-template");
    expect(resolveFallback("closed", true, "settings").command).toBe("request-workout-discard");
    expect(resolveFallback("closed", false, "settings").command).toBe("go-home");
    expect(resolveFallback("closed", false, "home")).toEqual({
      command: "delegate-system",
      handled: false,
      layerId: null,
    });
  });

  it("resuelve cualquier combinación a una sola capa de forma determinista", () => {
    fc.assert(fc.property(
      fc.array(fc.boolean(), { minLength: SHELL_BACK_LAYER_IDS.length, maxLength: SHELL_BACK_LAYER_IDS.length }),
      (flags) => {
        const entries = SHELL_BACK_LAYER_IDS.map((id, index) => [id, flags[index]] as const);
        const forward = Object.fromEntries(entries) as ShellLayerState;
        const reverse = Object.fromEntries([...entries].reverse()) as ShellLayerState;
        const expected = SHELL_BACK_LAYERS.find((surface) => forward[surface.id])?.id ?? null;
        const first = resolveShellBackCommand({
          layers: forward,
          trainingTemplateRoute: "closed",
          hasActiveWorkoutSession: false,
          tab: "home",
        });
        const second = resolveShellBackCommand({
          layers: reverse,
          trainingTemplateRoute: "closed",
          hasActiveWorkoutSession: false,
          tab: "home",
        });
        expect(first).toEqual(second);
        expect(first.layerId).toBe(expected);
        expect(first.command).toBe(expected ?? "delegate-system");
      },
    ));
  });

  it("respeta la secuencia de fallback para cualquier estado sin capas activas", () => {
    fc.assert(fc.property(
      fc.constantFrom<ShellTemplateRoute>("closed", "detail", "edit-clean", "edit-dirty"),
      fc.boolean(),
      fc.constantFrom<TabKey>("home", "training", "diet", "measures", "chat", "settings"),
      (trainingTemplateRoute, hasActiveWorkoutSession, tab) => {
        const result = resolveFallback(trainingTemplateRoute, hasActiveWorkoutSession, tab);
        const expected = trainingTemplateRoute === "edit-dirty"
          ? "request-template-discard"
          : trainingTemplateRoute !== "closed"
            ? "close-training-template"
            : hasActiveWorkoutSession
              ? "request-workout-discard"
              : tab !== "home"
                ? "go-home"
                : "delegate-system";
        expect(result.command).toBe(expected);
        expect(result.handled).toBe(expected !== "delegate-system");
      },
    ));
  });
});

describe("callback estable de Android", () => {
  it("consulta el valor más reciente del ref sin cambiar de función", () => {
    const ref = { current: () => true };
    const callback = createHardwareBackPressCallback(ref);
    expect(callback()).toBe(true);
    ref.current = () => false;
    expect(callback()).toBe(false);
  });
});
