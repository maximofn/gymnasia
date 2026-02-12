# CLAUDE.md

## Contexto rapido
Proyecto: Gymnasia

## Roles de trabajo
- Usuario: PM.
- Agente (yo): Desarrollador.

Stack:
- Web: Next.js
- Mobile: Expo React Native
- API: FastAPI
- DB/Auth/Storage: Supabase

## Prioridades tecnicas
1. Mantener consistencia de contratos API entre web/mobile.
2. Respetar seguridad base: Auth + RLS por usuario.
3. Guardar trazabilidad para analitica de agente (event logging).
4. Mantener retencion inicial de 6 meses.

## Convenciones
- Borrado logico por `deleted_at` cuando aplique.
- `created_at` + `updated_at` en entidades persistentes.
- Endpoints por dominio (`training`, `diet`, `measures`, `chat`, `media`).
- Git operativo a cargo del desarrollador: trackeo continuo y commits sin pedir confirmacion para operaciones rutinarias.

## IA
- Chat por seccion en frontend, backend compartido.
- Hook de LangGraph en backend para orquestacion futura.
- Audio con flujo Whisper.
- Imagen/video por agente segun conversacion.
