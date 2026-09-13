import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlayEvidence,
  sanitizeEasError,
  selectAdoptableBuild,
  selectAdoptableSubmission,
} from "./eas-release.mjs";
import { createReleaseTransaction, transitionReleaseTransaction } from "./release-transaction.mjs";

const expectedBuild = {
  profile: "production",
  version: "1.44.0",
  commit: "a".repeat(40),
  message: "android-v1.44.0-aab-attempt-1",
};

test("adopta builds solo por perfil, versión, commit y mensaje exactos", () => {
  const exact = {
    id: "build-1",
    buildProfile: "production",
    appVersion: "1.44.0",
    gitCommitHash: "a".repeat(40),
    message: "android-v1.44.0-aab-attempt-1",
    platform: "ANDROID",
    status: "FINISHED",
  };
  assert.equal(selectAdoptableBuild([
    { ...exact, id: "wrong-profile", buildProfile: "production-apk" },
    exact,
  ], expectedBuild).id, "build-1");
  assert.equal(selectAdoptableBuild([], expectedBuild), null);
  assert.throws(() => selectAdoptableBuild([exact, { ...exact, id: "build-2" }], expectedBuild), /no es seguro/);
});

test("adopta una submission paginada por build, track y releaseStatus", () => {
  const exact = {
    id: "submission-1",
    status: "IN_PROGRESS",
    submittedBuild: { id: "build-1" },
    androidConfig: { track: "INTERNAL", releaseStatus: "COMPLETED" },
  };
  assert.equal(selectAdoptableSubmission([
    { ...exact, id: "wrong", submittedBuild: { id: "build-2" } },
    exact,
  ], {
    buildId: "build-1",
    track: "internal",
    releaseStatus: "completed",
  }).id, "submission-1");
});

function transactionReadyForPlay() {
  let value = createReleaseTransaction({
    version: "1.44.0",
    sourceCommit: "a".repeat(40),
    minimumVersionCode: 21,
  });
  for (const [leg, buildId, sha] of [["aab", "build-aab", "b"], ["apk", "build-apk", "c"]]) {
    value = transitionReleaseTransaction(value, "submit", { leg, buildId });
    value = transitionReleaseTransaction(value, "observe", {
      leg,
      status: "FINISHED",
      artifactUrl: `https://expo.dev/${buildId}`,
    });
    value = transitionReleaseTransaction(value, "validate", {
      leg,
      artifactSha256: sha.repeat(64),
      artifactSize: 100_000_000,
      evidenceSha256: (leg === "aab" ? "d" : "e").repeat(64),
      versionName: "1.44.0",
      versionCode: 22,
    });
  }
  value = transitionReleaseTransaction(value, "submit", {
    leg: "play",
    buildId: "build-aab",
    submissionId: "submission-1",
  });
  return transitionReleaseTransaction(value, "observe", { leg: "play", status: "FINISHED" });
}

test("la evidencia Play enlaza exactamente submission, AAB, track y versión", () => {
  const evidence = createPlayEvidence({
    transaction: transactionReadyForPlay(),
    submission: {
      id: "submission-1",
      status: "FINISHED",
      submittedBuild: { id: "build-aab" },
      androidConfig: { track: "internal", releaseStatus: "completed" },
    },
  });
  assert.equal(evidence.result, "passed");
  assert.equal(evidence.versionCode, 22);
  assert.deepEqual(evidence.violations, []);
});

test("sanea errores de credenciales antes de guardarlos", () => {
  assert.equal(
    sanitizeEasError("google service key=super-secret\nInvalid credential"),
    "[credencial saneada] Invalid credential",
  );
});
