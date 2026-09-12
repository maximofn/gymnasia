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

export type PlatformDocumentPickerAsset = DocumentPicker.DocumentPickerAsset;
export type PlatformAudioSound = InstanceType<typeof Audio.Sound>;

export type AppPlatformServices = Readonly<{
  storage: typeof AsyncStorage;
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
    network: { fetch },
    native: { AppState, BackHandler, Linking, Platform, Vibration },
  };
}

export const APP_PLATFORM_SERVICES = createExpoPlatformServices();
