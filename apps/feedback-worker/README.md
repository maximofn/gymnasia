# Backend de incidencias (`gymnasia-feedback`)

Worker de Cloudflare que recibe propuestas de mejora, alimentos y ejercicios
desde la app y las convierte en issues de GitHub. Implementa GYM-54 (ticket para
sustituir los escritores no-op de GitHub Issues por un flujo verificable).

## Por qué existe

`apps/mobile` es local-first y no tiene backend. Este servicio es la **única
excepción**, y existe por un motivo concreto: crear una issue exige una
credencial de escritura en GitHub, y un cliente estático no puede llevarla. El
código anterior lo reconocía dejando el token vacío, pero seguía diciéndole al
usuario que la incidencia se había creado.

**La app funciona entera sin este servicio.** Si está caído o sin configurar, la
herramienta devuelve `unavailable` y el agente lo dice; nada más se degrada.

## Contrato

`POST /feedback/issues` — esquema **cerrado**, cualquier clave extra se rechaza:

```jsonc
{
  "schema_version": 1,
  "kind": "feature" | "food" | "exercise",
  "title": "string, 1..120",
  "summary": "string, 1..4000",
  "idempotency_key": "v1:<kind>:<16 hex>"
}
```

| Respuesta | Significado |
| --- | --- |
| `201 {status:"created", number, url, deduplicated:false}` | Issue nueva |
| `200 {status:"created", ..., deduplicated:true}` | Ya existía |
| `400 {status:"rejected", reason}` | Esquema inválido o claves desconocidas |
| `413` / `429` | Demasiado largo / rate limit |
| `503 {status:"unavailable"}` | Interruptor apagado |
| `502 {status:"error", reason:"upstream_failed"}` | GitHub falló |

`GET /health` devuelve `{"ok": true}`.

El **repositorio, la ruta, el método y las etiquetas los fija el servidor**. El
endpoint no puede usarse como proxy genérico de GitHub ni para tocar issues
existentes. `test/handler.test.ts` lo verifica.

## Puesta en marcha

```bash
# 1. Crear la base de datos y copiar el id a wrangler.jsonc
npm exec --yes -- wrangler@latest d1 create gymnasia-feedback

# 2. Aplicar migraciones
npm --workspace apps/feedback-worker run migrate:remote

# 3. Cargar el secreto (NUNCA en el repositorio: es público)
npm exec --yes -- wrangler@latest secret put GITHUB_TOKEN --cwd apps/feedback-worker

# 4. Desplegar
npm --workspace apps/feedback-worker run deploy
```

`wrangler` no se instala como dependencia: se baja al vuelo con `npm exec`,
igual que la CLI de Vercel en el resto del repositorio.

## La credencial

PAT **fine-grained** de una cuenta técnica, limitado a un solo repositorio y a
`Issues: Read and write`. Nada más. Se guarda con `wrangler secret put` y nunca
se devuelve al cliente.

**Rotación**: generar el PAT nuevo, `wrangler secret put GITHUB_TOKEN`, y revocar
el viejo en GitHub. No hace falta publicar versión de la app.

La opción preferible a medio plazo es una GitHub App instalada solo en el
repositorio de recepción, con tokens de instalación de una hora. El PAT es lo
aceptado para la v1.

## Apagar el servicio sin publicar versión de la app

```bash
npm exec --yes -- wrangler@latest deploy --var FEEDBACK_ENABLED:false --cwd apps/feedback-worker
```

El endpoint pasa a responder `503` y la app lo trata como `unavailable`.

## Antiabuso

No hay cuentas de usuario, así que el endpoint es anónimo. **No existe forma de
demostrar criptográficamente que una petición viene de la app**: cualquier firma
necesita un secreto, y ese secreto viaja en el APK y se extrae
descomprimiéndolo. Lo que sí se puede es subir el coste.

Implementado:

1. **Rate limiting por IP** con contadores en D1 (5/min, 30/día). Es el control
   que de verdad protege. Se hace a mano porque D1 está garantizado en el plan
   gratuito; el *Rate Limiting binding* nativo de Workers sería más limpio, pero
   está sin confirmar en el plan gratuito. Si se confirma, sustituirlo.
2. **Secreto compartido opcional** (`APP_SHARED_SECRET`), rotado en cada build.
   Es ofuscación reconocida como tal: sube el listón de "hago un curl a la URL"
   a "descomprimo el APK y busco la cadena". No es un control de seguridad.
3. **Deduplicación** por clave de idempotencia y por hash de contenido (24 h).

En reserva, **no implementadas**, por si aparece abuso real:

4. **Prueba de trabajo**: el cliente resuelve un puzzle numérico corto antes de
   enviar y el servidor lo verifica al instante. No necesita ningún secreto, así
   que no hay nada que extraer del APK. Efectiva contra abuso masivo, inútil
   contra un ataque dirigido.
5. **Play Integrity API**: Google firma que la petición viene de una instalación
   genuina y no modificada, bajada de Play, y el Worker verifica esa firma. No se
   puede falsificar. Gratis con cuota. Coste: módulo nativo, verificación de
   tokens en el servidor, y **no funciona en web**.

Criterio de escalada: (4) si aparece ruido automatizado; (5) solo si (4) no
basta. La señal a vigilar es un pico anómalo en la ingesta.

Dimensiona antes de invertir más: lo peor que consigue un atacante es crear
issues de texto en un repositorio privado que solo lee el mantenedor. No hay
credenciales, ni dinero, ni datos de usuarios detrás.

## Privacidad

Lo único que sale de la app es el tipo, el título, el resumen y la clave de
idempotencia. **No se envía conversación literal**: el esquema de la herramienta
ni siquiera tiene un campo donde meterla. Antes de persistir o mandar a GitHub,
`src/sanitize.ts` redacta patrones de credenciales que el usuario haya pegado
por accidente.

El destino es un repositorio **privado** de recepción. Si algún día se cambia a
uno público, hay que advertirlo expresamente en la confirmación y revisar
`docs/legal/privacy-change-checklist.md`.

## Tests

```bash
npm --workspace apps/feedback-worker run test
```

Cubre esquema, saneado, idempotencia, deduplicación, rate limiting, mapeo de
errores, CORS y fuzzing con `fast-check`. No necesita red ni credenciales: usa un
doble en memoria de D1 y un `fetch` simulado.
