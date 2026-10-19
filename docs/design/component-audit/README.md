# Inventario visual y componentes de Gymnasia

Trabajo de GYM-8 (ticket para unificar componentes repetidos de la interfaz).
La [galería](index.html) muestra cada captura original a la izquierda y la misma
imagen con los componentes elegidos señalados a la derecha. Permite buscar
pantallas o componentes, filtrar por área y ampliar la pareja. Las marcas
numeradas y su leyenda se destacan al pulsarlas; cada componente enlaza con su
fichero de implementación. «Extraído» identifica la biblioteca creada y
«Existente», las piezas que se conservan. [inventory.json](inventory.json) conserva el
inventario y su procedencia; las hojas `contact-*.jpg` sirven para una revisión
rápida sin abrir la galería.

## Recorrido y alcance

Se navegó por <https://gymnasia.maximofn.com/> el 19 de octubre de 2026, versión
publicada 1.52.1, con emulación móvil de DevTools a 390 × 844 píxeles. Son capturas
del producto real, no recreaciones. El generador verifica las dimensiones de cada
imagen y que todas estén incluidas exactamente una vez en el inventario.

El recorrido cubre Inicio, Rutinas (lista, detalle, editor, catálogo, formulario
personalizado, selector de series, sesión, descanso, confirmación, resumen e
historial), Dieta (vacío, búsqueda, cantidad, registro manual, comida con datos,
menú, fechas y estimador), Medidas (estadísticas, gráfica, selector, formulario y
fecha), Coach (inicio, envío, respuesta real y denuncia), las doce secciones de
Configuración, copia cifrada, confirmación de borrado, fichas de catálogo y el
asistente de alimentos personales.

La sesión web contenía datos desechables de QA. Se guardaron dos sesiones parciales
y una manzana de 180 g para observar estados con contenido y su persistencia. En
Coach se pidió proponer un peso de prueba; no se confirmó su escritura. No se
leyeron claves ni se enviaron denuncias. No se alteraron los datos de un móvil.

Los datos pueden generar combinaciones ilimitadas: el alcance es compartir las
familias visuales repetidas y sus variantes, no generar una imagen de cada posible
valor. Las anotaciones señalan ejemplos visibles, no todos los usos de cada
componente. Las coordenadas se revisaron sobre las capturas conservadas y se
guardan como `[x, y, ancho, alto]` en píxeles del original. La imagen de la derecha
usa una copia del original con marcas HTML superpuestas; no modifica la captura.
Los nombres y enlaces se contrastan con el código actual. Algunas capturas
conservan un estado intermedio de una transición; solo se marca lo que aparece
visible, aunque el nombre de la vista aluda al flujo que se estaba recorriendo.

## Biblioteca implementada

Los componentes viven en `apps/mobile/components/`, clasificados en la capa de
presentación `ui`. Las pantallas conservan sus modelos y controladores.

| Familia | Componentes | Usos |
| --- | --- | --- |
| Acciones | `Button` | Inicio, Coach, estimador, formularios, confirmaciones y entrenamiento; variantes primaria, secundaria, contorno, discreta y destructiva |
| Formularios | `TextField`, `SearchField`, `NumberStepper` | Medidas, fechas, chats, catálogos y planificación de macros |
| Selección | `ChoiceChip`, `ChoiceRow`, `OptionChips`, `ToggleField` | Opciones de dieta, músculos, equipo, dificultad y notificaciones |
| Estadísticas | `StatCard`, `ChartCard`, `ProgressBar` | Inicio y Medidas; gráficas de Medidas/Rutinas; sesión, descanso y minibarra |
| Diálogos | `DialogLayer`, `DialogCard` | Confirmaciones y superposiciones de Rutinas, Dieta, Medidas, Configuración y catálogo |
| Alimentos | `FoodThumbnail`, `DietItemThumbnail`, `FoodCatalogRow`, `FoodCatalogDetail` | Dieta, copia de comidas, ambigüedad y catálogos de ajustes |

Los tamaños, colores, bordes y variantes existentes se conservan mediante props
tipadas y estilos de cada uso. Se contrastan con `../Gimnasia Design System.png`.
`TextField` reenvía la referencia y las props nativas; `Button` conserva handlers,
identificadores, etiquetas y desactivación; los diálogos conservan el orden de
capas, la política de Atrás y las confirmaciones de sus propietarios.

Ya eran reutilizables `AppShell`, `SharedChatPanel`, `ExerciseCatalogBrowser`, los
avisos de identidad IA/salud, el pie legal y las tarjetas de historial. Se
reutilizan; las tablas de series, gráficas y flujos de seguridad conservan sus
componentes especializados. La extracción no cambia cálculos, almacenamiento,
proveedores, prompts ni reglas sanitarias.

## Límites y validación

La web permite revisar composición, controles, navegación, formularios y datos
locales. No demuestra teclado nativo, selector del sistema, cámara, permisos,
notificaciones, segundo plano o almacenamiento seguro. Los estados de recuperación
al arrancar, conflicto concurrente, restauración y errores de proveedor requieren
fixtures controladas; no se provocaron corrompiendo la sesión publicada. No se
presentan como capturados. Las variantes de error/carga siguen perteneciendo a
los componentes y controladores existentes.

Para regenerar la galería a partir de las capturas conservadas:

```sh
node scripts/design-component-audit/generate.mjs
```

El generador usa `scripts/design-component-audit/gallery.html` como plantilla
autónoma, incrusta el inventario y comprueba que las zonas caben en la captura y
que cada componente tiene un fichero de implementación. No requiere servidor ni
conexión para consultar las parejas desde `index.html`.

La comprobación de la extracción usa el type-check móvil, `npm test` y las E2E
existentes del shell, dieta, entrenamiento y proveedor falso. El resultado
concreto de cada ejecución queda en la descripción de la PR. La QA nativa sigue
siendo necesaria para comprobar el comportamiento del teclado en Android/iOS.
