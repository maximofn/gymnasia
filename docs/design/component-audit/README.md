# Propuestas de componentes a partir de las pantallas

Trabajo de GYM-8 (ticket para unificar componentes repetidos de la interfaz).
Esta entrega conserva el **análisis visual previo a la implementación** y añade
una revisión del código de sus 29 candidatos: **2 para reutilizar, 12 para adaptar
y 15 abstracciones por crear**. Las decisiones, su justificación y sus referencias
están en [code-review.md](code-review.md) y en la galería. No se ha modificado la
app. «Crear» significa extraer una abstracción desde JSX existente, no añadir un
comportamiento nuevo. La repetición visual por sí sola no demuestra código duplicado.

## Cómo revisar la galería

Abre [index.html](index.html). No necesita servidor ni conexión.

- **Pantallas**: original a la izquierda y la misma imagen con patrones candidatos
  señalados a la derecha. Las marcas y su leyenda destacan la zona seleccionada.
- **Patrones propuestos**: 29 candidatos con recortes reales de distintas capturas,
  variantes observadas y límites de lo que convendría compartir. «Ver evidencia»
  amplía los ejemplos; «Ver pantalla» vuelve a su contexto. Cada ficha incluye
  decisión de código, motivo, siguiente paso propuesto y enlaces a las fuentes.
- La búsqueda y los filtros por área y decisión de código funcionan en ambas
  vistas. «Ver patrón» en la leyenda abre la propuesta correspondiente.

[inventory.json](inventory.json) conserva procedencia, propuestas y 208 zonas de
evidencia. Los recuentos representan capturas y zonas anotadas, **no flujos únicos
ni número de repeticiones en el código**. Varias capturas muestran estados de la
misma vista. Las hojas `contact-*.jpg` permiten un repaso rápido de los originales.

## Qué se propone compartir

| Grupo | Patrones visuales candidatos |
| --- | --- |
| Acciones | Botón de acción; botón de icono |
| Entradas y selección | Campo de formulario; buscador; opción seleccionable; selector desplegable; fila de opción; fila con interruptor |
| Navegación y metadatos | Navegación por pestañas; insignia de metadatos; pie informativo |
| Presentación de datos | Tarjeta de métrica; panel de gráfica; barra de progreso; fila de etiqueta y valor; grupo de valores nutricionales |
| Listas y tarjetas | Miniatura; fila con imagen y metadatos; tarjeta de rutina; tarjeta de registro; sección con cabecera |
| Flujos y mensajes | Diálogo; aviso informativo; burbuja de conversación; entrada de conversación; panel de formulario; estado vacío |
| Dominio Entreno | Fila de serie de ejercicio, contrastando editor y sesión |
| Evidencia insuficiente | Menú contextual: una apertura capturada; el código confirma otro uso en Rutinas, pendiente de comparación visual |

Ejemplos que motivan el análisis:

- El buscador se repite en Rutinas, ejercicios, alimentos y productos, con una
  lupa y una acción opcional para limpiar. El filtrado de cada dominio queda fuera.
- La fila con miniatura, título, resumen y acción aparece en ejercicios de Inicio,
  catálogo de ejercicios y alimentos. Puede compartir su disposición sin unir
  los modelos de alimento y ejercicio.
- La tarjeta de métrica se repite en Inicio y Medidas. Etiqueta, valor y variación
  son presentación; cálculos, unidades y tendencias siguen perteneciendo al dominio.
- Los diálogos comparten superficie, jerarquía y disposición de acciones. Cifrado,
  borrado, denuncia y confirmación de una sesión mantienen sus reglas particulares.
- Las entradas de conversación combinan campo y envío en Coach y en los dos
  asistentes de alimentos, con disposición vertical u horizontal.

Los patrones «Base» son unidades visuales pequeñas. Los de «Composición» combinan
varias unidades. «Por validar» señala evidencia insuficiente para justificar una
extracción. Son nombres de análisis, no nombres de componentes ya implementados.
No se propone convertir pantallas completas en una única abstracción genérica.

## Método y alcance

Se navegó por <https://gymnasia.maximofn.com/> el 19 de octubre de 2026, versión
publicada 1.52.1, con emulación móvil de DevTools a 390 × 844 píxeles. Las 54 imágenes
son capturas del producto real, no recreaciones. Se revisaron visualmente y se
contrastó el estilo de las propuestas con `../Gimnasia Design System.png`.

El recorrido cubre Inicio, Rutinas (lista, detalle, editor, catálogo, formulario
personalizado, selector de series, sesión, descanso, confirmación, resumen e
historial), Dieta (vacío, búsqueda, cantidad, registro manual, comida con datos,
menú, fechas y estimador), Medidas (estadísticas, gráfica, selector, formulario y
fecha), Coach (inicio, envío, respuesta y denuncia), las secciones de Configuración,
copia cifrada, confirmación de borrado, fichas y asistente de alimentos personales.

La sesión web contenía datos desechables de QA. Se guardaron dos sesiones parciales
y una manzana de 180 g para observar contenido y persistencia. En Coach se pidió
proponer un peso de prueba; no se confirmó su escritura. No se leyeron claves ni
se enviaron denuncias. No se alteraron datos de un móvil.

Las anotaciones señalan ejemplos representativos, no todas las apariciones de
cada patrón. Cada zona conserva `[x, y, ancho, alto]` en píxeles del original. Las
marcas son HTML y los recortes usan una ventana SVG sobre la captura; los archivos
originales permanecen intactos. Los recortes son evidencia del patrón propuesto,
no renders de un nuevo componente ni diseños alternativos.

Algunas imágenes conservan un estado intermedio de una transición. Solo se marca
lo visible: por ejemplo, la captura denominada `46-dieta-error-fecha` no contiene
un mensaje de error, y no se usa como evidencia de ese estado. La captura de macros
contiene campos numéricos, no un control de incremento/decremento.

## Qué queda para la fase de implementación

1. Revisar las decisiones y los límites de [code-review.md](code-review.md). La
   revisión de lectura ya está completa; acordar cuáles llevar a implementación.
2. Acordar límites, variantes y contrato; comenzar por las unidades pequeñas con
   repeticiones demostradas y después evaluar las composiciones.
3. Implementar solo las extracciones acordadas y verificar cada sustitución con
   las pruebas y la QA visual apropiadas.

La refactorización que se había adelantado durante esta tarea se ha retirado de
la propuesta. El diff final respecto al punto de partida conserva el inventario,
las imágenes, la revisión del código y las herramientas del análisis; no cambia la implementación móvil.

La web permite revisar la composición visible. No demuestra teclado nativo,
permisos, notificaciones, segundo plano ni almacenamiento seguro. Recuperación,
conflictos, restauración y errores de proveedor necesitarán fixtures controladas.
Esos estados no se presentan como capturados. Tampoco se afirma que 54 imágenes
agoten todas las combinaciones de datos y estados de la app.

## Regeneración y validación

```sh
node scripts/design-component-audit/generate.mjs
```

El generador usa `scripts/design-component-audit/gallery.html` como plantilla,
incrusta el inventario y verifica dimensiones, cobertura de imágenes, referencias
entre propuestas y zonas, límites geométricos y evidencia de repetición. La
selección visual de candidatos se conserva independiente del código. Para esta
segunda fase comprueba que cada referencia de código coincide con la línea y
el ancla documentadas, y genera también `code-review.md` desde el inventario.

La comprobación del DOM verifica las parejas, las marcas, las leyendas, los
filtros, las tres decisiones, los enlaces de fuentes, la vista de patrones,
los recortes y la navegación al contexto. La
herramienta del navegador bloquea el protocolo `file://`: esta versión de la
galería no se presenta como verificada visualmente en esa URL.
