# Google Interactions: validación de la migración

GYM-232 (ticket para migrar toda generación de Google a Interactions sin guardar
conversaciones remotas) incluye chat, asistentes de alimentos, extracción JSON y
evaluación sanitaria opcional. Las peticiones llevan `store: false` y nunca
`previous_interaction_id`. El transporte es Fetch en web y XHR incremental en
Android/iOS. Google puede representar con una cadena vacía u omitir el ID de una
interacción no guardada, y omitir el estado inicial. El parser usa la presencia del
evento `interaction.created`, no el valor del ID, para controlar el ciclo de vida;
normaliza únicamente el ID ausente a la cadena vacía que ya admite el historial local.
Si el XHR nativo falla antes de entregar contenido visible, la app repite la petición
una vez con XHR almacenado completo, sin eventos de progreso.

## Contrato y regresiones

Las pruebas `googleInteractions.test.ts` cubren pasos, firmas opacas, argumentos,
estados `completed`/`requires_action`, replays, truncado, correlación de herramientas,
historial candidato completo, fragmentación UTF-8 y equivalencia Fetch/XHR. Para
GYM-233 (ticket para limitar el contexto enviado a Google), cubren además el máximo de
diez intercambios, los dos presupuestos de bytes, la retirada de imágenes antiguas, la
inmutabilidad del historial local, los errores anteriores a red y propiedades de orden
y emparejamiento de herramientas. Una regresión utiliza el ledger real para comprobar
un reintento completo con nuevos IDs del proveedor.
`providerPipeline.test.ts` y `providerToolLoop.test.ts` recorren los fixtures REST/SSE.

```sh
npm test
npm --workspace apps/mobile exec tsc --noEmit
npm run test:agent:e2e
npm run test:storage-recovery:e2e
npm run test:data-deletion:e2e
npm run check:data-inventory
npm run test:data-inventory
npm run check:legal
npm run test:legal
npm run test:privacy:e2e
```

El E2E del agente incluye Google con aperturas/cierres duplicados, lectura y escritura
de datos, recarga de un historial local largo y continuación enviando solo los diez
intercambios más recientes. Comprueba también que una imagen llega en el turno en que
se adjunta y deja de reenviarse en el siguiente, sin perder el texto ni la firma. Además
recorre dos turnos firmados del asistente personal y guarda un alimento mediante la
extracción JSON de Interactions. Un navegador o un XHR
simulado no demuestra el comportamiento de React Native: hay que completar el caso
siguiente antes de cerrar el ticket.

## Evidencia de implementación (2026-09-11)

- `npm test`: 72 archivos, 662 pruebas Vitest y 11 pruebas del almacén de desarrollo.
- TypeScript: sin errores.
- `npm run test:agent:e2e`: chat de OpenAI, Anthropic y Google, flujos de incidencias,
  BYOK y modo Development correctos. La ampliación de alimentos se validó además
  con `AGENT_E2E_PROVIDER=google node apps/mobile/scripts/agent-chat.e2e.mjs`.
- Recuperación, borrado parcial/total (incluye una firma Google marcada) y privacidad
  ES/EN: E2E correctos. El paquete de backup conserva exactamente pasos y firmas.
- Inventario y política legal: comprobaciones y suites correctas; versión `2026-09-v2`.
- Servidor de Android: comprobados por HTTP catálogo, SSE con replays y rechazo de
  `store: true`. Esta prueba no sustituye el recorrido de React Native.
- Android real, APK v1.42.0: el XHR incremental falló antes de entregar contenido
  y mostró «No se pudo conectar con Google AI». La clave, el endpoint y el cuerpo
  completo del chat sí respondieron con SSE 200 en peticiones reales desde el host.
  El dispositivo no estaba conectado por ADB, por lo que no se obtuvo la excepción
  de OkHttp. Se añadió la recuperación almacenada y queda pendiente validarla en
  una nueva build Android.
- Android real, APK v1.42.2: la recuperación almacenada recibió y procesó el SSE,
  pero el parser rechazó `interaction.created` porque Google devolvió `id: ""` al
  respetar `store: false`. Una petición real confirmó el mismo ID vacío en apertura,
  actualización de estado y cierre; se añadió cobertura del stream completo y de
  una continuación con herramientas donde todas las rondas carecen de ID remoto.
  Una prueba temporal de contrato contra Google completó además dos rondas reales,
  con una función ficticia ejecutada una sola vez; la prueba y la clave no forman
  parte del repositorio.
- Antes de distribuir: completar Android y publicar los HTML de privacidad en
  `gymnasia-web`, siguiendo `docs/legal/privacy-change-checklist.md`.

El historial local completo sigue creciendo con la conversación. Antes de cada petición
Google recibe como máximo diez intercambios; los límites de 512 KiB sin imágenes y
19.000.000 bytes para el cuerpo completo pueden retirar más intercambios enteros desde
el más antiguo. El turno activo nunca se parte ni se resume: si por sí solo no cabe, la
app muestra un error antes de abrir la red.

## Evidencia de GYM-233 (ticket para limitar el contexto enviado a Google), 2026-09-14

- TypeScript sin errores y 44 pruebas focalizadas de Google, chat, herramientas y
  estimador correctas.
- Suite Vitest completa: 94 archivos y 730 pruebas. En esta máquina fue necesario usar
  un worker y ampliar el timeout del runner por su carga; las mismas propiedades que
  agotaron tiempo en paralelo pasaron sin cambiar casos ni aserciones. Los 11 tests del
  almacén de desarrollo y los 3 de límites de arquitectura pasaron aparte.
- `npm run test:agent:e2e`: recorridos completos de OpenAI, Anthropic y Google,
  incidencias, BYOK y modo Development correctos. Para Google valida siete rondas del
  chat con herramientas, historial local largo reducido a diez intercambios en red y
  una foto que no se reenvía en el mensaje siguiente.
- Política `2026-09-v3`: generación, contrato, inventario y E2E ES/EN correctos. Las
  pruebas de OpenWiki y su validador de instrucciones también pasan.

## Android con el transporte real y proveedor falso

Usar un dispositivo con Expo Go SDK 54 o un cliente Development compatible. No se
requiere una build EAS. El servidor de pruebas no se despliega y solo admite una clave
ficticia; la configuración se rechaza en Staging/Production y con claves reales.

1. Conectar un Android con depuración USB. Comprobar `adb devices` y aceptar la
   autorización en el dispositivo.
2. Ejecutar `node apps/mobile/scripts/google-interactions-fixture.mjs` y
   `adb reverse tcp:18882 tcp:18882`.
3. Iniciar Metro desde la raíz:

   ```sh
   GOOGLE_FIXTURE_PORT=18882 DEV_PROVIDER_MODE=byok npm --workspace apps/mobile run start -- --tunnel --clear
   ```

4. Abrir esa sesión Development. En Ajustes usar Google, modelo `gemini-3.8-flash`,
   clave **`e2e-local-fake-key`**. En esta configuración la verificación y el listado
   de modelos también consultan el servidor local; deben mostrarse conectados.
5. Guardar localmente el campo Objetivo con valor «Ganar masa muscular» y enviar
   «¿Cuál es mi objetivo?». Debe aparecer una sola respuesta, con dos peticiones y
   una continuación en `http://127.0.0.1:18882/results`. Repetir tras reiniciar la app;
   el historial técnico debe mantenerse.
6. Reiniciar el servidor con `GOOGLE_FIXTURE_SCENARIO=measurement` y pedir registrar
   el peso. Confirmar la acción si la app lo solicita. El fixture repite todos los
   eventos de apertura/cierre; comprobar que solo se añade una medición.
7. Reiniciar con `GOOGLE_FIXTURE_SCENARIO=truncate` y después `malformed`. Ambos casos
   deben mostrar un error y no ejecutar herramientas. La app debe seguir permitiendo
   acceder a entrenamiento, dieta y ajustes.
8. Anotar fecha, commit, versión de Android/Expo, escenario y resultado. Retirar el
   reenvío con `adb reverse --remove tcp:18882` y detener Metro/servidor.

El endpoint local se activa únicamente con `GOOGLE_FIXTURE_PORT` y `APP_ENV=development`
(el script `start` fija este último). No se añade ningún servicio obligatorio al producto.

## Regresión del rechazo de Google Play (2026-10-23)

La captura `IN_APP_EXPERIENCE-1593.png` del rechazo muestra la app abierta: se
verifica la clave de Google y Coach falla ante «What is 3 + 4?» con
`invalid_created`. No demuestra un fallo de arranque. La consulta del catálogo
(`GET models`) verifica el acceso a la clave/modelo, pero no recorre la generación
ni el lector SSE.

Una petición real a `v1beta/interactions` con `gemini-3.8-flash` y `store:false`
reprodujo la causa: `interaction.created` contiene solo `object` y `model`, sin
`id` ni `status`; la actualización de estado y el cierre también omiten el ID.
El stream sí termina correctamente con el texto «7», firma de pensamiento y uso.
La referencia oficial describe recursos parciales en los eventos de ciclo de vida:
<https://ai.google.dev/api/interactions-api#InteractionSseEventInteraction>.
La captura real es la evidencia de estas omisiones concretas; los ejemplos de la
referencia todavía incluyen ambos campos.

`agent/__fixtures__/raw/google-stateless-math.sse` conserva ese intercambio; solo
se sustituye la firma opaca por una cadena ficticia. No contiene claves ni datos
personales. La prueba falló con el mismo `invalid_created` antes del arreglo.
El lector ahora acepta los metadatos omitidos y conserva el formato local del ID
vacío. Sigue exigiendo apertura, cierre explícito válido, pasos completos, firmas,
argumentos válidos e identidad coherente cuando hay ID. Los campos presentes con
tipos o estados incorrectos y las aperturas repetidas siguen rechazándose.

La regresión cubre Fetch y ambos caminos XHR simulados, fragmentación UTF-8,
replays de pasos, una continuación con herramientas ejecutada una sola vez y
restauración del historial. El E2E web usa las omisiones actuales en todas las
rondas de Google, incluidos alimentos y extracción JSON, y reproduce la pregunta
del revisor: aparece «7», se persiste y sigue visible tras recargar sin otra
petición. No cambia la interfaz ni el contrato enviado al proveedor.

Validación del 23 de octubre: 978 pruebas Vitest en 112 archivos, 11 pruebas del
almacén de desarrollo y 3 de límites de arquitectura correctas; TypeScript, E2E
web focalizado en Google, inventario y generación legal correctos. La captura real
se obtuvo con una petición mínima (razonamiento `low`, límite de 128 tokens).
Una comprobación adicional de dos rondas reales con una herramienta ficticia
agotó el timeout de red; no se considera una validación real de herramientas.
Estas sí están cubiertas por las regresiones deterministas y el E2E con proveedor
falso. La consulta del catálogo sigue teniendo el alcance descrito arriba.

Revisión de privacidad: no cambian peticiones, destinos, categorías de datos,
almacenamiento, permisos, copias ni borrado. La normalización conserva el formato
local existente; no requiere migración, inventario nuevo ni cambio del texto legal.

Pendiente antes de reenviar: comprobar el mismo flujo con una nueva build en
Android. `adb devices -l` no detectó dispositivos conectados el 23 de octubre;
los XHR simulados y el navegador no sustituyen esa comprobación. Los envíos
automáticos a Play siguen retenidos y esta corrección no los libera.
