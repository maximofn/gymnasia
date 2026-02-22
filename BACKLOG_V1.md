# Gym App V1 - Backlog Ejecutable

## Fase 0 - Base de proyecto
1. Inicializar monorepo:
   - `apps/mobile` (Expo)
   - `apps/web` (Next.js)
   - `apps/api` (FastAPI)
   - `packages/shared` (tipos/validaciones)
2. Configurar CI minima:
   - lint + test + build en PR.
3. Configurar Supabase proyecto UE:
   - Postgres
   - Storage
4. Configurar secretos y entornos:
   - dev/staging/prod
   - cifrado para BYOK.

## Fase 1 - Fundacion backend
1. Crear esquema SQL inicial para:
   - usuarios/perfil
   - objetivos
   - entrenamiento (templates + sessions)
   - dieta
   - medidas
   - media
   - chat
   - memoria agente
   - sync queue
2. Implementar migraciones versionadas.
3. Implementar auth:
   - register/login
   - verify email
   - reset password
4. Implementar modulo BYOK:
   - CRUD keys
   - cifrado en reposo
   - endpoint test provider.

## Fase 2 - Tracking sin IA (nucleo producto)
1. Entrenamiento:
   - CRUD plantillas
   - clonar/reordenar/borrar
   - iniciar sesion desde plantilla
   - guardar snapshot sesion
   - finish + aplicar cambios a futuras sesiones (todo o nada)
2. Dieta:
   - CRUD dia/comida/item
   - macros por 100g y por racion
3. Medidas:
   - registro de peso y contornos
4. Objetivo unico activo:
   - alta/edicion
5. UI estado sin IA:
   - chat bloqueado con CTA para conectar API key.

## Fase 3 - Offline y sync
1. Almacenamiento local:
   - movil SQLite
   - web IndexedDB
2. Cola local de operaciones pendientes.
3. Sync engine:
   - push inmediato
   - retry al abrir app
   - 5 reintentos backoff
   - aviso en fallos persistentes
4. Resolucion de conflictos:
   - last-write-wins por timestamp cliente.
5. Telemetria de sync para KPI beta.

## Fase 4 - IA chat + memoria
1. Integrar proveedores:
   - Anthropic primario
   - fallback OpenAI
   - fallback Google
2. Chat:
   - threads + mensajes
   - timeout 300s
   - rate limit 10/min
3. Memoria agente:
   - global
   - por dominio (`entreno`, `dieta`, `medidas`)
   - user controls: ver/editar/borrar memoria
4. Safety layer:
   - bloqueo dopaje/farmacos/ayuno extremo/purgas
   - aviso medico contextual.

## Fase 5 - IA dieta por foto + multimedia ejercicio
1. Subida de fotos:
   - presigned upload
   - confirmacion backend
2. Estimacion de dieta por foto:
   - plato/etiqueta/carta
   - guardado automatico
   - mostrar confianza
   - edicion manual posterior
3. Generacion multimedia ejercicio:
   - pipeline async
   - timeout 600s
   - cola Postgres
   - estado de job en UI.

## Fase 6 - Privacidad, seguridad y ciclo de vida
1. Borrado cuenta autoservicio:
   - solicitar borrado
   - gracia 30 dias
   - cancelar borrado durante gracia
   - bloquear nuevas subidas/registros durante gracia
2. Fotos:
   - cifrado en reposo
   - URLs firmadas temporales
   - retencion 1 anio + aviso previo + descarga
3. Logs:
   - redaccion de PII y secretos.

## Fase 7 - Operacion beta privada
1. Boton in-app de reporte de errores (sin soporte humano directo).
2. Backups:
   - export diario
   - retencion 7 dias
   - restauracion mensual de prueba
3. Dashboard de KPIs beta:
   - sync success >= 98%
   - sessions sin crash >= 99%.

## Definition of Done (v1)
1. Todo flujo tracking funciona sin IA.
2. Todo flujo IA funciona solo con BYOK configurado.
3. Offline + sync operativo en web y movil.
4. Borrado de cuenta y retencion de medios implementados.
5. KPIs beta medibles en panel.
