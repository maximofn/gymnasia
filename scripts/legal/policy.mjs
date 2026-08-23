// Fuente única de la política de privacidad publicada (GYM-190).
//
// El texto legal se escribe una sola vez, en docs/legal/privacy-policy.<locale>.md,
// y de ahí salen las páginas publicadas y las constantes que consume la app. Si el
// HTML se editase a mano acabaría diciendo algo distinto del markdown revisado en el
// PR, y la discrepancia no se notaría hasta que alguien la contrastase a mano.
//
// Cada sección lleva un identificador explícito (`{#id}`) que debe ser el mismo en
// todos los idiomas: es lo que permite comprobar que las traducciones no divergen y
// que ninguna sección obligatoria desaparece de una de ellas.
//
// Sin dependencias externas: solo stdlib de Node.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, "..", "..");
export const LOCALES = ["es", "en"];

export const sourcePathFor = (locale) =>
  join(repoRoot, "docs", "legal", `privacy-policy.${locale}.md`);

export const htmlPathFor = (locale) =>
  join(repoRoot, "apps", "mobile", "public", locale === "es" ? "privacidad" : "privacy", "index.html");

export const generatedModulePath = join(
  repoRoot, "apps", "mobile", "agent", "generated", "legalCopy.generated.ts",
);

// Un apartado por criterio de aceptación de GYM-190. Si alguien borra una sección,
// el chequeo falla en vez de publicarse una política incompleta.
export const REQUIRED_SECTION_IDS = [
  "resumen",
  "responsable",
  "sin-cuenta",
  "datos",
  "almacenamiento-local",
  "byok",
  "proveedores",
  "fotos",
  "terceros",
  "copias",
  "denuncia",
  "permisos",
  "web",
  "conservacion",
  "eliminacion",
  "menores",
  "derechos",
  "no-dispositivo-medico",
  "cambios",
  "contacto",
];

// Afirmaciones que la arquitectura real no sostiene. docs/architecture/security-and-privacy.md
// las daba por buenas durante meses; publicarlas ante Google Play sería declarar en falso.
export const PROHIBITED_CLAIMS = [
  "cifradas en servidor",
  "cifradas en nuestro servidor",
  "en nuestros servidores",
  "nuestro backend",
  "borrado de cuenta",
  "on our servers",
  "our backend",
  "we store your api key",
  "account deletion",
];

const PLACEHOLDER_PATTERN = /\[COMPLETAR:[^\]]*\]/g;

export function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("El documento no empieza por un bloque de metadatos '---'.");
  const meta = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error(`Metadato sin ':' → ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

/** Divide el cuerpo en secciones `## Título {#id}` con bloques de párrafo y lista. */
export function parseSections(body) {
  const sections = [];
  let current = null;
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      current.blocks.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      current.blocks.push({ type: "ul", items: list });
      list = null;
    }
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^##\s+(.*?)\s*\{#([a-z0-9-]+)\}\s*$/);
    if (heading) {
      if (current) {
        flushParagraph();
        flushList();
        sections.push(current);
      }
      current = { id: heading[2], heading: heading[1], blocks: [] };
      continue;
    }
    if (!current) continue;

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list = list ?? [];
      list.push(bullet[1]);
      continue;
    }
    // Continuación de un elemento de lista partido en varias líneas.
    if (list && /^\s{2,}\S/.test(rawLine)) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  if (current) {
    flushParagraph();
    flushList();
    sections.push(current);
  }
  return sections;
}

export function loadPolicy(locale) {
  const text = readFileSync(sourcePathFor(locale), "utf8");
  const { meta, body } = parseFrontMatter(text);
  return { locale, meta, sections: parseSections(body) };
}

export function loadPolicies() {
  return LOCALES.map(loadPolicy);
}

/**
 * Texto canónico del documento: lo que de verdad dice, sin depender de su
 * presentación. El digest se calcula sobre esto para que un retoque de CSS no
 * invalide la verificación, pero un cambio de una sola palabra legal sí lo haga.
 */
export function canonicalText(policy) {
  const lines = [
    `version:${policy.meta.version}`,
    `effective_date:${policy.meta.effective_date}`,
    `locale:${policy.locale}`,
  ];
  for (const section of policy.sections) {
    lines.push(`#${section.id}`, section.heading);
    for (const block of section.blocks) {
      if (block.type === "p") lines.push(block.text);
      else for (const item of block.items) lines.push(`- ${item}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function digestFor(policy) {
  return `sha256:${createHash("sha256").update(canonicalText(policy), "utf8").digest("hex")}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Markdown en línea acotado a propósito: negrita, código y enlaces. */
export function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
    if (!href.startsWith("https://")) return match;
    return `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

const STYLES = `
:root { color-scheme: dark; --bg:#0A0E14; --surface:#131A24; --text:#E8EDF4; --muted:#9AA7B8; --accent:#CBFF1A; --border:#243040; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; line-height:1.65; }
main { max-width:46rem; margin:0 auto; padding:2.5rem 1.25rem 5rem; }
h1 { font-size:1.9rem; line-height:1.25; margin:0 0 .5rem; }
h2 { font-size:1.2rem; margin:2.5rem 0 .75rem; scroll-margin-top:1rem; }
h2 a { color:inherit; text-decoration:none; }
h2 a:hover::after { content:" #"; color:var(--accent); }
p, li { color:var(--text); }
a { color:var(--accent); }
code { background:var(--surface); padding:.1rem .35rem; border-radius:.25rem; font-size:.9em; overflow-wrap:anywhere; }
ul { padding-left:1.25rem; }
li { margin:.35rem 0; }
.meta { color:var(--muted); font-size:.9rem; margin:0 0 2rem; }
.langs { margin:0 0 2rem; font-size:.9rem; }
nav { background:var(--surface); border:1px solid var(--border); border-radius:.75rem; padding:1rem 1.25rem; margin:0 0 2rem; }
nav h2 { font-size:.85rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 .5rem; }
nav ul { list-style:none; padding:0; margin:0; columns:2; }
nav li { margin:.2rem 0; break-inside:avoid; }
footer { margin-top:3rem; padding-top:1.5rem; border-top:1px solid var(--border); color:var(--muted); font-size:.85rem; }
@media (max-width:34rem){ nav ul { columns:1; } }
`.trim();

export function renderHtml(policy) {
  const { meta, sections } = policy;
  const digest = digestFor(policy);
  const alternateLabel = policy.locale === "es" ? "English version" : "Versión en español";

  const toc = sections
    .map((section) => `      <li><a href="#${section.id}">${escapeHtml(section.heading)}</a></li>`)
    .join("\n");

  const body = sections
    .map((section) => {
      const blocks = section.blocks
        .map((block) =>
          block.type === "p"
            ? `    <p>${renderInline(block.text)}</p>`
            : `    <ul>\n${block.items.map((item) => `      <li>${renderInline(item)}</li>`).join("\n")}\n    </ul>`,
        )
        .join("\n");
      return [
        `  <section id="${section.id}">`,
        `    <h2><a href="#${section.id}">${escapeHtml(section.heading)}</a></h2>`,
        blocks,
        "  </section>",
      ].join("\n");
    })
    .join("\n\n");

  const effectiveLabel =
    policy.locale === "es"
      ? `Versión ${meta.version} · en vigor desde ${meta.effective_date}`
      : `Version ${meta.version} · in force since ${meta.effective_date}`;

  return `<!doctype html>
<html lang="${meta.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.title)}">
<meta name="gymnasia-policy-version" content="${meta.version}">
<meta name="gymnasia-policy-digest" content="${digest}">
<link rel="canonical" href="${meta.url}">
<link rel="alternate" hreflang="${meta.locale}" href="${meta.url}">
<link rel="alternate" hreflang="${meta.alternate_locale}" href="${meta.alternate_url}">
<style>
${STYLES}
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(meta.title)}</h1>
  <p class="meta">${effectiveLabel} · <a href="mailto:${meta.contact}">${meta.contact}</a></p>
  <p class="langs"><a href="${meta.alternate_url}">${alternateLabel}</a></p>
  <nav>
    <h2>${escapeHtml(meta.toc_title)}</h2>
    <ul>
${toc}
    </ul>
  </nav>

${body}

  <footer>
    <p>${escapeHtml(meta.title)} · ${meta.version} · ${meta.effective_date}</p>
  </footer>
</main>
</body>
</html>
`;
}

/**
 * Módulo fino para la app: URLs, versión y descargo sanitario. La prosa completa se
 * queda fuera a propósito, porque la app solo necesita enlazar y declarar, no
 * empaquetar el documento entero.
 */
export function renderGeneratedModule(policies) {
  const byLocale = Object.fromEntries(policies.map((policy) => [policy.locale, policy]));
  const es = byLocale.es;
  const disclaimerFor = (policy) => {
    const section = policy.sections.find((entry) => entry.id === "no-dispositivo-medico");
    const first = section.blocks.find((block) => block.type === "p");
    return first.text.replace(/\*\*/g, "");
  };
  const quote = (value) => JSON.stringify(value);

  return `// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = ${quote(es.meta.version)};
export const PRIVACY_POLICY_EFFECTIVE_DATE = ${quote(es.meta.effective_date)};
export const PRIVACY_POLICY_CONTACT = ${quote(es.meta.contact)};

export const PRIVACY_POLICY_URLS = {
${policies.map((policy) => `  ${policy.locale}: ${quote(policy.meta.url)},`).join("\n")}
} as const;

export const PRIVACY_POLICY_DIGESTS = {
${policies.map((policy) => `  ${policy.locale}: ${quote(digestFor(policy))},`).join("\n")}
} as const;

export const MEDICAL_DISCLAIMER = {
${policies.map((policy) => `  ${policy.locale}: ${quote(disclaimerFor(policy))},`).join("\n")}
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
`;
}

/** Comprobaciones que deben pasar antes de publicar. */
export function validatePolicies(policies) {
  const violations = [];
  const push = (code, message) => violations.push({ code, message });

  for (const policy of policies) {
    const ids = policy.sections.map((section) => section.id);
    for (const required of REQUIRED_SECTION_IDS) {
      if (!ids.includes(required)) {
        push("section-missing", `La política ${policy.locale} no tiene la sección obligatoria '${required}'.`);
      }
    }
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) push("section-duplicated", `La política ${policy.locale} repite la sección '${id}'.`);
      seen.add(id);
    }
    for (const section of policy.sections) {
      if (section.blocks.length === 0) {
        push("section-empty", `La sección '${section.id}' de la política ${policy.locale} no tiene contenido.`);
      }
    }
    for (const key of ["version", "effective_date", "url", "contact", "lang", "title"]) {
      if (!policy.meta[key]) {
        push("metadata-missing", `La política ${policy.locale} no declara '${key}' en sus metadatos.`);
      }
    }
    if (policy.meta.url && !policy.meta.url.startsWith("https://")) {
      push("url-not-https", `La URL de la política ${policy.locale} no es HTTPS: ${policy.meta.url}`);
    }

    const canonical = canonicalText(policy).toLowerCase();
    for (const claim of PROHIBITED_CLAIMS) {
      if (canonical.includes(claim)) {
        push(
          "prohibited-claim",
          `La política ${policy.locale} afirma "${claim}", que la arquitectura local-first no sostiene.`,
        );
      }
    }
    const placeholders = canonicalText(policy).match(PLACEHOLDER_PATTERN) ?? [];
    const metaPlaceholders = Object.values(policy.meta).join("\n").match(PLACEHOLDER_PATTERN) ?? [];
    for (const placeholder of [...placeholders, ...metaPlaceholders]) {
      push(
        "unresolved-placeholder",
        `La política ${policy.locale} conserva el marcador ${placeholder}. Complétalo antes de publicar.`,
      );
    }
  }

  const [first, ...rest] = policies;
  for (const policy of rest) {
    const a = first.sections.map((section) => section.id);
    const b = policy.sections.map((section) => section.id);
    if (a.join("|") !== b.join("|")) {
      push(
        "locales-out-of-sync",
        `Las secciones de '${policy.locale}' no coinciden con las de '${first.locale}'. Faltan: ${a.filter((id) => !b.includes(id)).join(", ") || "ninguna"}. Sobran: ${b.filter((id) => !a.includes(id)).join(", ") || "ninguna"}.`,
      );
    }
    if (policy.meta.version !== first.meta.version) {
      push("version-out-of-sync", `La política '${policy.locale}' declara la versión ${policy.meta.version} y '${first.locale}' la ${first.meta.version}.`);
    }
  }

  return violations;
}

/** Artefactos generados, en la forma que espera generate.mjs. */
export function buildArtifacts(policies) {
  const artifacts = policies.map((policy) => [htmlPathFor(policy.locale), renderHtml(policy)]);
  artifacts.push([generatedModulePath, renderGeneratedModule(policies)]);
  return artifacts;
}
