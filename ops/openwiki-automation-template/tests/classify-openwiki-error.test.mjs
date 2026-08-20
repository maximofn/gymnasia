import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  CATEGORIES,
  classifyOpenWikiError,
} from "../scripts/classify-openwiki-error.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/classify-openwiki-error.mjs", import.meta.url),
);

test("classifies known OpenWiki failure families", () => {
  const cases = [
    ["invalid_grant returned while authenticating", "oauth"],
    ["Failed to refresh access token for the ChatGPT session", "oauth"],
    ["refreshing the OAuth token failed", "oauth"],
    ["ChatGPT token request failed (400). Try signing in again.", "oauth"],
    ["ChatGPT token response missing required fields", "oauth"],
    ["Failed to extract account id from ChatGPT access token", "oauth"],
    ["LangSmith trace upload returned 401 Unauthorized", "langsmith"],
    ["HTTP 429: too many requests", "rate-limit"],
    ["maximum context length exceeded", "context-limit"],
    ["model gpt-example is not available", "model"],
    ["fetch failed: ECONNRESET", "network"],
    ["an unexpected internal condition occurred", "unknown"],
  ];

  for (const [logText, expected] of cases) {
    assert.equal(classifyOpenWikiError(logText), expected, logText);
  }
});

test("does not treat successful token refresh or tracing context as the failure", () => {
  assert.equal(
    classifyOpenWikiError(
      "refresh access token completed successfully\nmodel gpt-example is not available",
    ),
    "model",
  );
  assert.equal(
    classifyOpenWikiError(
      "LangSmith tracing enabled\nfetch failed: ECONNRESET",
    ),
    "network",
  );
  assert.equal(
    classifyOpenWikiError(
      "Using LangChain tracing\nunsupported model gpt-example",
    ),
    "model",
  );
});

test("returns only a category and never log content", async () => {
  const directory = await mkdtemp(`${tmpdir()}/openwiki-classifier-`);
  const logPath = `${directory}/private.log`;
  const secret = "super-secret-refresh-token-value";

  try {
    await writeFile(
      logPath,
      `Failed to refresh access token. Credential: ${secret}\nPrivate prompt text`,
      "utf8",
    );
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      scriptPath,
      logPath,
    ]);

    assert.equal(stdout, "oauth\n");
    assert.equal(stderr, "");
    assert.ok(CATEGORIES.includes(stdout.trim()));
    assert.doesNotMatch(`${stdout}${stderr}`, new RegExp(secret, "u"));
    assert.doesNotMatch(`${stdout}${stderr}`, /Private prompt text/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("read failures also produce only unknown", async () => {
  const missingPath = "/missing/private-token-in-path.log";
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    scriptPath,
    missingPath,
  ]);

  assert.equal(stdout, "unknown\n");
  assert.equal(stderr, "");
  assert.doesNotMatch(`${stdout}${stderr}`, /private-token-in-path/u);
});
