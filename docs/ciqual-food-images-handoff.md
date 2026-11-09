# Continuar la generación de imágenes de alimentos CIQUAL

Este es el punto de entrada para continuar en un chat nuevo sin recuperar el
historial ni sus imágenes. El trabajo consiste en generar ilustraciones de los
3.484 alimentos ANSES-CIQUAL de Gymnasia, con el estilo ya aprobado, en tandas
de 100 y con una PR por tanda. Las imágenes todavía no están integradas en la app.

## Qué significa más

El mantenedor ha autorizado este flujo cuando envíe **«más»** como orden de
continuación. Aceptar también «mas» y diferencias de mayúsculas:

1. Consultar la PR anterior de la rama de imágenes y sus checks actuales.
2. Si está abierta y todos los checks requeridos están correctos, fusionarla.
   No pedir otra confirmación rutinaria para esa tanda de imágenes ya autorizada.
3. Actualizar la misma rama y generar **100 imágenes nuevas**, una por alimento
   pendiente, con el mismo estilo. No son 100 variantes de una misma imagen.
4. Revisar las 100, corregir las que fallen, validar, crear un commit, subirlo
   y abrir la siguiente PR contra `main`, en la misma rama.
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

Estado comprobado el **8 de noviembre de 2026**, incluyendo la última tanda
generada aunque su PR siga abierta. Volver a consultar GitHub y los manifiestos
al empezar; este bloque no sustituye al estado real.

| Dato | Valor |
| --- | --- |
| Repositorio local | `/Users/macm1/Documents/proyectos/gymnasia` |
| GitHub | `maximofn/gymnasia` |
| Rama que se conserva | `codex/ciqual-food-image-samples` |
| Imágenes registradas | 1.603 de 3.484 |
| Porcentaje | 46,01 % |
| Pendientes | 1.881 |
| Última tanda | `0034`, con 100 imágenes revisadas |
| PR anterior fusionada | [PR 429](https://github.com/maximofn/gymnasia/pull/429) |
| PR abierta para la siguiente fusión | [PR 431](https://github.com/maximofn/gymnasia/pull/431) |
| Commit de las imágenes de esa PR | `8da3ac34c1f6777106ba1395a1ae6ab7fba1685f` |
| Siguiente tanda si no hay trabajo posterior | `0035` |

La PR 429 se actualizó con los cambios de `main` ya fusionados y pasó todos los
checks de su nuevo commit antes de fusionarse el 8 de noviembre de 2026. La rama
se sincronizó con `main` antes de generar la siguiente tanda. La PR 431 conserva
la tanda 0034 y este relevo; queda abierta para la siguiente revisión o «más».
Consultar los checks de su SHA actual: las validaciones locales terminadas no
sustituyen a CI.

La tanda 0034 pasó los 33 tests del catálogo, `check:ciqual:images`,
`check:catalogs`, `check:ciqual`, `check:ciqual:mobile` y `git diff --check`.
Sus 100 WebP finales se revisaron en nueve hojas de contacto. Se regeneró
`ciqual-28472` porque conservaba una capa de grasa exterior; la salida final
muestra piezas magras, deshuesadas y sin corteza para picar, revisadas a tamaño
completo. Incluye pescados y conservas, ensaladas, ñoquis para cocinar, tartas
saladas, pizzas y cortes de cerdo crudos y cocinados. En `ciqual-27017` se siguió
FR/ES para filetes crudos de panga/pez gato ante el inglés discrepante, sin
alterar nombres fuente. Las preparaciones genéricas son ilustrativas.

Siguen pendientes `ciqual-25164`, cuyo francés y español mezclan ternera y cerdo,
y `ciqual-26241`, cuyo francés dice Empereur mientras EN/ES se refieren a tiburón
azul. Se apartaron sin modificar las fichas oficiales ni inventar una especie.
Las imágenes todavía no están integradas en móvil.

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
- [Manifiesto de la última tanda](../alimentos/ciqual/image-batches/0034/manifest.json),
  que conserva los prompts exactos de los últimos 100 alimentos.

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
Continúa la generación de imágenes CIQUAL de Gymnasia. Lee primero
docs/ciqual-food-images-handoff.md y las instrucciones del repositorio.
Respeta el estilo aprobado y el flujo documentado. Cuando diga «más», fusiona
la PR anterior si está lista, genera otras 100 imágenes, revisa todas, abre
la siguiente PR en la misma rama e informa de generadas, total, pendientes,
porcentaje, validaciones y enlaces. No integres nada en la app.
```
