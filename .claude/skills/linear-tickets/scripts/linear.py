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
  uv run linear.py comment GYM-12 --body "Comentario"

Prioridades: none | urgent | high | medium | low
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

API_URL = "https://api.linear.app/graphql"

PRIORITY_MAP = {"none": 0, "urgent": 1, "high": 2, "medium": 3, "low": 4}


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
    inp = {"teamId": resolve_team_id(args.team), "title": args.title}
    if args.description:
        inp["description"] = args.description
    if args.priority:
        inp["priority"] = priority_int(args.priority)
    if args.state:
        inp["stateId"] = resolve_state_id(args.team, args.state)
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
    pc.add_argument("--description")
    pc.add_argument("--state")
    pc.add_argument("--priority", help="none|urgent|high|medium|low")
    pc.set_defaults(func=cmd_create)

    pu = sub.add_parser("update", help="modificar issue")
    pu.add_argument("id", help="identifier, p.ej. GYM-12")
    pu.add_argument("--title")
    pu.add_argument("--description")
    pu.add_argument("--state")
    pu.add_argument("--priority", help="none|urgent|high|medium|low")
    pu.set_defaults(func=cmd_update)

    pm = sub.add_parser("comment", help="comentar un issue")
    pm.add_argument("id", help="identifier, p.ej. GYM-12")
    pm.add_argument("--body", required=True)
    pm.set_defaults(func=cmd_comment)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
