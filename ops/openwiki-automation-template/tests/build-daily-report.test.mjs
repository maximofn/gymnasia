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
    telemetry: {
      schemaVersion: 1,
      project: "openwiki",
      latestAttempt: {
        status: "available",
        at: "2026-08-20T10:00:00.000Z",
        failureCategory: null,
      },
      sample: {
        collectedAt: "2026-08-20T10:00:00.000Z",
        windowStartAt: "2026-08-13T10:00:00.000Z",
        windowEndAt: "2026-08-20T10:00:00.000Z",
        truncated: false,
        roots: { total: 14, succeeded: 12, failed: 2, unknown: 0 },
        failures: {
          oauth: 1,
          "managed-markers": 0,
          langsmith: 0,
          "rate-limit": 1,
          model: 0,
          "context-limit": 0,
          network: 0,
          unknown: 0,
        },
        durationMs: {
          roots: { count: 14, unknown: 0, p50: 286767, p95: 480000, max: 520000 },
          models: { count: 70, unknown: 0, p50: 6800, p95: 12000, max: 18000 },
          tools: { count: 74, unknown: 0, p50: 42, p95: 900, max: 1400 },
        },
        llm: {
          calls: 70,
          callsPerRoot: { count: 14, unknown: 0, p50: 5, p95: 8, max: 9 },
          tokens: {
            state: "unavailable",
            coverage: "partial",
            observedCalls: 0,
            prompt: 0,
            completion: 0,
            total: 0,
          },
          cost: {
            state: "unavailable",
            coverage: "partial",
            observedCalls: 0,
            totalUsd: 0,
          },
        },
        tools: {
          total: 74,
          categories: { search: 18, read: 42, write: 9, command: 3, other: 2 },
          unknownNames: 2,
        },
      },
    },
  };
}

test("builds a useful successful report from metadata only", () => {
  const report = buildDailyReport({ ...successfulPayload(), now });

  assert.match(report, /✅ Actualización completa/u);
  assert.match(report, /⏱ 8 min 8 s · manual/u);
  assert.match(report, /✅ Code Brain actualizado · 4 min 4 s/u);
  assert.match(report, /📝 Rama de documentación y PR actualizadas/u);
  assert.match(report, /🇪🇺 LangSmith · inputs, outputs y metadatos ocultos/u);
  assert.match(report, /📊 TELEMETRÍA · 7 días/u);
  assert.match(report, /Muestra: 14 ejecuciones · 12 correctas · 2 fallidas/u);
  assert.match(report, /Fallos: OAuth 1 · límite de uso 1/u);
  assert.match(report, /Rondas: 70 llamadas de modelo · p50 5 por ejecución/u);
  assert.match(
    report,
    /Herramientas: búsqueda 18 · lectura 42 · escritura 9 · comandos 3 · otras 2/u,
  );
  assert.match(report, /Tokens: no disponibles · coste: no disponible/u);
  assert.match(report, /✅ OAuth: sesión válida · estado cifrado persistido/u);
  assert.match(report, /✅ Personal Brain actualizado y cifrado · 2 min 30 s/u);
  assert.match(
    report,
    /Fuentes confirmadas: Linear \(solo metadatos\) · maximofn\.com · Tavily/u,
  );
  assert.match(
    report,
    /✅ PR de esta ejecución: #18 fusionada · 9 archivos · \+122\/−9/u,
  );
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
  assert.match(report, /✅ Última PR conocida: #18 fusionada/u);
});

test("reports OAuth failure without copying untrusted fields", () => {
  const secret = "super-secret-refresh-token";
  const payload = successfulPayload();
  payload.runs.workflow_runs[0].conclusion = "failure";
  payload.runs.workflow_runs[0].private_log = secret;
  payload.runs.workflow_runs.push(
    {
      conclusion: "timed_out",
      created_at: "2026-08-19T10:00:00.000Z",
      event: "schedule",
      status: "completed",
    },
    {
      conclusion: "success",
      created_at: "2026-08-18T10:00:00.000Z",
      event: "schedule",
      status: "completed",
    },
  );
  payload.jobs.jobs[0].steps.find(
    ({ name }) => name === "Mark OpenAI OAuth failure",
  ).conclusion = "success";
  payload.jobs.jobs[0].steps.find(
    ({ name }) => name ===
      "Push fixed branch and create or update pull request",
  ).conclusion = "skipped";
  payload.pullRequests[0].title = secret;
  payload.pullRequests[0].url = `https://example.com/${secret}`;

  const report = buildDailyReport({ ...payload, now });
  assert.match(report, /🔴 Actualización fallida/u);
  assert.match(report, /🔴 Code Brain bloqueado por OAuth/u);
  assert.match(report, /🔴 OAuth: login expirado o revocado/u);
  assert.match(report, /🔁 Fallos consecutivos: 2 · desde 19 ago 2026/u);
  assert.match(report, /🕘 Último éxito: 18 ago 2026/u);
  assert.match(report, /🚨 ACCIÓN NECESARIA/u);
  assert.match(report, /ejecuta una consulta breve/u);
  assert.match(report, /✅ Última PR conocida: #18 fusionada/u);
  assert.doesNotMatch(report, new RegExp(secret, "u"));
  assert.doesNotMatch(report, /example\.com/u);
});

test("retains the last valid telemetry sample without copying untrusted fields", () => {
  const payload = successfulPayload();
  const secret = "private-trace-name-and-error";
  payload.telemetry.latestAttempt = {
    status: "unavailable",
    at: "2026-08-20T11:00:00.000Z",
    failureCategory: "langsmith",
    error: secret,
  };
  payload.telemetry.traceName = secret;

  const report = buildDailyReport({ ...payload, now });

  assert.match(
    report,
    /⚠️ Consulta no disponible · última muestra válida: 20 ago, 12:00/u,
  );
  assert.match(report, /Muestra: 14 ejecuciones/u);
  assert.doesNotMatch(report, new RegExp(secret, "u"));
  assert.ok(report.length < 4096);
});

test("rejects malformed numeric telemetry instead of rendering its content", () => {
  const payload = successfulPayload();
  const secret = "private-malformed-token-field";
  payload.telemetry.sample.llm.tokens.total = secret;

  const report = buildDailyReport({ ...payload, now });

  assert.match(report, /⚠️ Telemetría no disponible/u);
  assert.doesNotMatch(report, new RegExp(secret, "u"));
});

test("reports when no successful run appears in the retained history", () => {
  const payload = successfulPayload();
  payload.runs.workflow_runs = [
    {
      conclusion: "failure",
      created_at: "2026-08-20T09:07:50.000Z",
      event: "schedule",
      status: "completed",
    },
  ];

  const report = buildDailyReport({ ...payload, now });
  assert.match(report, /🔁 Fallos consecutivos: 1 · desde 20 ago 2026/u);
  assert.match(
    report,
    /🕘 Último éxito: no aparece en las últimas 30 ejecuciones/u,
  );
});
