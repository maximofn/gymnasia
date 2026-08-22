// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = "2026-08-v1";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-08-22";
export const PRIVACY_POLICY_CONTACT = "maximofn@maximofn.com";

export const PRIVACY_POLICY_URLS = {
  es: "https://gymnasia.maximofn.com/privacidad",
  en: "https://gymnasia.maximofn.com/privacy",
} as const;

export const PRIVACY_POLICY_DIGESTS = {
  es: "sha256:e49a26cf449dae39a7497ce5f554c798a05b35eb92e5fdfdbbb9d5a4e6e369b3",
  en: "sha256:a29dcb14d1a1d6031aebf1358c94baec7d1a3755ba0d03cb7cf7d85a10200920",
} as const;

export const MEDICAL_DISCLAIMER = {
  es: "Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un profesional sanitario.",
  en: "Gymnasia is not a medical device and does not replace advice from a healthcare professional.",
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
