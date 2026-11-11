# Relevo del catálogo de imágenes de alimentos CIQUAL

**Actualización del 11 de noviembre de 2026:** el mantenedor ha solicitado por
separado integrar las imágenes en catálogo, búsqueda y dieta. La implementación
y su QA están en `codex/ciqual-mobile-images`, que incluye también la tanda 0053
de la PR 451. Consultar su PR actual antes de continuar: este relevo describe el
flujo anterior de generación y sus menciones de «sin integración móvil» son el
estado previo a ese cambio. La integración requiere una fusión aprobada
expresamente porque inicia una build Android; «más» no autoriza esa fusión.
El funcionamiento implementado se describe en
[`alimentos/ciqual/README.md`](../alimentos/ciqual/README.md#integración-móvil-local)
y las pruebas en
[`docs/testing/evidence/ciqual-food-images.md`](testing/evidence/ciqual-food-images.md).

Este es el punto de entrada para continuar en un chat nuevo sin recuperar el
historial ni sus imágenes. **La generación está terminada: 3.484 de 3.484 imágenes,
100,00 %, cero pendientes.** Solo queda la revisión o fusión de la última PR si
el mantenedor pide continuar con ese cierre. Las imágenes todavía no están
integradas en la app.

Leer primero «Estado de referencia» y «Relevo para un chat nuevo». El flujo de
generación se conserva como referencia; el catálogo completo no necesita otra
tanda. No cargar todos los manifiestos históricos, prompts o PNG para preparar
la nueva sesión.

## Qué significa más

El mantenedor ha autorizado este flujo cuando envíe **«más»** como orden de
continuación. Aceptar también «mas» y diferencias de mayúsculas:

1. Consultar la PR anterior de la rama de imágenes y sus checks actuales.
2. Si está abierta y todos los checks requeridos están correctos, fusionarla.
   No pedir otra confirmación rutinaria para esa tanda de imágenes ya autorizada.
3. Actualizar la misma rama y consultar el inventario. **Si hay cero pendientes,
   informar del catálogo completo y terminar este flujo sin crear otra tanda.**
   Si quedan alimentos, generar hasta **100 imágenes nuevas**, una por pendiente,
   con el mismo estilo. No son variantes de una misma imagen.
4. Revisar todas las imágenes de la tanda, corregir las que fallen, validar,
   crear un commit, subirlo y abrir la siguiente PR contra `main`, en la misma rama.
5. **Dejar la nueva PR abierta** para la siguiente revisión o el siguiente «más».
   Informar del proceso y del progreso acumulado con porcentaje.

Si la PR anterior ya está fusionada, continuar sin fusionarla de nuevo. Si sus
checks están pendientes, esperar; si fallan, investigar sin forzar la fusión.
Si quedan menos de 100 alimentos, completar solo los pendientes y comunicarlo.
Una mención de la palabra «más» dentro de una explicación o cita no inicia una tanda.

Esta autorización no permite generar todo el catálogo sin límite, integrar las
imágenes en móvil, publicar versiones ni saltarse las aprobaciones de `AGENTS.md`.
Si aparecen cambios ajenos a imágenes y su documentación, revisar su alcance
antes de fusionar. No eludir una aprobación de instrucciones del agente o de build.

## Estado de referencia

Estado comprobado el **11 de noviembre de 2026**, incluyendo la última tanda
aunque su PR siga abierta. Volver a consultar GitHub y los manifiestos al empezar.

**La generación del catálogo está completa: 3.484 imágenes registradas, cero pendientes.**
Las imágenes siguen sin integración móvil. La última PR queda abierta para revisión.

| Dato | Valor |
| --- | --- |
| Repositorio local | `/Users/macm1/Documents/proyectos/gymnasia` |
| GitHub | `maximofn/gymnasia` |
| Rama que se conserva | `codex/ciqual-food-image-samples` |
| Imágenes registradas | 3.484 de 3.484 |
| Porcentaje | 100,00 % |
| Pendientes | 0 |
| Última tanda | `0053`, con 81 imágenes revisadas |
| PR anterior fusionada | [PR 450](https://github.com/maximofn/gymnasia/pull/450) |
| PR abierta para la siguiente fusión | [PR 451](https://github.com/maximofn/gymnasia/pull/451) |
| Commit de las imágenes de esa PR | `da9c12c482eae6fb62008c13dce41eb49ab8d780` |
| Siguiente tanda | No hay alimentos pendientes |

La PR 450 se fusionó el 10 de noviembre de 2026 con los cinco checks correctos
del head `7a415a34d6e5c4d26ea209abba5ee3545867336c`, protegido con
`--match-head-commit`, tras comprobar que solo incluía imágenes y documentación.
Después se actualizó la rama por avance rápido. La nueva PR queda abierta para
la siguiente revisión o «más»; consultar los checks de su SHA actual antes de fusionar.

El 11 de noviembre se comprobó que la PR 451 sigue **abierta**, con 84 archivos:
las 81 imágenes y su manifiesto, el índice y este relevo. Los cinco checks del head
`1297e612ed58a43a5316523242f7df3a3b11d455` estaban correctos. GitHub indicaba
`BEHIND` y `MERGEABLE`: `main` había avanzado hasta
`fad504065547d71b48780e46ebe08a822f555459`.
Esta actualización documental genera otro head y puede reiniciar los checks;
reconsultar siempre el SHA y sus resultados actuales antes de una futura fusión.
El validador de imágenes se volvió a ejecutar el 11 de noviembre y confirmó
3.484/3.484, cero pendientes. Esta actualización solo modifica este documento;
`git diff --check` también pasó.

La tanda 0053 pasó los 33 tests del catálogo, `check:ciqual:images`,
`check:catalogs`, `check:ciqual`, `check:ciqual:mobile` y `git diff --check`.
Se generó una imagen independiente por alimento con Codex integrado y una
referencia de estilo aprobada por llamada.

Se revisaron los 81 WebP finales en siete hojas de contacto y, a tamaño completo:
`ciqual-1010`, `ciqual-11084`, `ciqual-13523`, `ciqual-96778`, `ciqual-26241`,
`ciqual-25164`.

Las 81 salidas iniciales pasaron la revisión visual; no fue necesario regenerar
imágenes. El checkpoint conserva los recibos, los prompts exactos y los PNG originales
registrados antes de convertir a WebP. No se sobrescribieron tandas anteriores.

Se distinguen pastis sin diluir, pastis diluido 1+5 y aperitivo anisado sin alcohol
para diluir; Marsala al huevo ámbar, contrastado con [Cantine
Lombardo](https://www.cantinelombardo.it/prodotto/cremovo/), sin convertirlo en crema
láctea; kir quieto frente a kir royal espumoso. Cerveza, sidra, espumosos, bebidas sin
gas y aguas con/sin gas conservan sus diferencias de espuma, turbidez y burbujas.
Velleminfroy se representa en su opción sin gas. Los cócteles, licores, bebidas medias
y smoothie son opciones ilustrativas, no recetas oficiales. La fruta de la sangría
queda dentro como ingrediente, sin guarniciones exteriores.

Las fórmulas infantiles permanecen en polvo, sin biberones, cacitos, edades dibujadas
ni instrucciones de alimentación. Vino y ron cocinados se muestran como líquidos de
cocina en cuenco, sin llamas; su imagen no certifica evaporación completa del alcohol.
La masa de pizza está cocida y completamente vacía; el almidón de arroz es polvo, no
granos ni arroz cocido.

Se consultaron los nombres científicos de las propias fichas: `ciqual-11084` es
Eucheuma sp. fresco, de [ramas
cartilaginosas](https://www.fao.org/4/x5819e/x5819e06.htm); `ciqual-11085`, Gelidium
amansii seco, se distingue por sus [ramas finas
desecadas](https://www.fao.org/4/y4765e/y4765e05.htm). Se representan algas, sin
sustituirlas por agar en polvo, hojas de gelatina o postres.

El dátil del desierto sigue [Balanites
aegyptiaca](https://apps.worldagroforestry.org/treedb2/AFTPDFS/Balanites_aegyptiaca.PDF):
piel y pulpa crudas, sin hueso, distinto de un dátil de palmera seco. El caqui de
monte sigue [Diospyros
mespiliformis](https://apps.worldagroforestry.org/usefultrees/pdflib/Diospyros_mespiliformis_ETH.pdf):
frutos pequeños redondeados con cáliz y semillas internas, distinto de un kaki
asiático grande.

Quedan resueltas las dos imágenes antes apartadas. El mantenedor delegó el criterio:
`ciqual-25164` se representa con ternera por coincidencia de los títulos principales
FR/EN/ES, con jarrete de corte transversal, verduras y vino blanco, sin risotto ni
guarnición. La mención contradictoria jarret de porc permanece intacta y no se
presenta como corregida o verificada. Para `ciqual-26241`, el campo oficial
scientific_name Hoplostethus spp. respalda empereur, concordante con
[IFREMER](https://archimer.ifremer.fr/doc/00848/95951/103899.pdf); se genera un filete
crudo sin piel. Las traducciones EN/ES que dicen tiburón azul se conservan
discrepantes, sin validarlas.

Los nombres FR/EN/ES quedan exactos. Son ilustraciones propias generadas por IA, no
proporcionadas ni validadas por ANSES. La cantidad visible no representa 100 g ni una
ración recomendada. La imagen no acredita especie, origen, composición, minerales,
azúcar, edad de fórmula infantil, graduación o ausencia de alcohol. Siguen sin
integración móvil; no cambian fichas, nutrientes, traducciones ni código.

## Relevo para un chat nuevo

La tanda `0053` está terminada, revisada, validada y subida en la PR 451.
No quedan alimentos pendientes ni una tanda parcial que reanudar. La carpeta
`0054` no existe y no hay que generar variantes para rellenar una nueva tanda.

Una nueva orden «más» permite revisar y, si corresponde por sus checks, fusionar
la última PR de imágenes conforme al flujo anterior. Con cero pendientes, informar
del catálogo completo. La integración móvil, publicación de versiones o importación
de otros catálogos requieren una petición independiente: no están autorizadas
por esta continuación de imágenes.

La petición que cerró esta sesión fue actualizar este documento para cambiar de
chat, no una nueva orden de generación o fusión. En el chat nuevo, preparar el
contexto y esperar la siguiente instrucción del mantenedor.

Si una futura orden «más» encuentra la PR detrás de `main`, actualizar primero las
referencias con `git fetch origin main` y después integrar `origin/main` en la rama
de imágenes mediante una fusión normal, resolviendo conflictos sin perder cambios. Revisar de nuevo las rutas de
la PR y esperar los checks del nuevo SHA antes de fusionarla con protección del
head. Conservar la rama; no usar force-push, `--admin` o `--auto` para saltar controles.

Trabajar en `/Users/macm1/Documents/proyectos/gymnasia`, aunque el chat se abra
en otro worktree. Confirmar allí la rama `codex/ciqual-food-image-samples` y el
estado real antes de escribir. Conservar los archivos no rastreados del mantenedor.

Los archivos versionados de `0053` bastan para continuar: 81 WebP y manifiesto
con prompts exactos. Como recuperación opcional, `/tmp/ciqual-0053/` conserva
`selection.json`, `plan.json`, `receipts.jsonl`, `review/notes.json` y las siete
hojas `review/contact-01.jpg` a `review/contact-07.jpg`. Los recibos identifican
los PNG y prompts antes de la conversión. No depender de esos temporales ni
regenerar tandas terminadas si faltan.

`reference_image` en el manifiesto lleva una ruta **relativa al repositorio**.
La ruta absoluta se usa para adjuntar la referencia al generador. Los WebP son
opacos, de 1024 × 1024 y calidad 90. Leer skills y manifiestos selectivamente,
sin cargar todos los prompts históricos ni los PNG originales. Revisar por hojas
de unas 12 miniaturas y abrir a tamaño completo solo los casos dudosos.

Ante discrepancias de especie, consultar también `scientific_name` en la ficha
oficial antes de dar la identificación por irresoluble. Es lo que permitió
resolver empereur sin modificar ninguna traducción ni dato nutricional.

## Fuentes de alimentos consideradas

Al inicio de la conversación se propusieron estas seis fuentes. Se eligió
ANSES-CIQUAL para la integración desarrollada en este flujo; las demás quedaron
como posibles complementos según el tipo de información necesario.

| Fuente | Uso propuesto |
| --- | --- |
| [OpenNutrition](https://www.opennutrition.app/download) | Dataset descargable con alimentos genéricos, preparados y comerciales, nutrientes y procedencia. |
| [ANSES-CIQUAL](https://ciqual.anses.fr/) | Composición nutricional de alimentos habituales en Europa; es la fuente elegida para el catálogo de este trabajo. |
| [BEDCA](https://www.bedca.net/) | Base española de composición de alimentos, con nombres en español. |
| [USDA FoodData Central](https://fdc.nal.usda.gov/download-datasets/) | Nutrientes detallados, pesos de raciones y medidas domésticas; USDA FNDDS se propuso para complementar las raciones habituales. |
| [Open Food Facts](https://world.openfoodfacts.org/data) | Productos comerciales, marcas, códigos de barras, ingredientes e imágenes de envases. |
| [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k) | Platos fotografiados con ingredientes, pesos y datos nutricionales; candidato para reconocimiento visual de comidas. |

La combinación propuesta era **CIQUAL/BEDCA para alimentos genéricos, USDA para
complementar nutrientes y raciones, y Open Food Facts para productos de marca**.
Las imágenes homogéneas del catálogo seguirían siendo propias. Esta lista no
significa que todas las fuentes estén integradas ni autoriza nuevas importaciones
como parte de una orden «más»; ese flujo sigue limitado a las imágenes CIQUAL.

## Archivos que hay que leer

Aplicar primero las instrucciones `AGENTS.md` disponibles en el nuevo chat y en
el repositorio. Leer las skills completas que correspondan a la sesión:

- [Skill del repositorio para imágenes de alimentos](../.claude/skills/generate-food-image/SKILL.md).
- La skill `imagegen` de Codex, si está disponible, y las instrucciones de su herramienta.
- [Flujo de tandas e índice](../alimentos/ciqual/image-batches/README.md).
- [Muestras y aprobación del estilo](../alimentos/ciqual/image-samples/README.md).
- [Manifiesto de muestras aprobadas](../alimentos/ciqual/image-samples/manifest.json).
- [Manifiesto de la última tanda](../alimentos/ciqual/image-batches/0053/manifest.json),
  que conserva los prompts exactos de los últimos 81 alimentos.

No es necesario cargar la conversación anterior. Los manifiestos versionados,
los archivos y GitHub son el estado de trabajo. No confiar en variables de una
sesión anterior ni en la permanencia de sus archivos temporales.

## Estilo visual y generación

Usar el **generador de imágenes integrado de Codex**, con **una llamada
independiente por alimento**. No sustituirlo por dibujos de código, SVG,
composiciones reutilizadas o una sola cuadrícula de 100 alimentos.
Se han usado hasta cuatro llamadas independientes en paralelo cuando la
herramienta lo permite; eso no cambia la revisión individual de las 100 salidas.

No leer claves ni cambiar a API de pago, scripts de API o Hugging Face de forma
automática. Si el generador integrado falla o no está disponible, explicar el
bloqueo y solicitar autorización antes de emplear otra ruta.

Inspeccionar estas referencias con el visor de imágenes antes de utilizarlas:

- [Manzana aprobada](../alimentos/ciqual/image-samples/ciqual-13620.webp): referencia
  habitual para sólidos colocados directamente sobre el fondo.
- [Lentejas aprobadas](../alimentos/ciqual/image-samples/ciqual-20587.webp): referencia
  habitual para alimentos servidos en un cuenco oscuro.

Adjuntar la referencia por su ruta local a cada llamada y etiquetarla como
**STYLE REFERENCE ONLY**: se copia su estilo, no su alimento. Mantener:

- Fotografía gastronómica de estudio, realista, no ilustración ni plástico 3D.
- Fondo opaco carbón `#0D1117`, mate y ligeramente texturado.
- Luz cálida suave desde arriba y sombra discreta que apoye el alimento.
- Un sujeto o grupo compacto centrado; alimento y recipiente completos,
  aproximadamente el 55–65 % del encuadre y espacio oscuro alrededor.
- Cuenco cerámico oscuro sencillo para alimentos sueltos o con salsa; sólidos
  directamente sobre el fondo. Ramequín oscuro si la preparación lo necesita.
- Silueta reconocible a 48×48 píxeles y salida final cuadrada de 1024×1024.
- Sin texto, logotipos, marcas, envases, manos, cubiertos o decoración añadida.

Preparar una descripción inglesa específica por alimento a partir de los
nombres completos francés e inglés; usar el español para revisar. Respetar
crudo/cocido, congelado, seco, piel, hueso, escurrido o en almíbar, rellenos,
coberturas e ingredientes expresos. No añadir leche a cereales secos ni
convertir una galleta sencilla en sándwich. No inventar símbolos de vitaminas,
ausencia de gluten, azúcar o grasa: esas propiedades no se demuestran en una foto.
Los platos genéricos son ilustrativos, no recetas oficiales de ANSES.

Ante nombres discrepantes, revisar la ficha sin modificar la fuente. Por ejemplo,
`ciqual-25089` se representó como ave según FR/ES, pese al inglés discrepante.
Si no se puede resolver una diferencia importante, señalarla en lugar de inventar datos.

Base de prompt reutilizable, completando el sujeto y el tipo de presentación:

```text
Use case: product-mockup. Asset type: square food catalog thumbnail for Gymnasia.
Create ONE NEW photorealistic studio food photograph.
Image 1 is a STYLE REFERENCE ONLY: match its dark charcoal (#0D1117) matte
slightly textured surface, soft warm overhead lighting, subtle grounded shadow,
realistic food texture and quiet premium framing. Do not reproduce its food.
Subject: [exact food, preparation, visible ingredients, filling and coating].
[Place only this food directly on the surface OR serve in one small plain dark bowl.]
Entire food and bowl visible, centered, roughly 55-65% of the square frame,
generous dark negative space. High 3/4 or overhead for bowls, elevated front
3/4 for solids. Recognizable silhouette at 48x48 pixels.
Respect raw versus cooked and filled versus unfilled exactly.
No text, lettering, logos, watermark, hands, utensils, wrappers or packaging.
No added garnish, toppings, sauces or ingredients beyond the specified subject.
Opaque dark background, square 1:1, 1024x1024. Illustrative Gymnasia image,
not provided or validated by ANSES.
```

No usar los corchetes literalmente ni reemplazar con esta plantilla los prompts
históricos: guardar el texto exacto enviado realmente para cada imagen.

## Selección y guardado sin duplicados

Desde la raíz, comprobar primero el inventario:

```bash
npm run check:ciqual:images
```

Si falla por una carpeta sin manifiesto que corresponde a una tanda interrumpida,
recuperar primero su plan y recibos. No borrar las salidas ni interpretar que sus
alimentos vuelven a necesitar una generación desde cero.

El listado CLI `npm run next:ciqual:images -- 50` admite de 1 a 50 alimentos.
Es de solo lectura: ejecutarlo dos veces no avanza una página. Para seleccionar
100, usar la función del validador, sin cambiar ese límite ni llamar a proveedores:

```bash
node --input-type=module -e 'import {checkCiqualImageBatches} from "./scripts/catalogs/ciqual-image-batches.mjs"; const r=await checkCiqualImageBatches(process.cwd()); console.log(JSON.stringify({generated:r.generated,total:r.total,foods:r.pending.slice(0,100).map(({id,names})=>({id,names}))},null,2));'
```

Se puede elegir otro grupo de 100 pendientes más coherente visualmente, pero
todos sus IDs deben estar en `pending` y aparecer una sola vez. Leer los nombres
completos antes de definir las descripciones; no generar solo a partir del ID.
Si una salida JSON está recortada, pedir menos datos; no intentar interpretarla
como completa. Acumular todos los fragmentos de un comando antes de parsearlos.

1. Determinar el siguiente número de carpeta disponible. Si hay una tanda
   incompleta, reanudarla antes de crear otra; no borrar sus imágenes ni repetirlas.
2. Guardar un plan JSON con los 100 IDs, nombres, descripción, prompt completo y
   referencia. Conservar una ruta de checkpoint identificable durante el trabajo.
3. Tras cada generación, registrar el ID, prompt y ruta del PNG antes de convertirlo.
   Así se puede recuperar una salida ya generada sin pedirla de nuevo al modelo.
4. Copiar o convertir la salida de Codex a
   `alimentos/ciqual/image-batches/NNNN/ciqual-ID.webp`, dejando el PNG original
   en su ubicación. Normalizar con Sharp a WebP real opaco de 1024×1024,
   calidad 90. La conversión mecánica no sustituye una corrección con el generador.
5. Registrar el SHA-256 del archivo final y comprobarlo contra los bytes reales.
6. Crear `manifest.json` siguiendo el contrato de la tanda 0028:
   `schema_version: 1`, `dataset_id: "anses-ciqual-2025"`, `batch_id`,
   `status: "pending-review"`, fecha real `generated_on`, generador y atribución.
   Cada entrada de `images` lleva `id`, `names` FR/EN/ES exactos,
   `source_sha256`, `image`, `sha256`, `prompt` exacto y `reference_image`.
7. Calcular `source_sha256` con `ciqualNameFingerprint(names)` de
   `scripts/catalogs/ciqual-translations.mjs`; es la huella de FR/EN, no la del WebP.
   Añadir los 100 enlaces al índice de tandas.

Cada carpeta numerada solo puede contener sus WebP y el manifiesto. Guardar
planes, recibos, hojas de contacto y notas de revisión fuera de ella. No colocar
este documento ni otros Markdown dentro de `image-batches/`: el validador solo
admite allí `README.md` y carpetas numéricas.

No modificar fichas oficiales, agregados, nutrientes, traducciones,
`FOOD_PROMPTS` del generador legado ni código móvil. No reutilizar una imagen
para distintas variantes. Las ilustraciones son de Gymnasia y deben atribuirse
como «no proporcionadas ni validadas por ANSES».

## Revisión de las cien imágenes

Revisar visualmente **todos los WebP finales**, no solo los prompts o unos ejemplos.
Para no repetir el consumo de memoria del chat anterior, usar hojas de contacto
de unas 12 miniaturas, revisadas por páginas, y abrir a tamaño completo solo los
casos dudosos. No volcar base64 ni cargar los 100 originales juntos en el chat.
Guardar las hojas fuera de la carpeta de la tanda.

Comprobar alimento y preparación, relleno correcto, ausencia de ingredientes
extra, texto o marcas, encuadre completo, estilo y fondo. Ejemplos de la revisión
ya realizada: cono sin helado; barquillo hueco sin crema; galleta de una capa sin
relleno; gambas grises y queso sin fundir en un gratén crudo frente a gambas rosas
y costra dorada en el cocinado. No dar por correcto un resultado solo porque el
prompt lo pidió.

Si falla una imagen nueva provisional, regenerar solo ese ID con una corrección
concreta, conservar el prompt original y el motivo de la revisión, inspeccionar
la nueva salida y actualizar su prompt y hash. No sobrescribir imágenes de
tandas anteriores ni declarar que el mantenedor ha aprobado la tanda por haber
hecho nuestra propia revisión.

Antes de subir, ejecutar y comprobar la salida y el código de retorno de todos:

```bash
npm run check:ciqual:images
npm run test:catalogs
npm run check:catalogs
npm run check:ciqual
npm run check:ciqual:mobile
git diff --check
```

## Git y publicación de la tanda

Conservar `codex/ciqual-food-image-samples`, sin push directo a `main`, resets
destructivos, borrado de rama ni incorporación de cambios ajenos. Hay archivos
no rastreados del mantenedor: no añadirlos con `git add .` ni eliminarlos.

Al empezar un «más», localizar la PR por la rama, no por un número antiguo:

```bash
git status --short
git branch --show-current
gh pr list --repo maximofn/gymnasia --head codex/ciqual-food-image-samples --state open
gh pr view NUMERO --repo maximofn/gymnasia --json state,headRefOid,mergeStateStatus,statusCheckRollup,changedFiles
gh pr diff NUMERO --repo maximofn/gymnasia --name-only
```

Revisar el alcance completo y todos los checks del SHA actual. Para una PR de
imágenes autorizada y lista, fusionar sin borrar la rama, protegiendo el head
con `--match-head-commit`; después actualizar la rama local:

```bash
gh pr merge NUMERO --repo maximofn/gymnasia --merge --match-head-commit SHA_COMPROBADO
git fetch origin main
git merge --ff-only origin/main
```

Sustituir los marcadores por valores recién consultados. Si la rama no es la
correcta, hay cambios superpuestos o no puede avanzar de forma segura, resolverlo
sin forzar ni perder trabajo. No usar `--admin` o `--auto` para eludir la revisión.

Al terminar la generación, añadir únicamente la nueva carpeta, el índice y
este relevo si se actualiza su estado. Una tanda pura suele sumar 102 archivos;
puede incluir además documentación, como la PR 424. No usar ese número como
sustituto de revisar las rutas.

Crear un commit `feat(foods): añadir ... imágenes CIQUAL`, subir la misma rama y
abrir una PR contra `main`. Su descripción debe incluir alimentos, rutas,
validaciones, limitaciones de las ilustraciones y vistas previas revisables.
Verificar el head publicado y dejarla abierta. Los nuevos checks pueden seguir
en curso: distinguirlos de las validaciones locales ya terminadas.

No integrar en la app ni lanzar builds como parte de este flujo. Si una PR
incluyera `apps/mobile/**`, instrucciones del agente o política sanitaria,
aplicar las aprobaciones específicas de `AGENTS.md`; «más» solo autoriza este
trabajo de imágenes y documentación.

## Información que se muestra al mantenedor

Durante el trabajo, comunicar en español y con brevedad la fusión anterior,
inicio de generación, avances reales, revisión visual, correcciones y pruebas.
Dar actualizaciones periódicas, aproximadamente cada minuto durante actividad
prolongada, sin repetir mensajes vacíos. Avisar de bloqueos comprobados; no
presentar una tanda parcial como si hubiera terminado.

En la respuesta final incluir siempre:

- PR anterior fusionada y enlace de la nueva PR abierta.
- Número de imágenes nuevas generadas y revisadas, y modo integrado de Codex.
- **Generadas / total, pendientes y porcentaje con dos decimales**.
- Resultado real de las validaciones y estado observado de CI.
- Rutas de las imágenes y del manifiesto con los prompts; aclarar que todavía
  no hay integración móvil.

Calcular el porcentaje con `100 * generated / total` y pendientes con
`total - generated`, usando el validador, no una suma supuesta. Actualizar el
estado de referencia de este relevo al cerrar cada tanda para permitir otro
cambio de chat sin depender de una conversación larga.

## Mensaje para iniciar el chat nuevo

```text
Trabaja en /Users/macm1/Documents/proyectos/gymnasia y lee primero
docs/ciqual-food-images-handoff.md y las instrucciones del repositorio.
Prepara el contexto sin cargar el historial anterior ni todas sus imágenes,
y espera mi siguiente instrucción.

La generación CIQUAL está completa: 3.484/3.484 imágenes, cero pendientes.
La última PR conocida es la 451; consulta su estado y SHA actuales. El relevo
explica el cierre pendiente y cómo actualizar la rama si está detrás de main.
Una orden «más» permite cerrar esa PR si cumple los controles, pero con cero
pendientes no debe generar otra tanda. La integración móvil requiere una
petición independiente.
```
