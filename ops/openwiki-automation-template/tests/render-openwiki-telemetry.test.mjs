import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MANAGED_END,
  MANAGED_START,
  buildManagedSection,
  renderTelemetryPage,
  replaceManagedSection,
} from "../scripts/render-openwiki-telemetry.mjs";
import { aggregateRuns, availableTelemetry } from "../scripts/openwiki-telemetry.mjs";

function telemetry() {
  const collectedAt = new Date("2026-09-15T08:30:00.000Z");
  const sample = aggregateRuns(
    [
      {
        trace_id: "private-trace-id",
        parent_run_id: null,
        run_type: "chain",
        name: "private-name",
        start_time: "2026-09-15T08:00:00.000Z",
        end_time: "2026-09-15T08:05:00.000Z",
        status: "success",
      },
    ],
    { collectedAt },
  );
  return availableTelemetry(sample, collectedAt);
}

test("builds a bounded public section from aggregate fields only", () => {
  const section = buildManagedSection(telemetry());

  assert.match(section, /1 totales · 1 correctas/u);
  assert.match(section, /0 \(no hubo llamadas de modelo\)/u);
  assert.match(section, /búsqueda 0 · lectura 0/u);
  assert.doesNotMatch(section, /private-trace-id|private-name/u);
  assert.equal(section.match(new RegExp(MANAGED_START, "gu"))?.length, 1);
  assert.equal(section.match(new RegExp(MANAGED_END, "gu"))?.length, 1);
});

test("inserts the managed section once and then replaces it idempotently", () => {
  const page = [
    "# Evidence",
    "",
    "## Informe diario saneado",
    "stable text",
    "",
    "## Cambio y validación focalizada",
    "durable text",
    "",
  ].join("\n");
  const first = replaceManagedSection(page, `${MANAGED_START}\nnew\n${MANAGED_END}`);
  const second = replaceManagedSection(first, `${MANAGED_START}\nnewer\n${MANAGED_END}`);

  assert.match(first, /stable text/u);
  assert.match(first, /## Cambio y validación focalizada\ndurable text/u);
  assert.doesNotMatch(second, /\nnew\n/u);
  assert.match(second, /newer/u);
  assert.equal(second.match(new RegExp(MANAGED_START, "gu"))?.length, 1);
  assert.equal(second.match(new RegExp(MANAGED_END, "gu"))?.length, 1);
});

test("renders the page and synchronizes both OpenWiki page versions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "openwiki-telemetry-test-"));
  await Promise.all([
    mkdir(path.join(root, "ops"), { recursive: true }),
    mkdir(path.join(root, "openwiki/operations"), { recursive: true }),
    mkdir(path.join(root, "openwiki/.claims/operations"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(root, "ops/openwiki-runtime-telemetry.json"),
      JSON.stringify(telemetry()),
    ),
    writeFile(
      path.join(root, "openwiki/operations/openwiki-automation.md"),
      "# Automation\n\n## Informe diario saneado\nstable\n\n## Cambio y validación focalizada\nkeep\n",
    ),
    writeFile(
      path.join(root, "openwiki/.page-manifest.json"),
      JSON.stringify({ pages: { "/openwiki/operations/openwiki-automation.md": { pageVersion: "old" } } }),
    ),
    writeFile(
      path.join(root, "openwiki/.claims/operations/openwiki-automation.json"),
      JSON.stringify({ pageVersion: "old", claims: [] }),
    ),
  ]);

  await renderTelemetryPage(root);

  const [page, manifest, claims] = await Promise.all([
    readFile(path.join(root, "openwiki/operations/openwiki-automation.md"), "utf8"),
    readFile(path.join(root, "openwiki/.page-manifest.json"), "utf8").then(JSON.parse),
    readFile(
      path.join(root, "openwiki/.claims/operations/openwiki-automation.json"),
      "utf8",
    ).then(JSON.parse),
  ]);
  const expected = `sha256:${createHash("sha256").update(page).digest("hex")}`;
  assert.equal(
    manifest.pages["/openwiki/operations/openwiki-automation.md"].pageVersion,
    expected,
  );
  assert.equal(claims.pageVersion, expected);
  assert.match(page, /## Cambio y validación focalizada\nkeep/u);
});
