# Actualizaciones públicas de Google Play — 3 de noviembre de 2026

## Alcance y autorización

El mantenedor solicita que las actualizaciones normales lleguen a Producción,
sin inscripción en Alpha. Autoriza expresamente el permiso de publicación de
`gymnasia-play-submit` solo para Gymnasia y, tras conocer la dependencia de la UI,
autoriza también declaraciones de políticas y enlaces profundos.

Se guardan los permisos en Play Console y se reabre el usuario: una app, siete
permisos; Producción activo, administrador desactivado, declaraciones y enlaces
profundos activos como dependencias obligatorias. No se modifican credenciales,
países, usuarios, otros permisos, versiones ni declaraciones de la ficha.

## Contrato verificado

- EAS Submit y la política operativa coinciden en `production` / `completed`.
- Se conserva la aprobación humana de `Production`, los gates y la verificación
  de los dos binarios y del recibo consultado a Google.
- Los históricos Alpha/Interno siguen siendo legibles y sus recibos se consultan
  en su canal original. Un reintento con otro canal falla antes de llamar a EAS.
- La evidencia liga exactamente el track del recibo, la transacción y el envío.
- Ni EAS `FINISHED` ni el estado API `completed` demuestran disponibilidad
  pública: sigue siendo necesario comprobar revisión y disponibilidad en Play.
- Se prepara 1.54.1 para el próximo flujo; ya contiene la integración CIQUAL.
  Esta PR no se fusiona ni ejecuta compilaciones o publicaciones durante la QA.

## Validación local

- `npm run test:production-release`: 86/86, con regresiones de destino público,
  lectura histórica, mismatch de track y evidencias de CLI, además de propiedades
  de integridad de artefactos e idempotencia.
- `npm --workspace apps/mobile run test:deterministic -- --maxWorkers=2`:
  117 ficheros, 1.017/1.017 pruebas. La ejecución inicial de `npm test` sin limitar
  los trabajadores tuvo dos timeouts en política y cifrado; la repetición completa
  con dos trabajadores pasó sin cambios en esas pruebas ni sus límites.
- `npm run test:dev-store`: 11/11; `npm run test:mobile-boundaries`: 3/3.
- `npm --workspace apps/mobile exec tsc --noEmit`: correcto.
- `npm run check:prompt-policy`, `npm run check:data-inventory`,
  `npm run check:legal` y `git diff --check`: correctos.
- Checklist de privacidad revisada: no cambian los datos tratados por la app,
  almacenamiento, proveedores, hosts ni permisos Android. Los permisos de Play
  son operativos de publicación; no requieren cambiar el inventario de la app.
- E2E web/native: no se cambia UI ni comportamiento de la app; no se instala
  ninguna actualización. La prueba real de envío y disponibilidad pública queda
  para después del merge autorizado y de la revisión de Google.

## Actualización del 4 de noviembre de 2026

El check remoto detectó otra expectativa de Alpha en el contrato de configuración
de `scripts/policy-promotion/policy-contract.test.mjs`. Se actualiza para exigir
Producción, sin modificar prompts, políticas sanitarias ni puertas de aprobación.
`npm run test:prompt-policy`: 51/51 pruebas correctas. Se integra también la
actualización documental de `main` antes de volver a ejecutar los checks remotos.
