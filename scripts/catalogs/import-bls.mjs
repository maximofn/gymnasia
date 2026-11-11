#!/usr/bin/env node
import { join, resolve } from "node:path";
import { assertBlsDirectories, blsRoot, loadBlsSource, downloadBlsSource, writeBlsArtifacts, checkBlsArtifacts } from "./bls.mjs";

try {
  const args = process.argv.slice(2);
  let mode;
  let download = false;
  let source = join(blsRoot, "source");
  let output = blsRoot;
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (seen.has(arg)) throw new Error(`Argumento duplicado: ${arg}`);
    seen.add(arg);
    if (arg === "--write" || arg === "--check") {
      if (mode) throw new Error("Elige --write o --check una sola vez");
      mode = arg;
    } else if (arg === "--download") download = true;
    else if (arg === "--source-dir" || arg === "--output-dir") {
      const path = args[++index];
      if (!path || path.startsWith("--")) throw new Error(`Falta el directorio de ${arg}`);
      if (arg === "--source-dir") source = resolve(path);
      else output = resolve(path);
    } else throw new Error(`Argumento desconocido: ${arg}`);
  }
  if (!mode) throw new Error("Uso: import-bls.mjs --write|--check [--download] [--source-dir carpeta] [--output-dir carpeta]");
  if (mode === "--check" && download) throw new Error("El check BLS no usa red ni escribe archivos");
  assertBlsDirectories(source, output);
  if (download) await downloadBlsSource(source);
  const catalog = await loadBlsSource(source);
  const counts = mode === "--write" ? await writeBlsArtifacts(catalog, output) : await checkBlsArtifacts(catalog, output);
  console.log(JSON.stringify({ dataset: "mri-bls-4.0-2025", mode, counts, source, output }, null, 2));
} catch (error) {
  console.error(`BLS: ${error.message}`);
  process.exitCode = 1;
}
