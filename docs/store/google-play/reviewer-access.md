# Acceso del revisor de Google Play

Preparado y comprobado el 15 de octubre de 2026 para GYM-199 (ticket para publicar y validar
el AAB en pruebas de Google Play). Reutiliza la credencial y la custodia de
GYM-196 (ticket para preparar una credencial BYOK temporal de revisión).

## Configuración privada de Play Console

En **Monitorizar y mejorar → Política y programas → Contenido de la aplicación
→ Datos de inicio de sesión** (antes **Acceso a la aplicación**), declarar que
una parte requiere acceso especial.
Las rutinas, la dieta y las medidas no requieren una cuenta de Gymnasia; la IA
necesita una clave del proveedor.

Conservar la credencial del proyecto dedicado `gymnasia-play-review` en el
campo privado existente. Su fuente de recuperación es Bitwarden. Este documento
contiene únicamente instrucciones, nunca el valor de la clave.

Nombre de la instrucción existente: **Google Gemini API key for review**.

Texto en inglés para el campo de instrucciones:

> No account needed. Open Settings (gear) > Proveedor IA > Google. Paste the API
> key from the Password field above, keep the default Gemini model and tap
> Guardar. Select Google for Gymnasia Coach and Food Estimator. Ask Coach
> 'What is 3 + 4?' (expect 7); test the estimator with a sample food photo. On
> errors, remove spaces from the key and check the model. For HTTP 429, retry
> after 60s. No 2FA, subscription, payment or location restriction.

El modelo predeterminado del código revisado el 15 de octubre es
`gemini-3.8-flash` (`apps/mobile/agent/providerTransport.ts`). La app migra el
antiguo default `gemini-3.6-flash`; no copiar su identificador histórico como
instrucción para una versión nueva. La clave de revisión ha respondido
correctamente con el modelo actual mediante la API Interactions, sin almacenar
la conversación en el proveedor (`store: false`).

## Comprobación del acceso

1. En la entrega instalada desde Play, abrir **Proveedor IA**, introducir la
   credencial privada en Google y pulsar **Guardar**. Anotar versión y
   compilación sin registrar la clave.
2. Seleccionar Google para **Gymnasia Coach** y **Gymnasia Food Estimator**.
   Enviar la pregunta del texto anterior y comprobar una respuesta completa;
   estimar una foto de comida de prueba, sin datos personales.
3. Comprobar que las instrucciones en inglés y la credencial están guardadas
   en Play Console. Conservar como evidencia solo el resultado y la fecha.
4. Ante un error de clave o permisos, revisar en privado la credencial y la
   restricción a Gemini API. Ante un modelo no disponible, comprobar su acceso
   en el proyecto dedicado antes de actualizar la instrucción. Ante HTTP 429,
   esperar y reintentar; si persiste, revisar saldo y límites sin ampliarlos
   automáticamente.

La credencial sigue disponible para revisiones posteriores. Su rotación y la
actualización de Bitwarden conservan el procedimiento con solape de GYM-196
(ticket para preparar una credencial BYOK temporal de revisión).

## Evidencias y estado actual

- **28 de agosto de 2026:** GYM-196 (ticket para preparar una credencial BYOK
  temporal de revisión) documenta instrucciones privadas en inglés, clave
  guardada en Bitwarden y Play, y una conversación real en el AAB 12 (1.28.0)
  instalado desde Play. La inspección del AAB y de logcat no encontró claves.
- **15 de octubre de 2026:** el mantenedor confirma arranque, entrenamiento y
  guardado, notificación de descanso, BYOK, conversación con Coach sin el error
  del snapshot y denuncia de respuestas en un móvil actualizado desde Play.
  Esta confirmación no identifica una nueva compilación ni acredita por sí sola
  el uso de la credencial exclusiva de revisión.
- **15 de octubre de 2026, acceso del revisor:** instrucciones guardadas y
  reabiertas para comprobar que coinciden con el texto anterior. La huella
  SHA-256 de la clave de Play coincide con la de la única clave del proyecto
  dedicado, restringida a Generative Language API. La comprobación privada no
  imprime ni guarda la clave en archivos.
- **Prueba real del servicio:** HTTP 200 con `gemini-3.8-flash`; respuesta `7`
  a la pregunta anterior y evento terminal `interaction.completed`. Se usa el
  contrato de Interactions de la app, streaming y `store: false`, mediante
  Python estándar. Esta comprobación valida la credencial y el servicio; la QA
  nativa sigue siendo la confirmación del mantenedor descrita arriba.
- **Envío del 15 de octubre de 2026:** tras la autorización explícita del
  mantenedor, se envía únicamente la actualización de estas instrucciones.
  El Resumen de publicación confirma **Cambios en revisión** y enumera solo
  las instrucciones de los datos de inicio de sesión. La revisión de Google
  sigue pendiente; la clave existente se conserva sin modificaciones.

## Referencias

- [Requisitos oficiales de acceso para revisión](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-GB).
- [Preparar una aplicación para revisión](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en).
