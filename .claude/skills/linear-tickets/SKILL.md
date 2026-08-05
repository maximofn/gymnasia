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

# Sub-issue: colgar de un issue padre (Linear no tiene "épicas";
# lo más parecido es un issue padre con sub-issues)
python3 .claude/skills/linear-tickets/scripts/linear.py create \
  --team GYM --title "Sub-tarea" --parent GYM-25
```

### Modificación
```bash
# Mover de estado
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --state "In Progress"
# Cambiar prioridad / título / descripción
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --priority urgent
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --title "Nuevo título"
# Reasignar el padre de un issue existente
python3 .claude/skills/linear-tickets/scripts/linear.py update GYM-12 --parent GYM-25
# Comentar
python3 .claude/skills/linear-tickets/scripts/linear.py comment GYM-12 --body "Comentario"
```

### Edición masiva

`update --description` **reemplaza la descripción entera**. Para cambiar una
línea concreta en muchos tickets, usa `replace`, que lee, sustituye y reescribe:

```bash
# Siempre en dos pasos: primero --dry-run para ver cuántas coincidencias hay
python3 .claude/skills/linear-tickets/scripts/linear.py replace GYM-25 GYM-26 GYM-27 \
  --find "texto viejo" --replace "texto nuevo" --dry-run

# Y luego sin --dry-run
python3 .claude/skills/linear-tickets/scripts/linear.py replace GYM-25 GYM-26 GYM-27 \
  --find "texto viejo" --replace "texto nuevo"
```

Si la transformación es más compleja que un `find/replace` (regex, grupos de
captura), importa el módulo en vez de reescribir descripciones a mano:

```python
import sys
sys.path.insert(0, ".claude/skills/linear-tickets/scripts")
import linear

uuid = linear.resolve_issue_uuid("GYM-25")
desc = linear.query("query($id:String!){ issue(id:$id){ description } }",
                    {"id": uuid})["issue"]["description"]
# ... transformar desc ...
linear.query("mutation U($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }",
             {"id": uuid, "input": {"description": nuevo}})
```

## Trampas conocidas

Cuatro cosas que cuestan tiempo si no se saben:

1. **zsh no hace word-splitting de variables.** Guardar flags en una variable y
   expandirla **no funciona**: `P="--team GYM --state Backlog"; linear.py create $P ...`
   falla con `the following arguments are required: --team`. Escribe los flags
   en línea en cada invocación.

2. **Linear normaliza los bullets `-` a `*` al guardar.** Si escribes
   `- Un punto` en la descripción, al releerla vendrá como `* Un punto`. Las
   sustituciones de texto sobre descripciones ya guardadas deben usar `*`.
   Los checkboxes `- [ ]` **sí** se conservan tal cual.

3. **Usa siempre la ruta absoluta del script.** El directorio de trabajo persiste
   entre invocaciones de shell y puede haber quedado en otro sitio; con ruta
   relativa el comando falla en silencio o se ejecuta contra el fichero
   equivocado.

4. **Verifica después de una edición masiva.** Un `replace` que no encaja no
   da error, simplemente no cambia nada. Comprueba con:
   ```bash
   for i in 25 26 27; do python3 <ruta>/linear.py get GYM-$i; done | grep -ic "texto viejo"
   ```

## Notas

- **Prioridades**: `none | urgent | high | medium | low`.
- **Linear no tiene "épicas"**. Para agrupar trabajo hay dos opciones: un issue
  padre con sub-issues (`--parent`), que se ve anidado en la UI y es lo que se
  usa aquí, o un *Project* de Linear (con progreso, fechas y roadmap propios),
  que el script no gestiona.
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
3. **Al crear varios tickets**, agrupa varias invocaciones en una sola llamada
   de shell en vez de una por ticket. Crea antes el padre, anota su identifier
   y úsalo en el `--parent` de los hijos.
4. **Al crear una jerarquía**, ten en cuenta que los identifiers se asignan de
   forma correlativa según se crean. Si un ticket referencia a otro que aún no
   existe, o planifica los números antes o corrige la referencia después: es
   fácil dejar enlaces cruzados apuntando al ticket equivocado.
5. **Escribe las descripciones para una sesión en frío.** Quien retome el
   ticket no tendrá el contexto de la conversación: incluye rutas de fichero
   con línea (`App.tsx:4688`), comandos exactos, estado verificado con fecha,
   y las decisiones que quedan pendientes.
