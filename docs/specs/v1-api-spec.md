# V1 API Spec

## 1. Autenticacion
- `POST /auth/register`
  - request minimo: `email`, `password`, `birth_date`
  - regla: solo registro para 18+ (validador server-side)
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`

## 2. BYOK
- `GET /ai-keys`
- `POST /ai-keys`
- `PATCH /ai-keys/{provider}`
- `DELETE /ai-keys/{provider}`
- `POST /ai-keys/test`

## 3. Goals
- `GET /goals/active`
- `PUT /goals/active`

## 4. Workouts

### 4.1 Templates
- `GET /workouts/templates`
- `POST /workouts/templates`
- `PATCH /workouts/templates/{templateId}`
- `DELETE /workouts/templates/{templateId}`
- `POST /workouts/templates/{templateId}/clone`
- `POST /workouts/templates/reorder`

### 4.2 Template exercises
- `POST /workouts/templates/{templateId}/exercises`
- `PATCH /workouts/templates/{templateId}/exercises/{exerciseId}`
- `DELETE /workouts/templates/{templateId}/exercises/{exerciseId}`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/clone`
- `POST /workouts/templates/{templateId}/exercises/reorder`

### 4.3 Template sets
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets`
- `PATCH /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}`
- `DELETE /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets/{setId}/clone`
- `POST /workouts/templates/{templateId}/exercises/{exerciseId}/sets/reorder`

### 4.4 Sessions
- `POST /workouts/templates/{templateId}/start-session`
- `GET /workouts/sessions`
- `PATCH /workouts/sessions/{sessionId}`
- `POST /workouts/sessions/{sessionId}/finish`
- `POST /workouts/sessions/{sessionId}/apply-template-updates`

## 5. Diet
- `GET /diet/days/{date}`
- `PUT /diet/days/{date}`

## 6. Measurements
- `GET /measurements`
- `POST /measurements`
- `PATCH /measurements/{measurementId}`
- `DELETE /measurements/{measurementId}`

## 7. Chat IA y memoria
- `GET /chat/threads`
- `POST /chat/threads`
- `GET /chat/threads/{threadId}/messages`
- `POST /chat/threads/{threadId}/messages`
- `GET /chat/memory`
- `PUT /chat/memory/{domain}/{key}`
- `DELETE /chat/memory/{domain}/{key}`

## 8. Media / IA multimedia
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

## 9. Offline / sync
- `POST /sync/operations/bulk`
- `GET /sync/operations`
- `POST /sync/operations/{operationId}/retry`

## 10. Cuenta y ciclo de vida
- `GET /account/status`
- `POST /account/delete-request`
- `POST /account/cancel-delete`
- `POST /account/export-request`
- `GET /account/export-requests`
- `GET /account/export-requests/{requestId}`
- `POST /account/internal/process-due-deletes` (operación interna con token admin)
