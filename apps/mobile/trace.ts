import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { RUNTIME_ENVIRONMENT, scopedStorageKey } from "./runtimeEnvironment";

export type TraceEntry = {
  ts: number;
  tag: string;
  message: string;
  data?: unknown;
};

const TRACE_KEY = scopedStorageKey("gymnasia_debug_traces");
const MAX_TRACES = 1000;

let traceBuffer: TraceEntry[] = [];
let traceBufferLoaded = false;
let traceBufferLoading: Promise<void> | null = null;

function getAppVersionMetadata() {
  // Expo Go's native values identify Expo Go, not the Gymnasia project it hosts.
  const isNativeApp = Platform.OS !== "web"
    && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
  return {
    version: isNativeApp
      ? Application.nativeApplicationVersion
      : Constants.expoConfig?.version ?? null,
    // EAS can manage this remotely, so app.json is not evidence of the installed build.
    buildVersion: isNativeApp ? Application.nativeBuildVersion : null,
  };
}

async function loadTraceBuffer(): Promise<void> {
  if (traceBufferLoaded) return;
  if (traceBufferLoading) return traceBufferLoading;
  traceBufferLoading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(TRACE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) traceBuffer = parsed as TraceEntry[];
      }
    } catch {
      // ignore
    }
    traceBufferLoaded = true;
    traceBufferLoading = null;
  })();
  return traceBufferLoading;
}

async function persistTraces(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TRACE_KEY,
      JSON.stringify(traceBuffer.slice(-MAX_TRACES)),
    );
  } catch {
    // ignore
  }
}

export async function pushTrace(
  tag: string,
  message: string,
  data?: unknown,
): Promise<void> {
  const entry: TraceEntry = { ts: Date.now(), tag, message, data };
  // Make sure buffer is loaded before pushing so we don't clobber persisted history
  await loadTraceBuffer();
  traceBuffer.push(entry);
  if (traceBuffer.length > MAX_TRACES) {
    traceBuffer = traceBuffer.slice(-MAX_TRACES);
  }
  void persistTraces();
  // Also echo to console so it shows up in `adb logcat` / Expo logs.
  try {
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    console.log(
      `[TRACE] ${new Date(entry.ts).toISOString()} [${tag}] ${message}${dataStr}`,
    );
  } catch {
    // ignore
  }
}

export async function clearTraces(): Promise<void> {
  await loadTraceBuffer();
  traceBuffer = [];
  try {
    await AsyncStorage.removeItem(TRACE_KEY);
  } catch {
    // ignore
  }
}

export function pushAppStartTrace(): Promise<void> {
  return pushTrace("app", "App mounted", {
    platform: Platform.OS,
    ...getAppVersionMetadata(),
  });
}

export async function getTraces(): Promise<TraceEntry[]> {
  await loadTraceBuffer();
  return traceBuffer.slice();
}

export function formatTraces(entries: TraceEntry[]): string {
  const { version, buildVersion } = getAppVersionMetadata();
  const header = [
    `=== Gymnasia trace dump ===`,
    `platform: ${Platform.OS}`,
    `app-version: ${version ?? "unavailable"}`,
    `build-version: ${buildVersion ?? "unavailable"}`,
    `environment: ${RUNTIME_ENVIRONMENT.environment}`,
    `policy-channel: ${RUNTIME_ENVIRONMENT.policyChannel}`,
    `policy-candidate: ${RUNTIME_ENVIRONMENT.policyCandidate}`,
    `policy-sha256: ${RUNTIME_ENVIRONMENT.policySha256.slice(0, 12)}`,
    `generated: ${new Date().toISOString()}`,
    `entries: ${entries.length}`,
    `=========================================`,
  ].join("\n");
  const body = entries
    .map((e) => {
      const iso = new Date(e.ts).toISOString();
      const dataStr = e.data !== undefined ? ` | ${JSON.stringify(e.data)}` : "";
      return `[${iso}] [${e.tag}] ${e.message}${dataStr}`;
    })
    .join("\n");
  return `${header}\n${body}`;
}
