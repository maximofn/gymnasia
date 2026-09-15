# Archivos

- [Configuración BYOK de proveedores](provider-configuration.md) - Configuración, persistencia y verificación de credenciales BYOK para OpenAI, Anthropic y Google en la aplicación móvil. Distingue secretos estrictamente locales de los ajustes portables y describe los límites de tiempo y transporte por plataforma.
- [Transporte y streaming de proveedores](provider-streaming.md) - Explica cómo el cliente móvil transmite SSE de OpenAI, Anthropic y Google, convierte los eventos en turnos y continúa las llamadas de herramientas sin perder los datos de protocolo.
- [Runtime del agente y herramientas](runtime.md) - Contrato ejecutable del turno de chat móvil, sus guardas sanitarias, los bucles de proveedor y la idempotencia de efectos locales o externos.
