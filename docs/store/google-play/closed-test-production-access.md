# Prueba cerrada y acceso a producción de Google Play

Estado actualizado el **18 de octubre de 2026** para GYM-200 (ticket para
coordinar la prueba cerrada) y GYM-201 (ticket para publicar primero en España).
La solicitud se envió el **15 de octubre de 2026 a las 13:55, hora de Madrid**.
El **18 de octubre** se comprueba directamente en Play Console que Google ha
concedido el acceso a producción, después de que el mantenedor comunique el
correo de aprobación. El panel mantiene Producción como **Inactivo**: el
lanzamiento público inicial en España sigue pendiente.

## Cumplimiento de la cohorte

El [panel de control de Gymnasia](https://play.google.com/console/u/0/developers/8108994737998375347/app/4972645631625321604/app-dashboard)
mostraba completadas el 15 de octubre las tres tareas:

- Publicar una versión de prueba cerrada.
- Tener al menos 12 testers que hayan aceptado participar.
- Ejecutar la prueba cerrada con al menos 12 testers durante al menos 14 días.

![Play Console confirma las tres tareas completadas y permite solicitar acceso a producción](evidence/closed-test-eligible-2026-10-15.jpg)

El mantenedor confirma que los 12 testers llevan más de 14 días. El grupo
configurado de distribución contiene 14 personas; ese tamaño de lista no se
usa como sustituto del cumplimiento reconocido por Play. No se fija una fecha
de inicio individual que la pantalla no muestra ni se publican los correos de
los participantes. El objetivo inicial de reclutar 15 personas era un margen;
el requisito de Google que se acredita es el mínimo de 12.

## Pruebas y cambios derivados del feedback

Los testers enviaron comentarios y capturas al mantenedor, registrados en
GYM-243 (ticket para resolver las incidencias comunicadas por los testers).

| Incidencia | Resultado documentado |
| --- | --- |
| GYM-245 (ticket para permitir registrar peso desde el plan de dieta) | Corrección publicada en la versión 1.45.0; QA del mantenedor en Android y pruebas de persistencia, dieta y agente. |
| GYM-246 (ticket para mostrar las preferencias de forma legible) | Corrección publicada en 1.45.1; QA del mantenedor en Android y pruebas unitarias, de contrato y de propiedades. |
| GYM-247 (ticket para impedir activar la evaluación sanitaria sin clave) | Cerrado con pruebas unitarias, E2E con proveedor interceptado, migración y propiedades del consentimiento. |
| GYM-249 (ticket para evitar el solapamiento con las barras de Android) | Corrección en 1.45.4; el tester que lo reportó confirmó el 8 de octubre que ya funciona en su dispositivo. |
| GYM-244 (ticket para investigar el Coach sin snapshot firmado) | Sigue abierto. El mantenedor confirmó el 15 de octubre que Coach responde sin ese error en su móvil actualizado desde Play. Esa confirmación no completa por sí sola la investigación histórica, el mensaje accionable y todos los criterios del ticket. |
| GYM-256 (ticket para situar el descanso en el ejercicio cuya serie se completó) | Sigue abierto; una captura del 9 de octubre muestra el temporizador en el ejercicio anterior al completar una serie fuera de orden. El 15 de octubre el mantenedor autoriza solicitar acceso declarando el fallo y mantener su corrección en el roadmap; no se presenta como resuelto. |

GYM-199 (ticket para publicar y validar el AAB en pruebas cerradas) está cerrado.
Su evidencia recoge la versión 1.50.1 (80), publicada en Alpha, y la confirmación
del mantenedor del 15 de octubre: arranque, entrenamiento y guardado,
notificación de descanso, BYOK, Coach y denuncia en un móvil actualizado desde
Play. No se atribuye esa ejecución a todos los testers ni se infiere una
versión instalada que el mantenedor no indicó.

El [acceso del revisor](reviewer-access.md) está preparado y comprobado. La
actualización de sus instrucciones se envió a revisión el 15 de octubre; ese
envío es distinto de la solicitud de acceso a producción.

## Respuestas enviadas

Los campos de texto del cuestionario admiten **300 caracteres**. Se avanzó
por sus tres secciones con **Siguiente** y se envió desde **Aplicar**. Las
siguientes respuestas respetan el límite y conservan el fallo conocido.

### Reclutamiento

> Recluté a conocidos mediante mensajes en varios grupos de WhatsApp, preguntando quién quería probar Gymnasia. Añadí al grupo de prueba cerrada a las personas que respondieron voluntariamente que querían participar.

Dificultad seleccionada: **Ni difícil ni fácil**. Es una valoración neutra
al no constar una dificultad concreta; el método de reclutamiento es el
comunicado expresamente por el mantenedor.

### Interacción de los testers

> El uso incluyó rutinas y sesiones de entrenamiento, medidas y dieta, ajustes y Coach con clave propia. Los testers detectaron problemas durante el uso real y enviaron capturas y comentarios al mantenedor. No contamos con una medición de cobertura por persona.

### Comentarios recibidos

> Recibimos comentarios y capturas directamente al mantenedor y los registramos en tickets. Corregimos el solapamiento con barras Android, preferencias ilegibles, el registro de peso y la evaluación sanitaria sin clave. Sigue abierta una incidencia de colocación del temporizador de descanso.

### Público objetivo

> Personas de 16 años en adelante interesadas en organizar entrenamientos, alimentación y medidas corporales. La IA es opcional y requiere una clave propia del proveedor elegido. Gymnasia no es un dispositivo médico.

### Valor de la aplicación

> Reúne rutinas, sesiones, dieta, medidas y seguimiento del progreso en una app que conserva los datos principales en el dispositivo. Permite añadir un Coach y estimador de comida con IA mediante una clave propia, con identificación como IA y denuncia de respuestas.

### Previsión de descargas

Se seleccionó **No lo sé**, opción disponible en Play, al no contar con una
estimación del primer año.

### Cambios tras la prueba

> Corregimos los márgenes de Android, la presentación de preferencias, el registro de peso desde la dieta y el consentimiento sanitario sin clave. Se validó la actualización desde Play y el uso de Coach. Sigue pendiente revisar el anclaje visual del temporizador de descanso.

### Preparación para producción

> Se validaron desde Play arranque, entrenamiento, guardado, notificaciones, BYOK, Coach y denuncia. Play acredita 12 testers durante 14 días. El mantenedor acepta el fallo visual del temporizador como pendiente del roadmap y autoriza solicitar acceso.

![La sección final declara el fallo del temporizador como pendiente del roadmap](evidence/production-access-final-answers-2026-10-15.jpg)

## Recepción de la solicitud

El 15 de octubre Play Console mostraba **Hemos recibido tu solicitud de acceso a producción** y
**Solicitud enviada el hoy, 13:55**. Indicaba que revisaba el formulario y
avisaría por correo al propietario, con un plazo orientativo de siete días
o menos que podía ser mayor.

![Google Play confirma la recepción del formulario y su revisión](evidence/production-access-submitted-2026-10-15.jpg)

La autorización del mantenedor permite solicitar acceso con GYM-256 (ticket
para situar el descanso en el ejercicio correcto) declarado como pendiente.
Esa decisión mantiene el fallo en el roadmap y no lo convierte en una
corrección ni completa sus pruebas. GYM-244 (ticket para investigar el Coach
sin snapshot) conserva sus criterios técnicos pendientes; la evidencia
funcional de Coach se limita a la QA confirmada por el mantenedor.

## Acceso concedido comprobado el 18 de octubre

El mantenedor comunica el correo que concede acceso a Gymnasia
(`com.maximofn.gymnasia`). La lectura directa del panel confirma el mensaje
**¡Enhorabuena! Tu aplicación tiene acceso a producción en Google Play** y
que la solicitud se ha concedido. La comprobación se fecha el 18 de octubre;
no se deduce del correo una hora o una fecha anterior de aprobación que no
contiene el texto aportado.

![Play Console confirma que el acceso a producción se ha concedido](evidence/production-access-granted-2026-10-18.jpg)

La aprobación acredita el acceso al canal. La evidencia del E2E individual
es independiente: el 18 de octubre el mantenedor confirma expresamente que
los 12 participantes instalaron la app, completaron un entrenamiento y usaron
el chat.

## Evidencias del checklist de coordinación

La revisión del 18 de octubre conserva la procedencia y la fecha de cada
prueba. Las ejecuciones históricas no se presentan como pruebas nuevas.

| Categoría | Resultado y evidencia |
| --- | --- |
| Unitarios | No aplica: la tarea coordina una cohorte externa y no añade lógica de aplicación. Las pruebas del código permanecen en sus tickets y en la evidencia del AAB. |
| E2E | El mantenedor confirma expresamente el 18 de octubre que los 12 participantes instalaron la app, completaron un entrenamiento y usaron el chat. Se registra como confirmación humana de la cohorte, separada de la QA del mantenedor del 15 de octubre en GYM-199 (ticket para validar la distribución cerrada) y de la aprobación de Google. No se inventan fechas, dispositivos ni versiones por participante. |
| Integración con proveedor falso | Evidencia heredada del AAB 1.50.1 (80) en GYM-199 (ticket para validar la distribución cerrada): `test:agent:e2e` con OpenAI falso correcto. El acceso real del revisor se probó adicionalmente el 15 de octubre con su credencial dedicada, respuesta `7`, HTTP 200 y evento terminal de Gemini; el caso seguro está en `reviewer-access.md`. No se distribuye ni se registra esa credencial como parte de esta formalización. |
| Contrato | Cumplimiento de 12 testers durante 14 días comprobado el 15 de octubre; solicitud recibida ese día y acceso concedido comprobado en Play el 18 de octubre. Capturas y respuestas conservadas en este expediente. |
| Regresión | Peso y preferencias: QA del mantenedor del 18 de septiembre en las versiones 1.45.0 y 1.45.1; márgenes de Android: confirmación del tester del 8 de octubre en GYM-249 (ticket para evitar el solapamiento con barras); consentimiento sanitario: E2E con proveedor interceptado y migración en GYM-247 (ticket para impedir activar la evaluación sanitaria sin clave); Coach y flujos principales: QA nativa del mantenedor del 15 de octubre. Se conservan las excepciones del temporizador y el alcance técnico pendiente del snapshot, sin atribuir su corrección. |
| Fuzzing / property-based | No aplica: no hay lógica o espacio de entradas nuevo en la coordinación de personas. Las propiedades de las correcciones se conservan en sus tickets. |

La regresión documenta las comprobaciones del mantenedor, el tester y las
pruebas automáticas citadas; no afirma que todos los participantes hayan
repetido todas las correcciones. El E2E individual queda resuelto con la
confirmación humana del mantenedor del 18 de octubre sobre instalación,
entrenamiento y chat para los 12 participantes.

## Cierre de la coordinación el 18 de octubre

GYM-200 (ticket para coordinar los 12 testers durante 14 días) queda cerrado
con las seis categorías resueltas o justificadas como no aplicables. La
previsualización del cierre protegido fue válida y se guardó el comentario
de evidencias antes de pasar el ticket a Done. La confirmación del mantenedor
sobre los 12 participantes resuelve el último E2E pendiente; la aprobación de
Google conserva su evidencia independiente.

El cierre de la coordinación no cierra las incidencias técnicas ni publica
la app. GYM-201 (ticket para publicar primero en España) continúa con las
comprobaciones de lanzamiento pendientes.

## Caso seguro para comprobar Coach

En una instalación o actualización desde Play, configurar una clave propia
del proveedor elegido, sin compartirla ni incorporarla a las evidencias.
Enviar **What is 3 + 4?**, comprobar una respuesta completa con el resultado
**7** y registrar solo fecha, versión y resultado. Una rutina y datos ficticios
permiten probar el guardado sin recopilar datos de salud de los participantes.
La integración con proveedor falso pertenece a las pruebas automáticas; no
se presenta como un modo disponible en la build BYOK de producción.

## Siguiente fase

El acceso concedido permite preparar el lanzamiento inicial limitado a España
en GYM-201 (ticket para publicar primero en España), con sus comprobaciones de
artefacto, disponibilidad y estabilidad. La app continúa sin una versión
pública activa en el panel consultado el 18 de octubre. GYM-244 (ticket para
investigar el Coach sin snapshot) y GYM-256 (ticket para situar el descanso en
el ejercicio correcto) conservan sus estados y sus pruebas propias.

## Referencias

- [Requisitos y cuestionario de acceso a producción de Google Play](https://support.google.com/googleplay/android-developer/answer/14151465?hl=es).
- [Distribución en Prueba cerrada Alpha](production-promotion-gates.md).
- [Matriz de ficha, audiencia y declaraciones](console-matrix.md).
