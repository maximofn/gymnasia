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

Los mandos de presentación envían `AvPág`/`RePág` o flechas, así que funcionan sin
configurar nada. Desde la vista de presentador también se puede avanzar con el
teclado o los botones. El paso actual queda en la URL (`#12`), así que recargar no
te devuelve al principio.

## Cómo está hecha

Las ilustraciones son planos en capas que la cámara ve de frente (2.5D): al
moverse, las capas se desplazan a distinta velocidad y parecen una escena real.
Lo que brilla o cambia (el agente, los rayos, las columnas de calorías, la huella)
es geometría. Encima va un postprocesado: *bloom* solo para lo que pasa de 1 (el
lima del agente), desenfoque de profundidad por ilustración, viñeta y grano.

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
