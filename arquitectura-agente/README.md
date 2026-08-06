# Tablero de seguimiento (GYM-31)

Espejo visual de los tickets de Linear del equipo GYM. Página estática desplegada
en <https://gymnasia-sable.vercel.app/>.

**No está conectado a Linear.** Sin API, sin token, sin cron, sin backend: una
página estática que lee un JSON. Se actualiza a mano. Si el tablero y Linear no
coinciden, manda Linear.

Antes esta web era la documentación de arquitectura del agente. Ese contenido se
migró al blog (GYM-49, <https://maximofn.com/gymnasia-agent>) y aquí solo queda
el tablero.

## Estructura

| Fichero | Qué es |
| --- | --- |
| `data/board.json` | **El único sitio que se toca al actualizar.** Todos los datos. |
| `index.html` | Esqueleto: cabecera, orden recomendado, pestañas y contenedores vacíos. |
| `script.js` | Render de las tres vistas y layout del grafo. Vanilla, sin dependencias. |
| `styles.css` | Estilos. Mismos tokens de color que el resto del proyecto. |
| `tests/` | Tests del JSON y E2E del tablero. |

## Orden recomendado ("Por dónde seguir")

Es lo primero de la página, por encima de las pestañas: responde a la única
pregunta que se hace uno al abrir el tablero, *¿y ahora qué?*.

Sale de `recommendedOrder` en `board.json`: una lista ordenada de fases, cada una
con `title`, `why` (por qué va en ese punto) y `tickets`.

**Se filtra solo.** El render descarta los tickets en `done` o `canceled` y oculta
la fase entera cuando se queda vacía, renumerando las que quedan. Así la lista se
va vaciando según avanza el trabajo sin mantenerla a mano: basta con sincronizar
los estados (`linear.py board --apply`).

Lo único que hay que tocar a mano es cuando **entra un ticket nuevo en una épica**:
hay que colocarlo en la fase que le toque. El test `todo ticket abierto de una
épica está en el orden recomendado` falla si se olvida.

Otros dos tests protegen el orden: que ningún ticket aparezca en dos fases, y que
ninguno vaya antes que algo que lo bloquea según `dependsOn`.

La etiqueta de punto de partida se reetiqueta aquí ("código ya escrito" en vez de
"Hecho"): en una lista de tickets abiertos, un "Hecho" a secas se lee como ticket
cerrado.

**Se puede contraer** pinchando en la cabecera. Plegado deja una barra con el
título y el recuento (`7 fases · 20 pendientes`), así que sigue informando. A
diferencia del plegado de épicas, que dura lo que la sesión, este **se recuerda
entre visitas** (`localStorage`, clave `gymnasia.board.roadmapCollapsed`): ocupa
la cabecera de forma permanente, así que si alguien lo pliega es una preferencia,
no una acción de exploración. Si `localStorage` no está disponible (modo privado),
se abre y no falla nada.

## Las tres vistas

- **Épicas** — agrupación de primer nivel con barra de progreso. Es la vista por
  defecto y la que más se mira.
- **Estado** — columnas tipo kanban (Backlog / Todo / In Progress / Done / Canceled).
- **Dependencias** — quién bloquea a quién, por niveles. Es lo que Linear enseña
  mal: aquí se ve de un vistazo que casi toda la épica de tool calling cuelga de
  GYM-34. Tocar un nodo aísla sus dependencias.

## Actualizar el tablero

**Cada modificación en Linear obliga a actualizar el espejo.** El estado se
sincroniza con la skill `linear-tickets`, desde la raíz del repo:

```bash
python3 .claude/skills/linear-tickets/scripts/linear.py board          # ¿qué ha derivado?
python3 .claude/skills/linear-tickets/scripts/linear.py board --apply  # escribe estados + meta.updated
npm run test:board
npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente
```

`board` sale con código 1 si hay diferencias, así que vale como comprobación.
`--apply` **solo** toca los estados y `meta.updated`: los títulos, las altas y las
bajas los reporta pero no los escribe, porque un ticket nuevo necesita `summary`,
`dependsOn` y `related` escritos con criterio.

Para un ticket nuevo, añadirlo a mano al array `tickets` de su grupo:

```jsonc
{
  "id": "GYM-50",
  "title": "Título tal cual está en Linear",
  "state": "backlog",
  "summary": "Una línea. Qué es, no cómo se hace: el detalle vive en el ticket.",
  "dependsOn": ["GYM-34"],   // quién lo bloquea (dependencia real, no 'relacionado')
  "related": [],             // relación informativa, no bloquea
  "baseline": "missing",     // opcional, solo en la épica GYM-33
  "article": "https://…"     // opcional, cuando el post existe
}
```

Notas sobre el modelo de datos:

- `dependsOn` y `related` pueden apuntar a un ticket o a una épica. Toda referencia
  debe existir en el propio JSON — el test lo comprueba.
- `baseline` (✅ hecho / 🟡 parcial / ❌ sin hacer) es el estado de partida en el
  código, distinto del estado del ticket en Linear. Solo tiene sentido en GYM-33.
- Las épicas declaran su propio `dependsOn` y salen en el grafo con borde punteado.
- El grupo `otros` (`kind: "group"`) recoge lo que en Linear no cuelga de ninguna
  épica. No lleva `state` ni enlace a Linear.
- `meta.ignore` lista los tickets de Linear que el tablero no refleja a propósito
  (el onboarding GYM-1 a GYM-4), para que `board` no los reporte en cada ejecución.

## Tests

```bash
npm run test:board       # valida data/board.json (node --test, sin dependencias)
npm run test:board:e2e   # E2E con Playwright sobre el sitio estático
```

El test del JSON es el que importa en el día a día: caza estados inválidos,
dependencias a tickets que no existen, ciclos, y un ticket cerrado que sigue
bloqueado por uno abierto (señal de que el estado se copió mal).

## Desarrollo local

Cualquier servidor estático sirve; con `fetch` de por medio, abrir el `index.html`
con `file://` no funciona.

```bash
npx --yes serve arquitectura-agente
```

## Despliegue

**Un push a `main` no despliega esto.** La integración de Git de Vercel está inactiva
en el repo, así que hay que lanzar la CLI a mano desde la raíz:

```bash
npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente
```

La CLI no está instalada de forma permanente (`npm exec` la baja al vuelo) pero la
sesión sigue autenticada, así que no hace falta `vercel login`. Usar `npm exec --`
y no `npx`: el hook de rtk reescribe `npx` a `npm` y falla.

`vercel.json` solo activa `cleanUrls` y desactiva `trailingSlash`: no hay build, se
sirven los ficheros tal cual. Por `cleanUrls`, `/index.html` responde con un
`Redirecting...`; para verificar el despliegue hay que pedir `/`.
