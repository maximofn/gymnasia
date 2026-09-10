export const DESKTOP_WEB_MIN_WIDTH = 960;

export const TAB_DESTINATIONS = [
  {
    key: "home",
    label: "Home",
    compactLabel: "Home",
    desktopIcon: "home-outline",
    compactIcon: null,
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-home",
    desktopTestId: "desktop-nav-home",
  },
  {
    key: "training",
    label: "Rutinas",
    compactLabel: "Rutinas",
    desktopIcon: "barbell-outline",
    compactIcon: null,
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-training",
    desktopTestId: "desktop-nav-training",
  },
  {
    key: "diet",
    label: "Dieta",
    compactLabel: "Dieta",
    desktopIcon: "restaurant-outline",
    compactIcon: null,
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-diet",
    desktopTestId: "desktop-nav-diet",
  },
  {
    key: "measures",
    label: "Medidas",
    compactLabel: "Medidas",
    desktopIcon: "body-outline",
    compactIcon: null,
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-measures",
    desktopTestId: "desktop-nav-measures",
  },
  {
    key: "chat",
    label: "Gymnasia Coach",
    compactLabel: "Coach",
    desktopIcon: "chatbubble-ellipses-outline",
    compactIcon: null,
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-chat",
    desktopTestId: "desktop-nav-chat",
  },
  {
    key: "settings",
    label: "Configuración",
    compactLabel: "Configuración",
    desktopIcon: "settings-outline",
    compactIcon: "settings-sharp",
    layouts: ["compact", "desktop"],
    compactTestId: "nav-tab-settings",
    desktopTestId: "desktop-nav-settings",
  },
] as const;

export type TabDestination = (typeof TAB_DESTINATIONS)[number];
export type TabKey = TabDestination["key"];

export function tabDestination(tab: TabKey): TabDestination {
  const destination = TAB_DESTINATIONS.find((candidate) => candidate.key === tab);
  if (!destination) throw new Error(`Destino de navegación no registrado: ${tab}`);
  return destination;
}

export function tabLabel(tab: TabKey): string {
  return tabDestination(tab).label;
}

export function compactTabLabel(tab: TabKey): string {
  return tabDestination(tab).compactLabel;
}

export function usesDesktopNavigation(platform: string, viewportWidth: number): boolean {
  return platform === "web" && viewportWidth >= DESKTOP_WEB_MIN_WIDTH;
}

export type ShellSurfaceScope =
  | "shell-layer"
  | "nested-route"
  | "context-menu"
  | "native-modal"
  | "startup";

export type ShellBackOwner = "back-handler" | "native" | "system";

export type ShellBackBehavior =
  | "dismiss"
  | "dismiss-confirmation"
  | "dismiss-unless-busy"
  | "collapse"
  | "navigate-back"
  | "delegate";

type BackHandlerSurface = {
  id: string;
  scope: Exclude<ShellSurfaceScope, "native-modal" | "startup">;
  priority: number;
  testId: string;
  owner: "back-handler";
  backBehavior: Exclude<ShellBackBehavior, "delegate">;
};

type NativeOrSystemSurface = {
  id: string;
  scope: "native-modal" | "startup";
  priority: 0;
  testId: string;
  owner: "native" | "system";
  backBehavior: "delegate" | "dismiss-unless-busy";
};

// The array order is the Android Back order. Priorities are intentionally
// explicit and unique so a review can compare policy and rendered layers.
export const SHELL_BACK_LAYERS = [
  { id: "training-template-conflict", scope: "shell-layer", priority: 470, testId: "training-editor-conflict-modal", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-template-discard", scope: "shell-layer", priority: 460, testId: "training-editor-discard-modal", owner: "back-handler", backBehavior: "dismiss" },
  { id: "backup-import-confirmation", scope: "shell-layer", priority: 450, testId: "shell-layer-backup-import-confirmation", owner: "back-handler", backBehavior: "dismiss" },
  { id: "data-deletion", scope: "shell-layer", priority: 440, testId: "shell-layer-data-deletion", owner: "back-handler", backBehavior: "dismiss-unless-busy" },
  { id: "training-partial-finish", scope: "shell-layer", priority: 430, testId: "training-partial-finish-modal", owner: "back-handler", backBehavior: "dismiss" },
  { id: "workout-completion", scope: "shell-layer", priority: 420, testId: "shell-layer-workout-completion", owner: "back-handler", backBehavior: "dismiss" },
  { id: "workout-discard-confirmation", scope: "nested-route", priority: 410, testId: "training-session-discard", owner: "back-handler", backBehavior: "dismiss-confirmation" },
  { id: "food-catalog-ambiguity", scope: "shell-layer", priority: 400, testId: "food-catalog-ambiguity-modal", owner: "back-handler", backBehavior: "dismiss" },
  { id: "food-estimator", scope: "shell-layer", priority: 390, testId: "shell-layer-food-estimator", owner: "back-handler", backBehavior: "dismiss" },
  { id: "body-fat-info", scope: "shell-layer", priority: 380, testId: "shell-layer-body-fat-info", owner: "back-handler", backBehavior: "dismiss" },
  { id: "custom-exercise-form", scope: "shell-layer", priority: 370, testId: "shell-layer-custom-exercise-form", owner: "back-handler", backBehavior: "dismiss" },
  { id: "exercise-catalog-detail", scope: "shell-layer", priority: 360, testId: "shell-layer-exercise-catalog-detail", owner: "back-handler", backBehavior: "dismiss" },
  { id: "exercise-picker", scope: "shell-layer", priority: 350, testId: "exercise-catalog-browser", owner: "back-handler", backBehavior: "dismiss" },
  { id: "personal-food-ai-chat", scope: "shell-layer", priority: 340, testId: "shell-layer-personal-food-ai-chat", owner: "back-handler", backBehavior: "dismiss" },
  { id: "personal-food-form", scope: "nested-route", priority: 330, testId: "shell-layer-personal-food-form", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measurement-photo", scope: "shell-layer", priority: 320, testId: "shell-layer-measurement-photo", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measurement-entry", scope: "nested-route", priority: 310, testId: "shell-layer-measurement-entry", owner: "back-handler", backBehavior: "navigate-back" },
  { id: "byok-explanation", scope: "nested-route", priority: 300, testId: "shell-layer-byok-explanation", owner: "back-handler", backBehavior: "collapse" },
  { id: "provider-delete", scope: "shell-layer", priority: 290, testId: "shell-layer-provider-delete", owner: "back-handler", backBehavior: "dismiss" },
  { id: "diet-copy-confirmation", scope: "shell-layer", priority: 280, testId: "shell-layer-diet-copy-confirmation", owner: "back-handler", backBehavior: "dismiss" },
  { id: "diet-copy-date-picker", scope: "shell-layer", priority: 270, testId: "shell-layer-diet-copy-date-picker", owner: "back-handler", backBehavior: "dismiss" },
  { id: "diet-date-picker", scope: "shell-layer", priority: 260, testId: "shell-layer-diet-date-picker", owner: "back-handler", backBehavior: "dismiss" },
  { id: "birth-date-picker", scope: "shell-layer", priority: 250, testId: "shell-layer-birth-date-picker", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measurement-date-picker", scope: "shell-layer", priority: 240, testId: "measurement-date-input", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measurements-history-expanded", scope: "nested-route", priority: 230, testId: "measurement-history-toggle", owner: "back-handler", backBehavior: "collapse" },
  { id: "training-history-expanded", scope: "nested-route", priority: 220, testId: "training-history-toggle", owner: "back-handler", backBehavior: "collapse" },
  { id: "workout-history-detail", scope: "nested-route", priority: 210, testId: "training-history-detail", owner: "back-handler", backBehavior: "navigate-back" },
  { id: "training-history", scope: "nested-route", priority: 200, testId: "training-global-history", owner: "back-handler", backBehavior: "navigate-back" },
  { id: "training-exercise-menu", scope: "context-menu", priority: 190, testId: "shell-layer-training-exercise-menu", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-series-menu", scope: "context-menu", priority: 180, testId: "shell-layer-training-series-menu", owner: "back-handler", backBehavior: "dismiss" },
  { id: "series-type-picker", scope: "shell-layer", priority: 170, testId: "shell-layer-series-type-picker", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-exercise-detail", scope: "nested-route", priority: 160, testId: "shell-layer-training-exercise-detail", owner: "back-handler", backBehavior: "navigate-back" },
  { id: "chat-provider-dropdown", scope: "context-menu", priority: 150, testId: "shell-layer-chat-provider-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "food-provider-dropdown", scope: "context-menu", priority: 140, testId: "shell-layer-food-provider-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "anthropic-model-dropdown", scope: "context-menu", priority: 130, testId: "shell-layer-anthropic-model-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "openai-model-dropdown", scope: "context-menu", priority: 120, testId: "shell-layer-openai-model-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "google-model-dropdown", scope: "context-menu", priority: 110, testId: "shell-layer-google-model-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measures-period-dropdown", scope: "context-menu", priority: 100, testId: "shell-layer-measures-period-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "measures-metric-dropdown", scope: "context-menu", priority: 90, testId: "shell-layer-measures-metric-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-period-dropdown", scope: "context-menu", priority: 80, testId: "shell-layer-training-period-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-metric-dropdown", scope: "context-menu", priority: 70, testId: "shell-layer-training-metric-dropdown", owner: "back-handler", backBehavior: "dismiss" },
  { id: "diet-item-menu", scope: "context-menu", priority: 60, testId: "shell-layer-diet-item-menu", owner: "back-handler", backBehavior: "dismiss" },
  { id: "training-template-menu", scope: "context-menu", priority: 50, testId: "shell-layer-training-template-menu", owner: "back-handler", backBehavior: "dismiss" },
  { id: "settings-food-detail", scope: "nested-route", priority: 40, testId: "shell-layer-settings-food-detail", owner: "back-handler", backBehavior: "collapse" },
  { id: "settings-product-detail", scope: "nested-route", priority: 30, testId: "shell-layer-settings-product-detail", owner: "back-handler", backBehavior: "collapse" },
  { id: "settings-personal-food-detail", scope: "nested-route", priority: 20, testId: "shell-layer-settings-personal-food-detail", owner: "back-handler", backBehavior: "collapse" },
  { id: "diet-meal-editor", scope: "nested-route", priority: 10, testId: "shell-layer-diet-meal-editor", owner: "back-handler", backBehavior: "navigate-back" },
] as const satisfies readonly BackHandlerSurface[];

export const SYSTEM_OWNED_SHELL_SURFACES = [
  { id: "ai-response-report", scope: "native-modal", priority: 0, testId: "ai-report-modal", owner: "native", backBehavior: "dismiss-unless-busy" },
  { id: "local-store-recovery-discard", scope: "native-modal", priority: 0, testId: "local-store-recovery-discard-confirmation", owner: "native", backBehavior: "dismiss-unless-busy" },
  { id: "local-store-recovery", scope: "startup", priority: 0, testId: "local-store-recovery-screen", owner: "system", backBehavior: "delegate" },
  { id: "local-store-startup-failure", scope: "startup", priority: 0, testId: "local-store-startup-failure-screen", owner: "system", backBehavior: "delegate" },
] as const satisfies readonly NativeOrSystemSurface[];

export const SHELL_SURFACES = [
  ...SHELL_BACK_LAYERS,
  ...SYSTEM_OWNED_SHELL_SURFACES,
] as const;

export type ShellSurface = (typeof SHELL_SURFACES)[number];
export type ShellSurfaceId = ShellSurface["id"];
export type ShellLayerId = (typeof SHELL_BACK_LAYERS)[number]["id"];
export type ShellLayerState = Record<ShellLayerId, boolean>;

export const SHELL_BACK_LAYER_IDS = SHELL_BACK_LAYERS.map((surface) => surface.id) as readonly ShellLayerId[];

export function shellSurfaceTestId(id: ShellSurfaceId): string {
  const surface = SHELL_SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`Superficie del shell no registrada: ${id}`);
  return surface.testId;
}

export type ShellTemplateRoute = "closed" | "detail" | "edit-clean" | "edit-dirty";

export type ShellFallbackCommand =
  | "request-template-discard"
  | "close-training-template"
  | "request-workout-discard"
  | "go-home"
  | "delegate-system";

export type ShellBackCommand = ShellLayerId | ShellFallbackCommand;

export type ShellBackState = {
  layers: ShellLayerState;
  trainingTemplateRoute: ShellTemplateRoute;
  hasActiveWorkoutSession: boolean;
  tab: TabKey;
};

export type ShellBackResolution = {
  command: ShellBackCommand;
  handled: boolean;
  layerId: ShellLayerId | null;
};

export function resolveShellBackCommand(state: ShellBackState): ShellBackResolution {
  for (const surface of SHELL_BACK_LAYERS) {
    if (state.layers[surface.id]) {
      return { command: surface.id, handled: true, layerId: surface.id };
    }
  }
  if (state.trainingTemplateRoute === "edit-dirty") {
    return { command: "request-template-discard", handled: true, layerId: null };
  }
  if (state.trainingTemplateRoute !== "closed") {
    return { command: "close-training-template", handled: true, layerId: null };
  }
  if (state.hasActiveWorkoutSession) {
    return { command: "request-workout-discard", handled: true, layerId: null };
  }
  if (state.tab !== "home") {
    return { command: "go-home", handled: true, layerId: null };
  }
  return { command: "delegate-system", handled: false, layerId: null };
}

export type ShellBackCallbackRef = { current: () => boolean };

export function createHardwareBackPressCallback(ref: ShellBackCallbackRef): () => boolean {
  return () => ref.current();
}
