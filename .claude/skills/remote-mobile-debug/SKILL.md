---
name: remote-mobile-debug
description: Depurar la app en un movil fisico desde otra red/LAN usando ngrok tunnel. Usa esta skill cuando el usuario quiera probar la app en el movil desde otra red, depurar en remoto, conectar Expo Go desde fuera de la LAN, o cuando mencione "movil en otra LAN", "tunnel", "ngrok", "depurar desde el movil", "probar en el movil", "expo go remoto", "otra red", "fuera de casa", "desde el movil" o "debug remoto".
---

# Remote Mobile Debug (otra LAN via ngrok)

Levanta `apps/mobile` con un tunnel ngrok para depurar en un movil fisico que esta en otra red (4G, otra WiFi, etc.) usando Expo Go.

## Requisitos

- `ngrok` instalado y autenticado (`ngrok config check`)
- Expo Go instalado en el movil (SDK 54)

## Levantar todo

Ejecutar estos 3 pasos en orden:

### 1. Arrancar ngrok

```bash
ngrok http 8081 --request-header-add "ngrok-skip-browser-warning: true" --log stdout &
```

Esperar a que aparezca la linea `started tunnel ... url=https://XXXX.ngrok-free.app`.

### 2. Obtener la URL publica

```bash
curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])"
```

Guardar la URL (ej: `https://f325-2a09-bac5-3128-245a-00-39f-b9.ngrok-free.app`).

### 3. Arrancar Metro con la URL de ngrok

```bash
EXPO_PACKAGER_PROXY_URL=<URL_DE_NGROK> npm --workspace apps/mobile run start -- --clear
```

Ejemplo:
```bash
EXPO_PACKAGER_PROXY_URL=https://f325-2a09-bac5-3128-245a-00-39f-b9.ngrok-free.app npm --workspace apps/mobile run start -- --clear
```

Esperar a `Waiting on http://localhost:8081`.

### 4. Conectar desde Expo Go

En el movil, abrir Expo Go > "Enter URL manually" y pegar:

```
exp://<NGROK_HOST>
```

Ejemplo: `exp://f325-2a09-bac5-3128-245a-00-39f-b9.ngrok-free.app`

**Sin puerto** — ngrok ya redirige al 8081 local.

## Parar todo

```bash
# Parar ngrok
pkill -f "ngrok http"

# Parar Metro
lsof -ti:8081 | xargs kill -9
```

## Por que NO usar `expo start --tunnel`

Expo usa `@expo/ngrok` internamente, que puede fallar con `remote gone away` incluso cuando el `ngrok` del sistema funciona bien. El workaround manual con `EXPO_PACKAGER_PROXY_URL` es mas fiable.

## Por que hace falta cada flag

| Flag / Variable | Razon |
|----------------|-------|
| `EXPO_PACKAGER_PROXY_URL` | Sin ella, Metro dice a Expo Go que busque el bundle en `localhost:8081`. Expo Go anade `:8081` a la URL de ngrok y falla con "Packager is not running" |
| `--request-header-add "ngrok-skip-browser-warning: true"` | Sin ella, ngrok free muestra una pagina HTML de confirmacion que Expo Go no puede manejar y se queda colgado en el splash |
| `--clear` | Limpia cache de Metro para evitar bundles obsoletos |

## Problemas frecuentes

| Problema | Causa | Solucion |
|----------|-------|----------|
| Splash se queda en "downloading..." sin avanzar | Pagina interstitial de ngrok free | Verificar que ngrok se lanzo con `--request-header-add "ngrok-skip-browser-warning: true"` |
| "Packager is not running at https://...ngrok-free.app:8081" | Metro no sabe que esta detras de ngrok | Verificar que Metro se lanzo con `EXPO_PACKAGER_PROXY_URL=<url>` |
| `remote gone away` con `expo start --tunnel` | `@expo/ngrok` de Expo falla | Usar el metodo manual de esta skill en vez de `--tunnel` |
| ngrok no arranca | Puerto 4040 u 8081 ocupados | `lsof -ti:4040 \| xargs kill -9` y/o `lsof -ti:8081 \| xargs kill -9` |
| Expo Go no conecta | URL mal formada o Expo Go cacheado | Forzar cierre de Expo Go, reabrir y pegar `exp://<host>` sin puerto ni protocolo https |

## Verificacion rapida

Desde cualquier maquina con internet, comprobar que el tunnel responde:

```bash
curl -sS -o /dev/null -w "%{http_code}" <URL_DE_NGROK>
```

Debe devolver `200`.
