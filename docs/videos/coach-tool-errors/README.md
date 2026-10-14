# Visuales del vídeo «Cómo debe actuar un agente de IA cuando falla una tool»

Material para editar el vídeo de GYM-42 (ticket para explicar en YouTube el
contrato de errores de las tools de Coach). El guión está en
`docs/videos/coach-tool-errors-youtube.md` (PR #323). No forma parte de la app.

- `png/`: un PNG por paso, listo para la línea de tiempo. 1920×1080, salvo la
  miniatura (1280×720). `03-rotulo.png` tiene fondo transparente para ir sobre cámara.
  Los pasos de una misma diapositiva (`-1`, `-2`…) comparten encuadre: un corte o un
  fundido entre ellos revela el siguiente elemento al ritmo de la locución.
- `slides.html`: la presentación animada, pensada para grabarla en pantalla
  completa (por ejemplo con OBS) mientras narras. Ábrela en Chrome desde el
  repositorio: la tipografía sale de `charla-agente/fonts.css`.

| Tecla | Acción |
| --- | --- |
| `→`, espacio, `Intro`, `AvPág`, clic | siguiente paso |
| `←`, `RePág`, `Retroceso` | paso anterior |
| `F` | pantalla completa |
| `H` | oculta la barra de capítulo y progreso |
| `C` | enseña la zona reservada para la cámara |

  El fotograma actual queda en la URL (`slides.html#12`): recargar no te devuelve
  al principio y puedes saltar a cualquier paso. Con movimiento reducido activado
  en el sistema, todo aparece sin animación.

  La firma visual es el tique: cada llamada a una tool es un recibo de papel que se
  imprime, viaja por el diagrama y recibe un sello («Sin confirmar», «Rechazada»,
  «Guardado ×1»).
- `render.mjs`: regenera `png/` con el estado final de cada paso (abre la página
  con `?static`):

```bash
node docs/videos/coach-tool-errors/render.mjs
```

| Sección del guión | Ficheros |
| --- | --- |
| Miniatura | `00-miniatura` |
| 1. Una comida que podría aparecer dos veces | `01-peticion-1…3`, `02-titulo`, `03-rotulo` |
| 2. Quién pide la operación y quién la ejecuta | `04-llamada-tool-1…2`, `05-recorrido-1…6` |
| 3. El mismo mensaje de error… | `06-peso-1…5`, `07-error-generico-1…2`, `08-contrato-1…4` |
| 4. Corregir, buscar una alternativa o parar | `09-decisiones-1…4`, `10-contrato-json-1…6` |
| 5. Un error de la app tiene que llegar como error de la app | `11-donde-falla-1…3`, `12-destinatarios-1…3` |
| 6. Volvamos a la comida | `13-diseno-posible-1…6`, `14-probado-gymnasia-1…2` |
| 7. Cómo sabemos que las decisiones se respetan | `15-visible-vs-ejecutado-1…3`, `16-proveedores-1…3`, `17-evidencia-1…2` |
| 8. Qué te llevas para tu agente | `18-cierre-comida-1…2`, `19-resumen-1…5`, `20-referencias` |

Los límites de las notas de producción del guión están aplicados: la comida
duplicada se rotula como posibilidad, la comprobación previa como «Diseño posible»
y separada de lo probado en Gymnasia, el JSON como fragmento ilustrativo y la
evidencia real con su alcance. Colores y tipografía (Space Grotesk, desde
`charla-agente/fonts.css`) son los de la app.

## Zona de la cámara

La esquina superior derecha (560×340 px del lienzo de 1920×1080) queda libre para
superponer la cámara. Su tamaño está en `--cam-w` y `--cam-h` de `slides.html`.
Tras mover algo de sitio, comprueba que ningún paso la invade:

```bash
node docs/videos/coach-tool-errors/check-camera.mjs
```

