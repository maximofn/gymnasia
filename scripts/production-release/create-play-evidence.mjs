#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertReleaseTransaction } from "./release-transaction.mjs";
import { loadReleasePolicy } from "./production-release.mjs";

function argumentsFrom(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Argumentos inválidos.");
    options[argv[index].slice(2)] = argv[index + 1];
  }
  for (const name of ["transaction", "submission", "output"]) {
    if (!options[name]) throw new Error(`Falta --${name}.`);
  }
  return options;
}

const options = argumentsFrom(process.argv.slice(2));
const transaction = assertReleaseTransaction(JSON.parse(readFileSync(resolve(options.transaction), "utf8")));
const submission = JSON.parse(readFileSync(resolve(options.submission), "utf8"));
const policy = loadReleasePolicy();
const violations = [];
if (transaction.schemaVersion !== 2 || transaction.state !== "submitting") violations.push("La transacción no está enviando.");
if (submission.id !== transaction.legs.play.submission?.id) violations.push("El submission no coincide con la intención durable.");
if (submission.status !== "FINISHED") violations.push("EAS no confirmó FINISHED.");
if (submission.platform !== "ANDROID") violations.push("El submission no es Android.");
if (submission.track !== policy.play.track) violations.push(`El track no es ${policy.play.track}.`);
if (submission.releaseStatus !== policy.play.releaseStatus) violations.push(`El releaseStatus no es ${policy.play.releaseStatus}.`);

const evidence = {
  schemaVersion: 2,
  kind: "ProductionPlayEvidenceV2",
  result: violations.length === 0 ? "passed" : "failed",
  verifiedAt: new Date().toISOString(),
  provider: policy.play.provider,
  profile: policy.play.profile,
  track: policy.play.track,
  releaseStatus: policy.play.releaseStatus,
  source: { commit: transaction.sourceCommit, version: transaction.version },
  artifact: {
    filename: transaction.legs.aab.artifact.filename,
    sha256: transaction.legs.aab.artifact.sha256,
    versionCode: transaction.versionCode,
  },
  submission: {
    id: submission.id,
    status: submission.status,
    createdAt: submission.createdAt ?? null,
    completedAt: submission.completedAt ?? null,
  },
  error: submission.error ?? null,
  violations,
};
const output = resolve(options.output);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
if (violations.length > 0) throw new Error(`La subida a Play no es publicable: ${violations.join(" ")}`);
console.log(createHash("sha256").update(readFileSync(output)).digest("hex"));
