import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MEDICAL_DISCLAIMER,
  PRIVACY_POLICY_DIGESTS,
  PRIVACY_POLICY_URLS,
  PRIVACY_POLICY_VERSION,
} from "./generated/legalCopy.generated";

// App.tsx no es importable en Node, así que el contrato se asserta sobre su fuente.
// Lo que se protege aquí no es que hoy funcione, sino que la vía siga existiendo:
// el enlace legal es fácil de perder en un refactor del pie de Ajustes y nadie lo
// echaría de menos hasta la siguiente revisión de Google Play.
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const footerSource = readFileSync(new URL("../LegalFooter.tsx", import.meta.url), "utf8");
const esHtml = readFileSync(
  new URL("../public/privacidad/index.html", import.meta.url),
  "utf8",
);
const enHtml = readFileSync(new URL("../public/privacy/index.html", import.meta.url), "utf8");

describe("contrato estático del enlace legal en la app", () => {
  it("mantiene el pie legal renderizado en Ajustes", () => {
    expect(appSource).toContain("<LegalFooter />");
    expect(appSource).toContain('import { LegalFooter } from "./LegalFooter"');
  });

  it("mantiene el enlace y el descargo con sus identificadores de prueba", () => {
    expect(footerSource).toContain('testID="legal-privacy-link"');
    expect(footerSource).toContain('testID="legal-medical-disclaimer"');
    expect(footerSource).toContain('accessibilityRole="link"');
  });

  it("enlaza también desde la copia de seguridad, donde se explican los datos", () => {
    expect(appSource).toContain('testID="legal-backup-policy-link"');
    expect(appSource).toContain("#copias");
  });

  it("no duplica el copy legal fuera del módulo generado", () => {
    // Si el texto se escribiera a mano en la UI, dejaría de estar atado a
    // docs/legal/ y las dos versiones divergirían en silencio.
    expect(footerSource).toContain("MEDICAL_DISCLAIMER");
    expect(footerSource).not.toContain("dispositivo médico");
    expect(appSource).not.toContain("dispositivo médico");
    expect(appSource).not.toContain("gymnasia.maximofn.com");
    expect(footerSource).not.toContain("gymnasia.maximofn.com");
  });

  it("abre los enlaces externos por el helper que maneja el error", () => {
    // Una llamada cruda a Linking.openURL deja un rechazo sin gestionar y un botón
    // que falla en silencio. Para un aviso legal eso no es aceptable.
    expect(appSource).not.toContain("Linking.openURL(");
    expect(footerSource).toContain("openExternalUrl");
  });
});

describe("contrato entre la app y la política publicada", () => {
  it("publica el mismo digest que la app declara", () => {
    expect(esHtml).toContain(
      `<meta name="gymnasia-policy-digest" content="${PRIVACY_POLICY_DIGESTS.es}">`,
    );
    expect(enHtml).toContain(
      `<meta name="gymnasia-policy-digest" content="${PRIVACY_POLICY_DIGESTS.en}">`,
    );
  });

  it("publica la misma versión en ambos idiomas y en la app", () => {
    for (const html of [esHtml, enHtml]) {
      expect(html).toContain(
        `<meta name="gymnasia-policy-version" content="${PRIVACY_POLICY_VERSION}">`,
      );
    }
  });

  it("cada página se declara canónica en la URL que la app enlaza", () => {
    expect(esHtml).toContain(`<link rel="canonical" href="${PRIVACY_POLICY_URLS.es}">`);
    expect(enHtml).toContain(`<link rel="canonical" href="${PRIVACY_POLICY_URLS.en}">`);
  });

  it("cada idioma apunta al otro con hreflang", () => {
    expect(esHtml).toContain(`hreflang="en" href="${PRIVACY_POLICY_URLS.en}"`);
    expect(enHtml).toContain(`hreflang="es" href="${PRIVACY_POLICY_URLS.es}"`);
  });

  it("la página publicada contiene el mismo descargo sanitario que la app", () => {
    expect(esHtml).toContain(MEDICAL_DISCLAIMER.es);
    expect(enHtml).toContain(MEDICAL_DISCLAIMER.en);
  });

  it("la política es legible sin ejecutar nada ni cargar terceros", () => {
    // Una política que depende de un script o de un CDN puede quedarse en blanco
    // justo cuando alguien intenta leerla, y filtra al tercero quién la consulta.
    for (const html of [esHtml, enHtml]) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<link rel="stylesheet"/i);
      expect(html).not.toContain("http://");
    }
  });

  it("es indexable: no repite el noindex del tablero interno", () => {
    for (const html of [esHtml, enHtml]) {
      expect(html).not.toContain('name="robots"');
    }
  });

  it("cubre los apartados que exigen los criterios del ticket", () => {
    for (const id of [
      "byok",
      "proveedores",
      "copias",
      "denuncia",
      "eliminacion",
      "derechos",
      "no-dispositivo-medico",
    ]) {
      expect(esHtml).toContain(`id="${id}"`);
      expect(enHtml).toContain(`id="${id}"`);
    }
  });
});
