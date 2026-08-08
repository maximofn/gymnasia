import assert from "node:assert/strict";
import test from "node:test";

import { buildPersonalBrainConfig } from "../scripts/configure-personal-brain.mjs";

test("Personal Brain config selects Linear, maximofn.com, and focused web search", () => {
  const config = buildPersonalBrainConfig({
    connectedAt: "2026-08-08T12:00:00.000Z",
    linearExportPath: "/private/linear",
    maximofnRepoPath: "/private/maximofn",
    webSearchEnabled: true,
  });

  assert.deepEqual(
    config.sourceInstances.map((source) => source.connectorId),
    ["git-repo", "web-search"],
  );
  assert.deepEqual(
    config.sourceInstances[0].connectorConfig.repos.map((repo) => repo.id),
    ["linear-readonly-export", "maximofn-com"],
  );
  assert.equal(config.sourceInstances[1].connectorConfig.queries.length, 4);
  assert.equal(config.ingestionSchedule.warning.includes("macOS-only"), true);
});

test("Personal Brain omits unavailable connectors instead of inventing config", () => {
  const config = buildPersonalBrainConfig({
    connectedAt: "2026-08-08T12:00:00.000Z",
    linearExportPath: "",
    maximofnRepoPath: "",
    webSearchEnabled: false,
  });

  assert.deepEqual(config.sourceInstances, []);
  assert.deepEqual(config.sources, {});
});
