#!/usr/bin/env node
import { join, resolve } from "node:path";

import {
  checkCiqualArtifacts, ciqualRoot, downloadCiqualSource, loadCiqualSource, writeCiqualArtifacts,
} from "./ciqual.mjs";

try {
  const args = process.argv.slice(2);
  const options = { mode: null, download: false, sourceDirectory: join(ciqualRoot, ".source") };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write" || arg === "--check") {
      if (options.mode) throw new Error("Elige --write o --check, una sola vez.");
      options.mode = arg;
    } else if (arg === "--download") {
      options.download = true;
    } else if (arg === "--source-dir") {
      const path = args[++index];
      if (!path || path.startsWith("--")) throw new Error("Falta el directorio de los XML originales.");
      options.sourceDirectory = resolve(path);
      options.verifySource = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}.`);
    }
  }
  if (!options.mode) throw new Error("Uso: import-ciqual.mjs --write|--check [--source-dir directorio] [--download]");
  if (options.mode === "--check" && options.download) throw new Error("El check no descarga ni escribe archivos.");
  if (options.download) await downloadCiqualSource(options.sourceDirectory);
  if (options.mode === "--write") {
    const catalog = await loadCiqualSource(options.sourceDirectory);
    await writeCiqualArtifacts(catalog);
    console.log(`CIQUAL importado: ${catalog.foods.length} alimentos, ${catalog.nutrients.length} componentes.`);
  } else {
    const sourceCatalog = options.verifySource ? await loadCiqualSource(options.sourceDirectory) : null;
    const counts = await checkCiqualArtifacts(ciqualRoot, sourceCatalog);
    console.log(`CIQUAL verificado${sourceCatalog ? " contra los XML oficiales" : " sin red"}: ${counts.foods} alimentos, ${counts.nutrients} componentes, ${counts.measurements} valores.`);
  }
} catch (error) {
  console.error(`CIQUAL: ${error.message}`);
  process.exitCode = 1;
}
