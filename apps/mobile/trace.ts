import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type TraceEntry = {
  ts: number;
  tag: string;
  message: string;
  data?: unknown;
};

const TRACE_KEY = "gymnasia_debug_traces";
const MAX_TRACES = 1000;

let traceBuffer: TraceEntry[] = [];
let traceBufferLoaded = false;
let traceBufferLoading: Promise<void> | null = null;

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

export async function getTraces(): Promise<TraceEntry[]> {
  await loadTraceBuffer();
  return traceBuffer.slice();
}

export function formatTraces(entries: TraceEntry[]): string {
  const header = [
    `=== Gymnasia trace dump ===`,
    `platform: ${Platform.OS}`,
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
