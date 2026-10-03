# Archivos

- [Proxy Anthropic de depuración web](anthropic-proxy.md) - Utilidad FastAPI opcional y limitada a loopback para depurar desde la web el contrato de Anthropic. La aplicación usa Anthropic directamente por defecto y solo selecciona esta pasarela cuando se configura de forma expresa una base web local.
- [Tablero de arquitectura](architecture-board.md) - Superficie estática que proyecta un espejo versionado de tickets de Linear y su cadena de conciliación, validación y despliegue. Separa el inventario y los planes de trabajo del runtime ejecutable de Gymnasia.
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker opcional de Cloudflare que recibe feedback confirmado, aplica validación, privacidad, límites de abuso e idempotencia, y crea incidencias de GitHub verificables. La aplicación local-first sigue funcionando si el canal no está configurado o falla.
