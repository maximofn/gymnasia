# Estado de Implementacion

## Resumen rapido
- Estado global: backend con módulos v1 completos (tracking + chat + media + sync + lifecycle de cuenta).
- Frontend web: integrado con API en módulos núcleo y flujos IA.
- Frontend móvil: app Expo funcional con login + consumo real de API para home/training/diet/medidas/chat/settings.
- Acceso: login requerido fuera de `/auth` en web.

## Completado
- Monorepo inicial (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared`).
- Backend auth + BYOK.
- Backend tracking fase 2:
  - objetivo activo
  - entrenamiento (plantillas/sesiones/series)
  - dieta diaria estructurada
  - medidas
- Alembic `0001` y `0002`.
- Base de frontend alineada a diseno Pencil:
  - tokens compartidos (`packages/shared/src/design-tokens.ts`)
  - tema web (`apps/web/app/theme.css`) y shell responsive (sidebar/tabbar)
  - auth dedicado sin sidebar (`/auth/*`)
- Integracion web funcional:
  - home dashboard:
    - KPIs reales de calorias, peso/delta y racha de entrenos
    - ejercicios de hoy y accesos rapidos
  - auth: login/registro/verificacion/recuperacion
  - settings: estado de sesion + logout + acceso BYOK
  - BYOK: listar/añadir/rotar/test/eliminar claves por proveedor
  - chat: hilos/mensajes, safety básico y memoria editable
  - entrenamiento:
    - listado real de rutinas con crear/clonar/eliminar/reordenar
    - builder por rutina (`/training/[templateId]`)
    - sesion activa (`/session/[sessionId]`) + modal para aplicar cambios a plantilla
    - generación multimedia IA por ejercicio (imagen/video) vía jobs
  - dieta:
    - carga por fecha
    - edicion de comidas/items/macros
    - guardado API + fallback local
    - estimación IA por foto con guardado automático y confianza
  - medidas:
    - alta/listado/borrado
    - resumen rapido de peso y delta
    - fallback local
    - soporte de foto asociada
  - cuenta/privacidad:
    - estado de cuenta
    - solicitud y cancelación de borrado con gracia
    - solicitud/listado de export
  - registro:
    - validación 18+ con `birth_date` en backend y formulario web
  - sync:
    - cola local web + flush automático al recuperar sesión
    - API de sync con política LWW por timestamp cliente
- Integracion móvil funcional:
  - login
  - resumen home
  - training/diet/medidas
  - chat IA básico
  - settings con estado BYOK y logout

## Validacion tecnica ejecutada
- `npm --workspace apps/web run build` OK.
- `npm --workspace apps/web exec tsc --noEmit` OK.
- `npm --workspace apps/mobile exec tsc --noEmit` OK.
- API:
  - import de app FastAPI OK (`routes=72`).
  - smoke test runtime `GET /health` OK con uvicorn.

## Pendiente prioritario
- Hardening de producción:
  - test suite automatizada (unit/integration/e2e)
  - workers reales para jobs asíncronos (en lugar de simulación inline)
  - subida real a storage con URLs firmadas productivas
  - observabilidad y alertas operativas

## Riesgos abiertos
- Sin pipeline de tests en CI.
- Sin soporte humano (decidido para v1 beta).
- Resolucion de conflictos multi-dispositivo sigue en `last-write-wins`.
