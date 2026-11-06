# Archivos

- [Configuración BYOK de proveedores](provider-configuration.md) - Contratos de configuración, credenciales, verificación, descubrimiento y transporte BYOK para OpenAI, Anthropic, Google y servidores compatibles con OpenAI en la aplicación móvil.
- [Streaming y continuaciones de proveedores](provider-streaming.md) - Contratos del cliente móvil para consumir SSE de OpenAI, Anthropic y Google, continuar llamadas de herramientas y limitar el contexto de Google. Detalla los invariantes de parseo, el historial local sin estado y los fallos que impiden presentar respuestas parciales como finales.
- [Runtime del agente y herramientas](runtime.md) - Describe cómo el Coach móvil fija su política, limita contexto y rondas de herramientas, y protege efectos de escritura frente a reintentos. Distingue los contratos verificables del runtime de los agregados de telemetría consolidados.
