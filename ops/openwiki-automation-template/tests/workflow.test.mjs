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

test("keeps LangSmith tracing enabled except for an explicit manual diagnostic", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(
    workflow,
    /disable_langsmith_tracing:\n\s+description: "Disable LangSmith tracing for one diagnostic run"\n\s+required: false\n\s+default: false\n\s+type: boolean/u,
  );
  assert.match(
    workflow,
    /LANGCHAIN_TRACING_V2: \$\{\{ inputs\.disable_langsmith_tracing == true && 'false' \|\| 'true' \}\}/u,
  );
  assert.match(
    workflow,
    /LANGSMITH_ENDPOINT: "https:\/\/eu\.api\.smith\.langchain\.com"/u,
  );
});

test("the public repository keeps exactly one OpenWiki marker pair", async (t) => {
  for (const fileName of ["CLAUDE.md", "AGENTS.md"]) {
    let instructions;
    try {
      instructions = await readFile(
        new URL(`../../../${fileName}`, import.meta.url),
        "utf8",
      );
    } catch (error) {
      if (error?.code === "ENOENT" && fileName === "CLAUDE.md") {
        t.skip("the standalone private automation copy has no target instructions");
        return;
      }
      throw error;
    }

    assert.equal(
      instructions.match(/<!-- OPENWIKI:START -->/gu)?.length,
      1,
      fileName,
    );
    assert.equal(
      instructions.match(/<!-- OPENWIKI:END -->/gu)?.length,
      1,
      fileName,
    );
    assert.ok(
      instructions.indexOf("<!-- OPENWIKI:START -->") <
        instructions.indexOf("<!-- OPENWIKI:END -->"),
      fileName,
    );
  }
});
