import { readFileSync } from "node:fs";
import process from "node:process";

import { renderChatSystemPromptSnapshot } from "../../apps/mobile/scripts/sync-chat-system-prompt.mjs";
import {
  bundledRuntimePolicyPath,
  bundledPromptPath,
  collectManagedPromptErrors,
  collectPolicyErrors,
  createEvaluationReport,
  extractAgentToolNames,
  findExfiltrationPatterns,
  findAffectedCases,
  loadHealthSafetyPolicy,
  promptPath,
  renderManagedBlock,
  renderRuntimePolicyModule,
  repositoryRoot,
} from "./policy.mjs";
import { join } from "node:path";

function main() {
  const data = loadHealthSafetyPolicy();
  const toolSource = readFileSync(join(repositoryRoot, "apps/mobile/agent/toolDefinitions.ts"), "utf8");
  const toolNames = extractAgentToolNames(toolSource);
  const promptSource = readFileSync(promptPath, "utf8");
  const errors = [
    ...collectPolicyErrors(data, { toolNames }),
    ...collectManagedPromptErrors(promptSource, renderManagedBlock(data)),
  ];
  for (const pattern of findExfiltrationPatterns(promptSource)) {
    errors.push(`El system prompt contiene un patrón de exfiltración: ${pattern}.`);
  }

  const expectedSnapshot = renderChatSystemPromptSnapshot(promptSource);
  let actualSnapshot = "";
  try {
    actualSnapshot = readFileSync(bundledPromptPath, "utf8");
  } catch {
    errors.push("Falta el snapshot móvil del system prompt.");
  }
  if (actualSnapshot && actualSnapshot !== expectedSnapshot) {
    errors.push("El snapshot móvil no corresponde al prompt que contiene la política sanitaria.");
  }
  try {
    const actualRuntimeSnapshot = readFileSync(bundledRuntimePolicyPath, "utf8");
    const expectedRuntimeSnapshot = renderRuntimePolicyModule(data.runtimePolicy);
    if (actualRuntimeSnapshot !== expectedRuntimeSnapshot) {
      errors.push("El snapshot móvil de runtime no corresponde a policy/health-safety/runtime.json.");
    }
  } catch {
    errors.push("Falta el snapshot móvil de la política sanitaria de runtime.");
  }

  const report = createEvaluationReport(data, {
    createdAt: "2026-08-21T00:00:00.000Z",
    promptSource,
  });
  if (!data.validators.evaluationReport(report)) {
    for (const error of data.validators.evaluationReport.errors ?? []) {
      errors.push(`Informe determinista${error.instancePath || "/"}: ${error.message}`);
    }
  }
  const llmExample = JSON.parse(readFileSync(
    join(repositoryRoot, "policy/health-safety/examples/llm-evaluation-report.json"),
    "utf8",
  ));
  if (!data.validators.evaluationReport(llmExample)) {
    for (const error of data.validators.evaluationReport.errors ?? []) {
      errors.push(`Ejemplo de informe LLM${error.instancePath || "/"}: ${error.message}`);
    }
  }
  if (llmExample.authorizing !== false || llmExample.kind !== "llm-informative") {
    errors.push("El ejemplo LLM debe seguir siendo informativo y authorizing=false.");
  }
  for (const result of report.results) {
    if (!result.passed) errors.push(`El fixture seguro no supera ${result.caseId}.`);
  }

  const affectedCases = findAffectedCases(data.manifest.currentRelease.changedRuleIds, data.cases);
  console.log(`Política sanitaria ${data.manifest.policyVersion}: ${data.ruleSet.rules.length} reglas, ${data.cases.length} casos.`);
  console.log(`Casos afectados (${affectedCases.length}): ${affectedCases.join(", ")}`);

  if (errors.length > 0) {
    console.error("\nLa puerta sanitaria ha fallado:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Puerta sanitaria correcta: sin red, secretos ni evaluación LLM autorizadora.");
}

main();
