# Declaraciones de Google Play — respuestas preparadas (GYM-190)

Respuestas listas para copiar en Play Console cuando la cuenta exista (GYM-194 y
GYM-195). **Este documento no se rellena en la consola dentro de GYM-190**: su alcance
es dejarlas escritas, verificadas contra el código y coherentes con la política.

| Campo | Valor |
|---|---|
| Política que las respalda | `docs/legal/privacy-policy.es.md`, versión `2026-08-v1` |
| URL pública | <https://gymnasia.maximofn.com/privacidad> |
| Contacto | maximofn@maximofn.com |
| Inventario que las sustenta | `scripts/data-inventory/inventory.json` |
| Verificación | `npm run check:data-inventory && npm run check:legal` |

> Antes de copiar nada a la consola, vuelve a pasar los dos `check`. Si el código ha
> cambiado desde la última edición de este documento, fallarán y dirán qué revisar.

---

## 1. Data safety

### Interpretación aplicada

Google define **Collected** como los datos que salen del dispositivo hacia los
servidores del desarrollador. Gymnasia no tiene servidores: nada llega al
desarrollador, ni siquiera de forma efímera.

Sí salen datos hacia **terceros que el usuario elige** (su proveedor de IA, con su
propia clave). Para eso Google contempla una exención expresa de *Sharing*:
transferencias a un tercero **basadas en una acción concreta iniciada por el usuario**,
en las que el usuario espera razonablemente que sus datos se compartan. Configurar una
clave de API propia y escribir en un chat encaja en esa exención.

**Decisión**: declarar `Collected: No` y `Shared: No` para las categorías que solo
salen por esa vía, y documentar aquí el razonamiento. Es la lectura que corresponde a
la arquitectura real.

⚠️ **Confirmar antes de enviar la ficha.** Si en la revisión hay dudas, la alternativa
segura es declarar `Shared: Yes` con propósito *App functionality* y marcar los datos
como opcionales: es más conservador y nunca se considera una declaración falsa. Cambiar
de "no" a "sí" tras un rechazo cuesta una nueva revisión; al revés, no.

### Respuestas por categoría

| Categoría de Play | Collected | Shared | Opcional | Propósito | Respaldo |
|---|---|---|---|---|---|
| Health and fitness › Fitness info | No | No | — | Funcionalidad de la app | `gymnasia.mobile.local.v3` |
| Personal info › Name, Email | No | No | — | No se recogen | No hay cuenta |
| Personal info › Other info (sexo, altura, fecha de nacimiento) | No | No | — | Cálculo de calorías y macros | `dietSettings` en `local.v3` |
| Photos and videos › Photos | No | No | — | Estimación nutricional y seguimiento de progreso | Estimador y `photo_uri` |
| Messages › Other in-app messages | No | No | — | Conversación con el asistente | `threads`, `messagesByThread` |
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
- **Data types collected by third-party SDKs**: ninguno. La app no incorpora SDK de
  analítica, publicidad ni crash reporting.

### Credenciales de VivaGym

Mientras la integración de VivaGym siga en el build publicado, hay que declarar
`Personal info › Email` y credenciales de usuario, porque el usuario introduce el correo
y la contraseña de su cuenta de un tercero y ambos se envían a los servidores de
VivaGym. **Retirarla (GYM-192) antes de publicar elimina esta declaración entera** y es
la opción recomendada: evita declarar recogida de credenciales en una app de fitness.

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
  `policy/health-safety/` (GYM-145), que cubre ayunos prolongados, pérdida extrema de
  peso, trastornos alimentarios, menores, embarazo, diabetes, medicación, lesiones,
  dolor agudo y emergencias. Sus reglas alimentan el bloque `HEALTH-SAFETY` del prompt y
  una puerta determinista en CI (`npm run check:health-safety`), documentada en
  `docs/architecture/health-safety-policy.md`.
- **Mecanismo de denuncia de respuestas**: por correo a maximofn@maximofn.com,
  documentado en la sección `#denuncia` de la política.

  ⚠️ La política de IA generativa de Google Play puede exigir un mecanismo de denuncia
  **dentro de la aplicación**. GYM-189 lo añade. Si la revisión lo reclama, esa es la
  dependencia que hay que cerrar; el correo es el canal de la versión actual.

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
| `FOREGROUND_SERVICE` | Ninguno | Declarado sin uso; retirada trazada en GYM-186 |

Permisos que aportan las dependencias al manifest fusionado y que sí afectan a la
declaración: `CAMERA`, `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE` (de
`expo-image-picker`) sostienen la categoría *Photos and videos*.

⚠️ **Verificar sobre el artefacto, no sobre el fuente.** El manifest de `expo prebuild`
en local arrastra además `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` y `SYSTEM_ALERT_WINDOW`
desde `expo-dev-client`. Si `RECORD_AUDIO` apareciese en el manifest fusionado del AAB
de producción, habría que declarar micrófono. Comprobarlo en GYM-198 con
`npm run check:android-permissions` y la inspección del artefacto.

---

## 5. Campos que requieren la consola (fuera del alcance de GYM-190)

- Envío efectivo del formulario de Data safety y de las declaraciones de salud e IA.
- Clasificación de contenido (cuestionario IARC).
- Público objetivo y edades.
- Declaración de anuncios: la app no muestra publicidad.
- **App access**: la revisión necesita una credencial BYOK temporal para probar el
  asistente → GYM-196.
- Ficha, capturas y textos → GYM-197.
