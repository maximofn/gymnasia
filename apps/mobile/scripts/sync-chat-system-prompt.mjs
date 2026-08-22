import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const NORMALIZATION_VERSION = 1;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(scriptDirectory, "..", "..", "..");
const sourcePath = join(repositoryRoot, "prompts", "AGENTS.md");
const generatedPath = join(
  repositoryRoot,
  "apps",
  "mobile",
  "agent",
  "generated",
  "chatSystemPrompt.generated.ts",
);
const generatedMetadataPath = join(
  repositoryRoot,
  "apps",
  "mobile",
  "agent",
  "generated",
  "policySnapshot.generated.json",
);

export function normalizeChatSystemPromptSource(value) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function renderChatSystemPromptSnapshot(source) {
  const content = normalizeChatSystemPromptSource(source);
  if (content.trim().length === 0) {
    throw new Error(`${relative(repositoryRoot, sourcePath)} no puede estar vacío.`);
  }
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  return `// Este archivo se genera desde prompts/AGENTS.md. No lo edites a mano.
// Ejecuta \`npm run sync:chat-prompt\` después de modificar la fuente.

export const CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION = ${NORMALIZATION_VERSION} as const;
export const BUNDLED_CHAT_SYSTEM_PROMPT_SHA256 = ${JSON.stringify(sha256)};
export const BUNDLED_CHAT_SYSTEM_PROMPT_VERSION = ${JSON.stringify(`sha256:${sha256}`)};
export const BUNDLED_CHAT_SYSTEM_PROMPT = ${JSON.stringify(content)};
`;
}

export function renderLocalPolicySnapshotMetadata(source) {
  const content = normalizeChatSystemPromptSource(source);
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  return `${JSON.stringify({
    schemaVersion: 1,
    environment: "development",
    channel: "Local",
    candidate: `sha256:${sha256}`,
    sha256,
    deploymentId: null,
  }, null, 2)}\n`;
}

function readSourceAsUtf8() {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(sourcePath));
  } catch {
    throw new Error(`${relative(repositoryRoot, sourcePath)} debe ser UTF-8 válido.`);
  }
}

function usage() {
  console.error(
    "Uso: node apps/mobile/scripts/sync-chat-system-prompt.mjs --write|--check",
  );
}

function main() {
  const [mode, ...extraArguments] = process.argv.slice(2);
  if (!["--write", "--check"].includes(mode) || extraArguments.length > 0) {
    usage();
    process.exitCode = 2;
    return;
  }

  const source = readSourceAsUtf8();
  const expected = renderChatSystemPromptSnapshot(source);
  const expectedMetadata = renderLocalPolicySnapshotMetadata(source);
  if (mode === "--write") {
    mkdirSync(dirname(generatedPath), { recursive: true });
    writeFileSync(generatedPath, expected, "utf8");
    writeFileSync(generatedMetadataPath, expectedMetadata, "utf8");
    console.log(
      `Snapshot actualizado: ${relative(repositoryRoot, generatedPath)}`,
    );
    return;
  }

  let actual = null;
  let actualMetadata = null;
  try {
    actual = readFileSync(generatedPath, "utf8");
    actualMetadata = readFileSync(generatedMetadataPath, "utf8");
  } catch {
    // El mensaje común de divergencia explica cómo crear el archivo.
  }
  if (actual !== expected || actualMetadata !== expectedMetadata) {
    console.error(
      [
        "El snapshot integrado no corresponde a prompts/AGENTS.md.",
        "Ejecuta: npm run sync:chat-prompt",
        "Revisa y confirma el archivo generado.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  console.log("Prompt integrado sincronizado con prompts/AGENTS.md.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
