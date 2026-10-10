---
name: crear-assets-youtube
description: Crea assets visuales para vídeos de YouTube —pantallas, diagramas, animaciones y presentaciones HTML interactivas— listos para grabar. Úsala para convertir un guion, artículo, demo o código en apoyo visual; no para escribir el guion completo ni editar el vídeo final.
---

# Crear assets para vídeos de YouTube

Construye materiales que ayuden a entender la narración. Cada pantalla debe comunicar una idea concreta y resultar legible durante la grabación, incluso para alguien que no conozca el proyecto mostrado.

## Entender la pieza

- Revisa el guion y las fuentes disponibles antes de diseñar. Si existen código, artículo, aplicación o sistema de diseño reales, úsalos como fuente de verdad.
- Identifica la función narrativa de cada asset: presentar una pregunta, explicar una relación, mostrar una transformación, destacar código, comparar alternativas o demostrar un resultado.
- Infiere del contexto la relación de aspecto, resolución, identidad visual y forma de grabación cuando sea seguro. Pregunta solo si una elección ausente cambiaría materialmente el resultado.
- Si el guion contiene indicaciones como `[PANTALLA]`, `[DEMO]` o `[EDICIÓN]`, conviértelas en una secuencia de assets y estados, sin tratarlas como texto que deba aparecer literalmente.
- Separa la enseñanza general del ejemplo concreto. Incluye el contexto mínimo para que el asset se entienda sin conocer previamente la aplicación.

## Elegir el formato

Usa el formato más sencillo que conserve la intención:

- **HTML, CSS y JavaScript:** para presentaciones, diagramas progresivos, código resaltado por pasos o assets que se grabarán en directo.
- **SVG o HTML/CSS estático:** para diagramas y composiciones vectoriales que deban mantenerse nítidos.
- **PNG u otro bitmap:** para ilustraciones, fondos, texturas o imágenes finales que no necesiten interacción.
- **Captura de la aplicación real:** cuando el valor está en demostrar su comportamiento. No reconstruyas una interfaz falsa si puede mostrarse la auténtica.

Evita frameworks y dependencias externas para una pieza autocontenida, salvo que el proyecto ya los utilice o aporten una ventaja concreta. No generes un bitmap para algo que se representa mejor con texto, CSS o vectores editables.

Cuando el asset sea una presentación HTML interactiva, lee y aplica [references/html-interactivo.md](references/html-interactivo.md).

## Diseñar la secuencia visual

Antes de construir una pieza compleja, define para cada pantalla:

- qué está explicando la voz en ese momento;
- qué debe mirar el espectador;
- qué aparece inicialmente;
- qué revela cada paso;
- cuál es el estado final que debe quedar en pantalla.

No muestres toda la información desde el principio si la narración la introduce por partes. Cada clic o transición debe cambiar lo que el espectador entiende, no limitarse a añadir decoración.

## Mantener la identidad visual

- Inspecciona el sistema de diseño, la interfaz y los assets de marca del proyecto. Deriva de ellos colores, tipografías, radios, espaciado, iconografía y tono.
- Centraliza las decisiones visuales reutilizadas en variables CSS o tokens equivalentes.
- Diseña para la resolución real de grabación. Por defecto, comprueba 16:9 a 1920 × 1080 y también 1280 × 720.
- Mantén títulos, código y etiquetas dentro de una zona segura. Lo importante debe seguir siendo legible cuando el vídeo se vea en una ventana pequeña.
- Reserva el movimiento y el color de acento para dirigir la atención. Evita plantillas genéricas y adornos que compitan con la explicación.

## Mostrar código y datos

- Usa fragmentos reales cuando estén disponibles. Recorta imports, tipos o ramas irrelevantes solo si no alteras la idea explicada.
- Distingue el código de producción del pseudocódigo o de un ejemplo simplificado.
- Destaca una región narrativa cada vez: una línea, un campo, un mapeo o un resultado.
- No muestres archivos completos ni hagas que el espectador dependa de texto demasiado pequeño.
- Conserva el formato real de JSON, nombres y tipos. No incluyas secretos, credenciales ni datos privados.

## Diagramas y flujos

- Usa nodos con responsabilidades claras y flechas con una única dirección de lectura.
- Revela las etapas en el mismo orden que la narración.
- Diferencia visualmente actores distintos, por ejemplo persona, LLM, harness, tool, almacenamiento y servicio externo.
- Etiqueta solicitudes y resultados cuando una flecha por sí sola pueda ser ambigua.
- Comprueba que el diagrama se entienda por sus relaciones, sin exigir que la voz repita cada palabra de la pantalla.

## Organización de archivos

Respeta la convención existente. Si el proyecto no tiene una, usa una carpeta por vídeo, por ejemplo:

```text
youtube_assets/
└── 01_tool_calling/
    ├── index.html
    ├── styles.css
    └── script.js
```

Agrupa en esa carpeta únicamente los recursos usados por la pieza. Mantén rutas relativas y ejecución local. No añadas backend, analítica, publicación ni despliegue si el usuario no los ha pedido.

## Validación antes de entregar

- Recorre todas las pantallas y todos los pasos, no solo el estado inicial.
- Comprueba que no haya desbordamiento, solapamiento, scroll accidental, texto cortado ni código ilegible en las resoluciones objetivo.
- Verifica navegación hacia delante y atrás, reinicio, pantalla completa y controles ocultos cuando existan.
- Comprueba que el estado inicial sea limpio: los controles de grabación comienzan ocultos y no aparece un contador `x / y`, salvo petición expresa.
- Respeta `prefers-reduced-motion` y evita depender de hover para revelar información esencial.
- Revisa errores de consola y valida la sintaxis de JavaScript, por ejemplo con `node --check` cuando corresponda.
- Captura e inspecciona al menos la pantalla inicial y la escena más densa. Una prueba automatizada no sustituye la revisión visual.