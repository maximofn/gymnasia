import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyReport } from "../scripts/build-daily-report.mjs";

const now = new Date("2026-08-20T12:00:00.000Z");

function successfulPayload() {
  return {
    runs: {
      workflow_runs: [
        {
          conclusion: "success",
          created_at: "2026-08-20T09:07:50.000Z",
          event: "workflow_dispatch",
          html_url:
            "https://github.com/maximofn/gymnasia-openwiki-automation/actions/runs/32352293394",
          status: "completed",
        },
      ],
    },
    jobs: {
      jobs: [
        {
          completed_at: "2026-08-20T09:15:58.000Z",
          started_at: "2026-08-20T09:07:50.000Z",
          steps: [
            {
              completed_at: "2026-08-20T09:12:24.000Z",
              conclusion: "success",
              name: "Run OpenWiki",
              started_at: "2026-08-20T09:08:20.000Z",
              status: "completed",
            },
            {
              conclusion: "skipped",
              name: "Mark OpenAI OAuth failure",
              status: "completed",
            },
            {
              conclusion: "skipped",
              name: "Mark OpenWiki non-auth failure",
              status: "completed",
            },
            {
              completed_at: "2026-08-20T09:15:30.000Z",
              conclusion: "success",
              name: "Update Personal Brain without LangSmith tracing",
              started_at: "2026-08-20T09:13:00.000Z",
              status: "completed",
            },
            ...[
              "Confirm Personal Brain Linear source",
              "Confirm Personal Brain repository source",
              "Confirm Personal Brain Tavily source",
              "Persist encrypted OAuth state",
              "Persist encrypted Personal Brain state",
              "Commit generated documentation",
              "Push fixed branch and create or update pull request",
            ].map((name) => ({ conclusion: "success", name, status: "completed" })),
          ],
        },
      ],
    },
    pullRequests: [
      {
        additions: 122,
        changedFiles: 9,
        deletions: 9,
        files: [
          {
            additions: 97,
            deletions: 0,
            path: "openwiki/operations/prompt-policy-governance.md",
          },
          {
            additions: 10,
            deletions: 1,
            path: "openwiki/operations/build-release-and-testing.md",
          },
          {
            additions: 3,
            deletions: 2,
            path: "openwiki/quickstart.md",
          },
          {
            additions: 2,
            deletions: 1,
            path: "openwiki/agent/runtime.md",
          },
          {
            additions: 1000,
            deletions: 0,
            path: "private-source/linear.md",
          },
        ],
        mergedAt: "2026-08-20T09:30:00.000Z",
        number: 18,
        state: "MERGED",
        url: "https://github.com/maximofn/gymnasia/pull/18",
      },
    ],
  };
}

test("builds a useful successful report from metadata only", () => {
  const report = buildDailyReport({ ...successfulPayload(), now });

  assert.match(report, /✅ Actualización completa/u);
  assert.match(report, /⏱ 8 min 8 s · manual/u);
  assert.match(report, /✅ Code Brain actualizado · 4 min 4 s/u);
  assert.match(report, /📝 Rama de documentación y PR actualizadas/u);
  assert.match(report, /🇪🇺 LangSmith · inputs, outputs y metadatos ocultos/u);
  assert.match(report, /✅ OAuth: sesión válida · estado cifrado persistido/u);
  assert.match(report, /✅ Personal Brain actualizado y cifrado · 2 min 30 s/u);
  assert.match(
    report,
    /Fuentes confirmadas: Linear \(solo metadatos\) · maximofn\.com · Tavily/u,
  );
  assert.match(report, /✅ PR #18 fusionada · 9 archivos · \+122\/−9/u);
  assert.match(report, /Cambios destacados:/u);
  assert.match(report, /• Gobierno de políticas de prompt · \+97\/−0/u);
  assert.match(report, /• Compilación, publicación y pruebas · \+10\/−1/u);
  assert.match(report, /• Guía rápida · \+3\/−2/u);
  assert.match(report, /• 1 página más/u);
  assert.doesNotMatch(report, /private-source/u);
  assert.match(report, /https:\/\/github\.com\/maximofn\/gymnasia\/pull\/18/u);
});

test("distinguishes a successful run with no documentation changes", () => {
  const payload = successfulPayload();
  const steps = payload.jobs.jobs[0].steps;
  const push = steps.find(
    ({ name }) => name === "Push fixed branch and create or update pull request",
  );
  push.conclusion = "skipped";

  const report = buildDailyReport({ ...payload, now });
  assert.match(report, /🟰 Sin cambios documentales nuevos/u);
  assert.match(report, /✅ PR #18 fusionada/u);
});

test("reports OAuth failure without copying untrusted fields", () => {
  const secret = "super-secret-refresh-token";
  const payload = successfulPayload();
  payload.runs.workflow_runs[0].conclusion = "failure";
  payload.runs.workflow_runs[0].private_log = secret;
  payload.jobs.jobs[0].steps.find(
    ({ name }) => name === "Mark OpenAI OAuth failure",
  ).conclusion = "success";
  payload.pullRequests[0].title = secret;
  payload.pullRequests[0].url = `https://example.com/${secret}`;

  const report = buildDailyReport({ ...payload, now });
  assert.match(report, /🔴 Actualización fallida/u);
  assert.match(report, /🔴 Code Brain bloqueado por OAuth/u);
  assert.match(report, /🔴 OAuth: login expirado o revocado/u);
  assert.doesNotMatch(report, new RegExp(secret, "u"));
  assert.doesNotMatch(report, /example\.com/u);
});
