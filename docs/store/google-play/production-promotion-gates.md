# Publicación Android: wallabot, GitHub y Prueba cerrada Alpha

## Resultado del flujo

GYM-226 (ticket para automatizar la subida a Google Play) convierte cada cambio
publicable de `main` en una sola transacción con dos binarios de la misma versión:

- wallabot compila primero `gymnasia.aab` con `production` y después
  `gymnasia.apk` con `production-apk`;
- el AAB se envía automáticamente al track `alpha` (Prueba cerrada) con estado
  `completed`, para que los testers cerrados reciban cada build publicable;
- ambos binarios se adjuntan a la misma GitHub Release;
- la Release permanece como borrador hasta que AAB, APK y submission estén
  validados.

El grupo `gymnasia-cerrada-2026-08` de 14 testers es el destinatario de las
actualizaciones. Cada tester debe estar en la lista y haberse unido a la prueba
cerrada con la misma cuenta de Google que usa en Play; estar en la lista no basta.
La disponibilidad efectiva puede esperar la revisión de Google. No se cambia a
los testers al canal interno, pues eso los excluiría de la prueba cerrada.

La promoción de esa release a producción sigue siendo manual. El workflow no
envía notas de versión a Google Play: EAS Submit para Android no ofrece ese
campo. El resumen automático de commits queda en GitHub y en Actions.

## Puerta humana y credenciales

La aprobación humana de `Production` se conserva. El orden es:

1. `validate-production` ejecuta una vez todos los gates sobre el commit exacto;
2. `prepare-production` crea el borrador durable y reserva la transacción, pero
   no tiene credenciales ni capacidad de compilar;
3. `compile-android` es el único job que referencia el environment `Production`:
   espera una sola aprobación y únicamente entonces wallabot recibe el trabajo;
4. con los dos artefactos validados, el environment histórico `Play Internal`
   ejecuta la subida a `alpha` sin un segundo aprobador.

`Production` y `Play Internal` tienen cada uno su propio secreto `EXPO_TOKEN`.
El nombre `Play Internal` del environment se conserva para no mover ni exponer
su secreto; ya no indica el track de destino.
El token de `Production` permite a wallabot leer el proyecto, el contador remoto
y las credenciales Android. El de `Play Internal` se usa exclusivamente para
EAS Submit. La cuenta de servicio de Google se guarda en las credenciales
Android de EAS, con acceso limitado a Gymnasia; su clave no entra en GitHub, en
el repositorio, en la VM ni en el bundle.

Configuración única antes de activar el workflow:

```bash
# GitHub → Settings → Environments → Play Internal → Environment secrets
# Crear EXPO_TOKEN sin cambiar los revisores de Production.

# Desde apps/mobile, con una sesión Expo autorizada:
eas credentials --platform android
# Seleccionar las credenciales de envío y cargar la cuenta de servicio de Google.

# GitHub → Settings → Secrets and variables → Actions → Variables
# PLAY_VERSION_CODE_FLOOR = mayor versionCode real visible en Play Console
```

`Play Internal` debe admitir únicamente ramas protegidas y no tener aprobadores.
`Production` sigue admitiendo únicamente ramas protegidas y conserva a
`maximofn` como aprobador. La guía oficial para la cuenta de servicio está en
[EAS Submit para Android](https://docs.expo.dev/submit/android/).

## Contrato y evidencias

Las publicaciones nuevas usan `AndroidReleaseTransactionV2`. Las Releases V1
históricas siguen siendo legibles, pero no se crean transacciones V1 nuevas.
La V2 conserva tres patas independientes:

- `aab`: perfil `production`, intentos de wallabot, hash, tamaño, evidencia y
  `versionCode`;
- `apk`: perfil `production-apk`, los mismos datos y el mismo `versionCode`;
- `play`: proveedor EAS, perfil `production`, track `alpha` para transacciones
  nuevas (`internal` sigue siendo legible para Releases históricas), estado
  `completed`, intención, submission ID, estado y error saneado.

Los estados globales son `prepared`, `building`, `artifacts-validated`,
`submitting`, `validated`, `failed` y `superseded`. Los assets finales son:

- `gymnasia.aab` y `production-aab-evidence.json`;
- `gymnasia.apk` y `production-apk-evidence.json`;
- `production-play-evidence.json`;
- `production-source-evidence.json`;
- `production-google-play-receipt.json`, con el hash y el canal consultados a Google;
- `android-release-transaction.json`;
- snapshot, bundle de política y referencia de versión usados por la build.

`ProductionSourceEvidenceV2` autoriza conjuntamente `production/aab` y
`production-apk/apk`; los gates no se repiten por artefacto. Cada verificador
comprueba commit, versión, paquete, firma, permisos, configuración nativa,
snapshot, sonidos y hash. El AAB se valida además con bundletool 1.18.3, cuyo
SHA-256 obligatorio es
`a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.

## `versionCode`

`apps/mobile/eas.json` fija EAS CLI 24.3.0 y usa el contador remoto de Expo.
`production` tiene `autoIncrement: true`: la build local del AAB reserva el
siguiente código. `production-apk` tiene `autoIncrement: false`: la build local
posterior reutiliza el código ya reservado.

Antes de enviar se exige que ambos binarios tengan el mismo `versionName` y
`versionCode`. Ese código debe superar el máximo entre:

- `PLAY_VERSION_CODE_FLOOR`, tomado de Play Console;
- el último `versionCode` acreditado en una Release publicada.

Un código repetido o decreciente aborta. Un intento que ya consumió un código
puede dejar un hueco; nunca se reutiliza ni se reduce el contador.

## Aislamiento de wallabot

`compile-android` es el único job self-hosted. Corre en una VM KVM desechable con
las etiquetas `wallabot` y `android-build`, permisos GitHub de solo lectura y la
toolchain fijada en `ops/android-build/toolchain.json`. EAS se invoca con
`--local --non-interactive --freeze-credentials`: Expo no aporta capacidad de
compilación y no se crea un build remoto.

Los binarios salen de la VM como artifacts de Actions sin confianza. Un runner
administrado vuelve a inspeccionarlos antes de adjuntarlos al borrador. La VM
borra checkout, temporales y logs privados al terminar.

## Envío por ruta y prevención de duplicados

Una build local no tiene EAS build ID. Por eso el envío usa:

```bash
eas submit --platform android --profile production \
  --path /ruta/gymnasia.aab --non-interactive --no-wait
```

Antes de ejecutar ese comando se guarda una intención derivada del SHA-256 del
AAB y su `versionCode`. En cuanto EAS devuelve un submission ID, se guarda en el
borrador y todos los estados posteriores se consultan con `eas submit:view`.

La API que usa `eas submit:list` no expone el hash ni la versión del archivo en
los envíos hechos con `--path`; `submittedBuild` puede ser nulo. Por tanto, si el
proceso se corta después de la petición pero antes de conservar el ID, no existe
una comparación suficientemente fuerte para repetir automáticamente. La
transacción queda `uncertain` y bloquea otra subida.

Para recuperar ese caso, localizar el submission exacto en Expo y adoptarlo:

```bash
eas submit:list --platform android --limit 50 --offset 0 --json
# Repetir con offset 50, 100… si hace falta, y confirmar fecha, app y track.

gh workflow run build-apk.yml --ref main \
  -f operation=adopt-submission \
  -f target_version=1.45.0 \
  -f submission_id=<ID_CONFIRMADO> \
  -f reason=
```

El workflow adopta el ID, ejecuta `eas submit:view` y continúa sin volver a
subir el AAB.

## Fallos y recuperación

La cola `android-production-release` procesa una versión cada vez. Un fallo
definitivo conserva el borrador y bloquea versiones posteriores.

```bash
# Reconciliar un build o submission conocido, sin crear otro
gh workflow run build-apk.yml --ref main \
  -f operation=reconcile -f target_version= -f reason= -f submission_id=

# Reintentar la pata fallida con motivo
gh workflow run build-apk.yml --ref main \
  -f operation=retry-failed -f target_version=1.45.0 \
  -f reason="credencial reparada" -f submission_id=

# Sustituir una transacción fallida; main debe declarar una versión posterior
gh workflow run build-apk.yml --ref main \
  -f operation=supersede-failed -f target_version=1.45.0 \
  -f reason="la fuente requiere una versión corregida" -f submission_id=
```

Si el AAB o APK ya está validado, `retry-failed` conserva esos bytes y recompila
solo la pata fallida. Si existe un submission fallido con ID, usa
`eas submit:retry`; no vuelve a cargar el AAB. Un submission activo se sigue
consultando. Un estado incierto sin ID exige la adopción manual anterior.

Nunca se borra el borrador para desbloquear la cola, se pulsa un rerun genérico
como sustituto de estas operaciones ni se salta silenciosamente una versión.

## Promoción y cierre

Tras cada ejecución real, verificar:

1. el AAB aparece en Prueba cerrada Alpha con el código esperado y está
   disponible para el grupo de 14 una vez termine la revisión de Google;
2. un tester cerrado lo actualiza desde Play y completa el smoke test;
3. el APK está disponible en GitHub;
4. hashes, versiones, intentos de wallabot, submission ID, track y resultado
   aparecen en la Release y el resumen del workflow.

Solo después se cierra GYM-226 (ticket para automatizar la subida a Google
Play), se coordina el resultado con GYM-199 (ticket para validar el AAB en
pruebas internas y cerradas) y se sincroniza el tablero. Promover a producción
requiere una decisión humana.

## Comprobación de los bytes enviados y recibidos

Antes de crear una intención de envío, el controlador vuelve a leer el AAB
descargado del borrador y compara su tamaño y SHA-256 con la transacción y con
`production-aab-evidence.json`. También comprueba la cadena hasta la evidencia
de fuente y sus gates. `eas-submit.mjs submit` repite esta comprobación y exige
los tres ficheros de evidencia: una ruta y un token no bastan para enviarlo.

La confirmación `FINISHED` de Expo no acredita por sí sola los bytes que recibió
Google. Una vez terminado el submission, `google-play-receipt.mjs` consulta el
bundle por `versionCode` y el track `alpha` en Google Play. Solo acepta el mismo
SHA-256 y una release `completed`. El recibo se incorpora a la evidencia de Play
y se conserva también como asset independiente. Si Google no responde, devuelve
otro hash o no conserva esa versión en Alpha, la release de GitHub sigue siendo
borrador; la recuperación consulta el submission existente, sin subir de nuevo.

El verificador usa `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, secreto del environment
`Play Internal`, con la clave de la misma cuenta de servicio auditada que usa
EAS. No se le concede acceso a producción ni permisos globales. Antes de enviar,
el workflow comprueba que Google acepta esa credencial. La clave y el token OAuth
solo están en memoria y nunca se escriben en assets ni en logs. No pegar el JSON
en el repositorio ni en el chat. Desde un fichero privado existente:

```bash
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --repo maximofn/gymnasia \
  --env 'Play Internal' < /ruta/privada/clave-existente.json
```

La API de Google requiere abrir un `edit` para leer los bundles: es una copia
temporal, no una publicación. El verificador no modifica tracks, no sube archivos
y nunca hace `commit`; descarta su edit incluso cuando la comparación falla.
Solo corre con el submission en `FINISHED`, dentro de la cola serial de releases.
No ejecutar una operación manual simultánea con esa cuenta: abrir otro edit
invalidaría el suyo. La CLI local permite verificar una transacción ya terminada:

```bash
node scripts/production-release/google-play-receipt.mjs \
  --transaction /ruta/android-release-transaction.json \
  --service-account-file /ruta/privada/clave-existente.json \
  --output /ruta/production-google-play-receipt.json
```

Fuentes del contrato: [bundles y SHA-256](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles),
[lectura de bundles](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.bundles/list)
y [aislamiento y duración de edits](https://developers.google.com/android-publisher/edits).

## Matriz de publicación y frontera del propietario

Auditoría de GYM-225 (ticket para impedir publicaciones de Production sin las
pruebas y autorización acordadas), realizada el 12 de octubre de 2026.
`Production` es la variante y el environment de build; no significa que el track
público `production` de Google Play esté habilitado.

| Camino | Ref, environment y perfil | Destino | Control obligatorio |
|---|---|---|---|
| Merge o push publicable | PR a `main`, `Production`, AAB `production` + APK `production-apk` | GitHub y Alpha | Ruleset sin bypass, autorización y política de la PR, 20 gates sobre el commit, aprobación humana, verificación de ambos binarios y recibo de Google |
| `workflow_dispatch` | Solo `refs/heads/main`; misma transacción y perfiles | GitHub y Alpha | Misma puerta; retry/reconcile conservan commit, código y binarios, no admiten ref arbitrario |
| Build local en wallabot | Fuente exacta de la transacción, VM desechable, mismos perfiles | Artifacts en cuarentena | Gates antes de compilar, firma, snapshot, manifest, permisos, versión y hash antes de subir; nueva comparación justo antes de EAS |
| Build independiente o EAS directo | No es una vía de publicación autorizada | Ninguno | Usar el workflow en `main`; una build aislada no hereda ni sustituye autorización o evidencias |
| Promoción manual entre tracks | AAB ya validado, mismo `versionCode` | Track elegido en Play | Procedimiento del propietario indicado abajo; Play no ejecuta los checks de GitHub |

El ruleset activo de `main` exige PR y `prompt-policy`,
`gymnasia/owner-authorization`, `gymnasia/policy-promotion`; no tiene actores de
bypass. Suite determinista, type-check, salud, permisos Android y E2E se repiten
antes de publicar, aunque no sean checks obligatorios para el merge. Production
admite solo ramas protegidas, exige a `maximofn` y no permite bypass de admins.
El propietario puede aprobar su propia build: es el responsable autorizado.

Play Console tenía exactamente dos usuarios: el propietario, con todos los
permisos, y `gymnasia-play-submit@gymnasia-play-review.iam.gserviceaccount.com`.
El servicio tiene cuatro permisos de Gymnasia: lectura de información, lectura
de calidad, publicación en pruebas y gestión de canales/testers. No tiene
permisos de cuenta, administrador o publicación en producción. La cuenta Expo
es personal; la pantalla de miembros no permite añadir colaboradores sin
convertirla en organización.

**Frontera de confianza:** el propietario de Google Play conserva control total
y puede operar directamente en esa plataforma. GitHub no puede impedirlo ni
exigir sus pruebas allí. El contrato prohíbe usar esa vía para subir binarios
nuevos de Production: la única operación manual autorizable es promover el
artefacto validado, conservando las evidencias. No se afirma que una instrucción
operativa sea un bloqueo técnico del propietario. Tampoco se amplían los permisos
del servicio de envío para automatizar el track público.

### Promoción manual sin recompilación

1. Esperar a una transacción `validated`, con AAB, APK, evidencia de fuente,
   evidencia de Play y recibo de Google publicados. Los históricos anteriores a
   esta comprobación necesitan generar primero el recibo de Google; no basta
   con copiar el hash de la transacción.
2. Registrar la decisión explícita del propietario: tag, commit, `versionCode`,
   SHA-256 del AAB, track de origen/destino y países autorizados. El alcance
   inicial es España; ampliar territorios requiere la decisión contemplada por
   GYM-201 (ticket para publicar primero en España y ampliar después territorios).
3. Usar en Play el bundle existente de ese `versionCode`, mediante promoción o
   selección de biblioteca. No recompilar ni subir otro archivo en ese paso.
4. Antes de confirmar, comprobar código de versión, origen, destino y países;
   conservar la captura y la referencia a la release. La aprobación de un build
   en GitHub no autoriza por sí sola publicar en el canal público.
5. Tras la operación, conservar la evidencia visible del track de destino y su
   mismo `versionCode`, vinculada al recibo del bundle original. La firma de
   distribución de Play puede diferir de la firma de subida: comparar el AAB
   original, no el APK regenerado por Google.

Esta última operación no se ejecutó en la auditoría: Google aún no había
habilitado producción ni prueba abierta, y el menú de promoción las mostraba
desactivadas. El panel ya marcaba cumplidos los requisitos de al menos 12 testers
durante 14 días y permitía **solicitar** acceso. No se solicitó ni se publicó.

### Evidencias y límites de cierre

- [Release 1.51.0](https://github.com/maximofn/gymnasia/releases/tag/v1.51.0):
  fuente `f38755747371e932cd9385234637b908e3156e45`, `versionCode` 86, 20 gates
  aprobados y hashes de las evidencias coincidentes con los digests de GitHub.
- [Submission de Expo](https://expo.dev/accounts/maximofn/projects/gymnasia/submissions/94490a64-e2cb-4c16-8319-d5e32edd7cf3):
  terminado; Play Console mostraba 1.51.0/86 disponible en Alpha, con un país.
- [Recibo consultado directamente a Google](evidence/production-google-play-receipt-1.51.0.json),
  12 de octubre de 2026, 19:47 UTC: confirma `versionCode` 86, track Alpha
  `completed` y SHA-256 `da0e58b92952b03a48daaaac413cffd35992388b6414f62ce21b03e65edbd34a`,
  idéntico al AAB validado. El edit temporal fue descartado; no se publicó nada.
- Las regresiones reproducen sin credenciales ni red el envío sin evidencia, la
  sustitución de bytes, la huella recibida incorrecta, el track no completado y
  fallos de consulta/limpieza. Las propiedades generan hashes y archivos distintos.
- Validación local de la implementación: `npm run test:production-release`,
  71/71; `npm --workspace apps/mobile run test:deterministic -- --maxWorkers=2`,
  966/966; `npm --workspace apps/mobile exec -- tsc --noEmit`, correcto;
  `npm run check:prompt-policy`, `npm run check:data-inventory` y
  `npm run check:legal`, correctos. Se limitó la concurrencia de la suite móvil
  tras un timeout de cifrado bajo carga, sin cambiar la prueba ni sus límites.
- Privacidad: se recorrió `docs/legal/privacy-change-checklist.md`. Los hosts y
  credenciales nuevos son operativos, fuera del bundle; no cambian datos, destinos,
  permisos ni almacenamiento de `apps/mobile`, raíz del inventario. No corresponde
  modificar inventario de datos personales ni política legal por este cambio.
- **Pendiente antes del cierre:** configurar la clave existente en el environment
  con autorización explícita para enviarla a GitHub, revisar/fusionar la PR y
  actualizar el plan de pruebas del ticket con esa evidencia. Una promoción real
  a producción sigue pendiente del acceso de Google y de autorización explícita;
  no se debe marcar como probada por disponer de tests simulados.
