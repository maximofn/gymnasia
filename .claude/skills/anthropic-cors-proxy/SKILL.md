---
name: anthropic-cors-proxy
description: Levantar, parar y gestionar el proxy CORS local para usar modelos de Anthropic desde el navegador. Usa esta skill cuando el usuario quiera probar el chat con Anthropic en web, arrancar o parar el proxy CORS, solucionar errores de CORS con Anthropic, verificar que el proxy funciona, o cuando vea errores como "Failed to fetch" o "CORS" al usar Anthropic en el browser. Tambien cuando mencione "proxy anthropic", "cors anthropic", "levantar proxy", "parar proxy", "stop proxy", "anthropic en web" o "proxy local".
---

# Anthropic CORS Proxy

Proxy local ligero que permite usar la API de Anthropic desde el navegador, esquivando las restricciones CORS del browser.

## Por que es necesario

El navegador bloquea las llamadas directas a `api.anthropic.com` por politica CORS. OpenAI y Google funcionan directamente desde el browser, pero Anthropic no. Este proxy se interpone entre la app web y la API de Anthropic, reenviando las peticiones desde localhost.

## Arquitectura

```
Browser (localhost:8081)  -->  Proxy (localhost:8000)  -->  api.anthropic.com
     apps/mobile                 cors-proxy.py                Anthropic API
```

## Ficheros

- **Implementacion real**: `apps/anthropic_proxy/cors-proxy.py`
- **Symlink de conveniencia**: `apps/mobile/cors-proxy.py` → `../anthropic_proxy/cors-proxy.py`
- **Virtualenv**: `apps/anthropic_proxy/.venv/`

## Setup (solo la primera vez)

Si el virtualenv no existe:

```bash
cd apps/anthropic_proxy && uv venv .venv && .venv/bin/pip install fastapi uvicorn
```

## Arrancar el proxy

```bash
apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py
```

Arranca en `http://127.0.0.1:8000`. Este es el valor por defecto de `EXPO_PUBLIC_API_BASE_URL` en la app.

## Parar el proxy

```bash
lsof -ti:8000 | xargs kill -9
```

O simplemente `Ctrl+C` en la terminal donde se lanzo.

## Verificar que funciona

```bash
curl -sS http://127.0.0.1:8000/health
```

Debe devolver `{"ok": true}`.

## Endpoints disponibles

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/health` | GET | Health check basico |
| `/chat/providers/anthropic/verify` | POST | Verificar API key. Body: `{"api_key": "sk-...", "model": "claude-..."}` |
| `/chat/providers/anthropic/messages` | POST | Chat con streaming SSE. Body: payload de Anthropic + `"api_key"` extra |
| `/chat/providers/anthropic/models` | POST | Listar modelos disponibles. Body: `{"api_key": "sk-..."}` |

Todos los endpoints aceptan `api_key` en el body del request, no en headers. El proxy lo extrae y lo reenvía a Anthropic como `x-api-key`.

## Streaming SSE

El endpoint `/messages` soporta streaming cuando el body incluye `"stream": true`. El proxy reenvía los chunks SSE de Anthropic sin buffering, asi el chat en el navegador muestra los tokens de razonamiento y respuesta en tiempo real.

## Version de la API

El proxy usa `anthropic-version: 2023-06-01` (la version estable documentada). Si se cambia a una version no soportada, Anthropic rechaza la peticion con error de version invalida.

## Problemas frecuentes

| Problema | Causa | Solucion |
|----------|-------|----------|
| `Failed to fetch` en el browser | Proxy no arrancado | Arrancar el proxy (ver arriba) |
| `ModuleNotFoundError: fastapi` | Virtualenv no creado o incompleto | Ejecutar el setup (ver arriba) |
| `Error grave: anthropic-version` | Version de API incorrecta | Verificar que `ANTHROPIC_API_VERSION = "2023-06-01"` en `cors-proxy.py` |
| Puerto 8000 ocupado | Otra instancia del proxy o servicio | `lsof -ti:8000 \| xargs kill -9` y reiniciar |
| `Connection refused` en health check | Proxy no esta corriendo | Arrancar el proxy |
| Anthropic funciona en Expo Go pero no en web | En nativo no hay CORS | Normal — el proxy solo es necesario para web |

## Otros proveedores

- **OpenAI**: funciona directamente desde el browser, no necesita proxy.
- **Google**: funciona directamente desde el browser, no necesita proxy.

Solo Anthropic requiere el proxy CORS para testing en web.
