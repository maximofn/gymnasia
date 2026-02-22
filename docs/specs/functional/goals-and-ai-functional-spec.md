# Goals and AI Functional Spec (V1)

## Objetivo
Definir objetivo activo por usuario y habilitar/deshabilitar capacidades IA segun BYOK.

## Alcance
- Objetivo activo.
- Gestion de API keys del usuario (BYOK).

## Casos de uso
1. Consultar objetivo activo.
2. Establecer nuevo objetivo activo.
3. Registrar API key por proveedor.
4. Rotar API key.
5. Eliminar API key.
6. Probar key (validacion local v1).

## Reglas funcionales
- Solo un objetivo activo por usuario.
- Al crear nuevo objetivo activo, los anteriores quedan inactivos.
- Proveedores soportados:
  - Anthropic
  - OpenAI
  - Google
- API keys:
  - guardadas cifradas
  - mostradas solo por fingerprint parcial
- Sin API key:
  - tracking disponible
  - funcionalidades IA deshabilitadas en frontend

## Criterios de aceptacion
- `GET /goals/active` devuelve objetivo o `null`.
- `PUT /goals/active` crea nuevo objetivo activo consistentemente.
- Endpoints BYOK permiten CRUD por proveedor sin exponer secreto completo.

## Casos limite
- Duplicar provider por usuario debe actualizar o rechazar segun endpoint.
- Operaciones sobre key inexistente deben responder 404 o 204 segun semantica.
- Usuario no autenticado debe recibir 401.

## Fuera de alcance v1
- Test real contra proveedor IA en endpoint `/ai-keys/test`.
- Orquestacion de chat y memoria completa en runtime.
