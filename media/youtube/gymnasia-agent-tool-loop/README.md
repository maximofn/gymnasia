# Assets del vídeo «El bucle de un agente»

Miniatura lista para subir a YouTube (`1280 × 720`) y siete gráficos de apoyo
`1920 × 1080`. Los PNG están listos para el editor de vídeo; los SVG permiten
cambiar textos, colores y distribución sin perder calidad. La imagen base de la
miniatura y su texto están separados para poder ajustar este último.
`overview.png` reúne los siete gráficos para revisarlos de un vistazo.

| Tramo aproximado del guion | Archivo | Uso en montaje |
| --- | --- | --- |
| Portada | `thumbnail.png` | Miniatura final con «¿CUÁNDO PARA?» |
| 0:45 | `01-una-llamada-no-es-un-agente.png` | La tool call termina el turno del modelo. |
| 1:40 | `02-el-bucle.png` | Animar el recorrido modelo → app → historial → modelo. |
| 2:35 | `03-contexto-comun.png` | Mostrar la selección local común y los adaptadores. |
| 3:30 | `04-diez-rondas.png` | Contar hasta el límite y marcar la tool pendiente. |
| 4:20 | `05-llamada-de-cierre.png` | Separar resultado e instrucción en una petición. |
| 5:35 | `06-dato-vs-instruccion.png` | Ilustrar por qué el texto de una tool no da órdenes. |
| 6:20 | `07-tests-del-bucle.png` | Resumir las pruebas con proveedor falso. |

## Edición y exportación

- `thumbnail-art.png` es la ilustración limpia. `thumbnail-overlay.svg` contiene
  la tipografía; `thumbnail.png` es su composición final.
- `generate.py` recrea los siete SVG y el overlay de la miniatura.
- `render.cjs` exporta los PNG y compone la miniatura; requiere Node.js y
  `sharp` disponibles en el entorno. Ejecutar `python3 generate.py` y luego
  `node render.cjs`.
- Todos los gráficos usan el fondo `#07090D`, superficies `#141820`, texto
  `#F4F7FB` y acento `#CBFF1A` del diseño de Gymnasia. La fuente es Arial para
  facilitar la edición en distintos equipos.

La ilustración base de la miniatura se generó con la herramienta de imágenes,
usando la portada del post como referencia de estilo. Prompt resumido:
«Composición 16:9 oscura y premium, cerebro luminoso verde lima a la izquierda,
tarjeta de herramienta con mancuerna en el centro, respuesta final a la derecha
y flecha de retorno; sin texto, personas, marcas de agua ni señal de prohibido».
El texto de la miniatura se añadió después de forma determinista para que sea
exactamente «¿CUÁNDO PARA?».
