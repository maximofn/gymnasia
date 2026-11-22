---
name: portfolio-posts-style
description: "Estilo de los posts de la serie del agente en el portafolio: pseudocódigo, soluciones abstractas y comas en vez de rayas"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5780ef40-b9bf-4068-849c-2dd72661ae74
  modified: 2026-09-27T17:26:41.015Z
---

En los posts del portafolio (serie del agente de Gymnasia, repo `maximofn/portafolio`):

- **Pseudocódigo, no código real.** El lector viene a aprender el concepto, no a copiar una implementación. Los payloads de protocolo (un evento SSE, un JSON) sí se muestran tal cual.
- **El pseudocódigo va en inglés en los tres idiomas** (ES, EN y PT-BR), también sus comentarios y cadenas. La prosa que lo cita usa esas palabras en inglés (`repeat at most`, `exit`). Pedido el 27 de septiembre de 2026 al revisar `gymnasia-agent-tool-loop`.
- **Problemas de plataforma en abstracto.** Explicar qué problema ocurre y cómo se resuelve en general, no la API concreta (nada de `XMLHttpRequest`, `responseText`, `TextDecoder` o React Native como explicación).
- **Sin rayas `—` como delimitadores de incisos**, en ningún idioma: usar comas.

**Why:** lo pidió el 27 de septiembre de 2026 al revisar `gymnasia-agent-response-streaming`.

**How to apply:** aplicarlo al escribir o revisar cualquier post de la serie. Las tres reglas están también en la skill `write-agent-posts` del portafolio. Relacionado: [[portfolio-posts-auto-merge]].
