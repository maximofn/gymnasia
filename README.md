# Gymnasia

App movil de fitness construida con Expo React Native. Funciona en modo local-first: la app entera funciona sin ningun servicio. El unico backend es opcional y solo sirve para enviar propuestas de mejora y denuncias de respuestas de IA (ver `apps/feedback-worker`).

## Estructura

- `apps/mobile`: App Expo React Native y web (unica aplicacion)
- `apps/feedback-worker`: Worker de Cloudflare que recibe propuestas de mejora, alimentos, ejercicios y denuncias de respuestas de IA desde la app y crea issues en un repositorio privado. Opcional: si esta caido, la app avisa y sigue funcionando
- `apps/anthropic_proxy`: Proxy CORS para Anthropic (solo necesario cuando se ejecuta la app en el navegador del ordenador para depurar; en movil no se usa)
- `alimentos/`: Repositorio de alimentos (JSONs con datos nutricionales)
- `ejercicios/`: Repositorio de ejercicios (JSONs + imagenes generadas)
- `arquitectura-agente/`: Tablero de seguimiento de epicas y tickets (espejo manual de Linear, sitio estatico en Vercel)
- `policy/health-safety/`: Reglas y casos sanitarios versionados que generan la protección del agente
- `policy/signing/`: Raíces y certificados públicos, configuración y bundle firmado actual; nunca contiene claves privadas
- `scripts/health-safety/`: Generador, puerta determinista, fixtures e informes sanitarios
- `scripts/policy-promotion/`: Firma Ed25519, contratos, promoción y preparación de snapshots por canal
- `scripts/store-listing/`: Generación y validación de la ficha y los recursos para Google Play
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

## Backend de incidencias (opcional)

El Worker de `apps/feedback-worker` custodia la credencial de GitHub para que la app no tenga que llevarla. Despliegue, secretos y rotacion en `apps/feedback-worker/README.md`.

```
npm --workspace apps/feedback-worker run test     # suite, sin red ni credenciales
npm --workspace apps/feedback-worker run deploy   # despliegue manual
```

## Tests del agente

La suite determinista del agente usa Vitest y proveedores falsos; no consume
red, claves ni tokens:

```bash
npm test                # unitarios, integración, contrato, regresión y fuzzing
npm run check:health-safety # política, prompt, snapshot y fixtures sanitarios
npm run test:health-safety  # regresiones y propiedades sanitarias sin red
npm run policy:bundle:check # verifica bundle, certificado y firma públicos
npm run check:policy-trust  # verifica la raíz pública integrada en la app
npm run test:agent:e2e  # app web + Playwright + proveedores falsos
npm run test:dev-store  # saneado, esquema, atomicidad y guarda de Git
npm run test:dev-store:e2e # middleware real de Metro sobre localhost
```

Las evals con LLM están separadas de CI y reservadas para LangSmith. Consulta
`docs/testing/agent-testing.md` para la arquitectura, los comandos y la plantilla
de QA manual.

El prompt base de Gymnasia Coach vive en `prompts/AGENTS.md`, pero su bloque
sanitario se genera desde `policy/health-safety/` y no se edita a mano. Después
de cambiar una regla sanitaria hay que regenerar y verificar ambos artefactos:

```bash
npm run sync:health-safety
npm run check:health-safety
```

El flujo remoto, caché e integrado del prompt y del guardrail sanitario se documenta en
`docs/architecture/chat-system-prompt.md`.
Las variantes instalables y la promoción inmutable se documentan en
`docs/architecture/policy-environments.md`.
La app verifica las firmas Ed25519 localmente mediante `@noble/ed25519` y
`@noble/hashes`; GitHub distribuye únicamente artefactos públicos y no custodia claves.

## Front web

La app funciona en navegador con `react-native-web`, mantiene los datos en el
navegador y tiene un shell responsive con navegación lateral en escritorio.
Consulta las decisiones de almacenamiento y capacidades degradadas en
`docs/architecture/web-local-first.md`.

```bash
npm --workspace apps/mobile run web        # preview local
npm --workspace apps/mobile run web:mirror # preview con espejo local opt-in
npm --workspace apps/mobile run build:web  # export estático para Vercel
```

`web:mirror` conserva el estado no sensible en `apps/mobile/.dev-store.json`
entre reinicios de Metro. Solo responde en loopback, no funciona desde la LAN y
nunca escribe claves BYOK ni identificadores de workspace. El preview `web`
normal mantiene el espejo desactivado.

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
- Política remota y fallback del agente: `docs/architecture/chat-system-prompt.md`
- Entornos y promoción de políticas: `docs/architecture/policy-environments.md`
- Política y revisión sanitaria del agente: `docs/architecture/health-safety-policy.md`
- Ficha, declaraciones y capturas para Google Play: `docs/store/google-play/`
- Referencia de diseno: `docs/design/README.md`
- Automatizacion de OpenWiki: `docs/openwiki-automation.md`
