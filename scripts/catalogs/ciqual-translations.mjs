import { createHash } from "node:crypto";

const domains = ["foods", "groups", "nutrients"];
const digest = (value) => createHash("sha256").update(value).digest("hex");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function ciqualNameFingerprint(names) {
  return digest(JSON.stringify({ fr: names.fr, en: names.en }));
}

// Las traducciones son datos de curación versionados, no resultados generados
// durante la importación. Un cambio en el texto oficial exige revisarlas.
export function applyCiqualTranslations(catalog, translations) {
  requireValue(translations?.schema_version === 1, "Versión de traducciones CIQUAL desconocida.");
  requireValue(translations.dataset_id === "anses-ciqual-2025", "Las traducciones no pertenecen a CIQUAL 2025.");
  requireValue(translations.locale === "es-ES", "Idioma de traducciones CIQUAL desconocido.");
  requireValue(typeof translations.provenance?.attribution === "string" && translations.provenance.attribution.length > 0,
    "Falta la atribución de las traducciones CIQUAL.");

  const result = { ...catalog, translations };
  for (const domain of domains) {
    const entries = translations[domain];
    requireValue(entries && typeof entries === "object" && !Array.isArray(entries), `Faltan traducciones de ${domain}.`);
    const ids = new Set(catalog[domain].map((row) => row.id));
    const extras = Object.keys(entries).filter((id) => !ids.has(id));
    requireValue(extras.length === 0, `Traducciones sin ficha de origen en ${domain}: ${extras.join(", ")}.`);
    result[domain] = catalog[domain].map((row) => {
      requireValue(Object.hasOwn(entries, row.id), `Falta traducción de ${domain}/${row.id}.`);
      const entry = entries[row.id];
      requireValue(entry?.source_sha256 === ciqualNameFingerprint(row.names), `Traducción obsoleta de ${domain}/${row.id}: ha cambiado el nombre oficial.`);
      requireValue(typeof entry.name === "string" && entry.name === entry.name.trim() && entry.name.length > 0 && !/[\u0000-\u001f\u007f]/u.test(entry.name),
        `Traducción vacía o inválida de ${domain}/${row.id}.`);
      return { ...row, names: { ...row.names, es: entry.name } };
    });
  }
  return result;
}
