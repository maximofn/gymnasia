import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile("App.tsx", readFileSync(new URL("../App.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const controllerSource = ts.createSourceFile(
  "measurementsController.ts",
  readFileSync(new URL("../controllers/measurementsController.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function callsTo(name: string, target = source): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(target) === name) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(target);
  return calls;
}

function enclosingMemo(call: ts.CallExpression, target = source): ts.CallExpression | undefined {
  let node: ts.Node | undefined = call.parent;
  while (node) {
    if (ts.isCallExpression(node) && node.expression.getText(target) === "useMemo") return node;
    node = node.parent;
  }
  return undefined;
}

describe("frontera de recálculo de medidas en el controlador del dominio", () => {
  it.each([
    ["prepareMeasurementHistory", ["store.measurements"]],
    ["resolveMeasurementSummary", ["preparedMeasurements", "latestHeightCm", "sex"]],
  ] as const)("%s solo se ejecuta dentro de un memo con sus dependencias reales", (name, dependencies) => {
    const calls = callsTo(name, controllerSource);
    expect(calls).toHaveLength(1);
    const memo = enclosingMemo(calls[0], controllerSource);
    expect(memo).toBeDefined();
    const array = memo!.arguments[1];
    expect(ts.isArrayLiteralExpression(array)).toBe(true);
    if (ts.isArrayLiteralExpression(array)) {
      expect(array.elements.map((entry) => entry.getText(controllerSource))).toEqual(dependencies);
    }
  });

  it("no reintroduce selectores independientes ni tarjetas o gráficos calculados en cada render", () => {
    expect(callsTo("resolveMeasurementMetricPair", controllerSource)).toHaveLength(0);
    expect(callsTo("selectLatestMeasurementWithMetric", controllerSource)).toHaveLength(0);
    expect(callsTo("buildMeasurementChartPoints", controllerSource)).toHaveLength(0);
    for (const name of ["buildMeasurementStatCard", "buildPreparedMeasurementChartPoints"]) {
      const calls = callsTo(name, controllerSource);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(enclosingMemo(call, controllerSource)).toBeDefined();
    }
  });
});
