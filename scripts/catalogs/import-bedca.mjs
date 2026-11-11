#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolve, relative, isAbsolute } from "node:path";
import { bedcaLocalRoot, downloadBedcaSource, assertLocalBedcaDirectory, sha256 } from "./bedca-source.mjs";
import { loadBedcaSnapshot, createBedcaArtifacts, writeBedcaArtifacts, checkBedcaArtifacts, checkBedcaPublication } from "./bedca.mjs";

try {
  const options = { workspace: bedcaLocalRoot };
  const args = process.argv.slice(2);
  const seenOptions = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--write", "--check", "--check-publication"].includes(arg)) {
      assert.ok(!options.mode, "Elige un único modo BEDCA"); options.mode = arg;
    } else if (arg === "--download") { assert.ok(!options.download, "--download repetido"); options.download = true; }
    else if (["--workspace-dir", "--source-dir", "--output-dir", "--snapshot-sha256"].includes(arg)) {
      const value = args[++index]; assert.ok(value && !value.startsWith("--"), `Falta el valor de ${arg}`);
      const key = { "--workspace-dir": "workspace", "--source-dir": "source", "--output-dir": "output", "--snapshot-sha256": "snapshot" }[arg];
      assert.ok(!seenOptions.has(key), `Opción BEDCA repetida: ${arg}`); seenOptions.add(key);
      options[key] = key === "snapshot" ? value : resolve(value);
    } else throw new Error(`Opción BEDCA desconocida: ${arg}`);
  }
  assert.ok(options.mode, "Uso: import-bedca.mjs --write|--check [--download] [--workspace-dir RUTA] [--source-dir RUTA] [--output-dir RUTA] [--snapshot-sha256 SHA] | --check-publication");
  checkBedcaPublication();
  if (options.mode === "--check-publication") {
    assert.equal(args.length, 1, "La comprobación de publicación no admite más opciones");
    console.log("BEDCA: ningún dato real registrado en Git; redistribución bloqueada.");
  } else {
    assert.ok(!(options.mode === "--check" && options.download), "El check BEDCA no descarga ni escribe");
    if (options.snapshot) assert.match(options.snapshot, /^[a-f0-9]{64}$/, "Huella BEDCA inválida");
    const source = await assertLocalBedcaDirectory(resolve(options.source ?? resolve(options.workspace, "source")));
    const output = await assertLocalBedcaDirectory(resolve(options.output ?? resolve(options.workspace, "catalog")));
    const inside = (parent, child) => { const path = relative(parent, child); return path === "" || path !== ".." && !path.startsWith("../") && !isAbsolute(path); };
    assert.ok(!inside(source, output) && !inside(output, source), "Origen y salida BEDCA deben estar separados, sin anidarse");
    if (options.download) {
      const abort = new AbortController();
      const stop = () => abort.abort(new Error("Descarga interrumpida; se conservan los recibos para reanudar"));
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      try { await downloadBedcaSource(source, { signal: abort.signal, progress: ({ downloaded, total }) => console.log(`BEDCA: ${downloaded}/${total} fichas verificadas en la captura local.`) }); }
      finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
    }
    const snapshot = await loadBedcaSnapshot(source);
    if (options.snapshot) assert.equal(snapshot.snapshotId, options.snapshot, "La captura BEDCA no coincide con la huella fijada");
    const artifacts = createBedcaArtifacts(snapshot);
    if (options.mode === "--write") await writeBedcaArtifacts(output, artifacts);
    const counts = await checkBedcaArtifacts(output, artifacts);
    console.log(JSON.stringify({ source, output, snapshot_sha256: snapshot.snapshotId, catalog_manifest_sha256: sha256(artifacts.get("manifest.json")), counts, redistribution: "blocked" }, null, 2));
  }
} catch (error) {
  console.error(`BEDCA: ${error.message}`);
  process.exitCode = 1;
}
