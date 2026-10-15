# Acceso del revisor de Google Play

Preparado el 15 de octubre de 2026 para GYM-199 (ticket para publicar y validar
el AAB en pruebas de Google Play). Reutiliza la credencial y la custodia de
GYM-196 (ticket para preparar una credencial BYOK temporal de revisión).

## Configuración privada de Play Console

En **Monitorizar y mejorar → Política y programas → Contenido de la aplicación
→ Acceso a la aplicación**, declarar que una parte requiere acceso especial.
Las rutinas, la dieta y las medidas no requieren una cuenta de Gymnasia; la IA
necesita una clave del proveedor.

Conservar la credencial del proyecto dedicado `gymnasia-play-review` en el
campo privado existente. Su fuente de recuperación es Bitwarden. Este documento
contiene únicamente instrucciones, nunca el valor de la clave.

Nombre propuesto de la instrucción: **Google Gemini reviewer access**.

Texto en inglés para el campo de instrucciones:

> No account needed. Open Settings (gear) > Proveedor IA > Google. Paste the
> private review API key, keep the default Gemini model shown by the app and tap
> Guardar. Select Google for Gymnasia Coach and Food Estimator. Open Coach and
> ask "What is 3 + 4?" (expect 7). Test the estimator with a sample food photo.
> If it fails, remove spaces from the key and check the selected model; for HTTP
> 429, retry after 60s. Persistent error: maximofn@maximofn.com.

El modelo predeterminado del código revisado el 15 de octubre es
`gemini-3.8-flash` (`apps/mobile/agent/providerTransport.ts`). La app migra el
antiguo default `gemini-3.6-flash`; no copiar su identificador histórico como
instrucción para una versión nueva. La disponibilidad del modelo para la clave
de revisión debe comprobarse con la entrega instalada desde Play.

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

## Evidencias y pendiente actual

- **28 de agosto de 2026:** GYM-196 (ticket para preparar una credencial BYOK
  temporal de revisión) documenta instrucciones privadas en inglés, clave
  guardada en Bitwarden y Play, y una conversación real en el AAB 12 (1.28.0)
  instalado desde Play. La inspección del AAB y de logcat no encontró claves.
- **15 de octubre de 2026:** el mantenedor confirma arranque, entrenamiento y
  guardado, notificación de descanso, BYOK, conversación con Coach sin el error
  del snapshot y denuncia de respuestas en un móvil actualizado desde Play.
  Esta confirmación no identifica una nueva compilación ni acredita por sí sola
  el uso de la credencial exclusiva de revisión.
- **Pendiente:** guardar o confirmar estas instrucciones y repetir la prueba
  con la credencial de revisión y el modelo actual. La sesión de Play Console
  permitió comprobar el informe previo al lanzamiento, aún ausente, pero las
  operaciones posteriores para abrir Acceso a la aplicación agotaron el tiempo
  de espera y la conexión con la pestaña dejó de estar disponible. No se ha
  cambiado la clave ni se afirma una validación nueva.

## Referencias

- [Requisitos oficiales de acceso para revisión](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-GB).
- [Preparar una aplicación para revisión](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en).
