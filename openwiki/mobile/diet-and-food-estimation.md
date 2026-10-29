---
type: concepto
title: Dieta, catálogo y estimación de alimentos
description: Modelo local de comidas y objetivos nutricionales, vinculación explícita con catálogos y alimentos personales, y flujo opcional de estimación asistida por IA. Distingue la nutrición validada que se persiste de datos externos o estimados que requieren confirmación y validación.
tags: [mobile, diet, nutrition, food-estimation, catalogs, agent]
sources:
  - id: openwiki-source-ece1e91de1b7e96cadcc5bc8
    resource: repo://apps/mobile/agent/foodEstimatorClient.ts
  - id: openwiki-source-165cffcff462003cd11223e2
    resource: repo://apps/mobile/agent/toolExecutor.test.ts
  - id: openwiki-source-d3be928c369037f29888bc0b
    resource: repo://apps/mobile/agent/toolExecutor.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
  - id: openwiki-source-e27e377601d302f6e6c215eb
    resource: repo://apps/mobile/catalogs/foodNutrition.ts
  - id: openwiki-source-f11c40fb577c7d51e488b6f0
    resource: repo://apps/mobile/catalogs/matching.test.ts
  - id: openwiki-source-dea65c4d04c08cc781bd2cda
    resource: repo://apps/mobile/catalogs/matching.ts
  - id: openwiki-source-38c56531000e6ccc59045ff7
    resource: repo://apps/mobile/catalogs/sources.ts
  - id: openwiki-source-36ac1d1b6a1d97f5db056148
    resource: repo://apps/mobile/catalogs/types.ts
  - id: openwiki-source-0ae61ab8a9a5048a481b1eec
    resource: repo://apps/mobile/controllers/dietController.ts
  - id: openwiki-source-7a63325ebd6d3e0cfa0b1634
    resource: repo://apps/mobile/diet/catalogModel.ts
  - id: openwiki-source-4c5cae27066d6fd43802bf46
    resource: repo://apps/mobile/diet/dailyCaloriesCalculation.test.ts
  - id: openwiki-source-22ae7a6aeeb87295a2a85546
    resource: repo://apps/mobile/diet/dailyCaloriesCalculation.ts
  - id: openwiki-source-8bc8bac1938308df7241b2fd
    resource: repo://apps/mobile/diet/model.ts
  - id: openwiki-source-baabb5f135bf207cf1cd88cf
    resource: repo://apps/mobile/diet/nutritionContract.test.ts
  - id: openwiki-source-8aba0bf9311cc293c41365a3
    resource: repo://apps/mobile/diet/nutritionContract.ts
  - id: openwiki-source-c9f6603922c4b3374dc5d61a
    resource: repo://apps/mobile/scripts/diet-validation.e2e.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
generated: { by: "openwiki/0.6.0", at: "2026-10-29T14:43:04.676Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-29T14:43:04.676Z
---

# Dieta, catálogo y estimación de alimentos

La dieta es un registro local por fecha. Cada elemento guardado contiene una **instantánea de los totales de su porción** —gramos, kcal, proteínas, carbohidratos y grasas— y puede conservar un `catalog_link` que indica si proviene de un catálogo concreto o por qué no se pudo resolver. Esto separa el historial durable de los datos de catálogo, que pueden actualizarse, quedar obsoletos o no estar disponibles. La interfaz de dieta, el estimador y la tool del agente comparten el contrato de validación de `apps/mobile/diet/nutritionContract.ts`.

La IA y OpenFoodFacts son fuentes de ayuda, no fuentes de verdad persistidas: la conversación puede producir una estimación y el código de barras puede aportar datos externos, pero antes de escribir se extrae una estructura, se valida y, si hay coincidencia de catálogo, se prefiere la instantánea calculada desde este. El registro puede seguir utilizándose sin proveedor de IA y con catálogos remotos no disponibles mediante entrada manual.

Véanse [Estado local y copia de seguridad](local-state-and-backup.md) para el almacenamiento e importación; [Catálogos nutricionales y de ejercicios](../content/repositories.md) para la publicación, caché y disponibilidad de catálogos; y [Runtime del agente y herramientas](../agent/runtime.md) y [Configuración BYOK de proveedores](../agent/provider-configuration.md) para el agente y las credenciales.

## Modelo persistido y contrato nutricional

`DietItem` vive dentro de `LocalStore.dietByDate`. Un `DietDay` se indexa por fecha y contiene comidas; una comida agrupa sus `items`. Los nutrientes de `FoodCatalogEntry` se expresan por 100 g, mientras que los de `DietItem` son los totales ya escalados de la cantidad registrada. Esta diferencia de unidades es el invariante principal al añadir nuevos nutrientes o nuevas rutas de escritura.

| Entidad | Campos relevantes | Papel |
| --- | --- | --- |
| `DietItem` | `id`, `title`, `grams`, `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`, `image_uri?`, `catalog_link?` | Instantánea durable de una porción y, opcionalmente, su vínculo de procedencia. |
| `DietMeal` | `id`, `title`, `items` | Agrupa alimentos de una categoría. |
| `DietDay` | `day_date`, `meals` | Registro de un día dentro de `dietByDate`. |
| `FoodCatalogEntry` | ID, nombre, origen, nutrientes por 100 g, porción e imagen opcional | Plantilla remota o personal que permite calcular una porción. |
| `CatalogLink` | `linked` con `{schemaVersion, sourceId, itemId}` o `unresolved` con motivo | Mantiene una referencia versionada o explica que el elemento es manual, estimado externamente, ambiguo o no encontrado. |

Las categorías admitidas son, en orden: `Desayuno`, `Almuerzo`, `Comida`, `Merienda` y `Cena`. `resolveDietMealCategory` normaliza espacios y mayúsculas para resolverlas, pero rechaza una categoría arbitraria. La interfaz muestra y ordena según ese conjunto; la tool del agente también lo exige.

```mermaid
erDiagram
    DIET_DAY ||--o{ DIET_MEAL : contiene
    DIET_MEAL ||--o{ DIET_ITEM : contiene
    FOOD_CATALOG_ENTRY ||--o{ DIET_ITEM : origina_instantanea

    DIET_DAY {
        string day_date
    }
    DIET_MEAL {
        string id
        string title
    }
    DIET_ITEM {
        string id
        string title
        number grams
        number calories_kcal
        number protein_g
        number carbs_g
        number fat_g
        string catalog_link
    }
    FOOD_CATALOG_ENTRY {
        string sourceId
        string id
        string name
        number calories_per_100g
    }
```

*El catálogo aporta valores por 100 g; el elemento de dieta conserva los totales de la porción y una referencia opcional, no una dependencia activa del catálogo.*

### Validación en la frontera de escritura

`validateNutritionItem` requiere un objeto con nombre no vacío y los cinco números como valores de tipo `number`, finitos y no negativos. Por tanto, se permite registrar agua o cualquier entrada completamente a cero; no se aceptan números negativos, `NaN`, infinitos ni cadenas numéricas en esta frontera. `validateNutritionFormInput` es la adaptación de formulario: acepta texto, convierte coma decimal y campos vacíos a cero, y después aplica los mismos límites. `validateStructuredNutrition` reutiliza esa validación y exige además `food_type` igual a `alimento`, `producto_comercial` o `receta`.

Al hidratar almacenamiento previo, `normalizeDietByDate` recupera la clave de fecha cuando falta `day_date`, crea identificadores ausentes, aplica títulos de reserva, redondea los valores numéricos válidos a un decimal y convierte valores inválidos o negativos en cero. También normaliza `image_uri` y `catalog_link`; no convierte por sí sola una fecha a un formato canónico ni elimina duplicados de comidas.

## Catálogos, búsqueda y alimentos personales

Los catálogos remotos de alimentos, productos comerciales y recetas se cargan como fuentes distintas y quedan etiquetados respectivamente con `gymnasia_foods`, `gymnasia_products` y `gymnasia_recipes`. Cada entrada incluye `sourceId` y el origen visible `alimento`, `producto_comercial` o `receta`. Los alimentos personales son una cuarta fuente privada, `user_personal_foods`, normalizada con `source: "personal"`; se guardan bajo una clave AsyncStorage propia y no tienen URL de catálogo ni imagen remota.

`findDietFoodInCatalog` combina el catálogo y los alimentos personales **solo después de descartar fichas sin kcal, proteína, carbohidratos o grasa exactos por 100 g**. El matcher normaliza Unicode, diacríticos, espacios y mayúsculas; busca primero nombres equivalentes y después una inclusión bidireccional como alias. Ordena los candidatos por origen e ID, por lo que una duplicidad no depende del orden recibido. Una coincidencia única exacta o alias se puede vincular; varias candidatas abren una resolución explícita y nunca se elige una de forma implícita.

La completitud exige que los cuatro nutrientes sean números finitos no negativos; `null`, trazas y límites cualitativos no equivalen a cero. `dietItemFromCatalog` vuelve a comprobar esa precondición antes de calcular `ratio = grams / 100`, escalar kcal y macronutrientes, redondear a un decimal y escribir un vínculo `linked`. La interfaz no permite guardar una ficha incompleta como instantánea de catálogo: abre el formulario con los datos disponibles y exige introducir explícitamente los cinco totales (cantidad incluida), para no convertir un dato ausente en cero. Una entrada personal completa también puede vincularse, aunque no aporta imagen remota. Una coincidencia ausente se conserva como `unresolvedCatalog("manual")` o `unresolvedCatalog("external_estimate")` según su ruta.

La disponibilidad del catálogo acompaña las búsquedas del agente como `fresh`, `cached`, `stale`, `partial` o `unavailable`, con fuentes y avisos. Una caída de red no borra una caché previamente validada; si no hay datos utilizables, la búsqueda devuelve disponibilidad no disponible y una lista vacía. La interfaz todavía permite guardar manualmente una entrada validada y marcada como no resuelta. No debe inventarse un enlace cuando no se dispone de una referencia o la coincidencia es ambigua.

## Alta y edición de una comida

La pantalla permite formulario manual, selección desde el catálogo y estimación opcional. Las tres rutas convergen en `persistItem` dentro de `useDietRuntime`: crea el día o la comida si hace falta, reemplaza el elemento al editar conservando su ID y ordena las comidas por categoría. Borrar el último elemento elimina la comida, aunque puede quedar el día vacío. Copiar una comida desde otra fecha clona los elementos con IDs nuevos y los añade a la categoría de destino; no reemplaza sus elementos existentes.

```mermaid
flowchart TD
    Start["Usuario abre una categoría"] --> Route{"Origen"}
    Route --> Catalog["Selecciona ficha de catálogo"]
    Route --> Manual["Introduce totales manuales"]
    Route --> Estimate["Describe o fotografía"]
    Catalog --> Complete{"Nutrición completa"}
    Complete -->|"sí"| Snapshot["Escalar por gramos y vincular"]
    Complete -->|"no"| CompleteForm["Completar totales explícitos"]
    Manual --> FormValid{"Formulario válido"}
    CompleteForm --> FormValid
    Estimate --> Extract["Extraer JSON nutricional"]
    Extract --> EstimateValid{"Estructura válida"}
    EstimateValid -->|"no"| Correct["No persistir y pedir corrección"]
    EstimateValid -->|"sí"| Match["Buscar fichas completas"]
    FormValid -->|"no"| Correct
    FormValid -->|"sí"| Match
    Match --> Resolution{"Resultado"}
    Resolution -->|"exacto"| Snapshot
    Resolution -->|"alias o ambiguo"| Choose["Elegir ficha o conservar manual"]
    Resolution -->|"ausente"| Unresolved["Conservar totales no resueltos"]
    Choose --> Snapshot
    Choose --> Unresolved
    Snapshot --> FinalValid{"Totales válidos"}
    Unresolved --> FinalValid
    FinalValid -->|"no"| Correct
    FinalValid -->|"sí"| Persist["Persistir DietItem y catalog_link"]
```

*Flujo de resolución y persistencia de `useDietRuntime`: una ficha incompleta nunca se escala ni se vincula; la resolución manual o asistida solo llega al almacén tras validar los totales.*

En el formulario, una coincidencia exacta reemplaza los totales escritos por los valores escalados del catálogo. Un alias único o varias candidatas muestran un modal: elegir una candidata crea la instantánea vinculada; conservar el valor manual mantiene el vínculo no resuelto. Cuando no hay resultado, la interfaz propone una incidencia de contenido para revisión, pero la propuesta se encola localmente y no sale a la red hasta que la persona usuaria la confirma mediante el mecanismo de feedback.

Al editar cantidad de un elemento existente, `mealPerGramRef` guarda temporalmente sus totales por gramo para reescalar los campos en la interfaz. No es una regla de persistencia ni una consulta al catálogo: se reinicia al cerrar o cambiar el editor. Si se modifica el nombre manualmente, la ruta de formulario construye el elemento final de nuevo y su vínculo describe el resultado de la nueva resolución.

## Objetivos nutricionales

`DietSettings` conserva texto editable para objetivo, actividad, sexo, altura, fecha de nacimiento, calorías diarias y dos modos de macros. El cálculo de «Calcular» es local: `calculateDailyCalories` aplica Mifflin-St Jeor al peso, altura, edad derivada de la fecha de nacimiento y sexo, y después los multiplicadores de actividad y objetivo. Si faltan peso, altura o fecha, devuelve un mensaje para la pantalla en lugar de un número; sexo y actividad ausentes toman los valores moderado y masculino. El resultado solo rellena el campo editable: sigue sujeto a la validación y guardado del plan.

- `manual_calories` asigna kcal por macro y deriva gramos con 4 kcal/g para proteínas y carbohidratos y 9 kcal/g para grasa.
- `protein_by_weight` multiplica los gramos por kg configurados por el peso corporal actual cuando existe y es positivo.

`evaluateDietPlan` valida que el objetivo calórico, si se configura, sea positivo y que las asignaciones sean finitas y no negativas. Informa tanto `remainingCalories` como `excessCalories`: el remanente se limita a cero cuando hay exceso y el estado es `exceeded`, evitando presentar un remanente negativo como si fuera una meta alcanzable. Sin peso válido, el modo por peso no fabrica gramos ni calorías.

## Estimación asistida por IA y código de barras

El modal del estimador es una conversación distinta del agente general. Requiere una API key utilizable: prioriza `store.foodAIProvider` si está configurado, después el proveedor ya elegido por el modal y, finalmente, la prioridad del estimador. Si no existe proveedor, muestra un error y no intenta la red. Las credenciales BYOK y las particularidades de transporte se documentan en [Configuración BYOK de proveedores](../agent/provider-configuration.md).

Se pueden adjuntar hasta seis imágenes desde biblioteca o cámara; la aplicación solicita el permiso correspondiente y necesita base64 para adjuntarlas. Cada petición usa solo las imágenes aún no enviadas y estas se marcan como enviadas únicamente después de una respuesta válida. El cliente incluye el último mensaje de usuario con las imágenes para los proveedores que las admiten. Si el proveedor rechaza explícitamente imágenes, el borrador de mensaje se retira, el texto se conserva y el modal dirige a elegir un modelo compatible; el error no se oculta ni se convierte en una comida.

Antes de enviar la estimación, se adquiere la política de seguridad de salud y se clasifica la entrada. Una evaluación adicional con el proveedor solo se solicita si existe consentimiento para ella; si el riesgo es bloqueante, el modal añade una intervención de seguridad local y no inicia la llamada de estimación. Las respuestas se someten también al filtro de streaming. Este límite de consentimiento es independiente del permiso del sistema para cámara o galería.

```mermaid
sequenceDiagram
    participant User as Persona usuaria
    participant Modal as Modal estimador
    participant Policy as Política de salud
    participant Provider as Proveedor BYOK
    participant Barcode as OpenFoodFacts
    participant Store as Dieta local

    User->>Modal: texto y fotos autorizadas
    Modal->>Policy: clasificar entrada
    alt riesgo bloqueante
        Policy-->>Modal: intervención local
        Modal-->>User: aviso visible
    else estimación permitida
        Modal->>Provider: conversación e imágenes nuevas
        opt scan_barcode solicitado
            Provider->>Barcode: consultar código
            Barcode-->>Provider: producto o texto de fallo
        end
        Provider-->>Modal: respuesta de estimación
        User->>Modal: guardar
        Modal->>Provider: extracción estructurada
        Modal->>Store: validar, resolver catálogo y persistir
    end
```

*El proveedor y OpenFoodFacts reciben datos solo dentro de una estimación permitida; ninguna de sus respuestas escribe directamente en la dieta.*

OpenAI, Anthropic y Google pueden ejecutar hasta cinco rondas de `scan_barcode`; el proveedor `custom_openai` intenta usar tools y, si su servidor no las admite, continúa sin lectura de códigos y muestra un aviso. `scan_barcode` elimina espacios del código y consulta `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`. Devuelve al modelo un JSON con identidad, porción, nutrientes por 100 g y por porción, ingredientes y Nutri-Score. Un HTTP fallido, un producto inexistente o una llamada sin código se devuelven como texto controlado para que el modelo pueda continuar o estimar visualmente; no escriben esos datos directamente en la dieta. La sesión recuerda si se usó la herramienta para clasificar una propuesta no encontrada como producto comercial, pero ese indicador no es procedencia persistida.

Las solicitudes de conversación se reintentan hasta tres veces únicamente ante fallos transitorios identificados. Un fallo definitivo se representa como mensaje `technical_error` visible en la conversación. Esto preserva el borrador y evita presentar una respuesta incompleta como estimación apta para guardar.

Al pulsar guardar, `requestStructuredNutritionJSON` hace una segunda solicitud para obtener `dish_name`, gramos, kcal, los tres macros y `food_type`. OpenAI usa un esquema JSON estricto, Anthropic fuerza la tool `extract_nutrition` y Google solicita JSON con el mismo schema sin `additionalProperties`. El resultado pasa por `validateStructuredNutrition`; ante un tipo, nombre o número inválido se informa el error, no se persiste nada y la persona puede corregir la conversación. Después se aplica la misma resolución explícita de catálogo que al usar el formulario.

La salida final tiene dos posibilidades claramente distintas:

- **Dato validado y vinculado:** un catálogo exacto o elegido aporta totales recalculados y `catalog_link.status: "linked"`.
- **Estimación validada pero no verificable por catálogo:** se guardan los totales validados producidos por la extracción con `catalog_link.status: "unresolved"` y razón `external_estimate`. No equivale a una medición confirmada de un catálogo.

Si no se encuentra un producto comercial o receta estimado, se crea una propuesta de feedback para confirmación del usuario. La indisponibilidad del proveedor, el fallo de OpenFoodFacts o una respuesta estructurada inválida no bloquean la entrada manual; simplemente impiden usar esa estimación hasta una corrección válida.

## Agente general: lectura, búsqueda y escritura

El runtime del agente expone `search_foods`, `read_meal_foods` y `add_meal_food`. `search_foods` filtra el repositorio combinado por nombre, categoría, origen o rango nutricional, ordena opcionalmente y limita los resultados a 15; devuelve además disponibilidad, avisos y las referencias `source_id`/`item_id`. Así el modelo puede pedir una selección explícita en vez de inferir qué duplicado elegir.

`add_meal_food` acepta una forma `kind: "catalog"` con referencia e `grams`: busca exactamente esa referencia disponible, pero rechaza la ficha si no tiene kcal y los tres macronutrientes exactos; solo entonces calcula una instantánea por 100 g y prepara un vínculo `linked` con `linkedBy: "tool"`. La forma manual prepara un vínculo no resuelto. La forma heredada basada en nombre busca únicamente entre fichas completas y se vincula solo ante coincidencia exacta o alias única; si es ambigua devuelve candidatas y `written: false`, sin escribir. **Todas** las formas pasan por `validateNutritionItem` antes de crear o modificar el día. La mutación exige `commitStore`; si este falla, se informa un resultado indeterminado en lugar de afirmar que se guardó. Solo después del `commit` se marca el efecto comprometido y se registra el recibo de operación para mantener la idempotencia del runtime.

## Persistencia, procedencia y cambios seguros

Los días y ajustes viven en el almacén principal; los alimentos personales son una partición AsyncStorage independiente. La exportación e importación incluyen los alimentos personales como datos separados del backup, mientras que las credenciales de proveedores no forman parte de él. Consulte [Estado local y copia de seguridad](local-state-and-backup.md) para las garantías y límites de esa operación.

Un `DietItem` conserva los totales históricos y, cuando se conoce, una referencia de catálogo versionada. No conserva la conversación del estimador, imagen original, respuesta cruda de OpenFoodFacts, modelo/proveedor, nivel de confianza ni supuestos de la estimación. Por ello, una entrada `external_estimate` no permite auditar ni recalcular la estimación original después de guardarse. Una extensión que necesite auditoría debe añadir metadatos explícitos y hacer que `normalizeDietByDate`, las copias, constructores, ediciones y herramientas los conserven.

Para añadir un nutriente, actualice conjuntamente el contrato nutricional, `DietItem`, el escalado de `dietItemFromCatalog`, los agregados y la interfaz, el schema del estimador y las tools. Decida siempre si el campo es por 100 g en catálogo o total de porción en dieta. Para añadir una fuente, registre su `sourceId`, parser, caché, procedencia y resolución de imagen; no trate un catálogo remoto como autoridad disponible permanentemente.

## Pruebas focalizadas

`apps/mobile/diet/nutritionContract.test.ts` cubre categorías, conversión de formulario, validación de valores no negativos y finitos, salida estructurada, presupuestos de macros y una propiedad de 1.000 ejecuciones. `apps/mobile/catalogs/matching.test.ts` verifica normalización, estabilidad de ambiguos y alias. `apps/mobile/agent/toolExecutor.test.ts` cubre búsqueda con metadatos de disponibilidad, escritura por referencia, rechazo de fichas nutricionalmente incompletas y de ambigüedad, categorías inválidas y nutrientes inválidos. `apps/mobile/agent/foodEstimatorClient.test.ts` cubre el modo determinista sin red, la tool sin código y la validación de la extracción estructurada.

La prueba de navegador `apps/mobile/scripts/diet-validation.e2e.mjs` exporta la app web, siembra un almacenamiento de desarrollo y comprueba el ciclo del plan: el aviso de cálculo sin datos se descarta al navegar, un peso inválido no se guarda, peso y altura válidos completan la medición existente del día y sobreviven a una recarga. También verifica que un objetivo diario cero no se persiste, que un exceso de macros se representa sin remanente negativo, que una caloría manual negativa no escribe y que una entrada válida a cero sí se guarda. Desde la raíz se ejecuta con:

```bash
npm run test:diet:e2e
```

Al cambiar el flujo de selección o la caché, añada además casos de catálogo ausente, coincidencia alias única, duplicados entre fuentes, elección de conservar manual, alimento personal y estimación estructurada inválida. Estos casos protegen la distinción esencial entre datos validados persistidos y resultados externos que solo asisten a la decisión.
