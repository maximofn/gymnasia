#!/usr/bin/env python3
"""Cliente para la API GraphQL de Linear: leer, crear y modificar tickets.

Lee LINEAR_API_KEY del .env de la raíz del repo (git-ignored). NUNCA imprime la
key. Diseñado para que el agente pueda operar Linear sin que el secreto pase por
su contexto.

Lectura:
  uv run linear.py list                          # issues abiertos
  uv run linear.py list --all                    # incluye done/canceled
  uv run linear.py list --state "In Progress"    # filtra por estado exacto
  uv run linear.py get GYM-12                     # detalle de un issue
  uv run linear.py teams                          # lista equipos
  uv run linear.py states GYM                     # estados del flujo de un equipo

Escritura:
  uv run linear.py create --team GYM --title "Bug X" \
      --description "..." --state "Todo" --priority high
  uv run linear.py update GYM-12 --state "In Progress" --priority urgent
  uv run linear.py update GYM-12 --title "Nuevo título" --description "..."
  uv run linear.py link GYM-12 --blocked-by GYM-10 --blocked-by GYM-11
  uv run linear.py close GYM-12 --evidence "npm test: 24/24"
  uv run linear.py comment GYM-12 --body "Comentario"

Prioridades: none | urgent | high | medium | low
"""
import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

API_URL = "https://api.linear.app/graphql"

PRIORITY_MAP = {"none": 0, "urgent": 1, "high": 2, "medium": 3, "low": 4}

TEST_PLAN_HEADING = re.compile(r"(?im)^##\s+Plan de pruebas\s*$")
TEST_PLAN_REQUIREMENTS = {
    "unitarios": re.compile(r"(?i)\bunitari[oa]s?\b"),
    "E2E": re.compile(r"(?i)\b(?:e2e|end[- ]to[- ]end)\b"),
    "integración con proveedor falso": re.compile(
        r"(?i)\b(?:proveedor(?:es)?\s+falso|fake provider)\b"
    ),
    "contrato": re.compile(r"(?i)\bcontrat(?:o|os)\b"),
    "regresión": re.compile(r"(?i)\bregresi[oó]n\b"),
    "fuzzing/property-based": re.compile(r"(?i)\b(?:fuzz(?:ing)?|property[- ]based)\b"),
}

TEST_PLAN_TEMPLATE = """## Plan de pruebas
- [ ] Unitarios: <casos concretos o No aplica: motivo>
- [ ] E2E: <casos concretos o No aplica: motivo>
- [ ] Integración con proveedor falso: <casos concretos o No aplica: motivo>
- [ ] Contrato: <casos concretos o No aplica: motivo>
- [ ] Regresión: <casos concretos o No aplica: motivo>
- [ ] Fuzzing / property-based: <casos concretos o No aplica: motivo>"""

CHECKED_TEST_ITEM = re.compile(r"^\s*[-*]\s*\[[xX]\]")
NOT_APPLICABLE = re.compile(r"(?i)\bno\s+aplica\s*:\s*(.+)$")
PLACEHOLDER = re.compile(r"<[^>]+>")


def repo_root() -> Path:
    # scripts/ -> <skill>/ -> skills/ -> .claude/ -> repo root
    return Path(__file__).resolve().parents[4]


def load_api_key() -> str:
    env_value = os.environ.get("LINEAR_API_KEY", "").strip()
    if env_value:
        return env_value

    configured_env_path = os.environ.get("LINEAR_ENV_FILE", "").strip()
    env_path = Path(configured_env_path) if configured_env_path else repo_root() / ".env"
    if not env_path.exists():
        sys.exit(f"No existe {env_path}")
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        if line.startswith("LINEAR_API_KEY="):
            val = line.split("=", 1)[1].strip()
            if (val.startswith('"') and val.endswith('"')) or (
                val.startswith("'") and val.endswith("'")
            ):
                val = val[1:-1]
            return val
    sys.exit("LINEAR_API_KEY no encontrada en .env")


def query(gql: str, variables: dict | None = None) -> dict:
    key = load_api_key()
    body = json.dumps({"query": gql, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": key},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()}")
    if "errors" in data:
        sys.exit("Error de Linear: " + json.dumps(data["errors"], indent=2))
    return data["data"]


# ---------- resolvers ----------

def resolve_issue_uuid(identifier: str) -> str:
    m = re.match(r"^([A-Za-z]+)-(\d+)$", identifier.strip())
    if not m:
        sys.exit(f"Identifier inválido: {identifier} (esperado tipo GYM-12)")
    team_key, number = m.group(1).upper(), int(m.group(2))
    gql = """
    query($key: String!, $num: Float!) {
      issues(filter: {team: {key: {eq: $key}}, number: {eq: $num}}) {
        nodes { id identifier }
      }
    }
    """
    nodes = query(gql, {"key": team_key, "num": number})["issues"]["nodes"]
    if not nodes:
        sys.exit(f"No se encontró el issue {identifier}")
    return nodes[0]["id"]


def resolve_team_id(team_key: str) -> str:
    gql = "query($key:String!){ teams(filter:{key:{eq:$key}}){ nodes{ id } } }"
    nodes = query(gql, {"key": team_key.upper()})["teams"]["nodes"]
    if not nodes:
        sys.exit(f"No se encontró el equipo {team_key}")
    return nodes[0]["id"]


def resolve_state_id(team_key: str, state_name: str) -> str:
    gql = """
    query($key:String!){
      workflowStates(filter:{team:{key:{eq:$key}}}){ nodes{ id name } }
    }
    """
    nodes = query(gql, {"key": team_key.upper()})["workflowStates"]["nodes"]
    for n in nodes:
        if n["name"].lower() == state_name.lower():
            return n["id"]
    names = ", ".join(n["name"] for n in nodes)
    sys.exit(f"Estado '{state_name}' no existe en {team_key}. Disponibles: {names}")


def priority_int(name: str) -> int:
    if name.lower() not in PRIORITY_MAP:
        sys.exit(f"Prioridad inválida: {name}. Usa: {', '.join(PRIORITY_MAP)}")
    return PRIORITY_MAP[name.lower()]


def extract_test_plan(description: str | None) -> str:
    """Devuelve solo la sección de pruebas o termina con un mensaje accionable."""
    if not description:
        sys.exit(
            "Todo ticket nuevo necesita descripción y un plan de pruebas.\n\n"
            + TEST_PLAN_TEMPLATE
        )

    heading = TEST_PLAN_HEADING.search(description)
    if not heading:
        sys.exit(
            "Falta la sección obligatoria '## Plan de pruebas'.\n\n"
            + TEST_PLAN_TEMPLATE
        )

    section = description[heading.end():]
    next_heading = re.search(r"(?m)^##\s+", section)
    if next_heading:
        section = section[:next_heading.start()]

    return section


def test_plan_category_lines(section: str, pattern: re.Pattern) -> list[str]:
    """Localiza la categoría en la etiqueta anterior a ':' y no en su explicación."""
    return [
        line.strip()
        for line in section.splitlines()
        if pattern.search(line.split(":", 1)[0])
    ]


def validate_test_plan(description: str | None) -> str:
    """Exige que cada ticket nuevo evalúe todas las capas de pruebas acordadas."""
    section = extract_test_plan(description)

    missing = [
        label for label, pattern in TEST_PLAN_REQUIREMENTS.items()
        if not test_plan_category_lines(section, pattern)
    ]
    if missing:
        sys.exit(
            "El plan de pruebas no evalúa: " + ", ".join(missing) + ".\n"
            "Añade un caso concreto o 'No aplica: <motivo>' para cada categoría.\n\n"
            + TEST_PLAN_TEMPLATE
        )
    assert description is not None
    return description


def test_plan_line_is_resolved(line: str) -> bool:
    """Una categoría está resuelta si se completó o justifica por qué no aplica."""
    not_applicable = NOT_APPLICABLE.search(line)
    if not_applicable:
        reason = not_applicable.group(1).strip()
        return bool(reason) and not PLACEHOLDER.search(reason)

    if not CHECKED_TEST_ITEM.search(line) or PLACEHOLDER.search(line):
        return False
    _label, separator, detail = line.partition(":")
    return bool(separator and detail.strip())


def validate_closure_test_plan(description: str | None) -> None:
    """Impide cerrar si alguna categoría sigue pendiente o conserva placeholders."""
    validate_test_plan(description)
    section = extract_test_plan(description)
    unresolved = [
        label
        for label, pattern in TEST_PLAN_REQUIREMENTS.items()
        if not any(
            test_plan_line_is_resolved(line)
            for line in test_plan_category_lines(section, pattern)
        )
    ]
    if unresolved:
        sys.exit(
            "No se puede cerrar: faltan por resolver " + ", ".join(unresolved) + ".\n"
            "Marca cada caso completado con [x] o escribe 'No aplica: <motivo>'."
        )


def validate_closure_evidence(items: list[str] | None) -> list[str]:
    """Normaliza evidencias y rechaza afirmaciones vacías o plantillas."""
    if not items:
        sys.exit(
            "El cierre necesita al menos una --evidence concreta, por ejemplo: "
            "--evidence 'npm test: 24/24 tests verdes'."
        )
    normalized = []
    for raw in items:
        item = raw.strip()
        subject, separator, result = item.partition(":")
        if (
            not separator
            or not subject.strip()
            or not result.strip()
            or PLACEHOLDER.search(item)
        ):
            sys.exit(
                f"Evidencia no concreta: {raw!r}. Usa el formato 'comprobación: resultado'."
            )
        normalized.append(item)
    return normalized


def build_closure_comment(evidence: list[str]) -> str:
    bullets = "\n".join(f"- {item}" for item in evidence)
    return (
        "## Evidencia de cierre\n\n"
        f"Validado el {date.today().isoformat()}.\n\n"
        f"{bullets}\n\n"
        "El plan de pruebas está resuelto: cada categoría figura como completada "
        "o como no aplicable con motivo."
    )


# ---------- comandos lectura ----------

def cmd_list(args):
    if args.state:
        filt = {"state": {"name": {"eq": args.state}}}
    elif args.all:
        filt = {}
    else:
        filt = {"state": {"type": {"nin": ["completed", "canceled"]}}}
    gql = """
    query Issues($filter: IssueFilter, $first: Int) {
      issues(filter: $filter, first: $first, orderBy: updatedAt) {
        nodes {
          identifier title priorityLabel
          state { name type } assignee { name } updatedAt
        }
      }
    }
    """
    nodes = query(gql, {"filter": filt, "first": args.limit})["issues"]["nodes"]
    if not nodes:
        print("Sin issues.")
        return
    for n in nodes:
        assignee = n["assignee"]["name"] if n["assignee"] else "—"
        print(
            f"{n['identifier']:<10} [{n['state']['name']:<12}] "
            f"{n['priorityLabel']:<8} {assignee:<15} {n['title']}"
        )
    print(f"\n{len(nodes)} issue(s).")


def cmd_get(args):
    gql = """
    query Issue($id: String!) {
      issue(id: $id) {
        identifier title description priorityLabel
        state { name type } assignee { name }
        labels { nodes { name } }
        createdAt updatedAt url
      }
    }
    """
    n = query(gql, {"id": resolve_issue_uuid(args.id)})["issue"]
    labels = ", ".join(l["name"] for l in n["labels"]["nodes"]) or "—"
    print(f"# {n['identifier']}  {n['title']}")
    print(f"Estado:     {n['state']['name']} ({n['state']['type']})")
    print(f"Prioridad:  {n['priorityLabel']}")
    print(f"Asignado:   {n['assignee']['name'] if n['assignee'] else '—'}")
    print(f"Labels:     {labels}")
    print(f"URL:        {n['url']}")
    print("\n--- Descripción ---")
    print(n["description"] or "(vacía)")


def cmd_teams(_args):
    for t in query("{ teams { nodes { key name } } }")["teams"]["nodes"]:
        print(f"{t['key']:<8} {t['name']}")


def cmd_states(args):
    gql = """
    query($key:String!){
      workflowStates(filter:{team:{key:{eq:$key}}}, orderBy: updatedAt){
        nodes{ name type }
      }
    }
    """
    nodes = query(gql, {"key": args.team.upper()})["workflowStates"]["nodes"]
    for n in nodes:
        print(f"{n['name']:<16} ({n['type']})")


# ---------- comandos escritura ----------

def cmd_create(args):
    description = validate_test_plan(args.description)
    inp = {
        "teamId": resolve_team_id(args.team),
        "title": args.title,
        "description": description,
    }
    if args.priority:
        inp["priority"] = priority_int(args.priority)
    if args.state:
        inp["stateId"] = resolve_state_id(args.team, args.state)
    if args.parent:
        inp["parentId"] = resolve_issue_uuid(args.parent)
    gql = """
    mutation Create($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success issue { identifier url }
      }
    }
    """
    res = query(gql, {"input": inp})["issueCreate"]
    if not res["success"]:
        sys.exit("No se pudo crear el issue.")
    print(f"Creado {res['issue']['identifier']}  {res['issue']['url']}")


def cmd_update(args):
    if args.state and args.state.strip().lower() == "done":
        sys.exit(
            "El cierre está protegido. Usa: linear.py close GYM-N "
            "--evidence 'comprobación: resultado'."
        )
    uuid = resolve_issue_uuid(args.id)
    team_key = args.id.split("-")[0].upper()
    inp = {}
    if args.title:
        inp["title"] = args.title
    if args.description is not None:
        inp["description"] = args.description
    if args.priority:
        inp["priority"] = priority_int(args.priority)
    if args.state:
        inp["stateId"] = resolve_state_id(team_key, args.state)
    if args.parent:
        inp["parentId"] = resolve_issue_uuid(args.parent)
    if not inp:
        sys.exit("Nada que actualizar. Usa --title/--description/--state/--priority.")
    gql = """
    mutation Update($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success issue { identifier state { name } }
      }
    }
    """
    res = query(gql, {"id": uuid, "input": inp})["issueUpdate"]
    if not res["success"]:
        sys.exit("No se pudo actualizar el issue.")
    print(f"Actualizado {res['issue']['identifier']} -> estado {res['issue']['state']['name']}")


def cmd_close(args):
    """Valida el plan, comenta la evidencia y solo entonces mueve el issue a Done."""
    uuid = resolve_issue_uuid(args.id)
    team_key = args.id.split("-")[0].upper()
    gql_get = """
    query($id:String!) {
      issue(id:$id) { identifier description state { name type } }
    }
    """
    issue = query(gql_get, {"id": uuid})["issue"]
    if issue["state"]["type"] == "completed":
        sys.exit(f"{issue['identifier']} ya está completado.")
    if issue["state"]["type"] == "canceled":
        sys.exit(f"{issue['identifier']} está cancelado; reábrelo antes de cerrarlo.")

    validate_closure_test_plan(issue["description"])
    evidence = validate_closure_evidence(args.evidence)
    comment_body = build_closure_comment(evidence)

    if args.dry_run:
        print(f"{issue['identifier']}: cierre válido [dry-run]")
        print("\nComentario que se añadiría:\n")
        print(comment_body)
        return

    done_state_id = resolve_state_id(team_key, "Done")
    gql_comment = """
    mutation Comment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }
    """
    comment = query(
        gql_comment,
        {"input": {"issueId": uuid, "body": comment_body}},
    )["commentCreate"]
    if not comment["success"]:
        sys.exit("No se añadió la evidencia; el issue sigue abierto.")

    gql_update = """
    mutation Update($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success issue { identifier state { name } }
      }
    }
    """
    updated = query(
        gql_update,
        {"id": uuid, "input": {"stateId": done_state_id}},
    )["issueUpdate"]
    if not updated["success"]:
        sys.exit(
            "La evidencia quedó comentada, pero Linear no cambió el estado. "
            "Revisa el ticket antes de reintentar."
        )

    print(
        f"Cerrado {updated['issue']['identifier']} -> "
        f"{updated['issue']['state']['name']} con evidencia."
    )
    print(
        "Siguiente paso obligatorio: linear.py board --apply, "
        "npm run test:board y desplegar arquitectura-agente."
    )


def cmd_replace(args):
    """Sustitucion de texto en la descripcion de varios issues a la vez.

    `update --description` reemplaza la descripcion entera, asi que para tocar
    una linea concreta en muchos tickets hay que leer, sustituir y reescribir.
    """
    gql_get = "query($id:String!){ issue(id:$id){ description } }"
    gql_set = """
    mutation Update($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }
    """
    find = args.find.replace("\\n", "\n")
    repl = args.replace.replace("\\n", "\n")
    changed = 0
    for ident in args.ids:
        uuid = resolve_issue_uuid(ident)
        desc = query(gql_get, {"id": uuid})["issue"]["description"] or ""
        new = desc.replace(find, repl)
        if new == desc:
            print(f"{ident:<10} sin coincidencias")
            continue
        hits = desc.count(find)
        if args.dry_run:
            print(f"{ident:<10} {hits} coincidencia(s) [dry-run]")
        else:
            query(gql_set, {"id": uuid, "input": {"description": new}})
            print(f"{ident:<10} {hits} coincidencia(s) sustituida(s)")
        changed += 1
    print(f"\n{changed} issue(s) con cambios.")


BOARD_PATH = ("arquitectura-agente", "data", "board.json")


# El tablero espejo solo modela cinco columnas (backlog, todo, in_progress, done,
# canceled), pero el flujo GYM tiene seis estados. Los que no existen en el
# tablero se colapsan en la columna equivalente mas cercana; sin esta tabla,
# `board --apply` escribe un estado que board.json no define y el fallo no
# aparece hasta `npm run test:board`.
BOARD_STATE_ALIASES = {
    "in_review": "in_progress",
}


def board_state_id(linear_state_name: str) -> str:
    """'In Progress' -> 'in_progress'; 'In Review' -> 'in_progress' (ver BOARD_STATE_ALIASES)."""
    slug = linear_state_name.strip().lower().replace(" ", "_")
    return BOARD_STATE_ALIASES.get(slug, slug)


def _identifier_sort_key(identifier: str):
    match = re.match(r"^([A-Za-z]+)-(\d+)$", identifier)
    return (match.group(1), int(match.group(2))) if match else (identifier, 0)


def board_entries(board: dict) -> dict:
    """Indexa tickets y epicas y rechaza identificadores ambiguos."""
    entries = {}
    for group in board["groups"]:
        candidates = list(group["tickets"])
        if group.get("kind") == "epic":
            candidates.append(group)
        for item in candidates:
            identifier = item["id"]
            if identifier in entries:
                raise ValueError(f"El identificador {identifier} esta duplicado en el tablero.")
            entries[identifier] = item
    return entries


def build_board_report(board: dict, nodes: list, team: str = "GYM", checked_at: str | None = None) -> dict:
    """Construye un diff estable y serializable sin tocar el disco."""
    ignore = set(board["meta"].get("ignore", []))
    entries = board_entries(board)
    live = {node["identifier"]: node for node in nodes if node["identifier"] not in ignore}
    states, titles, missing_from_board, missing_from_linear = [], [], [], []

    for identifier, node in sorted(live.items(), key=lambda pair: _identifier_sort_key(pair[0])):
        item = entries.get(identifier)
        if item is None:
            missing_from_board.append({
                "id": identifier,
                "state": node["state"]["name"],
                "title": node["title"],
            })
            continue
        expected_state = board_state_id(node["state"]["name"])
        if item.get("state") != expected_state:
            states.append({"id": identifier, "from": item.get("state"), "to": expected_state})
        if item.get("title") != node["title"]:
            titles.append({"id": identifier, "from": item.get("title"), "to": node["title"]})

    for identifier in sorted(entries, key=_identifier_sort_key):
        if identifier not in live and identifier not in ignore:
            missing_from_linear.append({"id": identifier})

    safe_count = len(states) + len(titles)
    review_count = len(missing_from_board) + len(missing_from_linear)
    status = "review_required" if review_count else "safe_changes" if safe_count else "clean"
    return {
        "schemaVersion": 1,
        "checkedAt": checked_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "team": team.upper(),
        "status": status,
        "changes": {
            "states": states,
            "titles": titles,
            "missingFromBoard": missing_from_board,
            "missingFromLinear": missing_from_linear,
        },
        "safeChangeCount": safe_count,
        "reviewRequiredCount": review_count,
    }


def fetch_board_nodes(team: str) -> list:
    gql = """
    query($key:String!,$first:Int){
      issues(filter:{team:{key:{eq:$key}}}, first:$first){
        nodes{ identifier title state{ name } }
      }
    }
    """
    return query(gql, {"key": team.upper(), "first": 250})["issues"]["nodes"]


def print_board_report(report: dict):
    changes = report["changes"]
    for change in changes["states"]:
        print(f"{change['id']:<10} estado  {change['from']} -> {change['to']}")
    for change in changes["titles"]:
        print(f"{change['id']:<10} titulo  {change['from']!r}\n{'':<10}     -> {change['to']!r}")
    for change in changes["missingFromBoard"]:
        print(f"{change['id']:<10} FALTA en el tablero [{change['state']}] {change['title']}")
    for change in changes["missingFromLinear"]:
        print(f"{change['id']:<10} SOBRA: esta en el tablero pero no en Linear")


def _enclosing_object_start(raw: str, position: int) -> int:
    stack = []
    in_string = False
    escaped = False
    for index, char in enumerate(raw[:position + 1]):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            stack.append(index)
        elif char == "}" and stack:
            stack.pop()
    if not stack:
        raise ValueError("No se pudo localizar el objeto JSON que contiene el identificador.")
    return stack[-1]


def _object_field_span(raw: str, object_start: int, field: str):
    """Devuelve (valor, inicio, fin) de un campo directo de un objeto JSON."""
    decoder = json.JSONDecoder()
    parsed, object_end = decoder.raw_decode(raw, object_start)
    if not isinstance(parsed, dict):
        raise ValueError("El valor localizado no es un objeto JSON.")
    index = object_start + 1
    while index < object_end:
        while index < object_end and (raw[index].isspace() or raw[index] == ","):
            index += 1
        if index >= object_end or raw[index] == "}":
            break
        key, key_end = decoder.raw_decode(raw, index)
        if not isinstance(key, str):
            raise ValueError("Se encontro una clave JSON no textual.")
        index = key_end
        while index < object_end and raw[index].isspace():
            index += 1
        if index >= object_end or raw[index] != ":":
            raise ValueError(f"El campo {key!r} no tiene separador JSON.")
        index += 1
        while index < object_end and raw[index].isspace():
            index += 1
        value_start = index
        value, value_end = decoder.raw_decode(raw, value_start)
        if key == field:
            return value, value_start, value_end
        index = value_end
    raise ValueError(f"No se pudo localizar el campo {field!r} en su objeto JSON.")


def _entry_object_start(raw: str, identifier: str) -> int:
    encoded = re.escape(json.dumps(identifier, ensure_ascii=False))
    matches = list(re.finditer(r'"id"\s*:\s*' + encoded, raw))
    starts = {_enclosing_object_start(raw, match.start()) for match in matches}
    valid = []
    decoder = json.JSONDecoder()
    for start in starts:
        parsed, _end = decoder.raw_decode(raw, start)
        if isinstance(parsed, dict) and parsed.get("id") == identifier:
            valid.append(start)
    if len(valid) != 1:
        raise ValueError(
            f"Se esperaba exactamente una entrada para {identifier}; se encontraron {len(valid)}."
        )
    return valid[0]


def _replace_entry_string_field(raw: str, identifier: str, field: str, value: str) -> str:
    object_start = _entry_object_start(raw, identifier)
    old_value, value_start, value_end = _object_field_span(raw, object_start, field)
    if not isinstance(old_value, str):
        raise ValueError(f"El campo {field!r} de {identifier} no es texto.")
    encoded = json.dumps(value, ensure_ascii=False)
    return raw[:value_start] + encoded + raw[value_end:]


def _replace_meta_updated(raw: str, value: str) -> str:
    root_start = len(raw) - len(raw.lstrip())
    meta, meta_start, _meta_end = _object_field_span(raw, root_start, "meta")
    if not isinstance(meta, dict):
        raise ValueError("meta no es un objeto JSON.")
    old_value, updated_start, updated_end = _object_field_span(raw, meta_start, "updated")
    if not isinstance(old_value, str):
        raise ValueError("meta.updated no es texto.")
    return raw[:updated_start] + json.dumps(value) + raw[updated_end:]


def apply_board_report(raw: str, report: dict, include_titles: bool, updated_on: str | None = None) -> str:
    """Aplica el diff en memoria; cualquier incoherencia aborta antes de escribir."""
    if include_titles and report["status"] == "review_required":
        raise ValueError("Hay altas o bajas pendientes; --apply-safe no aplica cambios parciales.")

    changes = report["changes"]
    selected = [(change, "state") for change in changes["states"]]
    if include_titles:
        selected.extend((change, "title") for change in changes["titles"])
    if not selected:
        return raw

    updated = raw
    for change, field in selected:
        updated = _replace_entry_string_field(updated, change["id"], field, change["to"])
    updated = _replace_meta_updated(updated, updated_on or date.today().isoformat())

    check = json.loads(updated)
    entries = board_entries(check)
    for change, field in selected:
        actual = entries[change["id"]].get(field)
        if actual != change["to"]:
            raise ValueError(
                f"La sustitucion de {change['id']} no cuadra ({actual!r} != {change['to']!r})."
            )
    return updated


def atomic_write_text(path: Path, content: str):
    temporary_path = None
    original_mode = path.stat().st_mode
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, original_mode)
        os.replace(temporary_path, path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def cmd_board(args):
    """Compara el tablero con Linear y aplica solo cambios mecanicos autorizados."""
    path = repo_root().joinpath(*BOARD_PATH)
    if not path.exists():
        sys.exit(f"No existe el tablero en {path}")

    raw = path.read_text(encoding="utf-8")
    try:
        board = json.loads(raw)
        report = build_board_report(board, fetch_board_nodes(args.team), args.team)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        sys.exit(f"No se pudo comparar el tablero: {error}")

    output_format = getattr(args, "format", "human")
    apply_legacy = getattr(args, "apply", False)
    apply_safe = getattr(args, "apply_safe", False)
    if output_format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print_board_report(report)

    if report["status"] == "clean":
        if output_format == "human":
            print("El tablero coincide con Linear.")
        return

    if not apply_legacy and not apply_safe:
        if output_format == "json":
            return
        total = report["safeChangeCount"] + report["reviewRequiredCount"]
        print(
            f"\n{total} diferencia(s). Usa --apply-safe para estados y titulos "
            "cuando no haya altas ni bajas."
        )
        sys.exit(1)

    try:
        updated = apply_board_report(raw, report, include_titles=apply_safe)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        sys.exit(f"No se ha escrito nada: {error}")

    if updated != raw:
        atomic_write_text(path, updated)

    if output_format == "human":
        state_count = len(report["changes"]["states"])
        title_count = len(report["changes"]["titles"]) if apply_safe else 0
        print(
            f"\n{state_count} estado(s) y {title_count} titulo(s) sincronizado(s) "
            f"en {path.relative_to(repo_root())}."
        )
        pending = report["reviewRequiredCount"] + (0 if apply_safe else len(report["changes"]["titles"]))
        if pending:
            print(f"Quedan {pending} diferencia(s) que requieren edicion a mano.")
        print("La automatizacion desplegara el tablero cuando el cambio llegue a main.")


def cmd_comment(args):
    gql = """
    mutation Comment($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { id } }
    }
    """
    inp = {"issueId": resolve_issue_uuid(args.id), "body": args.body}
    res = query(gql, {"input": inp})["commentCreate"]
    if not res["success"]:
        sys.exit("No se pudo crear el comentario.")
    print(f"Comentario añadido a {args.id}")


def cmd_link(args):
    """Crea relaciones `blocks` desde cada bloqueante hacia el ticket objetivo."""
    gql = """
    mutation LinkIssues($input: IssueRelationCreateInput!) {
      issueRelationCreate(input: $input) {
        success
        issueRelation { id type }
      }
    }
    """
    target_uuid = resolve_issue_uuid(args.id)
    for blocker_id in args.blocked_by:
        blocker_uuid = resolve_issue_uuid(blocker_id)
        inp = {
            "issueId": blocker_uuid,
            "relatedIssueId": target_uuid,
            "type": "blocks",
        }
        res = query(gql, {"input": inp})["issueRelationCreate"]
        if not res["success"]:
            sys.exit(
                f"No se pudo marcar {args.id} como bloqueado por {blocker_id}."
            )
        print(f"{args.id} bloqueado por {blocker_id}")


def _issue_relations(issue_uuid):
    """Devuelve relaciones salientes y entrantes con ambos extremos resueltos."""
    gql = """
    query IssueRelations($id: String!) {
      issue(id: $id) {
        relations {
          nodes {
            id type
            issue { id identifier }
            relatedIssue { id identifier }
          }
        }
        inverseRelations {
          nodes {
            id type
            issue { id identifier }
            relatedIssue { id identifier }
          }
        }
      }
    }
    """
    issue = query(gql, {"id": issue_uuid})["issue"]
    return issue["relations"]["nodes"] + issue["inverseRelations"]["nodes"]


def cmd_unlink(args):
    """Quita relaciones `BLOCKER blocks TARGET`; sin --apply solo previsualiza."""
    target_uuid = resolve_issue_uuid(args.id)
    relations = _issue_relations(target_uuid)
    matches = []

    for blocker_id in args.blocked_by:
        blocker_uuid = resolve_issue_uuid(blocker_id)
        relation = next(
            (
                item
                for item in relations
                if item["type"] == "blocks"
                and item["issue"]["id"] == blocker_uuid
                and item["relatedIssue"]["id"] == target_uuid
            ),
            None,
        )
        if relation is None:
            sys.exit(f"No existe el bloqueo {blocker_id} -> {args.id}; no se ha borrado nada.")
        matches.append((blocker_id, relation["id"]))

    if not args.apply:
        for blocker_id, _relation_id in matches:
            print(f"[dry-run] quitaría el bloqueo {blocker_id} -> {args.id}")
        print("Repite con --apply para borrar las relaciones.")
        return

    gql = """
    mutation DeleteIssueRelation($id: String!) {
      issueRelationDelete(id: $id) { success }
    }
    """
    for blocker_id, relation_id in matches:
        res = query(gql, {"id": relation_id})["issueRelationDelete"]
        if not res["success"]:
            sys.exit(f"No se pudo quitar el bloqueo {blocker_id} -> {args.id}.")
        print(f"Bloqueo eliminado: {blocker_id} -> {args.id}")


def cmd_relate(args):
    """Crea relaciones simétricas `related` sin duplicarlas."""
    issue_uuid = resolve_issue_uuid(args.id)
    related_uuid = resolve_issue_uuid(args.with_id)
    if issue_uuid == related_uuid:
        sys.exit("Un issue no puede relacionarse consigo mismo.")

    for item in _issue_relations(issue_uuid):
        endpoints = {item["issue"]["id"], item["relatedIssue"]["id"]}
        if item["type"] == "related" and endpoints == {issue_uuid, related_uuid}:
            print(f"{args.id} ya está relacionado con {args.with_id}")
            return

    gql = """
    mutation RelateIssues($input: IssueRelationCreateInput!) {
      issueRelationCreate(input: $input) {
        success
        issueRelation { id type }
      }
    }
    """
    inp = {
        "issueId": issue_uuid,
        "relatedIssueId": related_uuid,
        "type": "related",
    }
    res = query(gql, {"input": inp})["issueRelationCreate"]
    if not res["success"]:
        sys.exit(f"No se pudo relacionar {args.id} con {args.with_id}.")
    print(f"Relacionados: {args.id} <-> {args.with_id}")


def main():
    p = argparse.ArgumentParser(description="Cliente Linear GraphQL (leer/crear/modificar)")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("list", help="listar issues")
    pl.add_argument("--all", action="store_true", help="incluir completados/cancelados")
    pl.add_argument("--state", help="filtrar por nombre de estado exacto")
    pl.add_argument("--limit", type=int, default=50)
    pl.set_defaults(func=cmd_list)

    pg = sub.add_parser("get", help="detalle de un issue")
    pg.add_argument("id", help="identifier, p.ej. GYM-12")
    pg.set_defaults(func=cmd_get)

    sub.add_parser("teams", help="listar equipos").set_defaults(func=cmd_teams)

    ps = sub.add_parser("states", help="estados del flujo de un equipo")
    ps.add_argument("team", help="team key, p.ej. GYM")
    ps.set_defaults(func=cmd_states)

    pc = sub.add_parser("create", help="crear issue")
    pc.add_argument("--team", required=True, help="team key, p.ej. GYM")
    pc.add_argument("--title", required=True)
    pc.add_argument(
        "--description",
        required=True,
        help="markdown con sección obligatoria '## Plan de pruebas'",
    )
    pc.add_argument("--state")
    pc.add_argument("--priority", help="none|urgent|high|medium|low")
    pc.add_argument("--parent", help="identifier del issue padre, p.ej. GYM-12")
    pc.set_defaults(func=cmd_create)

    pu = sub.add_parser("update", help="modificar issue")
    pu.add_argument("id", help="identifier, p.ej. GYM-12")
    pu.add_argument("--title")
    pu.add_argument("--description")
    pu.add_argument("--state")
    pu.add_argument("--priority", help="none|urgent|high|medium|low")
    pu.add_argument("--parent", help="identifier del issue padre, p.ej. GYM-12")
    pu.set_defaults(func=cmd_update)

    pcl = sub.add_parser(
        "close",
        help="validar plan y evidencia antes de mover un issue a Done",
    )
    pcl.add_argument("id", help="identifier, p.ej. GYM-12")
    pcl.add_argument(
        "--evidence",
        action="append",
        required=True,
        help="repetible; formato 'comprobación: resultado'",
    )
    pcl.add_argument(
        "--dry-run",
        action="store_true",
        help="validar y previsualizar el comentario sin modificar Linear",
    )
    pcl.set_defaults(func=cmd_close)

    pr = sub.add_parser("replace", help="sustituir texto en la descripcion de varios issues")
    pr.add_argument("ids", nargs="+", help="identifiers, p.ej. GYM-12 GYM-13")
    pr.add_argument("--find", required=True, help="texto exacto a buscar (\\n para salto de linea)")
    pr.add_argument("--replace", required=True, help="texto de reemplazo (\\n para salto de linea)")
    pr.add_argument("--dry-run", action="store_true", help="mostrar coincidencias sin escribir")
    pr.set_defaults(func=cmd_replace)

    pb = sub.add_parser("board", help="comparar/sincronizar el tablero espejo con Linear")
    pb.add_argument("--team", default="GYM", help="team key, por defecto GYM")
    pb.add_argument(
        "--format",
        choices=("human", "json"),
        default="human",
        help="salida humana (por defecto) o contrato JSON para automatizacion",
    )
    apply_group = pb.add_mutually_exclusive_group()
    apply_group.add_argument(
        "--apply",
        action="store_true",
        help="compatibilidad: escribir solo estados y meta.updated",
    )
    apply_group.add_argument(
        "--apply-safe",
        action="store_true",
        help="escribir estados y titulos solo si no hay altas ni bajas",
    )
    pb.set_defaults(func=cmd_board)

    pm = sub.add_parser("comment", help="comentar un issue")
    pm.add_argument("id", help="identifier, p.ej. GYM-12")
    pm.add_argument("--body", required=True)
    pm.set_defaults(func=cmd_comment)

    plink = sub.add_parser(
        "link",
        help="añadir dependencias: el issue queda bloqueado por otros issues",
    )
    plink.add_argument("id", help="issue bloqueado, p.ej. GYM-12")
    plink.add_argument(
        "--blocked-by",
        action="append",
        required=True,
        help="identifier bloqueante; se puede repetir",
    )
    plink.set_defaults(func=cmd_link)

    punlink = sub.add_parser(
        "unlink",
        help="quitar dependencias; previsualiza salvo que se pase --apply",
    )
    punlink.add_argument("id", help="issue bloqueado, p.ej. GYM-12")
    punlink.add_argument(
        "--blocked-by",
        action="append",
        required=True,
        help="identifier bloqueante; se puede repetir",
    )
    punlink.add_argument(
        "--apply",
        action="store_true",
        help="borrar realmente las relaciones encontradas",
    )
    punlink.set_defaults(func=cmd_unlink)

    prelate = sub.add_parser("relate", help="relacionar dos issues sin crear un bloqueo")
    prelate.add_argument("id", help="primer issue, p.ej. GYM-12")
    prelate.add_argument("--with", dest="with_id", required=True, help="segundo issue")
    prelate.set_defaults(func=cmd_relate)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
