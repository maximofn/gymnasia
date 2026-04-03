---
name: build-apk
description: Generar un APK de Android para instalar en dispositivos fisicos. Usa esta skill cuando el usuario quiera crear un APK, compilar la app para Android, generar un build de preview, instalar la app en un movil Android, o cuando mencione "apk", "build android", "compilar android", "generar apk", "instalar en movil", "build preview", "eas build" o "crear apk".
---

# Build APK (Android)

Genera un APK instalable de `apps/mobile` usando EAS Build (Expo Application Services).

## Requisitos previos

1. **Cuenta de Expo** autenticada:
   ```bash
   npx eas-cli whoami
   ```
   Si no esta autenticada:
   ```bash
   npx eas-cli login
   ```

2. **EAS CLI** instalado (viene como dependencia del proyecto, pero si falta):
   ```bash
   npm install -g eas-cli
   ```

3. **Proyecto configurado** en Expo con `projectId` en `apps/mobile/app.json`:
   ```json
   "extra": {
     "eas": {
       "projectId": "939caf71-3ed8-49a4-a3e9-d60c2a8da194"
     }
   }
   ```

## Perfiles de build en `eas.json`

El fichero `apps/mobile/eas.json` tiene tres perfiles:

| Perfil | Uso | Tipo de artefacto |
|--------|-----|-------------------|
| `development` | Development client con dev tools | `.apk` (dev client) |
| `preview` | APK instalable para testing | `.apk` |
| `production` | AAB para Google Play Store | `.aab` |

Para generar un **APK instalable** usar siempre el perfil `preview`.

**Importante**: el perfil `preview` debe tener `"buildType": "apk"` en la seccion `android`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Si falta `android.buildType`, EAS genera un `.aab` por defecto que no se puede instalar directamente en el dispositivo.

## Generar el APK

### 1. Verificar el estado del proyecto

```bash
cd apps/mobile && npx expo config --type public
```

Confirmar que `sdkVersion`, `android.package` y `extra.eas.projectId` son correctos.

### 2. Lanzar el build remoto

```bash
cd apps/mobile && npx eas-cli build --platform android --profile preview --non-interactive
```

Flags utiles:
- `--non-interactive`: no pide confirmaciones (ideal para CI o scripts).
- `--local`: build local en vez de cloud (requiere Android SDK + JDK instalados).
- `--clear-cache`: fuerza clean build si hay problemas de cache.

### 3. Monitorear el build

EAS devuelve un Build ID al lanzar. Para consultar el estado:

```bash
cd apps/mobile && npx eas-cli build:view <BUILD_ID> --json
```

O listar los builds recientes:

```bash
cd apps/mobile && npx eas-cli build:list --platform android --limit 5
```

### 4. Descargar el APK

Cuando el build termina, EAS imprime la URL del artefacto. Para descargarlo:

```bash
curl -L "<APK_URL>" -o /tmp/gymnasia-preview.apk
```

Tambien se puede descargar desde el dashboard de Expo: `https://expo.dev/accounts/<owner>/projects/gymnasia/builds`.

### 5. Instalar en el dispositivo

#### Opcion A: ADB (dispositivo conectado por USB)

```bash
adb install /tmp/gymnasia-preview.apk
```

#### Opcion B: Transferir el APK

Enviar el `.apk` al movil (Drive, Telegram, email, etc.) y abrirlo desde el gestor de archivos. Requiere habilitar "Instalar desde fuentes desconocidas" en Android.

## Build local (sin cloud)

Si prefieres compilar localmente sin usar los servidores de EAS:

```bash
cd apps/mobile && npx eas-cli build --platform android --profile preview --local
```

Requisitos adicionales para build local:
- **Java JDK 17** (`java -version`)
- **Android SDK** con Build Tools y platform API level adecuados
- **ANDROID_HOME** configurado en el entorno

## Problemas frecuentes

| Problema | Causa | Solucion |
|----------|-------|----------|
| `Not logged in` | Sesion de EAS expirada | `npx eas-cli login` |
| Build genera `.aab` en vez de `.apk` | Falta `buildType: "apk"` en eas.json | Anadir `"android": { "buildType": "apk" }` al perfil `preview` |
| `Invalid projectId` | app.json desactualizado | Verificar `extra.eas.projectId` en `apps/mobile/app.json` |
| Build falla por dependencias nativas | Modulo nativo incompatible | Verificar que todos los plugins estan en `app.json > plugins` |
| `SDK version mismatch` | eas.json o app.json con SDK viejo | Alinear versiones con `npx expo install --check` |
| APK no se instala en dispositivo | Firma conflictiva con version anterior | Desinstalar la app anterior antes de instalar la nueva |
| Build local falla | Falta Android SDK o JDK | Instalar JDK 17 + Android SDK y configurar `ANDROID_HOME` |

## Validaciones pre-build

Antes de lanzar un build, ejecutar:

```bash
# Type-check
npm --workspace apps/mobile exec tsc --noEmit

# Verificar que el bundle compila
cd apps/mobile && npx expo export --platform android --dev
```

## Notas

- Los builds en cloud de EAS son gratuitos con limites (30 builds/mes en plan free).
- El APK generado con perfil `preview` incluye el bundle JS y no requiere Metro/Expo Go.
- Para subir a Google Play Store, usar el perfil `production` que genera `.aab`.
