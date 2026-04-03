---
name: local-web-debug
description: Levantar, parar y depurar la app mobile en local en el navegador. Usa esta skill siempre que el usuario quiera arrancar o parar el servidor de desarrollo web, verificar la app en el browser, depurar problemas de la UI en web, lanzar el proxy de Anthropic para CORS, o comprobar que la app funciona en localhost. Tambien cuando mencione "preview", "vista previa", "levantar la app", "levantar la app para probar en local", "parar la app", "stop app", "probar en navegador", "debug web", "arrancar servidor", "parar servidor", "cors proxy" o "depurar en local".
---

# Local Web Debug

Levanta `apps/mobile` en modo web para depurar en el navegador y, opcionalmente, el proxy CORS de Anthropic.

## Dependencias web (SDK 54)

Si faltan, instalar con:

```bash
npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime
```

## Arrancar el servidor web

Hay dos formas equivalentes:

### 1. Desde la Vista previa de Claude Code

El fichero `.claude/launch.json` ya tiene la config `"mobile"` que ejecuta:

```bash
bash -c "source ~/.nvm/nvm.sh && npm --workspace apps/mobile run start"
```

en el puerto **8081**. Basta con pulsar el boton de play en "Vista previa > mobile".

Usa `preview_start` con `name: "mobile"` para arrancarlo programaticamente.

### 2. Desde terminal

```bash
npm --workspace apps/mobile run web
```

Esto arranca Metro en modo web en `http://localhost:8081`.

## Verificar que la app compila

Sin levantar servidor (util en entornos sin puertos):

```bash
cd apps/mobile && npx expo export --platform web --dev
```

## Proxy CORS para Anthropic (obligatorio en desarrollo local)

Al desarrollar en local con el navegador, es necesario levantar el proxy CORS para que el chat con Anthropic funcione. Sin el proxy, las llamadas a `api.anthropic.com` fallan por CORS.

Toda la informacion de como arrancar, configurar y depurar el proxy esta en la skill `.claude/skills/anthropic-cors-proxy/SKILL.md`. Consultala siempre que necesites levantar o solucionar problemas con el proxy.

En resumen rapido:

```bash
# Setup (solo la primera vez)
cd apps/anthropic_proxy && uv venv .venv && .venv/bin/pip install fastapi uvicorn

# Arrancar
apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py

# Verificar
curl -sS http://127.0.0.1:8000/health
```

OpenAI y Google funcionan directamente sin proxy.

## Parar la app y el proxy

### Parar el servidor web

```bash
lsof -ti:8081 | xargs kill -9
```

O `Ctrl+C` en la terminal donde se lanzo. Si se arranco con `preview_start`, usar `preview_stop`.

### Parar el proxy CORS

Ver `.claude/skills/anthropic-cors-proxy/SKILL.md` para instrucciones de como parar el proxy.

## Flujo completo de depuracion

1. **Arrancar servidor web** — `preview_start` o `npm --workspace apps/mobile run web`
2. **Arrancar proxy CORS** — ver `.claude/skills/anthropic-cors-proxy/SKILL.md`
3. **Abrir** `http://localhost:8081` en el navegador
4. **Verificar** con `preview_snapshot`, `preview_console_logs`, `preview_screenshot`
5. **Iterar** — editar codigo, Metro recarga por HMR automaticamente
6. **Parar** — ver seccion "Parar la app y el proxy" arriba

## Validacion rapida sin servidor

Para comprobar que el bundle web compila sin errores:

```bash
cd apps/mobile && npx expo export --platform web --dev --output-dir /tmp/gymnasia-web-check
```

## Type-check

```bash
npm --workspace apps/mobile exec tsc --noEmit
```

## Problemas frecuentes

| Problema | Causa | Solucion |
|----------|-------|----------|
| `Module not found: react-dom` | Dependencias web no instaladas | `npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime` |
| CORS error en Anthropic | Navegador bloquea llamadas directas | Levantar el proxy CORS (ver arriba) |
| Puerto 8081 ocupado | Otro proceso Metro corriendo | `lsof -ti:8081 \| xargs kill -9` y reiniciar |
| SecureStore no disponible en web | Limitacion del navegador | Las API keys se guardan en AsyncStorage como fallback (con aviso en la UI) |
| `Failed to download remote update` | Esto es Expo Go, no web | Para web usar `npm run web`, para movil ver la skill de Expo Go |

## Notas importantes

- **No hay backend**: la app es 100% local-first. El unico "backend" es el proxy CORS para Anthropic en web.
- **HMR activo**: los cambios en codigo se reflejan automaticamente sin recargar la pagina.
- **El proxy es un symlink**: `apps/mobile/cors-proxy.py` apunta a `apps/anthropic_proxy/cors-proxy.py`.
