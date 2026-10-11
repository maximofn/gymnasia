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

## Estructura

- `js/steps.js`: el guion dividido en pasos. Cada paso dice en qué parada está la
  cámara, qué cambia en la escena y qué dices tú. Es lo primero que hay que tocar
  para cambiar el texto o el orden.
- `js/world.js`: las ocho paradas del mundo 3D y sus animaciones.
- `js/main.js`: cámara, etiquetas, navegación y enlace con el presentador.
- `presenter.html`: la vista de presentador.
- `js/vendor/three.min.js`: three.js 0.149.0, incluido para no depender de la red.

Tras cambiar el guion, comprueba que sigue siendo coherente:

```bash
node charla-agente/check.mjs
```
