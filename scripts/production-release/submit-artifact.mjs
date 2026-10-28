import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertReleaseTransaction } from "./release-transaction.mjs";
import { loadReleasePolicy, normalizeCertificateDigest, productionGateLabels } from "./production-release.mjs";

export function verifySubmissionArtifact({ artifact, transaction, sourceBytes, evidenceBytes }) {
  assertReleaseTransaction(transaction);
  const policy = loadReleasePolicy();
  const source = JSON.parse(sourceBytes);
  const evidence = JSON.parse(evidenceBytes);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(transaction.schemaVersion, 2);
  assert.equal(transaction.publicationTarget ?? "play", "play", "La transacción no autoriza Google Play.");
  assert.equal(source.publicationTarget ?? "play", "play", "La fuente no autoriza Google Play.");
  assert.ok(["artifacts-validated", "submitting"].includes(transaction.state));
  assert.equal(source.schemaVersion, 2);
  assert.equal(source.kind, "ProductionSourceEvidenceV2");
  assert.equal(source.result, "passed");
  assert.equal(source.commit, transaction.sourceCommit);
  assert.equal(source.appVersion, transaction.version);
  assert.deepEqual(source.contractViolations, []);
  assert.equal(source.source.clean, true);
  assert.equal(source.source.cleanAfterGates, true);
  assert.equal(source.source.reachableFromProduction, true);
  assert.deepEqual(source.gates.map((gate) => gate.command), productionGateLabels());
  assert.ok(source.gates.every((gate) => gate.result === "passed" && gate.exitCode === 0));
  assert.equal(evidence.kind, "ProductionArtifactEvidenceV2");
  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.result, "passed");
  assert.deepEqual(evidence.violations, []);
  assert.equal(evidence.source.commit, transaction.sourceCommit);
  assert.equal(evidence.source.profile, "production");
  assert.equal(evidence.source.evidenceSha256, digest(sourceBytes));
  assert.equal(digest(evidenceBytes), transaction.legs.aab.artifact.evidenceSha256);
  assert.equal(evidence.artifact.type, "aab");
  assert.equal(evidence.artifact.packageName, policy.android.packageName);
  assert.equal(evidence.artifact.versionName, transaction.version);
  assert.equal(evidence.artifact.versionCode, transaction.versionCode);
  assert.equal(normalizeCertificateDigest(evidence.artifact.certificateSha256),
    normalizeCertificateDigest(policy.android.uploadCertificateSha256));
  const bytes = readFileSync(artifact);
  assert.equal(bytes.length, transaction.legs.aab.artifact.size, "El tamaño del AAB descargado cambió.");
  const sha256 = digest(bytes);
  assert.equal(sha256, transaction.legs.aab.artifact.sha256, "El AAB descargado no es el validado.");
  assert.equal(sha256, evidence.artifact.sha256);
  assert.equal(bytes.length, evidence.artifact.size);
  return { sha256, versionCode: transaction.versionCode };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      assert.ok(args[index].startsWith("--") && args[index + 1]);
      options[args[index].slice(2)] = args[index + 1];
    }
    const result = verifySubmissionArtifact({
      artifact: resolve(options.artifact),
      transaction: JSON.parse(readFileSync(resolve(options.transaction), "utf8")),
      sourceBytes: readFileSync(resolve(options["source-evidence"])),
      evidenceBytes: readFileSync(resolve(options["artifact-evidence"])),
    });
    console.log(`AAB de envío verificado: ${result.versionCode}, ${result.sha256}.`);
  } catch {
    console.error("El AAB descargado o su evidencia no coincide con la transacción validada.");
    process.exitCode = 1;
  }
}
