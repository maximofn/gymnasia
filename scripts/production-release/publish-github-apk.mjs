#!/usr/bin/env node
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sha256 } from "./local-build.mjs";
import { loadReleasePolicy } from "./production-release.mjs";
import { assertGithubApkRelease, transitionReleaseTransaction } from "./release-transaction.mjs";

export async function publishGithubApk({ releaseId, sourceCommit, token, fetchImpl = fetch }) {
  assert.match(String(releaseId), /^[1-9]\d*$/);
  assert.match(String(sourceCommit), /^[a-f0-9]{40}$/);
  assert.ok(token, "Falta la credencial de GitHub.");
  const repository = loadReleasePolicy().repository;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  async function request(route, options = {}) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/${route}`, {
      headers, ...options,
    });
    assert.ok(response.ok, `GitHub rechazó la operación: HTTP ${response.status}.`);
    return response;
  }
  const readRelease = async () => (await request(`releases/${releaseId}`)).json();
  async function readAsset(release, name) {
    const asset = release.assets.find((item) => item.name === name)
      ?? (name === "android-release-transaction.json"
        ? release.assets.find((item) => item.name === "android-release-transaction.github-apk.json") : null);
    assert.ok(asset, `Falta ${name}.`);
    const response = await request(`releases/assets/${asset.id}`, {
      headers: { ...headers, Accept: "application/octet-stream" },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(`sha256:${sha256(bytes)}`, asset.digest, `La evidencia ${name} ha cambiado.`);
    return JSON.parse(bytes);
  }
  let release = await readRelease();
  const [original, sourceEvidence, aabEvidence, apkEvidence] = await Promise.all([
    readAsset(release, "android-release-transaction.json"),
    readAsset(release, "production-source-evidence.json"),
    readAsset(release, "production-aab-evidence.json"),
    readAsset(release, "production-apk-evidence.json"),
  ]);
  assert.equal(original.publicationTarget, "github-apk", "La publicación solo admite el destino GitHub APK.");
  assert.equal(original.sourceCommit, sourceCommit);
  const transaction = original.state === "validated"
    ? original : transitionReleaseTransaction(original, "validate-github-apk");
  const input = { transaction, sourceEvidence, aabEvidence, apkEvidence, currentCommit: sourceCommit };
  if (!release.draft) {
    assertGithubApkRelease({ ...input, release });
    return { url: release.html_url, transaction };
  }
  const aab = release.assets.find((asset) => asset.name === "gymnasia.aab");
  if (aab) {
    assert.equal(aab.digest, `sha256:${transaction.legs.aab.artifact.sha256}`);
    assert.equal(aab.size, transaction.legs.aab.artifact.size);
  }
  // Validate the complete intended release before changing any draft asset.
  assertGithubApkRelease({ ...input, allowDraft: true,
    release: { ...release, assets: release.assets.filter((asset) => asset.name !== "gymnasia.aab") } });
  if (aab) await request(`releases/assets/${aab.id}`, { method: "DELETE" });
  const previous = release.assets.find((asset) => asset.name === "android-release-transaction.json");
  const bytes = Buffer.from(`${JSON.stringify(transaction, null, 2)}\n`);
  if (`sha256:${sha256(bytes)}` !== previous?.digest) {
    // Upload before replacing the canonical asset, so an interrupted publication
    // always leaves a durable transaction and can resume without another build.
    let staged = release.assets.find((asset) => asset.name === "android-release-transaction.github-apk.json");
    if (!staged) {
      const uploaded = await fetchImpl(
        `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=android-release-transaction.github-apk.json`, {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: bytes,
        },
      );
      assert.ok(uploaded.ok, `No se pudo conservar la transacción validada: HTTP ${uploaded.status}.`);
      staged = await uploaded.json();
    }
    assert.equal(staged.digest, `sha256:${sha256(bytes)}`);
    if (previous) await request(`releases/assets/${previous.id}`, { method: "DELETE" });
    await request(`releases/assets/${staged.id}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "android-release-transaction.json" }),
    });
  }
  release = await readRelease();
  assertGithubApkRelease({ ...input, release, allowDraft: true });
  assert.deepEqual(await readAsset(release, "android-release-transaction.json"), transaction);
  const notes = [
    `## Gymnasia ${transaction.version} — APK`, "",
    "Descarga gymnasia.apk e instálalo como actualización, conservando los datos existentes.",
    "Esta publicación contiene solo el APK para instalación directa. No se ha enviado a Google Play.", "",
    `- Commit: ${sourceCommit}`,
    `- versionCode: ${transaction.versionCode}`,
    `- APK SHA-256: ${transaction.legs.apk.artifact.sha256}`,
    "- Ambos formatos se compilaron en wallabot y se verificaron antes de publicar únicamente el APK.",
  ].join("\n");
  await request(`releases/${releaseId}`, {
    method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ body: notes, draft: false, make_latest: "true" }),
  });
  release = await readRelease();
  assertGithubApkRelease({ ...input, release });
  return { url: release.html_url, transaction };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  publishGithubApk({ releaseId: process.env.RELEASE_ID, sourceCommit: process.env.SOURCE_COMMIT, token: process.env.GH_TOKEN })
    .then(({ url, transaction }) => {
      console.log(`APK ${transaction.version} publicado y verificado: ${url}`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `APK publicado en ${url}. No se ha enviado a Google Play.\n`);
      }
    }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
