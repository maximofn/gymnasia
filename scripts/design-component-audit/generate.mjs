import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

// Code review is a historical snapshot; later implementation must not invalidate its sources.
const reviewedSources = new Map();
for (const [id, proposal] of Object.entries(inventory.proposals)) {
  assert.ok(["Base", "Composición", "Por validar"].includes(proposal.level), id);
  for (const key of ["name", "common", "variants", "boundary"]) assert.ok(proposal[key]?.trim(), `${id}: ${key}`);
  const review = proposal.codeReview;
  assert.ok(["Reutilizar", "Adaptar", "Crear"].includes(review.decision), id);
  for (const key of ["summary", "nextStep"]) assert.ok(review[key]?.trim(), `${id}: ${key}`);
  assert.ok([1, 2, 3].includes(review.priority), id);
  assert.ok(review.references.length > 0, `Sin referencias: ${id}`);
  for (const reference of review.references) {
    assert.ok(reference.path.startsWith("apps/mobile/") && reference.path.endsWith(".tsx"), id);
    if (!reviewedSources.has(reference.path)) {
      reviewedSources.set(reference.path, execFileSync("git", ["show", `${inventory.codeAudit.sourceCommit}:${reference.path}`], { cwd: fileURLToPath(new URL("../../", import.meta.url)), encoding: "utf8" }));
    }
    const source = reviewedSources.get(reference.path);
    assert.ok(Number.isInteger(reference.line) && reference.line > 0, id);
    assert.ok(source.split("\n")[reference.line - 1]?.includes(reference.anchor), `Referencia desactualizada: ${id} → ${reference.path}:${reference.line}`);
  }
  if (proposal.implementation) {
    assert.equal(review.decision, "Adaptar", id);
    assert.equal(proposal.implementation.status, "Unificado", id);
    for (const path of [...proposal.implementation.components, ...proposal.implementation.uses]) {
      assert.ok(path.startsWith("apps/mobile/"), id);
      await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    }
  }
  assert.ok(!("source" in proposal) && !("status" in proposal), `Las referencias de implementación deben estar en codeReview: ${id}`);
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
assert.match(inventory.codeAudit.sourceCommit, /^[a-f0-9]{40}$/);
assert.equal(inventory.codeAudit.implementationChanged, false);
for (const [decision, count] of Object.entries(inventory.codeAudit.counts)) {
  assert.equal(Object.values(inventory.proposals).filter((proposal) => proposal.codeReview.decision === decision).length, count, decision);
}
const sourceLink = (reference) => `[${reference.symbol} (${reference.path.split("/").at(-1)}:${reference.line})](../../../${reference.path}#L${reference.line})`;
const sourceFile = (reference) => `[${reference.symbol} (${reference.path}:${reference.line})](../../../${reference.path}#L${reference.line})`;
const report = [
  "# Revisión de los 29 patrones en el código",
  "",
  "Trabajo de GYM-8 (ticket para unificar componentes repetidos de la interfaz).",
  "",
  `Revisión de lectura del ${inventory.codeAudit.reviewedAt}, sobre el código de \`${inventory.codeAudit.sourceCommit}\`. **Esta revisión fue de solo lectura.**`,
  "",
  "La implementación posterior de las 12 familias adaptables se documenta por separado en [implementation.md](implementation.md). Las referencias de este informe siguen apuntando al código original revisado, no a las líneas después de la extracción.",
  "",
  "La propuesta visual se conserva. Esta segunda fase contrasta sus 29 candidatos con los componentes y el JSX actuales; el parecido visual no obliga a unificar contratos de negocio.",
  "",
  ...Object.entries(inventory.codeAudit.criteria).map(([key, value]) => `- **${key}**: ${value}`),
  "",
  `Resultado: **${inventory.codeAudit.counts.Reutilizar} reutilizar · ${inventory.codeAudit.counts.Adaptar} adaptar · ${inventory.codeAudit.counts.Crear} crear**. «Crear» se refiere a la abstracción de aplicación, aunque ya existan primitivas de React Native y JSX aprovechable.`,
  "",
  "## Matriz completa",
  "",
  "| Patrón | Decisión | Evidencia principal |",
  "| --- | --- | --- |",
  ...Object.values(inventory.proposals).map((proposal) => `| ${proposal.name} | ${proposal.codeReview.decision} | ${proposal.codeReview.references.slice(0, 2).map(sourceLink).join("; ")} |`),
  "",
  "## Justificación y siguiente paso por patrón",
  "",
  ...Object.values(inventory.proposals).flatMap((proposal) => [
    `### ${proposal.name} — ${proposal.codeReview.decision}`,
    "",
    proposal.codeReview.summary,
    "",
    `**Siguiente paso propuesto:** ${proposal.codeReview.nextStep}`,
    "",
    `**Fuentes:** ${proposal.codeReview.references.map(sourceFile).join("; ")}.`,
    "",
  ]),
  "## Orden sugerido para una fase posterior",
  "",
  "1. Unidades pequeñas y duplicación más directa: botones, campos, buscadores, chips, métricas, marco de gráficas, miniaturas, interruptores y barras de progreso.",
  "2. Composiciones con contratos que acordar: filas, tarjetas de rutina, selectores, opciones, mensajes, compositor, nutrición, estados vacíos, menús y metadatos.",
  "3. Evaluar el beneficio antes de extraer: marcos de registros, formularios y secciones, filas etiqueta/valor y filas de series. Mantener navegación, pie legal y avisos semánticos existentes.",
  "",
  "Este orden describe la recomendación original; la fase posterior autorizada abarca solo las 12 familias adaptables. Las adaptaciones de avisos, formularios y diálogos deben preservar reglas sanitarias, permisos, validación, cifrado y comportamiento nativo/web en sus propietarios. SwipeableSetRow es un contenedor de gesto, no una fila de serie completa; SharedChatPanel incluye conversación y entrada, no un compositor aislado.",
  "",
  "El menú contextual conserva un único ejemplo fotográfico. El código demuestra una segunda implementación en Rutinas; todavía conviene capturar esa variante para comparar su presentación antes de unificarlos.",
  "",
  "## Comprobaciones de esta revisión",
  "",
  "- Las 29 decisiones tienen referencias con fichero, símbolo o región JSX, línea y ancla comprobadas por el generador.",
  "- Los 54 originales y las 208 zonas de evidencia visual permanecen intactos.",
  "- La revisión original no cambió apps/mobile. La implementación posterior tiene su propio alcance y validación en implementation.md.",
  "- Esta revisión no ejecuta una migración ni demuestra todavía equivalencia visual o funcional de una futura extracción.",
  "",
  "Documento generado desde inventory.json por scripts/design-component-audit/generate.mjs.",
  "",
].join("\n");
await writeFile(new URL("code-review.md", root), report);

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
