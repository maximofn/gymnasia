import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../../docs/design/component-audit/", import.meta.url);
const inventory = JSON.parse(await readFile(new URL("inventory.json", root), "utf8"));
const files = (await readdir(new URL("screens/", root))).filter((name) => name.endsWith(".jpg")).sort();
assert.deepEqual(inventory.screens.map((screen) => screen.image.slice(8)).sort(), files, "Cada captura debe estar inventariada una sola vez");
for (const screen of inventory.screens) {
  const meta = await sharp(fileURLToPath(new URL(screen.image, root))).metadata();
  assert.equal(meta.width, inventory.viewport.width, screen.id);
  assert.equal(meta.height, inventory.viewport.height, screen.id);
}

const data = JSON.stringify(inventory).replaceAll("<", "\\u003c");
await writeFile(new URL("index.html", root), `<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gymnasia · Inventario visual de componentes</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#07090d;color:#f4f7fb;font:15px/1.5 system-ui,sans-serif}header{padding:40px 28px 24px;border-bottom:1px solid #252b35}h1{font-size:clamp(26px,4vw,40px);margin:0 0 10px}p{max-width:80ch;color:#a6afbc}a{color:#cbff1a}main{padding:24px 28px}.controls{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px}input,select{background:#141820;color:#f4f7fb;border:1px solid #252b35;border-radius:12px;padding:12px;font:inherit}input{flex:1;min-width:200px}input:focus,select:focus{outline:2px solid #cbff1a}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:28px}figure{margin:0;min-width:0}figure a{display:block}img{width:100%;aspect-ratio:390/844;object-fit:contain;background:#101318;border:1px solid #252b35;border-radius:16px}figcaption{padding:10px 2px}h2{font-size:16px;margin:0 0 4px}.meta{font-size:12px;color:#a6afbc}.families{margin-top:6px;font-size:12px;color:#a6afbc}#count{margin-bottom:20px;color:#cbff1a}dialog{background:#141820;color:#f4f7fb;border:1px solid #252b35;border-radius:16px;max-height:96vh;padding:12px}dialog::backdrop{background:#000c}dialog img{max-height:84vh;width:auto;max-width:90vw}button{background:#cbff1a;border:0;padding:10px 16px;border-radius:10px;font:inherit;cursor:pointer}footer{padding:28px;border-top:1px solid #252b35;color:#a6afbc}@media print{.controls,dialog{display:none}#grid{grid-template-columns:repeat(4,1fr)}figure{break-inside:avoid}}
</style>
<header><h1>Gymnasia · Inventario visual</h1><p>Capturas reales de la app publicada el 19 de octubre de 2026, versión ${inventory.publishedVersion}, a ${inventory.viewport.width} × ${inventory.viewport.height} píxeles. Selecciona una pantalla para ampliarla o filtra por área y familia de componentes.</p><a href="README.md">Alcance, componentes y límites de la revisión</a></header>
<main><div class="controls"><input id="search" aria-label="Buscar pantalla o componente" placeholder="Buscar pantalla o componente…"><select id="area" aria-label="Área"><option value="">Todas las áreas</option></select></div><div id="count" role="status" aria-live="polite"></div><div id="grid"></div></main>
<dialog id="preview"><button id="close">Cerrar</button><p id="caption"></p><img id="large" alt=""></dialog>
<footer>Las capturas muestran datos desechables de QA. Las credenciales permanecen ocultas. El inventario recoge las vistas visitadas; los estados nativos y de recuperación se detallan en el documento de alcance.</footer>
<script type="application/json" id="inventory">${data}</script>
<script>
const inventory=JSON.parse(document.getElementById('inventory').textContent);
const search=document.getElementById('search'),area=document.getElementById('area'),grid=document.getElementById('grid'),preview=document.getElementById('preview');
for(const name of new Set(inventory.screens.map(s=>s.area))){const option=document.createElement('option');option.textContent=name;option.value=name;area.append(option)}
function render(){grid.replaceChildren();const query=search.value.toLocaleLowerCase('es');const filtered=inventory.screens.filter(s=>(!area.value||s.area===area.value)&&[s.title,s.area,...s.components].join(' ').toLocaleLowerCase('es').includes(query));document.getElementById('count').textContent=filtered.length+' de '+inventory.screens.length+' capturas';for(const screen of filtered){const figure=document.createElement('figure'),link=document.createElement('a'),image=document.createElement('img'),caption=document.createElement('figcaption'),title=document.createElement('h2'),meta=document.createElement('div'),families=document.createElement('div');link.href=screen.image;image.src=screen.image;image.alt=screen.title+' · '+screen.area;image.loading='lazy';link.append(image);title.textContent=screen.title;meta.className='meta';meta.textContent=screen.area+' · '+screen.id.slice(0,2);families.className='families';families.textContent='Familias del área: '+screen.components.join(', ');caption.append(title,meta,families);figure.append(link,caption);grid.append(figure);link.onclick=e=>{e.preventDefault();document.getElementById('large').src=screen.image;document.getElementById('large').alt=image.alt;document.getElementById('caption').textContent=screen.title;preview.showModal()}}}
search.oninput=render;area.onchange=render;document.getElementById('close').onclick=()=>preview.close();render();
</script></html>\n`);

// Contact sheets provide a portable overview alongside the full-resolution originals.
const cellWidth = 156, cellHeight = 368, columns = 5;
for (let start = 0; start < inventory.screens.length; start += 20) {
  const group = inventory.screens.slice(start, start + 20);
  const composites = [];
  for (const [index, screen] of group.entries()) {
    const left = index % columns * cellWidth, top = Math.floor(index / columns) * cellHeight;
    composites.push({ input: await sharp(fileURLToPath(new URL(screen.image, root))).resize(cellWidth, 338).toBuffer(), left, top });
    const label = screen.id.slice(0, 24).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    composites.push({ input: Buffer.from(`<svg width="156" height="30"><text x="3" y="15" fill="#f4f7fb" font-family="sans-serif" font-size="10">${label}</text></svg>`), left, top: top + 338 });
  }
  await sharp({ create: { width: columns * cellWidth, height: Math.ceil(group.length / columns) * cellHeight, channels: 3, background: "#141820" } }).composite(composites).jpeg({ quality: 85 }).toFile(fileURLToPath(new URL(`contact-${start / 20 + 1}.jpg`, root)));
}
const overviewIds = ["01-home", "08-rutina-editor", "16-dieta-vacia", "20-medidas", "24-coach-inicial", "25-config-dieta"];
const overview = await Promise.all(overviewIds.map(async (id, index) => {
  const screen = inventory.screens.find((entry) => entry.id === id);
  assert.ok(screen, id);
  return { input: await sharp(fileURLToPath(new URL(screen.image, root))).resize(180, 390).toBuffer(), left: index % 3 * 188, top: Math.floor(index / 3) * 398 };
}));
await sharp({ create: { width: 556, height: 788, channels: 3, background: "#141820" } }).composite(overview).jpeg({ quality: 85 }).toFile(fileURLToPath(new URL("overview.jpg", root)));
console.log(`Galería validada y generada: ${inventory.screens.length} capturas de ${inventory.viewport.width} × ${inventory.viewport.height}.`);
