import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../.github/workflows/openwiki-update.yml",
  import.meta.url,
);

test("initializes runner-only paths after the runner starts", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.doesNotMatch(
    workflow,
    /^\s{6}OPENWIKI_(?:CODE|PERSONAL)_USER_HOME:\s*\$\{\{\s*runner\.temp/mu,
  );
  assert.match(
    workflow,
    /OPENWIKI_CODE_USER_HOME=\$RUNNER_TEMP\/openwiki-code-home/u,
  );
  assert.match(
    workflow,
    /OPENWIKI_PERSONAL_USER_HOME=\$RUNNER_TEMP\/openwiki-personal-home/u,
  );
});

test("classifies OpenWiki logs without printing their contents", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(
    workflow,
    /node \.\.\/scripts\/classify-openwiki-error\.mjs/u,
  );
  assert.match(workflow, /if ! failure_category="\$\(/u);
  assert.match(workflow, /failure_category="unknown"/u);
  assert.match(workflow, /failure_category=\$failure_category/u);
  assert.match(workflow, /\[ "\$failure_category" = "oauth" \]/u);
  assert.match(workflow, /steps\.openwiki\.outcome == 'failure'/u);
  assert.doesNotMatch(workflow, /grep[^\n]+openwiki\.log/u);
  assert.doesNotMatch(workflow, /cat[^\n]+openwiki\.log/u);
});
