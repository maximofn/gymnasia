# El viaje del arroz

Presentación en 3D (three.js) de la charla sobre el desarrollo del agente de
Gymnasia. No forma parte de la app: es material para la charla y no se despliega.

## Cómo usarla

1. Abre `index.html` en Chrome (doble clic basta: funciona con `file://` y sin internet).
2. Pulsa `P` para abrir la vista de presentador en otra ventana. Llévala a la
   pantalla del portátil y deja `index.html` en el proyector.
3. Pulsa `F` en la proyección para ponerla a pantalla completa.

| Tecla | Acción |
| --- | --- |
| `→`, `AvPág`, `Espacio`, `Intro`, clic | siguiente paso |
| `←`, `RePág`, `Retroceso` | paso anterior |
| `Inicio` / `Fin` | primer / último paso |
| `P` | abrir la vista de presentador |
| `F` | pantalla completa |
| `B` o `.` | pantalla en negro |
| `I` | índice de preguntas |

Los mandos de presentación envían `AvPág`/`RePág` o flechas, así que funcionan sin
configurar nada. Desde la vista de presentador también se puede avanzar con el
teclado o los botones. El paso actual queda en la URL (`#12`), así que recargar no
te devuelve al principio.

Si solo tienes una pantalla, abre `presenter.html` (o `presenter.html?netcore`)
directamente en el móvil: sin proyección asociada, el guion avanza por su cuenta.

### NetCoreConf Madrid '26

Abre `index.html?netcore` para dar la charla con la plantilla del evento. La
escena va dentro del marco de su diapositiva 3 (fondo, líneas y logo), y se añaden
tres diapositivas: la portada con el título y los patrocinadores al principio, y los
patrocinadores otra vez antes de «Gracias». La numeración de la URL se desplaza dos
pasos. Las imágenes salen de la plantilla que compartió la organización y viven en
`netcore/`, junto con Poppins, la fuente de la plantilla (licencia SIL OFL 1.1).

### Turno de preguntas

Después de «Gracias» viene un índice con las preguntas que puede hacer el público,
en tres columnas y sin etiqueta de nivel, para que nadie sienta que su pregunta es
«de principiante». Cada una enlaza con una diapositiva que la responde, y desde
cualquier respuesta `I` (o el enlace de abajo) vuelve al índice. En la vista de
presentador, la columna derecha se convierte en esa misma lista: pulsa una pregunta
y la proyección salta a su respuesta, con la respuesta completa en tu guion.

Las preguntas y respuestas están en `js/qa.js`.

## Cómo está hecha

Las ilustraciones son planos en capas que la cámara ve de frente (2.5D): al
moverse, las capas se desplazan a distinta velocidad y parecen una escena real.
Lo que brilla o cambia (el agente, los rayos, las columnas de calorías, la huella)
es geometría. Encima va un postprocesado: *bloom* solo para lo que pasa de 1 (el
lima del agente), desenfoque de profundidad por ilustración, viñeta y grano.

- `js/qa.js`: las preguntas del público con su respuesta proyectada y tu guion.
- `js/steps.js`: el guion dividido en pasos. Cada paso dice en qué parada está la
  cámara, qué cambia en la escena y qué dices tú. Es lo primero que hay que tocar
  para cambiar el texto o el orden.
- `js/world.js`: las ocho paradas y sus animaciones.
- `js/main.js`: render, postprocesado, cámara, etiquetas, navegación y enlace con
  el presentador.
- `presenter.html`: la vista de presentador.
- `js/assets.js`: las ilustraciones incrustadas en base64 (generado, no se edita).
- `fonts.css`: Space Grotesk incrustada (licencia SIL OFL 1.1).
- `js/vendor/`: three.js 0.147.0 y sus pases de postprocesado, incluidos para no
  depender de la red.

## Ilustraciones

Los PNG originales viven en `assets/`, que está fuera de Git porque pesan unos
50 MB. Chrome no deja usar como textura de WebGL una imagen cargada desde
`file://`, así que se incrustan en `js/assets.js`, recortadas y en WebP (unos 3 MB).
Tras añadir o cambiar una imagen en `assets/` (la lista está en
`build-assets.mjs`; hace falta ImageMagick):

```bash
node charla-agente/build-assets.mjs
```

`31-carrito-vacio.png` es opcional: si existe, el carrito se queda sin el brócoli
cuando este sale volando.

Tras cambiar el guion o las escenas, comprueba que siguen siendo coherentes:

```bash
node charla-agente/check.mjs
```
