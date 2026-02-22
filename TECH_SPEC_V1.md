# Gym App V1 - Especificacion Tecnica

## 1) Alcance v1 (cerrado)
- Producto: B2C, beta privada, 2 MAU, gratis.
- Plataformas: web + movil.
- Edad minima: 18+ por autodeclaracion.
- Modulos incluidos en v1:
  - Entrenamiento
  - Dieta
  - Medidas
  - Objetivos
  - Chat IA
  - Generacion de imagen/video para ejercicios
- BYOK (API key del usuario): opcional.
  - Sin API key: tracking disponible, IA deshabilitada.

## 2) Stack tecnico
- Frontend movil: Expo React Native + TypeScript.
- Frontend web: Next.js + TypeScript.
- Backend: FastAPI (Python) + REST.
- Base de datos: Supabase Postgres (region UE).
- Storage: Supabase Storage (region UE).
- Cola async v1: Postgres queue.
- Observabilidad minima:
  - Logs estructurados
  - Boton de reporte de error in-app

## 3) Reglas funcionales clave

### Entrenamiento
- Entidades:
  - `workout_template` (plantilla)
  - `workout_session` (ejecucion historica)
  - `exercise_template`
  - `exercise_session`
  - `set_template`
  - `set_session`
- Durante ejecucion:
  - Se permite editar en vivo.
  - Se guarda snapshot historico de la sesion.
  - Al terminar, opcion de aplicar cambios a futuras sesiones (todo o nada).
- Campos serie obligatorios:
  - `reps` (fijo o rango)
  - `rest_mmss`
  - `weight_kg`
- Herencia de valores por defecto:
  - Si no hay dato nuevo, hereda de la ultima sesion del mismo ejercicio.
- Historico:
  - Sesiones pasadas editables completas (riesgo aceptado: sin auditoria).

### Dieta
- Estructura:
  - dia -> comidas -> platos/recetas -> ingredientes
- Entrada:
  - Manual
  - Estimacion IA por foto (plato, etiqueta, carta)
- Post-estimacion:
  - Guardado automatico permitido.
  - Usuario puede editar macros/calorias.
  - Se muestra porcentaje de confianza.

### Medidas y objetivos
- Objetivo activo unico.
- Medidas con historico (peso, contornos, fotos).

### Chat IA
- Proveedores y fallback:
  - Anthropic -> OpenAI -> Google
- Memoria:
  - Global
  - Separada por dominio (`entreno`, `dieta`, `medidas`)
- Seguridad:
  - Bloquear consejos de dopaje/farmacos.
  - Bloquear ayuno extremo y purgas.
  - Mostrar aviso de seguridad al detectar riesgo.

## 4) Privacidad y seguridad
- Region de datos: UE.
- Fotos:
  - Cifrado en reposo.
  - URLs firmadas temporales.
  - Retencion: 1 anio.
  - Aviso antes de borrado + opcion descarga.
- Cuenta:
  - Borrado autoservicio.
  - Gracia 30 dias.
  - Durante gracia:
    - login permitido para cancelar borrado
    - bloqueadas nuevas subidas y nuevos registros
- API keys BYOK:
  - Guardadas cifradas en servidor.
  - Usuario puede ver/rotar/revocar.

## 5) Offline y sincronizacion
- Offline:
  - movil: SQLite
  - web: IndexedDB
- Sync:
  - inmediata en cambios
  - reintento al abrir app
  - cola en background
- Politica de conflictos:
  - last-write-wins por timestamp de cliente (riesgo aceptado).
- Reintentos:
  - maximo 5 con backoff exponencial.
  - si falla: registro queda en cola + aviso visible.

## 6) SLAs, limites y operacion
- Infra free tier aceptada (sin SLA).
- Timeouts:
  - chat: 300s
  - generacion multimedia: 600s
- Rate limit chat:
  - 10 mensajes/min por usuario.
- Historial chat:
  - retencion 30 dias.
- Backups:
  - export diario
  - retencion 7 dias
  - prueba de restauracion mensual

## 7) Contrato de datos minimo (tablas)
- `users`
- `user_profiles`
- `goals`
- `workout_templates`
- `workout_template_exercises`
- `workout_template_sets`
- `workout_sessions`
- `workout_session_exercises`
- `workout_session_sets`
- `exercise_catalog`
- `exercise_user_custom`
- `diet_days`
- `diet_meals`
- `diet_items`
- `diet_item_estimates`
- `body_measurements`
- `media_assets`
- `chat_threads`
- `chat_messages`
- `agent_memory_entries`
- `sync_operations`
- `api_provider_keys`

## 8) Endpoints REST minimo (v1)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Perfil/objetivos
- `GET /me`
- `PATCH /me`
- `GET /goals/active`
- `PUT /goals/active`

### Entrenamiento
- `GET /workouts/templates`
- `POST /workouts/templates`
- `PATCH /workouts/templates/{id}`
- `DELETE /workouts/templates/{id}`
- `POST /workouts/templates/{id}/clone`
- `POST /workouts/templates/reorder`
- `POST /workouts/templates/{id}/start-session`
- `GET /workouts/sessions`
- `PATCH /workouts/sessions/{id}`
- `POST /workouts/sessions/{id}/finish`
- `POST /workouts/sessions/{id}/apply-template-updates`

### Dieta
- `GET /diet/days/{date}`
- `PUT /diet/days/{date}`
- `POST /diet/items/estimate-from-photo`
- `PATCH /diet/items/{id}`

### Medidas y fotos
- `GET /measurements`
- `POST /measurements`
- `GET /media/presign-upload`
- `POST /media/confirm-upload`

### Chat
- `GET /chat/threads`
- `POST /chat/threads`
- `GET /chat/threads/{id}/messages`
- `POST /chat/threads/{id}/messages`

### BYOK
- `GET /ai-keys`
- `POST /ai-keys`
- `PATCH /ai-keys/{provider}`
- `DELETE /ai-keys/{provider}`
- `POST /ai-keys/test`

### Cuenta/datos
- `POST /account/delete-request`
- `POST /account/delete-cancel`
- `POST /account/export`

## 9) Criterios de salida beta (aceptados)
- % sync exitosas >= 98%
- % sesiones sin crash >= 99%

## 10) Riesgos explicitamente aceptados
- Sin filtro clinico de lesiones/patologias.
- Edicion de historico sin auditoria.
- Conflictos por reloj de cliente manipulable.
- Free tier sin garantia de disponibilidad.
