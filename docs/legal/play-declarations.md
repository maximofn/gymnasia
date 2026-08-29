# Declaraciones de Google Play — respuestas preparadas

Respuestas listas para copiar en Play Console después de GYM-194 (ticket para crear y
verificar la cuenta de Google Play Console) y GYM-195 (ticket para crear Gymnasia en
Play Console e importar la clave de firma de EAS). GYM-190 (ticket para publicar la
política de privacidad y preparar las declaraciones de salud) dejó la primera versión;
este documento conserva las respuestas verificadas contra el código y la política.

| Campo | Valor |
|---|---|
| Política que las respalda | `docs/legal/privacy-policy.es.md`, versión `2026-08-v7` |
| URL pública | <https://gymnasia.maximofn.com/privacidad> |
| Contacto | maximofn@maximofn.com |
| Inventario que las sustenta | `scripts/data-inventory/inventory.json` |
| Verificación | `npm run check:data-inventory && npm run check:legal` |

> Antes de copiar nada a la consola, vuelve a pasar los dos `check`. Si el código ha
> cambiado desde la última edición de este documento, fallarán y dirán qué revisar.

---

## 1. Data safety

### Interpretación aplicada

Google define **Collected** como los datos que salen del dispositivo, aunque viajen
directamente a un tercero y Gymnasia no los reciba. Cuando el usuario activa una función
de IA, el proveedor elegido recibe la clave BYOK, los mensajes necesarios para responder,
los resultados de herramientas que el usuario autoriza y, en el estimador, hasta seis
fotografías. Ese contexto puede incluir datos personales, de salud, entrenamiento,
nutrición y medidas.

El backend opcional de incidencias recibe, tras vista previa y confirmación, la pregunta
anterior, la respuesta denunciada y detalles opcionales. También trata la IP de conexión
para limitar abusos: el Worker la convierte inmediatamente en un HMAC, conserva solo ese
valor seudónimo y lo elimina en un máximo de 48 horas.

Los datos salen hacia **terceros que el usuario elige**. Para eso Google contempla una
exención expresa de *Sharing*: transferencias basadas en una acción concreta iniciada
por el usuario en las que espera razonablemente que sus datos lleguen al proveedor.
Configurar una clave propia y enviar un mensaje o una fotografía encaja en esa exención.

Cloudflare y GitHub actúan como proveedores de servicio del responsable para este flujo,
por lo que no se declaran como `Shared` mientras usen los datos únicamente para prestar
el servicio contratado. La denuncia es opcional: la app funciona completa sin usarla.

**Decisión confirmada para GYM-197 (ticket para preparar la ficha española de Google
Play)**: declarar `Collected: Yes`, `Shared: No`, `Optional: Yes` y `Processed
ephemerally: No` para todos los tipos siguientes. Si Play cuestiona la exención, no se
cambiará la respuesta sin registrar la objeción y obtener una nueva decisión del
mantenedor.

### Respuestas por categoría

| Categoría de Play | Collected | Shared | Opcional | Propósito | Respaldo |
|---|---|---|---|---|---|
| Personal info › User IDs | Sí | No | Sí | Funcionalidad de la app: autenticar cada petición con la clave de la cuenta BYOK elegida | La clave solo se envía al proveedor al que pertenece |
| Personal info › Name, Email | No | No | — | No se recogen | No hay cuenta |
| Personal info › Other info | Sí | No | Sí | Funcionalidad de la app: contexto opcional como sexo, altura, fecha de nacimiento u otros datos escritos | Mensajes y resultados autorizados enviados al proveedor |
| Health and fitness › Health info | Sí | No | Sí | Funcionalidad de la app: responder a contexto que puede mencionar síntomas, lesiones o condiciones | Proveedor BYOK o denuncia confirmada |
| Health and fitness › Fitness info | Sí | No | Sí | Funcionalidad de la app: rutinas, actividad, peso, composición, dieta y medidas | Proveedor BYOK o denuncia confirmada |
| Photos and videos › Photos | Sí | No | Sí | Funcionalidad de la app: estimación nutricional a partir de hasta seis fotos | Solo las imágenes elegidas en el estimador; las fotos de progreso siguen locales |
| Messages › Other in-app messages | Sí | No | Sí | Funcionalidad de la app: generar una respuesta o revisar una denuncia | Proveedor BYOK; denuncia borrada a los 30 días |
| Other user-generated content | Sí | No | Sí | Funcionalidad de la app: detalles opcionales escritos al denunciar | Denuncia in-app; cuerpo borrado a los 30 días |
| Device or other IDs | Sí | No | Sí | Seguridad y prevención del fraude: rate limiting del backend opcional | HMAC de IP, máximo 48 h; nunca IP en claro en D1 |
| App activity › App interactions | No | No | — | Funcionalidad de la app | `user_prefs.v1`, `backup_meta.v1` |
| App info and performance › Diagnostics | No | No | — | Depuración local | `gymnasia_debug_traces` |
| Financial info | No | No | — | No se tratan | — |
| Location | No | No | — | No se solicita ningún permiso de ubicación | `policy.json` |
| Contacts, Calendar, SMS, Audio | No | No | — | No se tratan | — |

### Preguntas transversales

- **Is all of the user data collected by your app encrypted in transit?** Sí. Todos los
  destinos declarados usan HTTPS; el inventario no admite ningún host que no lo sea.
- **Do you provide a way for users to request that their data is deleted?** Sí. La
  aplicación incluye una acción de restablecimiento y la política explica el borrado
  completo desde los ajustes del sistema, en la sección `#eliminacion`.
- **Is collection optional?** Sí. El seguimiento local funciona sin proveedor de IA y
  las incidencias requieren una acción y confirmación expresas.
- **Is the data processed ephemerally?** No. Gymnasia no controla la conservación de
  los proveedores elegidos y las denuncias tienen plazos propios.
- **Data types collected by third-party SDKs**: ninguno. La app no incorpora SDK de
  analítica, publicidad ni crash reporting; las llamadas a proveedores son transporte
  directo implementado por la aplicación y ya están declaradas arriba.
- **Credenciales heredadas de funciones retiradas**: pueden permanecer cifradas en el
  llavero tras actualizar, pero el build actual no las lee ni las transmite y el
  restablecimiento las elimina. Al no salir del dispositivo, no cuentan como
  `Collected` ni `Shared`.

---

## 2. Health apps declaration

- **¿La app ofrece funciones de salud?** Sí: seguimiento de entrenamiento, nutrición y
  composición corporal.
- **Categoría**: bienestar y forma física. **No** es una app médica.
- **¿Es un dispositivo médico?** No. No diagnostica, trata, cura ni previene ninguna
  enfermedad.
- **¿Usa Health Connect?** No.
- **¿Recoge datos de salud de fuentes externas?** No. Todos los datos los introduce el
  usuario a mano.
- **Texto de descargo mostrado en la app** (idéntico al de la política y al de
  `MEDICAL_DISCLAIMER` en `apps/mobile/agent/generated/legalCopy.generated.ts`):

  > Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un
  > profesional sanitario.

- **Dónde aparece**: al pie de la pantalla de Ajustes, visible en todas sus pestañas, y
  en la sección `#no-dispositivo-medico` de la política.

---

## 3. Declaración de IA generativa

- **¿La app incluye funciones de IA generativa?** Sí: un asistente conversacional y un
  estimador de valores nutricionales a partir de imágenes.
- **Modelos empleados**: modelos de terceros (OpenAI, Anthropic, Google) invocados
  directamente desde el dispositivo. No hay modelos propios ni entrenamiento con datos
  de usuarios.
- **¿Quién aporta las credenciales?** El usuario, con su propia cuenta. Sin clave
  configurada no hay ninguna función de IA activa.
- **Divulgación de que el interlocutor es una IA**: implementada en
  `apps/mobile/agent/aiTransparency.ts`, con una tarjeta de divulgación y una leyenda
  permanente en las tres superficies conversacionales.
- **Salvaguardas**: instrucciones de sistema que prohíben al asistente presentarse como
  persona o profesional sanitario, más la política sanitaria canónica de
  `policy/health-safety/`, creada en GYM-145 (ticket para crear una suite de seguridad
  sanitaria para cambios del agente), que cubre ayunos prolongados, pérdida extrema de
  peso, trastornos alimentarios, menores, embarazo, diabetes, medicación, lesiones,
  dolor agudo y emergencias. Sus reglas alimentan el bloque `HEALTH-SAFETY` del prompt y
  una puerta determinista en CI (`npm run check:health-safety`), documentada en
  `docs/architecture/health-safety-policy.md`. La clasificación local intercepta riesgo
  alto o crítico antes de cualquier proveedor; la evaluación adicional con el proveedor
  BYOK está desactivada por defecto y requiere consentimiento separado por proveedor.
- **Mecanismo de denuncia de respuestas**: acción **Denunciar** dentro de la aplicación
  en las respuestas finales visibles de los tres chats y en las intervenciones sanitarias
  locales. Excluye introducciones, errores técnicos, streaming y razonamiento interno.
  Antes de enviar exige un motivo y muestra una vista previa exacta con la pregunta
  anterior y la respuesta. El correo maximofn@maximofn.com queda como alternativa.

---

## 4. Permisos y su justificación

La fuente es `scripts/android-permissions/policy.json`; aquí solo se recoge su impacto
en Data safety, que el guard rail verifica en `permissionDataSafetyImpact`.

| Permiso | Impacto en Data safety | Justificación |
|---|---|---|
| `SCHEDULE_EXACT_ALARM` | Ninguno | Aviso puntual de fin de descanso |
| `WAKE_LOCK` | Ninguno | Despertar la pantalla para ese aviso |
| `VIBRATE` | Ninguno | Vibración configurable del aviso |
| `RECEIVE_BOOT_COMPLETED` | Ninguno | Reprogramar avisos tras reiniciar |
| `FOREGROUND_SERVICE` | Ninguno | Declarado sin uso; retirada trazada en GYM-186 (ticket para conciliar la configuración Expo con Android) |

`USE_EXACT_ALARM`, `REQUEST_INSTALL_PACKAGES`, `RECORD_AUDIO` y
`SYSTEM_ALERT_WINDOW` están bloqueados expresamente. Gymnasia no instala APK externos,
no graba audio y no dibuja sobre otras aplicaciones. `expo-av` se configura además con
`microphonePermission: false`; el bloqueo impide que un cambio de dependencia vuelva a
introducir el micrófono sin romper el guard rail.

Permisos que aportan las dependencias al manifest fusionado y que sí afectan a la
declaración: `CAMERA`, `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE` (de
`expo-image-picker`) sostienen la categoría *Photos and videos*.

`MODIFY_AUDIO_SETTINGS` no trata datos y se conserva: `expo-av` lo necesita para
configurar el enrutado y las interrupciones de los avisos sonoros de descanso.

⚠️ **Verificar sobre el artefacto, no sobre el fuente.** La primera build production de
la PR de GYM-197 (ticket para preparar la ficha española de Google Play) demostró que
`RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW` podían sobrevivir al manifest fusionado aunque no
estuvieran en `android.permissions`. El primero procedía del plugin de `expo-av`; el
segundo, del manifest debug de React Native. Esa build quedó invalidada. GYM-198 (ticket
para generar y validar el Android App Bundle de producción) debe comprobar de nuevo el
AAB final y bloquearlo si reaparece cualquiera de los dos.

---

## 5. Campos que requieren la consola

- Envío efectivo del formulario de Data safety y de las declaraciones de salud e IA.
- Clasificación de contenido (cuestionario IARC).
- Público objetivo y edades.
- Declaración de anuncios: la app no muestra publicidad.
- **App access**: la revisión necesita la credencial BYOK temporal preparada en GYM-196
  (ticket para preparar credenciales BYOK temporales para la revisión de Google Play).
- Ficha, capturas y textos: GYM-197 (ticket para preparar la ficha española de Google
  Play).
