import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import fc from "fast-check";
import {
  assertWorkflowPolicy,
  createRuleset,
  evaluateAuthorization,
  isSensitivePath,
  loadPolicy,
  renderCodeowners,
  renderRuleset,
} from "./policy.mjs";

const policy = loadPolicy();

test("clasifica todas las fronteras privilegiadas", () => {
  for (const path of [
    ".github/workflows/prompt-policy.yml",
    "prompts/AGENTS.md",
    "apps/mobile/App.tsx",
    "ops/openwiki-automation-template/.github/workflows/tests.yml",
    "policy/releases/v1.json",
    "scripts/prompt-policy/policy.mjs",
    "AGENTS.md",
    "CLAUDE.md",
    "package.json",
  ]) {
    assert.equal(isSensitivePath(path, policy), true, path);
  }
  for (const path of ["README.md", "arquitectura-agente/data/board.json", "alimentos/manzana.json"] ) {
    assert.equal(isSensitivePath(path, policy), false, path);
  }
});

test("ningún descendiente arbitrario de un directorio sensible escapa", () => {
  const directories = policy.sensitivePaths.filter((entry) => entry.kind === "directory");
  fc.assert(fc.property(
    fc.constantFrom(...directories),
    fc.array(fc.stringMatching(/^[A-Za-z0-9_.-]{1,20}$/), { minLength: 1, maxLength: 6 }),
    (entry, parts) => isSensitivePath(`${entry.path}${parts.join("/")}`, policy),
  ));
});

test("una ruta parecida no hereda accidentalmente la protección", () => {
  fc.assert(fc.property(
    fc.constantFrom("prompts", "apps/mobile", "policy", ".github"),
    fc.stringMatching(/^[A-Za-z0-9]{1,12}$/),
    (prefix, suffix) => !isSensitivePath(`${prefix}-${suffix}/file.txt`, policy),
  ));
});

test("autoriza automáticamente al propietario y las rutas no sensibles", () => {
  const ownerResult = evaluateAuthorization({
    policy,
    author: { login: "maximofn", id: 15805036 },
    headSha: "owner-sha",
    files: ["apps/mobile/App.tsx"],
    reviews: [],
  });
  assert.equal(ownerResult.state, "success");

  const publicResult = evaluateAuthorization({
    policy,
    author: { login: "contributor", id: 20 },
    headSha: "public-sha",
    files: ["README.md"],
    reviews: [],
  });
  assert.equal(publicResult.state, "success");
  assert.match(publicResult.description, /merge remains manual/);
});

test("una PR externa sensible exige una aprobación del propietario para el SHA actual", () => {
  const base = {
    policy,
    author: { login: "contributor", id: 20 },
    files: ["prompts/AGENTS.md"],
  };
  assert.equal(evaluateAuthorization({ ...base, headSha: "new", reviews: [] }).state, "pending");
  assert.equal(evaluateAuthorization({
    ...base,
    headSha: "new",
    reviews: [{
      id: 1,
      state: "APPROVED",
      commit_id: "old",
      user: { login: "maximofn", id: 15805036 },
    }],
  }).state, "pending");
  assert.equal(evaluateAuthorization({
    ...base,
    headSha: "new",
    reviews: [{
      id: 1,
      state: "APPROVED",
      commit_id: "new",
      user: { login: "maximofn", id: 15805036 },
    }],
  }).state, "success");
  assert.equal(evaluateAuthorization({
    ...base,
    headSha: "new",
    reviews: [
      {
        id: 1,
        state: "APPROVED",
        commit_id: "new",
        user: { login: "maximofn", id: 15805036 },
      },
      {
        id: 2,
        state: "COMMENTED",
        commit_id: "new",
        user: { login: "maximofn", id: 15805036 },
      },
      {
        id: 3,
        state: "CHANGES_REQUESTED",
        commit_id: "new",
        user: { login: "maximofn", id: 15805036 },
      },
    ],
  }).state, "pending");
});

test("CODEOWNERS y ruleset son deterministas y protegen sus propios controles", () => {
  const codeowners = renderCodeowners(policy);
  assert.match(codeowners, /^\/\.github\/ @maximofn$/m);
  assert.match(codeowners, /^\/apps\/mobile\/ @maximofn$/m);
  assert.equal(renderRuleset(policy), `${JSON.stringify(createRuleset(policy), null, 2)}\n`);
  assert.deepEqual(
    createRuleset(policy).rules.at(-1).parameters.required_status_checks.map((check) => check.context),
    ["prompt-policy", "gymnasia/owner-authorization"],
  );
});

test("los workflows cumplen permisos, eventos e inmutabilidad", () => {
  assert.doesNotThrow(() => assertWorkflowPolicy());
  const ownerWorkflow = readFileSync(new URL("../../.github/workflows/owner-authorization.yml", import.meta.url), "utf8");
  assert.doesNotMatch(ownerWorkflow, /github\.event\.pull_request\.head/);
});
