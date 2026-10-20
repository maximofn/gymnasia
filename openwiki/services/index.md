# Archivos

- [Proxy de Anthropic](anthropic-proxy.md) - Utilidad FastAPI opcional y local para depurar el contrato entre el cliente web y la API Messages de Anthropic. Describe el transporte de continuaciones con herramientas, el streaming SSE y el tratamiento de errores sin convertir el proceso en un backend de producto.
- [Tablero de arquitectura](architecture-board.md) - Superficie estática que proyecta un espejo versionado de tickets de Linear y su cadena de conciliación, validación y despliegue. Separa el inventario y los planes de trabajo del runtime ejecutable de Gymnasia.
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker opcional de Cloudflare que recibe feedback confirmado, aplica validación, privacidad, límites de abuso e idempotencia, y crea incidencias de GitHub verificables. La aplicación local-first sigue funcionando si el canal no está configurado o falla.
