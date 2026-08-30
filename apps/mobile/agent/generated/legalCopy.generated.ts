// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = "2026-08-v9";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-08-30";
export const PRIVACY_POLICY_CONTACT = "maximofn@maximofn.com";

export const PRIVACY_POLICY_URLS = {
  es: "https://gymnasia.maximofn.com/privacidad",
  en: "https://gymnasia.maximofn.com/privacy",
} as const;

export const PRIVACY_POLICY_DIGESTS = {
  es: "sha256:d482a3e01731ab4191cee1f182a70a4dcd59374b5f6020c0fd6d02190a8e2ad0",
  en: "sha256:2aa316979627c585f85689f9411a7d003c779f404ccfdc88bc54360b6796c72f",
} as const;

export const MEDICAL_DISCLAIMER = {
  es: "Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un profesional sanitario.",
  en: "Gymnasia is not a medical device and does not replace advice from a healthcare professional.",
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
