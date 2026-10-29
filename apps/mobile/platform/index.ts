import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as IntentLauncher from "expo-intent-launcher";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  Vibration,
} from "react-native";
import { createPlatformFetch } from "./network";
import { CATALOG_CACHE_DIRECTORY, type CatalogArtifactStorage } from "../catalogCache";
import { scopedStorageKey } from "../runtimeEnvironment";
import { createBoundedCatalogArtifacts } from "./catalogArtifactStorage";
import { createCatalogArtifactFiles } from "./catalogArtifactFiles";
import { createCatalogArtifactIndexedDb } from "./catalogArtifactIndexedDb";

export type PlatformDocumentPickerAsset = DocumentPicker.DocumentPickerAsset;
export type PlatformAudioSound = InstanceType<typeof Audio.Sound>;

export type AppPlatformServices = Readonly<{
  storage: typeof AsyncStorage;
  catalogArtifacts: CatalogArtifactStorage;
  secureStorage: typeof SecureStore;
  crypto: typeof Crypto;
  constants: typeof Constants;
  imagePicker: typeof ImagePicker;
  audio: Readonly<{
    Audio: typeof Audio;
    InterruptionModeAndroid: typeof InterruptionModeAndroid;
    InterruptionModeIOS: typeof InterruptionModeIOS;
  }>;
  notifications: typeof Notifications;
  intentLauncher: typeof IntentLauncher;
  clipboard: typeof Clipboard;
  files: Readonly<{
    File: typeof File;
    Paths: typeof Paths;
  }>;
  sharing: typeof Sharing;
  documentPicker: typeof DocumentPicker;
  network: Readonly<{
    fetch: typeof fetch;
  }>;
  native: Readonly<{
    AppState: typeof AppState;
    BackHandler: typeof BackHandler;
    Linking: typeof Linking;
    Platform: typeof Platform;
    Vibration: typeof Vibration;
  }>;
}>;

export function createExpoPlatformServices(): AppPlatformServices {
  return {
    storage: AsyncStorage,
    catalogArtifacts: createBoundedCatalogArtifacts(
      Platform.OS === "web"
        ? createCatalogArtifactIndexedDb(scopedStorageKey(CATALOG_CACHE_DIRECTORY))
        : createCatalogArtifactFiles(`${scopedStorageKey("gymnasia.mobile.exercise_catalog.v4")}:artifact:`, scopedStorageKey(CATALOG_CACHE_DIRECTORY)),
      `${scopedStorageKey("gymnasia.mobile.exercise_catalog.v4")}:artifact:`,
    ),
    secureStorage: SecureStore,
    crypto: Crypto,
    constants: Constants,
    imagePicker: ImagePicker,
    audio: {
      Audio,
      InterruptionModeAndroid,
      InterruptionModeIOS,
    },
    notifications: Notifications,
    intentLauncher: IntentLauncher,
    clipboard: Clipboard,
    files: { File, Paths },
    sharing: Sharing,
    documentPicker: DocumentPicker,
    network: { fetch: createPlatformFetch() },
    native: { AppState, BackHandler, Linking, Platform, Vibration },
  };
}

export const APP_PLATFORM_SERVICES = createExpoPlatformServices();
