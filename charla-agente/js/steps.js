// Guion de la charla dividido en pasos. Cada pulsación del mando avanza un paso.
// `station` es la parada del mundo 3D; `set` son los cambios de estado de esa
// parada (se acumulan con los pasos anteriores de la misma parada); `cam` mueve
// la cámara; `flash` dispara el destello de foto al avanzar; `notes` es lo que
// dices tú y solo aparece en la vista de presentador.
window.STATIONS = {
  mesa: { name: "El restaurante", origin: [0, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  datos: { name: "Parada 1 · Dónde viven los datos", origin: [60, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  plato: { name: "Parada 2 · Del plato al dato", origin: [120, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  tools: { name: "Parada 3 · El agente va a los datos", origin: [180, 0, 0], cam: [0, 0.2, 12.5, 0, 0.2, 0] },
  duplicado: { name: "Parada 4 · El arroz dos veces", origin: [240, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  salud: { name: "Parada 5 · Lo que el agente no debe hacer", origin: [300, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  tests: { name: "Parada 6 · Cómo pruebo todo esto", origin: [360, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
  pendiente: { name: "Lo que queda", origin: [420, 0, 0], cam: [0, 0, 12, 0, 0, 0] },
};

window.STEPS = [
  // ── 1. El antes ──────────────────────────────────────────────
  {
    station: "mesa", section: "El antes",
    set: { heat: 1, q: 0, islands: 0, jump: 0, cold: 0, tired: 0, kcal: 0, merge: 0, freeze: 0, cubeLabels: 0, title: 0, bite: 0, thanks: 0 },
    notes: "[empiezas directamente, sin presentarte ni anunciar de qué va la charla]\n\nEstás en un restaurante. Te traen un plato de arroz con pollo que huele de maravilla.",
  },
  {
    station: "mesa", set: { q: 1 },
    notes: "Y tú, con el móvil en la mano, piensas: ¿esto cuánto es? ¿600 calorías? ¿900?",
  },
  {
    station: "mesa", set: { islands: 1 },
    notes: "Abres la app donde apuntas los pesos del gimnasio. Ahí tienes tu press de banca, tus sentadillas, tus series… pero de comida, nada.\n\nAbres ChatGPT, que esta mañana te ha hecho la dieta de la semana. Pero ChatGPT no sabe qué entrenaste ayer, porque eso está en la otra app. Ni cuánto pesas hoy, porque eso lo apuntaste en otra distinta.",
  },
  {
    station: "mesa", set: { jump: 1, q: 0 },
    notes: "Y empiezas a copiar y pegar tu vida: «peso 82 kilos, quiero bajar grasa, no me gusta el brócoli, ayer hice pierna…». Otra vez. Como cada día.\n\n[pausa]",
  },
  {
    station: "mesa", set: { cold: 1, jump: 2 },
    notes: "Mientras tanto, el arroz se enfría.\n\n[pausa]",
  },
  {
    station: "mesa", set: { tired: 1, jump: 0 }, cam: [2.8, -0.8, 7.8, 2.8, -0.9, 0],
    notes: "Y lo peor es que no es culpa de ChatGPT, ni de Claude. Son listísimos. El problema es que están ciegos: solo saben lo que tú les cuentas. Y muchas apps de gimnasio y de nutrición ni siquiera te dejan sacar tus datos para dárselos. Así que el pegamento entre todas esas apps eras tú.",
  },
  // ── 2. El después ────────────────────────────────────────────
  {
    station: "mesa", section: "El después", flash: true, set: { cold: 0, tired: 0, kcal: 1 }, cam: [0, 0, 12, 0, 0, 0],
    notes: "Hoy hago una foto al arroz. La app me dice: unas 750 calorías, 25 gramos de proteína. Y lo guarda en la comida de hoy.",
  },
  {
    station: "mesa", set: { merge: 1, kcal: 0 },
    notes: "Después le pregunto al agente: «¿me he pasado esta semana?». Y me contesta mirando lo que entrené ayer, lo que pesé el lunes, mi objetivo de bajar grasa… y sin proponerme brócoli.",
  },
  {
    station: "mesa", set: { freeze: 1 },
    notes: "[pausa]\n\nY no le he contado nada.\n\n[pausa]",
  },
  {
    station: "mesa", set: { freeze: 0, cubeLabels: 1 },
    notes: "En una sola app apunto mis ejercicios y con qué peso los hago, mis comidas, también las de fuera de casa, mi peso y mis medidas. Le cuento al agente lo que me gusta y lo que no, y mis objetivos. Y cuando hablo con él, ya lo tiene todo. Le puedo preguntar por mi rutina, por mi dieta o por cómo voy evolucionando, y no tengo que darle nada, porque ya está ahí.",
  },
  // ── 3. Presentación ──────────────────────────────────────────
  {
    station: "mesa", section: "Presentación", set: { title: 1, cubeLabels: 0 }, cam: [0, 0, 14, 0, 0, 0],
    notes: "[cambias de tono: más tranquilo y cercano]\n\nMe llamo Máximo Fernández, soy desarrollador de IA, y esa app es Gymnasia.\n\nHoy os voy a explicar cómo desarrollar un agente en una app de gimnasio y nutrición. No os voy a hablar de pantallas ni de botones, sino del agente: qué hay detrás de esa respuesta que llega sin que le hayas contado nada.",
  },
  // ── 4. Parada 1 ──────────────────────────────────────────────
  {
    station: "datos", section: "Parada 1", set: { tower: 1, crack: 0, dissolve: 0, beams: 0, down: 0 },
    notes: "Para que lo que acabáis de ver funcione, ese arroz hace un viaje. Y en cada parada del viaje hay algo que se puede romper. Vamos a seguirlo.\n\nLa primera parada es decidir dónde vive el arroz.\n\nLo primero que piensas cuando montas algo así es: me hago un backend. Una base de datos con las comidas, los pesos, las medidas… Y de repente te imaginas guardando en tu servidor los datos de salud de otras personas.\n\n[pausa]",
  },
  {
    station: "datos", set: { crack: 1 },
    notes: "Pero luego te paras a mirar cómo se usan de verdad estas apps. Prácticamente todo el mundo usa la app del gimnasio en un solo dispositivo: su móvil. No la abre en el portátil ni en la tablet. Entonces, ¿para qué quiero un servidor? Me añade tiempo de desarrollo, me añade complejidad, me añade gasto en tokens, y me añade un sitio que alguien puede atacar para llevarse los datos de salud de todos los usuarios a la vez.",
  },
  {
    station: "datos", set: { dissolve: 1, beams: 1 },
    notes: "Así que Gymnasia es local-first: todo vive en tu móvil. No hay cuentas, no hay servidor, no hay base de datos central. Y para el modelo, cada uno pone su propia clave de OpenAI, de Anthropic o de Google, y la app habla directamente con el proveedor.",
  },
  {
    station: "datos", set: { down: 1 },
    notes: "Eso tiene una consecuencia bonita: si algún servicio se cae, solo deja de funcionar lo que depende de él. Todo lo demás sigue funcionando.\n\nEl agente no se lleva tus datos a ningún sitio. Es el agente el que viene a tu móvil.",
  },
  // ── 5. Parada 2 ──────────────────────────────────────────────
  {
    station: "plato", section: "Parada 2", flash: true, set: { text: 1, bars: 0, reject: 0, barcode: 0 },
    notes: "Segunda parada: el arroz tiene que convertirse en un número.\n\nTú imagínate: haces la foto y el modelo te contesta «parece un arroz con pollo, unas 700 calorías, con bastante proteína». Precioso. Pero eso es texto. Y yo no puedo sumar «bastante proteína» al total del día.",
  },
  {
    station: "plato", set: { text: 0, bars: 1 },
    notes: "Por eso la foto no la mira el mismo agente con el que hablas. La mira un agente especializado en comida. Y no le dejo contestar con texto libre: le obligo a devolver un formato fijo, con las calorías y los macros en sus casillas.",
  },
  {
    station: "plato", set: { reject: 1 },
    notes: "Y antes de aceptarlo, la app lo valida. Si algo no cuadra, no entra en tu dieta.",
  },
  {
    station: "plato", set: { barcode: 1 }, cam: [-2.4, 0.2, 11, -2.4, 0.2, 0],
    notes: "Y si en la foto hay un código de barras, el agente lee los números y los busca en Open Food Facts, una base de datos abierta de productos. Si no lo encuentra, vuelve a mirar la foto y estima.\n\nUn LLM habla. Una app necesita números.",
  },
  // ── 6. Parada 3 ──────────────────────────────────────────────
  {
    station: "tools", section: "Parada 3", set: { query: 0, memory: 0, shadows: 0, form: 0, invent: 0, customs: 0 },
    notes: "Tercera parada. El arroz ya está guardado en tu comida de hoy. Y le preguntas al agente: «¿me he pasado hoy?».\n\nAntes, con ChatGPT, tú le pegabas tu dieta, tu peso, tu objetivo… Aquí no le pegas nada. ¿Cómo lo sabe?\n\nPorque el agente tiene herramientas. Trece. Puede buscar alimentos y ejercicios, leer lo que has comido, leer y apuntar tus medidas, crear rutinas y consultar una memoria donde guarda lo que te gusta, lo que no y tus objetivos.",
  },
  {
    station: "tools", set: { query: 1 },
    notes: "Cuando le preguntas, él decide qué necesita mirar: pide leer tus comidas de hoy, la app se las da, las mira, quizá pide también tu objetivo de calorías… y cuando tiene todo, te contesta.",
  },
  {
    station: "tools", set: { query: 0, memory: 1 },
    notes: "Ojo: tu memoria personal no se le mete en el prompt de entrada. La consulta cuando le hace falta. Si le preguntas por una sentadilla, no necesita saber que odias el brócoli.",
  },
  {
    station: "tools", set: { memory: 0, shadows: 1 }, cam: [17, 0.2, 12, 17, 0.2, 0],
    notes: "Y como cada proveedor, OpenAI, Anthropic y Google, pide estas herramientas a su manera, cada herramienta está definida una sola vez y de ahí salen los tres formatos.\n\n[pausa]",
  },
  {
    station: "tools", set: { shadows: 0, form: 1 }, cam: [-17, 0.2, 11, -17, 0.2, 0],
    notes: "Esto parece sencillo, hasta que un día le pedí que apuntara mi peso. Solo el peso.",
  },
  {
    station: "tools", set: { invent: 1 },
    notes: "Y cuando fui a mirar, había medidas de cintura y de cadera que yo nunca le había dado. Se las había inventado.\n\n¿Por qué? Porque OpenAI, sin avisarte, convertía en obligatorios campos que yo había puesto como opcionales. Y el modelo, muy obediente, rellenó el formulario entero.",
  },
  {
    station: "tools", set: { customs: 1 },
    notes: "Desde entonces, cada vez que el agente pide usar una herramienta, la app comprueba que lo que pide encaja exactamente con lo que la herramienta acepta. Y si no encaja, no se ejecuta.\n\nSi el formulario exige un dato, el modelo te lo inventa.",
  },
  // ── 7. Parada 4 ──────────────────────────────────────────────
  {
    station: "duplicado", section: "Parada 4",
    set: { plates: 0, signal: 1, night: 0, rewind: 0, print: 0, notebook: 0, doubt: 0, gap: 0, gapClosed: 0, compare: 0 },
    notes: "[esta es la mejor historia de la charla: cuéntala despacio]\n\nCuarta parada. Y aquí es donde el arroz casi me arruina la dieta.\n\nEstás en el metro. Le dices al agente: «apúntame el arroz de la comida».",
  },
  {
    station: "duplicado", set: { plates: 1 },
    notes: "El agente lo guarda…",
  },
  {
    station: "duplicado", set: { signal: 0 },
    notes: "…y justo en ese momento se corta la cobertura. La respuesta no te llega. Y la app, muy diligente, lo vuelve a intentar.",
  },
  {
    station: "duplicado", set: { plates: 2 },
    notes: "Y el agente vuelve a guardar el arroz.\n\nPor la noche abres la app y ves que te has pasado 400 calorías.",
  },
  {
    station: "duplicado", set: { night: 1 }, cam: [-17, 0, 11.5, -17, 0, 0],
    notes: "Te fastidia. Cenas una manzana y te vas a la cama con hambre.\n\n[pausa larga]",
  },
  {
    station: "duplicado", set: { night: 0, plates: 1, rewind: 1 }, cam: [0, 0, 12, 0, 0, 0],
    notes: "No te habías pasado. Te faltaban 350. Te comiste el arroz una vez, y la app lo contó dos.\n\n[pausa]\n\nEn un chat normal, repetir una petición no pasa nada: como mucho te contesta dos veces. Pero un agente que escribe en tus datos, si repite, te deja un dato duplicado. Y con un dato duplicado acabas tomando decisiones equivocadas.",
  },
  {
    station: "duplicado", set: { rewind: 0, print: 1 },
    notes: "Así que cada vez que el agente va a escribir algo, la app le pone a esa escritura una huella: qué conversación es, qué herramienta, qué datos y si es la primera o la segunda vez que se pide en ese mismo turno. Si la misma petición vuelve a llegar por un reintento, la app la reconoce y no la ejecuta otra vez. Y si de verdad te has comido dos platos de arroz, también lo distingue, porque es una segunda petición distinta, no una repetición.",
  },
  {
    station: "duplicado", set: { print: 0, notebook: 1 },
    notes: "Además, antes de guardar el arroz, la app apunta en una libreta «voy a guardar esto». Y al guardarlo deja una marca dentro de la propia comida. Si la app se cierra justo a mitad, al volver mira la marca y sabe si el arroz llegó a guardarse o no.",
  },
  {
    station: "duplicado", set: { notebook: 0, doubt: 1 },
    notes: "¿Y si no puede saberlo? Entonces no lo repite. Te avisa. Prefiere preguntarte a apuntar otro arroz.\n\n[pausa]",
  },
  {
    station: "duplicado", set: { doubt: 0, gap: 1 }, cam: [17, 0.4, 10, 17, 0.4, 0],
    notes: "Y aquí viene lo mejor. Lo arreglé, lo probé, todo funcionaba… y todavía quedaba un hueco de unos milisegundos, justo después de guardar el arroz y antes de apuntar que se había guardado, por el que se podía colar dos veces.",
  },
  {
    station: "duplicado", set: { gapClosed: 1 },
    notes: "Hizo falta un segundo arreglo para cerrarlo.",
  },
  {
    station: "duplicado", set: { gap: 0, gapClosed: 0, compare: 1 }, cam: [2.3, 0, 10.5, 2.3, 0, 0],
    notes: "En un agente, ante la duda, no escribas dos veces: pregunta.",
  },
  // ── 8. Parada 5 ──────────────────────────────────────────────
  {
    station: "salud", section: "Parada 5", set: { ask: 1, risk: 0, seal: 0, stream: 0, tester: 0, verdict: 0 },
    notes: "Quinta parada. Tú ves que te has pasado, aunque no te hayas pasado. Y le preguntas al agente: «si mañana no como nada, ¿lo compenso?».\n\nEsa pregunta no le llega al modelo tal cual. Antes pasa por un filtro de salud, que va aparte del prompt, y que decide cómo de arriesgada es.",
  },
  {
    station: "salud", set: { risk: 3 },
    notes: "Si el riesgo es alto, el modelo ni siquiera se entera: la app te contesta directamente con una respuesta segura.",
  },
  {
    station: "salud", set: { risk: 2 },
    notes: "Si el riesgo es intermedio, el agente puede contestarte, pero solo puede leer tus datos, no tocarlos.",
  },
  {
    station: "salud", set: { risk: 0, ask: 0, seal: 1 },
    notes: "Esas reglas no están escritas a mano dentro del prompt. Están escritas aparte, como reglas, con sus casos de prueba. Y de ahí se genera la parte del prompt que habla de salud. Además, todo lo que le dice al agente lo que puede y lo que no puede hacer va firmado, se prueba antes en un entorno de pruebas, y no llega a los usuarios sin que yo lo apruebe expresamente. Porque cambiar lo que un agente tiene permitido hacer es más peligroso que cambiar código: el cambio no te enseña sus consecuencias.\n\n[pausa]",
  },
  {
    station: "salud", set: { seal: 0, stream: 1 }, cam: [0, 0.4, 10.5, 0, 0.4, 0],
    notes: "Este filtro tiene un precio. A veces hace que parezca que la app funciona mal. Y me ha pasado dos veces.\n\nLa primera: me pasé una tarde convencido de que el streaming estaba roto. Unas respuestas salían poco a poco, palabra a palabra, y otras aparecían de golpe, enteras. Me puse a buscar el fallo… y no había fallo. Cuando la pregunta toca la salud, el filtro espera a tener la respuesta completa antes de enseñártela. Porque si te la va enseñando según llega, y a mitad de respuesta descubre que es peligrosa, ya la has leído.",
  },
  {
    station: "salud", set: { stream: 0, tester: 1 }, cam: [0, 0, 12, 0, 0, 0],
    notes: "La segunda: un tester me escribe y me dice que el agente no le contesta, que le sale un aviso rojo. Fui a mirar y esa versión de la app se había compilado sin las reglas de seguridad. Y el agente, en vez de funcionar sin ellas, se negó a funcionar.",
  },
  {
    station: "salud", set: { verdict: 1 },
    notes: "Para el tester fue un fastidio, claro. Pero piensa en la alternativa: un agente contestando preguntas de salud sin ninguna regla.\n\n[pausa]\n\nEntre un agente que a veces no te contesta y uno que te contesta lo que no debe, me quedo con el primero.",
  },
  // ── 9. Parada 6 ──────────────────────────────────────────────
  {
    station: "tests", section: "Parada 6", set: { shred: 0, offline: 0 },
    notes: "Última parada. ¿Cómo pruebas algo que no responde dos veces igual?\n\nPues en los tests no hay ningún modelo de verdad. Hay un proveedor falso que devuelve respuestas grabadas.",
  },
  {
    station: "tests", set: { shred: 1 },
    notes: "Esas respuestas las corto en trozos al azar para comprobar que la app las reconstruye bien llegue como llegue cada trozo.",
  },
  {
    station: "tests", set: { offline: 1 },
    notes: "Y hay pruebas de punta a punta en el navegador con un OpenAI falso. Todo corre sin internet y sin claves: no gasta dinero y no falla por casualidad.\n\n[pausa]\n\nTodo esto me garantiza que el agente no rompe nada. Lo que todavía no mido es si responde bien.",
  },
  // ── 10. Lo que queda ─────────────────────────────────────────
  {
    station: "pendiente", section: "Lo que queda", set: { lit: 1, a2a: 0, cart: 0, broccoli: 0 },
    notes: "Y eso es lo primero que me queda por hacer.\n\nHoy sé que el agente no duplica el arroz. Pero no sé si el consejo que te da sobre el arroz es bueno. Para saberlo necesito un conjunto de preguntas con sus respuestas correctas, un modelo que haga de juez y puntúe las respuestas, y que todo eso se ejecute cada vez que cambio algo, igual que los tests. Hoy, si cambio el prompt, sé que no he roto nada… pero no sé si lo he empeorado.\n\n[pausa]",
  },
  {
    station: "pendiente", set: { lit: 2 },
    notes: "Lo segundo: que el agente te conozca antes de planificarte. Ahora mismo, si le pides una rutina, te la hace con lo que sabe. Lo que quiero es que la primera vez te entreviste, como haría un entrenador el primer día: cuántos días puedes entrenar, qué lesiones tienes, qué material hay en tu gimnasio. Y que, a partir de ahí, haga un plan, lo vaya ejecutando y lo corrija cuando vea que no estás progresando.",
  },
  {
    station: "pendiente", set: { lit: 3 },
    notes: "Lo tercero: darte más control sobre lo que hace. Que, antes de escribir en tus datos, te enseñe lo que va a hacer y te pida confirmación. Que puedas pararle a mitad de una respuesta. Y que, si te has equivocado en un mensaje, puedas editarlo y la conversación vuelva atrás desde ese punto.",
  },
  {
    station: "pendiente", set: { lit: 4 },
    notes: "Lo cuarto: que busque mejor. Hoy, si buscas «algo para el desayuno con mucha proteína», la búsqueda va por palabras. Quiero que busque por significado: alimentos, ejercicios y rutinas. Y que recuerde conversaciones anteriores sin tener que meterlas todas en el contexto.",
  },
  {
    station: "pendiente", set: { lit: 5 },
    notes: "Lo quinto: saber lo que cuesta. Cuántos tokens gasta cada conversación, cuánto dinero es y dónde se va el tiempo de cada respuesta. Como la clave es de cada usuario, cada conversación la paga el usuario, así que tengo que saber lo que cuesta.\n\n[pausa]",
  },
  {
    station: "pendiente", set: { a2a: 1 }, cam: [17, 0.3, 12, 17, 0.3, 0],
    notes: "Y lo último, que tiene su gracia.\n\nEmpecé esta historia quejándome de que mis apps no compartían datos con ChatGPT ni con Claude. Pues lo siguiente que quiero es que el agente de Gymnasia pueda hablar con otros agentes. Para eso quiero implementar un protocolo que se llama A2A, agent to agent, que sirve precisamente para eso: que dos agentes se entiendan entre ellos.",
  },
  {
    station: "pendiente", set: { cart: 1 },
    notes: "Tú imagínate un agente que te hace la compra. Antes de llenar el carrito, le pregunta al agente de Gymnasia: «¿cuántas calorías tiene que comer esta semana? ¿Cuánta proteína? ¿Qué le gusta y qué no?». Y el de Gymnasia le contesta.",
  },
  {
    station: "pendiente", set: { broccoli: 1 },
    notes: "Y el carrito llega sin brócoli.\n\n[pausa]\n\nPasé de quejarme de las apps que no comparten sus datos a hacer una que sí los comparte.",
  },
  // ── 11. Cierre ───────────────────────────────────────────────
  {
    station: "mesa", section: "Cierre", set: { title: 0, merge: 0, cubeLabels: 0, cold: 1, islands: 1, jump: 0, moral: 0 },
    notes: "[vuelves al restaurante del principio]\n\n¿Os acordáis del arroz enfriándose mientras yo copiaba y pegaba mi vida en ChatGPT?",
  },
  {
    station: "mesa", flash: true, set: { cold: 0, merge: 1, bite: 1 },
    notes: "Ahora, cuando me traen el arroz, le hago una foto… y me lo como caliente.\n\n[pausa]",
  },
  {
    station: "mesa", set: { moral: 1 },
    notes: "Al final, lo difícil nunca fue que el agente supiera de nutrición. Eso ya lo sabía. Lo difícil era que supiera de mí sin que yo tuviera que contárselo. Y que, sabiéndolo, no lo estropeara.\n\n[pausa]",
  },
  {
    station: "mesa", set: { thanks: 1, moral: 0 },
    notes: "Gracias.",
  },
];

// Estado de una parada en el paso `index`: se acumulan los `set` de todos los
// pasos anteriores de esa parada. La cámara es la del último paso con `cam`
// dentro del tramo continuo actual de la parada, o la de la parada.
window.resolveStation = function resolveStation(station, index) {
  const state = {};
  for (let i = 0; i <= index; i++) {
    if (STEPS[i].station === station) Object.assign(state, STEPS[i].set);
  }
  return state;
};

window.resolveCamera = function resolveCamera(index) {
  const station = STEPS[index].station;
  for (let i = index; i >= 0 && STEPS[i].station === station; i--) {
    if (STEPS[i].cam) return STEPS[i].cam;
  }
  return STATIONS[station].cam;
};
