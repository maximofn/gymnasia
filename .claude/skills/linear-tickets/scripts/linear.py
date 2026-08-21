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
import re
import sys
import urllib.request
from datetime import date
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
    env_path = repo_root() / ".env"
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


def cmd_board(args):
    """Compara el tablero espejo con Linear y, con --apply, sincroniza los estados.

    El tablero (arquitectura-agente/) es una pagina estatica que no llama a la API:
    los datos se generan aqui y se despliegan como JSON. Este comando solo toca los
    estados y meta.updated; resumenes, dependencias y relaciones se escriben a mano
    porque requieren criterio, asi que los tickets nuevos se reportan pero no se
    inventan.
    """
    path = repo_root().joinpath(*BOARD_PATH)
    if not path.exists():
        sys.exit(f"No existe el tablero en {path}")

    raw = path.read_text()
    board = json.loads(raw)
    ignore = set(board["meta"].get("ignore", []))

    entries = {
        t["id"]: (t, group)
        for group in board["groups"]
        for t in group["tickets"]
    }
    for group in board["groups"]:
        if group.get("kind") == "epic":
            entries.setdefault(group["id"], (group, None))

    gql = """
    query($key:String!,$first:Int){
      issues(filter:{team:{key:{eq:$key}}}, first:$first){
        nodes{ identifier title state{ name } }
      }
    }
    """
    nodes = query(gql, {"key": args.team.upper(), "first": 250})["issues"]["nodes"]
    live = {n["identifier"]: n for n in nodes if n["identifier"] not in ignore}

    drift_state, faltan, sobran, drift_title = [], [], [], []

    for ident, node in sorted(live.items(), key=lambda kv: int(kv[0].split("-")[1])):
        entry = entries.get(ident)
        if entry is None:
            faltan.append((ident, node["state"]["name"], node["title"]))
            continue
        item, _group = entry
        expected = board_state_id(node["state"]["name"])
        if item.get("state") != expected:
            drift_state.append((ident, item.get("state"), expected))
        if item.get("title") != node["title"]:
            drift_title.append((ident, item.get("title"), node["title"]))

    for ident in entries:
        if ident not in live and ident not in ignore:
            sobran.append(ident)

    for ident, old, new in drift_state:
        print(f"{ident:<10} estado  {old} -> {new}")
    for ident, old, new in drift_title:
        print(f"{ident:<10} titulo  {old!r}\n{'':<10}     -> {new!r}")
    for ident, state, title in faltan:
        print(f"{ident:<10} FALTA en el tablero [{state}] {title}")
    for ident in sorted(sobran, key=lambda i: int(i.split("-")[1])):
        print(f"{ident:<10} SOBRA: esta en el tablero pero no en Linear")

    total = len(drift_state) + len(drift_title) + len(faltan) + len(sobran)
    if not total:
        print("El tablero coincide con Linear.")
        return

    if not args.apply:
        print(f"\n{total} diferencia(s). Repite con --apply para sincronizar los estados.")
        sys.exit(1)

    # Escritura quirurgica: el JSON tiene objetos compactos escritos a mano y un
    # json.dump completo los reformatearia entero. Se sustituye solo el valor de
    # "state" que sigue al id, que es unico y no cruza el objeto (no hay llaves
    # anidadas dentro de un ticket).
    nuevo = raw
    for ident, _old, new in drift_state:
        pattern = re.compile(
            r'("id":\s*"' + re.escape(ident) + r'"[^}]*?"state":\s*")[a-z_]+(")'
        )
        nuevo, hits = pattern.subn(r"\g<1>" + new + r"\g<2>", nuevo, count=1)
        if not hits:
            sys.exit(f"No se pudo localizar el estado de {ident} en el JSON; revisalo a mano.")

    if drift_state:
        nuevo = re.sub(r'("updated":\s*")\d{4}-\d{2}-\d{2}(")',
                       r"\g<1>" + date.today().isoformat() + r"\g<2>", nuevo, count=1)

    # Releer lo escrito antes de tocar el disco: una sustitucion mal hecha rompe
    # el tablero entero y el fallo no se veria hasta desplegar.
    check = json.loads(nuevo)
    aplicados = {
        t["id"]: t.get("state")
        for group in check["groups"]
        for t in group["tickets"]
    }
    for ident, _old, new in drift_state:
        got = aplicados.get(ident, next(
            (g.get("state") for g in check["groups"] if g["id"] == ident), None
        ))
        if got != new:
            sys.exit(f"La sustitucion de {ident} no cuadra ({got!r} != {new!r}); no se ha escrito nada.")

    path.write_text(nuevo)
    print(f"\n{len(drift_state)} estado(s) sincronizado(s) en {path.relative_to(repo_root())}.")
    pendiente = len(drift_title) + len(faltan) + len(sobran)
    if pendiente:
        print(f"Quedan {pendiente} diferencia(s) que requieren edicion a mano (titulos, altas y bajas).")
    print("Recuerda desplegar: npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente")


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
    pb.add_argument("--apply", action="store_true",
                    help="escribir los estados en board.json (sin esto, solo informa)")
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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
