import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const readWorkflow = (name) => readFileSync(new URL(`.github/workflows/${name}`, root), "utf8");

test("el CI del tablero no recibe secretos ni permisos de escritura", () => {
  const workflow = readWorkflow("board-ci.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\n    branches: \[main\]/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.doesNotMatch(workflow, /secrets\.|pull_request_target|contents: write/);
  for (const command of ["test:linear", "test:board-automation", "test:board", "test:board:e2e"]) {
    assert.match(workflow, new RegExp(command.replace(":", "\\:")));
  }
});

test("la conciliación solo parte de main y separa revisión humana de cambios seguros", () => {
  const workflow = readWorkflow("board-reconcile.yml");
  assert.match(workflow, /cron: "17 \*\/6 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /fetch --no-tags --depth=1 origin refs\/heads\/main/);
  assert.doesNotMatch(workflow, /actions\/checkout@/);
  assert.match(workflow, /secrets\.LINEAR_API_KEY/);
  assert.match(workflow, /secrets\.BOARD_SYNC_TOKEN/);
  assert.match(workflow, /--apply-safe/);
  assert.match(workflow, /--force-with-lease=/);
  assert.match(workflow, /steps\.audit\.outputs\.status == 'review_required'/);
  assert.match(workflow, /steps\.audit\.outputs\.status == 'safe_changes'/);
  assert.match(workflow, /chore\(board\): sincroniza el espejo con Linear/);
  assert.doesNotMatch(workflow, /auto-merge|gh pr merge/);
});

test("producción exige gates, proyecto exacto, hash remoto y evidencia", () => {
  const workflow = readWorkflow("board-deploy.yml");
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /name: Board Production/);
  assert.match(workflow, /vercel@59\.16\.0/);
  assert.match(workflow, /p\.projectName!=="gymnasia"/);
  assert.match(workflow, /--attempts 12 --interval-ms 5000/);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /production-mismatch/);
  assert.doesNotMatch(workflow, /arquitectura-agente\/tests\/\*\*/);
});

test("todas las Actions de terceros están fijadas a un commit", () => {
  for (const name of ["board-ci.yml", "board-reconcile.yml", "board-deploy.yml"]) {
    const workflow = readWorkflow(name);
    assert.doesNotMatch(workflow, /actions\/checkout@/, `${name} no debe recorrer gitlinks heredados`);
    for (const line of workflow.split("\n").filter((candidate) => candidate.includes("uses:"))) {
      assert.match(line, /uses: [^@]+@[a-f0-9]{40}(?:\s+#|$)/, `${name}: ${line}`);
    }
  }
});
