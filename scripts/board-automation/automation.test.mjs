import assert from "node:assert/strict";
import test from "node:test";

import {
  ALERT_MARKER,
  closeHealthy,
  ensureAlertIssue,
  problemFingerprint,
  problemPayload,
  publishProblem,
  renderProblemComment,
  renderPullRequestBody,
} from "./automation.mjs";

const safeReport = {
  schemaVersion: 1,
  status: "safe_changes",
  safeChangeCount: 2,
  reviewRequiredCount: 0,
  changes: {
    states: [{ id: "GYM-10", from: "todo", to: "done" }],
    titles: [{ id: "GYM-11", from: "Antes", to: "Después" }],
    missingFromBoard: [],
    missingFromLinear: [],
  },
};

test("la PR automática informa recuentos sin activar la integración de Linear", () => {
  const body = renderPullRequestBody(safeReport);
  assert.match(body, /Estados actualizados: 1/);
  assert.match(body, /Títulos actualizados: 1/);
  assert.doesNotMatch(body, /GYM-10|GYM-11/);
});

test("la alerta de revisión contextualiza cada identificador", () => {
  const report = structuredClone(safeReport);
  report.status = "review_required";
  report.reviewRequiredCount = 2;
  report.changes.missingFromBoard = [{ id: "GYM-12" }];
  report.changes.missingFromLinear = [{ id: "GYM-13" }];
  const payload = problemPayload("review-required", { report });
  const comment = renderProblemComment(payload, "https://github.com/acme/repo/actions/runs/1");

  assert.match(comment, /GYM-12 \(ticket nuevo pendiente/);
  assert.match(comment, /GYM-13 \(entrada del tablero/);
  assert.equal(problemFingerprint(payload), problemFingerprint(structuredClone(payload)));
});

test("una URL ajena a GitHub nunca se inserta en una alerta", () => {
  assert.throws(
    () => renderProblemComment({ kind: "deploy-failure" }, "https://example.com/run"),
    /no pertenece a github.com/,
  );
});

function fakeIssueApi(initialIssues = [], initialComments = []) {
  const issues = structuredClone(initialIssues);
  const comments = new Map(initialComments.map(([number, values]) => [number, structuredClone(values)]));
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, options });
    if (path.startsWith("/issues?")) return structuredClone(issues);
    if (path === "/issues" && options.method === "POST") {
      const issue = { number: 20, state: "open", ...options.body };
      issues.push(issue);
      return structuredClone(issue);
    }
    const commentMatch = path.match(/^\/issues\/(\d+)\/comments(?:\?|$)/);
    if (commentMatch) {
      const number = Number(commentMatch[1]);
      const values = comments.get(number) || [];
      if (options.method === "POST") {
        values.push({ id: values.length + 1, body: options.body.body });
        comments.set(number, values);
        return values.at(-1);
      }
      return structuredClone(values);
    }
    const issueMatch = path.match(/^\/issues\/(\d+)$/);
    if (issueMatch && options.method === "PATCH") {
      const issue = issues.find((candidate) => candidate.number === Number(issueMatch[1]));
      Object.assign(issue, options.body);
      return structuredClone(issue);
    }
    throw new Error(`Petición falsa no contemplada: ${path}`);
  };
  return { request, calls, issues, comments };
}

test("la issue de alerta es única y cierra duplicados previos", async () => {
  const api = fakeIssueApi([
    { number: 5, state: "open", title: "[board-sync] El tablero necesita atención", body: ALERT_MARKER },
    { number: 9, state: "open", title: "[board-sync] El tablero necesita atención", body: ALERT_MARKER },
  ]);

  const { issue } = await ensureAlertIssue(api.request);
  assert.equal(issue.number, 5);
  assert.equal(api.issues.find(({ number }) => number === 9).state, "closed");
});

test("una misma avería no publica comentarios repetidos y la salud global cierra la issue", async () => {
  const api = fakeIssueApi([
    { number: 5, state: "open", title: "[board-sync] El tablero necesita atención", body: ALERT_MARKER },
  ]);
  const payload = { kind: "reconcile-failure" };
  const runUrl = "https://github.com/acme/repo/actions/runs/1";

  await publishProblem({ request: api.request, payload, runUrl });
  await publishProblem({ request: api.request, payload, runUrl });
  assert.equal(api.comments.get(5).length, 1);

  await closeHealthy({ request: api.request, runUrl });
  assert.equal(api.issues[0].state, "closed");
  assert.equal(api.issues[0].state_reason, "completed");
});
