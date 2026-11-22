---
name: no-tool-confirmations
description: Coach nunca pide confirmación al usuario antes de usar tools; el usuario medio no sabe de desarrollo
metadata:
  node_type: memory
  type: project
  originSessionId: aa9c73c9-ec0f-4efc-8a05-5dc6d4e81f94
  modified: 2026-11-17T10:15:04.087Z
---

Decisión del mantenedor (17-11-2026, al cancelar GYM-45): Coach no debe preguntar al usuario antes de ejecutar tools ni hablarle de «guardar en la base de datos».

**Why:** el usuario medio de Gymnasia no sabe nada de desarrollo de software; esas preguntas no le aportan nada.

**How to apply:** no propongas confirmaciones previas. Los errores se cubren en código (escrituras campo a campo de la memoria, GYM-151) o con un Deshacer posterior (GYM-260). Única excepción vigente: antes de enviar una sugerencia al equipo (`create_feature_issue`), porque la política de privacidad promete «no envía nada hasta que lo apruebas».
