# Proxy CORS de Anthropic

Puente de **desarrollo** que permite usar Anthropic desde el navegador: el
navegador bloquea las llamadas directas a `api.anthropic.com` por política CORS.
En móvil no se usa — la app llama a Anthropic directamente — y la web publicada
no lo incluye. No es un backend de producto: no tiene base de datos, ni sesiones,
ni almacén de claves.

La implementación real está en `apps/anthropic_proxy/cors-proxy.py`.
`apps/mobile/cors-proxy.py` es un symlink a ese fichero.

> **Es un único fichero a propósito.** El arranque documentado lo lanza por el
> symlink, así que `sys.path[0]` es `apps/mobile/`, no este directorio. Un
> `from helpers import ...` reventaría al arrancar y, en cambio, pasaría en
> verde en las pruebas, que lo cargan por su ruta real.

## Arrancar

```bash
uv sync --project apps/anthropic_proxy --extra dev     # solo la primera vez
apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py
curl -sS http://127.0.0.1:8000/health                  # {"ok": true}
```

Escucha en `http://127.0.0.1:8000`. Apunta ahí `EXPO_PUBLIC_API_BASE_URL` para
usar Anthropic en el navegador; por defecto está vacía, de modo que una
compilación publicada nunca llama a un `localhost` ajeno por accidente.

## Pruebas

```bash
npm run test:proxy    # atajo desde la raíz del repositorio
```

No tocan la red ni necesitan una clave: el upstream de Anthropic se sustituye
entero. Se ejecutan en CI, en un job propio de `agent-tests.yml`.

`tests/test_e2e.py` va un paso mas alla y no sustituye nada: levanta el proxy en
un proceso aparte, lo apunta a un servidor local que hace de Anthropic, y habla
con el por HTTP. Es lo que atrapa lo que solo falla al atravesar la pila entera.

## Contrato

| Ruta | Entrada | Hacia Anthropic | Tiempo de espera |
|---|---|---|---|
| `GET /health` | — | nada | — |
| `POST /chat/providers/anthropic/verify` | `api_key`, `model?`, `workspace_id?` | `POST /v1/messages` de un token | 15 s |
| `POST /chat/providers/anthropic/models` | `api_key`, `workspace_id?` | `GET /v1/models`, paginado | 15 s |
| `POST /chat/providers/anthropic/messages` | cuerpo de Messages + `api_key`, `workspace_id?` | `POST /v1/messages` | 120 s |

Las credenciales llegan en el cuerpo y salen como cabecera: `api_key` se
convierte en `x-api-key` y `workspace_id` en `anthropic-workspace-id`. **Ninguna
de las dos se reenvía nunca dentro del cuerpo.** La versión de la API está fija
en `2023-06-01`, que es la única que Anthropic acepta.

`/verify` y `/models` rechazan campos que no conocen, porque su contrato lo
define este proxy. `/messages` los acepta y los reenvía: es una pasarela
transparente de la Messages API, y prohibir lo desconocido la rompería el día
que Anthropic añada un parámetro.

### Códigos de estado

| Situación | Respuesta |
|---|---|
| Cuerpo no JSON, credencial ausente, tipo incompatible | `422` |
| Cuerpo mayor de 4 MB | `413` |
| Error HTTP de Anthropic con JSON | se reenvía tal cual, con su código |
| Error HTTP de Anthropic sin JSON | mismo código, envuelto en `upstream_non_json` |
| Anthropic no responde a tiempo | `504 upstream_timeout` |
| No se puede contactar con Anthropic | `502 upstream_unreachable` |
| Anthropic responde algo no interpretable | `502 upstream_invalid_json` |

Todos los errores usan la forma `{"error": {"type", "message"}}`, que es la que
el cliente sabe leer (`extractErrorMessage` en `App.tsx` y `errorMessage` en
`agent/providerStreamParsers.ts`). Cualquier otra llegaría a la pantalla como un
mensaje vacío. Los mensajes pasan por un redactor que borra claves y trunca
volcados.

### Paginación del catálogo de modelos

`/v1/models` viene paginado. El proxy lo recorre entero, con `limit=100` y un
tope de 20 páginas, y **cualquier lista incompleta viene marcada**:

```json
{ "data": [...], "has_more": false,
  "pagination": { "pages_fetched": 1, "truncated": false, "partial": false, "error": null } }
```

- Falla la **primera** página → el error es la respuesta.
- Falla una **posterior** → `200` con lo acumulado, `partial: true` y el motivo.
  Un desplegable con parte del catálogo y un aviso sirve más que un error total.
- Se agota el tope → `truncated: true`.

Tres cortafuegos impiden un bucle infinito si el upstream dice «hay más» para
siempre: el tope de páginas, un cursor ausente o repetido, y una página que no
aporta ningún modelo nuevo.

La app hace el mismo recorrido en `agent/anthropicModels.ts`, porque en móvil no
hay proxy que agregue nada.

### Streams cortados

Cuando el stream SSE se corta ya se enviaron las cabeceras `200`, así que el
código de estado no puede cambiar. El proxy inyecta el aviso **dentro** del
stream:

```
event: error
data: {"type":"error","error":{"type":"truncated_stream","message":"..."}}
```

`createAnthropicStreamParser` lanza excepción ante un evento cuyo `type` sea
`error`, de modo que un corte llega al usuario como fallo y no como respuesta
buena a medias. Se emite en dos casos: excepción a media lectura
(`upstream_stream_error`) y cierre limpio sin haber visto `message_stop`
(`truncated_stream`).

El proxy busca ese marcador sobre los bytes en crudo, con un solapamiento entre
lecturas para que un `message_stop` partido en la frontera de dos trozos no se
confunda con un corte.

## Variables de entorno

- `ANTHROPIC_PROXY_UPSTREAM_BASE_URL`: sustituye `https://api.anthropic.com`.
  Solo para pruebas contra un Anthropic falso; el arranque lo avisa por consola.
- `ANTHROPIC_PROXY_PORT`: puerto de escucha, `8000` por defecto. Lo usan las
  pruebas E2E para levantar el proxy en un puerto libre, y sirve tambien si
  tienes el 8000 ocupado.
