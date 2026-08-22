import { writeFileSync } from "node:fs";
import process from "node:process";

import { createEvaluationReport, loadHealthSafetyPolicy } from "./policy.mjs";

function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  if ((outputIndex >= 0 && !args[outputIndex + 1]) || args.some((arg, index) => (
    arg !== "--output" && index !== outputIndex + 1
  ))) {
    console.error("Uso: node scripts/health-safety/report.mjs [--output ruta.json]");
    process.exitCode = 2;
    return;
  }
  const data = loadHealthSafetyPolicy();
  const report = createEvaluationReport(data);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputIndex >= 0) {
    writeFileSync(args[outputIndex + 1], serialized, "utf8");
    console.log(`Informe escrito en ${args[outputIndex + 1]}. authorizing=false`);
    return;
  }
  process.stdout.write(serialized);
}

main();
