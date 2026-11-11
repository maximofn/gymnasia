import { zipSync, strToU8 } from "fflate";

// Wholly synthetic food data. Minimal OOXML exercises the same reader as MRI.
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const letters = (column) => { let result = ""; for (column++; column; column = Math.floor((column - 1) / 26)) result = String.fromCharCode(65 + (column - 1) % 26) + result; return result; };

export function workbook(rows, name = "BLS_4_0", transform = (xml) => xml) {
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((input, c) => {
    if (input === undefined) return "";
    const cell = typeof input === "object" && input !== null ? input : { type: typeof input === "number" ? "n" : "inlineStr", value: input };
    return `<c r="${letters(c)}${r + 1}" t="${cell.type}">${cell.value === null ? "" : cell.type === "inlineStr" ? `<is><t xml:space="preserve">${escape(cell.value)}</t></is>` : `<v>${escape(cell.value)}</v>`}</c>`;
  }).join("")}</row>`).join("")}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escape(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(transform(sheet)),
  }, { mtime: new Date("2000-01-01T00:00:00Z") });
}

export const componentRows = () => [
  ["Index", "Nährstoffcode / Component code", "Nährstoffbezeichnung", "Component name", "Einheit / Unit", "Nährstoffgruppe", "Component group", "Formeln / Formula", "Formelanwendung / Formula application"],
  [1, "ENERCC", "Energie (Kilokalorien)", "Energy (kilocalorie)", "kcal", "Energie", "Energy", "SYNTHETIC formula; do not evaluate", "always calculated"],
  [2, "CA", "Calcium ", "Calcium", "mg", "Elemente", "Elements", "", ""],
  [undefined, undefined, " "],
];
export const foodRows = () => [
  ["BLS Code", "Lebensmittelbezeichnung", "Food name", "ENERCC Energie (Kilokalorien) [kcal/100g]", "ENERCC Datenherkunft", "ENERCC Referenz", "CA Calcium [mg/100g]", "CA Datenherkunft", "CA Referenz", "Hinweis"],
  ["A1B0000", "Synthetisches Essen & Variante", "Synthetic food & variant", { type: "n", value: "12.3400" }, "Formelberechnung", "Citation # one & two", "<LOD or <LOQ", "Literatur", "-", "Synthetic note"],
  ["A000001", "Synthetische Probe", "Synthetic sample", "TR", "Spuren", "-", undefined, "-", null, null],
];
