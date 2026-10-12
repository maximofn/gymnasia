import { createHash } from "node:crypto";
import { loadReleasePolicy, productionGateLabels } from "./production-release.mjs";
import { createReleaseTransaction, transitionReleaseTransaction } from "./release-transaction.mjs";
import { localToolchain } from "./local-build.mjs";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function fixture(bytes = Buffer.from("verified AAB test fixture")) {
  const policy = loadReleasePolicy();
  let transaction = createReleaseTransaction({ version: "1.51.0", sourceCommit: "a".repeat(40) });
  const sourceBytes = Buffer.from(JSON.stringify({
    schemaVersion: 2, kind: "ProductionSourceEvidenceV2", result: "passed", commit: transaction.sourceCommit,
    appVersion: transaction.version, contractViolations: [],
    source: { clean: true, cleanAfterGates: true, reachableFromProduction: true },
    gates: productionGateLabels().map((command) => ({ command, result: "passed", exitCode: 0 })),
  }));
  const evidenceBytes = Buffer.from(JSON.stringify({
    schemaVersion: 2, kind: "ProductionArtifactEvidenceV2", result: "passed", violations: [],
    source: { commit: transaction.sourceCommit, profile: "production", evidenceSha256: hash(sourceBytes) },
    artifact: { type: "aab", packageName: policy.android.packageName, versionName: transaction.version,
      versionCode: "86", certificateSha256: policy.android.uploadCertificateSha256, sha256: hash(bytes), size: bytes.length },
  }));
  for (const leg of ["aab", "apk"]) {
    transaction = transitionReleaseTransaction(transaction, "start-local", { leg, runId: "12", runAttempt: "1" });
    const attempt = transaction.legs[leg].attempts.at(-1);
    transaction = transitionReleaseTransaction(transaction, "finish-local", { leg, metadata: {
      schemaVersion: 2, backend: "wallabot-local", leg, attemptId: attempt.attemptId,
      sourceCommit: transaction.sourceCommit, profile: attempt.profile, version: transaction.version,
      status: "FINISHED", toolchain: { ...localToolchain },
      artifact: { filename: `gymnasia.${leg}`, sha256: hash(bytes), size: bytes.length },
    } });
    transaction = transitionReleaseTransaction(transaction, "validate-artifact", {
      leg, artifactSha256: hash(bytes), artifactSize: bytes.length, evidenceSha256: hash(evidenceBytes),
      versionCode: "86", versionCodeFloor: "85",
    });
  }
  return { transaction, sourceBytes, evidenceBytes, bytes };
}
