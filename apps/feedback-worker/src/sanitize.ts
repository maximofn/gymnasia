/**
 * Saneado del contenido que llega del cliente.
 *
 * Se aplica antes de persistir, registrar o enviar a GitHub. Nada de lo que
 * entre aquí puede acabar en un log ni en el cuerpo de una issue sin pasar por
 * `redactSecrets`.
 */

/**
 * Patrones de credenciales conocidas. La lista no pretende ser exhaustiva
 * --eso es imposible-- sino cubrir lo que un usuario pega por accidente.
 *
 * Se guardan como fuente y se compilan al usarse: una RegExp global es
 * mutable (`lastIndex`) y compartirla entre llamadas da falsos negativos.
 */
const SECRET_PATTERNS: Array<{ source: string; label: string }> = [
  { source: String.raw`\bghp_[A-Za-z0-9]{20,}\b`, label: "GITHUB_TOKEN" },
  { source: String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}\b`, label: "GITHUB_TOKEN" },
  { source: String.raw`\bgho_[A-Za-z0-9]{20,}\b`, label: "GITHUB_TOKEN" },
  { source: String.raw`\bsk-ant-[A-Za-z0-9_-]{20,}`, label: "ANTHROPIC_KEY" },
  { source: String.raw`\bsk-[A-Za-z0-9_-]{20,}`, label: "OPENAI_KEY" },
  { source: String.raw`\bAIza[A-Za-z0-9_-]{30,}`, label: "GOOGLE_KEY" },
  { source: String.raw`\blin_api_[A-Za-z0-9]{20,}\b`, label: "LINEAR_KEY" },
  { source: String.raw`\bhf_[A-Za-z0-9]{20,}\b`, label: "HF_TOKEN" },
  {
    source: String.raw`\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`,
    label: "JWT",
  },
  { source: String.raw`\bBearer\s+[A-Za-z0-9._-]{20,}`, label: "BEARER" },
];

/** Sustituye credenciales reconocibles por un marcador. Nunca lanza. */
export function redactSecrets(input: string): string {
  let output = input;
  for (const { source, label } of SECRET_PATTERNS) {
    output = output.replace(new RegExp(source, "gi"), `[${label} REDACTADO]`);
  }
  return output;
}

/** True si el texto contiene algún patrón de credencial reconocible. */
export function containsSecret(input: string): boolean {
  return SECRET_PATTERNS.some(({ source }) => new RegExp(source, "i").test(input));
}

const LINE_FEED = 0x0a;
const UNIT_SEPARATOR = 0x1f;
const DELETE_CHARACTER = 0x7f;

/**
 * Se comparan códigos en vez de usar una expresión regular con escapes de
 * control: un carácter de control literal en el fuente es invisible y fácil de
 * romper al editar el fichero.
 */
function isControlCharacter(codePoint: number, keepNewlines: boolean): boolean {
  if (keepNewlines && codePoint === LINE_FEED) return false;
  return codePoint <= UNIT_SEPARATOR || codePoint === DELETE_CHARACTER;
}

function stripControlCharacters(
  input: string,
  options: { keepNewlines?: boolean } = {},
): string {
  const keepNewlines = options.keepNewlines === true;
  let output = "";
  for (const character of input.normalize("NFC")) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && isControlCharacter(codePoint, keepNewlines)) {
      continue;
    }
    output += character;
  }
  return output;
}

/**
 * Normaliza una línea: quita caracteres de control, colapsa blancos y recorta.
 * Idempotente por construcción: `normalizeLine(normalizeLine(x)) === normalizeLine(x)`.
 */
export function normalizeLine(input: string): string {
  // Se conservan los saltos para que el colapso de blancos los convierta en un
  // espacio. Quitarlos antes pegaría las palabras: "uno\ndos" -> "unodos".
  return stripControlCharacters(input, { keepNewlines: true })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza un bloque de texto conservando los saltos de línea, pero sin
 * permitir más de dos seguidos ni espacios al final de cada línea.
 */
export function normalizeBlock(input: string): string {
  return stripControlCharacters(input, { keepNewlines: true })
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Trunca respetando pares suplentes, para no partir un emoji por la mitad,
 * y añade una elipsis cuando ha recortado.
 */
export function truncate(input: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (input.length <= maxLength) return input;
  let cut = maxLength - 1;
  const previous = input.charCodeAt(cut - 1);
  if (previous >= 0xd800 && previous <= 0xdbff) cut -= 1;
  return `${input.slice(0, cut)}…`;
}
