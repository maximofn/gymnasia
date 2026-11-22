---
name: no-push-to-main-without-permission
description: No hacer push a main sin permiso explícito del usuario — dispara CI/CD con builds limitados de Expo
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ee3a552-829f-4979-bdd5-4a08fce84845
---

Solo hacer `git push` a `main` cuando el usuario lo pida explícitamente. Está permitido hacer commits locales tras cada cambio, pero NO pushear sin permiso.

**Why:** Un push a `main` dispara un CI/CD que hace que Expo genere la APK, y el usuario solo tiene un número limitado de builds de Expo al mes. Pushear sin querer consume esa cuota.

**How to apply:** Tras un cambio, hacer commit local si procede, pero esperar la confirmación del usuario antes de `git push`. Esto tiene prioridad sobre la instrucción del `CLAUDE.md` del proyecto ("commit y push tras cada modificación").
