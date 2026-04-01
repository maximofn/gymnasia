# Gymnasia

App movil de fitness construida con Expo React Native. Funciona en modo local-first sin dependencias de backend ni base de datos.

## Estructura

- `apps/mobile`: App Expo React Native (unica aplicacion)
- `apps/anthropic_proxy`: Proxy CORS para comunicacion con LLMs de Anthropic
- `alimentos/`: Repositorio de alimentos (JSONs con datos nutricionales)
- `ejercicios/`: Repositorio de ejercicios (JSONs + imagenes generadas)
- `docs/`: Documentacion del proyecto (arquitectura, diseno, specs, roadmap)

## Arranque rapido

1. Instala dependencias:
   ```
   npm install
   ```
2. Levanta el proxy de Anthropic (para funciones de IA):
   ```
   cd apps/anthropic_proxy && uv venv .venv && source .venv/bin/activate && uv pip install fastapi uvicorn httpx anthropic
   source apps/anthropic_proxy/.venv/bin/activate && python apps/anthropic_proxy/cors-proxy.py
   ```
3. Levanta la app movil:
   ```
   npm run dev:mobile
   ```
4. Type-check:
   ```
   npm --workspace apps/mobile exec tsc --noEmit
   ```

## Documentacion

- Instrucciones para agentes IA: `AGENTS.md`
- Documentacion central: `docs/README.md`
- Referencia de diseno: `docs/design/README.md`
