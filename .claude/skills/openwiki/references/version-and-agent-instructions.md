# Versiones e instrucciones del agente

Lee esta referencia al actualizar OpenWiki, revisar una PR que cambie instrucciones o investigar errores de delimitadores.

## Topología de Gymnasia

`CLAUDE.md` es el archivo canónico y `AGENTS.md` es un enlace simbólico cuyo destino debe seguir siendo exactamente `CLAUDE.md`. No los conviertas en dos copias ni inviertas el enlace sin una migración explícita y revisada.

El fragmento administrado por OpenWiki debe contener exactamente un delimitador inicial y uno final, en ese orden. No escribas los literales completos de esos delimitadores en otra parte de `CLAUDE.md`: OpenWiki los contaría como duplicados.

## Incompatibilidad observada en 0.3.3 y 0.4.3

OpenWiki 0.3.3 prepara dos fragmentos distintos suponiendo que `AGENTS.md` y `CLAUDE.md` son archivos independientes:

- `AGENTS.md` recibe el fragmento completo de orientación hacia `openwiki/`.
- `CLAUDE.md` recibe una referencia textual a `AGENTS.md`.

Al escribir a través del enlace simbólico de Gymnasia, ambas operaciones afectan a `CLAUDE.md`. En la ejecución del 25 de agosto de 2026 quedó una referencia circular, texto cortado y dos delimitadores finales. El check `prompt-policy` bloqueó la PR antes de la fusión. Volvió a reproducirse con OpenWiki 0.4.3 el 30 de agosto de 2026: `openwiki code --update` insertó un segundo delimitador final y texto cortado antes de abortar afirmando que había dejado el fichero sin cambios. Si aparece ese mensaje, comprueba siempre `git diff -- CLAUDE.md`, restaura solo la edición parcial del comando y ejecuta `check-agent-instructions.mjs`; no reintentes sobre el mismo checkout.

El runner privado evita recurrencias restaurando `AGENTS.md` y `CLAUDE.md` desde `origin/main` antes de preparar el commit y añade al índice solo `openwiki/` y `.openwikiignore`. Esta protección afecta exclusivamente al runner; las PR normales sí pueden actualizar aprendizajes en `CLAUDE.md`.

## Protocolo de actualización

1. Obtén la versión local desde el banner de `openwiki --help` o con `npm ls -g --depth=0`; `openwiki --version` no existe y trataría el argumento como una opción inválida.
2. Consulta la versión estable y las notas oficiales. No uses `latest` en el runner: actualiza el pin exacto de la plantilla y del repositorio privado.
3. Ejecuta la nueva versión en un checkout desechable basado en `main`, nunca sobre trabajo local sin guardar.
4. Compara el árbol generado, la rama `openwiki/update` y cualquier cambio en archivos de instrucciones.
5. Ejecuta el validador de esta skill y los tests de la plantilla.
6. Si la versión propone una instrucción legítima, adáptala manualmente al archivo canónico, preséntala en una PR normal y conserva el enlace simbólico. No retires la protección del runner solo porque upstream cambió su plantilla.
7. Valida el runner con OAuth y tracing normales; confirma Code Brain, Personal Brain, cifrado posterior y paths de la PR.

La plantilla exige Node 22.22.x. Un Node anterior puede instalar OpenWiki mostrando `EBADENGINE`, pero no constituye un entorno de validación soportado.

## Dónde guardar conocimiento

| Conocimiento | Ubicación canónica |
| --- | --- |
| Arquitectura y comportamiento actual del código | `openwiki/`, generado desde evidencia |
| Operación humana, secretos y recuperación | `docs/openwiki-automation.md` |
| Implementación revisada del runner | `ops/openwiki-automation-template/` |
| Decisiones y gotchas específicos de OpenWiki para agentes | esta skill y sus referencias |
| Gotchas generales de Gymnasia que siguen ocurriendo con código correcto | `Solved Problems Log` de `CLAUDE.md` |

No copies un mismo procedimiento entre estas ubicaciones. Enlaza a su fuente canónica y conserva en cada sitio solo la información que cambia las decisiones de su audiencia.
