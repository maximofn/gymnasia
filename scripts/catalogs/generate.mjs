#!/usr/bin/env node

import { CATALOG_DOMAINS, formatCatalogViolations, inspectCatalogs, writeCatalogArtifacts } from "./catalogs.mjs";

function usage() {
  console.error(
    "Uso: node scripts/catalogs/generate.mjs --check|--write " +
    "[--domain alimentos|productos_comerciales|recetas|ejercicios]",
  );
}

function parseArguments(argv) {
  const options = { mode: null, domain: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check" || argument === "--write") {
      if (options.mode) throw new Error("Elige solo uno de --check o --write.");
      options.mode = argument;
    } else if (argument === "--domain") {
      options.domain = argv[index + 1] ?? null;
      index += 1;
    } else {
      throw new Error(`Argumento desconocido: ${argument}`);
    }
  }
  if (!options.mode) throw new Error("Falta --check o --write.");
  if (options.domain && !Object.hasOwn(CATALOG_DOMAINS, options.domain)) {
    throw new Error(`Dominio desconocido: ${options.domain}`);
  }
  if (options.mode === "--check" && options.domain) {
    throw new Error("--domain solo se admite con --write; el check siempre valida todo.");
  }
  return options;
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  usage();
  console.error(error.message);
  process.exit(2);
}

const inspection = await inspectCatalogs({ checkGenerated: options.mode === "--check" });
if (inspection.violations.length > 0) {
  console.error("Los catálogos no pueden publicarse todavía:\n");
  for (const line of formatCatalogViolations(inspection.violations)) console.error(`  ${line}`);
  process.exit(1);
}

if (options.mode === "--write") {
  const domains = options.domain ? [options.domain] : Object.keys(CATALOG_DOMAINS);
  const written = await writeCatalogArtifacts(inspection.artifacts, { domains });
  console.log(`Catálogos sincronizados: ${written.length} artefacto(s) generado(s).`);
} else {
  const records = Object.values(inspection.summary).reduce((total, domain) => total + domain.records, 0);
  const images = Object.values(inspection.summary).reduce((total, domain) => total + domain.images, 0);
  console.log(
    `Catálogos verificados: ${records} registros, ${images} recursos referenciados y ` +
    `${inspection.artifacts.length} artefacto(s) al día.`,
  );
}
