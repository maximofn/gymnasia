# Entornos, firma y promoción de políticas

## Variantes instalables

Toda configuración Expo exige `APP_ENV`. No hay valor implícito en builds:

| APP_ENV | Nombre | ID Android/iOS | Canal | IA |
| --- | --- | --- | --- | --- |
| `development` | Gymnasia Dev | `com.maximofn.gymnasia.dev` | `Local` | fixtures |
| `staging` | Gymnasia Staging | `com.maximofn.gymnasia.staging` | `Staging` | BYOK |
| `production` | Gymnasia | `com.maximofn.gymnasia` | `Production` | BYOK |

`preview` extiende `staging` en EAS. El workflow de publicación usa exclusivamente
`production-apk`, que hereda `APP_ENV=production`. Los IDs distintos permiten instalar
las variantes a la vez; sus claves locales están separadas por namespace.

Los comandos locales fijan development. Para comprobar un proveedor real hay que optar
expresamente por él:

```bash
APP_ENV=development DEV_PROVIDER_MODE=byok npm --workspace apps/mobile exec -- expo start
```

Sin ese opt-in, development usa fixtures deterministas y no llama a los proveedores.

## Qué se firma y dónde vive el sello

Cada candidato es un JSON canónico `PolicyBundleV1` de hasta 256 KiB que contiene, como
una sola unidad:

- el system prompt y su SHA-256;
- la política sanitaria de runtime y su SHA-256;
- la versión, compatibilidad mínima y tools requeridas;
- `critical`, fecha de emisión e identidad inmutable del bundle.

El «sello» es `policy.bundle.signature.json`: una firma Ed25519 sobre los bytes exactos
de `policy.bundle.json`. Ambos se publican como assets de una GitHub Release inmutable.
La firma incluye el certificado público del firmante, firmado a su vez por la raíz.
Las claves privadas no están en GitHub, Actions, EAS ni el bundle de la app: viven en dos
elementos de Bitwarden. El repositorio contiene solo:

- `policy/signing/trusted-roots.json`: claves raíz públicas;
- `policy/signing/signer-certificate.json`: certificado público del firmante;
- el bundle y su firma públicos;
- la misma raíz pública generada dentro de la app para verificar sin red.

La raíz firma certificados de firmantes; el firmante cotidiano firma bundles y
activaciones. Así puede rotarse o revocarse un firmante sin reutilizar la raíz para cada
publicación. Las raíces antiguas se conservan mientras deban seguir verificándose bundles
aptos para rollback.

## Preparación local de claves

La CLI nunca pide ni imprime la contraseña de Bitwarden. El operador inicia y desbloquea
su propia sesión, crea dos notas seguras vacías, y expone solo sus identificadores al
proceso:

```bash
bw login
export BW_SESSION="$(bw unlock --raw)"
export BITWARDEN_POLICY_ROOT_ITEM_ID="<id de la nota raíz>"
export BITWARDEN_POLICY_SIGNER_ITEM_ID="<id de la nota firmante>"

export BITWARDEN_CLI_JS_ENTRYPOINT="/opt/homebrew/bin/bw" # solo si Homebrew/Tailscale lo requieren

npm run policy:key:init-root -- --key-id gymnasia-policy-root-2026-08
npm run policy:key:init-signer -- \
  --key-id gymnasia-policy-signer-2026-08 \
  --not-after 2027-08-25T00:00:00.000Z
npm run sync:policy-trust
npm run policy:bundle:sign
npm run policy:bundle:check
```

Los campos privados se guardan como ocultos en Bitwarden. `sync:policy-trust` copia solo
las raíces públicas al módulo TypeScript y `check:policy-trust` detecta cualquier deriva.
La inicialización se niega a sobrescribir una nota que ya contenga material de firma.
Para una rotación normal se crea y certifica otro firmante. Cambiar la raíz exige una
actualización de app que incluya la nueva raíz pública antes de depender de ella.

`BITWARDEN_CLI_JS_ENTRYPOINT` es un escape local para instalaciones Homebrew cuya cabecera
abre la CLI con una versión de Node distinta de la soportada. El script ejecuta ese
entrypoint con el mismo Node que ejecuta `npm` y prioriza IPv4. No es un secreto ni se usa
en CI. Si `bw status` funciona normalmente, se omite.

## Arranque único de la primera raíz

La primera raíz plantea una dependencia circular: el workflow confiable no puede verificar
una firma hasta que la raíz pública esté en `main`, pero una raíz todavía no desplegada no
puede validar una PR anterior a ella. La PR inicial de infraestructura se fusiona sin tocar
`prompts/` ni `policy/health-safety/`; después, ya desde ese `main` protegido y solo mientras
no exista ningún deployment firmado schema v3, se permite un único arranque firmado. Los
deployments heredados schema v1/v2 no lo bloquean porque todavía no llevan firmas:

```bash
npm run policy:promote -- --operation staging --bootstrap-main true --reason-code routine-release
npm run policy:promote -- --operation production --reason-code routine-release
```

El workflow exige que el commit sea exactamente el `main` actual y que no exista ningún
deployment previo. En cuanto se publica el primero, `bootstrap_main` queda inutilizado para
siempre y todas las promociones posteriores vuelven a exigir una PR abierta.

## Flujo normal

1. Abrir una PR contra `main` y esperar `prompt-policy` y la autorización del propietario
   sobre su SHA exacto.
2. Si cambian las fuentes de política, incrementar `policy/signing/bundle.config.json` y
   ejecutar `npm run policy:bundle:sign`; el bundle firmado se versiona en la misma PR.
3. Con Bitwarden desbloqueado, lanzar Staging. El comando calcula una secuencia creciente,
   firma fuera de GitHub la activación del canal y envía a Actions únicamente los
   documentos públicos:

   ```bash
   npm run policy:promote -- --operation staging --pr <número> --reason-code routine-release
   ```

4. El workflow verifica PR, autorización, puerta sanitaria, raíz, certificado, firmas,
   tools, protocolo, canal y correspondencia byte a byte con las fuentes. Después del
   environment `Staging`, publica una prerelease con `policy.bundle.json`,
   `policy.bundle.signature.json`, `health-safety-report.json` y
   `promotion-evidence.json`, y registra un deployment schema v3 con la activación
   firmada.
5. Tras probar exactamente ese candidato, promoverlo a Production sin reconstruirlo:

   ```bash
   npm run policy:promote -- --operation production --reason-code routine-release
   ```

6. Production exige el deployment exitoso de Staging, repite la puerta sanitaria,
   comprueba que la secuencia supera todas las anteriores y espera la aprobación del
   environment correspondiente. El check `gymnasia/policy-promotion` se publica sobre el
   commit exacto y la PR se fusiona manualmente.

Toda operación exige uno de estos motivos cerrados: `routine-release`,
`critical-policy-fix`, `incident-response` o `rollback-drill`. No se admite texto libre
en el workflow ni en la CLI. `critical: true` en la configuración del bundle selecciona el environment separado
`Production Critical`; no elimina Staging, la firma, la revisión del propietario ni las
evidencias. Los workflows nunca reciben claves privadas ni secretos de proveedores.

En el dispositivo, una política normal verificada queda pendiente y se activa en el
primer envío de una conversación nueva. Una política crítica se activa al comenzar el
siguiente envío seguro. Cada petición adquiere un único lease inmutable: prompt y
guardrail sanitario proceden del mismo bundle y se conservan durante reintentos y rondas
de tools. Una comprobación manual ignora el TTL de red, pero usa la frontera `background`,
por lo que nunca cambia a mitad de conversación la política que ya estaba activa.

## Rollback autenticado

Un rollback no vuelve a publicar ni modifica un asset. Firma una activación nueva, con
secuencia mayor, que apunta a un bundle histórico que ya estuvo en Production y declara
el bundle actualmente activo:

```bash
npm run policy:promote -- \
  --operation rollback \
  --candidate policy-vAAAA.MM.N-<sha12> \
  --reason-code incident-response \
  --dry-run
```

La previsualización resuelve automáticamente el bundle activo de Production, comprueba
que el destino histórico tuvo deployments correctos en Staging y Production, descarga
y verifica su firma, y muestra candidato, origen y próxima secuencia sin acceder a la
clave privada ni lanzar Actions. Si es correcto, se repite sin `--dry-run`:

```bash
npm run policy:promote -- \
  --operation rollback \
  --candidate policy-vAAAA.MM.N-<sha12> \
  --reason-code incident-response
```

`--rollback-from` sigue aceptándose como comprobación adicional, pero debe coincidir con
el bundle activo resuelto por la CLI. Actions vuelve a verificar firma, historia y
`fromBundleId`. Una simple repetición de un deployment viejo no es un rollback: su
secuencia es menor y la app lo rechaza. El móvil trata toda activación `rollback` como
urgente aunque el bundle histórico tenga `critical: false`, y la aplica al comenzar el
siguiente envío seguro.

## Auditoría operativa y Telegram

El último job del workflow se ejecuta incluso si la validación rechaza la operación. Crea
un deployment separado con task `gymnasia-policy-audit` y payload
`PolicyOperationAuditV1`: operación, resultado, entorno, commit, bundle, actor, motivo,
checks, activación y enlaces. No contiene prompts, mensajes, claves, inputs, outputs ni
datos de salud. Consultar los últimos registros:

```bash
gh api --paginate --slurp \
  'repos/maximofn/gymnasia/deployments?task=gymnasia-policy-audit&per_page=100' \
  | jq 'add | sort_by(.created_at) | reverse | .[:20] | map(.payload)'
```

El mismo job intenta avisar mediante un bot dedicado. Configurar como secrets del
repositorio, nunca en `.env`, en el bundle móvil ni en capturas:

- `POLICY_TELEGRAM_BOT_TOKEN`: token de un bot dedicado exclusivamente a operaciones de
  política.
- `POLICY_TELEGRAM_CHAT_ID`: chat privado o grupo operativo al que ya pertenezca el bot.

El mensaje usa solo la allowlist de metadatos de la auditoría y lleva un `eventId`
determinista. Un reintento no vuelve a enviar un evento que ya conste como enviado. Si
faltan secretos o Telegram falla, el deployment registra `skipped` o `failed` con un
código genérico; la política publicada o rechazada no se revierte ni queda bloqueada por
el canal de avisos.

## Recuperación cuando el último bundle está roto

1. No edites la Release ni repitas su deployment: conserva la evidencia del incidente.
2. Localiza el último candidato anterior que figure correcto en Staging y Production.
3. Ejecuta primero el rollback con `--dry-run` y motivo `incident-response`.
4. Lanza el rollback real, aprueba el environment correspondiente y confirma el
   deployment `gymnasia-policy` y su auditoría `gymnasia-policy-audit`.
5. En un dispositivo afectado, abre Ajustes → Trazas y pulsa «Comprobar actualización».
   Debe aparecer pendiente; se activa al comenzar el siguiente envío seguro.
6. Corrige el bundle en una PR nueva, vuelve a pasar Staging y Production y restáuralo
   mediante una activación nueva. Nunca reduzcas la secuencia ni borres la caché para
   forzar la recuperación.

## Builds y funcionamiento sin red

Production contiene su `EXPO_TOKEN` de environment. Antes de invocar EAS, el workflow
resuelve el deployment Production y ejecuta:

```bash
node scripts/policy-promotion/prepare-policy-snapshot.mjs --environment production
```

El script verifica las firmas y evidencias y genera en el APK el paquete firmado completo,
además de los módulos de prompt y política sanitaria. Si falta un artefacto o no coincide,
la build falla.

En ejecución, la app selecciona en este orden:

1. bundle remoto con activación y firmas válidas y secuencia admisible;
2. copia firmada actual del mismo entorno y canal;
3. segunda copia firmada anterior si la actual se ha corrompido;
4. snapshot firmado integrado en el APK.

Los bundles activo, anterior y pendiente, la mayor secuencia observada y la última
comprobación viven juntos en
`gymnasia.mobile.signed_policy.cache.v1` dentro de AsyncStorage, aislada por variante. Todo
se vuelve a verificar al leerlo. El runtime nunca mezcla el prompt de un candidato con la
política sanitaria de otro. La política sanitaria firmada se fusiona además de forma
monotónica con el guardrail compilado.

Cada respuesta persistida incluye `policy_context` con candidato, versión, hash, fuente,
activación y secuencia. No incluye el prompt. La tarjeta de Ajustes → Trazas muestra
estado activo o pendiente, origen, canal, última comprobación, degradación offline y el
tiempo de propagación observado localmente. No se envían métricas desde los móviles ni se
calculan recuentos de clientes en fallback.

GitHub puede dejar el canal sin actualizaciones, pero no puede fabricar una política que
la app acepte sin la clave firmante. Si la red o GitHub fallan, la app sigue funcionando
con caché o snapshot; no salta a `main`, Staging, otro entorno ni un payload heredado.

Esta implementación corresponde a GYM-140 (ticket para autenticar bundles de política
con firmas verificables, rotación y protección anti-rollback) y GYM-141 (ticket para
añadir rollback, auditoría y alertas de la política).
