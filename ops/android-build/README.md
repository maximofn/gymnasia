# Android en wallabot

**Estado: primer APK local firmado, verificado y probado en Android; flujo sin activar.** La prueba
del 14-09-2026 compiló `production-apk` y verificó el resultado en otra VM limpia,
sin credenciales: versión 1.43.2, versionCode 56 y firma de producción existente.
Se mantuvo el candidato inmutable de la prueba; no incorpora los cambios de la
release posterior 1.43.3. El APK no se publicó. El mantenedor confirmó el
14-09-2026 que lo instaló en su Android y funciona bien.
La auditoría de la imagen ampliada pasó permisos, toolchain, red privada y
descarte de overlays tras éxito, cancelación, caída de QEMU y timeout. También
tras la build y su verificación se mantuvieron base, listeners y estado del host;
se eliminaron los temporales con credenciales. No apareció una build cloud en
el intervalo de este reintento local. El workflow cloud de main sigue activo
hasta fusionar la migración. La prueba real de registro temporal y retirada
también pasó. La reversión de transacciones se ensayó sin red; quedan la
provisión automática por trabajo y su validación con el workflow completo
antes de activar el cambio.

`build-apk.yml` conserva la selección de candidato, validación, borrador,
verificación y publicación en GitHub. Solo `compile-android` usa
`[self-hosted, linux, x64, wallabot, android-build]`, en una VM KVM desechable.
Los tres pasos con efectos conservan el environment `Production` y sus
aprobaciones. El runner tiene `contents: read`; nunca recibe un token para
publicar releases.

## Preparar el host (intervención administrativa)

Los scripts se ejecutan **desde este directorio, en wallabot**, después de
revisarlos. No son instrucciones para ejecutar código de una PR en el host.

```bash
sudo bash install-host.sh
sudo bash bake-image.sh
sudo python3 audit-image.py
```

El primero instala QEMU 8.2.2 del paquete Ubuntu
`1:8.2.2+ds-0ubuntu1.18` y `cloud-image-utils` 0.33-1, crea una cuenta de sistema
sin login y deja la unidad apagada. No instala libvirt, Docker ni reglas de red.
Compara listeners, forwarding y unidades fallidas antes y después. Conserva la
evidencia administrativa bajo `/var/tmp/gymnasia-host-install.*`. Si falla un
check final, inspeccionar esa evidencia antes de continuar; no retirar paquetes
compartidos ni tocar Docker para resolverlo.

El segundo crea la imagen sin credenciales, en la misma jaula de systemd que
usarán las builds. No registra ni activa un runner. Solo conserva la imagen si
el instalador del guest termina correctamente y QEMU verifica el disco. La
imagen Ubuntu fechada, Node, Java, herramientas Android y runner tienen hashes
en `downloads.json`. El nombre oficial del ZIP Android termina en `_latest.zip`,
pero **13114758 y su SHA-256 son fijos**; no se resuelve un alias dinámico.
Muestra las fases por la consola y apaga la VM si falla la instalación. Conserva
el diagnóstico sin credenciales, accesible solo a root, en
`/var/tmp/gymnasia-image-evidence.*`; elimina el disco temporal también si se
interrumpe. Comprueba listeners, forwarding y unidades fallidas al terminar.
No inicia la preparación si wallabot tiene activo su bloqueo de mantenimiento.

La VM tiene 4 vCPU, 16 GiB de RAM y 120 GiB de disco virtual. El host limita el
proceso a 4 CPU, 18 GiB, sin swap, 512 tareas y dos horas. Usa SLIRP saliente,
sin interfaces TAP, puentes, puertos reenviados, directorios compartidos o GPU.
La CPU enmascara `svm` y `vmx`: usar `-cpu host` sin esas exclusiones hacía que
el kernel del guest creara `/dev/kvm` para virtualización anidada.
El filtro de systemd bloquea loopback, redes privadas, Tailscale y todo IPv6.
La imagen usa DNS públicos directamente porque el resolvedor del host también
está bloqueado. El instalador exige cgroup v2/BPF; la prueba real de aislamiento
sigue siendo obligatoria, un fichero de configuración no la sustituye.

`audit-image.py` comprueba el hash de la base y arranca cuatro overlays sin
credenciales. El primero verifica como `runner` permisos, toolchain, recursos,
ausencia de dispositivos/directorios compartidos y rechazo de conexiones a
servicios privados que ya respondían en el host. No abre puertos ni sondea otras
máquinas. Los siguientes prueban cancelación, caída de QEMU y timeout de 90 s,
conservando el hook de limpieza de la unidad real. Cada arranque comprueba que
el marcador del anterior desapareció; al terminar repite hash y estado del
host. Conserva evidencia privada en `/var/tmp/gymnasia-audit.*`. No registra
el runner ni accede a la firma; tampoco ejecuta el workflow cloud de reversión.

Ubuntu rechaza desinstalar `sudo` si root no tiene contraseña. El instalador
usa `SUDO_FORCE_REMOVE=yes` solo dentro de esta VM desechable, que conserva las
cuentas bloqueadas y no permite login. Sin esa variable, la preparación falla
al retirar `sudo`, aunque las descargas y la red funcionen correctamente.

El cierre se ejecuta en una unidad separada, después de que termine cloud-init.
Solo entonces se comprueba su resultado, se limpia su estado y machine-id y se
apaga con la ruta absoluta de systemctl. El PATH de la toolchain no incluye
`/usr/sbin`: invocar `poweroff` por nombre dejaba la VM encendida; limpiar
cloud-init desde su propio script también rompía la escritura de su estado final.

## Toolchain

`toolchain.json` es la lista comprobada antes de compilar: Node 22.23.1,
npm 10.9.3, Temurin 17.0.20.1, EAS CLI y plugin local 24.3.0, plataforma Android
36, build-tools 36.0.0 y 35.0.0, platform-tools 37.0.1, NDK 27.1.12297006,
command-line-tools 19.0 y CMake 3.22.1.
React Native 0.81.5 del lockfile exige plataforma 36, build-tools 36.0.0 y ese
NDK; coincide con la referencia de Expo SDK 54. Node 22 está por encima de su
mínimo y permite conservar la familia usada por los controles de GitHub.

El primer diagnóstico nativo encontró un requisito adicional: aunque el
proyecto raíz declara build-tools 36.0.0, módulos de Expo piden 35.0.0 y el SDK
necesita platform-tools. Gradle intentaba instalarlos en el SDK de solo lectura
y fallaba en `:expo:generateReleaseRFile`. Se fijan ambas versiones de
build-tools y se instala platform-tools desde su ZIP numerado y SHA-256,
contrastado con el tamaño/checksum del manifiesto oficial de Google. No se
permite al runner modificar el SDK para resolverlo.

`sudo bash bake-image.sh --extend-clean-base` añade esos paquetes a un overlay
de la base limpia verificada, sin firma ni checkout. Conserva la base anterior
y solo sustituye la vigente después de sellar/comprobar el nuevo disco. Nunca
parte del overlay de una build. Después hay que repetir `audit-image.py` y la
compilación de prueba. `run-smoke.py` admite `diagnose`: prebuild y compilación
de fuentes Release sin tareas de firma ni credenciales, con diagnóstico acotado.

Las versiones se instalan dentro de la VM; EAS local ignora los campos de
toolchain de `eas.json`. La imagen no tiene sudo, SSH, Docker, GPU ni KVM
expuesto al guest. `runner` no es administrador. Las herramientas y el hook
de admisión son de root; el checkout, cachés y temporales son desechables.
Los TAR de Node/Java se extraen con `--no-same-owner` y se normaliza el
propietario de toda la toolchain: conservar el UID del archivo de Node lo
asignaba a `runner` (UID 1000). La auditoría recorre los archivos como ese
usuario y rechaza cualquier directorio o herramienta que pueda modificar.

## Firma y contador

Se mantienen `appVersionSource: remote`, `autoIncrement: true` y las
credenciales administradas actuales. La compilación **sí sigue necesitando
cuenta Expo y EXPO_TOKEN** para proyecto, contador y firma; no usa capacidad de
compilación de EAS. `--freeze-credentials` impide generar o cambiar claves.
No ejecutar la primera consulta de firma sin la intervención del mantenedor.
Si se decide exportarla, hacerlo puntualmente, fuera de Git y con modo 0600;
nunca guardar keystore, contraseñas o logs en artifacts.

Línea base consultada el 13-09-2026: release `v1.43.2`, package
`com.maximofn.gymnasia`, versionCode 53, APK SHA-256
`1e38cbb4d932a67379994984db80ac7e39c2ebfd973ac31583642d0329bed164`.
Su evidencia pública declara el certificado
`310b3839e405f1fa9f920925767e6ee84247aaa1b8a72259479e919a4859ab31`, coincidente
con `policy.json` y con el certificado extraído del bloque de firma del APK
público. La verificación nativa del primer APK local confirmó la misma huella,
package, permisos, sonidos y snapshot, sin infracciones. El APK mide 102.670.309
bytes y su SHA-256 es
`61b268643b1333e0aaaba1db01a459c3f60512a149bcf9ad80c706a87802109b`.
Su versionCode 56 supera el 55 de la última release pública, `v1.43.3`, cuya
evidencia se volvió a descargar y contrastar antes del reintento. La fuente de
esta prueba sigue siendo `c9fd7ea27849881c80b64262d2f7fe62201df125` (1.43.2).
En cada release se descarga de nuevo la evidencia del último APK,
se valida su digest de GitHub y se exige un versionCode superior; 53 no es un
contador nuevo ni un valor fijado en el código.

## Activación pendiente: completar en orden

1. Instalar y hornear la VM sin credenciales. Registrar estado y pruebas en la
   documentación privada de wallabot, coordinando cambios con su securización.
2. Comprobar dentro del guest que HTTPS público funciona y que no se alcanzan
   SSH del host, gateway, LAN, tailnet, servicios de IA o sockets Docker.
   Verificar ausencia de montajes compartidos, GPU y permisos administrativos;
   comprobar después que listeners, forwarding y unidades fallidas del host
   coinciden con la línea base.
3. Preparar un checkout del SHA de main validado por `verify:production-source`,
   con los mismos cuatro ficheros del snapshot de Production. Con intervención
   del mantenedor para la credencial, ejecutar en la VM un `production-apk`
   **sin publicar ni registrar todavía el runner**:

   ```bash
   APP_ENV=production eas build --platform android --profile production-apk \
     --local --non-interactive --freeze-credentials --output /tmp/gymnasia.apk
   ```

   `first-build.py INPUTS CREDENTIAL_FILE` prepara una prueba manual con cuatro
   VMs consecutivas: transferencia de datos de prueba, verificación nativa del
   APK público anterior, compilación firmada y verificación del nuevo APK en un
   overlay limpio sin credencial. Requiere ejecutar con sudo desde tmux y haber
   autorizado previamente el acceso a la firma. No registra un runner ni publica.
   Los inputs fijan el SHA validado y los cuatro archivos exactos del snapshot;
   se contrastan con los hashes de los assets públicos de la release.

   El archivo de credencial debe ser privado (0600). El controlador lo consume y
   borra al empezar; guarda temporalmente la petición de build en `/run`, con
   permisos solo para root. El token se entrega por un descriptor conectado de
   QEMU, separado del seed y del registro de consola, y solo se añade al entorno
   del proceso EAS. No se incorpora a Git, cloud-init ni evidencia. El overlay
   y la petición se eliminan al terminar, incluso si QEMU falla. Un marcador
   impide repetir automáticamente un intento firmado: investigar y documentar
   el motivo antes de preparar otra prueba; nunca reutilizar un versionCode.

   `smoke-channel.py` usa un socketpair anónimo y un puerto virtio serie. No abre
   listeners, puertos de red, montajes ni un intérprete de órdenes para el guest.
   El receptor solo acepta un informe de hasta 64 KiB y un binario de hasta
   256 MiB, con destinos fijos y creación exclusiva. No analiza ni monta el
   disco del guest. Los bytes quedan en cuarentena hasta que otro overlay
   ejecuta el verificador nativo y comprueba el incremento de versión y ambas
   firmas. Los tests del transporte cubren tamaños excesivos, truncamiento,
   integridad binaria, escrituras parciales y rechazo de archivos/symlinks
   existentes. El emisor espera un saludo del guest antes de transferir datos:
   enviar antes de que virtio abra el puerto dejó la primera prueba bloqueada.
   Las escrituras sin búfer pueden aceptar solo parte del bloque y deben
   repetirse hasta completarlo. Las cuatro fases reales ya pasaron: transferencia,
   verificación del APK público, build firmada y verificación nativa del APK local.
   Al interrumpir el controlador, este espera la limpieza del subproceso antes
   de cerrar su salida y eliminar sus archivos privados.
   La consola serie puede contener secuencias UTF-8 incompletas. Solo al leer
   ese registro se reemplazan bytes inválidos; los marcadores ASCII y las
   comprobaciones de identidad, estado y limpieza siguen siendo obligatorios.
4. Ejecutar todos los `PRODUCTION_GATES`, `verify:production-artifact`, contrastar
   firma con el último APK real y comprobar package, versión, permisos, sonidos,
   snapshot y hashes. Comparar el inventario de builds de Expo antes/después en
   el panel; no debe aparecer una build remota. La prueba puede consumir un
   versionCode, que no debe reutilizarse ni decrecer.
5. Ensayar destrucción de una VM y recuperación desde la imagen limpia,
   incluyendo cancelación y límite de tiempo, y revisar la reversión indicada
   abajo. Dejar la instalación en un Android físico como comprobación humana.
6. Solo entonces obtener el token temporal de registro con intervención del
   mantenedor. Registrar **dentro de un overlay nuevo**, con `--ephemeral`,
   `--disableupdate` y `--labels wallabot,android-build`, sin `--replace`. No
   introducir el token en historial, logs ni en la imagen base. No usar `svc.sh`
   en el host. El servicio `gymnasia-runner.service` del guest ejecuta `run.sh`
   como `runner` y apaga la VM al terminar; `admit-job.sh` rechaza cualquier job
   ajeno a `compile-android` del workflow canónico en main antes del checkout.
7. Revisar/fusionar la PR y activar ese único runner. El ciclo de provisión por
   trabajo y la entrega segura del token efímero se terminarán y probarán antes
   de esta activación; no se instala un PAT permanente en wallabot por defecto.
   No dejar un runner persistente como sustituto de ese ciclo. Al fijar
   `--disableupdate`, renovar y probar la imagen cuando GitHub exija una
   actualización del runner (normalmente dentro de los 30 días de una release).

## Prueba del registro temporal: verificada y retirada

Antes de activar el workflow, `registration-control.py`, `registration-host.py`
y el modo `register-probe` prueban el registro y la retirada de una identidad
efímera. **No arrancan `run.sh` ni ejecutan jobs.** El 14-09-2026, con autorización
expresa del mantenedor, el registro real pasó y su identidad se retiró de
GitHub. El estado final fue `verified-and-removed`, con cero runners en el
repositorio. Se comprobó la eliminación de credenciales, peticiones, overlay
y seed, la VM apagada y la imagen base y configuración del host sin cambios.

1. Tras la autorización expresa del mantenedor, ejecutar **en el Mac**, con la
   sesión de GitHub existente:

   ```bash
   python3 ops/android-build/registration-control.py prepare \
     --authorized-registration /ruta/privada/intento-nuevo
   ```

   Crea un intento exclusivo, pide una sola vez el token temporal y escribe
   `request.json` con modo 0600. El diario `attempt.json` solo contiene identidad
   y estado. No reintenta la emisión si se pierde la respuesta. La credencial
   administrativa de GitHub permanece en el Mac; solo viaja el token temporal.
2. Transferir `request.json` y `empty.bin` a un directorio privado en wallabot,
   confirmar sus hashes y borrar la copia local de `request.json`. Conservar
   `attempt.json` en el Mac para verificar y retirar la identidad después.
   Ejecutar en el tmux de wallabot, desde el paquete revisado:

   ```bash
   sudo python3 registration-host.py /ruta/privada/inputs
   ```

   El controlador rechaza un intento ya usado, crea el overlay sin credenciales
   en el seed y entrega el token por el canal limitado ya auditado. El runner
   2.337.0 recibe `ACTIONS_RUNNER_INPUT_TOKEN` en su entorno; no en argumentos.
   Registra con `--ephemeral --disableupdate`, nombre aleatorio y etiquetas
   `wallabot,android-build`, sin sustituir identidades. Comprueba `.runner`, borra
   la identidad RSA y todo el directorio de runner y apaga la VM. El host repite
   las comprobaciones de limpieza, base y red. Solo expone el informe sin secretos.
3. Copiar ese `report.json` al Mac y terminar desde allí:

   ```bash
   python3 ops/android-build/registration-control.py finish \
     /ruta/privada/intento-nuevo --report /ruta/privada/report.json
   ```

   La lista y la consulta individual de GitHub deben confirmar el mismo
   ID/nombre, las etiquetas esperadas y estado offline, sin job. El guest
   comprueba el modo efímero y las actualizaciones desactivadas en `.runner`,
   además de la versión del binario fijado. Si GitHub expone versión o modo
   efímero, también deben coincidir; la API real omitió ambos campos. El diario
   distingue el origen de cada comprobación. Solo se elimina la identidad
   reservada por este intento y se comprueba su ausencia. El informe del guest no elige el ID que
   se borra. Si falló el guest o no llegó un informe, `finish` sin `--report`
   retira esa identidad inactiva y marca el intento fallido. Nunca retira un
   runner ocupado o conectado. Si se pierde la respuesta del borrado, repetir
   `finish` reconcilia el mismo intento sin emitir otro token ni registrar de nuevo.

El primer intento registró la identidad, pero el verificador rechazó el BOM
UTF-8 que el runner escribe al guardar `.runner`. Se retiró esa identidad y se
documentó el motivo antes de repetir con otro intento. La lectura usa ahora
`utf-8-sig`, conservando las comprobaciones estrictas de JSON e identidad.
El reintento con esta corrección pasó; no se inició ningún job en ninguno de
los dos intentos.

Once pruebas sin red verifican caducidad, destino fijo, exclusión de otros
secretos, limpieza tras error, emisión única, comparación con GitHub, negativa
a borrar runners activos, lectura de BOM, campos omitidos o contradictorios
de la API y recuperación de una respuesta perdida:
`python3 ops/android-build/registration-test.py`. Pasan en el Mac y wallabot; la prueba
real descrita arriba también pasó. Esta fase no instala un
servicio de provisión automática ni guarda un PAT permanente en wallabot.

## Transacción y fallos

Antes de que el runner reciba el trabajo, el draft conserva un intento
`wallabot-local` con ID `github-RUN-ATTEMPT-SHA`, versión, perfil, toolchain e
inputs inmutables. El APK y sus metadatos se transfieren como un artifact de
Actions, con nombre específico del intento. El verificador administrado
comprueba los bytes en cuarentena, compara la identidad del intento y la firma,
y solo después adjunta el APK al draft y verifica la cadena de hashes.

Reconciliar un intento terminado reutiliza ese artifact de Actions (30 días de
retención), nunca recompila. Si el intento quedó a medias y su ejecución anterior
ya terminó, se registra como fallido y se exige `retry-failed` o
`supersede-failed` con motivo. Se conserva todo el historial. No usar el botón
genérico de reejecutar jobs como sustituto de esa decisión.

Si el APK ya está validado y falla la publicación, conservar esos bytes y
reconciliar. No sustituir el binario ni autorizar otro build. Si caduca el
artifact de Actions, recuperar exactamente el asset del draft y verificar su
hash mediante intervención manual. No borrar el draft para desbloquear la cola.

Los registros de EAS quedan privados dentro del guest y se destruyen al salir.
El workflow borra checkout y temporales; el host elimina overlay y seed también
si el guest se bloquea o excede el límite. `clean-current.sh` solo borra los dos
ficheros fijos del trabajo, conservando la imagen base sin credenciales.

## Reversión

1. Deshabilitar el runner en GitHub y parar `gymnasia-android-vm.service`; el
   overlay y su seed se destruyen. Conservar la imagen base y sus hashes hasta
   verificar la recuperación. No retirar paquetes compartidos de wallabot.
2. Si hay un intento local en ejecución, esperar a su estado final o marcarlo
   fallido con motivo mediante `fail-local` y guardar esa transacción en su
   draft. No convertir su ID en un build ID remoto. Un intento local validado
   se publica/reconcilia con sus mismos bytes antes de cambiar de backend.
3. Restaurar **solo** `.github/workflows/build-apk.yml` desde
   `ops/android-build/build-apk.eas-cloud.yml` mediante PR revisada; conservar
   los scripts de transacciones compatibles con ambos backends. El archivo de
   respaldo no vive en `.github/workflows/` y no ejecuta builds automáticamente.
4. Para una versión fallida, usar `retry-failed`, la versión exacta y un motivo
   que documente el regreso a EAS. Se añade un intento `eas-cloud` conservando
   fuente, snapshot, historial, credenciales y contador. Esto volverá a consumir
   cuota de Expo: requiere decisión explícita del mantenedor.

No eliminar el proyecto Expo ni sus credenciales. El cambio propuesto no toca
`prompts/` ni `policy/health-safety/`.

Revisión del 14-09-2026: el respaldo coincide con el workflow cloud vigente en
main salvo por EAS CLI, fijado a 24.3.0 en vez de `latest`. Los tests ensayan el
paso de un fallo local a un intento cloud con motivo, conservando SHA, versión,
perfil e historial; también rechazan convertir un APK local validado en otra
build. Son simulaciones de transacción: no han lanzado una build cloud ni
publicado una release. La limpieza y recuperación de la VM sí se probaron en
el servidor mediante éxito, cancelación, caída y timeout.

## Fuentes y validación

- [EAS local y sus limitaciones](https://docs.expo.dev/build-reference/local-builds/)
- [Infraestructura oficial de Expo, SDK 54](https://docs.expo.dev/build-reference/infrastructure/)
- [Contador remoto de versiones](https://docs.expo.dev/build-reference/app-versions/)
- [Hooks antes y después del job](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts)
- [Registro temporal de runners por repositorio](https://docs.github.com/en/rest/actions/self-hosted-runners#create-a-registration-token-for-a-repository)
- [Lectura y enmascarado del token en runner 2.337.0](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Listener/CommandSettings.cs)
- [Escritura UTF-8 de la configuración del runner](https://github.com/actions/runner/blob/v2.337.0/src/Runner.Sdk/Util/IOUtil.cs)
- [Limpieza de cloud-init para una imagen base](https://docs.cloud-init.io/en/latest/reference/cli.html#clean)

Pruebas de código: `npm run test:production-release`. Los tests deterministas no
certifican la VM, el aislamiento efectivo, la firma real ni la instalación.
