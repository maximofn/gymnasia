# System prompt del chat principal

## Fuente y precedencia

`prompts/AGENTS.md` es la única fuente editable del prompt base de Gymnasia
Coach. Development usa exclusivamente el snapshot local. Staging y Production
consultan cada cinco minutos el último deployment exitoso `gymnasia-policy` de
su canal y seleccionan la política en este orden:

1. asset `policy.md` del deployment válido del canal;
2. última respuesta válida de ese mismo entorno y canal en la caché local v3;
3. snapshot de ese mismo canal integrado en la compilación.

Nunca se usa `main`, otro canal ni staging como fallback de Production. Antes
de una build no local, `prepare-policy-snapshot.mjs` vuelve a resolver el
deployment, comprueba `policy.md`, el informe sanitario y la evidencia de
promoción, y regenera el snapshot. Si falta cualquiera o un digest no coincide,
la build falla.

El snapshot TypeScript vive en
`apps/mobile/agent/generated/chatSystemPrompt.generated.ts`. Es un artefacto
versionado y generado: no se edita manualmente.

El bloque delimitado por `HEALTH-SAFETY:START` y `HEALTH-SAFETY:END` tampoco se
edita a mano. Se genera desde `policy/health-safety/`; tanto las reglas
`provisional` como las `approved` se publican para no dejar al agente sin
protección mientras llega la revisión profesional. El ciclo y los límites de
esta garantía se documentan en `docs/architecture/health-safety-policy.md`.

Después de seleccionar el prompt base, `composeAiSystemPrompt` añade una única
política local de identidad y transparencia. El snapshot no sustituye ni duplica
esa protección. Los prompts del estimador de comidas y del asistente de alimentos
personales son independientes.

La composición admite exactamente esas dos fuentes: la política seleccionada y la
política local de transparencia. Ningún dato local del usuario —memoria del
coach, preferencias, backups importados— puede añadir texto al system prompt, en
ningún entorno y se llame como se llame el campo. Hasta GYM-139 un campo de
memoria personal con la clave `debug` se anexaba al prompt en producción; ese
mecanismo se eliminó por completo, no se sustituyó por una variante de
desarrollo, y `apps/mobile/agent/personalData.contract.test.ts` lo verifica sobre
el fuente de `App.tsx`.

## Normalización, validación y hash

La normalización elimina un BOM UTF-8 inicial y convierte `CRLF` o `CR` a `LF`.
No resume, combina, recorta ni reescribe ningún otro contenido. El SHA-256 se
calcula sobre el texto normalizado.

Una descarga solo es utilizable si la URL pertenece al asset inmutable
`policy.md` de una release de este repositorio, la respuesta HTTP es correcta, el cuerpo no
está vacío, el tipo de contenido es texto admitido, no contiene un byte nulo y
no comienza como un documento HTML. Su SHA-256 debe coincidir con el deployment.
Una respuesta rechazada nunca se escribe en caché. La caché v3 almacena además
entorno, canal, candidato y deployment; se vuelve a calcular el hash antes de
utilizarla y nunca se acepta en otro canal.

Las trazas `chatPrompt` registran la fuente (`remote`, `cache` o `bundled`), el
hash y la versión. No contienen el prompt, conversaciones ni datos personales.
El evento `selected` acompaña a la selección de la política; `chat-request` se
emite una vez por envío del chat principal con la fuente, la versión, la longitud
del prompt base y `localPromptOverrides: 0`. Ese último campo es un literal
constante: su valor no informa en runtime, pero deja el invariante observable
desde fuera del binario, de modo que reintroducir un override obligaría a
tocarlo.
El hash y la inmutabilidad de GitHub permiten demostrar igualdad y detectar
corrupción, pero no sustituyen la firma criptográfica, rotación de claves ni
anti-rollback, que pertenecen a GYM-140.

## Editar y verificar

1. Para texto no sanitario, edita `prompts/AGENTS.md` fuera del bloque
   administrado. Para seguridad sanitaria, edita `policy/health-safety/`.
2. Si cambió la política sanitaria, genera su bloque y el snapshot:

   ```bash
   npm run sync:health-safety
   ```

   Para un cambio no sanitario, regenera solo el snapshot:

   ```bash
   npm run sync:chat-prompt
   ```

3. Revisa el diff de la fuente canónica, el prompt y el archivo generado.
4. Comprueba la sincronización y ejecuta las pruebas:

   ```bash
   npm run check:chat-prompt
   npm run check:health-safety
   npm run test:health-safety
   npm test
   npm run test:agent:e2e
   npm --workspace apps/mobile exec tsc --noEmit
   ```

`check:chat-prompt` vuelve a generar el resultado esperado en memoria y lo
compara byte por byte. Falla si cambió la fuente sin regenerar, si se editó el
artefacto a mano o si sus metadatos ya no corresponden al contenido.

La promoción, los entornos, la recuperación y el aislamiento local se describen
en `docs/architecture/policy-environments.md`.
