# Decisiones y Riesgos

## Decisiones cerradas
- Stack:
  - Backend FastAPI + REST.
  - Web Next.js.
  - Movil Expo React Native.
  - DB y storage en Supabase UE.
- Sync:
  - `last-write-wins` usando timestamp de cliente.
- Historial de sesiones:
  - Editable.
  - Sin auditoria de cambios en v1.
- Menores:
  - Acceso solo 18+.

## Riesgos aceptados
- Reloj de cliente manipulable puede alterar resolucion de conflictos.
- Edicion de historial sin auditoria puede reescribir progreso historico.
- Free tier puede introducir cortes o limites no predecibles.
- Sin soporte humano para beta.

## Mitigaciones sugeridas (v2)
- Mover conflictos a timestamp de servidor o CRDT/event-sourcing.
- Agregar auditoria de edicion en sesiones y dieta.
- Alertas activas de salud infra y fallback de despliegue.
- Canal minimo de soporte para incidentes criticos.
