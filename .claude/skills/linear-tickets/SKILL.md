---
name: linear-tickets
description: Leer, crear y modificar tickets (issues) en Linear del proyecto Gymnasia. Usa esta skill cuando el usuario quiera ver, listar, consultar, crear, actualizar, cerrar, mover de estado, comentar o gestionar tickets/issues de Linear, o cuando mencione "linear", "ticket", "issue", "GYM-", "backlog", "crear ticket", "mover a in progress", "cerrar issue" o "estado del ticket".
---

# Linear Tickets (Gymnasia)

Gestiona los issues de Linear (equipo **GYM / Gymnasia**) vía la API GraphQL,
usando un script que lee `LINEAR_API_KEY` del entorno o del `.env` de la raíz
del repo.

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
- En un worktree sin `.env`, apunta al fichero privado del checkout principal
  sin copiarlo: `LINEAR_ENV_FILE=/ruta/checkout/.env python3 <ruta>/linear.py ...`.
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
# Añadir dependencias (repite --blocked-by para varios bloqueantes)
python3 .claude/skills/linear-tickets/scripts/linear.py link GYM-12 \
  --blocked-by GYM-10 --blocked-by GYM-11
# Quitar dependencias: primero previsualizar y después aplicar
python3 .claude/skills/linear-tickets/scripts/linear.py unlink GYM-12 \
  --blocked-by GYM-10
python3 .claude/skills/linear-tickets/scripts/linear.py unlink GYM-12 \
  --blocked-by GYM-10 --apply
# Relación informativa, sin bloqueo
python3 .claude/skills/linear-tickets/scripts/linear.py relate GYM-12 --with GYM-13
# Comentar
python3 .claude/skills/linear-tickets/scripts/linear.py comment GYM-12 --body "Comentario"
```

### Cierre protegido

No cierres tickets con `update --state Done`: el script bloquea esa vía para que
el plan de pruebas no se pueda saltar por accidente. Usa `close`, primero en
modo de previsualización:

```bash
python3 .claude/skills/linear-tickets/scripts/linear.py close GYM-12 \
  --evidence "npm test: 24/24 tests verdes" \
  --evidence "npm --workspace apps/mobile exec tsc --noEmit: correcto" \
  --dry-run

# Si la previsualización es correcta, repetir sin --dry-run
python3 .claude/skills/linear-tickets/scripts/linear.py close GYM-12 \
  --evidence "npm test: 24/24 tests verdes" \
  --evidence "QA manual: Pixel 8, flujo feliz y recuperación de error correctos"
```

`close` comprueba antes de escribir:

- que están las seis categorías obligatorias;
- que cada una tiene `[x]`/`[X]` y detalle, o `No aplica: <motivo>` real;
- que cada `--evidence` usa `comprobación: resultado`, sin placeholders;
- que el ticket no está ya completado ni cancelado.

Si todo cuadra, añade primero un comentario `## Evidencia de cierre` y solo
después mueve el ticket a `Done`. El comando **no ejecuta texto copiado desde
Linear**: las pruebas y el QA se realizan explícitamente antes y sus resultados
se pasan como evidencias. Tras cerrar sigue siendo obligatorio sincronizar,
validar y desplegar el tablero espejo.

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

Catorce cosas que cuestan tiempo si no se saben:

1. **zsh no hace word-splitting de variables.** Guardar flags en una variable y
   expandirla **no funciona**: `P="--team GYM --state Backlog"; linear.py create $P ...`
   falla con `the following arguments are required: --team`. Escribe los flags
   en línea en cada invocación.

2. **Linear normaliza los bullets `-` a `*` al guardar.** Si escribes
   `- Un punto` en la descripción, al releerla vendrá como `* Un punto`. Las
   sustituciones de texto sobre descripciones ya guardadas deben usar `*`.
   Los checkboxes `- [ ]` **sí** se conservan tal cual.

3. **Usa la ruta absoluta del script que pertenece al checkout objetivo.** El
   directorio de trabajo persiste entre invocaciones de shell y puede haber
   quedado en otro sitio; con ruta relativa el comando falla en silencio o se
   ejecuta contra el fichero equivocado. Además, `linear.py` calcula la raíz del
   repositorio desde su propio `__file__`, no desde el `cwd`: en un worktree,
   invocar el script del checkout principal hace que `board --apply` modifique
   el `board.json` principal aunque el shell esté situado en el worktree. Para
   sincronizar el espejo usa la ruta absoluta al `linear.py` del worktree donde
   vas a commitear.

4. **Verifica después de una edición masiva.** Un `replace` que no encaja no
   da error, simplemente no cambia nada. Comprueba con:
   ```bash
   for i in 25 26 27; do python3 <ruta>/linear.py get GYM-$i; done | grep -ic "texto viejo"
   ```

5. **Linear puede normalizar `[x]` a `[X]` al reescribir una descripción.** El
   síntoma es que `replace --dry-run` devuelve `sin coincidencias` aunque el
   checkbox aparezca marcado en la interfaz. Relee el ticket con `get` y usa la
   capitalización que devuelva la API antes de repetir la sustitución.

6. **Los backticks Markdown ejecutan command substitution si los pasas entre
   comillas dobles en zsh.** El síntoma es `command not found: main` o
   `command not found: debug`, seguido de `sin coincidencias`, al usar `replace`
   sobre texto como `` `main` ``. La shell altera el argumento antes de que lo
   reciba `linear.py`, incluso en `--dry-run`. Pasa `--find` y `--replace` entre
   comillas simples —escapando cualquier apóstrofo de forma segura— o léelos
   desde una fuente que no vuelva a interpretar el contenido. Ejemplo seguro:
   ```bash
   python3 <ruta>/linear.py replace GYM-25 \
     --find 'proteger `main`' --replace 'proteger `main` y los workflows' --dry-run
   ```

7. **Linear limita `issues(first: ...)` a 250 resultados.** El síntoma al usar
   `list --limit 251` (o un valor mayor) es `Argument Validation Error` con
   `first must not be greater than 250`. Usa como máximo `--limit 250`; si el
   equipo supera esa cifra, el script necesitará paginación antes de poder
   auditar el inventario completo en una sola consulta.

8. **Un worktree no hereda el vínculo ignorado de Vercel.** El síntoma al
   desplegar el tablero es `Searching for existing projects` seguido de
   `Created .../arquitectura-agente`; el deploy termina en un alias nuevo en vez
   de `gymnasia-sable.vercel.app`. Antes de desplegar desde un worktree, enlaza
   el directorio explícitamente y verifica el destino:
   ```bash
   npm exec --yes -- vercel@latest link --yes --project gymnasia --cwd arquitectura-agente
   npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente
   ```
   La segunda salida debe empezar por `Deploying gymnasia` y terminar aliando
   `https://gymnasia-sable.vercel.app`; si muestra `Created`, detén el flujo.

9. **`close` no añade evidencia a un ticket que ya está completado.** El síntoma
   es `GYM-N ya está completado.` incluso con `--evidence`: el comando termina
   antes de validar o publicar esas evidencias. Si el ticket llegó a `Done` por
   otro flujo, completa primero su checklist y añade un comentario explícito
   `## Evidencia de cierre` con `linear.py comment`; después sincroniza y
   despliega el tablero igualmente.

10. **El tablero tiene cinco columnas y el flujo GYM seis estados.** `board.json`
    solo define `backlog`, `todo`, `in_progress`, `done` y `canceled`, pero Linear
    tiene además `In Review`. El síntoma es que `board --apply` dice
    `1 estado(s) sincronizado(s)` sin ningún error y luego `npm run test:board`
    falla con `GYM-N tiene estado inválido: in_review`. Es decir: el comando que
    debía dejar el tablero correcto es el que lo rompe, y no te enteras hasta el
    test. `board_state_id()` colapsa ahora esos estados con `BOARD_STATE_ALIASES`
    (`in_review` → `in_progress`). Si algún día se añade un estado nuevo al flujo
    de Linear, hay que añadirlo a esa tabla o darle columna propia en el tablero
    (`data/board.json`, más `--state-<id>` y las reglas `.state-<id>` de
    `styles.css`). **Pasa siempre `npm run test:board` después de `--apply`**: es
    la única red que detecta esto.

11. **Linear cambia estados solo, y no basta con evitar el identificador en el
    nombre de la rama.** La integración con GitHub asocia el issue por el
    identificador `GYM-N` aparezca donde aparezca: rama, **título de la PR** o
    cuerpo de la PR. Verificado el 22 de agosto de 2026: con la rama
    `feat/feedback-issues-worker`, sin ningún `GYM-`, abrir una PR titulada
    `feat(feedback): ... (GYM-54)` movió GYM-54 de `Todo` a `In Progress` y se
    lo asignó al autor, sin que nadie tocara Linear.

    Dos consecuencias:

    - **Al abrir la PR**: el issue salta a `In Progress`. Es inofensivo, pero
      aparece como deriva la siguiente vez que ejecutes `board`, y es fácil
      creer que lo movió otra persona.
    - **Al fusionar**: el issue puede pasar a `Done` sin checklist ni evidencia,
      aunque la PR solo lo mencione. Ese es el caso grave.

    Para trabajo que se cerrará a mano con `linear.py close`, mantén el
    identificador **fuera de la rama y también del título de la PR** —
    menciónalo solo en el cuerpo, en prosa— o cuenta con revisar el estado
    después de fusionar. Y comprueba siempre el estado real con `get GYM-N`
    antes de dar por bueno lo que crees que hiciste tú.

12. **Los worktrees no heredan el `.env` ignorado del checkout principal.** El
    síntoma al usar el `linear.py` correcto del worktree es `No existe
    <worktree>/.env`. El script acepta ahora `LINEAR_API_KEY` ya cargada en el
    entorno; carga el secreto desde una fuente segura antes de invocarlo y nunca
    lo imprimas. Así `board --apply` modifica el checkout que se va a commitear
    sin copiar el fichero de secretos.

13. **`issueRelationDelete` borra por UUID de relación, no por UUID de issue.**
    El síntoma al intentar quitar un bloqueo con cualquiera de los identifiers
    de los tickets es un error GraphQL o que no desaparece la relación esperada.
    Usa `unlink TARGET --blocked-by BLOCKER` primero sin flags para comprobar la
    dirección y repítelo con `--apply`; el comando localiza el UUID exacto y no
    borra nada si alguno de los bloqueos solicitados no existe.

14. **Extraer `LINEAR_API_KEY` con `sed` puede conservar las comillas del
    `.env`.** El síntoma es un `HTTP 401 Authentication required` aunque la key
    correcta exista: el valor enviado es literalmente `"lin_api_..."`. En un
    worktree usa `LINEAR_ENV_FILE=/ruta/checkout/.env`; `linear.py` elimina las
    comillas de forma segura sin copiar el secreto al worktree ni imprimirlo.

## Notas

- **Prioridades**: `none | urgent | high | medium | low`.
- **Linear no tiene "épicas"**. Para agrupar trabajo hay dos opciones: un issue
  padre con sub-issues (`--parent`), que se ve anidado en la UI y es lo que se
  usa aquí, o un *Project* de Linear (con progreso, fechas y roadmap propios),
  que el script no gestiona.
- **Estados**: se resuelven por nombre exacto (case-insensitive). Si dudas de
  los nombres disponibles, lista primero con `states GYM`.
- El identifier (`GYM-12`) se traduce internamente al UUID que exige la API.
- En `link TARGET --blocked-by BLOCKER`, la relación GraphQL se crea en la
  dirección `BLOCKER blocks TARGET`; invertir ambos UUID hace que Linear muestre
  la dependencia al revés.
- `unlink TARGET --blocked-by BLOCKER` usa la misma dirección, previsualiza por
  defecto y solo borra con `--apply`. `relate ISSUE --with OTHER` es simétrico e
  idempotente.
- Los estados por defecto de un equipo Linear suelen ser: `Backlog`, `Todo`,
  `In Progress`, `In Review`, `Done`, `Canceled` (verifícalos con `states`).
- Para completar un ticket usa `close`; `update --state Done` está bloqueado.
  Una cancelación sí se hace con `update --state Canceled`, porque no representa
  trabajo validado ni necesita superar el plan de pruebas.

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
7. **Cierra con evidencia, nunca con `update --state Done`.** Ejecuta primero
   `close GYM-N ... --dry-run`; si valida, repite sin `--dry-run`. El comentario
   se crea antes de cambiar el estado para que nunca haya un cierre sin evidencia.
8. **Antes de dar el trabajo por terminado, sincroniza el espejo.** `board`,
   luego `board --apply`, luego desplegar. Ver "Regla del espejo". Es el paso
   que más fácil se olvida porque Linear ya se ve correcto: el que se queda
   desactualizado es el tablero, y nadie se entera hasta semanas después.
