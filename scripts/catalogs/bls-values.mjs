import assert from "node:assert/strict";

const origins = new Set(["Analyse", "Rezeptberechnung", "Musterberechnung", "Literatur", "Aggregation", "Labelangabe", "Nährstoffdatenbank", "Übernommener Wert", "Reskalierung", "Logische Null", "Logische Annahme", "Spuren", "Formelberechnung", "-"]);

export function parseBlsValue(raw, origin) {
  assert.ok(raw === null || typeof raw === "string", "Valor BLS no textual");
  assert.ok(origin === null || origins.has(origin), `Origen BLS no documentado: ${origin}`);
  const text = raw?.trim() ?? "";
  if (text === "" || text === "-") return { value: null, qualifier: "missing" };
  if (text === "TR") return { value: null, qualifier: "trace" };
  if (/^<\s*LOD$/.test(text)) return { value: null, qualifier: "below_detection" };
  if (/^<\s*LOQ$/.test(text)) return { value: null, qualifier: "below_quantification" };
  if (/^<\s*LOD\s+or\s+<\s*LOQ$/.test(text)) return { value: null, qualifier: "below_detection_or_quantification" };
  const match = /^(<\s*)?(-?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?)$/.exec(text);
  assert.ok(match, `Notación BLS desconocida: ${JSON.stringify(text)}`);
  const value = Number(match[2].replace(",", "."));
  assert.ok(Number.isFinite(value), "Valor BLS no finito");
  if (origin === "Logische Null") return value === 0 && !match[1]
    ? { value: 0, qualifier: "logical_zero" } : { value: null, qualifier: "inconsistent_origin" };
  if (match[1]) return { value: null, qualifier: "less_than", limit: value };
  if (origin === "Spuren") return { value: null, qualifier: "trace" };
  return { value, qualifier: "reported" };
}
