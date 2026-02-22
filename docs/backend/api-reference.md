# Backend - API Reference

## Autenticacion
- `POST /auth/register`
  - request minimo: `email`, `password`, `birth_date`
  - regla: valida 18+ en backend
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`

## BYOK
- `GET /ai-keys`
- `POST /ai-keys`
- `PATCH /ai-keys/{provider}`
- `DELETE /ai-keys/{provider}`
- `POST /ai-keys/test`

## Goals
- `GET /goals/active`
- `PUT /goals/active`

## Workouts - Plantillas
- `GET /workouts/templates`
- `POST /workouts/templates`
- `PATCH /workouts/templates/{templateId}`
- `DELETE /workouts/templates/{templateId}`
- `POST /workouts/templates/{templateId}/clone`
- `POST /workouts/templates/reorder`

## Workouts - Ejercicios de plantilla
- `POST /workouts/templates/{templateId}/exercises`
- `PATCH /workouts/templates/{templateId}/exercises/{exerciseId}`
- `DELETE /workouts/templates/{templateId}/exercises/{exerciseId}`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/clone`
- `POST /workouts/templates/{templateId}/exercises/reorder`

## Workouts - Series de ejercicio
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets`
- `PATCH /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}`
- `DELETE /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}/clone`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets/reorder`

## Workouts - Sesiones
- `POST /workouts/templates/{templateId}/start-session`
- `GET /workouts/sessions`
- `PATCH /workouts/sessions/{sessionId}`
- `POST /workouts/sessions/{sessionId}/finish`
- `POST /workouts/sessions/{sessionId}/apply-template-updates`

## Diet
- `GET /diet/days/{date}`
- `PUT /diet/days/{date}`

## Measurements
- `GET /measurements`
- `POST /measurements`
- `PATCH /measurements/{measurementId}`
- `DELETE /measurements/{measurementId}`

## Chat IA
- `GET /chat/threads`
- `POST /chat/threads`
- `GET /chat/threads/{threadId}/messages`
- `POST /chat/threads/{threadId}/messages`

## Memoria IA
- `GET /chat/memory`
- `PUT /chat/memory/{domain}/{key}`
- `DELETE /chat/memory/{domain}/{key}`

## Media e IA multimedia
- `POST /media/uploads/intents`
- `GET /media/assets`
- `POST /media/assets/{assetId}/signed-url`
- `DELETE /media/assets/{assetId}`
- `POST /media/diet/estimate`
- `GET /media/exercise-links`
- `POST /media/exercise-links`
- `POST /media/exercise-links/{linkId}/generate-image`
- `POST /media/exercise-links/{linkId}/generate-video`
- `GET /media/jobs`

## Offline / Sync
- `POST /sync/operations/bulk`
- `GET /sync/operations`
- `POST /sync/operations/{operationId}/retry`

## Cuenta y privacidad
- `GET /account/status`
- `POST /account/delete-request`
- `POST /account/cancel-delete`
- `POST /account/export-request`
- `GET /account/export-requests`
- `GET /account/export-requests/{requestId}`
- `POST /account/internal/process-due-deletes` (header `x-admin-token`)
