---
name: portfolio-posts-auto-merge
description: "Al actualizar un post del portafolio (repo maximofn/portafolio), hacer commit, push y mergear la PR sin pedir confirmación"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c387f966-5572-4458-8199-a53c53b25eb5
  modified: 2026-09-20T05:05:49.066Z
---

Cuando el trabajo consiste en actualizar un post del portafolio
(`~/Documents/web/portafolio/portfolio`, repo `maximofn/portafolio`): rama de
tema → commit → push → `gh pr create` → `gh pr merge --merge --delete-branch`,
todo seguido y sin esperar aprobación.

**Why:** el usuario lo pidió el 20 de septiembre de 2026 («en este caso en el
que vamos a actualizar el post siempre haz commit, push y mergea la PR, yo veré
los cambios en producción»). Revisa el resultado directamente en producción.

**How to apply:** solo para cambios de contenido en posts del portafolio.
No extrapolar al repo de Gymnasia, donde sigue vigente
[[no-push-to-main-without-permission]] y las PRs se fusionan a mano.
