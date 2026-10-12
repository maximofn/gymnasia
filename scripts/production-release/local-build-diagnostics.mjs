import { fstatSync, readSync } from "node:fs";

const MAXIMUM_DIAGNOSTIC_BYTES = 64 * 1024;
const PHASES = new Set([
  "SETUP_WORKINGDIR", "PREPARE_PROJECT", "INSTALL_DEPENDENCIES", "PREBUILD",
  "RUN_GRADLEW", "CHECK_EXPO_CONFIG", "READ_PACKAGE_JSON", "ARCHIVE_PROJECT",
  "CONFIGURE_GRADLE", "CLEAN_UP",
]);
const ERROR_CODES = new Set(["ENOENT", "EACCES", "ENOSPC", "EPIPE", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"]);
const SIGNALS = new Set(["SIGKILL", "SIGTERM", "SIGABRT", "SIGSEGV"]);

export function summarizeLocalBuildFailure(text, result = {}) {
  // Never return log lines, paths, commands, credentials or SDK payloads.
  // All strings in this report are fixed vocabulary owned by this module.
  let phase = "preflight";
  for (const match of text.matchAll(/\[([A-Z_]+)\]/g)) {
    if (PHASES.has(match[1])) phase = match[1];
  }
  let errorCode = ERROR_CODES.has(result.error?.code) ? result.error.code : null;
  for (const match of text.matchAll(/\b(ENOENT|EACCES|ENOSPC|EPIPE|ECONNRESET|ETIMEDOUT|ENOTFOUND)\b/g)) {
    errorCode = match[1];
  }
  let httpStatus = null;
  for (const match of text.matchAll(/(?:HTTP(?:Error)?(?:\s+status(?:\s+code)?)?\s*[:=(]?\s*|status(?:\s+code)?[:=\s]+)([45]\d{2})\b/gi)) {
    httpStatus = Number(match[1]);
  }
  let category = "unknown";
  if (/Workingdir is not empty\./i.test(text)) category = "working_directory_not_empty";
  else if (/Cannot find module/i.test(text)) category = "module_missing";
  else if (/Job object has incorrect format/i.test(text)) category = "plugin_input_rejected";
  else if (/GraphQL request failed|network request failed|fetch failed/i.test(text) || httpStatus !== null) category = "provider_request_failed";
  else if (/not logged in|invalid credentials|authentication failed/i.test(text)) category = "authentication_failed";
  else if (/Gradle build failed|BUILD FAILED/i.test(text)) category = "android_build_failed";
  return {
    schemaVersion: 1,
    exitCode: Number.isSafeInteger(result.status) ? result.status : null,
    signal: SIGNALS.has(result.signal) ? result.signal : null,
    phase,
    errorCode,
    httpStatus,
    category,
  };
}

export function readLocalBuildFailure(logDescriptor, startOffset, result) {
  try {
    const end = fstatSync(logDescriptor).size;
    const start = Math.max(startOffset, end - MAXIMUM_DIAGNOSTIC_BYTES);
    const bytes = Buffer.alloc(Math.max(0, end - start));
    const count = readSync(logDescriptor, bytes, 0, bytes.length, start);
    return summarizeLocalBuildFailure(bytes.subarray(0, count).toString("utf8"), result);
  } catch {
    return { ...summarizeLocalBuildFailure("", result), logReadable: false };
  }
}
