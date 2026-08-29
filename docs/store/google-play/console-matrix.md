# Matriz de Google Play — Gymnasia (es-ES)

Fuente canónica para GYM-197 (ticket para preparar la ficha española de Google
Play). Los textos de producto y el manifiesto de assets están en
`listing.es.json`; esta matriz contiene las respuestas que no forman parte de la
ficha pública.

## Ficha principal

| Campo de Play Console | Valor | Comprobación |
|---|---|---|
| Tipo | Aplicación | No es un juego |
| Nombre | Gymnasia | 8/30 caracteres |
| Descripción breve | Agente de IA para entrenamiento y nutrición, con tu propia clave | 64/80 caracteres |
| Descripción completa | `productDetails.fullDescription` de `listing.es.json` | Máximo 4.000 caracteres |
| Categoría | Salud y fitness | Describe rutinas, dieta y medidas |
| Correo de soporte | maximofn@maximofn.com | Obligatorio y visible |
| Sitio web | https://gymnasia.maximofn.com | HTTPS |
| Política de privacidad | https://gymnasia.maximofn.com/privacidad | Pública, HTML y sin login |

Las etiquetas preferidas, si aparecen con ese nombre en la consola, son:
Entrenamientos, Nutrición, Seguimiento de actividad, Control del peso y
Asistente personal. No sustituirlas por etiquetas médicas.

## Público, anuncios y clasificación

| Campo | Respuesta |
|---|---|
| Grupos de edad | 16–17 y 18+ |
| Diseñada para niños | No |
| Restringir acceso a menores | No; esa opción es solo para una audiencia exclusivamente 18+ |
| Anuncios | No contiene anuncios |
| Compras o suscripciones | No |
| Comunicación entre usuarios | No |
| Contenido público creado por usuarios | No |
| Contenido dinámico o generado por IA | Sí, cuando el cuestionario lo pregunte |
| Violencia, sexo, drogas, apuestas o lenguaje soez aportado por la app | No |
| Acceso web sin restricciones | No |
| Ubicación | No |

La clasificación IARC es independiente de la audiencia elegida. Se aceptará el
resultado que produzcan las respuestas reales; no se manipulará para obtener un
16+.

## App access

Seleccionar que parte de la funcionalidad requiere acceso especial. Texto para
el revisor:

> Gymnasia no requiere cuenta. Las rutinas, la dieta y las medidas funcionan al
> abrir la aplicación. Para probar las funciones de IA, abre Configuración →
> Proveedor IA → Google, pega la clave temporal proporcionada en el campo
> privado de acceso, pulsa Guardar y vuelve a Chat. La clave es exclusiva de la
> revisión, está limitada y se revocará cuando termine.

La clave de GYM-196 (ticket para preparar una credencial BYOK temporal para la
revisión de Google Play) se pega únicamente en el campo privado de Play Console.
Nunca se copia al repositorio, a una captura ni a un comentario.

## Data safety

Respuestas transversales:

- **Collected:** Yes.
- **Shared:** No.
- **Optional:** Yes para todos los tipos declarados.
- **Processed ephemerally:** No; Gymnasia no controla la retención del proveedor
  elegido y las denuncias tienen sus propios plazos.
- **Encrypted in transit:** Yes.
- **Deletion request mechanism:** Yes; borrado local desde Android/desinstalación,
  contacto para incidencias y gestión directa en la cuenta del proveedor.
- Sin analítica, publicidad, venta de datos ni personalización publicitaria.

| Tipo de datos | Recopilado | Compartido | Propósito y motivo |
|---|---:|---:|---|
| Personal info → User IDs | Sí | No | La clave BYOK identifica la cuenta ante el proveedor elegido; funcionalidad opcional |
| Personal info → Other info | Sí | No | Sexo, altura, fecha de nacimiento u otros datos que el usuario incluya en el contexto; funcionalidad opcional |
| Health and fitness → Health info | Sí | No | El chat o una denuncia pueden contener lesiones, síntomas o condiciones; funcionalidad opcional |
| Health and fitness → Fitness info | Sí | No | Rutinas, actividad, peso, composición y dieta enviados como contexto autorizado; funcionalidad opcional |
| Messages → Other in-app messages | Sí | No | Mensajes enviados al proveedor o incluidos en una denuncia confirmada; funcionalidad opcional |
| Photos and videos → Photos | Sí | No | Hasta seis fotografías elegidas para estimar una comida; funcionalidad opcional |
| App activity → Other user-generated content | Sí | No | Detalles libres escritos en una incidencia; funcionalidad opcional |
| Device or other IDs | Sí | No | HMAC temporal de la IP en el backend de incidencias; prevención del abuso |

`Shared: No` se sustenta en dos excepciones de Google: las peticiones BYOK son
acciones concretas iniciadas por el usuario hacia el proveedor que ha elegido;
Cloudflare y GitHub procesan las incidencias como proveedores de servicio del
responsable. Si Play cuestiona esta interpretación, no cambiar la respuesta sin
registrar la objeción y obtener una nueva decisión del mantenedor.

## Salud e IA

### Health apps declaration

- La aplicación ofrece funciones de salud y bienestar: **Activity and Fitness**
  y **Nutrition and Weight Management**.
- No es una aplicación médica ni un dispositivo médico.
- No diagnostica, trata, cura ni previene enfermedades.
- No usa Health Connect ni permisos de sensores corporales.
- Las rutinas, comidas y medidas las introduce el usuario; las fotografías solo
  salen del dispositivo al ejecutar voluntariamente el estimador.
- Descargo: «Gymnasia no es un dispositivo médico y no sustituye el
  asesoramiento de un profesional sanitario.»

### IA generativa

- Sí incluye IA generativa: Gymnasia Coach y Gymnasia Food Estimator.
- Usa modelos de OpenAI, Anthropic o Google elegidos por el usuario; no entrena
  modelos propios con sus datos.
- La identidad de IA es visible de forma inicial y permanente.
- Las respuestas finales ofrecen una acción Denunciar sin salir de la app.
- Existen guardarraíles locales y reglas sanitarias, pero no se promete que las
  respuestas sean correctas o seguras.

## Declaración de IA por asset

| Asset | Declaración |
|---|---|
| Icono de Play | Sí, generado o editado con IA |
| Feature graphic | Sí; deriva del icono y de su dirección visual |
| 01 Chat | Sí; contiene texto generado por IA |
| 02 Inicio | No; captura real con datos sintéticos |
| 03 Sesión | No; captura real con ejercicio personalizado sin imagen generada |
| 04 Estimador | Sí; contiene una estimación generada por IA |
| 05 Medidas | No; captura real con datos sintéticos |
| 06 Proveedor | No; captura real con credencial oculta |

## Estado de cumplimentación

No marcar una fila como completada hasta verificarla en Play Console:

- [ ] Ficha y contactos guardados.
- [ ] Icono, feature graphic y seis capturas cargados con alt text.
- [ ] Categoría y etiquetas guardadas.
- [ ] Audiencia, anuncios y App access enviados.
- [ ] Cuestionario IARC enviado y resultado registrado.
- [ ] Data safety enviado y previsualizado.
- [ ] Health apps declaration enviada.
- [ ] Declaración de IA y procedencia de assets completada.
- [ ] Previsualización es-ES revisada en móvil y web sin truncados.

## Fuentes oficiales verificadas el 29 de agosto de 2026

- [Recursos de vista previa](https://support.google.com/googleplay/android-developer/answer/9866151?hl=es): icono PNG de 512×512, feature graphic de 1024×500 sin alfa, capturas 9:16 de 1080×1920, tagline por debajo del 20 % y alt text de hasta 140 caracteres.
- [Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es): todo dato que sale del dispositivo se declara como recopilado; las acciones iniciadas por el usuario y los proveedores de servicio pueden acogerse a las excepciones de `Shared`.
- [Público objetivo](https://support.google.com/googleplay/android-developer/answer/9867159?hl=es): los tramos 16–17 y 18+ deben seleccionarse solo porque la app está diseñada para ambos; la restricción de menores solo existe al marcar exclusivamente 18+.
- [Declaración de apps de salud](https://support.google.com/googleplay/android-developer/answer/14738291?hl=es) y [política de contenido de salud](https://support.google.com/googleplay/android-developer/answer/16679511?hl=es): se declaran Activity and Fitness y Nutrition and Weight Management; la descripción incluye que no es un dispositivo médico y que no diagnostica, trata, cura ni previene enfermedades.
- [Etiquetado de recursos creados con IA](https://support.google.com/googleplay/android-developer/answer/17262077?hl=es): la declaración es individual por cada asset introducido en Play Console.
- [Contenido generado por IA](https://support.google.com/googleplay/android-developer/answer/13985936?hl=es): las apps conversacionales deben permitir denunciar contenido dentro de la propia aplicación.
