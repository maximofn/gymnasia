import { beforeEach, describe, expect, it, vi } from "vitest";

const { application, constants, platform, storage } = vi.hoisted(() => ({
  application: {
    nativeApplicationVersion: "1.20.0" as string | null,
    nativeBuildVersion: "23" as string | null,
  },
  constants: {
    executionEnvironment: "standalone",
    expoConfig: {
      version: "9.9.9",
      android: { versionCode: 999 },
      ios: { buildNumber: "999.1" },
    },
  },
  platform: { OS: "android" },
  storage: {
    getItem: vi.fn(async (_key: string) => null),
    setItem: vi.fn(async (_key: string, _value: string) => undefined),
    removeItem: vi.fn(async (_key: string) => undefined),
  },
}));

vi.mock("expo-application", () => application);
vi.mock("expo-constants", () => ({
  default: constants,
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
vi.mock("../runtimeEnvironment", () => ({
  scopedStorageKey: (key: string) => key,
  RUNTIME_ENVIRONMENT: {
    environment: "production",
    policyChannel: "Production",
    policyCandidate: "policy-v2026.08.3-example",
    policySha256: "a".repeat(64),
  },
}));

import { clearTraces, formatTraces, getTraces, pushAppStartTrace } from "../trace";

beforeEach(async () => {
  platform.OS = "android";
  constants.executionEnvironment = "standalone";
  constants.expoConfig.version = "9.9.9";
  application.nativeApplicationVersion = "1.20.0";
  application.nativeBuildVersion = "23";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  await clearTraces();
});

describe("version attribution in exported traces", () => {
  it.each(["23", "24"])("identifies Android build %s even with the same version name and a different Expo config", (build) => {
    application.nativeBuildVersion = build;

    const output = formatTraces([]);

    expect(output).toContain("app-version: 1.20.0\n");
    expect(output).toContain(`build-version: ${build}\n`);
    expect(output).not.toContain("9.9.9");
    expect(output).not.toContain("999");
    expect(output).toContain("entries: 0\n");
  });

  it("persists the installed versions at each start so an update does not relabel earlier starts", async () => {
    await pushAppStartTrace();
    application.nativeApplicationVersion = "1.42.0";
    application.nativeBuildVersion = "45";
    await pushAppStartTrace();

    const entries = await getTraces();
    expect(entries.map((entry) => entry.data)).toEqual([
      { platform: "android", version: "1.20.0", buildVersion: "23" },
      { platform: "android", version: "1.42.0", buildVersion: "45" },
    ]);
    expect(JSON.parse(storage.setItem.mock.lastCall![1])).toEqual(entries);
    const output = formatTraces(entries);
    expect(output).toContain("app-version: 1.42.0\nbuild-version: 45\n");
    expect(output).toContain('"version":"1.20.0","buildVersion":"23"');
  });

  it("preserves iOS build numbers as strings", () => {
    platform.OS = "ios";
    application.nativeBuildVersion = "23.4";

    expect(formatTraces([])).toContain("app-version: 1.20.0\nbuild-version: 23.4\n");
  });

  it.each(["web", "expo-go"])("does not present host or config build numbers as the installed Gymnasia build in %s", async (runtime) => {
    platform.OS = runtime === "web" ? "web" : "android";
    constants.executionEnvironment = runtime === "expo-go" ? "storeClient" : "standalone";
    application.nativeApplicationVersion = "54.0.0";
    application.nativeBuildVersion = "987";

    const output = formatTraces([]);
    expect(output).toContain("app-version: 9.9.9\nbuild-version: unavailable\n");
    expect(output).not.toContain("987");
    await pushAppStartTrace();
    expect((await getTraces())[0].data).toEqual({
      platform: platform.OS,
      version: "9.9.9",
      buildVersion: null,
    });
  });

  it("reports unavailable native metadata without substituting possibly stale config values", () => {
    application.nativeApplicationVersion = null;
    application.nativeBuildVersion = null;

    expect(formatTraces([])).toContain("app-version: unavailable\nbuild-version: unavailable\n");
  });

  it("exports older entries without inventing their build number", () => {
    const entries = [{
      ts: Date.UTC(2026, 8, 1),
      tag: "app",
      message: "App mounted",
      data: { platform: "android", version: "1.20.0" },
    }];

    expect(formatTraces(entries)).toContain(
      '[2026-09-01T00:00:00.000Z] [app] App mounted | {"platform":"android","version":"1.20.0"}',
    );
    expect(entries[0].data).not.toHaveProperty("buildVersion");
  });
});
