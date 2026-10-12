#!/usr/bin/env node
import assert from "node:assert/strict";
import { sign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadReleasePolicy } from "./production-release.mjs";
import { assertReleaseTransaction } from "./release-transaction.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

async function requestJson(fetchImpl, url, options = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new Error("No se pudo consultar Google Play; no se valida la publicación.");
  }
  if (!response.ok) throw new Error(`Google Play devolvió HTTP ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

export async function getGooglePlayAccessToken(key, fetchImpl = fetch) {
  const auth = await requestJson(fetchImpl, TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createServiceAccountAssertion(key) }),
  });
  assert.ok(typeof auth.access_token === "string" && auth.access_token.length > 0, "Google no devolvió un token.");
  return auth.access_token;
}

export function assertGooglePlayReceipt(receipt, transaction, track = loadReleasePolicy().play.track) {
  assert.equal(receipt?.schemaVersion, 1);
  assert.equal(receipt?.kind, "GooglePlayArtifactReceiptV1");
  assert.equal(receipt.packageName, loadReleasePolicy().android.packageName);
  assert.equal(receipt.versionCode, transaction.versionCode);
  assert.equal(receipt.sha256, transaction.legs.aab.artifact.sha256,
    "Google Play recibió otro AAB.");
  assert.equal(receipt.track, track);
  assert.equal(receipt.releaseStatus, "completed");
  assert.match(receipt.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  return receipt;
}

export function createServiceAccountAssertion(key, now = Math.floor(Date.now() / 1000)) {
  assert.equal(key.type, "service_account");
  assert.equal(key.client_email, loadReleasePolicy().play.verificationServiceAccount,
    "La verificación exige la cuenta de servicio auditada.");
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT", kid: key.private_key_id })}.${encode({
    iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 300,
  })}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), key.private_key).toString("base64url")}`;
}

// Solo crea y descarta una copia temporal: nunca sube archivos, modifica tracks
// ni llama a edits.commit. Debe ejecutarse después de que EAS termine.
export async function observeGooglePlayArtifact({ transaction, key, fetchImpl = fetch }) {
  assertReleaseTransaction(transaction);
  assert.equal(transaction.schemaVersion, 2);
  assert.ok(["submitting", "validated"].includes(transaction.state));
  assert.equal(transaction.legs.play.submission?.status, "FINISHED",
    "No consultar mediante edits mientras EAS esté enviando.");
  const policy = loadReleasePolicy();
  const request = (url, options) => requestJson(fetchImpl, url, options);
  const token = await getGooglePlayAccessToken(key, fetchImpl);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${policy.android.packageName}/edits`;
  const edit = await request(base, { method: "POST", headers, body: "{}" });
  assert.match(edit.id, /^[a-zA-Z0-9_-]+$/);
  const editUrl = `${base}/${edit.id}`;
  let receipt;
  try {
    const bundles = await request(`${editUrl}/bundles`, { headers });
    const track = await request(`${editUrl}/tracks/${policy.play.track}`, { headers });
    const matches = (bundles.bundles ?? []).filter((bundle) => String(bundle.versionCode) === transaction.versionCode);
    assert.equal(matches.length, 1, "Google no conserva un único bundle con ese versionCode.");
    const release = (track.releases ?? []).find((candidate) => candidate.status === "completed"
      && candidate.versionCodes?.map(String).includes(transaction.versionCode));
    assert.ok(release, "El bundle no pertenece a una versión completada en el track esperado.");
    receipt = assertGooglePlayReceipt({
      schemaVersion: 1, kind: "GooglePlayArtifactReceiptV1", packageName: policy.android.packageName,
      versionCode: String(matches[0].versionCode), sha256: matches[0].sha256,
      track: track.track, releaseStatus: release.status, observedAt: new Date().toISOString(),
    }, transaction);
  } finally {
    // Si falla la limpieza tampoco emitimos una evidencia aprobada.
    await request(editUrl, { method: "DELETE", headers });
  }
  return receipt;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(args[index].startsWith("--") && args[index + 1], "Argumentos inválidos.");
    options[args[index].slice(2)] = args[index + 1];
  }
  const credentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
    || (options["service-account-file"] ? readFileSync(resolve(options["service-account-file"]), "utf8") : "");
  assert.ok(credentials, "Configura GOOGLE_PLAY_SERVICE_ACCOUNT_JSON en Play Internal; no se valida por omisión.");
  let key;
  try { key = JSON.parse(credentials); } catch { throw new Error("La credencial de Google no es JSON válido."); }
  if (options["check-credential"] === "true") {
    await getGooglePlayAccessToken(key);
    console.log("Google acepta la credencial auditada; no se ha creado ningún edit ni enviado ningún archivo.");
    return;
  }
  assert.ok(options.transaction && options.output, "Faltan --transaction y --output.");
  const transaction = JSON.parse(readFileSync(resolve(options.transaction), "utf8"));
  const receipt = await observeGooglePlayArtifact({ transaction, key });
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Google Play confirma el AAB ${receipt.versionCode}: ${receipt.sha256}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    // No volcar errores de crypto/JSON que puedan contener partes de la clave.
    console.error("No se pudo verificar el artefacto en Google Play. No publicar sin un recibo válido.");
    process.exitCode = 1;
  });
}
