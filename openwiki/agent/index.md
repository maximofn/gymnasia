# Archivos

- [Configuración BYOK de proveedores](provider-configuration.md) - Contrato de configuración, almacenamiento y comprobación de credenciales BYOK de OpenAI, Google y Anthropic en la aplicación móvil. Explica el aislamiento de secretos, las diferencias entre web y nativo y el proxy Anthropic opcional.
- [Transporte, streaming y compatibilidad de modelos](provider-streaming.md) - Explica cómo el cliente móvil transmite y analiza SSE de OpenAI, Anthropic y Google, conserva la correlación para herramientas y decide entre acceso directo y el proxy local opcional de Anthropic.
- [Runtime del agente y herramientas](runtime.md) - Cómo el chat móvil fija la política de un turno, transmite al proveedor y ejecuta herramientas locales con validación, commit explícito e idempotencia persistente. Incluye los límites de privacidad, degradación y confirmación de efectos.
