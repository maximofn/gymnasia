# Archivos

- [Proxy Anthropic de depuración local](anthropic-proxy.md) - Utilidad FastAPI opcional para depurar una pasarela local de Anthropic desde el navegador. La aplicación usa Anthropic directamente en web y el proxy no se despliega ni es necesario salvo que se configure explícitamente la pasarela.
- [Tablero de arquitectura y seguimiento](architecture-board.md) - El sitio estático `arquitectura-agente/` refleja manualmente tickets de Linear mediante un único JSON, con vistas de épicas, estado y dependencias. No forma parte del runtime actual de Gymnasia ni sincroniza datos del producto.
- [Worker de feedback e incidencias verificables](feedback-worker.md) - Worker opcional de Cloudflare que recibe feedback confirmado, aplica controles de validación, privacidad y abuso, y crea incidencias en GitHub con una referencia comprobable por el cliente. La aplicación sigue funcionando cuando el canal no está configurado o falla.
