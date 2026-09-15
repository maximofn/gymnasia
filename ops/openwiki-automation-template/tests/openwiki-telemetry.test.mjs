import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateRuns,
  availableTelemetry,
  collectTelemetry,
  unavailableTelemetry,
  validateTelemetryEnvelope,
} from "../scripts/openwiki-telemetry.mjs";

const now = new Date("2026-09-15T08:30:00.000Z");

function run(overrides) {
  return {
    trace_id: "trace-1",
    parent_run_id: null,
    run_type: "chain",
    name: "private-root-name",
    start_time: "2026-09-15T08:00:00.000Z",
    end_time: "2026-09-15T08:05:00.000Z",
    status: "success",
    ...overrides,
  };
}

test("aggregates allowlisted metrics without retaining trace content", () => {
  const secret = "secret prompt, output, path, and trace identifier";
  const sample = aggregateRuns(
    [
      run({ inputs: secret, outputs: secret, extra: secret }),
      run({
        trace_id: "trace-2",
        status: "error",
        error: `429 too many requests ${secret}`,
        start_time: "2026-09-15T08:10:00.000Z",
        end_time: "2026-09-15T08:10:01.000Z",
      }),
      run({
        parent_run_id: "root-1",
        run_type: "llm",
        name: secret,
        start_time: "2026-09-15T08:00:10.000Z",
        end_time: "2026-09-15T08:00:17.000Z",
        prompt_tokens: 120,
        completion_tokens: 30,
        total_cost: 0.0042,
      }),
      run({
        parent_run_id: "root-1",
        run_type: "tool",
        name: "tavily_search_results_json",
        start_time: "2026-09-15T08:00:18.000Z",
        end_time: "2026-09-15T08:00:18.050Z",
      }),
      run({
        parent_run_id: "root-1",
        run_type: "tool",
        name: secret,
        start_time: "2026-09-15T08:00:19.000Z",
        end_time: "2026-09-15T08:00:19.040Z",
      }),
    ],
    { collectedAt: now },
  );

  assert.deepEqual(sample.roots, {
    total: 2,
    succeeded: 1,
    failed: 1,
    unknown: 0,
  });
  assert.equal(sample.failures["rate-limit"], 1);
  assert.equal(sample.durationMs.roots.p50, 1_000);
  assert.equal(sample.durationMs.roots.p95, 300_000);
  assert.equal(sample.llm.calls, 1);
  assert.equal(sample.llm.tokens.state, "measured");
  assert.equal(sample.llm.tokens.total, 150);
  assert.equal(sample.llm.cost.totalUsd, 0.0042);
  assert.equal(sample.tools.categories.search, 1);
  assert.equal(sample.tools.categories.other, 1);
  assert.equal(sample.tools.unknownNames, 1);
  assert.doesNotMatch(JSON.stringify(sample), new RegExp(secret, "u"));
  assert.doesNotMatch(JSON.stringify(sample), /trace-1/u);
});

test("does not interpret zero token and cost fields as measured usage", () => {
  const sample = aggregateRuns([
    run({}),
    run({
      parent_run_id: "root-1",
      run_type: "llm",
      total_tokens: 0,
      total_cost: 0,
    }),
  ]);

  assert.equal(sample.llm.tokens.state, "unavailable");
  assert.equal(sample.llm.tokens.coverage, "partial");
  assert.equal(sample.llm.cost.state, "unavailable");
  assert.equal(sample.llm.cost.coverage, "partial");
});

test("reports true zero only when there are no model calls", () => {
  const sample = aggregateRuns([run({})]);

  assert.equal(sample.llm.tokens.state, "zero");
  assert.equal(sample.llm.cost.state, "zero");
});

test("keeps the previous valid sample when LangSmith is unavailable", async () => {
  const previous = {
    schemaVersion: 1,
    project: "openwiki",
    latestAttempt: {
      status: "available",
      at: now.toISOString(),
      failureCategory: null,
    },
    sample: aggregateRuns([run({})], { collectedAt: now }),
  };
  const client = {
    async *listRuns() {
      throw new Error("private remote error");
    },
  };

  const telemetry = await collectTelemetry({ client, now, previous });

  assert.equal(telemetry.latestAttempt.status, "unavailable");
  assert.equal(telemetry.latestAttempt.failureCategory, "langsmith");
  assert.deepEqual(telemetry.sample, previous.sample);
  assert.equal(validateTelemetryEnvelope(telemetry), true);
  assert.doesNotMatch(JSON.stringify(telemetry), /private remote error/u);
});

test("reduces LangSmith query errors to a fixed safe category", async () => {
  const client = {
    async *listRuns() {
      const error = new Error("private provider response");
      error.status = 429;
      throw error;
    },
  };

  const telemetry = await collectTelemetry({ client, now });

  assert.equal(telemetry.latestAttempt.status, "unavailable");
  assert.equal(telemetry.latestAttempt.failureCategory, "rate-limit");
  assert.doesNotMatch(JSON.stringify(telemetry), /private provider response/u);
});

test("queries only the bounded structural fields needed for aggregation", async () => {
  let query;
  const client = {
    async *listRuns(value) {
      query = value;
      yield run({});
    },
  };

  const telemetry = await collectTelemetry({ client, now });

  assert.equal(telemetry.latestAttempt.status, "available");
  assert.equal(query.projectName, "openwiki");
  assert.equal(query.limit, 900);
  assert.equal(query.startTime.toISOString(), "2026-09-08T08:30:00.000Z");
  assert.ok(query.select.includes("trace_id"));
  assert.ok(query.select.includes("name"));
  assert.ok(query.select.includes("error"));
  for (const forbidden of [
    "inputs",
    "outputs",
    "extra",
    "events",
    "serialized",
    "app_path",
    "share_token",
    "inputs_s3_urls",
    "outputs_s3_urls",
  ]) {
    assert.ok(!query.select.includes(forbidden), forbidden);
  }
});

test("rejects malformed envelopes and never trusts their previous sample", () => {
  const telemetry = unavailableTelemetry({
    attemptedAt: now,
    previous: { schemaVersion: 1, sample: { error: "private" } },
  });

  assert.equal(telemetry.sample, null);
  assert.equal(validateTelemetryEnvelope(telemetry), true);
});

test("rejects internally inconsistent aggregate counts", () => {
  const telemetry = availableTelemetry(
    aggregateRuns([run({})], { collectedAt: now }),
    now,
  );
  telemetry.sample.tools.categories.read = 1;

  assert.equal(validateTelemetryEnvelope(telemetry), false);
});
