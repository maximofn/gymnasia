---
name: linear-tickets
description: Leer, crear y modificar tickets (issues) en Linear del proyecto Gymnasia. Usa esta skill cuando el usuario quiera ver, listar, consultar, crear, actualizar, cerrar, mover de estado, comentar o gestionar tickets/issues de Linear, o cuando mencione "linear", "ticket", "issue", "GYM-", "backlog", "crear ticket", "mover a in progress", "cerrar issue" o "estado del ticket".
---

# Linear Tickets (Gymnasia)

Gestiona los issues de Linear (equipo **GYM / Gymnasia**) vía la API GraphQL,
usando un script que lee `LINEAR_API_KEY` del `.env` de la raíz del repo.

## Regla de seguridad (importante)

- La key vive en el `.env` de la raíz (git-ignored). **Nunca** la imprimas
  (`echo`, `cat .env`, etc.) ni la pegues en el chat.
- El script `scripts/linear.py` la lee internamente; opera Linear siempre a
  través del script para que la key no pase por el contexto.

## Requisitos

- `LINEAR_API_KEY=lin_api_...` presente en el `.env` de la raíz del repo.
  Verificar sin exponerla:
  ```bash
  grep -q '^LINEAR_API_KEY=' .env && echo ok || echo falta
  ```
- Python 3 (stdlib únicamente; sin dependencias externas).

## Uso

Ejecutar desde la raíz del repo. `SK=.claude/skills/linear-tickets/scripts/linear.py`

### Lectura
```bash
python3 .claude/skills/linear-tickets/scripts/linear.py list                    # issues abiertos
python3 .claude/skills/linear-tickets/scripts/linear.py list --all              # incluye done/canceled
python3 .claude/skills/linear-tickets/scripts/linear.py list --state "In Progress"
python3 .claude/skills/linear-tickets/scripts/linear.py get GYM-12              # detalle
python3 .claude/skills/linear-tickets/scripts/linear.py teams                   # equipos
python3 .claude/skills/linear-tickets/scripts/linear.py states GYM             # estados del flujo
```

### Creación
```bash
python3 .claude/skills/linear-tickets/scripts/linear.py create \
  --team GYM --title "Título del ticket" \
  --description "Descripción en markdown" \
  --state "Todo" --priority high
```

### Modificación
```bash
# Mover de estado
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --state "In Progress"
# Cambiar prioridad / título / descripción
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --priority urgent
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --title "Nuevo título"
# Comentar
python3 .claude/skills/linear-tickets/scripts/linear.py comment GYM-12 --body "Comentario"
```

## Notas

- **Prioridades**: `none | urgent | high | medium | low`.
- **Estados**: se resuelven por nombre exacto (case-insensitive). Si dudas de
  los nombres disponibles, lista primero con `states GYM`.
- El identifier (`GYM-12`) se traduce internamente al UUID que exige la API.
- Los estados por defecto de un equipo Linear suelen ser: `Backlog`, `Todo`,
  `In Progress`, `In Review`, `Done`, `Canceled` (verifícalos con `states`).
- Para cerrar un ticket, muévelo al estado `Done` (o `Canceled`) con `update`.

## Flujo recomendado para el agente

1. Antes de escribir, confirma el equipo/estado con `teams` / `states GYM`.
2. Tras crear o actualizar, el script imprime el identifier y (en update) el
   estado resultante — úsalo para confirmar al usuario.
