import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const manifestPath = join(repoRoot, "docs/store/google-play/listing.es.json");
const appPath = join(repoRoot, "apps/mobile/App.tsx");
const privacyEsPath = join(repoRoot, "docs/legal/privacy-policy.es.md");
const privacyEnPath = join(repoRoot, "docs/legal/privacy-policy.en.md");
const declarationsPath = join(repoRoot, "docs/legal/play-declarations.md");

export function readPngMetadata(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 33 || buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("no es un PNG válido");
  }
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("PNG sin IHDR en la posición esperada");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

export function validateTextLimits(productDetails) {
  const errors = [];
  const appName = productDetails?.appName ?? "";
  const shortDescription = productDetails?.shortDescription ?? "";
  const fullDescription = productDetails?.fullDescription ?? "";
  if (!appName.trim()) errors.push("falta el nombre de la app");
  if (appName.length > 30) errors.push("el nombre supera 30 caracteres");
  if (!shortDescription.trim()) errors.push("falta la descripción breve");
  if (shortDescription.length > 80) errors.push("la descripción breve supera 80 caracteres");
  if (!fullDescription.trim()) errors.push("falta la descripción completa");
  if (fullDescription.length > 4000) errors.push("la descripción completa supera 4.000 caracteres");
  return errors;
}

export function validateComplianceCopy({ appSource, privacyEs, privacyEn, declarations }) {
  const errors = [];
  if (/Tu clave nunca sale de tu teléfono/i.test(appSource)) {
    errors.push("la app conserva la afirmación incorrecta de que la clave nunca sale del teléfono");
  }
  if (!/Gymnasia no envía tu clave a servidores propios/i.test(appSource)) {
    errors.push("la explicación BYOK no aclara que la clave evita los servidores propios");
  }
  if (!/16 años o más/i.test(privacyEs) || !/menores\s+de\s+16 años/i.test(privacyEs)) {
    errors.push("la política española no fija correctamente la audiencia 16+");
  }
  if (!/16 or older/i.test(privacyEn) || !/children\s+under\s+16/i.test(privacyEn)) {
    errors.push("la política inglesa no fija correctamente la audiencia 16+");
  }
  if (!/Collected: Yes/.test(declarations) || !/Shared: No/.test(declarations)) {
    errors.push("las declaraciones no conservan la decisión Collected: Yes / Shared: No");
  }
  if (!/Photos and videos[^\n]*Photos[^\n]*Sí[^\n]*No[^\n]*Sí/.test(declarations)) {
    errors.push("las declaraciones no recogen las fotos opcionales como recopiladas y no compartidas");
  }
  return errors;
}

export function scanForbiddenText(value) {
  const text = JSON.stringify(value);
  const patterns = [
    [/vivagym/i, "VivaGym"],
    [/github releases?/i, "GitHub Releases"],
    [/actualizador(?:a)? de (?:apk|github)/i, "actualizador de APK/GitHub"],
    [/\blin_api_[A-Za-z0-9_-]+\b/, "clave de Linear"],
    [/\bsk-[A-Za-z0-9_-]{12,}\b/, "clave con prefijo sk-"],
    [/\bAIza[A-Za-z0-9_-]{20,}\b/, "clave de Google"],
  ];
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => `texto prohibido: ${label}`);
}

export function validatePng(relativePath, expected) {
  const absolutePath = join(repoRoot, relativePath);
  let buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch {
    return [`falta ${relativePath}`];
  }
  const errors = [];
  let metadata;
  try {
    metadata = readPngMetadata(buffer);
  } catch (error) {
    return [`${relativePath}: ${error.message}`];
  }
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    errors.push(`${relativePath}: ${metadata.width}x${metadata.height}, esperado ${expected.width}x${expected.height}`);
  }
  if (metadata.bitDepth !== 8) errors.push(`${relativePath}: profundidad ${metadata.bitDepth}, esperada 8`);
  if (metadata.colorType !== expected.pngColorType) {
    errors.push(`${relativePath}: PNG color type ${metadata.colorType}, esperado ${expected.pngColorType}`);
  }
  if (expected.maxBytes && statSync(absolutePath).size > expected.maxBytes) {
    errors.push(`${relativePath}: supera ${expected.maxBytes} bytes`);
  }
  return errors;
}

export function validateManifest(manifest) {
  const errors = [
    ...validateTextLimits(manifest.productDetails ?? {}),
    ...scanForbiddenText(manifest),
  ];

  if (manifest.locale !== "es-ES") errors.push("el locale debe ser es-ES");
  if (manifest.classification?.category !== "Salud y fitness") errors.push("la categoría debe ser Salud y fitness");
  if (JSON.stringify(manifest.audience?.ageGroups) !== JSON.stringify(["16-17", "18+"])) {
    errors.push("los grupos de edad deben ser 16-17 y 18+");
  }
  if (manifest.ads !== false) errors.push("la declaración de anuncios debe ser false");

  const icon = manifest.assets?.icon;
  const feature = manifest.assets?.featureGraphic;
  const screenshots = manifest.assets?.screenshots ?? [];
  if (!icon?.altText || icon.aiGenerated !== true) errors.push("el icono necesita alt text y declaración de IA positiva");
  if (icon?.altText?.length > 140) errors.push("el alt text del icono supera 140 caracteres");
  if (!feature?.altText || feature.aiGenerated !== true) errors.push("la feature graphic necesita alt text y declaración de IA positiva");
  if (feature?.altText?.length > 140) errors.push("el alt text de la feature graphic supera 140 caracteres");
  if (screenshots.length !== 6) errors.push("debe haber exactamente seis capturas");

  const ids = new Set();
  for (const screenshot of screenshots) {
    if (!screenshot.id || ids.has(screenshot.id)) errors.push(`id de captura inválido o duplicado: ${screenshot.id ?? "vacío"}`);
    ids.add(screenshot.id);
    if (!screenshot.caption?.trim()) errors.push(`${screenshot.id}: falta caption`);
    if (!screenshot.altText?.trim()) errors.push(`${screenshot.id}: falta alt text`);
    if (screenshot.altText?.length > 140) errors.push(`${screenshot.id}: el alt text supera 140 caracteres`);
    if (typeof screenshot.aiGenerated !== "boolean") errors.push(`${screenshot.id}: falta declaración de IA`);
  }

  if (icon) errors.push(...validatePng(icon.path, icon));
  if (feature) errors.push(...validatePng(feature.path, feature));
  for (const screenshot of screenshots) {
    errors.push(...validatePng(screenshot.path, {
      width: 1080,
      height: 1920,
      pngColorType: 2,
    }));
  }
  return errors;
}

export function runCheck() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = [
    ...validateManifest(manifest),
    ...validateComplianceCopy({
      appSource: readFileSync(appPath, "utf8"),
      privacyEs: readFileSync(privacyEsPath, "utf8"),
      privacyEn: readFileSync(privacyEnPath, "utf8"),
      declarations: readFileSync(declarationsPath, "utf8"),
    }),
  ];
  if (errors.length > 0) {
    console.error("La ficha de Google Play no está lista:");
    errors.forEach((error) => console.error(`- ${error}`));
    return 1;
  }
  console.log(`Ficha válida: ${manifest.productDetails.appName}`);
  console.log(`Descripción breve: ${manifest.productDetails.shortDescription.length}/80`);
  console.log(`Descripción completa: ${manifest.productDetails.fullDescription.length}/4000`);
  console.log("Assets: icono, feature graphic y 6 capturas válidas");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCheck();
}
