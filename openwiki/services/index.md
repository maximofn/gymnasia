# Archivos

- [Proxy CORS de Anthropic para navegador](anthropic-proxy.md) - Puente de desarrollo de FastAPI para el descubrimiento de modelos de Anthropic, la verificación de credenciales, los mensajes síncronos y el tráfico transmitido de la API de Messages.
- [Panel de arquitectura](architecture-board.md) - Espejo estático de Linear que abarca el contrato de datos del panel, la canalización de renderizado, la hoja de ruta, los filtros, el grafo de dependencias, la validación y el despliegue en Vercel.
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker de Cloudflare que recibe feedback confirmado por la app, lo valida y sanea, y crea incidencias verificables en GitHub. Mantiene la excepción remota acotada mediante idempotencia, limitación de abuso y retención de denuncias.
