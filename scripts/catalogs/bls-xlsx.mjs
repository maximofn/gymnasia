import assert from "node:assert/strict";
import sax from "sax";
import { unzipSync } from "fflate";

const decoder = new TextDecoder("utf-8", { fatal: true });

// Read-only OOXML subset. Never evaluates formulas, follows links or writes ZIP paths.
export function unzipBls(bytes, maxBytes = 160 * 1024 * 1024) {
  const seen = new Set();
  let total = 0;
  const files = unzipSync(bytes, { filter: (entry) => {
    assert.ok(!seen.has(entry.name), `ZIP duplicado: ${entry.name}`);
    seen.add(entry.name);
    assert.ok(seen.size <= 128, "Demasiadas entradas ZIP BLS");
    assert.ok(!entry.name.startsWith("/") && !entry.name.includes("\\") && !entry.name.split("/").some((part) => part === ".." || part === "."), "Ruta ZIP BLS no segura");
    total += entry.originalSize;
    assert.ok(total <= maxBytes, "ZIP BLS excede el límite descomprimido");
    return true;
  } });
  assert.ok(Object.values(files).reduce((sum, file) => sum + file.length, 0) <= maxBytes, "ZIP BLS demasiado grande");
  return files;
}

function xml(bytes, handlers) {
  assert.ok(bytes, "Falta una parte OOXML BLS");
  const text = decoder.decode(bytes);
  const parser = sax.parser(true, { trim: false, normalize: false });
  let depth = 0;
  parser.ondoctype = () => { throw new Error("DOCTYPE no permitido en BLS"); };
  parser.onopentag = (node) => {
    assert.ok(++depth <= 40, "OOXML BLS demasiado profundo");
    handlers.open?.(node.name.split(":").at(-1), node.attributes);
  };
  parser.onclosetag = (name) => { handlers.close?.(name.split(":").at(-1)); depth--; };
  parser.ontext = parser.oncdata = (value) => handlers.text?.(value);
  for (let offset = 0; offset < text.length; offset += 65536) parser.write(text.slice(offset, offset + 65536));
  parser.close();
  assert.equal(depth, 0, "XML BLS truncado o sin cerrar");
}

export function readBlsWorkbook(bytes, expectedSheet, onRow) {
  const files = unzipBls(bytes);
  const sheets = [];
  xml(files["xl/workbook.xml"], { open: (name, attributes) => {
    if (name === "sheet") sheets.push({ name: attributes.name, id: attributes["r:id"] });
  } });
  assert.equal(sheets.length, 1, "Se esperaba una sola hoja BLS");
  assert.equal(sheets[0].name, expectedSheet, "Hoja BLS desconocida");
  let target;
  xml(files["xl/_rels/workbook.xml.rels"], { open: (name, attributes) => {
    if (name !== "Relationship") return;
    assert.notEqual(attributes.TargetMode, "External", "No se admiten enlaces externos OOXML");
    if (attributes.Id === sheets[0].id) {
      assert.ok(attributes.Type.endsWith("/worksheet"), "Relación BLS inválida");
      target = attributes.Target.replace(/^\/xl\//, "");
    }
  } });
  assert.ok(/^worksheets\/sheet\d+\.xml$/.test(target), "Destino de hoja BLS no seguro");
  const strings = [];
  if (files["xl/sharedStrings.xml"]) {
    let text = null;
    let inText = false;
    xml(files["xl/sharedStrings.xml"], {
      open: (name) => { if (name === "si") text = ""; if (name === "t") inText = true; },
      text: (value) => { if (inText && text !== null) { text += value; assert.ok(text.length <= 100000, "Cadena BLS demasiado larga"); } },
      close: (name) => { if (name === "t") inText = false; if (name === "si") { strings.push(text); text = null; } },
    });
  }
  let row = null;
  let rowNumber = 0;
  let previousRow = 0;
  let cell = null;
  let column;
  let content = false;
  xml(files[`xl/${target}`], {
    open: (name, attributes) => {
      assert.notEqual(name, "f", "No se evalúan ni aceptan fórmulas de Excel en BLS");
      if (name === "row") {
        rowNumber = Number(attributes.r);
        assert.ok(Number.isSafeInteger(rowNumber) && rowNumber > previousRow && rowNumber <= 10000, "Fila XLSX inválida o duplicada");
        previousRow = rowNumber;
        row = new Map();
      }
      if (name === "c") {
        const match = /^([A-Z]+)(\d+)$/.exec(attributes.r);
        assert.ok(row && match && Number(match[2]) === rowNumber, "Coordenada de celda BLS inválida");
        column = [...match[1]].reduce((result, char) => result * 26 + char.charCodeAt(0) - 64, 0) - 1;
        assert.ok(column < 500 && !row.has(column), "Columna BLS inválida o duplicada");
        const type = attributes.t ?? "n";
        assert.ok(["n", "s", "inlineStr"].includes(type), `Tipo de celda XLSX no permitido: ${type}`);
        cell = { type, raw: "", hasValue: false };
      }
      if (cell && (name === "v" || name === "t")) { content = true; cell.hasValue = true; }
    },
    text: (text) => { if (cell && content) { cell.raw += text; assert.ok(cell.raw.length <= 100000, "Celda BLS demasiado larga"); } },
    close: (name) => {
      if (name === "v" || name === "t") content = false;
      if (name === "c") {
        let value = cell.hasValue ? cell.raw : null;
        if (value !== null && cell.type === "s") {
          assert.ok(/^\d+$/.test(value) && Number(value) < strings.length, "Índice de cadena XLSX inválido");
          value = strings[Number(value)];
        }
        row.set(column, { type: value === null ? null : cell.type, value });
        cell = null;
      }
      if (name === "row") { onRow(row, rowNumber); row = null; }
    },
  });
}
