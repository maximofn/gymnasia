---
type: concepto
title: Integración retirada de VivaGym y distribución manual de APK
description: Estado de la retirada temporal de VivaGym, guía de reintroducción y frontera entre Google Play y los APK manuales de Production.
tags: [integrations, vivagym, releases, security]
---

# Integración retirada de VivaGym y distribución manual de APK

La vinculación de cuentas y el QR de acceso de VivaGym están retirados de todas las variantes por GYM-192 (ticket para retirar temporalmente VivaGym de la versión pública). `apps/mobile/App.tsx` ya no contiene pestaña, autenticación, endpoints, credenciales de aplicación, solicitudes ni representación de QR, y `react-native-qrcode-svg` no forma parte de las dependencias.

La única huella de ejecución son los nombres `vivagym.email` y `vivagym.password` en `apps/mobile/legacySecureStorage.ts`. Una versión anterior pudo guardar valores bajo esas claves en Expo SecureStore. La versión retirada no los lee, escribe ni transmite durante el arranque o el uso normal; una actualización dentro del mismo package name los conserva y «Restablecer datos locales» los elimina. No existe transferencia entre las aplicaciones de development, staging y production.

El protocolo investigado y los riesgos de la implementación anterior se conservan en `docs/research/GYM-6-vivagym-qr.md` como contexto histórico, no como autoridad de ejecución.

## Reintroducción de VivaGym

No basta con recuperar el código anterior. Antes de volver a publicarla:

1. Confirmar por escrito el encaje autorizado y revisar los términos vigentes de VivaGym/MyVitale.
2. Reutilizar exactamente `vivagym.email` y `vivagym.password` mediante `scopedSecureStoreKey`, sin transferirlas entre package names ni incluirlas en copias de seguridad.
3. Resolver GYM-154 (ticket para endurecer solicitudes, validación y persistencia de VivaGym) y GYM-155 (ticket para proteger secretos y códigos QR de VivaGym) antes de habilitar el flujo para usuarios.
4. Restaurar la UI, el transporte y la representación de QR como un módulo aislado; añadir validación, timeout, cancelación, control de concurrencia, redacción y protección de capturas desde el principio.
5. Volver a declarar el endpoint y el tratamiento de datos en el inventario, la política, las declaraciones y la ficha de la tienda.
6. Pasar el contrato determinista, E2E nativo y la inspección del artefacto de Production, verificando que ningún valor personal o de prueba se distribuye.

## Distribución manual de APK

La aplicación no contiene un actualizador propio en ninguna variante. No consulta
`/releases/latest`, no compara su versión con GitHub, no ofrece una pestaña ni un
aviso de actualización y no abre enlaces de descarga de APK. La variante de producción
recibe sus actualizaciones exclusivamente mediante Google Play.

La marca heredada `gymnasia.mobile.lastUpdateCheck` solo aparece en la lista de
limpieza de AsyncStorage para retirarla de instalaciones antiguas; no se lee ni se
vuelve a escribir. Android bloquea `REQUEST_INSTALL_PACKAGES` para impedir que la
configuración o una dependencia reintroduzcan capacidad de instalar paquetes externos.

El productor de artefactos es `.github/workflows/build-apk.yml`. No ofrece perfiles
seleccionables: tanto los pushes móviles a `main` como las ejecuciones manuales usan
exclusivamente `production-apk`. Ese perfil hereda `APP_ENV=production`, el package
`com.maximofn.gymnasia`, el canal de política Production y el incremento nativo de
Production, y añade `android.buildType: apk` para producir un archivo instalable.
Development, staging y preview quedan fuera de este workflow.

El APK resultante se publica como una release estable de GitHub, pero ese canal es
manual e independiente: ningún código de la app descubre, descarga o instala el
archivo. Las releases usadas para distribuir la política del agente también permanecen
y no deben confundirse con un actualizador de la aplicación.

## Validación y cobertura de pruebas

La retirada de VivaGym y del actualizador se protege en cuatro capas:

1. `apps/mobile/agent/vivagymRemoval.contract.test.ts` rechaza la superficie, el
   protocolo, el host, la dependencia y consumidores nuevos de las claves heredadas.
2. `apps/mobile/scripts/development-provider.e2e.mjs` recorre Ajustes y falla si
   aparece la pestaña retirada o si la aplicación contacta con MyVitale.
3. `apps/mobile/agent/updateRemoval.contract.test.ts` y
   `apps/mobile/scripts/update-removal.e2e.mjs` impiden que reaparezcan el actualizador,
   la consulta de releases o la capacidad de instalar paquetes externos.
4. El contrato de publicación exige `production-apk`, el canal Production y un APK
   con `AndroidManifest.xml`; el artefacto final debe inspeccionarse además para
   confirmar package, permisos y ausencia de marcadores prohibidos.

La configuración y el escáner de permisos bloquean `REQUEST_INSTALL_PACKAGES`. Un AAB
para Google Play es un flujo separado y explícito con el perfil `production`; este
workflow de APK no debe ampliarse con perfiles seleccionables.

## Fuente de referencia

- `apps/mobile/App.tsx`: limpieza explícita de las claves heredadas; no contiene
  ejecución de VivaGym ni del actualizador.
- `apps/mobile/legacySecureStorage.ts`: lista cerrada de nombres heredados que
  sobreviven a una actualización normal.
- `docs/research/GYM-6-vivagym-qr.md`: investigación histórica de interoperabilidad;
  pruebas de apoyo, no autoridad de ejecución.
- `.github/workflows/build-apk.yml` y `apps/mobile/eas.json`: compilación exclusiva
  de `production-apk` y publicación manual.
- `apps/mobile/app.json` y `scripts/android-permissions/policy.json`: permisos
  Android permitidos y bloqueados.
