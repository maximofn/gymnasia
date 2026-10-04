# QA del contrato de errores de Coach

GYM-42 (ticket para que Coach reconozca y gestione los errores de sus herramientas).
Verificado el 4 de octubre de 2026 en web, con Chromium y proveedores falsos.

## Escenarios comprobados

- OpenAI Responses, Anthropic y Google Interactions: argumento inválido de
  medición → resultado marcado de error → llamada corregida → una sola medición
  persistida. Antes de la corrección no existe medición ni recibo de escritura.
- En los tres proveedores, un fallo de persistencia al guardar otro peso detiene
  el turno con un mensaje local claro. No se pide otra ronda, no se reintenta el
  turno, no se confirma éxito ni se filtra el texto de la excepción. El historial
  conserva el mensaje como `technical_error` y el almacén no contiene el peso
  nuevo. La simulación usa una excepción con las palabras `network timeout` para
  comprobar que no entra en los reintentos de transporte.
- Canal de incidencias caído: una única petición, mensaje local de fallo y ninguna
  confirmación de creación. Respuesta ambigua: resultado incierto conservado en el
  diario y acción no repetida. Incidencia confirmada seguida de fallo de proveedor:
  el reintento reproduce el resultado y no duplica la incidencia.
- Regresiones del recorrido normal: lecturas, mediciones, rutina tipada, dieta,
  historial firmado de Google, límites de rondas y configuración BYOK.
- Integración determinista adicional: proveedor compatible con OpenAI, excepción
  de lectura y error fatal; campos inexistentes; JSON ilegible de memoria sin
  borrar los datos; reproducción de una escritura confirmada conservando la marca
  de error tras reiniciar; texto de usuario parecido a un payload de error.
- Se revisa la captura contra `docs/design/Gimnasia Design System.png`: el mensaje
  usa la tarjeta de error existente, mantiene contraste y queda legible en 390 ×
  844, con el campo y botón de envío accesibles. No se añaden componentes ni estilos.

![Escritura incierta detenida en Coach](screenshots/coach-tool-error-openai.png)

## Validación

- `npm test`: 933 pruebas Vitest, 11 pruebas de dev store y 3 de fronteras móviles,
  todas correctas.
- `npm --workspace apps/mobile exec tsc --noEmit`: correcto.
- `npm run check:mobile-boundaries`: correcto; contrato de errores registrado como entrada pública.
- `npm run check:production-version -- --base origin/main`: versión 1.50.4 correcta.
- `npm run test:agent:e2e`: correcto, incluidos los tres proveedores, incidencias
  y development sin red.
- `npm run check:data-inventory`, `npm run test:data-inventory` y
  `npm run check:legal`: correctos.

## Pendiente para cerrar el ticket

La prueba usa proveedores falsos: demuestra el contrato enviado y la experiencia
visible, pero no cómo decide recuperarse un modelo real. Después de publicar la
versión revisada, falta QA exploratoria con BYOK en la sesión habitual de
`https://gymnasia.maximofn.com/`, sin leer ni copiar la clave. No hay cambios de
permisos ni de runtime nativo; esta entrega no incluye pruebas en un dispositivo.

El artículo del blog en español, inglés y portugués, su conversación real y su
publicación pertenecen al alcance restante del ticket. El ticket no se cierra
con esta PR. Los cambios en `apps/mobile` requieren autorización explícita antes
de fusionar, porque la fusión inicia la compilación y distribución Android.
