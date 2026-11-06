# Cómo debe actuar un agente de IA cuando falla una tool

## Preparación de la grabación

- **Público:** desarrolladores que quieren construir agentes; no necesitan conocer Gymnasia ni haber visto otros vídeos de la serie.
- **Promesa:** entender qué debe comunicar una operación fallida y cómo decidir si corregir, consultar o detenerse sin duplicar acciones.
- **Formato:** explicación a cámara con diagramas progresivos y fragmentos breves en pantalla.
- **Duración:** aproximadamente 13–15 minutos, incluyendo pausas visuales. Las indicaciones visuales y las notas no se leen.
- **Caso principal:** registrar una comida en una app de gimnasio. Una consulta de peso introduce el caso sencillo de lectura.

## 1. Una comida que podría aparecer dos veces

**Locución**

Le dices a un asistente: «Apunta mi comida: doscientos gramos de arroz cocido y ciento cincuenta de pollo». La aplicación intenta guardarla, pero algo falla y no puede confirmar si ha quedado registrada.

¿Qué debería hacer el asistente ahora?

Repetir la operación parece una solución rápida. El problema es que, si la comida ya se había guardado, la añadiría por segunda vez. En tu registro aparecerían dos raciones, con el doble de calorías y de macros: las proteínas, los hidratos y las grasas que llevas anotados ese día.

Para tomar una buena decisión necesitamos saber qué ocurrió y qué podemos comprobar. En este vídeo vamos a ver cómo darle esa información a un agente de inteligencia artificial.

Usaré Gymnasia, una app de gimnasio, como ejemplo. Forma parte de una serie en la que estoy construyendo su agente, Coach. Pero lo que vamos a explicar también sirve para un asistente que crea pedidos o gestiona reservas.

**Visual y ritmo**

Mostrar la petición del usuario. Después, una tarjeta «Guardado sin confirmar» y dos posibles registros: una comida y dos comidas. Son posibilidades, no un fallo reproducido. Resaltar el cambio en las cantidades registradas, sin inventar valores nutricionales. Volver a cámara para presentar la promesa.

## 2. Quién pide la operación y quién la ejecuta

**Locución**

Antes de hablar de errores, necesitamos entender cómo llega el asistente a guardar esa comida.

El modelo puede escribir una respuesta y también pedir que la aplicación haga una operación. Por ejemplo, consultar un peso o guardar una comida. Cada una de esas operaciones se ofrece al modelo como una función. En este contexto, a esa función la llamamos tool.

Una llamada a una tool indica qué operación quiere el modelo y con qué datos. Para guardar una comida, podría incluir el alimento, la cantidad y la fecha.

El modelo solicita la operación, pero hay un programa que comprueba la petición y la ejecuta. A ese programa lo llamamos harness. Es la parte que coordina al modelo con las funciones de la aplicación y controla cómo continúa la conversación.

El recorrido es este. Primero, el modelo pide una tool y queda a la espera de su resultado. Segundo, el harness comprueba que esa tool existe, que puede utilizarse y que los datos enviados tienen la forma que acepta. Tercero, ejecuta la función y recoge lo que ha ocurrido. Cuarto, si se permite continuar, envía el resultado al modelo, que puede responder al usuario o pedir otra operación.

Cuando el modelo recibe la salida, la función ya se ha ejecutado. Esa salida le cuenta lo que pasó. Entregarla no vuelve a guardar la comida.

Por eso el resultado importa tanto: es la información que tiene el modelo para decidir qué decir o qué pedir después.

**Visual y ritmo**

Construir el diagrama de izquierda a derecha, revelando cada paso al nombrarlo:

1. Modelo: solicita una operación.
2. Harness: comprueba la petición.
3. Aplicación: ejecuta la función.
4. Harness: entrega el resultado si permite continuar.
5. Modelo: responde o solicita otra operación.

Separar gráficamente el modelo del programa local. Mantener la función ejecutada en el paso 3, sin una segunda ejecución al entregar el resultado. No dibujar una interrupción y una repetición como recorrido normal.

## 3. El mismo mensaje de error puede necesitar decisiones distintas

**Locución**

Empecemos con algo más sencillo que guardar una comida: leer un peso. El usuario pregunta: «¿Cuánto pesaba hace un mes?».

Para resolverlo, la aplicación necesita una referencia de fecha y consultar el día correspondiente. Supongamos que esa fecha ya está calculada.

Pueden ocurrir varias cosas. La consulta puede devolver setenta y seis kilos. Puede no encontrar un peso para ese día. O puede fallar porque la aplicación no consigue leer los datos guardados.

En los dos últimos casos no hemos obtenido el peso solicitado, pero la situación es distinta. Si falta ese día, quizá tengamos otra medida cercana que ayude a responder. Si no podemos leer el registro, todavía no sabemos qué medidas contiene.

También puede pasar algo antes de consultar: que el modelo envíe una fecha con un formato que la función no acepta. En ese caso, el harness debe rechazar la petición sin ejecutar la lectura y permitir que se corrija.

Un mensaje como «Error al consultar» deja todas estas situaciones mezcladas. Podemos escribir una explicación más precisa, pero además necesitamos que el programa comunique el estado de la operación de una manera reconocible.

A ese acuerdo lo llamamos contrato de errores. Debe responder a tres preguntas: ¿la operación falló?, ¿qué problema ocurrió?, ¿qué se permite hacer ahora?

La marca de error la pone el programa que ejecuta la operación. El texto que escribió el usuario sigue siendo contenido del usuario. No necesitamos buscar palabras como «Error» dentro de sus datos para decidir si la lectura funcionó.

**Visual y ritmo**

Una petición y tres tarjetas sucesivas: «Peso encontrado», «Sin registro ese día», «No se pudo leer el almacenamiento». Añadir el argumento inválido como problema anterior a la ejecución. Después mostrar las tres preguntas del contrato. Evitar introducir todavía un objeto JSON completo.

## 4. Corregir, buscar una alternativa o parar

**Locución**

Vamos a convertir esas situaciones en decisiones concretas.

La primera es permitir que el modelo corrija los datos de la llamada. Si la fecha tiene un formato inválido, puede enviar una fecha válida. La operación todavía no se ha ejecutado: estamos arreglando la petición antes de hacerla.

La segunda es permitir otra consulta que ayude a responder. Si no hay peso en la fecha solicitada y las funciones disponibles permiten consultar medidas cercanas, el modelo puede buscar una alternativa dentro de la petición del usuario. Cada nueva llamada vuelve a pasar por las comprobaciones del harness.

Eso no permite inventar el peso que falta. Si encuentra una medida de otro día, debe explicar de qué día es. Un peso del día anterior no se convierte en el peso de la fecha que preguntaste.

La tercera decisión es detener el turno. Si el programa no puede continuar con garantías, no permite más operaciones en ese turno y muestra un aviso adecuado al usuario.

En pantalla tienes los nombres de estas tres decisiones tal como aparecen en el código. Los nombres son etiquetas para las opciones que acabamos de explicar.

Ahora fíjate en este resultado de ejemplo. Dice que la operación falló, que no encontró el registro y que permite buscar una alternativa. El modelo recibe tanto la explicación como esa regla de continuación.

La regla tampoco le da permiso para hacer cualquier cosa. Por ejemplo, que falte un peso no autoriza a crear uno. El harness sigue comprobando las nuevas peticiones.

**Visual y ritmo**

Revelar primero el significado y después su identificador:

| Decisión | Identificador en el contrato |
| --- | --- |
| Corregir los argumentos antes de ejecutar | `correct_arguments` |
| Elegir otra consulta útil dentro de la petición | `choose_alternative` |
| Detener el turno | `stop_turn` |

Mostrar después solo estos campos del contrato interno. Resaltar uno a uno mientras se explica qué aportan; no leer la sintaxis:

```json
{
  "is_error": true,
  "error": "not_found",
  "message": "No hay registro para esa fecha.",
  "recovery": "choose_alternative"
}
```

Rotular «Fragmento ilustrativo del contrato interno». El formato completo incluye otros campos y un mensaje más preciso. La consulta espontánea de una fecha cercana es una posibilidad condicionada, no una demostración de comportamiento ya observado.

## 5. Un error de la app tiene que llegar como error de la app

**Locución**

Hay otra distinción importante: dónde se ha producido el fallo.

El proveedor del modelo puede responder correctamente y pedir que guardemos una comida. Después, la aplicación intenta escribirla en su almacenamiento y esa escritura falla. El problema está en la aplicación, aunque estemos usando un modelo de OpenAI, Anthropic o Google.

Si solo capturamos los errores al pedir una respuesta al proveedor, este fallo local se nos puede escapar. Necesitamos controlar también lo que ocurre al ejecutar la función.

Algunos problemas son esperados, como no encontrar un peso. La función puede devolver ese resultado con su regla de recuperación. Otros son fallos técnicos inesperados: algo interrumpe la operación cuando estaba ejecutándose.

En ese segundo caso puede haber un mensaje con rutas de archivos o detalles del almacenamiento. Quien desarrolla la app puede necesitar esos detalles para investigar. El modelo necesita saber qué operación falló, qué resultado está confirmado y qué puede hacer después. Y el usuario necesita una respuesta que le permita seguir usando la app.

Si le decimos «Error del proveedor», le estamos señalando el servicio equivocado. Si exponemos una excepción llena de detalles internos, tampoco le ayudamos a saber si su comida se guardó.

El contrato debe conservar esa distinción y comunicar un mensaje adecuado para cada destinatario.

**Visual y ritmo**

Dos zonas: «Proveedor: entrega la petición» y «App: intenta guardar». Marcar el fallo en la segunda. Mostrar tres destinatarios con su información: diagnóstico para desarrollo, estado y permisos para el modelo, resultado y siguiente paso para el usuario. No usar rutas o excepciones reales en pantalla.

## 6. Volvamos a la comida: comprobar antes de repetir

**Locución**

Volvamos a nuestra comida de arroz con pollo. La aplicación ha intentado guardarla y no puede confirmar el resultado.

El fallo pudo ocurrir antes de guardarla. Pero también podría haberse guardado y haber fallado algo después, antes de recibir la confirmación. La falta de confirmación, por sí sola, no resuelve cuál de las dos cosas ocurrió.

Aquí podemos diseñar el harness para que permita una consulta de comprobación antes de decidir que hay que parar. Si el modelo tiene disponible esa consulta, puede pedirla para averiguar si la comida quedó registrada.

Esa comprobación tiene que identificar la acción concreta que intentábamos completar. Encontrar otra comida de arroz con pollo no basta: podría ser una comida anterior. El sistema necesita una manera fiable de relacionar el registro con aquella petición.

Si la consulta confirma que esa comida ya se guardó, el asistente puede responder: «He apuntado tu comida». El usuario ha obtenido lo que pidió y no necesita conocer cada paso de la comprobación interna.

Si confirma que no se guardó, el harness puede permitir completar la acción pendiente siguiendo sus reglas.

Y si no consigue averiguar qué pasó, debe detenerse sin repetir la escritura. Entonces sí hace falta un aviso: «No puedo confirmar si se guardó la comida. Comprueba tu registro antes de volver a añadirla».

Esta consulta de comprobación es una opción de diseño. En el fallo de escritura que probamos en Gymnasia, el comportamiento fue detener el turno. No se hizo una consulta adicional al modelo ni se repitió el guardado.

Para añadir la comprobación que acabamos de describir habría que permitirla antes de ordenar la parada y probar sus distintos resultados. Una vez que el harness ha detenido el turno, el modelo no puede continuar por su cuenta.

Un modelo capaz puede elegir una buena consulta. El programa tiene que ofrecerle esa consulta, permitirla en ese momento y darle información suficiente para interpretar el resultado.

**Visual y ritmo**

Rotular toda esta propuesta «Diseño posible: comprobar antes de detenerse». Desde «Guardado sin confirmar», dibujar una consulta de solo lectura con tres salidas:

- Acción identificada y comida guardada → confirmar al usuario.
- Ausencia confirmada de esa acción → el harness puede permitir completarla.
- Resultado ambiguo o comprobación fallida → detenerse y pedir revisar el registro.

Mostrar una etiqueta de petición enlazada a su registro, sin presentarla como mecanismo implementado de esta propuesta. Al narrar lo probado en Gymnasia, cambiar a un diagrama separado: «Fallo de escritura → parada local → sin segunda escritura».

## 7. Cómo sabemos que las decisiones se respetan

**Locución**

Para probar este contrato, necesitamos mirar lo que hace el programa además de la respuesta que aparece en el chat.

Si enviamos argumentos inválidos, comprobamos que la función no llega a ejecutarse antes de corregirlos. Si simulamos un fallo al guardar, comprobamos que no se confirma el éxito ni se hace una segunda escritura automática.

También comprobamos qué se envía al modelo. Gymnasia usa OpenAI, Anthropic y Google Interactions, y sus APIs no empaquetan los resultados exactamente igual.

El harness decide primero el estado de la operación. Después, un adaptador, que es la parte que prepara el mensaje para cada API, lo expresa en el formato correspondiente y lo relaciona con la llamada original.

En OpenAI Responses, el contrato viaja dentro del contenido del resultado. Anthropic y Google Interactions también tienen una marca de error en el mensaje de resultado. Lo que debe mantenerse es el significado: qué pasó y qué se permite hacer después.

Las pruebas con respuestas simuladas comprueban estas decisiones de forma repetible. También hicimos una prueba en la web con un modelo real: al faltar un peso, pudo consultar otra fecha que se había indicado en la prueba. Al provocar un fallo local de escritura, el programa detuvo el turno.

Eso aporta evidencia sobre esos recorridos. No demuestra que cualquier modelo vaya a buscar por sí solo la mejor fecha, ni que este formato siempre mejore su respuesta. Lo que sí podemos comprobar es que el programa entrega un estado explícito y aplica sus reglas de continuación.

**Visual y ritmo**

Mostrar «Respuesta visible» junto a «Operaciones realmente ejecutadas». Después, tres tarjetas de proveedores y una sola decisión central. Si se muestran identificadores, hacerlo con estas diferencias exactas:

- OpenAI Responses: `function_call_output`, contrato serializado dentro de `output`, correlación por `call_id`. No añadir `is_error` al nivel superior.
- Anthropic Messages: `tool_result`, `is_error: true`, correlación por `tool_use_id`.
- Google Interactions: `function_result`, `is_error: true`, correlación por `call_id`.

Cerrar con las dos comprobaciones reales. Las fechas, versiones y el nombre del modelo quedan en las fuentes, fuera de la locución.

## 8. Qué te llevas para tu agente

**Locución**

Ahora podemos responder a la pregunta del principio. Si no sabemos si la comida se guardó, antes de repetir necesitamos una comprobación fiable. Si está guardada, confirmamos. Si sabemos que falta y está permitido, completamos la acción. Si seguimos sin saberlo, paramos y ayudamos al usuario a revisar su registro.

Para construir ese comportamiento, el resultado de una tool debe comunicar qué ocurrió y qué se permite hacer después. El modelo utiliza esa información; el harness controla las operaciones.

La idea se aplica igual a una comida, un pedido o una reserva: identifica la acción, conserva su resultado y decide cómo continuar antes de repetir algo que tenga efectos.

En la descripción te dejo el artículo con el contrato completo, las diferencias entre proveedores y las pruebas. También tienes el índice de la serie para seguir construyendo el agente paso a paso.

**Visual y ritmo**

Volver a la comida del principio, ahora con una sola ración y la confirmación como desenlace de la rama comprobada. Terminar con «Qué pasó · Qué se permite después» y las referencias reales del artículo y de la serie. No prometer un episodio futuro sin preparar.

## Notas de producción y fuentes

### Evidencia y límites

- La comida con guardado incierto y su verificación posterior son ejemplos de diseño, no una conversación real ni una funcionalidad adicional demostrada en la QA.
- El caso de peso relativo supone una referencia temporal resuelta. No se afirma que este cambio incorpore por sí mismo un reloj o la resolución de fechas relativas.
- La prueba real de lectura incluía explícitamente una fecha alternativa. El guión no convierte ese prompt de prueba en diálogo de un usuario cotidiano ni atribuye al modelo una búsqueda espontánea que no se verificó.
- El fallo de escritura real fue inducido sobre un peso ficticio. No se observó una comida duplicada. Se comprobó la parada local, la ausencia de otra ronda y de un nuevo registro; después de retirar el fallo, se comprobó un guardado correcto y su persistencia.
- La QA real cubrió un modelo en web. Los formatos de los tres proveedores se comprobaron con pruebas deterministas y proveedores simulados.
- La comparación exploratoria con el formato antiguo no reprodujo una confusión entre error y dato válido. No usar un montaje «antes/después» que sugiera esa confusión ni una mejora universal.
- La marca de éxito o error procede del ejecutor; no se deduce buscando palabras o un JSON dentro del contenido del usuario.
- El fragmento JSON es una selección editorial del contrato interno, no un formato de salida obligatorio común a los tres proveedores. No sustituye al schema de argumentos que se valida antes de ejecutar.

### Fuentes para edición y descripción

- [Artículo completo](https://www.maximofn.com/gymnasia-agent-tool-errors/).
- [Índice de la serie](https://www.maximofn.com/gymnasia-agent#serie).
- [QA documentada y alcance de las pruebas](../testing/coach-tool-errors-qa.md).
- Implementación del contrato: `apps/mobile/agent/toolErrors.ts`; traducción a formatos de proveedores: `apps/mobile/agent/providerToolLoop.ts`. Los nombres de archivos son referencias para quien prepara el vídeo, no parte de la narración.
- [Implementación revisada del contrato y control de errores](https://github.com/maximofn/gymnasia/pull/315).

### Revisión editorial

El recorrido presenta el problema, define tool y harness, explica la secuencia de ejecución, introduce las decisiones antes de sus identificadores y aplica el contrato a una escritura incierta. Las visuales se revelan al ritmo de la explicación. La narración distingue la implementación comprobada de una opción de diseño y deja los datos de QA fuera de la historia principal.

### Estimación de duración

La locución tiene 1.819 palabras. A un ritmo supuesto de 135–150 palabras por minuto, ocupa unos 12–13,5 minutos. Añadiendo entre 45 y 90 segundos para observar los diagramas y el fragmento del contrato, la previsión de grabación es de unos 13–15 minutos. Es una estimación, no una duración medida.
