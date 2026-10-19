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

for (const [id, proposal] of Object.entries(inventory.proposals)) {
  assert.ok(["Base", "Composición", "Por validar"].includes(proposal.level), id);
  for (const key of ["name", "common", "variants", "boundary"]) assert.ok(proposal[key]?.trim(), `${id}: ${key}`);
  assert.equal(proposal.codeReview, "Pendiente", id);
  assert.ok(!("source" in proposal) && !("status" in proposal), `No vincular la propuesta visual al código: ${id}`);
  const evidence = inventory.screens.flatMap((screen) => screen.regions.filter((region) => region.proposal === id));
  assert.ok(evidence.length > 0, `Propuesta sin evidencia: ${id}`);
  assert.ok(evidence.length >= 2 || proposal.level === "Por validar", `Repetición sin demostrar: ${id}`);
}
for (const screen of inventory.screens) {
  assert.ok(screen.regions.length > 0, `Sin anotaciones: ${screen.id}`);
  assert.deepEqual(screen.proposals, [...new Set(screen.regions.map((region) => region.proposal))], screen.id);
  for (const region of screen.regions) {
    assert.ok(inventory.proposals[region.proposal], region.proposal);
    assert.equal(region.rect.length, 4, screen.id);
    assert.ok(region.rect.every(Number.isFinite), screen.id);
    const [x, y, width, height] = region.rect;
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= inventory.viewport.width && y + height <= inventory.viewport.height, `Zona fuera de captura: ${screen.id}`);
    assert.ok(region.note.trim(), screen.id);
  }
}
const data = JSON.stringify(inventory).replaceAll("<", "\\u003c");
const template = await readFile(new URL("gallery.html", import.meta.url), "utf8");
await writeFile(new URL("index.html", root), template.replace("{{INVENTORY}}", () => data));

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
