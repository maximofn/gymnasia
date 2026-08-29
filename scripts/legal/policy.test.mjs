// Tests de la fuente única de la política de privacidad, creada en GYM-190
// (ticket para publicar la política y preparar las declaraciones de salud).
//
// Dos cosas que proteger: que el generador no deforme el texto legal al
// convertirlo en HTML, y que la validación impida publicar un documento
// incompleto, desincronizado entre idiomas o con afirmaciones que la
// arquitectura no sostiene.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LOCALES,
  REQUIRED_SECTION_IDS,
  buildArtifacts,
  canonicalText,
  digestFor,
  loadPolicies,
  loadPolicy,
  parseFrontMatter,
  parseSections,
  renderGeneratedModule,
  renderHtml,
  renderInline,
  validatePolicies,
} from "./policy.mjs";

const fixture = (overrides = {}) => ({
  locale: "es",
  meta: {
    version: "2026-08-v1",
    effective_date: "2026-08-22",
    locale: "es",
    lang: "es",
    title: "Título",
    url: "https://gymnasia.maximofn.com/privacidad",
    alternate_locale: "en",
    alternate_url: "https://gymnasia.maximofn.com/privacy",
    contact: "maximofn@maximofn.com",
    toc_title: "Contenido",
    ...(overrides.meta ?? {}),
  },
  sections:
    overrides.sections ??
    REQUIRED_SECTION_IDS.map((id) => ({
      id,
      heading: `Sección ${id}`,
      blocks: [
        {
          type: "p",
          text:
            id === "no-dispositivo-medico"
              ? "**Gymnasia no es un dispositivo médico.**"
              : "Contenido de la sección.",
        },
      ],
    })),
});

test("el parser separa metadatos del cuerpo", () => {
  const { meta, body } = parseFrontMatter('---\nversion: 1\ncontroller: "Nombre"\n---\n## A {#a}\n\nTexto.\n');
  assert.equal(meta.version, "1");
  assert.equal(meta.controller, "Nombre");
  assert.match(body, /^## A \{#a\}/);
});

test("el parser rechaza un documento sin metadatos", () => {
  assert.throws(() => parseFrontMatter("## A {#a}\n"), /bloque de metadatos/);
});

test("el parser reconoce secciones, párrafos y listas", () => {
  const sections = parseSections(
    [
      "## Primera {#primera}",
      "",
      "Un párrafo",
      "partido en dos líneas.",
      "",
      "- Un elemento",
      "  que continúa.",
      "- Otro elemento",
      "",
      "## Segunda {#segunda}",
      "",
      "Texto.",
    ].join("\n"),
  );
  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].blocks[0], { type: "p", text: "Un párrafo partido en dos líneas." });
  assert.deepEqual(sections[0].blocks[1], {
    type: "ul",
    items: ["Un elemento que continúa.", "Otro elemento"],
  });
  assert.equal(sections[1].id, "segunda");
});

test("el markdown en línea se convierte sin abrir un agujero de inyección", () => {
  assert.equal(renderInline("**fuerte**"), "<strong>fuerte</strong>");
  assert.equal(renderInline("`código`"), "<code>código</code>");
  assert.equal(
    renderInline("[AEPD](https://www.aepd.es)"),
    '<a href="https://www.aepd.es" rel="noopener noreferrer">AEPD</a>',
  );
  assert.equal(renderInline("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  // Un enlace no-HTTPS no se convierte en enlace: se queda como texto escapado.
  assert.equal(renderInline("[x](http://inseguro.example)"), "[x](http://inseguro.example)");
});

test("el digest cambia con el texto legal pero no con la presentación", () => {
  const base = fixture();
  const same = fixture();
  assert.equal(digestFor(base), digestFor(same));

  const changed = fixture();
  changed.sections[0].blocks[0].text = "Contenido distinto.";
  assert.notEqual(digestFor(base), digestFor(changed));

  // El digest se calcula sobre el texto canónico, no sobre el HTML.
  assert.equal(canonicalText(base).includes("<"), false);
});

test("el HTML publicado lleva versión, digest, hreflang y canonical", () => {
  const policy = fixture();
  const html = renderHtml(policy);
  assert.match(html, /<meta name="gymnasia-policy-version" content="2026-08-v1">/);
  assert.ok(html.includes(`<meta name="gymnasia-policy-digest" content="${digestFor(policy)}">`));
  assert.match(html, /<link rel="canonical" href="https:\/\/gymnasia\.maximofn\.com\/privacidad">/);
  assert.match(html, /hreflang="en" href="https:\/\/gymnasia\.maximofn\.com\/privacy"/);
  assert.match(html, /<html lang="es">/);
  // Una política que carga un tercero para leerse sería una contradicción.
  assert.equal(/<script/i.test(html), false);
  assert.equal(html.includes("http://"), false);
  assert.equal(/src=|<link rel="stylesheet"/.test(html), false);
});

test("no se publica una política a la que le falta una sección obligatoria", () => {
  const policy = fixture();
  policy.sections = policy.sections.filter((section) => section.id !== "byok");
  const codes = validatePolicies([policy]).map((violation) => violation.code);
  assert.ok(codes.includes("section-missing"));
});

test("no se publica una sección vacía", () => {
  const policy = fixture();
  policy.sections[0].blocks = [];
  assert.ok(validatePolicies([policy]).some((v) => v.code === "section-empty"));
});

test("los idiomas deben tener exactamente las mismas secciones", () => {
  const es = fixture();
  const en = fixture({ meta: { locale: "en" } });
  en.locale = "en";
  en.sections = en.sections.filter((section) => section.id !== "denuncia");
  const violation = validatePolicies([es, en]).find((v) => v.code === "locales-out-of-sync");
  assert.ok(violation);
  assert.match(violation.message, /denuncia/);
});

test("los idiomas deben declarar la misma versión", () => {
  const es = fixture();
  const en = fixture({ meta: { version: "2026-09-v2" } });
  en.locale = "en";
  assert.ok(validatePolicies([es, en]).some((v) => v.code === "version-out-of-sync"));
});

test("una afirmación que la arquitectura no sostiene bloquea la publicación", () => {
  // Es exactamente lo que decía docs/architecture/security-and-privacy.md.
  const policy = fixture();
  policy.sections[0].blocks[0].text = "Las claves se guardan cifradas en servidor.";
  const violation = validatePolicies([policy]).find((v) => v.code === "prohibited-claim");
  assert.ok(violation);
  assert.match(violation.message, /cifradas en servidor/);
});

test("un marcador sin completar bloquea la publicación", () => {
  const policy = fixture({ meta: { controller: "[COMPLETAR: responsable]" } });
  assert.ok(validatePolicies([policy]).some((v) => v.code === "unresolved-placeholder"));
});

test("una URL que no sea HTTPS bloquea la publicación", () => {
  const policy = fixture({ meta: { url: "http://gymnasia.maximofn.com/privacidad" } });
  assert.ok(validatePolicies([policy]).some((v) => v.code === "url-not-https"));
});

test("el módulo generado expone solo lo que la app necesita", () => {
  const es = fixture();
  const en = fixture({ meta: { locale: "en", url: "https://gymnasia.maximofn.com/privacy" } });
  en.locale = "en";
  const module = renderGeneratedModule([es, en]);
  assert.match(module, /GENERADO: no editar a mano/);
  assert.match(module, /PRIVACY_POLICY_URLS/);
  assert.match(module, /PRIVACY_POLICY_DIGESTS/);
  assert.match(module, /MEDICAL_DISCLAIMER/);
  // El descargo llega sin los asteriscos del markdown.
  assert.match(module, /"Gymnasia no es un dispositivo médico\."/);
  // La prosa completa no viaja en el bundle de la app.
  assert.equal(module.includes("Contenido de la sección."), false);
});

test("los documentos reales tienen las 20 secciones en ambos idiomas", () => {
  const policies = loadPolicies();
  assert.equal(policies.length, LOCALES.length);
  for (const policy of policies) {
    assert.deepEqual(
      policy.sections.map((section) => section.id),
      REQUIRED_SECTION_IDS,
      `la política ${policy.locale} no tiene las secciones esperadas o están en otro orden`,
    );
  }
});

test("los documentos reales solo tienen pendiente completar el responsable", () => {
  // Mientras el responsable no esté relleno, publicar debe seguir bloqueado; lo
  // que este test protege es que no haya NINGÚN otro defecto esperando debajo.
  const violations = validatePolicies(loadPolicies());
  const otras = violations.filter((violation) => violation.code !== "unresolved-placeholder");
  assert.deepEqual(otras, []);
});

test("la política española describe el borrado parcial real, no uno ideal", () => {
  // GYM-162 (ticket para hacer veraz y completo el borrado local) aún no ha
  // cerrado: si alguien 'mejora' este texto antes de arreglar el
  // borrado, la política publicada pasaría a mentir.
  const canonical = canonicalText(loadPolicy("es"));
  assert.match(canonical, /borrado \*\*parcial\*\*/);
  assert.match(canonical, /\*\*No elimina\*\*/);
});

test("ambos idiomas declaran que no es un dispositivo médico", () => {
  const [es, en] = loadPolicies();
  assert.match(canonicalText(es), /no es un dispositivo médico/i);
  assert.match(canonicalText(en), /is not a medical device/i);
});

test("ambos idiomas fijan la audiencia en 16 años o más", () => {
  const [es, en] = loadPolicies();
  const spanish = canonicalText(es);
  const english = canonicalText(en);
  assert.match(spanish, /16 años o más/i);
  assert.match(spanish, /no está diseñada para menores de 16 años/i);
  assert.doesNotMatch(spanish, /menores de 14 años/i);
  assert.match(english, /16 or older/i);
  assert.match(english, /not designed for children under 16/i);
  assert.doesNotMatch(english, /children under 14/i);
});

test("buildArtifacts produce un HTML por idioma más el módulo de la app", () => {
  const paths = buildArtifacts(loadPolicies()).map(([path]) => path);
  assert.equal(paths.length, 3);
  assert.ok(paths.some((path) => path.endsWith("public/privacidad/index.html")));
  assert.ok(paths.some((path) => path.endsWith("public/privacy/index.html")));
  assert.ok(paths.some((path) => path.endsWith("legalCopy.generated.ts")));
});
