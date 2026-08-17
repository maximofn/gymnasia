# Transparencia del Agente de IA

## Decisión

**Gymnasia** es la aplicación. **Agente** es el nombre del sistema conversacional
de inteligencia artificial integrado en ella. Ninguna superficie debe presentar
al Agente como Gymnasia, como una persona ni como un profesional acreditado.

La versión vigente del contrato es `2026-08-v1`. Su copy y su política local
viven en `apps/mobile/agent/aiTransparency.ts`; no deben duplicarse como textos
independientes en componentes o prompts.

## Contrato visible

Antes de que una persona pueda conversar con el Agente, la superficie muestra
de forma determinista y accesible:

> **Agente · inteligencia artificial**  
> No es una persona. Puede cometer errores. Contrasta la información importante,
> especialmente la relacionada con tu salud.

Todo hilo nuevo comienza además con un mensaje generado por la aplicación, no
por el proveedor. El aviso no depende de red, API key, modelo, caché, historial,
streaming, respuesta del LLM ni consentimiento en un modal.

Las superficies cubiertas son:

- Agente principal.
- Estimador conversacional de comidas.
- Agente para alimentos personales.

Las transformaciones puramente automáticas que no mantengan un intercambio
bidireccional con una persona quedan fuera de este contrato visible. Si un flujo
automático se convierte en conversación, debe incorporarse antes de publicarse.

## Contrato del system prompt

`composeAiSystemPrompt` elimina marcadores reservados antiguos o inyectados y
añade al final una única política local versionada. La composición ocurre justo
antes de construir la petición de OpenAI, Anthropic o Google, después de cualquier
prompt remoto, caché, fallback o instrucción de depuración.

La caché conserva solo la política funcional remota. Así, una instalación offline
con una caché antigua recibe siempre la versión de transparencia compilada en la
aplicación. Los mensajes locales de divulgación se guardan para la UI, pero se
excluyen del historial enviado al proveedor.

No se registran conversaciones, datos de salud ni identificadores personales
para diagnosticar este contrato. La versión se reconoce por los marcadores del
system prompt y por los tests deterministas.

## Base normativa

- [Artículo 50 del Reglamento de IA](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50)
- [Preguntas y respuestas de la Comisión Europea](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [Directrices de transparencia de julio de 2026](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
- [Reglamento (UE) 2024/1689 en EUR-Lex](https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=OJ:L_202401689)

Esta implementación adopta una interpretación técnica conservadora. No sustituye
el asesoramiento jurídico profesional.

## Checklist para nuevas funciones de IA

Antes de publicar una función nueva:

1. Determinar si existe intercambio directo y bidireccional con una persona.
2. Si existe, registrarla en `AI_CONVERSATION_SURFACES` y mostrar el componente
   de divulgación antes de habilitar la entrada.
3. Crear localmente el primer mensaje y excluirlo del historial del proveedor.
4. Componer la política local en la frontera de red, nunca solo en un prompt remoto.
5. Verificar copy, contraste, escalado de texto, VoiceOver/TalkBack y orden de foco.
6. Añadir contrato determinista y E2E con proveedor falso antes de publicar.

GYM-137 debe preservar este compositor cuando unifique prompts; GYM-142 debe
proteger las rutas y checks asociados; GYM-147 ampliará el recurso a los idiomas
futuros sin reducir su claridad.
