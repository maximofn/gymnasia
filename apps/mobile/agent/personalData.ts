/**
 * Frontera de forma de los datos personales locales (GYM-139).
 *
 * Los campos de "Memoria del coach" son datos que el agente consulta mediante
 * tools; nunca son texto que se anexe al system prompt. Esa garantía NO vive
 * aquí: la da `sendMessage` en `App.tsx`, que ya no lee este almacén al
 * construir la petición, y la prueban `personalData.contract.test.ts` (sobre el
 * fuente de `App.tsx`) y el E2E (sobre el payload real enviado al proveedor).
 *
 * Lo que aporta este módulo es higiene de forma, no seguridad: convierte un
 * valor arbitrario —JSON del almacén, argumento de tool escrito por el modelo,
 * fichero de backup ajeno— en un array bien formado. Sin esto, un
 * `[{"key": 5}]` o un `["hola"]` se persisten tal cual y acaban pintados en un
 * `TextInput` de la pestaña Memoria.
 *
 * No hay lista de claves prohibidas a propósito. Una vez eliminada la
 * concatenación, `debug` es un nombre de campo corriente y sin ningún poder;
 * bloquearlo sería arbitrario y sugeriría que el mecanismo sigue existiendo.
 */

export type PersonalDataField = {
  key: string;
  description: string;
  value: string;
};

function coerceText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return null;
}

/**
 * Normaliza la FORMA de un array de campos sin reescribir su CONTENIDO.
 *
 * Descarta elementos que no son objetos y los que no tienen una `key` con algo
 * más que espacios. Coacciona números y booleanos a texto, porque el modelo
 * escribe `"value": 75` con frecuencia.
 *
 * PRESERVA la `key` literal: no la recorta ni la normaliza. Las tools de
 * lectura casan por igualdad exacta (`readFieldValue`, `readFieldDescription`),
 * así que reescribirla dejaría inaccesible la memoria real del usuario — un
 * campo `Objetivo` guardado como `objetivo` ya no se encuentra.
 *
 * Tampoco deduplica ni limita longitudes. Total (nunca lanza) e idempotente.
 */
export function sanitizePersonalDataFields(input: unknown): PersonalDataField[] {
  if (!Array.isArray(input)) return [];
  const sanitized: PersonalDataField[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    const key = coerceText(candidate.key);
    if (key === null || key.trim().length === 0) continue;
    sanitized.push({
      key,
      description: coerceText(candidate.description) ?? "",
      value: coerceText(candidate.value) ?? "",
    });
  }
  return sanitized;
}

/**
 * Cuántos elementos se descartaron al sanear. Se usa para avisar al modelo:
 * `save_personal_data` reescribe el array entero, así que un descarte
 * silencioso le haría creer que guardó un campo que no existe.
 */
export function countDiscardedPersonalDataFields(input: unknown): number {
  const total = Array.isArray(input) ? input.length : 0;
  return total - sanitizePersonalDataFields(input).length;
}
