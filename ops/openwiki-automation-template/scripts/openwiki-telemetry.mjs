import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  CATEGORIES as FAILURE_CATEGORIES,
  classifyOpenWikiError,
} from "./classify-openwiki-error.mjs";

export const TELEMETRY_SCHEMA_VERSION = 1;
export const TELEMETRY_PROJECT = "openwiki";
export const TELEMETRY_WINDOW_DAYS = 7;
export const TELEMETRY_RUN_LIMIT = 900;
export const TELEMETRY_TIMEOUT_MS = 60_000;
export const TELEMETRY_MAX_BYTES = 65_536;

export const TOOL_CATEGORIES = Object.freeze([
  "search",
  "read",
  "write",
  "command",
  "other",
]);

const MAX_DURATION_MS = 120 * 60 * 1_000;
const SELECTED_RUN_FIELDS = Object.freeze([
  "trace_id",
  "parent_run_id",
  "run_type",
  "name",
  "start_time",
  "end_time",
  "status",
  "error",
  "prompt_tokens",
  "completion_tokens",
  "total_tokens",
  "prompt_cost",
  "completion_cost",
  "total_cost",
]);

function runField(run, snakeCase, camelCase) {
  return run?.[snakeCase] ?? run?.[camelCase];
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function durationMs(run) {
  const start = Date.parse(runField(run, "start_time", "startTime"));
  const end = Date.parse(runField(run, "end_time", "endTime"));
  const duration = end - start;
  return Number.isFinite(duration) && duration >= 0 && duration <= MAX_DURATION_MS
    ? duration
    : undefined;
}

function nearestRank(values, percentile) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return Math.round(sorted[index]);
}

function distribution(values, unknown) {
  return {
    count: values.length,
    unknown,
    p50: nearestRank(values, 0.5),
    p95: nearestRank(values, 0.95),
    max: values.length > 0 ? Math.round(Math.max(...values)) : null,
  };
}

function measuredValue(run, totalField, firstField, secondField) {
  const total = finiteNumber(runField(run, totalField, totalField.replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())));
  if (total !== undefined && total > 0) {
    return total;
  }

  const first = finiteNumber(
    runField(run, firstField, firstField.replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())),
  );
  const second = finiteNumber(
    runField(run, secondField, secondField.replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())),
  );
  const sum = Math.max(0, first || 0) + Math.max(0, second || 0);
  return sum > 0 ? sum : undefined;
}

function tokenMetrics(llmRuns) {
  if (llmRuns.length === 0) {
    return {
      state: "zero",
      coverage: "complete",
      observedCalls: 0,
      prompt: 0,
      completion: 0,
      total: 0,
    };
  }

  let observedCalls = 0;
  let prompt = 0;
  let completion = 0;
  let total = 0;
  for (const run of llmRuns) {
    const measured = measuredValue(
      run,
      "total_tokens",
      "prompt_tokens",
      "completion_tokens",
    );
    if (measured === undefined) {
      continue;
    }
    observedCalls += 1;
    prompt += Math.max(0, finiteNumber(runField(run, "prompt_tokens", "promptTokens")) || 0);
    completion += Math.max(
      0,
      finiteNumber(runField(run, "completion_tokens", "completionTokens")) || 0,
    );
    total += measured;
  }

  return {
    state: observedCalls > 0 ? "measured" : "unavailable",
    coverage: observedCalls === llmRuns.length ? "complete" : "partial",
    observedCalls,
    prompt: Math.round(prompt),
    completion: Math.round(completion),
    total: Math.round(total),
  };
}

function costMetrics(llmRuns) {
  if (llmRuns.length === 0) {
    return {
      state: "zero",
      coverage: "complete",
      observedCalls: 0,
      totalUsd: 0,
    };
  }

  let observedCalls = 0;
  let totalUsd = 0;
  for (const run of llmRuns) {
    const measured = measuredValue(
      run,
      "total_cost",
      "prompt_cost",
      "completion_cost",
    );
    if (measured === undefined) {
      continue;
    }
    observedCalls += 1;
    totalUsd += measured;
  }

  return {
    state: observedCalls > 0 ? "measured" : "unavailable",
    coverage: observedCalls === llmRuns.length ? "complete" : "partial",
    observedCalls,
    totalUsd: Number(totalUsd.toFixed(6)),
  };
}

export function classifyTool(name) {
  const normalized = typeof name === "string" ? name.toLowerCase() : "";
  if (/search|tavily|web[_ -]?query/u.test(normalized)) {
    return "search";
  }
  if (/read|view|find|get|list|inspect|open/u.test(normalized)) {
    return "read";
  }
  if (/write|edit|patch|create|update|save/u.test(normalized)) {
    return "write";
  }
  if (/command|exec|shell|bash|terminal|run/u.test(normalized)) {
    return "command";
  }
  return "other";
}

function rootOutcome(run) {
  const status = String(run?.status || "").toLowerCase();
  if (run?.error || status === "error" || status === "failed") {
    return "failed";
  }
  if (
    status === "success" ||
    status === "completed" ||
    runField(run, "end_time", "endTime")
  ) {
    return "succeeded";
  }
  return "unknown";
}

export function aggregateRuns(
  runs,
  { collectedAt = new Date(), windowStartAt, windowEndAt, truncated = false } = {},
) {
  const collectedDate = new Date(collectedAt);
  const endDate = windowEndAt ? new Date(windowEndAt) : collectedDate;
  const startDate = windowStartAt
    ? new Date(windowStartAt)
    : new Date(endDate.getTime() - TELEMETRY_WINDOW_DAYS * 86_400_000);
  const safeRuns = Array.isArray(runs) ? runs : [];
  const roots = safeRuns.filter(
    (run) => !runField(run, "parent_run_id", "parentRunId"),
  );
  const traceIds = new Set(
    roots
      .map((run) => runField(run, "trace_id", "traceId"))
      .filter((value) => typeof value === "string" && value.length > 0),
  );
  const scopedRuns =
    traceIds.size > 0
      ? safeRuns.filter((run) =>
          traceIds.has(runField(run, "trace_id", "traceId")),
        )
      : roots;
  const llmRuns = scopedRuns.filter(
    (run) => String(runField(run, "run_type", "runType")).toLowerCase() === "llm",
  );
  const toolRuns = scopedRuns.filter(
    (run) => String(runField(run, "run_type", "runType")).toLowerCase() === "tool",
  );

  const failures = Object.fromEntries(
    FAILURE_CATEGORIES.map((category) => [category, 0]),
  );
  const outcomes = { total: roots.length, succeeded: 0, failed: 0, unknown: 0 };
  for (const root of roots) {
    const outcome = rootOutcome(root);
    outcomes[outcome] += 1;
    if (outcome === "failed") {
      const category = classifyOpenWikiError(root.error || "");
      failures[category] += 1;
    }
  }

  const rootDurations = roots.map(durationMs).filter(Number.isFinite);
  const llmDurations = llmRuns.map(durationMs).filter(Number.isFinite);
  const toolDurations = toolRuns.map(durationMs).filter(Number.isFinite);
  const callsByTrace = roots.map((root) => {
    const traceId = runField(root, "trace_id", "traceId");
    if (typeof traceId !== "string" || traceId.length === 0) {
      return 0;
    }
    return llmRuns.filter(
      (run) => runField(run, "trace_id", "traceId") === traceId,
    ).length;
  });
  const toolCategories = Object.fromEntries(
    TOOL_CATEGORIES.map((category) => [category, 0]),
  );
  for (const run of toolRuns) {
    toolCategories[classifyTool(run?.name)] += 1;
  }

  return {
    collectedAt: collectedDate.toISOString(),
    windowStartAt: startDate.toISOString(),
    windowEndAt: endDate.toISOString(),
    truncated: Boolean(truncated),
    roots: outcomes,
    failures,
    durationMs: {
      roots: distribution(rootDurations, roots.length - rootDurations.length),
      models: distribution(llmDurations, llmRuns.length - llmDurations.length),
      tools: distribution(toolDurations, toolRuns.length - toolDurations.length),
    },
    llm: {
      calls: llmRuns.length,
      callsPerRoot: distribution(callsByTrace, 0),
      tokens: tokenMetrics(llmRuns),
      cost: costMetrics(llmRuns),
    },
    tools: {
      total: toolRuns.length,
      categories: toolCategories,
      unknownNames: toolCategories.other,
    },
  };
}

function telemetryFailureCategory(error) {
  const status = Number(error?.status ?? error?.response?.status);
  if (status === 401 || status === 403) {
    return "oauth";
  }
  if (status === 429) {
    return "rate-limit";
  }
  const category = classifyOpenWikiError(error?.message || "");
  return category === "unknown" ? "langsmith" : category;
}

export function unavailableTelemetry({
  attemptedAt = new Date(),
  previous,
  failureCategory = "langsmith",
} = {}) {
  const previousSample = validateTelemetryEnvelope(previous) ? previous.sample : null;
  const safeFailureCategory = FAILURE_CATEGORIES.includes(failureCategory)
    ? failureCategory
    : "langsmith";
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    project: TELEMETRY_PROJECT,
    latestAttempt: {
      status: "unavailable",
      at: new Date(attemptedAt).toISOString(),
      failureCategory: safeFailureCategory,
    },
    sample: previousSample,
  };
}

export function availableTelemetry(sample, attemptedAt = new Date()) {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    project: TELEMETRY_PROJECT,
    latestAttempt: {
      status: "available",
      at: new Date(attemptedAt).toISOString(),
      failureCategory: null,
    },
    sample,
  };
}

function validDistribution(value) {
  return (
    value &&
    nonNegativeInteger(value.count) &&
    nonNegativeInteger(value.unknown) &&
    [value.p50, value.p95, value.max].every(
      (item) => item === null || (Number.isFinite(item) && item >= 0),
    )
  );
}

function metricStateIsConsistent(metric, callCount, totalField) {
  if (
    !metric ||
    !["measured", "unavailable", "zero"].includes(metric.state) ||
    !["complete", "partial"].includes(metric.coverage) ||
    !nonNegativeInteger(metric.observedCalls) ||
    metric.observedCalls > callCount ||
    !Number.isFinite(metric[totalField]) ||
    metric[totalField] < 0
  ) {
    return false;
  }
  if (callCount === 0) {
    return (
      metric.state === "zero" &&
      metric.coverage === "complete" &&
      metric.observedCalls === 0 &&
      metric[totalField] === 0
    );
  }
  if (metric.state === "zero") {
    return false;
  }
  if (metric.state === "unavailable") {
    return (
      metric.coverage === "partial" &&
      metric.observedCalls === 0 &&
      metric[totalField] === 0
    );
  }
  return (
    metric.observedCalls > 0 &&
    metric[totalField] > 0 &&
    (metric.coverage === "complete") === (metric.observedCalls === callCount)
  );
}

export function validateTelemetryEnvelope(value) {
  if (
    !value ||
    value.schemaVersion !== TELEMETRY_SCHEMA_VERSION ||
    value.project !== TELEMETRY_PROJECT ||
    !value.latestAttempt ||
    !["available", "unavailable"].includes(value.latestAttempt.status) ||
    (value.latestAttempt.at !== null && !validIsoDate(value.latestAttempt.at)) ||
    ![null, ...FAILURE_CATEGORIES].includes(value.latestAttempt.failureCategory) ||
    (value.latestAttempt.status === "available" &&
      (value.latestAttempt.at === null ||
        value.latestAttempt.failureCategory !== null)) ||
    (value.latestAttempt.status === "unavailable" &&
      value.latestAttempt.failureCategory === null)
  ) {
    return false;
  }
  if (value.sample === null) {
    return value.latestAttempt.status === "unavailable";
  }

  const sample = value.sample;
  return (
    validIsoDate(sample.collectedAt) &&
    validIsoDate(sample.windowStartAt) &&
    validIsoDate(sample.windowEndAt) &&
    typeof sample.truncated === "boolean" &&
    sample.roots &&
    ["total", "succeeded", "failed", "unknown"].every((key) =>
      nonNegativeInteger(sample.roots[key]),
    ) &&
    sample.roots.total ===
      sample.roots.succeeded + sample.roots.failed + sample.roots.unknown &&
    sample.failures &&
    FAILURE_CATEGORIES.every((key) => nonNegativeInteger(sample.failures[key])) &&
    FAILURE_CATEGORIES.reduce(
      (total, key) => total + sample.failures[key],
      0,
    ) === sample.roots.failed &&
    sample.durationMs &&
    ["roots", "models", "tools"].every((key) =>
      validDistribution(sample.durationMs[key]),
    ) &&
    sample.durationMs.roots.count + sample.durationMs.roots.unknown ===
      sample.roots.total &&
    sample.llm &&
    nonNegativeInteger(sample.llm.calls) &&
    validDistribution(sample.llm.callsPerRoot) &&
    sample.llm.callsPerRoot.count === sample.roots.total &&
    sample.llm.callsPerRoot.unknown === 0 &&
    sample.durationMs.models.count + sample.durationMs.models.unknown ===
      sample.llm.calls &&
    metricStateIsConsistent(sample.llm.tokens, sample.llm.calls, "total") &&
    nonNegativeInteger(sample.llm.tokens.observedCalls) &&
    nonNegativeInteger(sample.llm.tokens.prompt) &&
    nonNegativeInteger(sample.llm.tokens.completion) &&
    nonNegativeInteger(sample.llm.tokens.total) &&
    metricStateIsConsistent(sample.llm.cost, sample.llm.calls, "totalUsd") &&
    sample.tools &&
    nonNegativeInteger(sample.tools.total) &&
    nonNegativeInteger(sample.tools.unknownNames) &&
    sample.tools.categories &&
    TOOL_CATEGORIES.every((key) =>
      nonNegativeInteger(sample.tools.categories[key]),
    ) &&
    TOOL_CATEGORIES.reduce(
      (total, key) => total + sample.tools.categories[key],
      0,
    ) === sample.tools.total &&
    sample.tools.unknownNames === sample.tools.categories.other &&
    sample.durationMs.tools.count + sample.durationMs.tools.unknown ===
      sample.tools.total
  );
}

export async function readTelemetryFile(filePath) {
  if (!filePath) {
    return undefined;
  }
  try {
    const text = await readFile(filePath, "utf8");
    if (Buffer.byteLength(text, "utf8") > TELEMETRY_MAX_BYTES) {
      return undefined;
    }
    const parsed = JSON.parse(text);
    return validateTelemetryEnvelope(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function collectTelemetry({
  apiKey,
  endpoint = "https://eu.api.smith.langchain.com",
  now = new Date(),
  previous,
  client,
} = {}) {
  const attemptedAt = new Date(now);
  const startTime = new Date(
    attemptedAt.getTime() - TELEMETRY_WINDOW_DAYS * 86_400_000,
  );

  try {
    if (!apiKey && !client) {
      throw new Error("missing telemetry credential");
    }
    let langsmithClient = client;
    if (!langsmithClient) {
      const { Client } = await import("langsmith/client");
      langsmithClient = new Client({ apiKey, apiUrl: endpoint, timeoutMs: 10_000 });
    }
    const runs = [];
    const query = (async () => {
      for await (const run of langsmithClient.listRuns({
        projectName: TELEMETRY_PROJECT,
        startTime,
        limit: TELEMETRY_RUN_LIMIT,
        select: SELECTED_RUN_FIELDS,
      })) {
        runs.push(run);
        if (runs.length >= TELEMETRY_RUN_LIMIT) {
          break;
        }
      }
    })();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("telemetry query timeout")),
        TELEMETRY_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([query, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }

    return availableTelemetry(
      aggregateRuns(runs, {
        collectedAt: attemptedAt,
        windowStartAt: startTime,
        windowEndAt: attemptedAt,
        truncated: runs.length >= TELEMETRY_RUN_LIMIT,
      }),
      attemptedAt,
    );
  } catch (error) {
    return unavailableTelemetry({
      attemptedAt,
      previous,
      failureCategory: telemetryFailureCategory(error),
    });
  }
}

async function main() {
  const [previousPath, outputPath] = process.argv.slice(2);
  if (!previousPath || !outputPath) {
    throw new Error("Expected previous telemetry and output paths.");
  }
  const previous = await readTelemetryFile(previousPath);
  const telemetry = await collectTelemetry({
    apiKey: process.env.OPENWIKI_LANGSMITH_API_KEY,
    endpoint: process.env.LANGSMITH_ENDPOINT,
    previous,
  });
  const serialized = `${JSON.stringify(telemetry, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > TELEMETRY_MAX_BYTES) {
    throw new Error("Sanitized telemetry exceeds the size limit.");
  }
  await writeFile(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`telemetry_status=${telemetry.latestAttempt.status}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  await main();
}
