# Migración de la caché pública de ejercicios

La caché paginada de ejercicios separa los artefactos públicos de AsyncStorage.
Los manifiestos quedan en AsyncStorage; páginas, búsquedas e índices por ID usan
archivos privados persistentes en nativo e IndexedDB en web. No añade dependencias,
servicios ni permisos. Los pequeños catálogos nutricionales conservan su almacén.

## Contrato y fallos

- Presupuesto de contenido de 24 MiB, con un máximo de 2 MiB por artefacto. No
  expulsa páginas offline para admitir otra búsqueda. Una descarga válida puede
  usarse aunque falle su persistencia; el estado avisa de que no se guardó.
- Las claves solo admiten versiones SHA-256 y rutas públicas conocidas. Antes de
  retirar un fragmento de AsyncStorage se verifican su hash y la copia separada.
- Los catálogos completos v2/v3 válidos se unen por ID (prioridad v3), se convierten
  en páginas y se verifican antes de guardar y releer los metadatos y retirar las
  claves antiguas. Entradas inválidas o con huella incorrecta se conservan.
- La copia completa migrada se conserva como versión anterior al actualizar el
  catálogo remoto. Permite resolver IDs y buscar entre las páginas disponibles
  offline. No afirma cobertura global actual cuando solo conoce una copia antigua.
- Un reinicio entre retiradas recupera también los IDs exclusivos de la copia ya
  retirada. No reemplaza páginas inmutables verificadas durante el reintento.
- Apertura y migración de arranque se coordinan. Solo se podan versiones después
  de verificar la primera página y los metadatos durables; una descarga sin
  persistir no sustituye la recuperación en disco.
- Las mutaciones se serializan y el borrado total espera la cola de archivos.
  Cada runtime conserva su generación original para rechazar escrituras tardías
  después del borrado. El borrado de actividad preserva la caché pública.
- La medición no migra, limpia ni crea archivos o una base IndexedDB vacía. Sus
  tamaños y recuentos se muestran aparte del total de valores de AsyncStorage.

## Pruebas reproducibles

```sh
npm test
npm --workspace apps/mobile exec tsc --noEmit
npm run check:mobile-boundaries
npm run check:data-inventory
npm run test:data-inventory
npm run check:legal
npm run test:legal
npm run test:catalogs:e2e
npm run test:data-deletion:e2e
STORAGE_USAGE_SCREENSHOT_DIR=/tmp npm run test:shell:e2e
```

Las suites web exportan variantes de desarrollo diferentes. Ejecutarlas
secuencialmente; reutilizar `dist/` solo si coincide la variante requerida.

Cobertura determinista: migración de páginas e índices, cuota con escrituras
concurrentes y UTF-8 arbitrario, reinicio offline, interrupción entre retiradas,
fallos de escritura/lectura posterior/metadatos, aislamiento de claves personales,
copia corrupta, apertura durante la migración y semántica de `File.move` de Expo
(la instancia temporal cambia su URI al destino).

Cobertura web: IndexedDB real, descarga y búsqueda del selector y de Coach con
proveedor simulado, actualización de versión, migración de todas las familias
antiguas sin red, reinicio y conservación de un historial sintético grande;
borrado parcial y total; diagnóstico sin leer credenciales ni copiar valores.

Las capturas siguientes contienen exclusivamente fixtures sintéticas. Revisadas
frente a `docs/design/Gimnasia Design System.png`, conservan componentes, colores,
espaciado y jerarquía de Ajustes.

- [Informe en 390 px](assets/catalog-cache-usage-390.png)
- [Informe en 960 px](assets/catalog-cache-usage-960.png)

## Validación nativa pendiente de la build

Instalar el APK Production como actualización por ADB, conservando datos.
Comparar el diagnóstico anterior y posterior: catálogos antiguos retirados,
valores de AsyncStorage reducidos y caché pública medida aparte. Reabrir sin red
un ejercicio de rutina, reiniciar y comprobar datos personales y recuento de
fotos. No desinstalar, borrar datos ni publicar capturas personales. El tamaño
físico de SQLite puede conservar páginas reutilizables aunque bajen sus valores.

Revisión de privacidad: se recorrió `docs/legal/privacy-change-checklist.md` y se
actualizó el inventario. Se mantienen categorías, finalidad, destinatarios,
permisos, copias personales y alcances de borrado ya declarados. No requiere nueva
versión legal ni cambios en las declaraciones de Play.
