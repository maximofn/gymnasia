# AGENTS.md - Gymnasia

## Descripcion del proyecto
Gymnasia es una app de gimnasio con dos frontends (`web` y `mobile`), un backend `FastAPI` y base de datos en `Supabase`.

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

## Reglas de trabajo Git (obligatorias)
Despues de **cada cambio**:
1. Revisar si se generaron archivos no trackeables y agregarlos a `.gitignore`.
2. Ejecutar `git add` de los archivos necesarios.
3. Ejecutar `git commit` con mensaje claro.

Reglas adicionales:
- No hacer commits con secretos (`.env`, keys, tokens).
- No eliminar historial ni usar comandos destructivos sin aprobacion explicita.

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

## Criterios de calidad minima
- Sin secretos en git.
- Endpoints con errores HTTP coherentes.
- RLS activado en tablas de usuario.
- Borrado logico donde aplica.
- Cambios reflejados en documentacion de agentes.
