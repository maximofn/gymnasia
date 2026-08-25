import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const START = "<!-- OPENWIKI:START -->";
const END = "<!-- OPENWIKI:END -->";

function occurrences(content, value) {
  return content.split(value).length - 1;
}

async function main() {
  const root = path.resolve(process.argv[2] || process.cwd());
  const agentsPath = path.join(root, "AGENTS.md");
  const claudePath = path.join(root, "CLAUDE.md");
  const agentsStat = await lstat(agentsPath);
  if (!agentsStat.isSymbolicLink()) {
    throw new Error("AGENTS.md must remain a symbolic link to CLAUDE.md.");
  }

  const target = await readlink(agentsPath);
  if (target !== "CLAUDE.md") {
    throw new Error(`AGENTS.md points to ${target}, expected CLAUDE.md.`);
  }

  const content = await readFile(claudePath, "utf8");
  if (occurrences(content, START) !== 1 || occurrences(content, END) !== 1) {
    throw new Error("CLAUDE.md must contain exactly one OpenWiki marker pair.");
  }
  if (content.indexOf(START) >= content.indexOf(END)) {
    throw new Error("The OpenWiki markers in CLAUDE.md are out of order.");
  }

  const managed = content.slice(
    content.indexOf(START),
    content.indexOf(END) + END.length,
  );
  if (/See \[AGENTS\.md\]\(AGENTS\.md\)/u.test(managed)) {
    throw new Error(
      "CLAUDE.md cannot point to AGENTS.md because AGENTS.md already links back to it.",
    );
  }

  process.stdout.write("OpenWiki agent instructions: OK\n");
}

await main();
