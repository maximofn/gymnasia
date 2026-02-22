# V1 Technical Spec

## 1. Stack
- Web: Next.js + TypeScript.
- Movil: Expo React Native + TypeScript.
- Backend: FastAPI + SQLAlchemy + Alembic.
- DB: Supabase Postgres (UE).
- Storage: Supabase Storage (UE).

## 2. Estilo de servicio
- REST JSON.
- JWT bearer para autenticacion.
- Migraciones con Alembic.

## 3. Dominios de backend
- Auth
- BYOK
- Goals
- Workouts
- Diet
- Measurements
- (Planificado) Chat, media IA, cuenta/data lifecycle.

## 4. Estrategia de consistencia
- Estado online principal en Postgres.
- (Planificado) soporte offline:
  - movil SQLite
  - web IndexedDB
- (Planificado) sync con `last-write-wins` por timestamp cliente.

## 5. Seguridad tecnica
- API keys cifradas en backend.
- Separacion de secretos en variables de entorno.
- Recomendado para despliegue:
  - desactivar `AUTO_CREATE_TABLES` y usar solo migraciones.

## 6. Estado actual
- Implementado:
  - Fase 1 y Fase 2 backend.
  - Endpoints de Fase 3-6 (sync, chat/memoria, media IA y lifecycle de cuenta).
  - Frontend web conectado en módulos núcleo + IA + lifecycle.
  - Frontend móvil conectado en flujo principal con login y consumo API.
- Pendiente:
  - Hardening operativo (tests, workers reales, despliegue y observabilidad).
