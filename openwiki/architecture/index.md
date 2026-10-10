# Archivos

- [Ciclo del agente y streaming multiproveedor](agent-loop.md) - Recorrido de un turno del chat principal desde el lease de política y los guardrails sanitarios hasta el streaming SSE, las rondas de herramientas, el filtrado final y la persistencia local para OpenAI, Anthropic y Google.
- [Herramientas del agente, efectos e idempotencia](agent-tools.md) - Catálogo canónico, adaptación multiproveedor y despacho de herramientas del agente móvil, incluido el protocolo durable que reconcilia efectos y evita duplicar escrituras tras respuestas perdidas.
- [Estado local, persistencia y recuperación](local-first-state.md) - Explica cómo Gymnasia hidrata, normaliza y persiste su agregado LocalStore, cómo separa las credenciales BYOK y cómo bloquea o recupera el estado ante corrupción. Incluye las diferencias entre móvil y web, los namespaces por variante y el espejo de desarrollo opcional.
- [Composición móvil, capas y shell](mobile-composition.md) - Explica cómo la raíz móvil ensambla plataforma, persistencia, controladores, pantallas y shell, y qué contratos de dependencias y navegación Atrás deben conservarse al evolucionar la aplicación.
- [Política firmada, prompt y seguridad sanitaria](policy-and-health-safety.md) - Explica cómo el cliente móvil selecciona, verifica y activa como una sola unidad el system prompt y el guardrail sanitario, y cómo clasifica entradas, salidas, streaming y tools con fallback local.
- [Arquitectura del sistema y límites de despliegue](system-overview.md)
