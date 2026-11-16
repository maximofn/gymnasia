import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { sha256, localToolchain } from "./local-build.mjs";
import { createReleaseTransaction, transitionReleaseTransaction, assertReleaseTransaction, selectReleaseAction } from "./release-transaction.mjs";
import { publishGithubApk } from "./publish-github-apk.mjs";

function fixture() {
  let tx = createReleaseTransaction({ version: "1.52.6", sourceCommit: "a".repeat(40), publicationTarget: "github-apk" });
  const source = { schemaVersion: 2, kind: "ProductionSourceEvidenceV2", result: "passed", publicationTarget: "github-apk",
    commit: tx.sourceCommit, appVersion: tx.version };
  const sourceBytes = Buffer.from(JSON.stringify(source));
  const data = new Map();
  const assets = [];
  let nextId = 1;
  function add(name, bytes, metadata = {}) {
    const asset = { id: nextId++, name, digest: `sha256:${sha256(bytes)}`, size: bytes.length, ...metadata };
    assets.push(asset); data.set(asset.id, bytes); return asset;
  }
  add("production-source-evidence.json", sourceBytes);
  for (const leg of ["aab", "apk"]) {
    tx = transitionReleaseTransaction(tx, "start-local", { leg, runId: "12", runAttempt: "1" });
    const attempt = tx.legs[leg].attempts.at(-1);
    const artifact = { filename: `gymnasia.${leg}`, sha256: (leg === "apk" ? "b" : "c").repeat(64), size: 100_000_000 };
    tx = transitionReleaseTransaction(tx, "finish-local", { leg, metadata: {
      schemaVersion: 2, backend: "wallabot-local", leg, attemptId: attempt.attemptId, sourceCommit: tx.sourceCommit,
      profile: attempt.profile, version: tx.version, status: "FINISHED", toolchain: { ...localToolchain }, artifact,
    } });
    const evidence = { schemaVersion: 2, kind: "ProductionArtifactEvidenceV2", result: "passed",
      source: { commit: tx.sourceCommit, profile: attempt.profile, evidenceSha256: sha256(sourceBytes) },
      build: { id: attempt.attemptId }, artifact: { ...artifact, publishedFilename: artifact.filename, type: leg,
        versionName: tx.version, versionCode: "86" } };
    const evidenceBytes = Buffer.from(JSON.stringify(evidence));
    add(`production-${leg}-evidence.json`, evidenceBytes);
    tx = transitionReleaseTransaction(tx, "validate-artifact", { leg, artifactSha256: artifact.sha256,
      artifactSize: artifact.size, evidenceSha256: sha256(evidenceBytes), versionCode: "86", versionCodeFloor: "85" });
    add(artifact.filename, Buffer.alloc(0), { digest: `sha256:${artifact.sha256}`, size: artifact.size,
      content_type: leg === "apk" ? "application/vnd.android.package-archive" : "application/octet-stream" });
  }
  add("android-release-transaction.json", Buffer.from(JSON.stringify(tx)));
  const release = { id: 1, tag_name: tx.tag, draft: true, immutable: false, target_commitish: tx.sourceCommit,
    html_url: `https://github.com/maximofn/gymnasia/releases/tag/${tx.tag}`, assets };
  const calls = [];
  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    calls.push({ url, method });
    assert.ok(["api.github.com", "uploads.github.com"].includes(parsed.hostname));
    assert.ok(parsed.pathname.startsWith("/repos/maximofn/gymnasia/"));
    if (parsed.hostname === "uploads.github.com") {
      assert.equal(method, "POST");
      return Response.json(add(parsed.searchParams.get("name"), Buffer.from(options.body)));
    }
    if (parsed.pathname.includes("/releases/assets/")) {
      const id = Number(parsed.pathname.split("/").at(-1));
      if (method === "DELETE") { assets.splice(assets.findIndex((asset) => asset.id === id), 1); data.delete(id); return new Response(null, { status: 204 }); }
      if (method === "PATCH") { const asset = assets.find((item) => item.id === id); Object.assign(asset, JSON.parse(options.body)); return Response.json(asset); }
      return new Response(data.get(id));
    }
    assert.equal(parsed.pathname, "/repos/maximofn/gymnasia/releases/1");
    if (method === "PATCH") { Object.assign(release, JSON.parse(options.body), { immutable: true }); }
    return Response.json(release);
  }
  return { tx, release, assets, data, calls, fetchImpl, options: { releaseId: 1, sourceCommit: tx.sourceCommit, token: "fake" } };
}

test("publica solo el APK, verifica la publicación y puede repetirse sin enviar a Play", async () => {
  const f = fixture();
  const result = await publishGithubApk({ ...f.options, fetchImpl: f.fetchImpl });
  assert.equal(result.transaction.state, "validated");
  assert.equal(result.transaction.legs.play.state, "prepared");
  assert.deepEqual(result.transaction.legs.play.attempts, []);
  assert.equal(f.release.draft, false);
  assert.equal(f.release.immutable, true);
  assert.equal(f.assets.some((asset) => asset.name === "gymnasia.aab"), false);
  assert.ok(f.assets.some((asset) => asset.name === "gymnasia.apk"));
  assert.match(f.release.body, /No se ha enviado a Google Play/);
  const mutations = f.calls.filter(({ method }) => method !== "GET").length;
  await publishGithubApk({ ...f.options, fetchImpl: f.fetchImpl });
  assert.equal(f.calls.filter(({ method }) => method !== "GET").length, mutations);
});

test("rechaza evidencias alteradas y otros commits antes de modificar el borrador", async () => {
  for (const name of ["production-source-evidence.json", "production-apk-evidence.json", "android-release-transaction.json"]) {
    const f = fixture();
    f.data.set(f.assets.find((asset) => asset.name === name).id, Buffer.from("changed"));
    await assert.rejects(publishGithubApk({ ...f.options, fetchImpl: f.fetchImpl }));
    assert.ok(f.calls.every(({ method }) => method === "GET"));
  }
  const f = fixture();
  await assert.rejects(publishGithubApk({ ...f.options, sourceCommit: "d".repeat(40), fetchImpl: f.fetchImpl }));
  assert.ok(f.calls.every(({ method }) => method === "GET"));
});

test("un corte al reemplazar la transacción se reanuda sin perder la evidencia ni recompilar", async () => {
  const f = fixture();
  let interrupted = false;
  const fetchImpl = async (url, options = {}) => {
    if (!interrupted && options.method === "PATCH" && url.includes("/releases/assets/")) {
      interrupted = true;
      return new Response(null, { status: 503 });
    }
    return f.fetchImpl(url, options);
  };
  await assert.rejects(publishGithubApk({ ...f.options, fetchImpl }));
  assert.equal(f.release.draft, true);
  assert.ok(f.assets.some((asset) => asset.name === "android-release-transaction.github-apk.json"));
  await publishGithubApk({ ...f.options, fetchImpl });
  assert.equal(f.release.draft, false);
  assert.ok(f.assets.some((asset) => asset.name === "android-release-transaction.json"));
});

test("el destino queda fijado al crear la transacción y ninguna operación Play está permitida", () => {
  const f = fixture();
  assert.throws(() => selectReleaseAction({ transactions: [f.tx], publishedVersions: [], currentVersion: f.tx.version,
    currentCommit: f.tx.sourceCommit, publicationTarget: "play" }), /destino no puede cambiar/);
  const selected = selectReleaseAction({ transactions: [f.tx], publishedVersions: [], currentVersion: f.tx.version,
    currentCommit: f.tx.sourceCommit, publicationTarget: "github-apk" });
  assert.equal(selected.mode, "resume");
  for (const event of ["prepare-play", "adopt-submission", "observe-play", "validate-play", "fail-play", "start-play-retry"]) {
    assert.throws(() => transitionReleaseTransaction(f.tx, event, { leg: "play" }), /solo autoriza/);
  }
  fc.assert(fc.property(fc.string().filter((target) => !["play", "github-apk"].includes(target)), (publicationTarget) => {
    assert.throws(() => assertReleaseTransaction({ ...f.tx, publicationTarget }), /Destino/);
  }));
});
