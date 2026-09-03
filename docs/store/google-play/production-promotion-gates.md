# Gates y evidencia de publicación Android

## Contrato de Production

Una publicación de Gymnasia solo es válida si conserva una transacción y dos
evidencias JSON:

- `AndroidReleaseTransactionV1`: fija versión, tag, commit fuente, perfil, cada
  build ID de EAS y todas las transiciones hasta la validación o sustitución;

- `ProductionSourceEvidenceV1`: identifica el commit de `main`, los controles
  remotos, la versión confirmada y todos los gates ejecutados sobre ese checkout
  exacto.
- `ProductionArtifactEvidenceV1`: enlaza la evidencia anterior con el APK/AAB,
  su versión, firma, manifest fusionado, snapshot de política y SHA-256.

La política ejecutable vive en `scripts/production-release/policy.json`. Los
workflows, scripts y runbooks no deben duplicar sus valores. Las evidencias solo
contienen metadatos operativos; nunca claves, prompts, conversaciones o datos de
usuarios.

## Matriz auditada

| Entrada | Ref admitido | Gate | Environment / perfil | Salida | Destino |
| --- | --- | --- | --- | --- | --- |
| Push que afecta a la app | `refs/heads/main` | versión confirmada + `validate-production` completo | `Production` / `production-apk` | transacción + APK + evidencias | GitHub Release |
| `workflow_dispatch` | Solo `refs/heads/main` | reconciliar la transacción más antigua | `Production` / `production-apk` | reutiliza el build ID; no recompila por cancelación | GitHub Release |
| Build local para Play | HEAD limpio y alcanzable desde `origin/main` | `verify:production-source` completo | `production` | AAB + dos evidencias | Prueba interna |
| Promoción en Play | La release ya validada | Comparar `versionCode`, SHA-256 y certificado | Sin nueva build | El mismo AAB | Interna → cerrada |
| Rollout público | La release cerrada ya validada | Evidencia de pruebas y autorización | Sin nueva build | El mismo AAB | España → más territorios |

El último paso pertenece a GYM-201 (ticket para publicar primero en España y
ampliar después los territorios). Esta auditoría no autoriza a ejecutarlo.

## Controles remotos verificados

Consulta pública realizada el 31 de agosto de 2026:

- el ruleset `Protect main and sensitive policy` está activo sobre la rama por
  defecto, no declara actores de bypass, exige PR y requiere `prompt-policy`,
  `gymnasia/owner-authorization` y `gymnasia/policy-promotion`;
- el environment `Production` admite únicamente ramas protegidas y requiere a
  `maximofn` como aprobador;
- `prevent_self_review` está desactivado de forma deliberada porque el proyecto
  tiene un único responsable de publicación.

El verificador consulta de nuevo estos valores en cada candidata. Un error de
red, permisos o formato no se interpreta como éxito.

## Evidencia no destructiva de la auditoría

El 31 de agosto de 2026 se ejecutaron estas comprobaciones sin crear una build ni
promover una release:

- el verificador real rechazó un checkout con cambios locales mediante la
  violación `dirty`, antes de ejecutar gates o acceder a EAS;
- las 13 pruebas del contrato cubrieron la ruta válida y rechazaron ref
  arbitrario, fork, commit no alcanzable, PR o checks ausentes, ruleset o
  environment degradados, perfil cruzado, evidencia incompleta, tipo de archivo,
  permisos, snapshot y certificado incorrectos; la propiedad generativa confirmó
  que ningún nombre de rama distinto de `main` resulta publicable;
- el export Android con `APP_ENV=production`, el E2E del agente con proveedores
  falsos y el E2E completo de entrenamiento terminaron correctamente;
- como contraste con un binario real, la release pública preexistente `v1.31.2`
  apuntaba al commit `4a21e91c7d977f818f6f9e3939fa62eec0c61387`, declaraba el
  perfil `production-apk` y servía un APK de 102.377.197 bytes cuyo SHA-256
  (`bc49c29d3ad2848235bcc13e733c701210134d6e416aefc7bee4912d69dcdac7`)
  coincidía entre GitHub y la descarga. El ZIP contenía `AndroidManifest.xml` y
  `assets/app.config`; este último declaraba paquete, entorno, canal, proveedor,
  candidato y versión de Production.

Esa release es una línea base anterior al nuevo gate y no se considera evidencia
de que la ruta endurecida haya pasado. La prueba positiva real requiere fusionar
el cambio y aprobar una ejecución de `Production`; se hace por separado porque
consume cuota de EAS.

## Evidencia Production real y reconciliación

La ejecución manual
[`33491087365`](https://github.com/maximofn/gymnasia/actions/runs/33491087365)
del 1 de septiembre de 2026 recorrió el camino autorizado completo para la
versión `1.31.3`: `main`, los 18 gates, aprobación de `Production`, build EAS
`c06852b5-1df7-491b-b57f-6d66768f36ec`, verificación del APK y publicación de
una release inmutable. La auditoría independiente del 3 de septiembre volvió a
descargar sus assets y confirmó:

- commit fuente `e6d2a788556f19f2be1ecc782e632e99b085f045` y PR autorizada;
- APK de 102.377.197 bytes con SHA-256
  `226db60ebfb085791e5ef264eb1b2fc4da81572f4daefd585bc1dae7ba3d9ec5`;
- paquete `com.maximofn.gymnasia`, versión `1.31.3` / `versionCode` 22,
  minSdk 24, targetSdk 36 y certificado de subida aprobado;
- evidencia fuente enlazada correctamente desde la evidencia del artefacto.

La misma auditoría detectó que una reconciliación ya validada conservaba en la
transacción el hash del JSON de artefacto de un intento anterior, mientras el
workflow regeneraba y publicaba ese JSON con otra marca temporal. El APK no
cambió, pero la transacción apuntaba a bytes de evidencia que ya no estaban en
la release. El contrato se endureció para actualizar ese hash solo cuando el APK
y su tamaño siguen siendo idénticos, y para comparar antes de publicar los
digests de GitHub de APK, evidencia de artefacto y evidencia fuente. Una
reconciliación no puede sustituir el APK ya validado.

## Gates reejecutados antes de EAS

`npm run verify:production-source` ejecuta la lista canónica definida en
`PRODUCTION_GATES`. Incluye:

1. política de prompt, promoción firmada y sus pruebas;
2. política sanitaria y pruebas;
3. permisos Android, inventario de datos y política legal;
4. paridad del prompt, suite determinista, OpenWiki y TypeScript;
5. E2E del agente con proveedor falso y E2E de entrenamiento.

La validación sucede en un job sin secrets ni environment. Solo después puede
comenzar el job `build-and-release`, solicitar aprobación de `Production` y leer
`EXPO_TOKEN`.

## Versiones y transacciones duraderas

Todo cambio que entre en el filtro de compilación de `apps/mobile/**` debe llevar
ya confirmada su versión en `apps/mobile/app.json`. `prompt-policy` toma el mayor
valor entre la versión de la base y las releases publicadas, aplica el incremento
Conventional Commits del PR y exige una coincidencia exacta. El workflow de
release no modifica Git ni empuja commits.

La cola `android-production-release` no cancela ejecuciones anteriores. Antes de
consumir cuota, el workflow crea un draft de GitHub y guarda la transacción, la
evidencia fuente y los cuatro módulos del snapshot de política. EAS se invoca con
`--no-wait`; el build ID se adjunta inmediatamente al draft. Si GitHub se cancela
o agota su espera, `operation=reconcile` recupera ese ID, consulta `build:view` y
continúa con el mismo artefacto.

Un estado terminal `ERRORED` o `CANCELED` de EAS deja la versión bloqueada. Solo
`retry-failed` o `supersede-failed`, sobre la versión pendiente más antigua y con
un motivo no vacío, puede avanzar. Las versiones posteriores se procesan en
orden semántico y la siguiente se encola únicamente después de publicar o
sustituir la anterior.

## Build local reproducible para Google Play

Requisitos: checkout limpio, Node 22, dependencias instaladas, Android SDK/JDK,
EAS autenticado y `bundletool-all-1.18.3.jar` fuera del repositorio.

Desde la raíz:

```bash
npm ci
npm run verify:production-source -- \
  --profile production \
  --artifact-type aab \
  --output /tmp/gymnasia-production-source.json

npm run prepare:policy-snapshot -- --environment production

cd apps/mobile
npm exec --yes --package eas-cli@latest -- eas build \
  --platform android \
  --profile production \
  --local \
  --output /tmp/gymnasia.aab
cd ../..

npm run verify:production-artifact -- \
  --artifact /tmp/gymnasia.aab \
  --published-filename gymnasia.aab \
  --kind aab \
  --source-evidence /tmp/gymnasia-production-source.json \
  --snapshot apps/mobile/agent/generated/policySnapshot.generated.json \
  --bundletool /ruta/privada/bundletool-all-1.18.3.jar \
  --output /tmp/gymnasia-production-artifact.json
```

Aunque la build falle, restaura los cuatro módulos temporales del snapshot antes
de continuar. La validación inicial garantiza que estaban limpios:

```bash
git restore -- \
  apps/mobile/agent/generated/chatSystemPrompt.generated.ts \
  apps/mobile/agent/generated/healthSafetyPolicy.generated.ts \
  apps/mobile/agent/generated/policySnapshot.generated.json \
  apps/mobile/agent/generated/signedPolicySnapshot.generated.ts
```

No subas el AAB si falta cualquiera de las dos evidencias o si alguna declara
`result: failed`.

## Promoción y registro en Play Console

El operador crea la release solo en Prueba interna. Para pasar a Prueba cerrada
usa la acción de promoción de esa misma release; nunca vuelve a invocar EAS.
Registra en la evidencia del ticket o PR:

- aplicación, track, release ID y fecha;
- `versionName`, `versionCode`, SHA-256 y certificado de subida;
- actor que promovió y aprobador;
- enlace o captura sin datos privados;
- resultado del smoke y del informe de pre-lanzamiento.

Antes de reutilizar la evidencia histórica debe resolverse una discrepancia: la
descripción de GYM-198 (ticket para generar y validar el AAB de producción)
menciona versión 1.28.0 / `versionCode` 12, mientras `aab-validation.md` fija
1.20.0 / `versionCode` 16. La fuente autoritativa será el artefacto que figure
actualmente en Play Console, contrastado con su página EAS y SHA-256; no se dará
por correcto ninguno de los dos valores por memoria.
