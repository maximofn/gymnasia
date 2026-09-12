# Archivos

- [Proxy local de Anthropic](anthropic-proxy.md) - Pasarela FastAPI opcional y limitada a loopback para depurar Anthropic desde la web de Gymnasia. Convierte las credenciales BYOK enviadas al proxy en cabeceras upstream, pero no es un backend ni una dependencia de producción.
- [Tablero de arquitectura](architecture-board.md)
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker opcional de Cloudflare que recibe feedback confirmado, aplica controles de validación, privacidad y abuso, y crea incidencias en GitHub con una referencia comprobable por el cliente. La aplicación sigue funcionando cuando el canal no está configurado o falla.
