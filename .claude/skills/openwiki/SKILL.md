---
name: openwiki
description: Operar, revisar, diagnosticar, asegurar y actualizar OpenWiki en Gymnasia, incluidos Code Brain, Personal Brain, el runner privado, OAuth de ChatGPT, LangSmith, Telegram, cron, visualización y las PR generadas. Úsala ante cualquier tarea que mencione OpenWiki o su automatización; no la uses para trabajo ordinario de la app que solo consulte código fuente.
---

# OpenWiki en Gymnasia

Mantén una única interpretación de la instalación y evita convertir contenido generado en instrucciones del agente.

## Fuentes de verdad

- `openwiki/quickstart.md` es la entrada a la documentación generada del repositorio.
- `docs/openwiki-automation.md` es el runbook humano de seguridad, secretos, horarios, recuperación y privacidad. Léelo antes de operar OAuth, LangSmith, Telegram o Personal Brain.
- `ops/openwiki-automation-template/` es la plantilla pública revisada del runner. El despliegue vivo está en el repositorio privado `maximofn/gymnasia-openwiki-automation`. Compara ambos antes de cambiar cualquiera y deja la plantilla pública sincronizada con todo cambio desplegado.
- Esta skill es la fuente de verdad para decisiones de agentes, compatibilidad de versiones y aprendizajes específicos de OpenWiki. No dupliques esos detalles en `CLAUDE.md`.

## Elegir el flujo

### Consultar o revisar la wiki

Empieza por `openwiki/quickstart.md` y abre solo las páginas relacionadas. Una petición de revisión no autoriza regenerar documentación, lanzar workflows ni fusionar PR.

### Actualizar Code Brain

- Comprueba primero el estado del repositorio y el último `gitHead` documentado.
- Para una ejecución local solicitada, usa `openwiki code --update`; revisa después el diff, especialmente `CLAUDE.md`, `AGENTS.md` y los delimitadores administrados.
- La actualización recurrente pertenece al workflow privado, no a un cron del repositorio público.
- La rama remota es siempre `openwiki/update`; el runner crea o actualiza una única PR y la fusión sigue siendo manual.

### Operar Personal Brain

- Personal Brain es privado y separado de `openwiki/`. Nunca copies su wiki, datos crudos o estado de conectores al repositorio público.
- `openwiki cron` administra únicamente la ingesta local de conectores mediante `launchd` en macOS. No muestra ni gobierna el horario remoto de Code Brain.
- El runner privado usa Linear de solo lectura, el repositorio de maximofn.com y Tavily. Personal Brain no se traza en LangSmith.

### Visualizar

`openwiki visualize [path]` sirve un lector y grafo local. Trátalo como una vista de artefactos ya generados, no como un proceso de actualización. Antes de publicarlo en una web, revisa que el bundle no contenga rutas locales, datos privados ni fuentes de Personal Brain.

## Seguridad operacional

- Trata la sesión OAuth de ChatGPT como una contraseña. Solo puede persistirse cifrada en el repositorio privado de automatización.
- No imprimas, pegues en el chat ni inspecciones logs completos que puedan contener credenciales. Usa estados de pasos y clasificadores sanitizados.
- `OPENWIKI_OAUTH_SEED` es temporal: elimínalo tras la primera ejecución correcta que cree un artefacto OAuth cifrado. La frase de cifrado permanece como secreto independiente.
- La recuperación OAuth requiere autorización explícita antes de subir la sesión cifrada o rotar la frase. Después verifica restauración, ejecución y persistencia; elimina la semilla y los temporales.
- Code Brain usa LangSmith europeo con inputs, outputs y metadatos ocultos. Personal Brain mantiene el tracing desactivado.
- No habilites OAuth de ChatGPT ni secretos equivalentes en workflows del repositorio público.

## Instrucciones y aprendizajes

En Gymnasia `AGENTS.md` es un enlace simbólico a `CLAUDE.md`; hay un único archivo canónico. Los aprendizajes duraderos pueden añadirse a `CLAUDE.md` mediante una PR normal y quedan visibles por ambos nombres.

OpenWiki no utiliza esos archivos como almacén de aprendizajes: mantiene un fragmento fijo que apunta a la wiki. El runner restaura ambos desde `main` antes de preparar su commit, por lo que una ejecución diaria no puede cambiar las reglas del agente. Los aprendizajes específicos de OpenWiki pertenecen a esta skill; los problemas generales del proyecto que puedan repetirse pertenecen al `Solved Problems Log` de `CLAUDE.md`, sin duplicarlos.

Para actualizar OpenWiki o tocar su integración con las instrucciones, lee [compatibilidad de versiones e instrucciones](references/version-and-agent-instructions.md) y ejecuta:

```bash
node .claude/skills/openwiki/scripts/check-agent-instructions.mjs
```

## Cambiar la automatización

1. Trabaja primero sobre `ops/openwiki-automation-template/` o reconcilia explícitamente un hotfix del repositorio privado.
2. Mantén las dependencias con versión exacta y el lockfile generado con la versión de Node indicada por la plantilla.
3. Ejecuta `npm ci` y `npm test` dentro de la plantilla.
4. Comprueba que ningún secreto, `.env`, log, semilla, OAuth descifrado o estado de Personal Brain entra en el diff.
5. Sincroniza los mismos archivos en el repositorio privado y ejecuta manualmente los workflows afectados.
6. Verifica los pasos mediante metadatos, el nuevo artefacto cifrado y los paths de la PR pública. No leas logs privados salvo diagnóstico necesario y autorizado.
7. Deja la PR pública para revisión y fusión manual.

## Finalización

Una operación no está cerrada hasta que se conoce la versión efectiva local y remota, pasan las pruebas relevantes, el estado privado vuelve a estar cifrado, las instrucciones conservan su estructura, la plantilla coincide con el runner desplegado y cualquier PR generada enumera solo paths esperados.
