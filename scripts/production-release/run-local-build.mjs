#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertReleaseTransaction } from "./release-transaction.mjs";
import { localToolchain, sha256 } from "./local-build.mjs";

const inputs = resolve(process.argv[2]);
const root = process.cwd();
const temporary = process.env.RUNNER_TEMP;
assert.ok(temporary && temporary !== "/", "RUNNER_TEMP es obligatorio.");
const privateDirectory = join(temporary, "local-build-private");
mkdirSync(privateDirectory, { recursive: false, mode: 0o700 });
const log = openSync(join(privateDirectory, "build.log"), "wx", 0o600);
const contract = {
  aab: { profile: "production", output: join(temporary, "gymnasia.aab"), metadata: join(temporary, "local-build-aab-metadata.json") },
  apk: { profile: "production-apk", output: join(temporary, "gymnasia.apk"), metadata: join(temporary, "local-build-apk-metadata.json") },
};

function inspect(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, `No se pudo comprobar ${command}.`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function build(legName, transaction, sdk) {
  const leg = transaction.legs[legName];
  const attempt = leg.attempts.at(-1);
  const target = contract[legName];
  assert.equal(leg.state, "building", `La pata ${legName} no está reservada.`);
  assert.equal(attempt.runId, process.env.GITHUB_RUN_ID);
  assert.equal(attempt.runAttempt, process.env.GITHUB_RUN_ATTEMPT);
  const working = join(privateDirectory, `${legName}-work`);
  const gradle = join(privateDirectory, `${legName}-gradle`);
  const result = spawnSync("eas", [
    "build", "--platform", "android", "--profile", target.profile,
    "--local", "--non-interactive", "--freeze-credentials", "--output", target.output,
  ], {
    cwd: join(root, "apps/mobile"),
    timeout: 100 * 60 * 1000,
    killSignal: "SIGKILL",
    stdio: ["ignore", log, log],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: "C.UTF-8",
      CI: "1",
      JAVA_HOME: process.env.JAVA_HOME,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
      ANDROID_NDK_HOME: join(sdk, "ndk", localToolchain.androidNdk),
      EXPO_TOKEN: process.env.EXPO_TOKEN,
      APP_ENV: "production",
      EXPO_NO_TELEMETRY: "1",
      TMPDIR: privateDirectory,
      EAS_LOCAL_BUILD_WORKINGDIR: working,
      EAS_LOCAL_BUILD_SKIP_CLEANUP: "0",
      GRADLE_USER_HOME: gradle,
      GRADLE_OPTS: "-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=4 -Dorg.gradle.jvmargs=-Xmx4g",
    },
  });
  assert.equal(result.status, 0, `La compilación local ${legName} falló; el registro privado se destruye con la VM.`);
  assert.ok(existsSync(target.output) && statSync(target.output).isFile(), `No se generó ${target.output}.`);
  const metadata = {
    schemaVersion: 2,
    backend: "wallabot-local",
    leg: legName,
    attemptId: attempt.attemptId,
    sourceCommit: transaction.sourceCommit,
    profile: target.profile,
    version: transaction.version,
    status: "FINISHED",
    toolchain: { ...localToolchain },
    artifact: {
      filename: `gymnasia.${legName}`,
      sha256: sha256(readFileSync(target.output)),
      size: statSync(target.output).size,
    },
  };
  writeFileSync(target.metadata, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(`Build local ${legName.toUpperCase()} terminada: ${metadata.artifact.sha256} (${metadata.artifact.size} bytes).`);
}

try {
  assert.ok(process.env.EXPO_TOKEN?.trim(), "Falta EXPO_TOKEN para obtener las credenciales Android y reservar versionCode.");
  assert.equal(process.env.GITHUB_REPOSITORY, "maximofn/gymnasia");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  assert.ok(["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME));
  assert.equal(process.platform, "linux");
  assert.equal(process.arch, "x64");
  assert.notEqual(process.getuid(), 0);
  assert.ok(!inspect("id", ["-nG"]).split(/\s+/).some((group) => ["sudo", "docker", "kvm", "libvirt"].includes(group)));
  assert.ok(!existsSync("/var/run/docker.sock") && !existsSync("/dev/nvidia0") && !existsSync("/dev/kvm"));
  const transaction = assertReleaseTransaction(JSON.parse(readFileSync(join(inputs, "android-release-transaction.json"))));
  assert.equal(transaction.schemaVersion, 2);
  assert.equal(inspect("git", ["rev-parse", "HEAD"]), transaction.sourceCommit);
  assert.equal(JSON.parse(readFileSync("apps/mobile/app.json")).expo.version, transaction.version);
  const source = JSON.parse(readFileSync(join(inputs, "production-source-evidence.json")));
  assert.equal(source.result, "passed");
  assert.equal(source.commit, transaction.sourceCommit);
  const requested = ["aab", "apk"].filter((leg) => {
    const attempt = transaction.legs[leg].attempts.at(-1);
    return transaction.legs[leg].state === "building"
      && attempt?.runId === process.env.GITHUB_RUN_ID
      && attempt?.runAttempt === process.env.GITHUB_RUN_ATTEMPT;
  });
  assert.ok(requested.length > 0, "No hay patas locales reservadas para este run.");
  for (const leg of requested) {
    for (const [name, digest] of Object.entries(transaction.legs[leg].attempts.at(-1).inputs)) {
      assert.equal(sha256(readFileSync(join(inputs, name))), digest, "Input de Production alterado.");
    }
  }
  assert.equal(process.versions.node, localToolchain.node);
  assert.equal(inspect("npm", ["--version"]), localToolchain.npm);
  assert.match(inspect("java", ["-version"]), new RegExp(`version "${localToolchain.java.replaceAll(".", "\\.")}(?:[+\"]|$)`));
  assert.match(inspect("eas", ["--version"]), new RegExp(`eas-cli/${localToolchain.easCli.replaceAll(".", "\\.")}\\b`));
  const sdk = process.env.ANDROID_HOME;
  assert.ok(sdk);
  for (const [directory, version] of [
    [`platforms/android-${localToolchain.androidPlatform}`, null],
    [`build-tools/${localToolchain.androidBuildTools}`, localToolchain.androidBuildTools],
    [`build-tools/${localToolchain.androidBuildToolsAdditional}`, localToolchain.androidBuildToolsAdditional],
    ["platform-tools", localToolchain.androidPlatformTools],
    [`ndk/${localToolchain.androidNdk}`, localToolchain.androidNdk],
    [`cmdline-tools/${localToolchain.androidCommandLineTools}`, localToolchain.androidCommandLineTools],
    [`cmake/${localToolchain.cmake}`, localToolchain.cmake],
  ]) {
    const properties = readFileSync(join(sdk, directory, "source.properties"), "utf8");
    if (version) assert.equal(properties.match(/^Pkg.Revision\s*=\s*(.+)$/m)?.[1].trim(), version);
  }
  // `production` reserva el siguiente código remoto; `production-apk` no lo
  // incrementa y reutiliza el mismo código. No se envía ninguna build a Expo.
  for (const leg of requested) build(leg, transaction, sdk);
} catch (error) {
  for (const target of Object.values(contract)) {
    rmSync(target.output, { force: true });
    rmSync(target.metadata, { force: true });
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  closeSync(log);
  rmSync(privateDirectory, { recursive: true, force: true });
}
