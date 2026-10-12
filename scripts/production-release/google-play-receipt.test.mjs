import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import fc from "fast-check";
import { createServiceAccountAssertion, observeGooglePlayArtifact, assertGooglePlayReceipt } from "./google-play-receipt.mjs";
import { fixture } from "./release-test-fixtures.mjs";
import { transitionReleaseTransaction } from "./release-transaction.mjs";
import { loadReleasePolicy } from "./production-release.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = { type: "service_account", client_email: loadReleasePolicy().play.verificationServiceAccount,
  private_key_id: "test-key", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
let transaction = transitionReleaseTransaction(fixture().transaction, "prepare-play", {
  leg: "play", artifactSha256: fixture().transaction.legs.aab.artifact.sha256, versionCode: "86",
});
transaction = transitionReleaseTransaction(transaction, "adopt-submission", {
  leg: "play", submissionId: "test-submission", status: "FINISHED",
});
function remote({ sha256 = transaction.legs.aab.artifact.sha256, status = "completed", fail = "" } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method ?? "GET" });
    if (url.endsWith(fail) && fail) return new Response("private credential must not be logged", { status: 403 });
    if (url.endsWith("/token")) return Response.json({ access_token: "fake-sensitive-token" });
    if (options.method === "POST") return Response.json({ id: "test-edit" });
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    if (url.endsWith("/bundles")) return Response.json({ bundles: [{ versionCode: 86, sha256 }] });
    return Response.json({ track: "alpha", releases: [{ versionCodes: ["86"], status }] });
  };
  return { calls, fetchImpl };
}

test("firma una assertion limitada a Google y cinco minutos, sin delegar usuarios", () => {
  const jwt = createServiceAccountAssertion(key, 1234);
  const [header, claims, signature] = jwt.split(".");
  assert.ok(verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, "base64url")));
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url")), {
    iss: key.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: 1234, exp: 1534,
  });
  assert.throws(() => createServiceAccountAssertion({ ...key, client_email: "other@example.com" }));
});

test("integra OAuth, bundles y track; descarta el edit y solo emite datos públicos", async () => {
  const mock = remote();
  const receipt = await observeGooglePlayArtifact({ transaction, key, fetchImpl: mock.fetchImpl });
  assert.equal(receipt.sha256, transaction.legs.aab.artifact.sha256);
  assert.equal(receipt.versionCode, "86");
  assert.equal(mock.calls.at(-1).method, "DELETE");
  assert.equal(mock.calls.filter((call) => call.method === "POST").length, 2);
  assert.ok(mock.calls.every((call) => !/commit|upload/.test(call.url)));
  assert.doesNotMatch(JSON.stringify(receipt), /fake-sensitive-token|PRIVATE KEY/);
});

test("regresión: hash diferente o track sin completar bloquea y limpia el edit", async () => {
  for (const options of [{ sha256: "0".repeat(64) }, { status: "draft" }, { fail: "/bundles" }]) {
    const mock = remote(options);
    await assert.rejects(observeGooglePlayArtifact({ transaction, key, fetchImpl: mock.fetchImpl }),
      (error) => !error.message.includes("private credential"));
    assert.equal(mock.calls.at(-1).method, "DELETE");
  }
});

test("no confirma una publicación si no se pudo descartar el edit", async () => {
  const mock = remote({ fail: "/test-edit" });
  await assert.rejects(observeGooglePlayArtifact({ transaction, key, fetchImpl: mock.fetchImpl }));
});

test("no abre un edit ni solicita un token mientras EAS siga activo", async () => {
  const active = structuredClone(transaction);
  active.legs.play.submission.status = "IN_PROGRESS";
  active.legs.play.attempts.at(-1).status = "IN_PROGRESS";
  const mock = remote();
  await assert.rejects(observeGooglePlayArtifact({ transaction: active, key, fetchImpl: mock.fetchImpl }));
  assert.equal(mock.calls.length, 0);
});

test("propiedad: ninguna huella distinta de la del AAB validado pasa", () => {
  fc.assert(fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (bytes) => {
    const sha256 = Buffer.from(bytes).toString("hex");
    fc.pre(sha256 !== transaction.legs.aab.artifact.sha256);
    assert.throws(() => assertGooglePlayReceipt({ schemaVersion: 1, kind: "GooglePlayArtifactReceiptV1",
      packageName: loadReleasePolicy().android.packageName, versionCode: "86", sha256,
      track: "alpha", releaseStatus: "completed", observedAt: new Date().toISOString() }, transaction));
  }));
});
