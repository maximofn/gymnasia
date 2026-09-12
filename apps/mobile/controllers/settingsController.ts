import { useMemo, useRef } from "react";

import type { NotificationSoundKey } from "../notifications/notificationSounds";
import type { NotificationSettings } from "../storage/userPreferences";
import type { ScreenController } from "./types";

export type SettingsTabKey =
  | "diet"
  | "provider"
  | "memory"
  | "training"
  | "foods"
  | "products"
  | "personalFoods"
  | "measures"
  | "preferences"
  | "notifications"
  | "data"
  | "traces";

export const SETTINGS_TAB_OPTIONS: ReadonlyArray<{
  key: SettingsTabKey;
  label: string;
}> = [
  { key: "diet", label: "Dieta" },
  { key: "provider", label: "Proveedor IA" },
  { key: "memory", label: "Memoria" },
  { key: "training", label: "Entreno" },
  { key: "foods", label: "Alimentos" },
  { key: "products", label: "Productos comerciales" },
  { key: "personalFoods", label: "Alimentos personales" },
  { key: "measures", label: "Medidas" },
  { key: "preferences", label: "Preferencias" },
  { key: "notifications", label: "Notificaciones" },
  { key: "data", label: "Datos" },
  { key: "traces", label: "Trazas" },
];

export type SettingsTabsModel = {
  activeTab: SettingsTabKey;
};

export type SettingsTabsActions = {
  selectTab(tab: SettingsTabKey): void;
};

export type SettingsTabsControllerInput = {
  activeTab: SettingsTabKey;
  selectTab(tab: SettingsTabKey): void;
};

export function useSettingsTabsController(
  input: SettingsTabsControllerInput,
): ScreenController<SettingsTabsModel, SettingsTabsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;

  const model = useMemo<SettingsTabsModel>(
    () => ({ activeTab: input.activeTab }),
    [input.activeTab],
  );
  const actions = useMemo<SettingsTabsActions>(
    () => ({ selectTab: (tab) => inputRef.current.selectTab(tab) }),
    [],
  );
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);

  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type AlarmPunctuality = {
  status: "unknown" | "ontime" | "late";
  badge: string;
  detail: string;
};

export type NotificationSettingsModel = {
  isAndroid: boolean;
  alarmPunctuality: AlarmPunctuality;
  showBatteryGuidance: boolean;
  batteryGuidance: { brand: string; path: string } | null;
  permissionGranted: boolean | null;
  restChannelImportance: number | null;
  settings: NotificationSettings;
  soundOptions: ReadonlyArray<{ key: NotificationSoundKey; label: string }>;
};

export type NotificationSettingsActions = {
  openExactAlarmSettings(): void;
  openApplicationSettings(): void;
  toggleEnabled(): void;
  toggleSound(): void;
  toggleVibration(): void;
  selectSound(sound: NotificationSoundKey): void;
};

export type NotificationSettingsControllerInput = NotificationSettingsModel & NotificationSettingsActions;

export function useNotificationSettingsController(
  input: NotificationSettingsControllerInput,
): ScreenController<NotificationSettingsModel, NotificationSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<NotificationSettingsModel>(() => ({
    isAndroid: input.isAndroid,
    alarmPunctuality: input.alarmPunctuality,
    showBatteryGuidance: input.showBatteryGuidance,
    batteryGuidance: input.batteryGuidance,
    permissionGranted: input.permissionGranted,
    restChannelImportance: input.restChannelImportance,
    settings: input.settings,
    soundOptions: input.soundOptions,
  }), [
    input.alarmPunctuality,
    input.batteryGuidance,
    input.isAndroid,
    input.permissionGranted,
    input.restChannelImportance,
    input.settings,
    input.showBatteryGuidance,
    input.soundOptions,
  ]);
  const actions = useMemo<NotificationSettingsActions>(() => ({
    openExactAlarmSettings: () => inputRef.current.openExactAlarmSettings(),
    openApplicationSettings: () => inputRef.current.openApplicationSettings(),
    toggleEnabled: () => inputRef.current.toggleEnabled(),
    toggleSound: () => inputRef.current.toggleSound(),
    toggleVibration: () => inputRef.current.toggleVibration(),
    selectSound: (sound) => inputRef.current.selectSound(sound),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}

export type DataDeletionScope = "activity" | "all-personal";

export type DataSettingsModel = {
  lastBackupLabel: string;
  backupBusy: "export" | "import" | null;
  backupResult: {
    status: "ok" | "warning" | "error";
    message: string;
    details: ReadonlyArray<string>;
    remainingDetailCount: number;
  } | null;
  deletionReport: {
    status: "complete" | "incomplete";
    scope: DataDeletionScope;
    failures: ReadonlyArray<{ id: string; label: string; message: string }>;
  } | null;
  deletionBusy: boolean;
  deletionBlocked: boolean;
};

export type DataSettingsActions = {
  exportBackup(): void;
  importBackup(): void;
  openBackupPolicy(): void;
  retryDeletion(scope: DataDeletionScope): void;
  openDeletion(scope: DataDeletionScope): void;
  openDeletionPolicy(): void;
};

export type DataSettingsControllerInput = DataSettingsModel & DataSettingsActions;

export function useDataSettingsController(
  input: DataSettingsControllerInput,
): ScreenController<DataSettingsModel, DataSettingsActions> {
  const inputRef = useRef(input);
  inputRef.current = input;
  const model = useMemo<DataSettingsModel>(() => ({
    lastBackupLabel: input.lastBackupLabel,
    backupBusy: input.backupBusy,
    backupResult: input.backupResult,
    deletionReport: input.deletionReport,
    deletionBusy: input.deletionBusy,
    deletionBlocked: input.deletionBlocked,
  }), [
    input.backupBusy,
    input.backupResult,
    input.deletionBlocked,
    input.deletionBusy,
    input.deletionReport,
    input.lastBackupLabel,
  ]);
  const actions = useMemo<DataSettingsActions>(() => ({
    exportBackup: () => inputRef.current.exportBackup(),
    importBackup: () => inputRef.current.importBackup(),
    openBackupPolicy: () => inputRef.current.openBackupPolicy(),
    retryDeletion: (scope) => inputRef.current.retryDeletion(scope),
    openDeletion: (scope) => inputRef.current.openDeletion(scope),
    openDeletionPolicy: () => inputRef.current.openDeletionPolicy(),
  }), []);
  const back = useMemo(() => ({ layers: {}, handlers: {} }), []);
  return useMemo(() => ({ model, actions, back }), [actions, back, model]);
}
