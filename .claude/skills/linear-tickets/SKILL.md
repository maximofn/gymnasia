---
name: linear-tickets
description: Leer, crear y modificar tickets (issues) en Linear del proyecto Gymnasia. Usa esta skill cuando el usuario quiera ver, listar, consultar, crear, actualizar, cerrar, mover de estado, comentar o gestionar tickets/issues de Linear, o cuando mencione "linear", "ticket", "issue", "GYM-", "backlog", "crear ticket", "mover a in progress", "cerrar issue" o "estado del ticket".
---

# Linear Tickets (Gymnasia)

Gestiona los issues de Linear (equipo **GYM / Gymnasia**) vía la API GraphQL,
usando un script que lee `LINEAR_API_KEY` del `.env` de la raíz del repo.

## Regla del espejo (obligatoria)

**Cada vez que modifiques algo en Linear, actualiza el tablero espejo antes de
terminar.** El tablero (`arquitectura-agente/`, publicado en
<https://gymnasia-sable.vercel.app/>) es una página estática que no llama a la API:
si no se actualiza a mano, se desincroniza en silencio y deja de servir para nada.

Aplica a: cambios de estado, altas, bajas, cambios de título, de dependencias y de
jerarquía. No aplica a comentarios (el tablero no los muestra).

El ciclo completo, desde la raíz del repo:

```bash
# 1. Tras tocar Linear, ver qué ha quedado desincronizado
python3 .claude/skills/linear-tickets/scripts/linear.py board

# 2. Sincronizar los estados (lo demás se edita a mano, ver abajo)
python3 .claude/skills/linear-tickets/scripts/linear.py board --apply

# 3. Validar y desplegar
npm run test:board
npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente
```

`board` sale con código 1 si hay diferencias, así que sirve tal cual como
comprobación. **`--apply` solo escribe los estados y `meta.updated`**; lo demás lo
reporta pero no lo toca, porque requiere criterio:

- **Ticket nuevo** (`FALTA en el tablero`): añadirlo a mano al array `tickets` del
  grupo que le corresponda, con `summary`, `dependsOn` y `related`. El resumen es
  una línea escrita para quien no tiene contexto, no un copia-pega de la descripción.
- **Título cambiado**: copiarlo tal cual de Linear. El tablero debe leerse igual
  que Linear o deja de ser un espejo.
- **`SOBRA`**: el ticket se borró en Linear. Quitarlo del tablero, y revisar que
  nadie lo referencie en `dependsOn`/`related` (el test lo caza).
- Un push a `main` **no despliega** el tablero: hay que lanzar la CLI de Vercel a
  mano. Ver `arquitectura-agente/README.md`.

El ruido de onboarding de Linear (GYM-1 a GYM-4) está en `meta.ignore` de
`board.json` para que no se reporte en cada ejecución.

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

### Tablero espejo
```bash
python3 .claude/skills/linear-tickets/scripts/linear.py board            # informa de la deriva (exit 1 si hay)
python3 .claude/skills/linear-tickets/scripts/linear.py board --apply    # sincroniza estados + meta.updated
```
Ver "Regla del espejo" arriba: es obligatorio tras cualquier modificación en Linear.

### Creación

La descripción es obligatoria y debe incluir `## Plan de pruebas`. Para cada
categoría hay que escribir casos concretos o `No aplica: <motivo>`; no basta con
omitir lo que parezca innecesario. El script rechaza el alta si falta la sección
o alguna categoría:

```markdown
## Plan de pruebas
- [ ] Unitarios: <casos concretos o No aplica: motivo>
- [ ] E2E: <casos concretos o No aplica: motivo>
- [ ] Integración con proveedor falso: <casos concretos o No aplica: motivo>
- [ ] Contrato: <casos concretos o No aplica: motivo>
- [ ] Regresión: <casos concretos o No aplica: motivo>
- [ ] Fuzzing / property-based: <casos concretos o No aplica: motivo>
```

```bash
python3 .claude/skills/linear-tickets/scripts/linear.py create \
  --team GYM --title "Título del ticket" \
  --description "Descripción en markdown con ## Plan de pruebas" \
  --state "Todo" --priority high

# Sub-issue: colgar de un issue padre (Linear no tiene "épicas";
# lo más parecido es un issue padre con sub-issues)
python3 .claude/skills/linear-tickets/scripts/linear.py create \
  --team GYM --title "Sub-tarea" --parent GYM-25 \
  --description "Descripción y ## Plan de pruebas completos"
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

Cinco cosas que cuestan tiempo si no se saben:

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

5. **Linear puede normalizar `[x]` a `[X]` al reescribir una descripción.** El
   síntoma es que `replace --dry-run` devuelve `sin coincidencias` aunque el
   checkbox aparezca marcado en la interfaz. Relee el ticket con `get` y usa la
   capitalización que devuelva la API antes de repetir la sustitución.

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

0. **Antes de crear nada, lista lo que ya existe.** Es el error más fácil y más
   caro de esta skill: crear tickets que duplican otros de hace meses.
   ```bash
   python3 <ruta>/linear.py list --all --limit 80
   ```
   Busca por el tema, no solo por el título exacto: un ticket llamado "Crear
   suite de tests" y otro "Infraestructura de tests para el agente" son el mismo
   trabajo. Si encuentras solape, decide **antes de escribir** si amplías el
   existente, lo cancelas como duplicado, o cuelgas el nuevo del viejo.
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
6. **Incluye y verifica el plan de pruebas obligatorio.** Evalúa unitarios,
   E2E, integración con proveedor falso, contrato, regresión y fuzzing /
   property-based. Si algo no procede, escribe `No aplica: <motivo>`. Tras el
   alta, usa `get GYM-N` para confirmar que Linear conservó la sección.
7. **Antes de dar el trabajo por terminado, sincroniza el espejo.** `board`,
   luego `board --apply`, luego desplegar. Ver "Regla del espejo". Es el paso
   que más fácil se olvida porque Linear ya se ve correcto: el que se queda
   desactualizado es el tablero, y nadie se entera hasta semanas después.
