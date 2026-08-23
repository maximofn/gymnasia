# Backend de incidencias (`gymnasia-feedback`)

Worker de Cloudflare que recibe propuestas de mejora, alimentos, ejercicios y
denuncias de respuestas de IA desde la app y las convierte en issues de GitHub.
Implementa GYM-54 (ticket para sustituir los escritores no-op de GitHub Issues por un
flujo verificable) y da soporte a GYM-189 (ticket para añadir denuncia dentro de la app
para respuestas generadas por IA).

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
  "kind": "feature" | "food" | "exercise" | "report",
  "title": "string, 1..120",
  "summary": "string, 1..4000 (1..16000 para report)",
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

# 4. Crear y cargar una sal aleatoria e independiente para el HMAC de IP
openssl rand -base64 32 | npm exec --yes -- wrangler@latest secret put RATE_LIMIT_SALT --cwd apps/feedback-worker

# 5. Desplegar
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

1. **Rate limiting por identificador HMAC de IP** con contadores en D1 (5/min,
   30/día). La IP en claro solo existe en la cabecera que entrega Cloudflare: antes de
   consultar o escribir D1 se firma con HMAC-SHA-256 y `RATE_LIMIT_SALT`. Los contadores
   se eliminan a las 48 horas. Sin la sal el endpoint responde `503` para evitar una
   degradación silenciosa a IP en claro. La sal nunca va en el repositorio ni en la app.
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
idempotencia. Para propuestas de mejora, alimentos y ejercicios no se envía conversación
literal. Una incidencia `report` sí contiene exactamente lo que el usuario ha visto en
la vista previa: motivo, detalles opcionales, pregunta anterior, respuesta denunciada y
contexto técnico. Nunca incluye el hilo completo, razonamiento interno, errores técnicos,
una clave BYOK ni un identificador de cuenta. El cliente redacta primero patrones de
secretos y `src/sanitize.ts` vuelve a hacerlo antes de persistir o mandar a GitHub.

El destino es un repositorio **privado** de recepción. Si algún día se cambia a
uno público, hay que advertirlo expresamente en la confirmación y revisar
`docs/legal/privacy-change-checklist.md`.

## Retención de denuncias y operación

El trigger programado de `wrangler.jsonc` se ejecuta cada hora. Selecciona por lotes de
40 las incidencias `report` que han cumplido 30 días, sustituye su cuerpo en GitHub por
un aviso de borrado y solo entonces marca `redacted_at` en D1. Si GitHub falla, no marca
el registro: la siguiente ejecución vuelve a intentarlo. Los títulos genéricos y la
referencia técnica de la issue permanecen para conservar la trazabilidad sin el texto de
la conversación.

Despliegue de una versión que introduce o cambia retención:

```bash
# La migración debe existir antes de que el cron consulte redacted_at.
npm --workspace apps/feedback-worker run migrate:remote

# Confirma que ambos secretos existen; no muestres sus valores.
npm exec --yes -- wrangler@latest secret list --cwd apps/feedback-worker

npm --workspace apps/feedback-worker run deploy
curl -sS https://gymnasia-feedback.maximofn.com/health
```

Comprobación operativa semanal y ante cualquier alerta:

```bash
# Debe devolver 0 filas. Una fila indica que GitHub lleva al menos una hora sin
# aceptar la redacción o que el trigger no está ejecutándose.
npm exec --yes -- wrangler@latest d1 execute gymnasia-feedback --remote --cwd apps/feedback-worker --command \
  "SELECT issue_number, datetime(created_at/1000, 'unixepoch') AS created_utc FROM issues WHERE kind='report' AND state='created' AND redacted_at IS NULL AND created_at <= (unixepoch('now') - 30*24*60*60)*1000 LIMIT 50"

# Buscar report_retention_completed y errores del trigger durante una observación.
npm exec --yes -- wrangler@latest tail --cwd apps/feedback-worker
```

Si quedan filas vencidas, confirma primero que `GITHUB_TOKEN` sigue vigente y que el
repositorio configurado es el privado correcto. Corrige el secreto o la configuración;
el cron reintentará en la siguiente hora. Si la exposición no puede esperar, redacta
manualmente los cuerpos afectados en el repositorio privado, registra `redacted_at` solo
después de verificar cada cambio y deja constancia del incidente sin copiar el contenido.

## Tests

```bash
npm --workspace apps/feedback-worker run test
```

Cubre esquema, saneado, idempotencia, deduplicación, rate limiting, mapeo de
errores, CORS y fuzzing con `fast-check`. No necesita red ni credenciales: usa un
doble en memoria de D1 y un `fetch` simulado.
