# Presentaciones HTML interactivas

Usa este patrón cuando el asset vaya a reproducirse en un navegador y la persona que graba necesite controlar exactamente cuándo avanza la explicación.

## Modelo de interacción

- Una presentación contiene escenas; cada escena contiene uno o varios pasos.
- Un clic principal avanza un único paso. Al terminar una escena puede pasar a la siguiente, pero la transición debe ser predecible.
- Conserva el paso de cada escena al navegar entre ellas, salvo que el usuario pida reiniciarlas siempre.
- Permite retroceder sin recargar la página.
- Los temporizadores pueden aportar microanimaciones, pero no deben decidir el ritmo principal de la explicación salvo petición expresa.

Un modelo de estado sencillo suele ser suficiente:

```js
const sceneSteps = scenes.map(() => 0);
let currentSceneIndex = 0;
```

Representa las transiciones mediante clases o atributos de datos. Son más fáciles de inspeccionar y probar que una cadena de mutaciones de estilos inline:

```html
<section data-scene data-max-step="3">
  <article data-reveal-step="1">Petición estructurada</article>
  <article data-reveal-step="2">Ejecución de la tool</article>
  <article data-reveal-step="3">Resultado final</article>
</section>
```

Usa atributos distintos cuando un elemento deba aparecer, desaparecer o resaltarse solo en ciertos pasos. No dupliques todo el contenido para crear cada estado si puede expresarse con una transición de estado.

## Controles para grabación

Cuando no haya otra convención, ofrece:

- clic, `ArrowRight`, espacio o `Enter`: avanzar;
- clic secundario o `ArrowLeft`: retroceder;
- `R`: reiniciar la escena;
- `F`: entrar o salir de pantalla completa;
- `H`: mostrar u ocultar los controles de grabación.

Los controles inferiores y los indicadores de escenas deben comenzar ocultos. La cabecera de contenido puede permanecer visible. No muestres contadores del tipo `02 / 15` salvo que el usuario los pida; suelen añadir ruido al plano grabado.

Mantén los botones de control fuera del área que avanza al hacer clic, o detén explícitamente la propagación, para evitar dos acciones con una sola pulsación. Actualiza `aria-label`, foco y estado accesible cuando un control cambie de función.

## Estructura y layout

- Haz que el escenario ocupe el viewport y evita scroll en la grabación 16:9.
- Usa una capa estable para la marca o el título y otra para el contenido de la escena.
- Reserva espacio para la zona inferior aunque los controles estén ocultos solo si el contenido podría quedar tapado al mostrarlos.
- Usa `clamp()` para escalas tipográficas y espacios, pero verifica los extremos de forma visual.
- Si una escena contiene mucho código, reduce primero el fragmento; reducir la fuente es el último recurso.
- Mantén fondos, rejillas y elementos ambientales fuera del árbol interactivo y márcalos como decorativos.

El estado oculto debe impedir tanto la visibilidad como la interacción:

```css
.controls-hidden .presenter-controls,
.controls-hidden .scene-dots {
  opacity: 0;
  pointer-events: none;
}
```

Añade transiciones breves y consistentes. Incluye una variante para movimiento reducido que elimine desplazamientos, escalados y parpadeos innecesarios.

## Navegación y persistencia

Un hash como `#scene-4` facilita abrir una escena concreta durante la grabación y probarla de forma aislada. Si se usa:

- valida y limita el índice recibido;
- actualiza el hash sin añadir entradas inútiles al historial en cada paso;
- sincroniza cambios manuales del hash;
- no serialices información sensible.

El asset debe seguir funcionando sin el hash y sin pantalla completa.

## Prueba completa

Automatiza el recorrido de todas las combinaciones de escena y paso cuando la presentación tenga varias pantallas. En cada estado comprueba:

- ausencia de errores de consola;
- que solo haya una escena activa;
- que los elementos revelados coincidan con el paso;
- que ningún bloque importante salga del viewport;
- que no aparezca scroll horizontal o vertical accidental;
- que la navegación por teclado produzca el mismo estado que el clic;
- que `H` revele y vuelva a ocultar controles y puntos;
- que la cabecera no se oculte junto a los controles por un selector demasiado amplio.

Realiza la prueba al menos a 1920 × 1080 y 1280 × 720. Inspecciona capturas de la escena inicial, la más densa y cualquier escena con código largo o un diagrama de muchas etapas.
