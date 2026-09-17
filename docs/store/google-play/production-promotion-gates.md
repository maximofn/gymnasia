# Publicación Android: wallabot, GitHub y Play Interno

## Resultado del flujo

GYM-226 (ticket para automatizar la subida a Google Play) convierte cada cambio
publicable de `main` en una sola transacción con dos binarios de la misma versión:

- wallabot compila primero `gymnasia.aab` con `production` y después
  `gymnasia.apk` con `production-apk`;
- el AAB se envía automáticamente al track `internal` con estado `completed`;
- ambos binarios se adjuntan a la misma GitHub Release;
- la Release permanece como borrador hasta que AAB, APK y submission estén
  validados.

La promoción de esa release desde Play Interno a pruebas cerradas o producción
es manual. El workflow no envía notas de versión a Google Play: EAS Submit para
Android no ofrece ese campo. El resumen automático de commits queda en GitHub y
en el resumen de Actions.

## Puerta humana y credenciales

La aprobación humana de `Production` se conserva. El orden es:

1. `validate-production` ejecuta una vez todos los gates sobre el commit exacto;
2. `prepare-production` crea el borrador durable y reserva la transacción, pero
   no tiene credenciales ni capacidad de compilar;
3. `compile-android` es el único job que referencia el environment `Production`:
   espera una sola aprobación y únicamente entonces wallabot recibe el trabajo;
4. con los dos artefactos validados, `Play Internal` ejecuta la subida sin un
   segundo aprobador.

`Production` y `Play Internal` tienen cada uno su propio secreto `EXPO_TOKEN`.
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
- `play`: proveedor EAS, perfil `production`, track `internal`, estado
  `completed`, intención, submission ID, estado y error saneado.

Los estados globales son `prepared`, `building`, `artifacts-validated`,
`submitting`, `validated`, `failed` y `superseded`. Los assets finales son:

- `gymnasia.aab` y `production-aab-evidence.json`;
- `gymnasia.apk` y `production-apk-evidence.json`;
- `production-play-evidence.json`;
- `production-source-evidence.json`;
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

Tras la primera ejecución real, verificar:

1. el AAB aparece en Play Interno con el código esperado;
2. un tester lo instala desde Play y completa el smoke test;
3. el APK está disponible en GitHub;
4. hashes, versiones, intentos de wallabot, submission ID, track y resultado
   aparecen en la Release y el resumen del workflow.

Solo después se cierra GYM-226 (ticket para automatizar la subida a Google
Play), se coordina el resultado con GYM-199 (ticket para validar el AAB en
pruebas internas y cerradas) y se sincroniza el tablero. Promover a cerrada o
producción reutiliza el mismo AAB y requiere una decisión humana.
