# Publicación Android, Play Interno y recuperación

## Resultado automático

Cada cambio publicable de `apps/mobile/**` que llega a `main` abre una única
transacción Android y produce dos binarios de la misma versión:

- `gymnasia.aab`, construido con el perfil EAS `production` y enviado a Google
  Play, track `internal`, con estado `completed`;
- `gymnasia.apk`, construido después con `production-apk` y publicado en la
  misma GitHub Release.

El AAB reserva el `versionCode` mediante `autoIncrement: true`. El APK usa
`autoIncrement: false`, lee el valor remoto recién reservado y debe declarar el
mismo `versionName` y `versionCode`. La Release permanece en borrador hasta que
ambos binarios y la submission de EAS están verificados. Las promociones desde
Play Interno a pruebas cerradas o producción son decisiones manuales y no
reconstruyen el AAB.

Los filtros del workflow no cambian: scripts, Markdown, tests y `public/` no
crean una versión. La cola `android-production-release` procesa las versiones
en orden y nunca cancela la anterior.

## Contrato de evidencia

La Release conserva estos assets:

- `AndroidReleaseTransactionV2`: commit, versión, referencia mínima de
  `versionCode`, estados y todos los intentos de las patas `aab`, `apk` y
  `play`;
- `ProductionSourceEvidenceV2`: una sola ejecución de todos los gates que
  autoriza conjuntamente `production/aab` y `production-apk/apk`;
- `ProductionArtifactEvidenceV2`, una por binario: build EAS, perfil, firma,
  manifest fusionado, configuración, snapshot de política, versiones, tamaño y
  SHA-256;
- `ProductionPlayEvidenceV1`: AAB enviado, submission EAS, perfil `production`,
  track `internal`, estado `completed`, resultado y error saneado;
- los dos binarios y el snapshot inmutable de política.

La CLI sigue leyendo transacciones V1 de releases históricas. Un borrador V1
activo se bloquea para resolución manual: no contiene información suficiente
para añadir un AAB y una submission sin romper la trazabilidad.

## Controles antes de construir

`validate-production` trabaja sin secretos y ejecuta una vez la lista canónica
`PRODUCTION_GATES` sobre el SHA exacto. Verifica:

1. que el commit pertenece a `main`, procede del repositorio oficial y conserva
   su PR y checks obligatorios;
2. que el ruleset de `main` sigue activo y sin bypass;
3. que `Production` continúa limitado a ramas protegidas y requiere la revisión
   de `maximofn` para promociones posteriores;
4. que `Play Internal` está limitado a ramas protegidas y no tiene aprobadores,
   porque este track es automático;
5. políticas, permisos, configuración nativa, inventario de datos, texto legal,
   TypeScript, export Android y E2E deterministas.

Solo el job posterior entra en el environment `Play Internal` y puede leer su
`EXPO_TOKEN`. El token da acceso a EAS; la cuenta de servicio de Google se
custodia en las credenciales Android de EAS y nunca se copia a GitHub, al
repositorio ni al bundle.

## Adopción idempotente

Antes de solicitar cada build, el workflow pagina `eas build:list` y compara
perfil, versión, commit y un mensaje de intento único. Antes de enviar el AAB,
pagina `eas submit:list` y adopta solo una submission cuyo
`submittedBuild.id`, track y estado de release coincidan. La conciliación usa
`eas build:view` y `eas submit:view`.

Un corte después de crear un build o submission no autoriza a repetirlo. El
workflow vuelve a consultar EAS, persiste el ID encontrado en el borrador y
continúa. Si no puede determinar si la petición llegó a EAS, termina con un
mensaje accionable y deja el borrador intacto.

Los estados globales son `prepared`, `building`, `artifacts-validated`,
`submitting`, `validated`, `failed` y `superseded`. Un `ERRORED` o `CANCELED`
deja bloqueadas las versiones siguientes:

```bash
gh workflow run build-apk.yml --ref main \
  -f operation=retry-failed \
  -f target_version=<X.Y.Z> \
  -f reason="<causa confirmada y acción tomada>"
```

El reintento reutiliza los IDs sanos. Si la pata fallida es Play, usa
`eas submit:retry`; un build terminal necesita un intento nuevo con mensaje
distinto. Para abandonar una versión rota, `main` debe declarar antes una
versión posterior:

```bash
gh workflow run build-apk.yml --ref main \
  -f operation=supersede-failed \
  -f target_version=<X.Y.Z fallida> \
  -f reason="<por qué no debe publicarse>"
```

Nunca se salta una versión fallida automáticamente.

## Referencia de `versionCode`

Antes de la primera ejecución de V2, abre Play Console y toma el mayor
`versionCode` realmente presente para `com.maximofn.gymnasia`. Guárdalo como
variable de repositorio, no como secret:

```bash
gh variable set PLAY_VERSION_CODE_FLOOR \
  --repo maximofn/gymnasia \
  --body '<mayor versionCode de Play Console>'
```

El workflow exige que ambos binarios superen el máximo entre esa referencia y
la última evidencia V2 publicada. Un valor igual o menor aborta antes del envío.
No uses valores recordados de tickets o documentos históricos: solo Play
Console es la referencia inicial autoritativa.

## Configuración única de credenciales

### GitHub

En Settings → Environments crea `Play Internal` con estas propiedades:

- deployment branches: `Protected branches only`;
- sin required reviewers ni wait timer;
- secret `EXPO_TOKEN` dedicado al envío interno.

`Production` no se modifica: conserva su aprobación humana para acciones de
promoción. El verificador remoto aborta si cualquiera de los dos environments
deriva de este contrato.

### EAS y Google Play

1. Crea una cuenta de servicio de Google dedicada a Gymnasia y concédele solo
   los permisos necesarios sobre esa aplicación.
2. Desde `apps/mobile`, ejecuta `eas credentials --platform android` con EAS CLI
   24.3.0 y sube la clave en la sección de credenciales de submission.
3. Confirma con `eas submit:list --platform android --limit 1 --json` que la
   cuenta de EAS puede consultar submissions.
4. Elimina cualquier copia local temporal de la clave. No la guardes en `.env`,
   Actions ni documentación.

El perfil está fijado en `apps/mobile/eas.json`. EAS Submit no admite notas de
versión Android; el resumen automático de commits se publica deliberadamente
en GitHub Release y en el resumen del workflow.

## Verificación de artefactos

El workflow descarga bundletool 1.18.3 únicamente desde su release oficial y
comprueba antes de ejecutarlo este SHA-256:

```text
a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29
```

Para cada binario comprueba tipo, límites de tamaño, MIME, paquete, min/target
SDK, permisos exactos, sonidos nativos, configuración Production, snapshot,
firma, `versionName` y `versionCode`. El AAB se valida además con bundletool y
`jarsigner`; el APK con `apkanalyzer`, `aapt2` y `apksigner`.

La Release solo se publica cuando GitHub confirma los digests de AAB, APK y las
cuatro evidencias, la transacción está `validated` y EAS devuelve
`FINISHED` para la submission.

## Promoción manual

Tras la publicación automática:

1. instala desde Play Interno con una cuenta tester y completa el smoke test;
2. contrasta `versionName`, `versionCode`, build ID, submission ID y hashes con
   la GitHub Release;
3. registra esa evidencia en GYM-199 (ticket para validar el AAB en pruebas
   internas y cerradas);
4. promueve el mismo artefacto a pruebas cerradas solo tras la decisión humana;
5. la promoción a producción y el despliegue territorial siguen su propio gate.

No vuelvas a construir al promocionar. La identidad que se probó es la que debe
llegar al siguiente track.

## Prueba real de cierre

La implementación de GYM-226 (ticket para automatizar la subida a Google Play)
no queda validada de extremo a extremo hasta que, después de configurar las
credenciales y autorizar expresamente la fusión que dispara EAS:

- Play Interno muestra el AAB con el código esperado;
- un tester lo instala y supera el smoke test;
- la Release contiene también el APK;
- hashes, versiones e IDs coinciden en la Release y el resumen de Actions.
