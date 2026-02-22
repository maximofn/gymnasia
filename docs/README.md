# Documentacion del Proyecto - Gimnasia

Este directorio centraliza toda la documentacion funcional y tecnica del proyecto.

## Indice
- `docs/specs/README.md`: indice de especificaciones formales.
- `docs/specs/v1-product-spec.md`: especificacion funcional de producto.
- `docs/specs/v1-technical-spec.md`: especificacion tecnica de arquitectura.
- `docs/specs/v1-api-spec.md`: especificacion de API REST.
- `docs/specs/v1-data-spec.md`: especificacion de modelo de datos.
- `docs/specs/v1-non-functional-spec.md`: especificacion no funcional.
- `docs/specs/functional/README.md`: indice de specs funcionales por modulo.
- `docs/specs/functional/training-functional-spec.md`: spec funcional de entrenamiento.
- `docs/specs/functional/diet-functional-spec.md`: spec funcional de dieta.
- `docs/specs/functional/measurements-functional-spec.md`: spec funcional de medidas.
- `docs/specs/functional/goals-and-ai-functional-spec.md`: spec funcional de objetivos y BYOK.
- `docs/product/overview.md`: vision del producto y alcance de v1.
- `docs/product/requirements-v1.md`: requisitos funcionales y no funcionales cerrados.
- `docs/product/decisions-and-risks.md`: decisiones clave y riesgos aceptados.
- `docs/architecture/stack-and-systems.md`: arquitectura general y componentes.
- `docs/architecture/offline-and-sync.md`: estrategia offline y sincronizacion.
- `docs/architecture/security-and-privacy.md`: privacidad, seguridad y ciclo de vida de datos.
- `docs/design/README.md`: referencias de diseno Pencil para frontend.
- `docs/design/frontend-implementation-guide.md`: guia de implementacion de frontend basada en capturas.
- `docs/design/qa-checklist.md`: checklist de QA visual por pantalla.
- `docs/backend/setup-and-run.md`: instalacion y arranque de backend.
- `docs/backend/api-reference.md`: referencia de endpoints REST.
- `docs/backend/data-model.md`: modelo de datos implementado y objetivo.
- `docs/backend/migrations.md`: estrategia y estado de migraciones.
- `docs/roadmap/backlog-v1.md`: plan por fases (producto/tecnico).
- `docs/roadmap/implementation-status.md`: estado real de implementacion.
- `docs/reference/TECH_SPEC_V1.md`: especificacion tecnica original.
- `docs/reference/BACKLOG_V1.md`: backlog original.
- `docs/reference/DATABASE_SCHEMA_V1.sql`: esquema SQL objetivo completo.
- `docs/reference/ROOT_README.md`: README raiz del monorepo.
- `docs/reference/API_README.md`: README del backend API.

## Convenciones
- Estado de funcionalidades:
  - `Implementado`: existe en codigo backend actual.
  - `Planificado`: decidido para v1 pero aun no implementado.
- Fuente de verdad:
  - Backend implementado: `apps/api/*`
  - Migraciones: `apps/api/alembic/versions/*`
  - Esquema objetivo extendido: `docs/reference/DATABASE_SCHEMA_V1.sql`
