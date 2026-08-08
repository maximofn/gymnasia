import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinearMarkdown,
  fetchLinearSnapshot,
} from "../scripts/export-linear.mjs";

test("Linear export keeps useful metadata and excludes sensitive bodies", () => {
  const markdown = buildLinearMarkdown({
    issues: {
      nodes: [{
        identifier: "GYM-42",
        title: "Rotate password=hunter2",
        description: "This must never be exported",
        url: "https://linear.app/gymnasia/issue/GYM-42/example",
        updatedAt: "2026-08-08T10:00:00.000Z",
        state: { name: "In Progress" },
        assignee: { name: "Máximo" },
        project: { name: "Gymnasia" },
        labels: { nodes: [{ name: "security" }] },
      }],
    },
    projects: { nodes: [] },
  }, "2026-08-08T12:00:00.000Z");

  assert.match(markdown, /GYM-42/u);
  assert.match(markdown, /password=\[REDACTED\]/u);
  assert.match(markdown, /In Progress/u);
  assert.doesNotMatch(markdown, /hunter2|This must never be exported/u);
});

test("Linear GraphQL errors are rejected even with HTTP 200", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ errors: [{ message: "Not authorized" }] }),
  });

  await assert.rejects(
    () => fetchLinearSnapshot("read-only-test-key", fetchImpl),
    /Linear GraphQL query failed/u,
  );
});

test("Linear API key is sent only in the Authorization header", async () => {
  let request;
  const fetchImpl = async (_url, options) => {
    request = options;
    return {
      ok: true,
      json: async () => ({ data: { issues: { nodes: [] }, projects: { nodes: [] } } }),
    };
  };

  await fetchLinearSnapshot("read-only-test-key", fetchImpl);

  assert.equal(request.headers.Authorization, "read-only-test-key");
  assert.doesNotMatch(request.body, /read-only-test-key/u);
});
