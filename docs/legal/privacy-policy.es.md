---
version: 2026-08-v4
effective_date: 2026-08-24
locale: es
lang: es
title: Política de privacidad de Gymnasia
url: https://gymnasia.maximofn.com/privacidad
alternate_locale: en
alternate_url: https://gymnasia.maximofn.com/privacy
contact: maximofn@maximofn.com
controller: "Máximo Fernández Núñez"
toc_title: Contenido
---

## Resumen {#resumen}

Gymnasia funciona **en tu dispositivo**. No hay cuenta, no hay registro y no existe
ningún servidor de Gymnasia que reciba tus datos. Tus entrenamientos, tu dieta, tu
peso, tus medidas y tus conversaciones con el asistente se guardan en el almacenamiento
de la propia aplicación.

Hay una excepción importante y es enteramente tuya: si activas el asistente de
inteligencia artificial, **tú** aportas la clave de un proveedor (OpenAI, Anthropic o
Google) y la aplicación habla **directamente** con ese proveedor desde tu dispositivo.
Lo que escribas en el chat viaja a la empresa que hayas elegido, bajo tu propia cuenta
con ella. Nosotros no lo vemos, no lo almacenamos y no podemos recuperarlo.

Esta política describe con detalle qué se guarda, qué sale del dispositivo y qué
control tienes sobre ello.

## Quién es responsable {#responsable}

Responsable del tratamiento: **Máximo Fernández Núñez**.

Contacto para cualquier cuestión relacionada con la privacidad, incluido el ejercicio
de tus derechos y la denuncia de una respuesta del asistente: **maximofn@maximofn.com**.

Gymnasia es un proyecto personal. No hay departamento de soporte ni delegado de
protección de datos designado.

## No hay cuenta ni servidor {#sin-cuenta}

Gymnasia no te pide un correo, ni una contraseña, ni un nombre de usuario para
funcionar. No existe ningún sistema de cuentas.

Gymnasia no guarda tus datos en ningún servidor. La aplicación no los envía a
infraestructura controlada por el responsable, ni para almacenarlos, ni para hacer
copias de seguridad, ni para analítica. La única excepción es el envío de propuestas de
mejora, que solo ocurre cuando tú lo apruebas expresamente y que nunca incluye tus datos
personales (ver [Terceros](#terceros)). **No hay analítica, ni telemetría, ni informes
de fallos automáticos**: la aplicación no incorpora ningún SDK de ese tipo.

## Qué datos guarda la aplicación {#datos}

Todo lo siguiente se guarda únicamente en tu dispositivo:

- **Actividad de entrenamiento**: rutinas, ejercicios, series, repeticiones, cargas en
  kilogramos, duración de las sesiones, descansos y el volumen y las calorías estimadas.
- **Nutrición**: lo que registras cada día, con gramos, calorías, proteínas, hidratos y
  grasas; los alimentos que creas tú; y las recetas y productos que guardas.
- **Peso y composición corporal**: peso, porcentaje de grasa corporal, y los perímetros
  de cuello, pecho, cintura, cadera, bíceps, cuádriceps y gemelo, con su fecha.
- **Datos personales de cálculo**: sexo, altura, fecha de nacimiento, objetivo (definición,
  volumen o mantenimiento) y nivel de actividad. Se usan para estimar tus calorías y
  macronutrientes.
- **Conversaciones con el asistente**: el historial completo de tus hilos de chat,
  incluidos los mensajes del modelo.
- **Memoria del asistente**: notas en texto libre que tú o el propio asistente guardáis
  para recordar cosas entre conversaciones. Puede contener cualquier dato que hayas
  contado en el chat, incluidos datos de salud.
- **Credenciales heredadas de funciones retiradas**: si una versión anterior guardó
  credenciales en el llavero seguro, una actualización normal puede conservarlas
  cifradas para reutilizarlas si la función vuelve. La versión actual no las lee ni las
  transmite. «Restablecer datos locales» las elimina.
- **Preferencias**: ajustes de la interfaz y de las notificaciones, y tu consentimiento
  por proveedor para la evaluación adicional opcional de seguridad sanitaria.
- **Registro de depuración**: un histórico técnico de hasta 1000 entradas con los avisos
  de fin de descanso entregados, que incluyen el nombre del ejercicio y el número de
  serie. Nunca se envía por red; puedes verlo y borrarlo desde Ajustes.

## Dónde se guarda {#almacenamiento-local}

En el almacenamiento privado de la aplicación dentro de tu dispositivo. En Android,
otras aplicaciones no pueden leerlo.

Las **claves de API** y, si proceden de una versión anterior, las credenciales
heredadas de funciones retiradas reciben un trato distinto: se guardan en el llavero
seguro del sistema operativo, separadas del resto.

Si tu dispositivo tiene activada la copia de seguridad de Android, el sistema operativo
puede incluir los datos de la aplicación en la copia de tu cuenta de Google. Eso lo
gobiernan los ajustes de tu dispositivo y la política de privacidad de Google, no esta
aplicación.

## Tu clave de API {#byok}

El asistente funciona con el modelo de **clave propia**: no se incluye ninguna clave en
la aplicación, y tú introduces la de tu cuenta con OpenAI, Anthropic o Google.

- La clave se guarda **en el llavero seguro de tu dispositivo** y no se envía a ningún
  servidor del responsable, porque no existe tal servidor.
- La clave se envía **únicamente al proveedor al que corresponde**, en cada petición,
  como exige su API.
- La clave **no se incluye** en el fichero de copia de seguridad que exportas.
- Puedes borrarla en cualquier momento desde Ajustes.

**En el navegador la protección es menor.** La versión web de Gymnasia se ejecuta en un
navegador, donde no existe el llavero del sistema operativo: allí la clave se guarda en
el almacenamiento del navegador junto al resto de los datos, sin esa capa adicional de
protección. La aplicación te lo advierte en la pantalla de configuración del proveedor.
Si esto te preocupa, usa la aplicación móvil.

## Qué envía la aplicación a los proveedores de IA {#proveedores}

Cuando usas el asistente, tu dispositivo se conecta **directamente** con el proveedor
que hayas elegido. La petición incluye:

- las instrucciones del sistema del asistente;
- **los últimos 20 mensajes** del hilo de conversación;
- los resultados de las herramientas que el asistente utiliza a petición tuya, que
  pueden incluir tu peso, tu porcentaje de grasa, tus perímetros, las comidas del día
  o tus rutinas;
- en el estimador de comida, **las imágenes que le proporcionas**, codificadas dentro
  de la petición.

Si activas en Ajustes la **evaluación adicional de seguridad sanitaria** para un
proveedor, el texto actual puede enviarse a ese mismo proveedor en una petición de
clasificación separada antes de generar la respuesta normal. Esta opción está
desactivada por defecto, requiere consentimiento independiente para cada proveedor y
puedes revocarla en cualquier momento. Los mensajes que la comprobación local clasifica
como riesgo alto o crítico se interceptan en el dispositivo y no se envían al proveedor.

Ese contenido queda sujeto a la política de privacidad y a los términos del proveedor
que hayas elegido, bajo tu propia cuenta con él:

- [OpenAI](https://openai.com/policies/privacy-policy)
- [Anthropic](https://www.anthropic.com/legal/privacy)
- [Google](https://policies.google.com/privacy)

Si no configuras ninguna clave, la aplicación no contacta con ningún proveedor de IA y
el resto de funciones sigue operativa.

## Fotografías {#fotos}

Gymnasia usa la cámara y la galería en dos sitios, y los trata de forma distinta:

- **Estimador de comida**: las imágenes que eliges (hasta seis) se envían al proveedor
  de IA para estimar los valores nutricionales. No se guardan en la aplicación ni se
  suben a ningún otro sitio.
- **Fotografías de progreso** asociadas a una medición: **no salen de tu dispositivo**.
  La aplicación guarda solo una referencia al fichero. Esa referencia sí se incluye en
  la copia de seguridad que exportas, y el asistente puede verla si consulta esa
  medición.

## Terceros con los que se comunica la aplicación {#terceros}

Además de los proveedores de IA:

- **GitHub** (`raw.githubusercontent.com`, `api.github.com`, `github.com`): la
  aplicación descarga los catálogos públicos de ejercicios, alimentos, productos y
  recetas, sus imágenes y las instrucciones del asistente; consulta qué versión de esas
  instrucciones le corresponde; y comprueba si hay una versión nueva publicada. **No se
  envía ningún dato tuyo**, pero GitHub, como cualquier servidor al que te conectas, ve
  tu dirección IP.
- **Backend de incidencias de Gymnasia** (`gymnasia-feedback.maximofn.com`): solo si tú
  lo pides. Cuando propones una mejora al asistente, o cuando añades un alimento o un
  ejercicio que no está en el catálogo, la aplicación te muestra antes el título y el
  resumen exactos y **no envía nada hasta que lo apruebas**. Lo que se envía es
  únicamente ese título, ese resumen, el tipo de propuesta y un identificador técnico
  para no crear duplicados. **No se envía el texto de tu conversación, ni tus datos de
  dieta, entrenamiento o medidas, ni ningún identificador tuyo.** El servicio lo opera el
  responsable sobre infraestructura de Cloudflare y crea con tu propuesta una ficha en un
  repositorio **privado** de GitHub, visible solo para el responsable. Antes de guardarla,
  el servicio borra automáticamente cualquier clave o contraseña que hubieras pegado por
  error. Si no propones nada, este servicio no se usa nunca.
- **Open Food Facts** (`world.openfoodfacts.org`): si el asistente lee un código de
  barras en una foto tuya, consulta ese código en su base de datos pública para obtener
  la información nutricional del producto. Se envía el código de barras, no la imagen.
## Copias de seguridad y exportación {#copias}

Puedes exportar todos tus datos a un fichero JSON desde Ajustes, y volver a importarlo
después. Es una acción manual: no hay copia automática.

El fichero exportado **contiene**: tus medidas y porcentajes de grasa, la referencia a
tus fotografías de progreso, tu registro de dieta completo, tu historial de
entrenamiento, tus ajustes personales (sexo, altura, fecha de nacimiento), la memoria
del asistente y **el historial íntegro de tus conversaciones**. Es el fichero más
sensible que produce la aplicación: guárdalo con cuidado y piensa a quién se lo envías.

El fichero **no contiene** tus claves de API ni las credenciales heredadas de funciones
retiradas.

Al exportar, el fichero se escribe en el almacenamiento temporal de la aplicación antes
de que elijas dónde compartirlo, y esa copia temporal permanece ahí. Puedes eliminarla
borrando los datos de la aplicación desde los ajustes del sistema.

## Denunciar una respuesta del asistente {#denuncia}

Si el asistente genera una respuesta inapropiada, peligrosa o incorrecta, escribe a
**maximofn@maximofn.com** describiendo lo ocurrido. Puedes adjuntar el texto de la
respuesta si quieres, pero **no envíes tu clave de API** ni datos que prefieras no
compartir: revisa lo que copias antes de mandarlo.

Las denuncias se revisan manualmente y pueden dar lugar a cambios en las instrucciones
del asistente o en sus salvaguardas. En este momento la denuncia se gestiona por correo;
una versión futura incorporará una acción dentro de la propia aplicación.

## Permisos que solicita la aplicación {#permisos}

- **Notificaciones, alarmas exactas, vibración y activación de pantalla**: para avisarte
  cuando termina un descanso, incluso con la pantalla apagada.
- **Ejecución tras reiniciar el dispositivo**: para reprogramar esos avisos.
- **Cámara y acceso a imágenes**: solo cuando eliges una foto para el estimador de comida
  o para una medición.

Ninguno de estos permisos se usa para recoger datos en segundo plano. Las notificaciones
son locales: se generan en tu dispositivo y no hay notificaciones push desde un servidor.

## La versión web {#web}

Gymnasia también puede usarse en un navegador. El funcionamiento es el mismo, con dos
diferencias que debes conocer:

- Los datos se guardan en el **almacenamiento del navegador**, no en el almacenamiento
  privado de una aplicación instalada. Borrar los datos del sitio los elimina.
- **La clave de API no queda protegida por el llavero del sistema operativo**, como se
  explica en el apartado anterior.

## Cuánto tiempo se conservan tus datos {#conservacion}

Indefinidamente, mientras tú los mantengas. Como los datos no salen de tu dispositivo,
no existe ningún plazo de conservación en servidor que aplicar: los conservas tú y los
borras tú.

Los datos que hayas enviado a un proveedor de IA se rigen por el plazo de conservación
de ese proveedor, según tu cuenta con él.

## Cómo eliminar tus datos {#eliminacion}

Con transparencia sobre lo que hace hoy cada opción:

**"Restablecer datos locales"** (Ajustes) es un borrado **parcial**. Elimina tus
rutinas, tu historial de entrenamiento, tu dieta, tus medidas, tus conversaciones, tus
claves de API y las credenciales cifradas heredadas de funciones retiradas.
**No elimina**: la memoria del asistente, los alimentos que has creado, tus preferencias,
el registro de depuración, las copias de seguridad que hayas exportado ni los catálogos
descargados. Estamos trabajando en que esta acción borre todo lo que promete; hasta
entonces, esta política describe su comportamiento real.

**El registro de depuración** se borra con su propio botón, en Ajustes → Trazas.

**Borrado completo**: elimina los datos de la aplicación desde los ajustes de tu
dispositivo, o desinstálala. Eso elimina todo lo anterior sin excepción. Recuerda que
los ficheros de copia de seguridad que hayas exportado y guardado en otro sitio
sobreviven, y que las fotografías tomadas con la cámara siguen en tu galería.

**Datos en poder de un proveedor de IA**: se solicitan directamente a ese proveedor,
desde tu cuenta con él. Gymnasia no puede borrarlos por ti.

## Menores {#menores}

Gymnasia no está dirigida a menores de 14 años y no verifica la edad de quien la usa.
Si eres menor de edad, usa la aplicación con el consentimiento y la supervisión de una
persona responsable de ti, especialmente en lo relativo a entrenamiento y alimentación.

## Tus derechos {#derechos}

El Reglamento General de Protección de Datos te reconoce los derechos de acceso,
rectificación, supresión, limitación, portabilidad y oposición.

En Gymnasia esos derechos se ejercen, en la práctica, **sin intermediario**, porque el
responsable no dispone de tus datos:

- **Acceso y portabilidad**: la función de exportación te entrega todos tus datos en un
  fichero JSON estándar.
- **Rectificación**: puedes editar cualquier dato dentro de la aplicación.
- **Supresión**: consulta el apartado anterior.
- **Oposición y limitación**: deja de usar las funciones que envían datos a terceros;
  sin clave de API configurada, no se envía nada a ningún proveedor de IA.

Si crees que el tratamiento no cumple la normativa, puedes escribir a
**maximofn@maximofn.com** y presentar una reclamación ante la Agencia Española de
Protección de Datos ([aepd.es](https://www.aepd.es)).

## Gymnasia no es un dispositivo médico {#no-dispositivo-medico}

**Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un
profesional sanitario.**

La aplicación no diagnostica, no trata, no cura ni previene ninguna enfermedad. Sus
cálculos de calorías, macronutrientes y composición corporal son **estimaciones**
basadas en fórmulas generales, no mediciones clínicas.

El asistente de inteligencia artificial **no es una persona** y puede equivocarse. No
es médico, ni nutricionista, ni entrenador acreditado, aunque su tono pueda parecerlo.
No sigas sus indicaciones sobre salud, lesiones, medicación o restricción alimentaria
sin contrastarlas con un profesional cualificado.

Consulta a un profesional sanitario antes de empezar un programa de entrenamiento o un
plan de alimentación, especialmente si tienes alguna condición médica, estás embarazada
o tomas medicación.

## Cambios en esta política {#cambios}

Cuando cambie lo que la aplicación hace con tus datos, esta política se actualiza y su
versión y fecha cambian con ella. La versión vigente es la que aparece al principio de
este documento.

## Contacto {#contacto}

**maximofn@maximofn.com**
