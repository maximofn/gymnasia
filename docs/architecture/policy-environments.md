# Entornos y promoción de políticas

## Variantes instalables

Toda configuración Expo exige `APP_ENV`. No hay valor implícito en builds:

| APP_ENV | Nombre | ID Android/iOS | Canal | IA |
| --- | --- | --- | --- | --- |
| `development` | Gymnasia Dev | `com.maximofn.gymnasia.dev` | `Local` | fixtures |
| `staging` | Gymnasia Staging | `com.maximofn.gymnasia.staging` | `Staging` | BYOK |
| `production` | Gymnasia | `com.maximofn.gymnasia` | `Production` | BYOK |

`preview` extiende `staging` en EAS y sigue produciendo una APK interna. Los
IDs distintos permiten instalar las tres variantes simultáneamente. Las claves
de AsyncStorage y SecureStore se prefijan en development y staging; Production
conserva literalmente las claves históricas para no perder datos existentes.

Los comandos locales de `package.json` fijan development. Para comprobar un
proveedor real en esa variante hay que optar expresamente por él:

```bash
APP_ENV=development DEV_PROVIDER_MODE=byok npm --workspace apps/mobile exec -- expo start
```

Sin ese opt-in, chat, estimadores, listado y verificación de proveedores usan
fixtures deterministas y no alcanzan las ramas HTTP/XHR de OpenAI, Anthropic o
Google.

## Flujo normal

1. Abrir una PR contra `main` y esperar `prompt-policy` y la autorización del
   propietario sobre su SHA exacto.
2. Ejecutar manualmente `Promote policy` con operación `staging` y el número de
   PR. La validación sin permisos de escritura ejecuta exactamente
   `npm run check:health-safety` y genera un informe `authorizing: false`.
3. Tras aprobar el environment `Staging`, se publica una prerelease draft →
   assets → publish con tag `policy-v<version>-<sha12>`. Contiene `policy.md`,
   `health-safety-report.json` y `promotion-evidence.json`, y se crea el
   deployment Staging.
4. Probar el candidato en Staging y ejecutar la operación `production` con el
   mismo tag cuando esté listo. El workflow exige un deployment Staging
   exitoso, repite la puerta sanitaria sobre el mismo contenido y requiere la
   aprobación del environment `Production`, pero no impone una espera fija.
5. El check `gymnasia/policy-promotion` solo pasa cuando Production registra el
   SHA actual. Un commit nuevo vuelve a dejarlo pendiente. Después se fusiona la
   PR manualmente.

`critical=true` etiqueta explícitamente una promoción urgente y usa el
environment separado `Production Critical`. Conserva candidato, SHA, deployment
de staging, propietario, puerta sanitaria y evidencias; no elimina la revisión
del propietario ni permite otro actor.

## Bootstrap inicial

Después de fusionar por primera vez este sistema, todavía no existe un canal que
pueda alimentar la primera build. En esa única situación se ejecuta `Promote
policy` desde el HEAD actual de `main`, con operación `staging`, `pr_number`
vacío y `bootstrap_main=true`.

El workflow exige simultáneamente que se esté ejecutando desde `main`, que el SHA
sea el HEAD remoto actual, que `prompt-policy` esté verde y que no exista ningún
deployment previo con `task=gymnasia-policy`. La condición se comprueba otra vez
en el job privilegiado para cerrar carreras. Tras crear Staging, el mismo
candidato se promueve normalmente a Production. Cualquier intento posterior de
bootstrap falla cerrado.

## Builds y secretos

Staging y Production deben tener cada uno su secreto de environment
`EXPO_TOKEN`; no debe existir un `EXPO_TOKEN` de repositorio. Ningún workflow de
política recibe claves BYOK ni secretos de LLM. Antes de invocar EAS, el workflow
de APK resuelve el deployment activo de su canal y ejecuta:

```bash
node scripts/policy-promotion/prepare-policy-snapshot.mjs --environment staging|production
```

El script falla si no hay deployment, si la release/evidencia no existe o si
algún digest difiere. Una APK interna se conserva como artifact de Actions; solo
Production crea una release APK estable. Las releases de política son
`prerelease`, por lo que `/releases/latest` continúa señalando la última APK.

## Limpieza y caída de GitHub

“Restablecer datos locales” enumera y borra únicamente el namespace activo,
incluidos SecureStore, caché de política y trazas. Desinstalar o limpiar Staging
no afecta a Production gracias a sus IDs y namespaces distintos.

Si GitHub no responde, la app usa la caché v3 válida del mismo canal; sin caché,
usa el snapshot integrado de ese canal. No salta a `main`, a otro environment ni
a una política sin digest. Las trazas y Ajustes muestran entorno, canal,
candidato y los 12 primeros caracteres del hash, nunca prompt o secretos.

Para recuperar una política anterior, se crea un deployment nuevo del canal que
referencia un candidato inmutable anterior. No se edita ni reemplaza la release.
La firma, rotación de claves y protección criptográfica contra rollback quedan
reservadas a GYM-140.
