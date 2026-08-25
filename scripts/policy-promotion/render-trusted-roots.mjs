#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { repositoryRoot } from "./bundle.mjs";
import { validateTrustedRoots } from "./signing.mjs";

const inputPath = join(repositoryRoot, "policy/signing/trusted-roots.json");
const outputPath = join(
  repositoryRoot,
  "apps/mobile/agent/generated/trustedPolicyRoots.generated.ts",
);

export function renderTrustedRootsModule(value) {
  const roots = validateTrustedRoots(value);
  return `// Generated from policy/signing/trusted-roots.json. Do not edit by hand.\n`
    + `import type { PolicyTrustedRoots } from "../signedPolicy";\n\n`
    + `export const TRUSTED_POLICY_ROOTS = ${JSON.stringify(roots, null, 2)} satisfies PolicyTrustedRoots;\n`;
}

export function syncTrustedRoots({ write }) {
  const expected = renderTrustedRootsModule(JSON.parse(readFileSync(inputPath, "utf8")));
  if (write) {
    writeFileSync(outputPath, expected, "utf8");
    return;
  }
  if (readFileSync(outputPath, "utf8") !== expected) {
    throw new Error("La raíz pública integrada no corresponde a policy/signing/trusted-roots.json.");
  }
}

if (process.argv[1] && process.argv[1].endsWith("render-trusted-roots.mjs")) {
  const write = process.argv.slice(2).includes("--write");
  try {
    syncTrustedRoots({ write });
    console.log(write ? "Raíces públicas integradas actualizadas." : "Raíces públicas integradas verificadas.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
