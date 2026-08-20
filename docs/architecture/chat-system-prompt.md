# System prompt del chat principal

## Fuente y precedencia

`prompts/AGENTS.md` es la única fuente editable del prompt base de Gymnasia
Coach. La app intenta seleccionar la política en este orden:

1. respuesta remota válida de `prompts/AGENTS.md` en `main`;
2. última respuesta remota válida conservada en la caché local v2;
3. snapshot de `prompts/AGENTS.md` integrado en la compilación.

El snapshot TypeScript vive en
`apps/mobile/agent/generated/chatSystemPrompt.generated.ts`. Es un artefacto
versionado y generado: no se edita manualmente.

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

Una descarga solo es utilizable si la respuesta HTTP es correcta, el cuerpo no
está vacío, el tipo de contenido es texto admitido, no contiene un byte nulo y
no comienza como un documento HTML. Una respuesta rechazada nunca se escribe en
caché. La caché v2 almacena contenido, hash, versión de esquema y versión de
normalización; se vuelve a calcular el hash antes de utilizarla.

Las trazas `chatPrompt` registran la fuente (`remote`, `cache` o `bundled`), el
hash y la versión. No contienen el prompt, conversaciones ni datos personales.
El evento `selected` acompaña a la selección de la política; `chat-request` se
emite una vez por envío del chat principal con la fuente, la versión, la longitud
del prompt base y `localPromptOverrides: 0`. Ese último campo es un literal
constante: su valor no informa en runtime, pero deja el invariante observable
desde fuera del binario, de modo que reintroducir un override obligaría a
tocarlo.
El hash permite demostrar igualdad y detectar corrupción, pero no autentica al
publicador; la firma criptográfica de bundles pertenece a GYM-140.

## Editar y verificar

1. Edita solamente `prompts/AGENTS.md`.
2. Regenera el snapshot:

   ```bash
   npm run sync:chat-prompt
   ```

3. Revisa el diff del archivo fuente y del generado.
4. Comprueba la sincronización y ejecuta las pruebas:

   ```bash
   npm run check:chat-prompt
   npm test
   npm run test:agent:e2e
   npm --workspace apps/mobile exec tsc --noEmit
   ```

`check:chat-prompt` vuelve a generar el resultado esperado en memoria y lo
compara byte por byte. Falla si cambió la fuente sin regenerar, si se editó el
artefacto a mano o si sus metadatos ya no corresponden al contenido.
