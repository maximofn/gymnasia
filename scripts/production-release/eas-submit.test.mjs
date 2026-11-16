import assert from "node:assert/strict";
import test from "node:test";
import { extractSubmissionId, normalizeSubmission } from "./eas-submit.mjs";

test("extrae el submission ID de la URL que devuelve EAS", () => {
  assert.equal(
    extractSubmissionId("Details: https://expo.dev/accounts/max/projects/gymnasia/submissions/123e4567-e89b-42d3-a456-426614174000"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
});

test("normaliza track, releaseStatus y error sin credenciales", () => {
  const value = normalizeSubmission({
    id: "submission-1",
    status: "errored",
    platform: "android",
    androidConfig: { track: "INTERNAL", releaseStatus: "COMPLETED" },
    error: { errorCode: "BAD_CREDENTIAL", message: "google_key=supersecret" },
  });
  assert.equal(value.track, "internal");
  assert.equal(value.releaseStatus, "completed");
  assert.doesNotMatch(value.error.message, /supersecret/);
});

test("los envíos por path sin submittedBuild siguen siendo válidos", () => {
  const value = normalizeSubmission({
    id: "submission-2",
    status: "FINISHED",
    platform: "ANDROID",
    androidConfig: { track: "internal", releaseStatus: "completed" },
    submittedBuild: null,
  });
  assert.equal(value.id, "submission-2");
  assert.equal(value.status, "FINISHED");
});
