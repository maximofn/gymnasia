# API (FastAPI)

## Setup
1. `cd apps/api`
2. `python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `cp .env.example .env`
5. Edita `.env` con tus valores.

## Run
- `uvicorn app.main:app --reload`

## Migrations
- `alembic upgrade head`

## Endpoints base
- `GET /health`
- `POST /auth/register`
  - request minimo: `email`, `password`, `birth_date`
  - regla: solo 18+
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`
- `GET /ai-keys`
- `POST /ai-keys`
- `PATCH /ai-keys/{provider}`
- `DELETE /ai-keys/{provider}`
- `POST /ai-keys/test`
- `GET /goals/active`
- `PUT /goals/active`
- `GET /workouts/templates`
- `POST /workouts/templates`
- `PATCH /workouts/templates/{id}`
- `DELETE /workouts/templates/{id}`
- `POST /workouts/templates/{id}/clone`
- `POST /workouts/templates/reorder`
- `POST /workouts/templates/{id}/exercises`
- `PATCH /workouts/templates/{id}/exercises/{exerciseId}`
- `DELETE /workouts/templates/{id}/exercises/{exerciseId}`
- `POST /workouts/templates/{id}/exercises/{exerciseId}/clone`
- `POST /workouts/templates/{id}/exercises/reorder`
- `POST /workouts/templates/{id}/exercises/{exerciseId}/sets`
- `PATCH /workouts/templates/{id}/exercises/{exerciseId}/sets/{setId}`
- `DELETE /workouts/templates/{id}/exercises/{exerciseId}/sets/{setId}`
- `POST /workouts/templates/{id}/exercises/{exerciseId}/sets/{setId}/clone`
- `POST /workouts/templates/{id}/exercises/{exerciseId}/sets/reorder`
- `POST /workouts/templates/{id}/start-session`
- `GET /workouts/sessions`
- `PATCH /workouts/sessions/{id}`
- `POST /workouts/sessions/{id}/finish`
- `POST /workouts/sessions/{id}/apply-template-updates`
- `GET /diet/days/{date}`
- `PUT /diet/days/{date}`
- `GET /measurements`
- `POST /measurements`
- `PATCH /measurements/{id}`
- `DELETE /measurements/{id}`
- `GET /chat/threads`
- `POST /chat/threads`
- `GET /chat/threads/{threadId}/messages`
- `POST /chat/threads/{threadId}/messages`
- `GET /chat/memory`
- `PUT /chat/memory/{domain}/{key}`
- `DELETE /chat/memory/{domain}/{key}`
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
- `POST /sync/operations/bulk`
- `GET /sync/operations`
- `POST /sync/operations/{operationId}/retry`
- `GET /account/status`
- `POST /account/delete-request`
- `POST /account/cancel-delete`
- `POST /account/export-request`
- `GET /account/export-requests`
- `GET /account/export-requests/{requestId}`
- `POST /account/internal/process-due-deletes` (header `x-admin-token`)
