// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = "2026-09-v10";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-09-29";
export const PRIVACY_POLICY_CONTACT = "maximofn@maximofn.com";

export const PRIVACY_POLICY_URLS = {
  es: "https://gymnasia.maximofn.com/privacidad",
  en: "https://gymnasia.maximofn.com/privacy",
} as const;

export const PRIVACY_POLICY_DIGESTS = {
  es: "sha256:209d94accfd5cead9f44440f4fdf15635ea082ffa8b4f53896e3477717949c73",
  en: "sha256:2cfc9757ccc311aa6f9ccc92b9a4bce7e19a338064134ca9d4fb0e052e50c0fe",
} as const;

export const MEDICAL_DISCLAIMER = {
  es: "Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un profesional sanitario.",
  en: "Gymnasia is not a medical device and does not replace advice from a healthcare professional.",
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
