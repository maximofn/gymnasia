# Guion de YouTube: cómo decide un agente paso a paso (línea base ReAct de Coach)

## Ficha de grabación

**Título de trabajo:** Así piensa un agente paso a paso: lo medí en 36 tareas reales

**Público y conocimientos previos:** personas que quieren entender a alto nivel cómo
se construyen agentes de IA. Saben qué es un modelo de lenguaje y han oído hablar de
agentes y de «tool calling», pero no vienen a aprender a programarlos. No se enseña
código: se cuenta la idea con diagramas, un ejemplo real y resultados medidos.

**Promesa:** al terminar, el espectador sabe qué pasa por dentro cuando le pide algo a
un agente, por qué se llama ReAct, cuánto cuesta cada paso y en qué falla de verdad.

**Ejemplo central:** Coach, el asistente de Gymnasia, una app de entrenamiento y
nutrición. El usuario le pide: «Añade a la cena de hoy 150 g de pechuga de pollo,
200 g de arroz blanco cocido y una manzana».

**Duración estimada:** unas 1.870 palabras de narración a 140–160 palabras por minuto
son 11,5–13,5 minutos, más 1–2 minutos de pausas para diagramas. Total: 13–15 minutos.

---

## Apertura: una petición sencilla que no es tan sencilla

**Narración:**

Le escribo a mi asistente de entrenamiento: «Añade a la cena de hoy 150 gramos de
pechuga de pollo, 200 de arroz blanco cocido y una manzana». Unos segundos después me
contesta que ya está, y en la pantalla de dieta aparecen los tres alimentos con sus
calorías.

Parece una sola acción, pero por dentro el agente ha hecho cuatro viajes de ida y
vuelta al modelo. Ha buscado los alimentos, ha descubierto que uno no estaba como él
esperaba, ha vuelto a buscar, ha guardado y, por fin, ha contestado. Nadie le dio un
plan. Lo fue decidiendo sobre la marcha.

En este vídeo vamos a ver cómo funciona ese «sobre la marcha», que tiene nombre:
ReAct. Y no lo vamos a ver en teoría. Le pedí a mi agente doce tareas distintas, tres
veces cada una, y medí cuántos pasos dio, cuánto costó y dónde se equivocó. Algunos
resultados no son los que yo esperaba.

**Indicaciones visuales (no se leen):**
- Grabación de pantalla real: el mensaje en el chat de Coach, la respuesta y la
  pantalla de dieta con los tres alimentos.
- Al decir «cuatro viajes», cuatro flechas de ida y vuelta entre «App» y «Modelo»
  que aparecen una a una.
- Rótulo final: «12 tareas × 3 repeticiones = 36 conversaciones».

---

## Quién hace qué: el modelo decide, la app ejecuta

**Narración:**

Antes de mirar dentro, conviene tener claro quién hace qué, porque es la idea en la
que más se confunde la gente.

Hay tres actores. El usuario, que escribe en el chat. La app, que tiene los datos: las
rutinas, las comidas, las medidas, todo guardado en el propio móvil. Y el modelo de
lenguaje, que vive en los servidores del proveedor, en este caso OpenAI.

El modelo no puede tocar tus datos. No ve tu dieta ni puede escribir en ella. Lo único
que sabe hacer es leer texto y responder con texto. Entonces, ¿cómo añade una comida?

Con herramientas. La app le dice al modelo: «Estas son las cosas que yo sé hacer:
buscar un alimento, leer lo que comiste un día, añadir alimentos a una comida…». Cada
una con su nombre y con los datos que necesita. A eso se le llama una «tool», una
herramienta.

Cuando el modelo quiere usar una, no la ejecuta. Responde algo así como: «Por favor,
busca "pechuga de pollo"». Es la app la que hace la búsqueda en sus datos y le
devuelve el resultado. El modelo decide; la app ejecuta.

**Indicaciones visuales (no se leen):**
- Diagrama de tres cajas: Usuario, App (con un icono de móvil y «tus datos»), Modelo
  (con una nube y «proveedor»).
- Al decir «no puede tocar tus datos», una línea cortada entre Modelo y los datos.
- Lista corta de herramientas que aparece dentro de la App: «buscar alimento», «leer
  dieta del día», «añadir alimentos a una comida». Sin nombres técnicos.
- La petición del modelo como un bocadillo: «Busca: pechuga de pollo». La flecha de
  ejecución sale de la App, no del Modelo.

---

## El bucle: pensar, actuar, observar

**Narración:**

Ahora sí, el mecanismo. Funciona como una conversación que se repite.

Primero, la app le manda al modelo un paquete con todo: las instrucciones de cómo debe
comportarse, la lista de herramientas y la conversación hasta ese momento.

El modelo responde una de dos cosas. O una respuesta final para el usuario, y ahí se
acaba. O una o varias peticiones de herramientas.

Si pide herramientas, la app las ejecuta, añade los resultados a la conversación y
vuelve a mandar el paquete completo. El modelo ve lo que ha pasado y decide el
siguiente paso.

Cada una de esas idas y venidas es una vuelta. Y a este patrón se le llama ReAct, de
«reasoning» y «acting»: razonar y actuar. Razona qué hacer, actúa pidiendo una
herramienta, observa el resultado y vuelve a razonar. No hay un plan escrito al
principio: el plan va apareciendo vuelta a vuelta.

Hay un detalle importante. Para que esto no gire para siempre, la app pone un tope: como
mucho diez vueltas por respuesta. Ahora veremos si hace falta.

**Indicaciones visuales (no se leen):**
- Diagrama circular con tres pasos que se iluminan de uno en uno mientras se nombran:
  «Pensar» (Modelo), «Actuar» (App ejecuta la herramienta), «Observar» (el resultado
  vuelve al Modelo).
- El paquete que viaja: tres capas apiladas, «Instrucciones», «Herramientas»,
  «Conversación». La capa de conversación crece en cada vuelta.
- Salida del círculo con la etiqueta «Respuesta final».
- Contador en una esquina: «Vuelta 1 de 10 como máximo».

---

## El ejemplo, vuelta a vuelta

**Narración:**

Volvamos a la cena. Así fue de verdad, sacado de las trazas de la app.

Vuelta uno. El modelo lee la petición y pide tres búsquedas a la vez: pechuga de pollo,
arroz blanco cocido y manzana. Fíjate en esto: no las pide de una en una. Sabe que son
independientes y las lanza juntas.

Vuelta dos. Llegan los resultados. El pollo y la manzana aparecen sin problema, pero la
búsqueda de «arroz blanco cocido» no le convence. Así que vuelve a buscar, esta vez
solo «arroz blanco». Esto es lo que un plan cerrado no podría hacer: reaccionar a lo
que encuentra.

Vuelta tres. Ya tiene los tres alimentos. Pide a la app que los añada a la cena de hoy,
los tres de una vez, con sus gramos. Para la manzana elige 180 gramos, que es lo que
pesa una manzana normal.

Vuelta cuatro. La app le confirma que se guardaron. El modelo ya no pide nada más y
contesta al usuario.

Cuatro vueltas, cinco herramientas, unos siete segundos. Y comprobé que en la pantalla
de dieta aparecían exactamente esos tres alimentos.

**Indicaciones visuales (no se leen):**
- Línea de tiempo horizontal con cuatro columnas, «Vuelta 1» a «Vuelta 4». Cada columna
  aparece cuando se narra.
- Vuelta 1: tres tarjetas de búsqueda que salen a la vez, en paralelo.
- Vuelta 2: la tarjeta del arroz con un signo de interrogación y una nueva tarjeta,
  «arroz blanco».
- Vuelta 3: una sola tarjeta «añadir a la cena» con los tres alimentos y sus gramos.
- Vuelta 4: bocadillo de respuesta al usuario.
- Cierre: la pantalla de dieta real con los tres alimentos.

---

## Cómo lo medí

**Narración:**

Un ejemplo bonito no demuestra nada. Así que monté una prueba.

Doce tareas, de las que haría un usuario normal. Preguntas, como «¿qué ejercicios tiene
mi rutina de empuje?» o «¿cómo ha ido mi peso este mes?». Cambios, como «cambia la
sentadilla por prensa de piernas» o «en el desayuno no eran 100 gramos de avena, eran
60». Y tareas mixtas, que mezclan leer, pensar y escribir, como «hazme un resumen de la
semana y registra que hoy peso 78 kilos».

Cada tarea, tres veces, siempre con el mismo modelo y siempre empezando desde los mismos
datos inventados: tres rutinas, un mes de entrenos, una semana de dieta y varios pesajes.
Antes de cada intento se restauraban los datos, para que ninguno heredara los cambios
del anterior.

Y para decidir si acertaba no me fié del texto de la respuesta. Un agente puede decir
«hecho» sin haberlo hecho. Miré los datos guardados después de cada intento y recalculé
las cifras a mano.

**Indicaciones visuales (no se leen):**
- Cuadrícula de 12 tarjetas, agrupadas por color: preguntas, cambios y mixtas. Se
  leen en voz alta solo las de ejemplo.
- Cada tarjeta se multiplica por tres: «×3».
- Icono de «restaurar» entre intento e intento.
- Contraste: un bocadillo que dice «¡Hecho!» frente a la pantalla de datos, con una
  marca de verificación sobre los datos, no sobre el bocadillo.

---

## Los resultados: funciona, y con margen

**Narración:**

Resultado: 32 respuestas correctas de 36.

Hizo 109 llamadas a herramientas y ninguna falló. Ni datos mal formados, ni
herramientas inventadas, ni repeticiones absurdas.

Y el tope de diez vueltas no hizo falta nunca. La tarea más larga usó cinco. La media
fue de tres vueltas por respuesta.

Las cuatro respuestas que no cuento como correctas tampoco son fallos del bucle. Una
fue una pregunta razonable: le pedí copiar «la comida de ayer» y me preguntó si me
refería al almuerzo o a cualquier comida del día. Las otras tres tienen una historia
más interesante, que cuento en un momento.

**Indicaciones visuales (no se leen):**
- Tres cifras grandes que aparecen de una en una: «32/36 correctas», «0 llamadas
  fallidas de 109», «máximo 5 vueltas de 10».
- Pequeño histograma de vueltas por intento, con la línea del tope en 10 muy por
  encima de todas las barras.

---

## Lo que cuesta: repetir las instrucciones

**Narración:**

Ahora, el coste. Aquí me llevé la primera sorpresa.

Uno pensaría que lo caro es lo que el modelo «piensa» o escribe. Pues no. De media, el
modelo escribió unos 400 tokens por tarea. Los tokens son los trozos de texto con los
que cuentan y cobran los modelos. En cambio, leyó unos 37.000.

¿Por qué tanto? Por lo que vimos en el bucle: en cada vuelta se reenvía el paquete
completo. Y solo las instrucciones y la lista de herramientas, antes de que haya una
sola palabra de conversación, ya suman unos 10.500 tokens.

Haz la cuenta con una tarea de cinco vueltas: unos 52.000 de sus 65.000 tokens de
entrada son ese mismo bloque repetido cinco veces.

Esto es lo normal: los modelos no recuerdan nada entre una petición y la siguiente, así
que hay que mandárselo todo cada vez. Pero tiene una consecuencia clara: cada vuelta de
más cuesta, sobre todo, repetir instrucciones. Si quieres abaratar un agente, el primer
sitio donde mirar es cuántas vueltas da y qué se reenvía en cada una. Ojo: algunos
proveedores cobran más barata la parte que se repite, y ese descuento no lo medí.

**Indicaciones visuales (no se leen):**
- Dos barras: «salida ≈ 400 tokens» (diminuta) y «entrada ≈ 37.000 tokens» (enorme).
- Animación de la tarea de cinco vueltas: cinco paquetes apilados; en cada uno, la
  capa «Instrucciones + herramientas» del mismo color y tamaño, y la capa de
  conversación creciendo. Rótulo: «≈ 52.000 de 65.000 tokens: el mismo bloque».
- Nota pequeña en pantalla: «Coste en tokens enviados, no en dinero facturado».

---

## El plan que nadie le pidió

**Narración:**

Segunda sorpresa. Dije que ReAct no planifica: decide paso a paso. Pero mirando las
llamadas, el modelo sí hace algo parecido a planificar.

En el ejemplo de la cena lanzó las tres búsquedas juntas. Cuando le pedí crear una
rutina de tirón con cuatro ejercicios, buscó los cuatro a la vez. Y en el resumen
semanal leyó entrenos, dieta y peso en la misma vuelta, y en una de las repeticiones
hasta registró el peso nuevo en esa misma vuelta.

Es un plan implícito: el modelo ve qué cosas no dependen unas de otras y las agrupa.
Hay otros patrones de agentes que hacen esto de forma explícita: primero escriben un
plan completo y luego lo ejecutan. Lo interesante es que aquí, sin pedírselo, una parte
de ese trabajo ya ocurre.

**Indicaciones visuales (no se leen):**
- Tres ejemplos en columnas, cada uno con sus llamadas agrupadas en una misma vuelta:
  «Cena: 3 búsquedas a la vez», «Rutina de tirón: 4 búsquedas a la vez», «Resumen:
  leer entrenos, dieta y peso a la vez».
- Rótulo: «Plan implícito: agrupa lo que es independiente».

---

## De dónde salen las vueltas de más

**Narración:**

Entonces, si agrupa tan bien, ¿por qué unas tareas tardan cinco vueltas y otras dos?

Las vueltas extra aparecen casi siempre por lo mismo: una observación que le obliga a
cambiar de idea. En la rutina de tirón, el modelo quiso incluir un ejercicio llamado
«face pull». Lo buscó y no estaba en el catálogo. En otra repetición buscó «pájaros» y
tampoco. Así que en la vuelta siguiente probó con otro nombre, encontró un ejercicio
equivalente y siguió.

Es justo la ventaja de este patrón. Un plan cerrado de antemano habría dicho «añade
face pull» y se habría roto ahí. ReAct ve el hueco y se adapta.

También vi variación entre repeticiones. La misma tarea a veces salía en cuatro
vueltas y a veces en cinco, según el modelo juntara o separara una lectura y una
búsqueda. Por eso repetí cada tarea tres veces: con una sola, habría confundido la
suerte con el comportamiento.

**Indicaciones visuales (no se leen):**
- Línea de tiempo de la rutina de tirón: cuatro búsquedas en paralelo; una tarjeta,
  «face pull», marcada con «0 resultados»; en la vuelta siguiente, una búsqueda nueva
  con otro nombre y una marca verde.
- Comparación lado a lado: «Plan cerrado → se para en face pull» frente a «ReAct →
  reformula y sigue».

---

## Donde falla de verdad: las herramientas

**Narración:**

Y ahora, los fallos. Porque los hubo, y no estaban donde yo los buscaba.

Le pregunté: «¿Cuánto he subido en press banca este mes?». En los datos había subido de
65 a 70 kilos. Las tres veces respondió que no podía saberlo. Y tenía razón. La
herramienta que lee el historial de entrenos devuelve, por cada sesión, el volumen total
y las repeticiones, pero no qué ejercicios hiciste ni con qué peso. La app lo guarda,
pero el agente no lo puede ver. Lo bueno es que no se inventó la cifra.

Otro caso. Le pregunté si estaba comiendo suficiente proteína para mi peso. En los
ajustes de la app tenía un objetivo de 2 gramos por kilo. Coach no lo usó: aplicó una
referencia general, más baja. Al principio pensé que lo había ignorado. Mirando el
código, el problema es otro: ninguna herramienta le deja leer esos ajustes. Acertó en
la acción, añadir un yogur, pero se quedó corto al explicar cuánto faltaba.

Y el tercero. En tres intentos guardó en su memoria datos que nadie le pidió guardar,
como «peso actual: 78 kilos». ¿Por qué? Porque la descripción de esa herramienta le
dice que la use siempre que el usuario comparta un dato personal. Estaba obedeciendo.

Los tres casos dicen lo mismo: el bucle funcionaba bien. El límite estaba en las
herramientas, en qué datos le dejamos ver y en lo que le dicen sus descripciones. Un
agente no puede ser mejor que sus herramientas.

**Indicaciones visuales (no se leen):**
- Caso 1: a la izquierda, lo que la app guarda (sesión con ejercicios y kilos: «press
  banca 65 → 70 kg»); a la derecha, lo que recibe el agente (solo «volumen» y
  «repeticiones»). Lo que falta, tachado o en gris.
- Caso 2: el ajuste «objetivo de proteína: 2 g/kg» dentro de la app, con un candado
  que el agente no puede abrir.
- Caso 3: la frase de la descripción de la herramienta resaltada, en lenguaje llano:
  «úsala siempre que el usuario comparta un dato personal».
- Rótulo de cierre: «Un agente no puede ser mejor que sus herramientas».

---

## Cierre: qué llevarse

**Narración:**

Volvamos a la cena del principio. Ahora sabemos lo que pasó en esos siete segundos.
El modelo no tocó los datos: pidió herramientas. La app las ejecutó y le devolvió lo
que encontró. Y en cada vuelta, con todo el contexto otra vez, el modelo decidió el
siguiente paso. Eso es ReAct.

Me quedo con tres ideas que sirven para cualquier agente.

Una: lo que más cuesta es repetir las instrucciones en cada vuelta, no lo que el modelo
escribe. Cada vuelta de más se paga sobre todo en eso.

Dos: un buen modelo ya agrupa lo independiente y se adapta cuando algo no sale como
esperaba. Eso es planificar, aunque nadie se lo pida.

Tres: cuando falla, mira primero las herramientas. Qué datos le das y qué le dicen
sus descripciones pesan más que el propio bucle.

Estas cifras son ahora mi punto de partida para comparar este patrón con otras formas
de planificar en agentes, las que escriben el plan antes de actuar, con las mismas
tareas y los mismos datos.

**Indicaciones visuales (no se leen):**
- Repetición rápida de la línea de tiempo de la cena, de la vuelta 1 a la 4.
- Las tres ideas en pantalla, una a una, con un icono cada una: paquete repetido,
  llamadas agrupadas, caja de herramientas.

---

## Notas de producción (no se leen)

**Fuentes:** `docs/agent-patterns/react-baseline/README.md` y `results.json` (métricas
y argumentos de los 36 intentos), `tasks.json` (las 12 tareas) y `make-seed.ts` (datos
inventados). Batería del 25 de noviembre de 2026 con la app 1.64.0 y `gpt-6-luna`, en
la web publicada. Trabajo de GYM-26 (ticket para estudiar el patrón ReAct de
planificación paso a paso).

**Comportamiento verificado:**
- 32/36 correctas tras comprobar el estado guardado; 109 llamadas, 0 fallidas;
  máximo 5 vueltas de 10; media de 3,1 vueltas, ~37.025 tokens de entrada y ~407 de
  salida, 6,7 s.
- Ejemplo de la cena (T06): 4 vueltas y 5 llamadas en las tres repeticiones. Tres
  búsquedas, una nueva búsqueda de «arroz blanco», un único «añadir alimentos» con
  pollo 150 g, arroz 200 g y manzana 180 g. La duración de 6,5 s es la media de la
  tarea; en la narración se redondea a «unos siete segundos». El reparto por vueltas
  se deduce del número de vueltas y del orden de las llamadas (los argumentos
  capturados no llevan número de vuelta).
- Prefijo fijo de ~10.500 tokens y estimación de ~52.000 de ~65.000 en la tarea de 5
  vueltas: README de la batería.
- Rutina de tirón (T04): búsquedas sin resultado de «face pull» (las 3 repeticiones),
  «pájaro máquina» y «pájaros»; 5 vueltas siempre.
- Variación 4–5 vueltas: T03 (cambiar un ejercicio).
- Resumen semanal (T12), repetición 2: registra el peso en la misma vuelta que las
  lecturas.
- Press banca (T02): 0/3; `read_workout_history` no expone peso por ejercicio.
- Proteína (T11): ninguna tool lee los ajustes de dieta; Coach usó 1,2–1,6 g/kg.
- Memoria: `save_personal_data` en T11 rep 3 y T12 reps 1 y 2; su descripción dice
  «SIEMPRE que el usuario comparta información personal».

**Ejemplos ilustrativos:** el bocadillo «Busca: pechuga de pollo» resume la petición
de herramienta; no es el formato real.

**Propuestas no demostradas:** que otros patrones (Plan-and-Execute, ReWOO…) lo hagan
mejor o peor no está medido todavía. El descuento por caché de prompts del proveedor
no se midió. Los arreglos de herramientas están en GYM-278 (ticket para exponer a
Coach el detalle de ejercicios de los entrenos y los ajustes de dieta) y GYM-279
(ticket para que guardar un dato personal nunca borre los demás); no se han
implementado.

**Omitido a propósito en la narración:** nombres de tools, ficheros, versión de la app,
nombre exacto del modelo, captura de argumentos desde el navegador, restauración de
datos por `localStorage`, el argumento doblemente codificado de T11 y el riesgo de
borrado de la memoria (GYM-279), que pide más contexto del que cabe aquí.

## Revisión final

- [x] Se entiende sin vídeos anteriores ni conocer el repositorio.
- [x] Actores (usuario, app, modelo) y «herramienta» se explican antes de usarse.
- [x] El ejemplo es una petición natural y sigue el orden real de ejecución.
- [x] Narración y visuales desarrollan la misma idea a la vez.
- [x] Sin código: solo ideas, diagramas y resultados.
- [x] Se distingue lo medido, lo ilustrativo y lo propuesto.
- [x] Duración calculada solo con la narración, más pausas visuales.
- [x] El cierre resuelve la escena inicial.
