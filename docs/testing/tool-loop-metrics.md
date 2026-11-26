# Medidas del bucle de tools de Coach

GYM-26 (ticket para estudiar el patrón ReAct de planificación paso a paso) añade
medidas al bucle con el que Coach alterna pensar, llamar a una tool y leer su
resultado. Sirven de línea base para comparar los demás patrones de planificación
de la épica GYM-25 (ticket que agrupa los patrones de planificación de agentes).

## Dónde se mide

En la frontera de cada petición al proveedor, dentro de
`apps/mobile/agent/providerToolClient.ts`. El turno que devuelve el proveedor dice
qué tools pidió el modelo, y la conversación de la petición siguiente trae sus
resultados. Por eso los bucles de `providerToolLoop.ts` no cambian, y un test
comprueba que las peticiones son idénticas con y sin medidas.

Cubre los cuatro bucles: OpenAI, Anthropic, Google y el endpoint propio compatible
con OpenAI. El estimador de comidas no se mide.

## Qué se registra

Las medidas van a las trazas locales (`Ajustes → Trazas`) con la etiqueta
`toolLoop`. Hay dos eventos:

- **`round`**, uno por petición al proveedor: número de vuelta (`round`, empieza
  en 0), si es la llamada de cierre tras agotar las vueltas (`closing`), tamaño en
  caracteres y número de mensajes de la conversación enviada (`contextChars`,
  `contextMessages`; sin instrucciones ni catálogo de tools, que no cambian dentro
  de una respuesta), tokens de entrada y salida (`inputTokens`, `outputTokens`),
  duración de la petición (`providerMs`) y una entrada por llamada a tool.
- **`loop_finished`**, uno por respuesta: cómo terminó (`answered`, `round_limit`
  o `error`), vueltas, llamadas a tools, llamadas fallidas, tokens totales, tamaño
  final de la conversación y duración total.

Cada llamada a tool registra su nombre canónico (o `unknown` si el modelo se
inventó una), su efecto, si los argumentos eran un objeto legible
(`argumentsParsed`), el resultado (`ok`, `error`, `not_executed` si ya no quedaban
vueltas, o `unanswered` si el turno falló antes) y, si falló, el código de error
de la app (`errorCode`, por ejemplo `invalid_tool_arguments` o
`repeated_tool_call`) con el número de problemas de validación (`issueCount`).

### Tokens

- OpenAI: `usage` del evento `response.completed`.
- Anthropic: entrada de `message_start` (nuevos + escritura y lectura de caché) y
  salida acumulada del último `message_delta`.
- Google: `total_input_tokens` y `total_output_tokens` del uso de la interacción.
- Endpoint propio: vacío. No se pide el uso para no cambiar la petición, porque
  hay servidores que rechazan opciones que no conocen.

## Privacidad

Las medidas **nunca** contienen argumentos, resultados, texto del usuario o del
modelo, IDs del proveedor ni nombres de tool inventados. Lo garantiza un test que
siembra marcas en todos esos sitios y comprueba que ninguna aparece en los eventos.
Los argumentos completos de la batería de tareas de referencia se capturan aparte,
desde el navegador y con datos inventados; la app no los guarda.

## Cómo se corta un bucle infinito

Dos protecciones, ambas en `providerToolLoop.ts` y cubiertas por
`providerToolClient.metrics.test.ts`:

1. **Tope de vueltas** (`MAX_TOOL_ROUNDS = 10`). Un modelo que pide tools sin parar
   produce como mucho 12 peticiones: la inicial, 10 vueltas y una llamada de
   cierre con las tools prohibidas. Las tools pedidas en la última vuelta no se
   ejecutan (`not_executed`) y la llamada de cierre obliga a responder con lo que
   ya sabe y a explicar qué quedó sin hacer. La respuesta termina en
   `round_limit`.
2. **Lecturas repetidas** (`MAX_IDENTICAL_READS = 2`). Si el modelo repite la misma
   consulta con los mismos argumentos, la tercera no se ejecuta y devuelve
   `repeated_tool_call`, para que cambie de enfoque antes de gastar el tope.
