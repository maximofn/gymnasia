# Validación del AAB usado para la ficha

Evidencia de GYM-197 (ticket para preparar la ficha española de Google Play).
Las capturas y las declaraciones de Play deben corresponder al artefacto
aceptado de esta página. La comprobación se realizó sobre el AAB descargado, no
solo sobre `app.json` ni sobre un manifest intermedio de Expo.

## Artefacto aceptado

| Campo | Valor validado |
|---|---|
| Build EAS | `7d1f3278-af59-430b-97e2-9da88fc7c4f0` |
| Página persistente | <https://expo.dev/accounts/maximofn/projects/gymnasia/builds/7d1f3278-af59-430b-97e2-9da88fc7c4f0> |
| Commit de código | `24b2d2295236900f76072c28a4dafd946f84cd03` |
| Perfil | `production` / canal `Production` |
| Paquete | `com.maximofn.gymnasia` |
| Versión | `1.20.0` (`versionCode` 14) |
| SDK | mínimo 24; objetivo 36 |
| SHA-256 del AAB | `0d9147fb578d3d2046e5257b1eaec8db4294773b058bc0e6bd743ccb31c8c22b` |
| SHA-256 del certificado de subida | `31:0B:38:39:E4:05:F1:FA:9F:92:09:25:76:7E:6E:E8:42:47:AA:A1:B8:A7:22:59:47:9E:91:9A:48:59:AB:31` |

`bundletool 1.18.3 validate` terminó correctamente. La firma JAR verifica con
el certificado de subida autofirmado de EAS; que ese certificado no forme parte
de la cadena pública de confianza es lo esperado para una clave de subida.

La configuración embebida en `base/assets/app.config` declara
`environment: production`, `channel: Production`, `providerMode: byok` y
actualizaciones OTA desactivadas. El `application` fusionado tampoco declara
`android:debuggable`.

### Permisos sensibles del manifest fusionado

- Presentes y esperados: `CAMERA`, `POST_NOTIFICATIONS`,
  `SCHEDULE_EXACT_ALARM` y `MODIFY_AUDIO_SETTINGS`.
- Ausentes y bloqueados: `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`,
  `USE_EXACT_ALARM` y `REQUEST_INSTALL_PACKAGES`.

## Artefacto descartado

La build EAS `1a26e956-302e-4580-932b-6d06fd721dd4`, versión 1.20.0 y
`versionCode` 13, no debe subirse a Play Console. Su manifest fusionado contenía
`RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW`, aunque la app no graba audio ni dibuja
sobre otras aplicaciones. La corrección que produce el artefacto aceptado
configura `expo-av` con `microphonePermission: false` y bloquea ambos permisos
durante la fusión de manifests.

## Comandos de reproducción

Con el AAB descargado y `bundletool-all-1.18.3.jar` fuera del repositorio:

```bash
shasum -a 256 gymnasia-1.20.0-14-production.aab
/opt/homebrew/opt/openjdk/bin/java -jar bundletool-all-1.18.3.jar validate \
  --bundle=gymnasia-1.20.0-14-production.aab
/opt/homebrew/opt/openjdk/bin/java -jar bundletool-all-1.18.3.jar dump manifest \
  --bundle=gymnasia-1.20.0-14-production.aab --module=base
unzip -p gymnasia-1.20.0-14-production.aab base/assets/app.config
```

Antes de instalar el APK universal de captura, se vuelve a comparar el SHA-256
del AAB con esta página. La clave temporal que firme ese APK vive fuera del
repositorio y se destruye después de la instalación.
