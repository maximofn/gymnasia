import assert from "node:assert/strict";
import { closeSync, mkdtempSync, openSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readLocalBuildFailure, summarizeLocalBuildFailure } from "./local-build-diagnostics.mjs";

test("failure summary never copies credentials, paths or SDK payloads", () => {
  const secret = "private-signing-password-123";
  const text = `[INSTALL_DEPENDENCIES] EXPO_TOKEN=${secret}\n` +
    `job={"keystorePassword":"${secret}"}\nError: HTTP 502 at /private/${secret}/archive\n`;
  const value = summarizeLocalBuildFailure(text, { status: 1, signal: secret, error: { code: secret } });
  assert.deepEqual(value, {
    schemaVersion: 1, exitCode: 1, signal: null, phase: "INSTALL_DEPENDENCIES",
    errorCode: null, httpStatus: 502, category: "provider_request_failed",
  });
  assert.ok(!JSON.stringify(value).includes(secret));
});

test("unknown phase and arbitrary error details stay redacted", () => {
  const value = summarizeLocalBuildFailure("[PRIVATE_TOKEN_PHASE] unknown error: account@example.com", { status: 1 });
  assert.equal(value.phase, "preflight");
  assert.equal(value.category, "unknown");
  assert.ok(!JSON.stringify(value).includes("account@example.com"));
  assert.ok(!JSON.stringify(value).includes("PRIVATE_TOKEN_PHASE"));
});

test("identifies early workspace and plugin errors without returning their text", () => {
  assert.equal(summarizeLocalBuildFailure("Workingdir is not empty.").category, "working_directory_not_empty");
  assert.equal(summarizeLocalBuildFailure("Cannot find module '/private/credential.js'").category, "module_missing");
  assert.equal(summarizeLocalBuildFailure("Job object has incorrect format").category, "plugin_input_rejected");
  assert.equal(summarizeLocalBuildFailure("ENOENT: open '/private/credential.json'").errorCode, "ENOENT");
});

test("APK diagnosis excludes output left by the preceding AAB", () => {
  const directory = mkdtempSync(join(tmpdir(), "gymnasia-local-diagnostics-"));
  const descriptor = openSync(join(directory, "private.log"), "wx+", 0o600);
  try {
    const preceding = Buffer.from("[RUN_GRADLEW] BUILD FAILED\nENOENT\n");
    writeSync(descriptor, preceding);
    writeSync(descriptor, Buffer.from("GraphQL request failed: HTTP 503\n"));
    const result = readLocalBuildFailure(descriptor, preceding.length, { status: 1 });
    assert.equal(result.phase, "preflight");
    assert.equal(result.errorCode, null);
    assert.equal(result.httpStatus, 503);
    assert.equal(result.category, "provider_request_failed");
  } finally {
    closeSync(descriptor);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an unavailable private log does not expose the read error or mask the build failure", () => {
  const result = readLocalBuildFailure(-1, 0, { status: null, signal: "SIGKILL" });
  assert.equal(result.logReadable, false);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.exitCode, null);
});
