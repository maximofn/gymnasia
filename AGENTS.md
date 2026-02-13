# AGENTS.md - Gymnasia

## Descripcion del proyecto
Gymnasia es una app de gimnasio con dos frontends (`web` y `mobile`), un backend `FastAPI` y base de datos en `Supabase`.

## Roles de trabajo
- Usuario: PM (prioriza producto y valida entregables).
- Agente (yo): Desarrollador (implementa cambios end-to-end y mantiene la base tecnica).
- Alcance operativo del desarrollador: tambien ejecuta tareas de infraestructura (DB/CLI/migraciones), incluidas operaciones marcadas como potencialmente destructivas en la UI, usando terminal y control de cambios.

### Secciones funcionales
- Entrenamiento
- Dieta
- Medidas
- Chat con agente por seccion (backend unificado)

### Objetivo del producto
Guardar datos de entrenamiento, nutricion y medidas para analisis por LLM, con chat contextual por seccion y flujos multimodales (texto, audio, imagen/video).

## Arquitectura acordada
- Front web: `Next.js`
- Front mobile: `Expo React Native`
- Backend: `FastAPI`
- Base de datos: `Supabase Postgres/Auth/Storage`
- Seguridad base: Auth email/password + verificacion email + RLS por usuario
- Retencion inicial de datos: `6 meses`

## Decisiones de producto cerradas
- Usuario unico (sin roles extra de momento)
- Auth inicial simple: email + password
- Sin MFA por ahora
- Chat por seccion en front, mismo agente en backend
- Conversacion libre (sin comandos ni tareas prefijadas)
- Audio al chat (flujo de transcripcion)
- Entrenamiento con plantilla + sesion realizada
- Al finalizar sesion: opcion para actualizar plantilla o guardar solo ese dia
- Versionado de plantilla
- Borrado logico
- PRs automaticos
- Dieta con registro diario
- Escalado de recetas por raciones
- Base de alimentos manual al inicio
- Sin scanner de codigo de barras por ahora
- Medidas corporales y fotos de progreso
- Event logging y auditoria basica

## Plan de ejecucion (end-to-end)
1. Monorepo con `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`, `infra/supabase`.
2. Modelo de datos completo y SQL de Supabase con RLS.
3. API FastAPI por dominios: training, diet, measures, chat, media, auth.
4. Front web con secciones y acciones principales conectadas a API.
5. Front mobile con secciones equivalentes conectadas a API.
6. Integracion base de agente (LangGraph hook) y media AI hooks.
7. Documentacion viva para agentes (`AGENTS.md`, `CLAUDE.md`, `SOUL.md`).

## Alcance implementado en este repo
- Backend con endpoints para:
  - Entrenamiento: CRUD, clonado, reordenado, sesiones, cierre con update plantilla, PRs.
  - Dieta: CRUD alimentos/recetas/dieta diaria/comidas/entradas + resumen de macros.
  - Medidas: CRUD medidas + fotos de progreso (metadatos).
  - Chat: hilos por seccion, mensajes, audio->texto base.
  - Media: assets y solicitudes de generacion (`google_nano_banana`, `veo3`).
- SQL en `infra/supabase/schema.sql`:
  - tablas, indices, triggers `updated_at`, RLS por `auth.uid()`, funcion de retencion 6 meses.
- Front web:
  - paginas para Entrenamiento, Dieta, Medidas y Chat.
- Front mobile:
  - app Expo con tabs para Entreno, Dieta, Medidas y Chat.

## Lo que se deja para mas adelante
- Offline mode mobile.
- Push notifications.
- Integraciones wearables/basculas.
- Base de alimentos externa (USDA/BEDCA u otras).
- Escaneo de codigo de barras.
- Superseries/dropsets/circuitos/calendarios por bloque avanzados.
- Seguridad avanzada (MFA, cifrado extra, politica de consentimientos detallada).
- Moderacion de contenido generado.
- Observabilidad (Sentry/metrics) y despliegue productivo.
- SLA formal de tiempos de generacion.

## Integraciones IA
- LLM providers planificados: OpenAI, Anthropic, Google.
- Orquestacion: LangGraph (hook ya preparado en backend).
- Transcripcion audio: Whisper (hook preparado).
- Imagen maquina: Google Nano Banana (hook preparado).
- Video: Veo3 cuando exista acceso/API.

## Arranque local
- Comando unico recomendado: `make dev`
- Script directo: `./scripts/dev-all.sh`
- El script levanta API + Web + Mobile en paralelo y hace parada limpia con `Ctrl+C`.
- Dependencias API gestionadas con `uv` (`uv sync --project apps/api`).

## Reglas de trabajo Git (obligatorias)
Despues de **cada cambio**:
1. Revisar si se generaron archivos no trackeables y agregarlos a `.gitignore`.
2. Ejecutar `git add` de los archivos necesarios.
3. Ejecutar `git commit` con mensaje claro.

Reglas adicionales:
- No hacer commits con secretos (`.env`, keys, tokens).
- No eliminar historial ni usar comandos destructivos sin aprobacion explicita.
- El desarrollador ejecuta el flujo de Git de forma autonoma y no pide confirmacion al PM para operaciones rutinarias (`git add`/`git commit`/estado).
- El PM no tiene que ejecutar pasos tecnicos de Git/DB para avanzar el desarrollo; los ejecuta el desarrollador.

## Memoria operativa (lecciones y resoluciones)
Cuando se detecte un problema y se resuelva, registrar aqui:
- Fecha
- Problema
- Causa
- Solucion aplicada
- Impacto en arquitectura/proceso

Si la solucion es reutilizable, crear una skill local o actualizar una existente.

### Entradas actuales
- 2026-02-11
  - Problema: necesidad de rerun seguro del SQL de Supabase.
  - Causa: triggers `updated_at` sin `drop trigger if exists` podian fallar al reaplicar.
  - Solucion: agregar `drop trigger if exists` antes de recrear triggers.
  - Impacto: migraciones idempotentes en entorno local/repetible.
- 2026-02-11
  - Problema: arranque manual de 3 servicios en local era repetitivo y propenso a dejar procesos colgados.
  - Causa: ejecucion separada de API, web y mobile en terminales distintas sin gestion centralizada.
  - Solucion: crear `scripts/dev-all.sh` y target `make dev` con arranque paralelo, prefijo de logs y limpieza en `Ctrl+C`.
  - Impacto: bootstrap local consistente y mas rapido para iteracion diaria.
- 2026-02-12
  - Problema: `make dev` fallaba en API con `ModuleNotFoundError: fastapi`.
  - Causa: el script usaba `uvicorn` global sin entorno Python de proyecto.
  - Solucion: migrar arranque API a `uv run --project apps/api --no-sync ...` y auto-setup con `uv sync --project apps/api` si faltan paquetes.
  - Impacto: arranque local mas robusto y reproducible en maquinas nuevas.
- 2026-02-12
  - Problema: ambiguedad de responsabilidades entre direccion de producto y ejecucion tecnica.
  - Causa: no estaba explicitado en docs que el usuario actua como PM y el agente como desarrollador.
  - Solucion: documentar roles en `AGENTS.md` y `CLAUDE.md`, y fijar politica de Git autonoma del desarrollador para operaciones rutinarias.
  - Impacto: menos friccion operativa y mayor velocidad de entrega.
- 2026-02-12
  - Problema: la API no arrancaba con SQLAlchemy (`InvalidRequestError: Attribute name 'metadata' is reserved`).
  - Causa: en modelos ORM se usaba el atributo `metadata`, reservado por la Declarative API.
  - Solucion: renombrar atributo Python a `meta` y mantener el nombre de columna SQL como `metadata`.
  - Impacto: arranque estable de FastAPI sin romper compatibilidad con el esquema SQL existente.
- 2026-02-12
  - Problema: ejecuciones previas dejaron puertos ocupados (8000/3000/8081), causando fallos de arranque y prompts interactivos.
  - Causa: procesos antiguos de `make dev` quedaron vivos tras interrupciones.
  - Solucion: limpiar procesos colgados antes de reintentar y validar puertos en escucha tras el arranque.
  - Impacto: flujo de validacion local reproducible y sin bloqueos por conflictos de puerto.
- 2026-02-12
  - Problema: riesgo de error FK en escritura al usar UUID fijo de desarrollo en frontend.
  - Causa: `x-user-id` hardcodeado podia no existir en `auth.users` de Supabase.
  - Solucion: mover UUID de desarrollo a variables de entorno (`NEXT_PUBLIC_DEV_USER_ID` y `EXPO_PUBLIC_DEV_USER_ID`) y alinear con `DEFAULT_DEV_USER_ID` del backend.
  - Impacto: pruebas locales coherentes con un usuario real de Supabase sin tocar codigo.
- 2026-02-13
  - Problema: `psql` no podia aplicar `infra/supabase/schema.sql` al host remoto de Supabase.
  - Causa: fallo de resolucion DNS para `db.<project-ref>.supabase.co` desde este entorno de terminal.
  - Solucion: ejecutar el schema desde el SQL Editor de Supabase (Playwright) y confirmar el modal de `Query has destructive operation`.
  - Impacto: migracion aplicada sin bloquear el flujo por conectividad de red local.
- 2026-02-13
  - Problema: no se disponia de password real para construir `DATABASE_URL` (aparecia `[YOUR-PASSWORD]` en Connect).
  - Causa: Supabase enmascara la password y exige reset para obtener un valor utilizable.
  - Solucion: resetear password en `Database > Settings`, actualizar `DATABASE_URL` local y conservar secretos solo en `.env` no trackeado.
  - Impacto: configuracion local completa para que API y migraciones puedan autenticarse contra Supabase.

## Criterios de calidad minima
- Sin secretos en git.
- Endpoints con errores HTTP coherentes.
- RLS activado en tablas de usuario.
- Borrado logico donde aplica.
- Cambios reflejados en documentacion de agentes.
