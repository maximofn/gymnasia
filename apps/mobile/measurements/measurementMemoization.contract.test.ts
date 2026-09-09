import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = ts.createSourceFile("App.tsx", readFileSync(new URL("../App.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function callsTo(name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === name) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return calls;
}

function enclosingMemo(call: ts.CallExpression): ts.CallExpression | undefined {
  let node: ts.Node | undefined = call.parent;
  while (node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useMemo") return node;
    node = node.parent;
  }
  return undefined;
}

describe("frontera de recálculo de medidas en el componente raíz", () => {
  it.each([
    ["prepareMeasurementHistory", ["store.measurements"]],
    ["resolveMeasurementSummary", ["preparedMeasurements", "latestBodyHeightCm", "userSex"]],
  ] as const)("%s solo se ejecuta dentro de un memo con sus dependencias reales", (name, dependencies) => {
    const calls = callsTo(name);
    expect(calls).toHaveLength(1);
    const memo = enclosingMemo(calls[0]);
    expect(memo).toBeDefined();
    const array = memo!.arguments[1];
    expect(ts.isArrayLiteralExpression(array)).toBe(true);
    if (ts.isArrayLiteralExpression(array)) {
      expect(array.elements.map((entry) => entry.getText(source))).toEqual(dependencies);
    }
  });

  it("no reintroduce selectores independientes ni tarjetas o gráficos calculados en cada render", () => {
    expect(callsTo("resolveMeasurementMetricPair")).toHaveLength(0);
    expect(callsTo("selectLatestMeasurementWithMetric")).toHaveLength(0);
    expect(callsTo("buildMeasurementChartPoints")).toHaveLength(0);
    for (const name of ["buildMeasurementStatCard", "buildPreparedMeasurementChartPoints"]) {
      const calls = callsTo(name);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(enclosingMemo(call)).toBeDefined();
    }
  });
});
