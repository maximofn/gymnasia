# Android en wallabot

**Estado: preparado para revisión, sin activar.** No fusionar el cambio del
workflow ni registrar el runner hasta completar la prueba firmada y la auditoría
de aislamiento. No se ha ejecutado todavía ninguna build local en wallabot.

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
El filtro de systemd bloquea loopback, redes privadas, Tailscale y todo IPv6.
La imagen usa DNS públicos directamente porque el resolvedor del host también
está bloqueado. El instalador exige cgroup v2/BPF; la prueba real de aislamiento
sigue siendo obligatoria, un fichero de configuración no la sustituye.

Ubuntu rechaza desinstalar `sudo` si root no tiene contraseña. El instalador
usa `SUDO_FORCE_REMOVE=yes` solo dentro de esta VM desechable, que conserva las
cuentas bloqueadas y no permite login. Sin esa variable, la preparación falla
al retirar `sudo`, aunque las descargas y la red funcionen correctamente.

## Toolchain

`toolchain.json` es la lista comprobada antes de compilar: Node 22.23.1,
npm 10.9.3, Temurin 17.0.20.1, EAS CLI y plugin local 24.3.0, plataforma Android
36, build-tools 36.0.0, NDK 27.1.12297006, command-line-tools 19.0 y CMake 3.22.1.
React Native 0.81.5 del lockfile exige plataforma 36, build-tools 36.0.0 y ese
NDK; coincide con la referencia de Expo SDK 54. Node 22 está por encima de su
mínimo y permite conservar la familia usada por los controles de GitHub.

Las versiones se instalan dentro de la VM; EAS local ignora los campos de
toolchain de `eas.json`. La imagen no tiene sudo, SSH, Docker, GPU ni KVM
expuesto al guest. `runner` no es administrador. Las herramientas y el hook
de admisión son de root; el checkout, cachés y temporales son desechables.

## Firma y contador

Se mantienen `appVersionSource: remote`, `autoIncrement: true` y las
credenciales administradas actuales. La compilación **sí sigue necesitando
cuenta Expo y EXPO_TOKEN** para proyecto, contador y firma; no usa capacidad de
compilación de EAS. `--freeze-credentials` impide generar o cambiar claves.
No ejecutar la primera consulta de firma sin la intervención del mantenedor.
Si se decide exportarla, hacerlo puntualmente, fuera de Git y con modo 0600;
nunca guardar keystore, contraseñas o logs en artifacts.

Línea base consultada el 13-09-2026: release `v1.43.1`, package
`com.maximofn.gymnasia`, versionCode 52, APK SHA-256
`be2dde6f6834d12d0918770533a7be9f54d5f6998070daac4ebedb036dd05474`.
Su evidencia pública declara el certificado
`310b3839e405f1fa9f920925767e6ee84247aaa1b8a72259479e919a4859ab31`, coincidente
con `policy.json`. **Falta comparar los certificados extraídos de ambos APK
reales**. En cada release se descarga de nuevo la evidencia del último APK,
se valida su digest de GitHub y se exige un versionCode superior; 52 no es un
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

   La transferencia segura de esta prueba y su evidencia aún está pendiente de
   validar. Nunca montar en el host el disco de un guest que haya ejecutado
   código de un job; extraer ficheros con una herramienta aislada o usar una
   subida saliente limitada a esos archivos, sin credencial de publicación.
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

## Fuentes y validación

- [EAS local y sus limitaciones](https://docs.expo.dev/build-reference/local-builds/)
- [Infraestructura oficial de Expo, SDK 54](https://docs.expo.dev/build-reference/infrastructure/)
- [Contador remoto de versiones](https://docs.expo.dev/build-reference/app-versions/)
- [Hooks antes y después del job](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/run-scripts)

Pruebas de código: `npm run test:production-release`. Los tests deterministas no
certifican la VM, el aislamiento efectivo, la firma real ni la instalación.
