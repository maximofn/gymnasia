// Turno de preguntas. steps.js añade un índice y una diapositiva por pregunta.
// `short` es el texto del índice; `a`, lo que se proyecta; `notes`, lo que
// dices tú (solo en la vista de presentador); `img`, la ilustración de la
// derecha (clave de js/assets.js).
window.QA = [
  // ── Principiante ──────────────────────────────────────────────
  {
    level: "Principiante", short: "¿Qué diferencia hay entre un agente y ChatGPT?",
    q: "¿Qué diferencia hay entre un agente y ChatGPT?",
    a: [
      "ChatGPT conversa: sabe lo que le cuentas en ese chat.",
      "Un agente además actúa: tiene herramientas para leer y escribir datos.",
      "El de Gymnasia decide qué mirar (tus comidas, tus medidas…) antes de contestarte.",
    ],
    notes: "La diferencia no es el modelo, que puede ser el mismo. Es lo que tiene alrededor.\n\nUn chat responde con lo que le das. Un agente tiene herramientas: puede ir a buscar tus comidas de hoy, apuntar tu peso o crear una rutina, y decide él solo cuándo usarlas.\n\nEn Gymnasia, el modelo es el de OpenAI, Anthropic o Google que tú elijas. Lo que lo convierte en agente son las 13 herramientas y el bucle que le deja usarlas hasta tener la respuesta.",
  },
  {
    level: "Principiante", short: "¿Qué es poner tu propia clave y cuánto cuesta?", img: "llave",
    q: "¿Qué es eso de poner tu propia clave? ¿Cómo la consigo y cuánto cuesta?",
    a: [
      "Creas una cuenta de API en OpenAI, Anthropic o Google y generas una clave.",
      "La pegas en Ajustes: la app habla directamente con el proveedor.",
      "Pagas tú lo que gastes, por uso, en tu cuenta del proveedor.",
    ],
    notes: "Se llama BYOK, bring your own key. No hay ninguna clave mía dentro de la app.\n\nLa consigues en la consola de desarrolladores de cada proveedor. La pegas en Ajustes y se guarda en el llavero seguro del móvil.\n\nEl coste depende del modelo y de cuánto lo uses, y lo ves en el panel de tu proveedor. Hoy la app todavía no te enseña el gasto: es una de las cosas que me quedan por hacer.\n\nOjo con los niveles gratuitos: cada proveedor tiene sus condiciones sobre qué hace con los datos. Léelas.",
  },
  {
    level: "Principiante", short: "¿Ven OpenAI o Google mis datos de salud?",
    q: "Si la app habla con OpenAI o Google, ¿ven ellos mis datos de salud?",
    a: [
      "Ven lo necesario para responder: tu mensaje, los últimos 20 y lo que lean las herramientas.",
      "Va de tu móvil al proveedor, sin pasar por ningún servidor mío.",
      "A OpenAI y a Google se les pide que no guarden la conversación («store: false»).",
      "Sin clave configurada, no sale nada del móvil.",
    ],
    notes: "Sí, lo que hace falta para contestar llega al proveedor. Es inevitable si el modelo está en su nube.\n\nLo que se envía es el prompt del sistema, hasta los últimos 20 mensajes y el resultado de las herramientas que use: por ejemplo, tu peso o las comidas del día. Si usas el estimador, también la foto.\n\nVa directo del móvil al proveedor; yo no veo nada porque no hay servidor. Con OpenAI y Google la petición lleva store: false para que no guarden la conversación como estado, aunque pueden conservar registros contra abusos según sus términos.\n\nY los mensajes que el filtro de salud considera de riesgo alto ni siquiera salen del móvil.",
  },
  {
    level: "Principiante", short: "¿Qué pasa si pierdo o cambio de móvil?",
    q: "Si todo vive en el móvil, ¿qué pasa si lo pierdo o me cambio de móvil?",
    a: [
      "Puedes exportar una copia cifrada con contraseña (.gymnasia) e importarla en el nuevo.",
      "La clave de API no viaja en la copia: la vuelves a poner.",
      "Si no has hecho copia, se pierde: no hay nube que lo guarde por ti.",
    ],
    notes: "Es el precio del local-first: tus datos son tuyos, y la copia también es cosa tuya.\n\nLa app exporta un fichero .gymnasia cifrado con contraseña, con tus datos y las fotos de progreso. Lo importas en el móvil nuevo y listo. La clave de API no va dentro, por seguridad.\n\nSi tienes activada la copia de seguridad de Android, el sistema también puede incluir los datos de la app, pero eso ya lo gobierna Google, no Gymnasia.",
  },
  {
    level: "Principiante", short: "¿Funciona sin internet?",
    q: "¿Funciona sin internet?",
    a: [
      "Apuntar entrenos, comidas y medidas: sí, todo es local.",
      "El agente no: necesita hablar con el modelo del proveedor.",
      "Si el proveedor se cae, solo deja de funcionar el chat.",
    ],
    notes: "Todo lo que es tuyo funciona sin red: entrenar, apuntar series, comidas, medidas, ver tu evolución. Hasta buscar las calorías de un alimento en el catálogo local.\n\nEl agente no, porque el modelo está en la nube del proveedor. Y si un proveedor se cae, deja de funcionar lo que depende de él y nada más.",
  },
  {
    level: "Principiante", short: "¿Son fiables las calorías de una foto?", img: "arroz-caliente",
    q: "¿Son fiables las calorías que saca de una foto?",
    a: [
      "Es una estimación: lo que más falla es la cantidad, no el plato.",
      "Da rangos, explica lo que supone y puedes corregirle hablando.",
      "Con código de barras no estima: busca el producto en Open Food Facts.",
    ],
    notes: "Es una estimación y hay que tratarla como tal. El modelo reconoce bien qué es el plato; lo difícil es cuánto hay, porque en una foto no se ve el peso.\n\nPor eso el estimador da rangos y explica sus supuestos, y puedes decirle «era medio plato» y recalcula.\n\nSi hay un código de barras, no estima: lee el número y trae los datos reales de Open Food Facts.\n\nY siendo sincero: todavía no he medido cuánto se equivoca. Eso es justo lo que harán las evals.",
  },
  {
    level: "Principiante", short: "¿Sustituye a un nutricionista o a un entrenador?",
    q: "¿Puede sustituir a un nutricionista o a un entrenador?",
    a: [
      "No. Y la app lo dice: no es un dispositivo médico ni un profesional.",
      "Sirve para llevar el día a día y resolver dudas normales.",
      "Con lesiones, embarazo, medicación o trastornos alimentarios, te deriva a un profesional.",
    ],
    notes: "No, y no pretende. La propia app avisa de que no es un dispositivo médico ni un profesional acreditado, aunque el tono pueda parecerlo.\n\nDonde ayuda es en el día a día: llevar la cuenta, ajustar una rutina, resolver dudas normales.\n\nEn los casos delicados, como lesiones, embarazo, medicación o trastornos alimentarios, el filtro de salud entra y la respuesta te deriva a un profesional.",
  },
  {
    level: "Principiante", short: "¿Qué pasa si le pregunto algo peligroso?", img: "politica",
    q: "¿Qué pasa si le pregunto algo peligroso?",
    a: [
      "Antes del modelo, un filtro de salud clasifica tu pregunta.",
      "Riesgo alto: el modelo ni se entera; la app responde con un mensaje seguro.",
      "Riesgo intermedio: puede contestar, pero no tocar tus datos.",
      "Las respuestas también se revisan antes de enseñártelas.",
    ],
    notes: "Es lo que conté en la quinta parada.\n\nTu pregunta pasa primero por un filtro que va aparte del prompt. Si el riesgo es alto, por ejemplo dejar de comer una semana, el modelo no la recibe: la app contesta directamente con una respuesta segura.\n\nSi es intermedio, el agente responde pero solo puede leer, no escribir.\n\nY la respuesta del modelo también pasa por el filtro antes de que la veas.",
  },
  {
    level: "Principiante", short: "¿Qué modelo me recomiendas?",
    q: "¿Qué modelo me recomiendas: OpenAI, Anthropic o Google?",
    a: [
      "Cambia casi cada semana: os digo el mejor de hoy.",
      "Tiene que admitir herramientas; si no, el Coach no puede usarlo.",
      "Para fotos de comida, uno con visión.",
      "Empieza por uno rápido y barato, y sube solo si se queda corto.",
    ],
    notes: "[di cuál es el mejor en ese momento]\n\nNo os voy a dar un nombre fijo, porque el mejor cambia casi cada semana. Hoy os diría este.\n\nLo que no cambia son los criterios: que admita herramientas, porque sin ellas el Coach no puede trabajar, y que tenga visión si vas a usar el estimador con fotos.\n\nY mi consejo: empieza con uno rápido y barato, y sube a uno más grande solo si notas que se queda corto.",
  },
  {
    level: "Principiante", short: "¿Es gratis? ¿Está para iPhone?",
    q: "¿La app es gratis? ¿Está para iPhone?",
    a: [
      "De momento solo hay versión para Android, y es gratis.",
      "Cada uno pone sus claves y se paga sus tokens con el proveedor.",
      "iPhone todavía no: no tengo iPhone para probarla.",
    ],
    notes: "Hoy solo hay versión para Android, y es gratuita. No hay servidor que pagar: cada usuario pone sus claves de los proveedores y se paga sus tokens.\n\nTengo pensado cómo monetizarla en el futuro, pero eso ya lo contaré si se llega a ese punto.\n\n¿iPhone? Todavía no, por un motivo muy poco técnico: no tengo iPhone para probarla.",
  },
  {
    level: "Principiante", short: "¿Cuánto has tardado? ¿Has programado con IA?",
    q: "¿Cuánto has tardado en hacerla? ¿La has hecho solo? ¿Has programado con IA?",
    a: [
      "Desde el 11 de febrero de 2026: ocho meses y más de 1.300 commits.",
      "La he hecho yo solo, programando con agentes de código: Claude Code y Codex.",
      "Con tests y revisión en cada cambio: la IA escribe, yo decido.",
    ],
    notes: "El primer commit es del 11 de febrero de 2026, así que llevo ocho meses, y más de 1.300 commits.\n\nY una curiosidad: ese primer commit montaba una web, una API y una base de datos en Supabase. Empecé exactamente por donde os conté en la primera parada, con un backend, y acabé tirándolo para hacerla local-first.\n\nLa he hecho yo, programando con agentes de código. Pero no es «pídele una app y ya»: cada cambio va con sus tests, su revisión y su PR, y las decisiones de diseño, como el local-first o la idempotencia, son mías.\n\nLos agentes de código te dan velocidad. El criterio lo sigues poniendo tú.",
  },
  {
    level: "Principiante", short: "¿Por qué no ChatGPT, si ya tiene memoria?",
    q: "¿Por qué no lo hace ChatGPT directamente, si ya tiene memoria?",
    a: [
      "La memoria de ChatGPT recuerda lo que le cuentas, no tus series ni tus comidas.",
      "Muchas apps de gimnasio no dejan sacar esos datos.",
      "Aquí los apuntas en la misma app donde vive el agente: ya están ahí.",
    ],
    notes: "La memoria de ChatGPT recuerda cosas que le dices, como «no me gusta el brócoli». Pero no tiene tus series de ayer, lo que comiste hoy ni tus medidas del lunes, porque eso vive en otras apps.\n\nY muchas de esas apps no te dejan exportar los datos.\n\nLa idea de Gymnasia es la contraria: apuntas en la misma app donde vive el agente, así que cuando le preguntas, los datos ya están ahí.",
  },

  // ── Intermedio ────────────────────────────────────────────────
  {
    level: "Intermedio", short: "¿Por qué no un framework (LangChain, AI SDK…)?",
    q: "¿Por qué no has usado un framework como LangChain, LangGraph o Vercel AI SDK?",
    a: [
      "Corre dentro de una app React Native, sin servidor, y ahí el streaming es otro mundo.",
      "Necesitaba control fino: idempotencia, filtro de salud por frases, tres dialectos.",
      "El bucle de herramientas son unas 400 líneas; lo que pesa es lo de alrededor.",
    ],
    notes: "Tres motivos.\n\nUno: todo corre en el móvil, en React Native. La mayoría de frameworks dan por hecho Node o un servidor, y el streaming en React Native tiene sus propias trampas.\n\nDos: lo difícil no era llamar al modelo, sino lo que pasa alrededor: la huella de las escrituras, el filtro que retiene la respuesta, los tres formatos de herramientas. Ahí quería control total.\n\nTres: el bucle en sí es pequeño, unas 400 líneas. Un framework me ahorraba poco y me escondía justo lo que quería ver.",
  },
  {
    level: "Intermedio", short: "¿Cómo elige la herramienta? ¿13 son muchas?",
    q: "¿Cómo decide el agente qué herramienta usar? ¿13 son muchas?",
    a: [
      "Lo decide el modelo, con el nombre, la descripción y el esquema de cada una.",
      "13 entran bien; el problema empieza cuando se parecen entre sí.",
      "Si se equivoca de argumentos, recibe un error que le dice qué corregir.",
    ],
    notes: "Lo decide el modelo: le llegan las 13 herramientas con nombre, descripción y esquema, y elige.\n\nCon 13 va bien. Lo que de verdad confunde no es el número, sino que dos herramientas se parezcan y la descripción no deje claro cuándo usar cada una.\n\nY cuando se equivoca, la app no ejecuta nada: le devuelve un error que dice «corrige los argumentos y vuelve a intentarlo», con lo que falló. Normalmente lo arregla en la siguiente ronda.",
  },
  {
    level: "Intermedio", short: "¿Por qué un agente aparte para la comida?", img: "producto",
    q: "¿Por qué un agente aparte para la comida y no el mismo con una herramienta más?",
    a: [
      "Es otro trabajo: visión, estimar y devolver un formato fijo.",
      "Tiene su propio prompt, corto y centrado; el Coach no carga con él.",
      "Su salida se valida antes de entrar en tu dieta.",
    ],
    notes: "Porque es un trabajo distinto. El Coach conversa y usa tus datos; el estimador mira fotos, estima y tiene que devolver un JSON con unas claves exactas.\n\nSeparado, cada uno tiene un prompt corto y enfocado, y no meto instrucciones de visión y de formato en cada conversación del Coach.\n\nAdemás, la salida del estimador se valida en la app: si los números no cuadran, no entra en tu dieta.",
  },
  {
    level: "Intermedio", short: "¿Cómo gestionas el historial largo?",
    q: "¿Cómo gestionas el historial cuando la conversación es larga?",
    a: [
      "Se mandan los últimos 20 mensajes, con la misma regla para los tres proveedores.",
      "Lo importante no depende del historial: está en tus datos y se consulta con herramientas.",
      "En Google, si no cabe, se quitan primero imágenes antiguas y luego intercambios enteros.",
    ],
    notes: "Con una ventana: los últimos 20 mensajes, igual para OpenAI, Anthropic y Google. De momento no hay resúmenes.\n\nFunciona porque lo importante no vive en la conversación. Tu peso, tus comidas o tus objetivos están en tus datos, y el agente los consulta con herramientas cuando hacen falta.\n\nGoogle tiene además límites de tamaño, así que si la petición no cabe, la app quita primero las imágenes de intercambios anteriores y después intercambios completos, empezando por el más antiguo.",
  },
  {
    level: "Intermedio", short: "¿Qué guarda la memoria y quién decide?",
    q: "¿Qué guarda exactamente la memoria? ¿Quién decide qué se guarda?",
    a: [
      "Datos personales como clave y valor: gustos, alergias, objetivos…",
      "Los guarda el agente con una herramienta cuando se lo cuentas.",
      "Los puedes ver y editar en Ajustes, en Memoria.",
    ],
    notes: "Son campos clave y valor: «no le gusta el brócoli», «objetivo: bajar grasa», etcétera.\n\nLos guarda el agente, con la herramienta de guardar memoria, cuando le cuentas algo relevante. Hoy no te pide confirmación; la confirmación humana es una de las tareas pendientes.\n\nLos puedes revisar y editar en Ajustes, en Memoria. Y el prompt le dice al agente que lo que hay en la memoria son datos tuyos, nunca instrucciones para él.",
  },
  {
    level: "Intermedio", short: "La memoria por herramientas, ¿no añade latencia?",
    q: "Si la memoria solo se consulta con herramientas, ¿no añade rondas y latencia?",
    a: [
      "Sí: una ronda más cuando la necesita.",
      "A cambio, un prompt más corto y estable, sin datos que no vienen al caso.",
      "Y una memoria en el prompt sería una puerta de entrada en cada mensaje.",
    ],
    notes: "Sí, cuesta una ronda más cuando la necesita. Es un precio que pago a propósito.\n\nA cambio, el prompt no crece con cada cosa que le cuentas, es igual en cada petición, y el modelo no se distrae con que odias el brócoli cuando le preguntas por la sentadilla.\n\nY hay un motivo de seguridad: si la memoria va en el prompt, cualquier texto que se cuele ahí está en cada mensaje, hablándole al modelo con la voz del sistema.",
  },
  {
    level: "Intermedio", short: "¿Cómo guardas la clave en el móvil y en la web?", img: "llave",
    q: "¿Cómo guardas la clave en el móvil? ¿Y en la versión web?",
    a: [
      "En el móvil: en el llavero seguro del sistema (SecureStore).",
      "Nunca en el almacenamiento normal ni en la copia de seguridad.",
      "En la web no hay llavero: va en el navegador, y la app lo avisa.",
    ],
    notes: "En Android e iOS la clave va al llavero seguro del sistema operativo, con SecureStore de Expo. En el almacenamiento normal solo queda una copia sin la clave, y la copia de seguridad que exportas tampoco la lleva.\n\nEn la web no existe ese llavero, así que la clave se guarda en el almacenamiento del navegador. La app te lo avisa en la pantalla de configuración: si te preocupa, usa la app del móvil.",
  },
  {
    level: "Intermedio", short: "¿Cómo haces el streaming en React Native?",
    q: "¿Cómo haces el streaming en React Native?",
    a: [
      "El fetch de React Native no entrega el cuerpo a trozos: uso XHR incremental.",
      "Un parser SSE propio aguanta cortes en cualquier punto.",
      "Si la ruta incremental falla en Android, se reintenta esperando la respuesta entera.",
    ],
    notes: "Es una de las partes más traicioneras. El fetch de React Native no te da el cuerpo como stream, así que uso XMLHttpRequest con actualizaciones incrementales y voy leyendo lo nuevo.\n\nEncima hay un parser de SSE propio que no da por hecho que cada trozo llegue completo: guarda lo que queda a medias hasta que se completa. Por eso los tests trocean las respuestas al azar.\n\nY si en Android falla la ruta incremental, la app vuelve a pedir la respuesta esperando a que llegue entera.",
  },
  {
    level: "Intermedio", short: "¿Qué diferencias entre proveedores dieron guerra?",
    q: "Aparte del «strict», ¿qué diferencias entre proveedores te han dado más guerra?",
    a: [
      "Google: el «thinkingConfig» va dentro de «generationConfig», no arriba.",
      "Google: con «store: false» devuelve identificadores vacíos.",
      "Anthropic: solo acepta la versión de API 2023-06-01.",
      "Y cada uno correlaciona las herramientas con su propio identificador.",
    ],
    notes: "Muchas, y casi todas silenciosas.\n\nGoogle rechaza el thinkingConfig si va en el nivel superior: tiene que ir dentro de generationConfig.\n\nGoogle, además, cuando le pides que no guarde la conversación, devuelve los identificadores vacíos, y si tu código exige un identificador, rechaza respuestas buenas.\n\nAnthropic solo acepta la versión de API 2023-06-01; una más nueva falla.\n\nY cada proveedor asocia la respuesta de una herramienta con su llamada usando un campo distinto. Por eso esos identificadores sirven para el protocolo, pero no para la huella de las escrituras.",
  },
  {
    level: "Intermedio", short: "El filtro de salud, ¿es otro modelo?",
    q: "El filtro de salud, ¿es otro modelo? ¿Cuánta latencia y coste añade?",
    a: [
      "No: la primera capa son reglas deterministas en el móvil, sin latencia ni coste.",
      "Solo si la consulta es dudosa y tú lo activas, se pide una segunda opinión al modelo.",
      "Esa segunda opinión tiene 10 segundos; si falla, manda la decisión local.",
    ],
    notes: "La base no es un modelo: son reglas versionadas, con señales en español, inglés y portugués, que se evalúan en el móvil. No cuestan nada ni añaden latencia apreciable.\n\nHay una segunda capa opcional: si la consulta queda en zona dudosa y tú has activado la evaluación adicional, se le pregunta al mismo proveedor que estés usando, en una petición aparte. Está desactivada por defecto.\n\nSi esa evaluación tarda más de 10 segundos o falla, se queda la decisión de las reglas locales.",
  },
  {
    level: "Intermedio", short: "¿Qué es exactamente el proveedor falso?",
    q: "¿Qué es exactamente el proveedor falso? ¿Son respuestas grabadas de verdad?",
    a: [
      "35 respuestas escritas en el formato exacto de OpenAI, Anthropic y Google.",
      "Cubren llamadas a herramientas, razonamiento, errores y respuestas cortadas.",
      "Los tests las trocean al azar; el E2E habla con un OpenAI falso en el navegador.",
    ],
    notes: "Son ficheros SSE escritos a mano con el formato exacto de cada proveedor: 35 en total. No son capturas de llamadas reales, sino casos pensados: una herramienta, varias a la vez, argumentos inválidos, razonamiento, una respuesta truncada…\n\nLos tests unitarios los reproducen cortados en puntos aleatorios. Y la prueba de punta a punta levanta la web en un navegador que habla con un OpenAI falso.\n\nAsí corre todo sin red y sin claves, y si falla, es por un fallo de verdad, no por el modelo.",
  },
  {
    level: "Intermedio", short: "¿Qué pasa al llegar a las 10 rondas?",
    q: "¿Qué pasa cuando se alcanzan las 10 rondas de herramientas?",
    a: [
      "La herramienta que pide de más no se ejecuta: recibe un resultado que se lo explica.",
      "Se hace una última llamada sin herramientas para que conteste con lo que tiene.",
      "Si aun así no cierra, el turno termina con un error controlado.",
    ],
    notes: "Es un freno para que un agente no se quede en bucle gastando tokens.\n\nSi después de 10 rondas sigue pidiendo herramientas, esa llamada no se ejecuta: recibe un resultado sintético que le dice que no hay más rondas. Y se le hace una última petición con las herramientas prohibidas, para que conteste con lo que ya sabe.\n\nSi en esa última vuelta falla, se corta o vuelve a pedir herramientas, el turno termina con un error. Lo que ya se hubiera escrito antes, se queda escrito.",
  },
  {
    level: "Intermedio", short: "¿Por qué A2A y no MCP?", img: "carrito",
    q: "¿Por qué A2A y no MCP? ¿En qué se diferencian?",
    a: [
      "MCP conecta un agente con herramientas y datos.",
      "A2A conecta agentes de distintos dueños: se piden tareas sin verse por dentro.",
      "Lo mío es lo segundo: que el agente de Gymnasia hable con el de otra empresa.",
    ],
    notes: "Resuelven problemas distintos.\n\nMCP es la forma estándar de darle herramientas y datos a un agente: «aquí tienes una base de datos, aquí una API».\n\nA2A es para que dos agentes de dueños distintos colaboren: uno le pide una tarea al otro sin ver sus herramientas, su prompt ni sus datos.\n\nEl caso del agente de la compra es de A2A: no quiero darle acceso a mis datos, quiero que los dos agentes se entiendan.",
  },
  {
    level: "Intermedio", short: "¿Qué modelo usas y cuánto cuesta una conversación?",
    q: "¿Qué modelo usas tú y cuánto cuesta una conversación típica?",
    a: [
      "Yo uso Qwen 3.8 27B en local, en mi máquina, y llego a él por VPN: me sale gratis.",
      "La app admite cualquier servidor compatible con la API de OpenAI.",
      "Con un proveedor de pago, hoy la app no mide el coste: está en las tareas pendientes.",
    ],
    notes: "Yo, últimamente, ninguno de los tres grandes: uso Qwen 3.8 27B en local. Lo tengo corriendo en mi máquina y el móvil llega a él por una VPN, así que me sale gratis.\n\nSe puede porque la app admite, además de OpenAI, Anthropic y Google, cualquier servidor compatible con la API de OpenAI, con la URL que tú elijas.\n\nSi usas un proveedor de pago, cuánto cuesta cada conversación todavía no lo mide la app: contar tokens y coste por llamada es una de las tareas pendientes. Y la caché de prompts lo abarataría bastante, porque el prompt y las 13 herramientas se repiten en cada petición.",
  },

  // ── Avanzado ──────────────────────────────────────────────────
  {
    level: "Avanzado", short: "¿Y si al reintentar cambian los argumentos?", img: "arroz-caliente",
    q: "Si en el reintento el modelo genera argumentos distintos («arroz» frente a «arroz con pollo»), ¿se duplica?",
    a: [
      "Sí: la huella es distinta y se trata como otra escritura.",
      "Protege la repetición exacta (el JSON se normaliza), no la equivalencia semántica.",
      "Para eso está pendiente la confirmación humana antes de escribir.",
    ],
    notes: "Sí, y es la limitación conocida del diseño.\n\nLa huella es un SHA-256 de la conversación, el proveedor, la herramienta, los argumentos y la ocurrencia. Los argumentos se normalizan como JSON canónico, así que el orden de las claves o los espacios no cuentan. Pero si el contenido cambia, es otra operación.\n\nLo que protege es lo que me pasó en el metro: la misma petición repetida. No que el modelo decida algo distinto la segunda vez.\n\nEl arreglo de fondo es que te enseñe lo que va a escribir y le digas que sí.",
  },
  {
    level: "Avanzado", short: "¿Deduplicas el reintento del transporte o del turno?",
    q: "¿El reintento que deduplicas es solo el del transporte o también el de un turno entero vuelto a generar?",
    a: [
      "Los dos: el turno se reintenta hasta 3 veces con el mismo executionId.",
      "En cada intento las ocurrencias se cuentan desde cero: la misma escritura da la misma huella.",
      "Si ya está confirmada, se devuelve el resultado guardado sin ejecutar otra vez.",
    ],
    notes: "El turno completo. Si hay un error de red, un timeout o un 429, 503 o 529, la app reintenta el turno entero hasta tres veces, esperando 2 y 4 segundos, y conserva el mismo executionId, que es el identificador del mensaje del usuario.\n\nComo en cada intento las ocurrencias empiezan desde cero, si el modelo pide la misma escritura, cae en la misma huella. El coordinador la encuentra confirmada y devuelve el resultado guardado al modelo, sin volver a ejecutar el handler.\n\nLos identificadores de llamada del proveedor no forman parte de la huella, porque cambian en cada intento.",
  },
  {
    level: "Avanzado", short: "¿Dos platos de verdad o una llamada repetida por error?",
    q: "¿Cómo distingues «me he comido dos platos» de «el modelo ha llamado dos veces por error» en el mismo turno?",
    a: [
      "Dentro del mismo intento, dos llamadas iguales son dos operaciones: cambia la ocurrencia.",
      "Así que, si el modelo se repite por error, se apunta dos veces.",
      "Hoy no lo distingo: es otro caso para la confirmación humana.",
    ],
    notes: "No lo distingo, y lo digo claro.\n\nLa ocurrencia es lo que separa «dos platos de arroz» de «el mismo plato repetido por un reintento». Dentro de un mismo intento, la segunda llamada idéntica tiene ocurrencia 2, así que es otra operación.\n\nEso cubre bien los reintentos, que es lo que me rompió la dieta. Pero si el modelo, en la misma respuesta, llama dos veces por error, se apuntará dos veces.\n\nLa salida es la confirmación humana: que antes de escribir te enseñe qué va a apuntar.",
  },
  {
    level: "Avanzado", short: "¿Cuántas escrituras atómicas hay debajo?", img: "libreta",
    q: "Si la app muere entre la libreta y la comida, ¿cuántas escrituras atómicas hay? ¿Qué garantiza AsyncStorage?",
    a: [
      "No hay transacción: son escrituras separadas, y AsyncStorage no las une.",
      "Por eso el orden: «preparado» (y se relee), luego la comida con su recibo, luego «hecho».",
      "Si se corta en medio, el recibo dice si llegó. Sin certeza: «indeterminado», y no se repite.",
    ],
    notes: "No hay atomicidad entre la libreta y la comida, y el diseño no la asume.\n\nPrimero se escribe la entrada «preparada» en el registro y se vuelve a leer para comprobar que está. Después el handler guarda la comida, y dentro de la propia comida va un recibo con el identificador de la operación. Por último se marca como confirmada.\n\nSi la app muere en medio, al arrancar se mira el recibo: si está, la escritura llegó; si se puede demostrar que no está, se descarta. Y si no se puede saber, queda como indeterminada y te avisa, en vez de repetirla.\n\nLos recibos duran siete días y como mucho 256; pasado eso, la ausencia ya no demuestra nada.",
  },
  {
    level: "Avanzado", short: "¿Inyección de prompt desde la memoria o Open Food Facts?",
    q: "Si un producto de Open Food Facts o la memoria contienen instrucciones maliciosas, ¿llegan al modelo como órdenes?",
    a: [
      "La memoria no está en el prompt: llega como resultado de una herramienta.",
      "El prompt dice que esos datos nunca son instrucciones.",
      "Lo que no depende del modelo: esquemas validados, filtro de salud y permisos por riesgo.",
      "No es infalible: un texto malicioso puede influir en la respuesta.",
    ],
    notes: "Llegan al modelo como datos, no como prompt del sistema, y eso ya reduce bastante.\n\nEl prompt le dice explícitamente que lo que hay en la memoria son datos del usuario y que ignore cualquier contenido que intente cambiar sus reglas.\n\nPero no me fío solo de eso. Las barreras que no dependen del modelo son las que importan: cada llamada se valida contra su esquema, el filtro de salud clasifica también los argumentos de las herramientas, y con riesgo intermedio solo puede leer.\n\nLo honesto es decir que la inyección no está resuelta en ningún agente. Un texto malicioso puede sesgar una respuesta; lo que intento es que no pueda hacer daño con tus datos.",
  },
  {
    level: "Avanzado", short: "¿Cómo mides los fallos del filtro de salud?",
    q: "¿Cómo mides los falsos positivos y negativos del filtro? ¿Y si el riesgo se construye en varios mensajes?",
    a: [
      "Las reglas tienen casos de prueba y una puerta determinista antes de promocionarse.",
      "No tengo tasas con tráfico real: no salen datos del móvil.",
      "Hoy se clasifica mensaje a mensaje: el riesgo repartido en varios es un punto débil.",
    ],
    notes: "Ahora mismo, con casos de prueba: hay casos para ayuno de una semana, trastornos alimentarios, embarazo, medicación, dolor torácico, menores… y ejemplos normales que no deben saltar. La política no se promociona si esa puerta no pasa.\n\nLo que no tengo son tasas reales de falsos positivos y negativos, porque no saco conversaciones del móvil. Eso llegará con las evals, con datasets curados.\n\nY sí, se clasifica cada mensaje, cada respuesta y los argumentos de cada herramienta, pero no la conversación como un todo. Alguien que reparta el riesgo en varios mensajes inofensivos puede colarse. Lo tengo identificado.",
  },
  {
    level: "Avanzado", short: "¿Clasificas la pregunta o también la respuesta?",
    q: "¿Clasificas solo la pregunta o también la respuesta del modelo?",
    a: [
      "Las dos, y también los argumentos de cada herramienta.",
      "La respuesta se revela por frases completas, nunca token a token.",
      "Si la pregunta tiene cualquier riesgo, no se enseña nada hasta tenerla entera.",
    ],
    notes: "Las dos cosas, y algo más.\n\nLa pregunta decide la ruta: riesgo alto, respuesta local; intermedio, solo lectura.\n\nLos argumentos de cada herramienta también se clasifican antes de ejecutarla.\n\nY la respuesta pasa por un filtro de salida mientras llega: solo se enseña hasta la última frase completa, porque el clasificador no puede juzgar media frase. Si la pregunta tenía cualquier riesgo, se retiene entera hasta el final, se clasifica completa y solo entonces se enseña.",
  },
  {
    level: "Avanzado", short: "¿Por qué retener y no validar frase a frase?",
    q: "Retener la respuesta entera empeora la latencia. ¿Por qué no validar frase a frase y cortar?",
    a: [
      "Es lo que hace en lo normal: frase a frase.",
      "En temas de salud, una frase suelta puede parecer bien y la siguiente convertirla en mala.",
      "Prefiero esperar a enseñar media recomendación y tener que retirarla.",
    ],
    notes: "En las preguntas normales ya es así: se enseña frase a frase.\n\nEn las de salud no, por dos motivos. El primero es que el riesgo muchas veces está en la combinación: «puedes hacer ayuno» puede estar bien, y la frase siguiente, «de siete días», lo convierte en algo peligroso. El segundo es que retirar texto que ya has leído no sirve de nada.\n\nCuesta latencia, sí. Pero en esas preguntas prefiero que tarde a que te enseñe algo que luego tenga que borrar.",
  },
  {
    level: "Avanzado", short: "Política firmada: ¿quién firma? ¿Y un fork sin filtro?", img: "politica",
    q: "¿Quién firma la política, con qué clave y cómo se verifica? Si es de código abierto, ¿qué impide compilar una versión sin filtro?",
    a: [
      "Firma Ed25519 con certificado; las claves públicas raíz van dentro de la build.",
      "Las claves privadas no están en el repositorio: se usan en local desde Bitwarden.",
      "Primero Staging, luego Production, con una puerta sanitaria y anti-retroceso.",
      "Un fork puede quitar el filtro: la firma protege la app oficial, no el código.",
    ],
    notes: "El bundle con el prompt y las reglas de salud se firma con Ed25519 y un certificado de firmante. Las raíces públicas en las que confía la app van integradas en la build; la app nunca acepta raíces descargadas.\n\nLas claves privadas no están en el repositorio: los comandos de firma las sacan en local de Bitwarden.\n\nPara promocionar, primero va a Staging y después a Production, y en cada paso se repite la puerta sanitaria determinista. La secuencia es creciente, así que nadie puede colar una política vieja.\n\n¿Un fork? Claro que puede compilar sin filtro: es su app. Lo que garantiza la firma es que la app oficial solo ejecuta políticas aprobadas, y que si falta, se niega a funcionar. Es lo que le pasó al tester.",
  },
  {
    level: "Avanzado", short: "Evals sin datos de usuarios: ¿de dónde sale el dataset?",
    q: "Si todo es local-first, no tienes trazas reales. ¿De dónde sacas el dataset de evaluación y la observabilidad?",
    a: [
      "De fuera del móvil: un dataset curado, con casos de abstención, más datasets sintéticos.",
      "Se ejecutará en local y en CI con LangSmith, sin instrumentar la app.",
      "Las evals con tráfico real chocan con el local-first: hoy no las hay.",
    ],
    notes: "Es la tensión más interesante del proyecto, y no la escondo.\n\nEl plan es evaluar fuera del móvil: un golden dataset con entradas curadas y su respuesta de referencia, incluidos los casos en los que el agente debe abstenerse, que son los que más se olvidan. Y datasets sintéticos para cubrir más variedad.\n\nEso se ejecutará en local y en CI con LangSmith, sin instrumentar la app.\n\nLas evals online con conversaciones reales chocan de frente con el local-first: sacar conversaciones con datos de salud del móvil es justo lo que no quiero. Si algún día las hay, será con consentimiento explícito.",
  },
  {
    level: "Avanzado", short: "¿Cómo evitas los sesgos del modelo juez?",
    q: "¿Cómo evitarás los sesgos del modelo juez, sobre todo si es de la misma familia que el que responde?",
    a: [
      "Todavía no hay juez: las evals son lo primero de lo que queda por hacer.",
      "Cuando llegue a ese río, cruzaré ese puente.",
    ],
    notes: "Todavía no hay juez: las evals son justo lo primero de la lista de lo que me queda.\n\nAsí que, cuando llegue a ese río, cruzaré ese puente.",
  },
  {
    level: "Avanzado", short: "A2A en un móvil sin servidor, ¿cómo?", img: "carrito",
    q: "A2A supone un agente accesible por HTTP. ¿Cómo lo hace una app sin servidor? ¿Cómo se autentica el otro agente?",
    a: [
      "Hoy no puede: una app sin backend no recibe peticiones; solo podría ser cliente.",
      "Si hace falta, haré un pequeño backend solo para A2A.",
      "Y buscaré la forma de que cada uno lo instale en local, para que sus datos sigan siendo suyos.",
      "La autenticación la pone cada agente, con los esquemas HTTP estándar.",
    ],
    notes: "Hoy no puede, y lo dije en la charla: una app sin backend no tiene una URL a la que otro agente pueda llamar. Tal como está, Gymnasia solo podría ser cliente A2A, es decir, llamar ella al agente de la compra y pasarle tus objetivos.\n\nPara que otros agentes le pregunten, si hace falta, haré un pequeño backend solo para eso. Y buscaré la manera de que cada uno se lo pueda instalar en local, en su casa, para que sus datos sigan siendo suyos. Sería la misma idea del local-first, llevada un paso más allá.\n\nLa autenticación la declara cada agente en su ficha: A2A usa los esquemas estándar de HTTP, como OAuth o claves de API.",
  },
  {
    level: "Avanzado", short: "RGPD: ¿quién es responsable de los datos de salud?",
    q: "Los datos de salud son una categoría especial del RGPD. ¿Quién es responsable cuando se envían al proveedor?",
    a: [
      "El responsable de la app soy yo, pero no tengo tus datos: no hay servidor.",
      "El envío al proveedor va con tu cuenta y tu clave, bajo sus condiciones.",
      "La política de privacidad detalla qué se envía; sin clave, no sale nada.",
    ],
    notes: "Creo que no incumplo nada, y os explico por qué.\n\nLa política de privacidad me identifica como responsable del tratamiento, pero en la práctica no dispongo de vuestros datos: no hay cuenta ni servidor. Los derechos se ejercen sin intermediario: exportas, editas o borras desde la app.\n\nCuando hablas con el modelo, la petición sale de tu móvil con tu clave, hacia el proveedor que tú has elegido y bajo tu cuenta con él. Lo que se envía queda sujeto a su política y sus términos.\n\nLa política explica exactamente qué se envía en cada caso, y si no pones clave, no sale nada.",
  },
  {
    level: "Avanzado", short: "¿Por qué «strict: false» y no campos que admitan null?",
    q: "¿Por qué «strict: false» y no «strict: true» con campos que admitan null?",
    a: [
      "Con «strict: true», OpenAI convierte todos los campos en obligatorios.",
      "Hacerlos nullable cambia el contrato: «sin cintura» no es «cintura: null».",
      "Mantengo el esquema canónico y valido cada llamada en local antes de ejecutarla.",
    ],
    notes: "Porque el modo estricto exige que todos los campos estén en required. La salida típica es declararlos nullable, pero eso cambia el contrato: para la app, no mandar la cintura significa «no la toques», y mandarla a null podría significar «bórrala».\n\nY ese contrato es el mismo para Anthropic y Google, que no tienen ese modo.\n\nAsí que mantengo el esquema canónico con strict: false explícito, y la app valida cada llamada contra ese esquema antes del handler. Si no encaja, no se ejecuta y el modelo recibe el error.",
  },
  {
    level: "Avanzado", short: "Google acepta un subconjunto de JSON Schema, ¿qué haces?",
    q: "Google acepta un subconjunto de JSON Schema. ¿Qué haces si una herramienta necesita algo que un proveedor no soporta?",
    a: [
      "El esquema canónico se escribe con lo que aceptan los tres.",
      "Hoy los tres reciben el mismo esquema; solo cambia el envoltorio.",
      "Si hiciera falta algo exótico, lo resolvería en el diseño de la herramienta, no con ramas por proveedor.",
    ],
    notes: "Lo evito en el origen: los esquemas canónicos se escriben con lo que los tres entienden. Objetos, cadenas, números, enumeraciones y campos obligatorios u opcionales.\n\nDe la definición única salen los tres formatos, y lo único que cambia es el envoltorio: parameters en OpenAI y Google, input_schema en Anthropic.\n\nSi una herramienta necesitara algo que uno no soporta, preferiría cambiar la herramienta antes que tener esquemas distintos por proveedor, porque entonces la validación local dejaría de ser única.",
  },
  {
    level: "Avanzado", short: "¿Por qué no un modelo en el propio dispositivo?",
    q: "¿Has considerado un modelo en el propio dispositivo? Daría privacidad total.",
    a: [
      "Sí, y daría privacidad total y funcionaría sin red.",
      "Hoy un modelo que cabe en un móvil se queda corto con 13 herramientas y fotos.",
      "La app admite un servidor compatible con OpenAI: yo uso uno en mi máquina, por VPN.",
    ],
    notes: "Lo he considerado, y es hacia donde iría si los modelos pequeños mejoran lo suficiente.\n\nHoy, un modelo que cabe en un móvil normal tiene problemas con lo que más necesita este agente: elegir bien entre 13 herramientas, rellenar argumentos con esquema y entender fotos de comida.\n\nMientras tanto, la app admite un proveedor compatible con la API de OpenAI con la URL que tú elijas. Yo mismo uso así Qwen 3.8 27B, en mi máquina y a través de una VPN: no corre en el móvil, pero los datos no salen de mi casa.",
  },
  {
    level: "Avanzado", short: "¿Usas caché de prompts?",
    q: "¿Usas la caché de prompts de los proveedores? Con 13 herramientas, el prompt fijo es grande.",
    a: [
      "Todavía no la activo de forma explícita: está en las tareas pendientes.",
      "El prompt y las herramientas son idénticos en cada petición: es la mejora más rentable.",
      "OpenAI la aplica sola en prompts largos; Anthropic necesita marcarla.",
    ],
    notes: "No de forma explícita, y es probablemente la mejora con mejor relación esfuerzo-beneficio que tengo pendiente.\n\nEl prompt del sistema y las definiciones de las herramientas son idénticos en cada petición, así que son el caso perfecto para la caché.\n\nOpenAI la aplica automáticamente a partir de cierto tamaño. En Anthropic hay que marcar con cache_control qué parte cachear, y ahora mismo no lo hago.",
  },
];
