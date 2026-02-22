# Arquitectura - Offline y Sync

## Decisiones de producto/tecnicas
- Offline movil: SQLite.
- Offline web: IndexedDB.
- Estrategia de sync:
  - Push inmediato al cambiar.
  - Reintento al abrir app.
  - Cola en background.
- Reintentos: max 5 con backoff exponencial.
- Si falla tras reintentos: mantener en cola y avisar al usuario.

## Resolucion de conflictos
- Politica v1: `last-write-wins` por timestamp de cliente.

## Implicaciones
- Ventaja:
  - Implementacion simple y rapida para MVP.
- Riesgos:
  - Manipulacion de hora de dispositivo.
  - Inconsistencias en escenarios multi-dispositivo.

## Recomendacion tecnica para evolucion
- v2:
  - Timestamp servidor + vector clock simplificado por entidad.
  - Registro de conflictos visibles para usuario en casos criticos.
