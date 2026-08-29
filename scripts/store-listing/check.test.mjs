import assert from "node:assert/strict";
import test from "node:test";

import {
  readPngMetadata,
  scanForbiddenText,
  validateComplianceCopy,
  validateManifest,
  validateTextLimits,
} from "./check.mjs";

function pngHeader({ width = 1, height = 1, bitDepth = 8, colorType = 2 } = {}) {
  const buffer = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, 4, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = bitDepth;
  buffer[25] = colorType;
  return buffer;
}

test("lee dimensiones, profundidad y color type del IHDR", () => {
  assert.deepEqual(readPngMetadata(pngHeader({ width: 1080, height: 1920, colorType: 2 })), {
    width: 1080,
    height: 1920,
    bitDepth: 8,
    colorType: 2,
  });
});

test("rechaza buffers que no son PNG", () => {
  assert.throws(() => readPngMetadata(Buffer.from("not-a-png")), /no es un PNG válido/);
});

test("valida los tres límites de texto de Play", () => {
  assert.deepEqual(validateTextLimits({ appName: "a".repeat(30), shortDescription: "b".repeat(80), fullDescription: "c".repeat(4000) }), []);
  assert.deepEqual(validateTextLimits({ appName: "a".repeat(31), shortDescription: "b".repeat(81), fullDescription: "c".repeat(4001) }), [
    "el nombre supera 30 caracteres",
    "la descripción breve supera 80 caracteres",
    "la descripción completa supera 4.000 caracteres",
  ]);
});

test("maneja una ficha incompleta sin lanzar una excepción", () => {
  assert.deepEqual(validateTextLimits({}), [
    "falta el nombre de la app",
    "falta la descripción breve",
    "falta la descripción completa",
  ]);
});

test("detecta funciones retiradas y patrones de secretos", () => {
  const findings = scanForbiddenText({ copy: "VivaGym GitHub Releases lin_api_example AIza12345678901234567890" });
  assert.deepEqual(findings, [
    "texto prohibido: VivaGym",
    "texto prohibido: GitHub Releases",
    "texto prohibido: clave de Linear",
    "texto prohibido: clave de Google",
  ]);
});

test("protege la explicación BYOK, la edad 16+ y la decisión de Data safety", () => {
  const valid = {
    appSource: "Gymnasia no envía tu clave a servidores propios; autentica la petición.",
    privacyEs: "Gymnasia está dirigida a personas de 16 años o más y no está diseñada para menores de 16 años.",
    privacyEn: "Gymnasia is intended for people aged 16 or older and is not designed for children under 16.",
    declarations: "Collected: Yes\nShared: No\n| Photos and videos › Photos | Sí | No | Sí | Funcionalidad |",
  };
  assert.deepEqual(validateComplianceCopy(valid), []);
  assert.deepEqual(validateComplianceCopy({
    ...valid,
    appSource: "Tu clave nunca sale de tu teléfono.",
    privacyEs: "No dirigida a menores de 14 años.",
    privacyEn: "Not aimed at children under 14.",
    declarations: "Collected: No\nShared: Yes",
  }), [
    "la app conserva la afirmación incorrecta de que la clave nunca sale del teléfono",
    "la explicación BYOK no aclara que la clave evita los servidores propios",
    "la política española no fija correctamente la audiencia 16+",
    "la política inglesa no fija correctamente la audiencia 16+",
    "las declaraciones no conservan la decisión Collected: Yes / Shared: No",
    "las declaraciones no recogen las fotos opcionales como recopiladas y no compartidas",
  ]);
});

test("rechaza textos alternativos que superan los 140 caracteres oficiales", () => {
  const errors = validateManifest({
    locale: "es-ES",
    productDetails: {
      appName: "Gymnasia",
      shortDescription: "Descripción",
      fullDescription: "Descripción completa",
    },
    classification: { category: "Salud y fitness" },
    audience: { ageGroups: ["16-17", "18+"] },
    ads: false,
    assets: {
      icon: { altText: "a".repeat(141), aiGenerated: true, path: "no-existe.png" },
      featureGraphic: { altText: "b".repeat(141), aiGenerated: true, path: "no-existe.png" },
      screenshots: [],
    },
  });
  assert.ok(errors.includes("el alt text del icono supera 140 caracteres"));
  assert.ok(errors.includes("el alt text de la feature graphic supera 140 caracteres"));
});
