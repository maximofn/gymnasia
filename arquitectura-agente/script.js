/**
 * Tablero de seguimiento de Gymnasia.
 *
 * Espejo manual de Linear: todo sale de data/board.json, no hay API ni backend.
 * Tres vistas sobre los mismos datos (épicas, estado, dependencias) y un layout
 * de grafo por niveles calculado aquí mismo, sin librerías.
 */
(() => {
  "use strict";

  const DATA_URL = "data/board.json";
  const VIEWS = ["epics", "states", "deps"];

  // El punto de partida se reetiqueta en el orden recomendado: allí la lista es
  // de tickets abiertos, y un "Hecho" a secas se leería como ticket cerrado.
  const ROADMAP_BASELINE_LABEL = {
    done: "código ya escrito",
    partial: "código a medias",
    missing: "sin código",
  };

  // A diferencia del plegado de épicas, que es exploración pasajera, esto es una
  // preferencia sobre un bloque fijo de la cabecera: si se contrae, debe seguir
  // contraído al volver. De ahí que sí se persista.
  const ROADMAP_COLLAPSED_KEY = "gymnasia.board.roadmapCollapsed";

  function loadRoadmapCollapsed() {
    try {
      return localStorage.getItem(ROADMAP_COLLAPSED_KEY) === "1";
    } catch {
      return false; // modo privado o storage bloqueado: se abre, y ya está
    }
  }

  function saveRoadmapCollapsed(collapsed) {
    try {
      if (collapsed) localStorage.setItem(ROADMAP_COLLAPSED_KEY, "1");
      else localStorage.removeItem(ROADMAP_COLLAPSED_KEY);
    } catch {
      /* si no se puede guardar, el plegado dura lo que la sesión */
    }
  }

  const state = {
    data: null,
    tickets: new Map(), // id -> { ...ticket, group }
    blockedBy: new Map(), // id -> [ids que lo bloquean]
    blocks: new Map(), // id -> [ids a los que bloquea]
    relatedTo: new Map(), // id -> [ids relacionados]
    activeStates: new Set(),
    search: "",
    view: "epics",
    showRelated: false,
    selected: null,
    // Los tickets nacen plegados (el tablero se lee de un vistazo) y las épicas
    // abiertas. Ambos conjuntos sobreviven a los re-renders de filtro/búsqueda.
    expandedTickets: new Set(),
    collapsedEpics: new Set(),
    roadmapCollapsed: false, // se rellena en init desde localStorage
  };

  // ------------------------------------------------------------------ utils

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      node.setAttribute(key, String(value));
    }
    return node;
  }

  /** GYM-7 va antes que GYM-31: el orden natural es numérico, no alfabético. */
  function ticketNumber(id) {
    const match = /-(\d+)$/.exec(id);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  function stateLabel(id) {
    return state.data.states.find((s) => s.id === id)?.label ?? id;
  }

  function baselineInfo(id) {
    return state.data.baselines.find((b) => b.id === id) ?? null;
  }

  function linearUrl(id) {
    return `${state.data.meta.linearBase}${id}`;
  }

  function isEpicId(id) {
    return state.data.groups.some((g) => g.kind === "epic" && g.id === id);
  }

  function nodeTitle(id) {
    if (state.tickets.has(id)) return state.tickets.get(id).title;
    const group = state.data.groups.find((g) => g.id === id);
    return group ? group.title : id;
  }

  function nodeState(id) {
    if (state.tickets.has(id)) return state.tickets.get(id).state;
    const group = state.data.groups.find((g) => g.id === id);
    return group?.state ?? "backlog";
  }

  // ------------------------------------------------------------------ índice

  function indexData(data) {
    state.tickets.clear();
    state.blockedBy.clear();
    state.blocks.clear();
    state.relatedTo.clear();

    const push = (map, key, value) => {
      if (!map.has(key)) map.set(key, []);
      if (!map.get(key).includes(value)) map.get(key).push(value);
    };

    for (const group of data.groups) {
      for (const ticket of group.tickets) {
        state.tickets.set(ticket.id, { ...ticket, group });
      }
    }

    // Las épicas también declaran dependencias, así que entran en el grafo.
    const withDeps = [
      ...data.groups.filter((g) => g.kind === "epic"),
      ...state.tickets.values(),
    ];

    for (const item of withDeps) {
      for (const dep of item.dependsOn ?? []) {
        push(state.blockedBy, item.id, dep);
        push(state.blocks, dep, item.id);
      }
      for (const rel of item.related ?? []) {
        push(state.relatedTo, item.id, rel);
        push(state.relatedTo, rel, item.id);
      }
    }
  }

  // ------------------------------------------------------------------ filtros

  function matchesFilters(ticket) {
    if (!state.activeStates.has(ticket.state)) return false;
    if (!state.search) return true;
    const needle = state.search.toLowerCase();
    return (
      ticket.id.toLowerCase().includes(needle) ||
      ticket.title.toLowerCase().includes(needle) ||
      (ticket.summary ?? "").toLowerCase().includes(needle)
    );
  }

  // ------------------------------------------------------------------ resumen

  /**
   * Orden recomendado de resolución. Va lo primero de la página porque responde
   * a la única pregunta que se hace uno al abrir el tablero: "¿y ahora qué?".
   *
   * Se alimenta de `recommendedOrder` en board.json, pero filtra por el estado
   * real de cada ticket: lo cerrado o cancelado desaparece, y una fase entera se
   * oculta cuando ya no le queda nada. Así el orden se va vaciando solo según
   * avanza el trabajo, sin tener que mantenerlo a mano.
   */
  function renderRoadmap() {
    const container = $("#roadmap");
    container.innerHTML = "";

    const phases = state.data.recommendedOrder ?? [];
    const pending = phases
      .map((phase) => ({
        ...phase,
        tickets: phase.tickets.filter((id) => {
          const st = nodeState(id);
          return st && st !== "done" && st !== "canceled";
        }),
      }))
      .filter((phase) => phase.tickets.length > 0);

    if (pending.length === 0) {
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const pendingCount = pending.reduce((n, phase) => n + phase.tickets.length, 0);
    container.classList.toggle("is-collapsed", state.roadmapCollapsed);

    const head = el("div", "roadmap-head");

    const titleRow = el("div", "roadmap-title-row");
    const caret = toggleButton("el orden recomendado", !state.roadmapCollapsed);
    titleRow.append(caret);
    titleRow.append(el("h2", "roadmap-title", "Por dónde seguir"));
    // El recuento se queda visible al contraer: plegado sigue diciendo algo.
    titleRow.append(
      el(
        "span",
        "roadmap-count",
        `${pending.length} fases · ${pendingCount} pendientes`,
      ),
    );
    head.append(titleRow);

    head.append(
      el(
        "p",
        "roadmap-intro",
        "Orden recomendado de resolución. Lo cerrado desaparece de la lista, " +
          "así que lo primero de arriba es siempre lo siguiente que toca.",
      ),
    );

    head.addEventListener("click", () => {
      state.roadmapCollapsed = !state.roadmapCollapsed;
      container.classList.toggle("is-collapsed", state.roadmapCollapsed);
      setToggleState(caret, "el orden recomendado", !state.roadmapCollapsed);
      saveRoadmapCollapsed(state.roadmapCollapsed);
    });

    container.append(head);

    const list = el("ol", "roadmap-phases");

    // La numeración es la de las fases que quedan, no la del JSON: al cerrar una
    // fase entera el resto sube, en vez de dejar huecos.
    pending.forEach((phase, index) => {
      const item = el("li", "roadmap-phase");
      item.dataset.phase = phase.id;

      const header = el("div", "roadmap-phase-head");
      header.append(el("span", "roadmap-step", String(index + 1)));
      header.append(el("h3", "roadmap-phase-title", phase.title));
      item.append(header);

      const chips = el("div", "roadmap-tickets");
      for (const id of phase.tickets) {
        const chip = el("a", `roadmap-ticket state-${nodeState(id)}`);
        chip.href = linearUrl(id);
        chip.rel = "noopener";
        chip.append(el("span", "dot"));
        chip.append(el("span", "roadmap-ticket-id", id));
        chip.append(el("span", "roadmap-ticket-title", nodeTitle(id)));

        // El punto de partida es lo que decide si un ticket cuesta una tarde o
        // una semana. Aquí se etiqueta como "código", no como "hecho": en una
        // lista de pendientes, un "✅ Hecho" se lee como ticket cerrado y todos
        // estos siguen abiertos (les faltan tests y artículo).
        const baselineId = state.tickets.get(id)?.baseline;
        const base = baselineId ? baselineInfo(baselineId) : null;
        if (base) {
          chip.append(
            el(
              "span",
              `roadmap-ticket-base base-${base.id}`,
              `${base.icon} ${ROADMAP_BASELINE_LABEL[base.id] ?? base.label}`,
            ),
          );
        }

        chips.append(chip);
      }
      item.append(chips);

      if (phase.why) item.append(el("p", "roadmap-why", phase.why));

      list.append(item);
    });

    container.append(list);
  }

  function renderSummary() {
    const container = $("#summary");
    container.innerHTML = "";

    const all = Array.from(state.tickets.values());
    const live = all.filter((t) => t.state !== "canceled");
    const done = live.filter((t) => t.state === "done").length;
    const inProgress = all.filter((t) => t.state === "in_progress").length;
    const pending = live.length - done - inProgress;
    const pct = live.length ? Math.round((done / live.length) * 100) : 0;

    const stats = [
      { value: `${pct}%`, label: "Progreso global" },
      { value: String(done), label: "Cerrados" },
      { value: String(inProgress), label: "En curso" },
      { value: String(pending), label: "Pendientes" },
    ];

    for (const stat of stats) {
      const card = el("div", "stat");
      card.append(el("div", "stat-value", stat.value), el("div", "stat-label", stat.label));
      container.append(card);
    }
  }

  function renderMeta() {
    $("#meta-updated").textContent = `Actualizado ${state.data.meta.updated}`;
    $("#meta-count").textContent = `${state.tickets.size} tickets · ${
      state.data.groups.filter((g) => g.kind === "epic").length
    } épicas`;
  }

  // ------------------------------------------------------------------ chips

  function renderStateFilters() {
    const container = $("#state-filters");
    container.innerHTML = "";

    for (const st of state.data.states) {
      const chip = el("button", `chip state-${st.id}`);
      chip.type = "button";
      chip.dataset.state = st.id;
      chip.setAttribute("aria-pressed", String(state.activeStates.has(st.id)));
      chip.append(el("span", "dot"), document.createTextNode(st.label));
      chip.addEventListener("click", () => {
        if (state.activeStates.has(st.id)) state.activeStates.delete(st.id);
        else state.activeStates.add(st.id);
        chip.setAttribute("aria-pressed", String(state.activeStates.has(st.id)));
        renderEpics();
        renderColumns();
      });
      container.append(chip);
    }
  }

  // ------------------------------------------------------------------ piezas

  function statePill(stateId) {
    const pill = el("span", `state-pill state-${stateId}`);
    pill.append(el("span", "dot"), document.createTextNode(stateLabel(stateId)));
    return pill;
  }

  function ticketTags(ticket) {
    const tags = el("div", "ticket-tags");

    const blockedBy = state.blockedBy.get(ticket.id) ?? [];
    const open = blockedBy.filter((id) => nodeState(id) !== "done");
    if (open.length) {
      tags.append(el("span", "tag blocked", `⛔ bloqueado por ${open.join(", ")}`));
    } else if (blockedBy.length) {
      tags.append(el("span", "tag", `✓ desbloqueado (${blockedBy.join(", ")})`));
    }

    const blocks = state.blocks.get(ticket.id) ?? [];
    if (blocks.length) {
      const label =
        blocks.length > 4 ? `bloquea a ${blocks.length} tickets` : `bloquea a ${blocks.join(", ")}`;
      tags.append(el("span", "tag blocks", `↳ ${label}`));
    }

    const related = ticket.related ?? [];
    if (related.length) {
      tags.append(el("span", "tag related", `~ ${related.join(", ")}`));
    }

    if (ticket.article) {
      const link = el("a", "tag article", "↗ artículo");
      link.href = ticket.article;
      link.rel = "noopener";
      tags.append(link);
    }

    return tags.childElementCount ? tags : null;
  }

  /** Botón de plegado. El texto del nombre es un enlace, así que no puede serlo la fila. */
  function toggleButton(label, expanded) {
    const button = el("button", "toggle-caret");
    button.type = "button";
    button.textContent = "›";
    setToggleState(button, label, expanded);
    return button;
  }

  function setToggleState(button, label, expanded) {
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `${expanded ? "Contraer" : "Expandir"} ${label}`);
  }

  function ticketRow(ticket) {
    const expanded = state.expandedTickets.has(ticket.id);
    const row = el("li", `ticket is-${ticket.state}${expanded ? " is-expanded" : ""}`);

    const detail = el("div", "ticket-detail");
    if (ticket.summary) detail.append(el("div", "ticket-summary", ticket.summary));
    const tags = ticketTags(ticket);
    if (tags) detail.append(tags);
    const hasDetail = detail.childElementCount > 0;

    const caret = hasDetail ? toggleButton(ticket.id, expanded) : el("span", "toggle-caret empty");

    const id = el("span", "ticket-id", ticket.id);

    const main = el("div", "ticket-main");
    const title = el("a", "ticket-title", ticket.title);
    title.href = linearUrl(ticket.id);
    title.rel = "noopener";
    title.title = `Abrir ${ticket.id} en Linear`;
    main.append(title);
    if (hasDetail) main.append(detail);

    const side = el("div", "ticket-side");
    side.append(statePill(ticket.state));
    const isClosed = ticket.state === "done" || ticket.state === "canceled";
    const baseline = isClosed ? null : baselineInfo(ticket.baseline);
    if (baseline) {
      side.append(el("span", "baseline", `${baseline.icon} ${baseline.label}`));
    }

    if (hasDetail) {
      row.addEventListener("click", (event) => {
        if (event.target.closest("a")) return; // el nombre lleva a Linear
        const nowExpanded = !state.expandedTickets.has(ticket.id);
        if (nowExpanded) state.expandedTickets.add(ticket.id);
        else state.expandedTickets.delete(ticket.id);
        row.classList.toggle("is-expanded", nowExpanded);
        setToggleState(caret, ticket.id, nowExpanded);
      });
    }

    row.append(caret, id, main, side);
    return row;
  }

  // ------------------------------------------------------------- vista épicas

  function renderEpics() {
    const container = $("#view-epics");
    container.innerHTML = "";

    let visible = 0;

    for (const group of state.data.groups) {
      const tickets = group.tickets.filter(matchesFilters);
      if (!tickets.length) continue;
      visible += tickets.length;

      const collapsed = state.collapsedEpics.has(group.id);
      const card = el("section", `epic${collapsed ? " is-collapsed" : ""}`);
      const head = el("div", "epic-head");

      const caret = toggleButton(group.title, !collapsed);

      const titleRow = el("div", "epic-title-row");
      titleRow.append(caret);
      if (group.kind === "epic") {
        titleRow.append(el("span", "ticket-id", group.id));
      }

      const heading = el("h2", "epic-title");
      if (group.kind === "epic") {
        const link = el("a", null, group.title);
        link.href = linearUrl(group.id);
        link.rel = "noopener";
        link.title = `Abrir ${group.id} en Linear`;
        heading.append(link);
      } else {
        heading.textContent = group.title;
      }
      titleRow.append(heading);

      titleRow.append(
        el("span", `epic-kind is-${group.kind}`, group.kind === "epic" ? "Épica" : "Sin épica"),
      );
      head.append(titleRow);

      head.addEventListener("click", (event) => {
        if (event.target.closest("a")) return; // el nombre lleva a Linear
        const nowCollapsed = !state.collapsedEpics.has(group.id);
        if (nowCollapsed) state.collapsedEpics.add(group.id);
        else state.collapsedEpics.delete(group.id);
        card.classList.toggle("is-collapsed", nowCollapsed);
        setToggleState(caret, group.title, !nowCollapsed);
      });

      if (group.summary) head.append(el("p", "epic-summary", group.summary));

      // El progreso se calcula sobre la épica entera, no sobre lo filtrado:
      // si no, filtrar por "Done" mostraría siempre 100%.
      const live = group.tickets.filter((t) => t.state !== "canceled");
      const done = live.filter((t) => t.state === "done").length;
      const pct = live.length ? Math.round((done / live.length) * 100) : 0;

      const progress = el("div", "progress");
      const bar = el("div", "progress-bar");
      const fill = el("div", "progress-fill");
      fill.style.width = `${pct}%`;
      bar.append(fill);
      progress.append(bar, el("span", "progress-text", `${done}/${live.length} · ${pct}%`));
      head.append(progress);

      const list = el("ul", "ticket-list");
      for (const ticket of tickets.slice().sort((a, b) => ticketNumber(a.id) - ticketNumber(b.id))) {
        list.append(ticketRow(ticket));
      }

      card.append(head, list);
      container.append(card);
    }

    if (!visible) {
      container.append(el("p", "empty", "Ningún ticket coincide con el filtro."));
    }
  }

  // ------------------------------------------------------------ vista estados

  function renderColumns() {
    const container = $("#columns");
    container.innerHTML = "";

    for (const st of state.data.states) {
      if (!state.activeStates.has(st.id)) continue;

      const tickets = Array.from(state.tickets.values())
        .filter((t) => t.state === st.id && matchesFilters(t))
        .sort((a, b) => ticketNumber(a.id) - ticketNumber(b.id));

      const column = el("section", "column");
      const head = el("div", "column-head");
      head.append(statePill(st.id), el("span", "column-count", String(tickets.length)));
      column.append(head);

      if (!tickets.length) {
        column.append(el("p", "empty", "—"));
      }

      for (const ticket of tickets) {
        const card = el("a", `card is-${ticket.state}`);
        card.href = linearUrl(ticket.id);
        card.rel = "noopener";
        card.style.borderLeftColor = `var(--state-${ticket.state})`;
        card.append(
          el("div", "card-id", ticket.id),
          el("div", "card-title", ticket.title),
          el("div", "card-epic", ticket.group.kind === "epic" ? ticket.group.id : "Sin épica"),
        );
        column.append(card);
      }

      container.append(column);
    }
  }

  // ------------------------------------------------------- vista dependencias

  function renderBlockers() {
    const container = $("#blockers");
    container.innerHTML = "";

    // Solo los cuellos de botella: quien bloquea a un único ticket ya se ve en
    // el grafo, y listarlos todos convierte esto en una pared de filas iguales.
    const entries = Array.from(state.blocks.entries())
      .filter(([, targets]) => targets.length > 1)
      .sort((a, b) => b[1].length - a[1].length || ticketNumber(a[0]) - ticketNumber(b[0]));

    if (!entries.length) {
      container.append(el("p", "empty", "No hay ningún ticket que bloquee a más de uno."));
      return;
    }

    for (const [id, targets] of entries) {
      const row = el("div", "blocker-row");
      const label = el("span", "blocker-label");
      const strong = el("strong", null, id);
      label.append(strong, document.createTextNode(` bloquea a ${targets.length}:`));
      row.append(label);

      for (const target of targets.slice().sort((a, b) => ticketNumber(a) - ticketNumber(b))) {
        const chip = el("a", `mini-chip state-${nodeState(target)}`, target);
        chip.href = linearUrl(target);
        chip.rel = "noopener";
        chip.title = nodeTitle(target);
        row.append(chip);
      }

      container.append(row);
    }
  }

  const GRAPH = {
    nodeW: 132,
    nodeH: 42,
    colGap: 78,
    rowGap: 12,
    margin: 18,
  };

  /** Nivel = camino más largo desde un nodo sin dependencias. Solo cuentan las de bloqueo. */
  function computeLevels(nodes) {
    const levels = new Map();
    const visiting = new Set();

    const levelOf = (id) => {
      if (levels.has(id)) return levels.get(id);
      if (visiting.has(id)) return 0; // los ciclos los caza el test; aquí solo no colgarse
      visiting.add(id);
      const deps = (state.blockedBy.get(id) ?? []).filter((d) => nodes.has(d));
      const level = deps.length ? Math.max(...deps.map(levelOf)) + 1 : 0;
      visiting.delete(id);
      levels.set(id, level);
      return level;
    };

    for (const id of nodes) levelOf(id);
    return levels;
  }

  function graphNodeIds() {
    const ids = new Set();
    for (const [id, deps] of state.blockedBy) {
      ids.add(id);
      for (const dep of deps) ids.add(dep);
    }
    if (state.showRelated) {
      for (const [id, rels] of state.relatedTo) {
        ids.add(id);
        for (const rel of rels) ids.add(rel);
      }
    }
    return ids;
  }

  function graphEdges(nodes) {
    const edges = [];
    for (const [id, deps] of state.blockedBy) {
      for (const dep of deps) {
        if (nodes.has(id) && nodes.has(dep)) edges.push({ from: dep, to: id, kind: "blocks" });
      }
    }
    if (state.showRelated) {
      const seen = new Set();
      for (const [id, rels] of state.relatedTo) {
        for (const rel of rels) {
          const key = [id, rel].sort().join("|");
          if (seen.has(key) || !nodes.has(id) || !nodes.has(rel)) continue;
          seen.add(key);
          edges.push({ from: id, to: rel, kind: "related" });
        }
      }
    }
    return edges;
  }

  function renderGraph() {
    const svg = $("#graph");
    svg.innerHTML = "";
    svg.classList.remove("has-selection");
    svg.classList.add("graph");

    const nodes = graphNodeIds();
    if (!nodes.size) return;

    const levels = computeLevels(nodes);
    const byLevel = new Map();
    for (const id of nodes) {
      const level = levels.get(id) ?? 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level).push(id);
    }

    // Dentro de cada nivel, agrupar por épica mantiene las flechas más rectas.
    const groupOrder = new Map(state.data.groups.map((g, i) => [g.id, i]));
    const groupOf = (id) => {
      if (isEpicId(id)) return groupOrder.get(id) ?? 99;
      const ticket = state.tickets.get(id);
      return ticket ? groupOrder.get(ticket.group.id) ?? 99 : 99;
    };

    const pos = new Map();
    const rowOf = new Map();
    let maxRows = 0;
    for (const [level, ids] of Array.from(byLevel.entries()).sort((a, b) => a[0] - b[0])) {
      // Baricentro: cada nodo se coloca a la altura media de quienes lo bloquean,
      // así las flechas salen lo más rectas posible. El primer nivel no tiene
      // predecesores, se ordena por épica.
      const barycenter = (id) => {
        const rows = (state.blockedBy.get(id) ?? [])
          .filter((dep) => rowOf.has(dep))
          .map((dep) => rowOf.get(dep));
        return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.NaN;
      };

      ids.sort((a, b) => {
        const ba = barycenter(a);
        const bb = barycenter(b);
        if (!Number.isNaN(ba) && !Number.isNaN(bb) && ba !== bb) return ba - bb;
        return groupOf(a) - groupOf(b) || ticketNumber(a) - ticketNumber(b);
      });

      maxRows = Math.max(maxRows, ids.length);
      ids.forEach((id, row) => {
        rowOf.set(id, row);
        pos.set(id, {
          x: GRAPH.margin + level * (GRAPH.nodeW + GRAPH.colGap),
          y: GRAPH.margin + row * (GRAPH.nodeH + GRAPH.rowGap),
        });
      });
    }

    const levelCount = byLevel.size;
    const width = GRAPH.margin * 2 + levelCount * GRAPH.nodeW + (levelCount - 1) * GRAPH.colGap;
    const height = GRAPH.margin * 2 + maxRows * GRAPH.nodeH + (maxRows - 1) * GRAPH.rowGap;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.minWidth = `${Math.min(width, 900)}px`;

    const defs = svgEl("defs");
    for (const [id, color] of [["arrDep", "#5b6472"], ["arrOn", "#cbff1a"]]) {
      const marker = svgEl("marker", {
        id,
        markerWidth: 9,
        markerHeight: 8,
        refX: 8,
        refY: 4,
        orient: "auto",
      });
      marker.append(svgEl("path", { d: "M0,0 L8,4 L0,8 z", fill: color }));
      defs.append(marker);
    }
    svg.append(defs);

    const edgeLayer = svgEl("g", { class: "edges" });
    const nodeLayer = svgEl("g", { class: "nodes" });
    svg.append(edgeLayer, nodeLayer);

    for (const edge of graphEdges(nodes)) {
      const a = pos.get(edge.from);
      const b = pos.get(edge.to);
      if (!a || !b) continue;

      const forward = b.x > a.x;
      const sx = forward ? a.x + GRAPH.nodeW : a.x;
      const sy = a.y + GRAPH.nodeH / 2;
      const tx = forward ? b.x : b.x + GRAPH.nodeW;
      const ty = b.y + GRAPH.nodeH / 2;
      const bend = forward ? Math.max(30, (tx - sx) / 2) : -40;

      const path = svgEl("path", {
        class: `gedge ${edge.kind}`,
        d: `M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx},${ty}`,
        "marker-end": edge.kind === "blocks" ? "url(#arrDep)" : "",
        "data-from": edge.from,
        "data-to": edge.to,
      });
      edgeLayer.append(path);
    }

    for (const id of nodes) {
      const { x, y } = pos.get(id);
      const stateId = nodeState(id);
      const epic = isEpicId(id);

      const group = svgEl("g", {
        class: `gnode ${epic ? "is-epic" : ""}`,
        "data-id": id,
        tabindex: 0,
        role: "button",
      });
      const title = svgEl("title");
      title.textContent = `${id} — ${nodeTitle(id)}`;
      group.append(title);

      group.append(
        svgEl("rect", {
          x,
          y,
          width: GRAPH.nodeW,
          height: GRAPH.nodeH,
          rx: 9,
          stroke: `var(--state-${stateId})`,
        }),
      );

      const label = svgEl("text", { x: x + 12, y: y + 15 });
      label.textContent = id;
      const sub = svgEl("text", { x: x + 12, y: y + 29, class: "gnode-sub" });
      sub.textContent = epic ? "épica" : stateLabel(stateId);
      group.append(label, sub);

      const select = () => selectNode(id === state.selected ? null : id);
      group.addEventListener("click", select);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });

      nodeLayer.append(group);
    }

    if (state.selected && nodes.has(state.selected)) applySelection();
    else state.selected = null;
  }

  function selectNode(id) {
    state.selected = id;
    applySelection();
  }

  function applySelection() {
    const svg = $("#graph");
    const id = state.selected;

    $$("#graph .gnode").forEach((n) => n.classList.remove("on", "selected"));
    $$("#graph .gedge").forEach((e) => e.classList.remove("on"));

    if (!id) {
      svg.classList.remove("has-selection");
      return;
    }

    svg.classList.add("has-selection");
    const connected = new Set([id]);

    $$("#graph .gedge").forEach((edge) => {
      const from = edge.getAttribute("data-from");
      const to = edge.getAttribute("data-to");
      if (from === id || to === id) {
        edge.classList.add("on");
        connected.add(from);
        connected.add(to);
      }
    });

    $$("#graph .gnode").forEach((node) => {
      const nodeId = node.getAttribute("data-id");
      if (connected.has(nodeId)) node.classList.add("on");
      if (nodeId === id) node.classList.add("selected");
    });
  }

  function renderGraphLegend() {
    const container = $("#graph-legend");
    container.innerHTML = "";

    const items = [
      { swatch: "line", color: "#5b6472", label: "bloquea a →" },
      { swatch: "dashed", color: "#2f3644", label: "relacionado (no bloquea)" },
      { swatch: "box", color: "var(--state-done)", label: "cerrado" },
      { swatch: "box", color: "var(--state-in_progress)", label: "en curso" },
      { swatch: "box", color: "var(--state-backlog)", label: "pendiente" },
    ];

    for (const item of items) {
      const wrapper = el("span", "legend-item");
      const mark =
        item.swatch === "box"
          ? el("span", "legend-box")
          : el("span", `legend-swatch ${item.swatch === "dashed" ? "dashed" : ""}`);
      mark.style.color = item.color;
      if (item.swatch !== "box") mark.style.borderTopColor = item.color;
      wrapper.append(mark, document.createTextNode(item.label));
      container.append(wrapper);
    }
  }

  // ------------------------------------------------------------------ vistas

  function setView(view) {
    if (!VIEWS.includes(view)) view = "epics";
    state.view = view;

    $$(".tab-btn").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    VIEWS.forEach((name) => {
      $(`#view-${name}`).classList.toggle("active", name === view);
    });

    // Los filtros de estado no aplican al grafo: allí manda la topología.
    $("#filters").style.display = view === "deps" ? "none" : "";

    if (window.location.hash.slice(1) !== view) {
      window.history.replaceState(null, "", `#${view}`);
    }
  }

  function bindEvents() {
    $$(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    $("#search").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderEpics();
      renderColumns();
    });

    $("#show-related").addEventListener("change", (event) => {
      state.showRelated = event.target.checked;
      renderGraph();
    });

    window.addEventListener("hashchange", () => setView(window.location.hash.slice(1)));
  }

  // -------------------------------------------------------------------- init

  async function init() {
    let data;
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      const loading = $("#loading");
      loading.classList.add("error");
      loading.textContent = `No se pudo cargar ${DATA_URL}: ${error.message}`;
      return;
    }

    state.data = data;
    state.activeStates = new Set(data.states.map((s) => s.id));
    state.roadmapCollapsed = loadRoadmapCollapsed();
    indexData(data);

    renderMeta();
    renderRoadmap();
    renderSummary();
    renderStateFilters();
    renderEpics();
    renderColumns();
    renderBlockers();
    renderGraph();
    renderGraphLegend();
    bindEvents();

    $("#loading").remove();
    setView(window.location.hash.slice(1) || "epics");
    document.body.dataset.ready = "true";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
