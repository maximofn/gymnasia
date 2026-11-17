# Relevo de catálogos de alimentos: CIQUAL, BEDCA y BLS

Actualizado el **17 de noviembre de 2026**. Este archivo conserva su nombre
histórico, pero el trabajo activo es **generar imágenes de BLS 4.0**.
Leer este documento y después el relevo específico BLS; no cargar la conversación,
los manifiestos completos de todas las tandas ni sus imágenes para preparar contexto.

La última petición fue actualizar este relevo para continuar en otra sesión.
**Preparar el contexto y esperar la siguiente instrucción.** Leer este archivo
no autoriza iniciar otra tanda, fusionar PRs, integrar BLS en móvil o lanzar builds.

## Estado actual

| Catálogo | Estado |
| --- | --- |
| CIQUAL | Generación completa: 3.484/3.484 imágenes, cero pendientes. La integración móvil de imágenes se fusionó en la [PR 453](https://github.com/maximofn/gymnasia/pull/453), comprobada como MERGED el 13 de noviembre. No se ha vuelto a verificar su estado funcional en esta actualización documental. |
| BEDCA | Importación local privada preparada; no publicar captura ni datos hasta aclarar condiciones. El usuario informó de que envió el correo de solicitud de autorización a AESAN/BEDCA. No consta respuesta en esta conversación. |
| BLS 4.0 | Datos y erratas oficiales fusionados en la [PR 455](https://github.com/maximofn/gymnasia/pull/455). Catálogo independiente, sin integración móvil en este trabajo. Imágenes: **2.000/7.140; 5.140 pendientes; 28,01 %**, en las tandas `0001` a `0020`, de 100 imágenes cada una. |

El antiguo texto «CIQUAL sin integración móvil» quedó superado por la PR 453.
Se autorizó la build de Producción 1.55.0 y su seguimiento en Google Play y GitHub;
esta actualización no comprobó su disponibilidad actual. No afirmar que Google
Play ha terminado la revisión sin consultar el estado real.

## GitHub y base para continuar: comprobado el 17 de noviembre

- Última entrega: [PR 488, vigésima tanda de 100 imágenes BLS](https://github.com/maximofn/gymnasia/pull/488).
- Rama de esa entrega: `codex/bls-food-images-0020`, históricamente basada en
  `codex/bls-food-images-0019` ([PR 484, decimonovena tanda](https://github.com/maximofn/gymnasia/pull/484)).
- Commit de la tanda `0020`: `f26d5883433bb5a2d49bb6116b02054c8ade9341`.
- **Las PRs 488 y 484 están CLOSED.** La PR 488 se cerró el 16 de noviembre,
  sin `mergedAt` ni `mergeCommit`: no describirla como abierta ni como fusionada.
- **El commit de la tanda `0020` sí está contenido en `main`.** La comparación de
  GitHub `f26d5883433bb5a2d49bb6116b02054c8ade9341...main` devolvió
  `behind_by: 0`, con ese mismo commit como ancestro común.
- `main` observado: `0471f324f1f3656b23ef97ab391b4ed7cc787911`.
  En esa referencia se comprobaron las carpetas `0001`–`0020` y el relevo BLS
  con 2.000 imágenes. No había PRs abiertas de tandas BLS en la consulta.
- **Para la siguiente tanda, partir del `origin/main` actualizado en un checkout
  limpio**, después de verificar inventario y PRs. No apilar automáticamente
  sobre las ramas cerradas `0019` o `0020`.
- El relevo `docs/bls-food-images-handoff.md` en `main` todavía menciona el antiguo
  worktree y la base apilada de `0020`. Esos detalles están superados por esta
  comprobación; sus reglas de generación, estilo y revisión siguen siendo útiles.

Los checks de la PR 488 para el commit indicado terminaron correctamente:

- [catalogs: SUCCESS, 6 min 48 s](https://github.com/maximofn/gymnasia/actions/runs/43944997924/job/133572194308).
- [prompt-policy: SUCCESS, 1 min 38 s](https://github.com/maximofn/gymnasia/actions/runs/43944997940/job/133572195957).

Estos resultados pertenecen a ese commit; no sustituyen comprobar el nuevo head
cuando se continúe. No se fusionó ni se desplegó nada al actualizar este archivo.

## Rutas y recuperación del entorno

- Repositorio principal: `/Users/macm1/Documents/proyectos/gymnasia`.
  Rama local observada: `codex/ciqual-food-image-samples`, en `06b70dc8`.
  **No es la base actual de las tandas BLS**: no cambiar su rama ni mezclarla con
  `main` para preparar imágenes. Este archivo solicitado se actualiza aquí.
- Hay archivos no rastreados del mantenedor en `.claude/skills/crear-assets-youtube/`,
  `.claude/skills/crear-metadata-youtube/` y `.vercel/`; conservarlos.
- El antiguo worktree BLS `/private/tmp/gymnasia-bls-import-20261115` **ya no existe**.
  Tampoco existe `/Users/macm1/.codex/worktrees/bfcf/gymnasia`. No usar esas rutas
  como directorio de trabajo ni dar por existente el checkout del relevo BLS.
- `git worktree list` mostró únicamente el repositorio principal. La rama local
  `codex/bls-food-images-0020` conserva el commit indicado y sus 101 archivos de
  tanda (100 WebP más manifiesto).
- Tras recibir la siguiente instrucción de generación, crear un checkout o
  worktree limpio desde `origin/main`; una ruta posible es
  `/private/tmp/gymnasia-bls-images-continue-20261117`. **Aún no está creado**.
  Si se usa una rama nueva, el prefijo es `codex/`.
- El antiguo entorno privado BEDCA no se ha recuperado ni publicado. No copiar
  capturas ni datos privados al checkout BLS. Los temporales son opcionales:
  los entregables duraderos ya están en Git.

## Última tanda BLS: 0020 terminada

Se generaron **100 imágenes independientes con Codex integrado**, desde
`bls-H720400` hasta `bls-K280100`: legumbres, bebidas y cremas vegetales, tofu,
sustitutos vegetales y preparados de patata. No queda una tanda parcial ni
imágenes por generar dentro de `0020`. No se inició `0021` en esta conversación.

- Finales: `alimentos/bls/image-batches/0020/*.webp`, opacos, 1024×1024, calidad 90.
- [Manifiesto y prompts de la tanda 0020](https://github.com/maximofn/gymnasia/blob/f26d5883433bb5a2d49bb6116b02054c8ade9341/alimentos/bls/image-batches/0020/manifest.json): nombres oficiales DE/EN, huellas de origen, prompts exactos, referencias y SHA-256.
- Índice y criterios editoriales: `alimentos/bls/image-batches/README.md`.
- Relevo específico: `docs/bls-food-images-handoff.md`, leído desde la rama BLS o
  `main` actualizado, con las salvedades de rutas y base explicadas arriba.
- Nueve láminas: `docs/testing/assets/bls-food-images-0020-01.jpg` a `-09.jpg`.
- Revisados **todos los WebP finales** en las nueve láminas y **23 casos a tamaño
  completo**; la lista exacta está en el manifiesto y en `review/notes.json`.
  No hicieron falta regeneraciones.
- Se distinguen legumbres secas e hidratadas, soja texturizada seca y remojada,
  tofu firme y sedoso, patatas peladas y con piel, y congelados antes y después
  de la cocción final. Las mezclas deshidratadas de Kartoffelkloß no se muestran
  como bolas cocidas. Los Kartoffelpuffer congelados pueden conservar el dorado
  previo de su presentación comercial; los gnocchi cocidos no tienen escarcha.
- Las bebidas y cremas usan presentaciones ilustrativas; dulzor, sabor no
  especificado, vitaminas, calcio o fórmula no se certifican con la apariencia.
- `status: pending-review` se conserva como metadato del manifiesto. La revisión
  visual de Codex no equivale a aprobación del mantenedor, ni ese campo permite
  deducir por sí solo el estado actual de GitHub.

Validaciones locales de la tanda `0020`, todas correctas:

```bash
npm run check:bls:images       # 2000/7140; 5140 pendientes; 28.01 %
node --test --test-concurrency=1 scripts/catalogs/*.test.mjs  # 67/67
npm run check:catalogs
npm run check:bls
npm run check:data-inventory
npm run test:data-inventory    # 23/23
npm run check:legal
git diff --check
```

La suite de catálogos se ejecutó en serie para evitar saturación entre validadores
intensivos. No pasar `--test-concurrency` mediante `NODE_OPTIONS`: Node lo rechaza.
El diff de `0020` contiene 112 archivos: 100 WebP, un manifiesto, nueve láminas y
dos documentos. No modifica app, datos BLS, erratas, fuentes, CIQUAL ni tandas anteriores.

## Continuación autorizada al pedir «más»

En este contexto, «más» significa **otra tanda de hasta 100 imágenes BLS**,
una por alimento pendiente, con el enfoque de CIQUAL y PR revisable.
**No fusionar las PRs BLS automáticamente.** La antigua autorización de cierre
de tandas CIQUAL no se traslada a BLS. No integrar BLS en móvil ni lanzar builds.

1. Comprobar las instrucciones vigentes, las ramas, el estado local y GitHub.
   Las instrucciones AGENTS.md anteriormente aportadas en este chat fueron
   revocadas por el usuario el 17 de noviembre; no restaurarlas como autorización.
2. Preparar un checkout limpio desde `origin/main` actualizado, conservando el
   repositorio principal y cualquier dato privado. Leer selectivamente el relevo
   BLS, `.claude/skills/generate-food-image/SKILL.md` y la skill `imagegen` disponible.
3. Ejecutar `npm run check:bls:images` y `npm run next:bls:images -- 100`.
   Si hay una tanda incompleta, recuperar sus recibos antes de seleccionar otra.
   Con el inventario aquí comprobado, la siguiente carpeta sería **0021**, sujeto
   al inventario real. No repetir las 2.000 imágenes terminadas.
4. Usar generador integrado, una llamada por alimento, nombres DE/EN literales y
   referencia CIQUAL adjunta como **STYLE REFERENCE ONLY**, inspeccionada antes.
   No cambiar a API de pago, claves, Hugging Face o Wallabot sin autorización.
5. Guardar plan y recibo por ID con prompt y PNG original **antes de convertir**.
   Conservar originales. Normalizar a WebP y revisar todas las salidas finales.
6. Registrar prompts, referencias, huellas y SHA-256 en manifiesto. Documentar
   correcciones si las hay, sin cambiar datos nutricionales ni traducciones.
7. Pasar los checks anteriores, crear commit y subir una rama propia con PR
   revisable. Elegir la base según el estado actual de GitHub; dejar la PR abierta.

Estilo: fotografía gastronómica realista, fondo carbón opaco `#0D1117`, luz cálida
suave, alimento completo y centrado, 55–65 % del encuadre, silueta legible a 48 px.
Sin envases, marcas, utensilios o decoración. Referencias aprobadas:
`alimentos/ciqual/image-samples/ciqual-13620.webp` para sólidos y
`alimentos/ciqual/image-samples/ciqual-20587.webp` para cuenco. Son ilustraciones
de Gymnasia, no proporcionadas ni validadas por Max Rubner-Institut; no acreditan
receta, ingredientes exactos, alérgenos, composición ni una porción de 100 g.

## Recuperación y memoria

Checkpoint de `0020`, comprobado existente el 17 de noviembre:
`/tmp/gymnasia-bls-images-0020/`. Contiene `selection.json`, `plan.json`, 100 recibos
`bls-CODIGO.receipt.json`, `review/notes.json`, nueve láminas, scripts de generación,
normalización y documentación, logs y archivos `.exit` de las verificaciones.

`session-handoff.json` y `pr-final.json` registran el estado histórico al terminar
la generación, cuando la PR 488 estaba abierta. **GitHub se volvió a comprobar
el 17 de noviembre y ese estado abierto está superado**, como se explica arriba.
Los scripts del checkpoint apuntan al worktree desaparecido: adaptarlos a la
nueva ruta, fecha y tanda antes de usarlos. No ejecutar el generador de `0020`
para continuar; sus 100 recibos ya existen. Los PNG originales están indicados
en los recibos bajo `/Users/macm1/.codex/generated_images/`.

No regenerar imágenes terminadas si desaparecen los temporales: los WebP y
manifiestos versionados son los entregables duraderos. Para reducir memoria,
leer selectivamente y revisar por láminas de unas 12 miniaturas; abrir individuales
solo cuando haga falta. No cargar 100 originales en el chat ni volcar base64.
Recoger resultados en bloques pequeños de unas cuatro imágenes para evitar el
límite del visor de 64 MiB. Si falla la presentación, comprobar recibos y archivos
antes de repetir generación: un fallo del visor no significa que falte la imagen.

## Mensaje para la nueva sesión

```text
Lee /Users/macm1/Documents/proyectos/gymnasia/docs/ciqual-food-images-handoff.md.
El trabajo activo es BLS: 2.000/7.140 imágenes, 5.140 pendientes, 28,01 %.
La tanda 0020 está terminada; su commit está contenido en main. La PR 488 está
cerrada y el antiguo worktree temporal ya no existe. No uses las ramas cerradas
como base automática: al continuar habrá que preparar un checkout limpio desde
origin/main y verificar inventario. La siguiente tanda prevista es 0021.
No publiques datos privados BEDCA. Lee selectivamente el relevo BLS teniendo en
cuenta las correcciones de este documento, prepara contexto sin cargar todo el
historial ni las imágenes y espera mi siguiente instrucción.
```
