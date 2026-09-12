# Google Interactions: validación de la migración

GYM-232 (ticket para migrar toda generación de Google a Interactions sin guardar
conversaciones remotas) incluye chat, asistentes de alimentos, extracción JSON y
evaluación sanitaria opcional. Las peticiones llevan `store: false` y nunca
`previous_interaction_id`. El transporte es Fetch en web y XHR incremental en
Android/iOS. Si el XHR nativo falla antes de entregar contenido visible, la app
repite la petición una vez con XHR almacenado completo, sin eventos de progreso.

## Contrato y regresiones

Las pruebas `googleInteractions.test.ts` cubren pasos, firmas opacas, argumentos,
estados `completed`/`requires_action`, replays, truncado, correlación de herramientas,
historial completo, fragmentación UTF-8 y equivalencia Fetch/XHR. Una regresión utiliza
el ledger real para comprobar un reintento completo con nuevos IDs del proveedor.
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
de datos, recarga y continuación con más de 20 mensajes. También recorre dos turnos
firmados del estimador y del asistente personal, y guarda un alimento mediante la
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
- Antes de distribuir: completar Android y publicar los HTML de privacidad en
  `gymnasia-web`, siguiendo `docs/legal/privacy-change-checklist.md`.

El historial completo crece con la conversación. Un límite de contexto o rechazo del
proveedor se muestra como error; la app no recorta ni resume el historial en silencio.

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
