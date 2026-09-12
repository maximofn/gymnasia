# Contrato de configuración nativa Android

Gymnasia no versiona `apps/mobile/android/`. Ese directorio es un resultado de
`expo prebuild`, no una fuente editable: conservarlo en Git duplicaría decisiones
que ya viven en `app.json`, `app.config.ts` y los plugins de Expo.

El riesgo de ese enfoque es que una actualización de Expo o de una dependencia
pueda cambiar silenciosamente el manifest, `MainActivity` o los recursos nativos.
El contrato de `scripts/android-native-config/` cierra esa brecha sin guardar una
copia completa del proyecto Android.

## Qué se comprueba antes de compilar

`npm run check:android-native-config` hace una copia temporal de `apps/mobile`,
ejecuta un prebuild limpio con `APP_ENV=production` y elimina la copia al terminar.
La ejecución no instala dependencias ni escribe en el checkout.

El resultado se compara semánticamente con
`scripts/android-native-config/policy.json`:

- conjunto exacto de permisos declarados en el manifest fuente;
- conjunto exacto de directivas `tools:node="remove"`;
- atributos de entrada, orientación y navegación de `MainActivity`;
- marcadores de la implementación estándar de back de React Native y Expo;
- conjunto exacto de sonidos `.wav` generado en `res/raw`;
- ausencia de advertencias de prebuild no aprobadas.

No se compara el árbol Android entero. Así, un cambio cosmético del generador no
obliga a aceptar una instantánea opaca; una decisión con efecto real sí exige
actualizar una lista corta y explicar por qué.

## Fuentes declarativas

Los sonidos se definen una sola vez en
`apps/mobile/notifications/notificationSounds.json`. De ese catálogo salen la lista
de preferencias, las opciones de la interfaz, los `require` estáticos y la
configuración del plugin `expo-notifications`.

La política de permisos publicables vive en
`scripts/android-permissions/policy.json`. `FOREGROUND_SERVICE` no está permitido:
Gymnasia no implementa ningún servicio en primer plano. Los permisos bloqueados
siguen generando directivas de retirada en el manifest fuente.

## Qué se comprueba después de compilar

`npm run verify:production-artifact` inspecciona el manifest fusionado del APK o
AAB. Exige el conjunto completo y exacto de permisos revisado a partir de la
release 1.42.0, ya sin `FOREGROUND_SERVICE`, y comprueba que los cinco sonidos
estén realmente empaquetados. La evidencia `ProductionArtifactEvidenceV1` guarda
ambas listas para que la revisión posterior no dependa del log del workflow.

En un APK, la comprobación lee la tabla de recursos compilada con `aapt2` y busca
los nombres lógicos `raw/ascending`, `raw/beep`, etc. No se basa en los nombres
físicos del ZIP: Android puede ofuscarlos como `res/7M.wav` durante la
optimización aunque el recurso lógico y su contenido sigan intactos. En un AAB,
que conserva las rutas declarativas, se comprueban las entradas `base/res/raw/`.

El workflow conserva dos revisiones separadas: compila y acredita el commit
inmutable de la transacción, pero ejecuta el controlador de publicación desde el
SHA protegido de `main` que lanzó el workflow. Una corrección del verificador
puede así volver a examinar un APK ya terminado sin alterar ni recompilar su
código fuente.

Esta segunda capa es necesaria porque las dependencias pueden añadir permisos
durante el manifest merger aunque no aparezcan en `app.json` ni en el manifest
fuente generado por Expo.

## Actualizar el contrato de forma segura

1. Cambia primero la fuente declarativa o la dependencia que motiva el cambio.
2. Ejecuta `npm run check:android-native-config` y lee la desviación concreta.
3. Si el nuevo resultado es intencionado, actualiza la lista mínima afectada en
   `scripts/android-native-config/policy.json` o
   `scripts/android-permissions/policy.json` y documenta el motivo.
4. Si cambia un permiso, actualiza también
   `scripts/data-inventory/inventory.json`, recorre
   `docs/legal/privacy-change-checklist.md` y revisa las declaraciones de Play.
5. Ejecuta:

   ```bash
   npm run test:android-native-config
   npm run check:android-native-config
   npm run test:android-permissions
   npm run check:android-permissions
   npm run test:production-release
   npm run check:data-inventory
   npm run test:data-inventory
   npm run check:legal
   npm run test:legal
   npm --workspace apps/mobile exec tsc --noEmit
   ```

6. Tras fusionar, genera un artefacto Production y repite la prueba real de los
   cinco sonidos y de la navegación atrás en un Android físico. Una prueba web o
   un prebuild correcto no sustituyen esa comprobación.
