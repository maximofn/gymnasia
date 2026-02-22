# Arquitectura - Stack y Sistemas

## Componentes
- Cliente web: Next.js (`apps/web`).
- Cliente movil: Expo React Native (`apps/mobile`).
- Backend API: FastAPI (`apps/api`).
- Base de datos: Supabase Postgres.
- Almacenamiento de media: Supabase Storage.
- Cola async v1: tabla de jobs en Postgres.

## Estilo de API
- REST JSON.
- Auth con bearer token JWT.
- Endpoints versionados por recursos (no prefijo `/v1` por ahora).

## Dominios de backend
- `auth`: registro/login/verificacion/reseteo.
- `ai-keys`: gestion BYOK.
- `goals`: objetivo activo.
- `workouts`: plantillas/sesiones/series.
- `diet`: dia/comidas/items.
- `measurements`: peso/contornos.

## Estado actual de implementacion
- Implementado en codigo:
  - Auth + BYOK
  - Goals
  - Workouts (fase 2)
  - Diet day CRUD estructural
  - Measurements CRUD
- Planificado pero pendiente:
  - Chat IA y memoria avanzada
  - Estimacion IA por foto
  - Multimedia ejercicio
  - Flujos de cuenta (borrado/export)
