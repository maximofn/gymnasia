// Convierte las ilustraciones de assets/ (PNG originales, fuera de Git) en
// js/assets.js, con cada imagen recortada, reducida a WebP e incrustada en base64.
//
// Van incrustadas porque Chrome no deja usar como textura de WebGL una imagen
// cargada desde file://, y la presentación tiene que abrirse con doble clic y sin red.
//
//   node charla-agente/build-assets.mjs     (necesita ImageMagick: magick)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = new URL(".", import.meta.url).pathname;
const src = join(dir, "assets");

// [clave, fichero, lado máximo, grupo]. Las imágenes de un mismo grupo se
// recortan con la misma caja para que al fundirse una en otra no se muevan.
const MANIFEST = [
  ["arroz-caliente", "01-arroz-caliente.png", 1100, "arroz"],
  ["arroz-frio", "02-arroz-frio.png", 1100, "arroz"],
  ["movil-pesas", "03-movil-pesas.png", 900, "movil"],
  ["movil-chat", "04-movil-chat.png", 900, "movil"],
  ["movil-medidas", "05-movil-medidas.png", 900, "movil"],
  ["movil-gymnasia", "06-movil-gymnasia.png", 1100],
  ["persona-agobiada", "07-persona-agobiada.png", 1100],
  ["persona-agotada", "08-persona-agotada.png", 1100],
  ["persona-contenta", "09-persona-contenta.png", 1100],
  ["tenedor", "10-tenedor-arroz.png", 900],
  ["icono-entrenos", "11-icono-entrenos.png", 600],
  ["icono-comidas", "12-icono-comidas.png", 600],
  ["icono-medidas", "13-icono-medidas.png", 600],
  ["icono-gustos", "14-icono-gustos.png", 600],
  ["servidor", "15-servidor.png", 1100, "servidor"],
  ["servidor-roto", "16-servidor-roto.png", 1100, "servidor"],
  ["llave", "17-llave.png", 700],
  ["producto", "18-producto.png", 900],
  ["metro", "19-metro-fondo.png", 1600, null, false],
  ["libreta", "20-libreta.png", 800],
  ["manzana", "21-manzana.png", 600],
  ["persona-cama", "22-persona-cama-pijama.png", 1100],
  ["politica", "23-politica-firmada.png", 900],
  ["robot", "24-robot-falso.png", 1100],
  ["casete", "25-casete.png", 800],
  ["balanza", "26-balanza.png", 800],
  ["silla", "27-silla.png", 800],
  ["botones", "28-botones.png", 800],
  ["lupa", "29-lupa.png", 800],
  ["monedas", "30-monedas.png", 800],
  ["carrito", "31-carrito.png", 900, "carrito"],
  ["carrito-vacio", "31-carrito-vacio.png", 900, "carrito", true, true],
  ["brocoli", "32-brocoli.png", 700],
];

const magick = (...args) => execFileSync("magick", args, { encoding: "utf8" }).trim();
const exists = (f) => { try { readFileSync(f); return true; } catch { return false; } };

// Caja del contenido opaco (alfa > 3 %), unida por grupo.
const boxes = {};
for (const [, file, , groupName, trim = true, optional] of MANIFEST) {
  const path = join(src, file);
  if (!trim || (optional && !exists(path))) continue;
  const [w, h, x, y] = magick(path, "-alpha", "extract", "-threshold", "3%", "-format", "%@", "info:")
    .match(/(\d+)x(\d+)\+(\d+)\+(\d+)/).slice(1).map(Number);
  const key = groupName || file;
  const b = boxes[key];
  boxes[key] = b
    ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x + w), y1: Math.max(b.y1, y + h) }
    : { x0: x, y0: y, x1: x + w, y1: y + h };
}

const tmp = mkdtempSync(join(tmpdir(), "charla-assets-"));
const out = {};
const sizes = {};
for (const [key, file, max, groupName, trim = true, optional] of MANIFEST) {
  const path = join(src, file);
  if (optional && !exists(path)) { console.log(`(sin ${file}: se omite)`); continue; }
  const webp = join(tmp, key + ".webp");
  const args = [path];
  if (trim) {
    const b = boxes[groupName || file];
    args.push("-crop", `${b.x1 - b.x0}x${b.y1 - b.y0}+${b.x0}+${b.y0}`, "+repage");
  }
  args.push("-resize", `${max}x${max}>`);
  // Margen transparente para que la versión desenfocada no se corte en los bordes.
  if (trim) args.push("-bordercolor", "none", "-border", "7%x7%");
  args.push("-quality", "84", "-define", "webp:alpha-quality=90", webp);
  magick(...args);
  const data = readFileSync(webp);
  const [w, h] = magick(webp, "-format", "%w %h", "info:").split(" ").map(Number);
  out[key] = "data:image/webp;base64," + data.toString("base64");
  sizes[key] = [w, h];
  console.log(`${key.padEnd(18)} ${w}x${h}  ${(data.length / 1024).toFixed(0)} KB`);
}
rmSync(tmp, { recursive: true });

writeFileSync(
  join(dir, "js/assets.js"),
  "// Generado por build-assets.mjs. No editar a mano.\n" +
    `window.ASSET_SIZES = ${JSON.stringify(sizes)};\n` +
    `window.ASSETS = ${JSON.stringify(out, null, 0)};\n`,
);
const total = Object.values(out).reduce((s, v) => s + v.length, 0);
console.log(`js/assets.js: ${Object.keys(out).length} imágenes, ${(total / 1024 / 1024).toFixed(1)} MB`);
