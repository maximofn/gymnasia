/**
 * Tests del JSON del tablero. Sin dependencias: `node --test`.
 *
 * El tablero es un espejo manual, así que el fallo probable no es un bug de
 * render sino un dato mal copiado: un estado que no existe, una dependencia a
 * un ticket que se renombró, o un ciclo introducido al reordenar el trabajo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const board = JSON.parse(readFileSync(join(here, "..", "data", "board.json"), "utf8"));

const stateIds = new Set(board.states.map((s) => s.id));
const baselineIds = new Set(board.baselines.map((b) => b.id));

const tickets = board.groups.flatMap((group) =>
  group.tickets.map((ticket) => ({ ...ticket, groupId: group.id })),
);
const epics = board.groups.filter((group) => group.kind === "epic");

/** Todo lo que puede ser origen o destino de una dependencia. */
const nodes = new Map([
  ...tickets.map((t) => [t.id, t]),
  ...epics.map((e) => [e.id, e]),
]);

const ID_PATTERN = /^GYM-\d+$/;

test("meta y catálogos están completos", () => {
  assert.match(board.meta.updated, /^\d{4}-\d{2}-\d{2}$/, "meta.updated debe ser YYYY-MM-DD");
  assert.equal(typeof board.meta.linearBase, "string");
  assert.ok(board.meta.linearBase.startsWith("https://"), "linearBase debe ser https");
  assert.ok(stateIds.size >= 4, "faltan estados en el catálogo");
  assert.ok(baselineIds.size >= 3, "faltan estados de partida en el catálogo");
});

test("meta.ignore no oculta tickets que sí están en el tablero", () => {
  // `linear.py board` usa esta lista para no reportar el ruido de onboarding de
  // Linear. Un id mal escrito aquí silenciaría un ticket real sin avisar.
  for (const id of board.meta.ignore ?? []) {
    assert.match(id, ID_PATTERN, `meta.ignore tiene un id inválido: ${id}`);
    assert.ok(
      !nodes.has(id),
      `${id} está en meta.ignore y a la vez en el tablero: o se lista o se ignora`,
    );
  }
});

test("cada grupo tiene id, título, tipo válido y al menos un ticket", () => {
  assert.ok(board.groups.length > 0, "el tablero no tiene grupos");
  for (const group of board.groups) {
    assert.ok(group.id, "grupo sin id");
    assert.ok(group.title, `grupo ${group.id} sin título`);
    assert.ok(
      ["epic", "group"].includes(group.kind),
      `grupo ${group.id} con kind inválido: ${group.kind}`,
    );
    assert.ok(Array.isArray(group.tickets), `grupo ${group.id} sin lista de tickets`);
    assert.ok(group.tickets.length > 0, `grupo ${group.id} está vacío`);
    if (group.kind === "epic") {
      assert.match(group.id, ID_PATTERN, `la épica ${group.id} debe tener identifier de Linear`);
      assert.ok(stateIds.has(group.state), `la épica ${group.id} tiene estado inválido`);
    }
  }
});

test("todo ticket tiene id, título, épica y estado", () => {
  for (const ticket of tickets) {
    assert.match(ticket.id, ID_PATTERN, `id inválido: ${ticket.id}`);
    assert.ok(ticket.title, `${ticket.id} sin título`);
    assert.ok(ticket.groupId, `${ticket.id} sin grupo`);
    assert.ok(stateIds.has(ticket.state), `${ticket.id} tiene estado inválido: ${ticket.state}`);
    if (ticket.baseline !== undefined) {
      assert.ok(
        baselineIds.has(ticket.baseline),
        `${ticket.id} tiene estado de partida inválido: ${ticket.baseline}`,
      );
    }
    if (ticket.article !== undefined) {
      assert.ok(ticket.article.startsWith("https://"), `${ticket.id} tiene artículo no https`);
    }
  }
});

test("no hay identifiers duplicados", () => {
  const seen = new Set();
  for (const id of [...tickets.map((t) => t.id), ...epics.map((e) => e.id)]) {
    assert.ok(!seen.has(id), `identifier duplicado: ${id}`);
    seen.add(id);
  }
});

test("no hay dependencias ni relaciones a tickets inexistentes", () => {
  for (const [id, node] of nodes) {
    for (const dep of node.dependsOn ?? []) {
      assert.ok(nodes.has(dep), `${id} depende de ${dep}, que no existe en el tablero`);
      assert.notEqual(dep, id, `${id} depende de sí mismo`);
    }
    for (const rel of node.related ?? []) {
      assert.ok(nodes.has(rel), `${id} se relaciona con ${rel}, que no existe en el tablero`);
      assert.notEqual(rel, id, `${id} se relaciona consigo mismo`);
    }
  }
});

test("el grafo de dependencias no tiene ciclos", () => {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(Array.from(nodes.keys(), (id) => [id, WHITE]));

  const visit = (id, path) => {
    color.set(id, GRAY);
    for (const dep of nodes.get(id).dependsOn ?? []) {
      if (color.get(dep) === GRAY) {
        assert.fail(`ciclo de dependencias: ${[...path, id, dep].join(" → ")}`);
      }
      if (color.get(dep) === WHITE) visit(dep, [...path, id]);
    }
    color.set(id, BLACK);
  };

  for (const id of nodes.keys()) {
    if (color.get(id) === WHITE) visit(id, []);
  }
});

test("un ticket cerrado no puede estar bloqueado por uno abierto", () => {
  for (const [id, node] of nodes) {
    if (node.state !== "done") continue;
    for (const dep of node.dependsOn ?? []) {
      const blocker = nodes.get(dep);
      assert.ok(
        ["done", "canceled"].includes(blocker.state),
        `${id} está cerrado pero lo bloquea ${dep}, que sigue en ${blocker.state}`,
      );
    }
  }
});

test("el estado de partida solo se declara donde tiene sentido", () => {
  // Es información de la épica de tool calling: si aparece suelta, es un copia-pega.
  const withBaseline = tickets.filter((t) => t.baseline !== undefined);
  assert.ok(withBaseline.length > 0, "ningún ticket declara estado de partida");
  for (const ticket of withBaseline) {
    assert.equal(
      ticket.groupId,
      "GYM-33",
      `${ticket.id} declara estado de partida fuera de la épica de tool calling`,
    );
  }
});
