# Gymnasia

App movil de fitness construida con Expo React Native. Funciona en modo local-first sin dependencias de backend ni base de datos.

## Estructura

- `apps/mobile`: App Expo React Native y web (unica aplicacion)
- `apps/anthropic_proxy`: Proxy CORS para Anthropic (solo necesario cuando se ejecuta la app en el navegador del ordenador para depurar; en movil no se usa)
- `alimentos/`: Repositorio de alimentos (JSONs con datos nutricionales)
- `ejercicios/`: Repositorio de ejercicios (JSONs + imagenes generadas)
- `arquitectura-agente/`: Tablero de seguimiento de epicas y tickets (espejo manual de Linear, sitio estatico en Vercel)
- `docs/`: Documentacion del proyecto (arquitectura, diseno, specs, roadmap)

## Arranque rapido

1. Instala dependencias:
   ```
   npm install
   ```
2. (Solo para depurar en navegador) Levanta el proxy CORS de Anthropic:
   ```
   cd apps/anthropic_proxy && uv venv .venv && .venv/bin/pip install fastapi uvicorn
   apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py
   ```
   En movil (Expo Go / APK) no es necesario — OpenAI, Google y Anthropic funcionan directamente.
3. Levanta la app movil:
   ```
   npm run dev:mobile
   ```
4. Type-check:
   ```
   npm --workspace apps/mobile exec tsc --noEmit
   ```

## Tests del agente

La suite determinista del agente usa Vitest y proveedores falsos; no consume
red, claves ni tokens:

```bash
npm test
```

Las evals con LLM están separadas de CI y reservadas para LangSmith. Consulta
`docs/testing/agent-testing.md` para la arquitectura, los comandos y la plantilla
de QA manual.

## Front web

La app funciona en navegador con `react-native-web`, mantiene los datos en el
navegador y tiene un shell responsive con navegación lateral en escritorio.
Consulta las decisiones de almacenamiento y capacidades degradadas en
`docs/architecture/web-local-first.md`.

```bash
npm --workspace apps/mobile run web        # preview local
npm --workspace apps/mobile run build:web  # export estático para Vercel
```

## Tablero de seguimiento

Espejo manual de los tickets de Linear en `arquitectura-agente/` (sitio estatico,
sin backend). Los datos viven en `arquitectura-agente/data/board.json` y se
actualizan a mano. Ver `arquitectura-agente/README.md`.

```
npm run test:board       # valida el JSON del tablero
npm run test:board:e2e   # E2E con Playwright
```

## Documentacion

- Instrucciones para agentes IA: `AGENTS.md`
- Documentacion central: `docs/README.md`
- Referencia de diseno: `docs/design/README.md`
