// Datos íntegramente inventados para pruebas: no son fichas ni valores de BEDCA.
import { bedcaQueries, bedcaFoodQuery, buildBedcaQuery, bedcaSource } from "../../bedca-source.mjs";

const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const fieldsXml = (fields) => Object.entries(fields).map(([key, value]) => `<${key}>${escape(value)}</${key}>`).join("");
const table = (rows) => `<foodresponse>${rows.map((row) => `<food>${fieldsXml(row)}</food>`).join("")}</foodresponse>`;
export const syntheticIndex = [
  { f_id: "900000001", f_ori_name: "FICHA SINTÉTICA UNO", f_eng_name: "SYNTHETIC ENTRY ONE", langual: "TEST-CODE", f_origen: "BEDCA-TEST", edible_portion: "0.800000" },
  { f_id: "900000002", f_ori_name: "FICHA SINTÉTICA VACÍA", f_eng_name: "SYNTHETIC EMPTY ENTRY", langual: "", f_origen: "BEDCA-TEST", edible_portion: "1.000000" },
];
export const syntheticValues = [
  { c_id: "990001", c_ori_name: "COMPONENTE SINTÉTICO", c_eng_name: "SYNTHETIC COMPONENT", eur_name: "TEST", componentgroup_id: "999", best_location: " 12.3400 ", v_unit: "g", u_id: "g", moex: "W", mu_id: "W", value_type: "BE", min: "11.10", max: "13.50", stdv: "0.20", v_n: "7", method_id: "synthetic-method", ref_id: "synthetic-reference", citation: "Cita ficticia para QA, no bibliografía real", m_descripcion: "Método ficticio", glos_esp: "Texto ficticio & preservado" },
  { c_id: "990001", c_ori_name: "COMPONENTE SINTÉTICO", c_eng_name: "SYNTHETIC COMPONENT", eur_name: "TEST", componentgroup_id: "999", best_location: "0.25", v_unit: "mg", u_id: "mg", moex: "W", mu_id: "W", value_type: "LT", ref_id: "synthetic-reference", citation: "Otra variante ficticia, conservada" },
  { c_id: "990002", c_ori_name: "OTRO COMPONENTE SINTÉTICO", c_eng_name: "OTHER SYNTHETIC COMPONENT", eur_name: "TEST2", componentgroup_id: "999", best_location: "", v_unit: "g", u_id: "g", moex: "W", mu_id: "W", value_type: "TR", ref_id: "", citation: "" },
  { c_id: "990002", c_ori_name: "OTRO COMPONENTE SINTÉTICO", c_eng_name: "OTHER SYNTHETIC COMPONENT", eur_name: "TEST2", componentgroup_id: "999", best_location: "2.00", v_unit: "g", u_id: "g", moex: "M", mu_id: "M", value_type: "AR", ref_id: "", citation: "" },
];
export const syntheticResponses = {
  index: table(syntheticIndex),
  components: table([{ c_id: "990001", cg_id: "999", c_ori_name: "COMPONENTE SINTÉTICO", c_eng_name: "SYNTHETIC COMPONENT", eur_name: "TEST" }, { c_id: "990002", cg_id: "999", c_ori_name: "OTRO COMPONENTE SINTÉTICO", c_eng_name: "OTHER SYNTHETIC COMPONENT", eur_name: "TEST2" }]),
  food_groups: table([{ fg_id: "999", fg_ori_name: "GRUPO FICTICIO", fg_eng_name: "FICTIONAL GROUP" }]),
  component_groups: table([{ cg_id: "999", cg_descripcion: "GRUPO SINTÉTICO", cg_description: "SYNTHETIC GROUP" }]),
  value_types: table(["AR", "BE", "TR", "LT", "MT", "BL", "LZ", "RZ", "UD", "X"].map((vt_id) => ({ vt_id, vt_descripcion: `DEMO ${vt_id}`, vt_description: `DEMO ${vt_id}` }))),
  units: table(["g", "mg"].map((u_id) => ({ u_id, u_descripcion: `DEMO ${u_id}`, u_description: `DEMO ${u_id}` }))),
  expressions: table(["W", "M"].map((mu_id) => ({ mu_id, mu_descripcion: `DEMO ${mu_id}`, mu_description: `DEMO ${mu_id}` }))),
  "foods/900000001": `<foodresponse><food>${fieldsXml({ ...syntheticIndex[0], sci_name: "SPECIES FICTICIA", photo: "", foodexcode: "TEST-FOODEX" })}${syntheticValues.map((row) => `<foodvalue>${fieldsXml(row)}</foodvalue>`).join("")}</food></foodresponse>`,
  "foods/900000002": "<foodresponse><food/></foodresponse>",
};
export function syntheticFetch(calls = [], hook) {
  const requests = new Map(Object.entries(bedcaQueries).map(([name, definition]) => [buildBedcaQuery(definition), name]));
  for (const row of syntheticIndex) requests.set(buildBedcaQuery(bedcaFoodQuery(row.f_id)), `foods/${row.f_id}`);
  return async (url, options) => {
    const name = options.body ? requests.get(options.body) : url.split("/").at(-1);
    calls.push(name);
    const override = await hook?.(name, url, options);
    if (override) return override;
    if (url === bedcaSource.endpoint && syntheticResponses[name]) return new Response(syntheticResponses[name], { headers: { "content-type": "text/xml" } });
    if (url === bedcaSource.license.url) return new Response("%PDF-1.0\nDOCUMENTO SINTÉTICO, NO SON LAS CONDICIONES REALES");
    if (name === "query.js") return new Response("// SYNTHETIC SCRIPT: procquery.php");
    if (name === "foodresponse1.xsl") return new Response('<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"/>');
    throw new Error(`La fixture no permite esta petición: ${name}`);
  };
}
