# Relevo de catálogos de alimentos: CIQUAL, BEDCA y BLS

Actualizado el **13 de noviembre de 2026**. Este archivo conserva su nombre
histórico, pero el trabajo activo es **generar imágenes de BLS 4.0**.
Leer este documento y después el relevo específico BLS; no cargar la conversación,
los manifiestos completos de todas las tandas ni sus imágenes para preparar contexto.

La última petición fue guardar el relevo para cambiar de sesión por consumo de
memoria. **Preparar el contexto y esperar la siguiente instrucción.** No iniciar
otra tanda ni fusionar nada por el mero hecho de leer este archivo.

## Estado actual

| Catálogo | Estado |
| --- | --- |
| CIQUAL | Generación completa: 3.484/3.484 imágenes, cero pendientes. La integración móvil de imágenes se fusionó en la [PR 453](https://github.com/maximofn/gymnasia/pull/453), comprobada como MERGED el 13 de noviembre. |
| BEDCA | Importación local privada preparada; no publicar captura ni datos hasta aclarar condiciones. El usuario informó de que envió el correo de solicitud de autorización a AESAN/BEDCA. No consta respuesta en esta sesión. |
| BLS 4.0 | Datos y erratas oficiales fusionados en la [PR 455](https://github.com/maximofn/gymnasia/pull/455). Catálogo independiente, todavía sin integración en la app. Imágenes: **700/7.140; 6.440 pendientes; 9,80 %** en siete tandas de 100. |

El antiguo texto «CIQUAL sin integración móvil» quedó superado por la PR 453.
Se autorizó la build de Producción 1.55.0 y su seguimiento en Google Play y GitHub;
esta sesión de imágenes no volvió a comprobar su disponibilidad actual. No afirmar
que Google Play ha terminado la revisión sin consultar el estado real.

## Dónde trabajar sin publicar BEDCA

- **Trabajo BLS:** `/tmp/gymnasia-bls-import-20261111` (ruta real
  `/private/tmp/gymnasia-bls-import-20261111`).
- **Rama BLS actual:** `codex/bls-food-images-0007`.
- **PR actual:** [PR 465, séptima tanda de 100 imágenes BLS](https://github.com/maximofn/gymnasia/pull/465),
  abierta contra `codex/bls-food-images-0006` (PR 464, sexta tanda).
- **Commit de las 100 imágenes:** `cf01629bca86fcdbb4b68740b6de2a2c3e95d991`.
  La actualización de este relevo puede añadir un commit documental posterior;
  consultar siempre el head actual y sus checks.
- **Workspace de este chat:** `/Users/macm1/.codex/worktrees/e601/gymnasia`,
  rama privada `codex/bedca-local-import`. Se ha conservado sin cambios durante
  las tandas BLS. No subir esa rama ni copiar sus datos privados al checkout BLS.
- **Repositorio principal:** `/Users/macm1/Documents/proyectos/gymnasia`, rama
  observada `codex/ciqual-food-image-samples`. Contiene archivos no rastreados del
  mantenedor; conservarlos. El archivo de relevo solicitado se guarda aquí.
- Si falta el worktree temporal, recuperar la rama BLS desde GitHub en un checkout
  limpio. Los archivos versionados son suficientes; no depender de `/tmp`.

## Última tanda BLS: 0007 terminada

Se generaron **100 imágenes independientes con Codex integrado**, desde
`bls-D477100` hasta `bls-D6A6000`: strudel, tartas de queso, bizcochos, merengues,
galletas, gofres, barquillos, panes de especias y pastas de almendra y coco.
No queda una tanda parcial ni imágenes por generar dentro de `0007`.

- Finales: `alimentos/bls/image-batches/0007/*.webp`, opacos, 1024×1024, calidad 90.
- Prompts exactos, nombres oficiales DE/EN, huellas y hashes:
  `alimentos/bls/image-batches/0007/manifest.json`.
- Índice y criterios editoriales: `alimentos/bls/image-batches/README.md`.
- Relevo específico: `docs/bls-food-images-handoff.md` en la rama BLS.
- Nueve láminas: `docs/testing/assets/bls-food-images-0007-01.jpg` a `-09.jpg`.
- Revisados **todos los WebP finales** en las nueve láminas y nueve casos a tamaño
  completo: D477100, D4A3000, D4A6000, D540100, D610100, D650100, D651700,
  D6A2000 y D6A4000. No hicieron falta regeneraciones.
- `pending-review` indica que falta la revisión del mantenedor; nuestra revisión
  visual no equivale a su aprobación ni autoriza una fusión.

Validaciones locales observadas correctas:

```bash
npm run check:bls:images       # 700/7140; 6440 pendientes; 9.80 %
npm run test:catalogs          # 67 pruebas, 0 fallos
npm run check:catalogs
npm run check:bls
npm run check:data-inventory
npm run test:data-inventory    # 23 pruebas, 0 fallos
npm run check:legal
git diff --check
```

El diff contra `2e9eece3fd52f20d602b673400a241f36dd72597` conserva intactos app,
datos BLS, erratas, fuentes, CIQUAL y tandas 0001–0006. SHA-256 del manifiesto
nutricional BLS: `7a1ed5d4643fe48038abeb126fe57a3792a93707bceeec371df6b7d3e653e404`.

La PR 464 seguía abierta y con `catalogs` y `prompt-policy` correctos al comenzar
la séptima tanda. Tras abrir la PR 465 se observaron `prompt-policy` correcto y
`catalogs` en curso. Los checks pueden cambiar o reiniciarse al actualizar este
relevo: consultar los del SHA actual, sin confundirlos con las pruebas locales.

## Continuación autorizada al pedir «más»

En el contexto actual, «más» significa **otra tanda de hasta 100 imágenes BLS**,
una por alimento pendiente, con el enfoque de CIQUAL y PR revisable.
**No fusionar las PRs BLS automáticamente.** La antigua autorización de cierre
de tandas CIQUAL no se traslada a BLS. No integrar BLS en móvil ni lanzar builds.

1. Aplicar `AGENTS.md`; comprobar rama, estado local, PR anterior y sus checks.
2. Leer `docs/bls-food-images-handoff.md`, la skill del repositorio
   `.claude/skills/generate-food-image/SKILL.md` y la skill `imagegen` disponible.
3. Ejecutar `npm run check:bls:images` y `npm run next:bls:images -- 100`.
   Si hay una tanda incompleta, recuperar sus recibos antes de seleccionar otra.
   Con 0007 terminada, la siguiente carpeta sería 0008, sujeto al inventario real.
4. Usar generador integrado, una llamada por alimento, nombres DE/EN literales y
   referencia CIQUAL adjunta como **STYLE REFERENCE ONLY**, inspeccionada antes.
   No cambiar a API de pago, claves, Hugging Face o Wallabot sin autorización.
5. Guardar plan y recibo por ID con prompt y PNG original **antes de convertir**.
   Conservar originales. Normalizar a WebP y revisar todas las salidas finales.
6. Registrar prompts, referencias, huellas y SHA-256 en manifiesto. Documentar
   correcciones si las hay, sin cambiar datos nutricionales ni traducciones.
7. Pasar los checks anteriores, commit, push y PR. Si la base anterior continúa
   abierta, usar una rama apilada que muestre solo la tanda nueva. Dejarla abierta.

Estilo: fotografía gastronómica realista, fondo carbón opaco `#0D1117`, luz cálida
suave, alimento completo y centrado, 55–65 % del encuadre, silueta legible a 48 px.
Sin envases, marcas, utensilios o decoración. Referencias aprobadas:
`alimentos/ciqual/image-samples/ciqual-13620.webp` para sólidos y
`alimentos/ciqual/image-samples/ciqual-20587.webp` para cuenco. Son ilustraciones
de Gymnasia, no proporcionadas ni validadas por Max Rubner-Institut; no acreditan
receta, ingredientes exactos, alérgenos, composición ni una porción de 100 g.

## Recuperación y memoria

Checkpoint opcional 0007: `/tmp/gymnasia-bls-images-0007/`, con `plan.json`,
`descriptions.txt`, 100 recibos `bls-CODIGO.receipt.json`, `review/notes.json`,
láminas y scripts de normalización y cierre. Los PNG originales siguen en las
rutas de los recibos bajo `/Users/macm1/.codex/generated_images/`.
No regenerar imágenes terminadas si desaparecen los temporales: los WebP y
manifiestos de la PR son los entregables duraderos.

Para reducir memoria, leer selectivamente y revisar por láminas de unas 12
miniaturas; abrir individuales solo cuando haga falta. No cargar 100 originales
en el chat ni volcar base64. La herramienta permite bloques pequeños de llamadas
independientes; cuatro salidas evitan exceder el límite del visor de 64 MiB.
Si falla la presentación, comprobar recibos y archivos antes de repetir generación.

## Mensaje para la nueva sesión

```text
Lee /Users/macm1/Documents/proyectos/gymnasia/docs/ciqual-food-images-handoff.md.
El trabajo activo es BLS: 700/7.140 imágenes, 6.440 pendientes, 9,80 %.
La tanda 0007 está terminada en la PR 465, sin fusión ni integración móvil.
Trabaja con la rama codex/bls-food-images-0007 del worktree BLS indicado en el
relevo; no publiques la rama privada BEDCA. Lee el relevo específico BLS de esa
rama, prepara contexto sin cargar todo el historial ni las imágenes y espera
mi siguiente instrucción.
```
