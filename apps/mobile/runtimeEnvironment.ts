import Constants from "expo-constants";

import {
  resolveRuntimeEnvironment,
  secureStorageKeyForVariant,
  storageKeyForVariant,
  isStorageKeyInVariant,
  type RuntimeEnvironment,
} from "./environment";

export const RUNTIME_ENVIRONMENT: RuntimeEnvironment = resolveRuntimeEnvironment(
  Constants.expoConfig?.extra,
);

export const IS_FAKE_PROVIDER_MODE = RUNTIME_ENVIRONMENT.providerMode === "fake";

export function scopedStorageKey(key: string): string {
  return storageKeyForVariant(RUNTIME_ENVIRONMENT, key);
}

export function scopedSecureStoreKey(key: string): string {
  return secureStorageKeyForVariant(RUNTIME_ENVIRONMENT, key);
}

export function belongsToActiveStorageNamespace(key: string): boolean {
  return isStorageKeyInVariant(RUNTIME_ENVIRONMENT, key);
}
