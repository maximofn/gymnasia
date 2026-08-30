import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repositoryRoot, "apps/mobile");
const expo = join(mobileRoot, "node_modules/.bin/expo");

function expoConfig(environment, developmentProviderMode) {
  const env = { ...process.env };
  delete env.APP_ENV;
  delete env.DEV_PROVIDER_MODE;
  if (environment !== undefined) env.APP_ENV = environment;
  if (developmentProviderMode !== undefined) {
    env.DEV_PROVIDER_MODE = developmentProviderMode;
  }
  return spawnSync(expo, ["config", "--type", "public", "--json"], {
    cwd: mobileRoot,
    env,
    encoding: "utf8",
  });
}

test("Expo publica las tres variantes exactas y aisladas", () => {
  const currentAppVersion = "1.31.0";
  const expected = [
    ["development", "Gymnasia Dev", "com.maximofn.gymnasia.dev", "Local", "gymnasia.development", "fake"],
    ["staging", "Gymnasia Staging", "com.maximofn.gymnasia.staging", "Staging", "gymnasia.staging", "byok"],
    ["production", "Gymnasia", "com.maximofn.gymnasia", "Production", "gymnasia.production", "byok"],
  ];

  for (const [environment, name, applicationId, channel, storageNamespace, providerMode] of expected) {
    const result = expoConfig(environment);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.name, name);
    assert.equal(config.version, currentAppVersion);
    assert.equal(config.android.package, applicationId);
    assert.equal(config.ios.bundleIdentifier, applicationId);
    assert.deepEqual(
      {
        environment: config.extra.environment,
        channel: config.extra.channel,
        storageNamespace: config.extra.storageNamespace,
        providerMode: config.extra.providerMode,
        configurationVersion: config.extra.configurationVersion,
      },
      { environment, channel, storageNamespace, providerMode, configurationVersion: 1 },
    );
  }
});

test("Expo aborta configuraciones ausentes, desconocidas o híbridas", () => {
  assert.notEqual(expoConfig(undefined).status, 0);
  assert.notEqual(expoConfig("preview").status, 0);
  assert.notEqual(expoConfig("staging", "byok").status, 0);
});
