# Archivos

- [Proxy local de Anthropic](anthropic-proxy.md) - Utilidad FastAPI opcional para depurar desde el navegador el contrato de Anthropic mediante una pasarela en loopback. No es un backend móvil ni un componente de producción y protege las credenciales BYOK contra una exposición compartida.
- [Tablero de arquitectura](architecture-board.md) - Superficie estática que proyecta un espejo versionado de tickets de Linear y su cadena de conciliación, validación y despliegue. Separa el inventario y los planes de trabajo del runtime ejecutable de Gymnasia.
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker opcional de Cloudflare que recibe feedback confirmado, aplica validación, privacidad, límites de abuso e idempotencia, y crea incidencias de GitHub verificables. La aplicación local-first sigue funcionando si el canal no está configurado o falla.
