# Fotos de progreso y copias portables

La app conserva las fotos asociadas a mediciones en el almacenamiento privado del
dispositivo. Al guardar o migrar una foto, crea un JPEG con calidad 0,8, limita el lado
largo a 2048 píxeles y elimina EXIF, XMP, IPTC y comentarios. El nombre del fichero es
el SHA-256 de sus bytes, lo que permite deduplicar imágenes idénticas.

## Contenedor cifrado `.gymnasia` v3

Toda exportación nueva —la copia normal y el payload de recuperación de un almacén
dañado— usa un contenedor binario autenticado. Su cabecera canónica no incluye tipo de
contenido, fecha, versión de la app ni datos del usuario. Solo declara el formato y sus
parámetros, una sal y un prefijo de nonce aleatorios y el tamaño del contenido en claro.

- magia fija `GYMENC03` y longitud de cabecera big-endian de 32 bits;
- cabecera JSON UTF-8 canónica de hasta 4 KiB;
- scrypt con `N=32768`, `r=8`, `p=3`, clave de 32 bytes, sal aleatoria de 16 bytes y
  presupuesto máximo de 64 MiB;
- XChaCha20-Poly1305 por bloques de 1 MiB, con etiqueta de 16 bytes por bloque;
- nonce de 24 bytes formado por un prefijo aleatorio de 16 bytes y el índice big-endian
  de 64 bits del bloque;
- AAD formada por magia, longitud, cabecera exacta e índice del bloque;
- máximo de 220 MiB de plaintext y coincidencia obligatoria con el tamaño físico exacto.

La contraseña se usa exactamente como se escribe, sin `trim` ni normalización. Para crear
una copia se exigen entre 12 y 128 puntos de código Unicode y un máximo de 512 bytes UTF-8,
además de introducirla dos veces. No se guarda ni se transmite. La clave derivada, la sal,
el nonce y los buffers de plaintext que controla este flujo se ponen a cero cuando dejan de
ser necesarios como defensa de mejor esfuerzo; JavaScript no permite garantizar el borrado
de todas las copias internas de una cadena.

El cifrado emite bloques: en nativo los escribe mediante un `FileHandle` directamente a
un fichero privado de caché y en web los añade como partes de un `Blob`. Nunca existe un
ZIP ni un JSON de recuperación en un fichero temporal en claro. El ZIP interior sí se
construye en memoria porque `fflate` trabaja de forma síncrona.

## Payload de backup interior

Al descifrar una copia normal se obtiene un ZIP. Contiene:

- `manifest.json`, con `schemaVersion: 3`, los datos locales, la lista de recursos y
  las relaciones entre `Measurement.id` y cada foto;
- `media/<sha256>.jpg`, una entrada por contenido único.

El manifiesto nunca usa una ruta del dispositivo como vínculo portable. Cada recurso
declara ruta interna, MIME `image/jpeg`, tamaño y checksum `sha256:<hex>`. Al importar,
la app valida primero el manifiesto y después verifica el tamaño y el SHA-256 de cada
imagen antes de guardar nada. Una imagen ausente o corrupta se omite sin eliminar la
medición numérica correspondiente.

## Límites y selección

- 5 MiB por foto normalizada;
- 500 relaciones de foto por copia;
- 200 MiB de imágenes únicas;
- 8 MiB para el manifiesto;
- 220 MiB para el ZIP en claro.

Si no caben todas, se incluyen primero las fotos asociadas a mediciones más recientes.
El manifiesto registra las omisiones y la interfaz las explica al terminar. Los datos
que no son fotos se conservan completos.

## Importación, autenticidad y compatibilidad

El importador identifica la magia antes de pedir la contraseña. En nativo lee el archivo
cifrado por bloques desde la copia privada del selector. Comprueba límites, cabecera y
tamaño exacto, deriva la clave y autentica todos los bloques. Contraseña incorrecta,
manipulación, truncado o bytes sobrantes producen el mismo error seguro y no escriben
estado ni fotos. Solo después se abre y valida el ZIP completo y se muestra la confirmación
destructiva al usuario. Tras confirmar se aplican los datos; la atomicidad entre todos los
almacenes sigue fuera del alcance de este formato.

El importador mantiene compatibilidad explícita con JSON v1 y ZIP v2. Esos archivos
antiguos no estaban cifrados, por lo que se muestra un aviso junto a la confirmación normal.
No se permite exportar de nuevo en claro. Como v1 solo guardaba la URI original de una foto,
esa foto únicamente puede migrarse si el sistema aún permite leerla; los datos numéricos se
restauran aunque la imagen ya no exista.

Android e iOS guardan las fotos importadas en el directorio privado de la app. La web
puede crear y leer el paquete, pero no promete persistencia durable para las fotos: al
restaurar conserva las mediciones, omite sus imágenes y muestra un aviso.

El paquete de backup no contiene claves BYOK. La exportación de recuperación es distinta:
preserva deliberadamente el payload de cuarentena sin sanear y en web puede contener claves
antiguas, pero siempre usa el mismo cifrado v3. La herramienta local
`npm run decrypt:recovery -- --input <archivo> --output <destino>` pide la contraseña sin
eco, no admite pasarla por argumento, se niega a sobrescribir y crea la salida con permisos
`0600`. `--password-stdin` existe únicamente para pruebas automatizadas.

Los nombres de exportación usan un sufijo aleatorio (`gymnasia_backup_<hex>.gymnasia` o
`gymnasia_recovery_<hex>.gymnasia`) y no revelan fechas ni datos del usuario. En móvil, el
fichero cifrado de caché se elimina al cerrar la hoja de compartir. Las copias temporales
del selector se eliminan al completar, cancelar o descartar una importación.

## Pruebas y vectores

`backup/portableEncryption.test.ts` fija un vector determinista del contenedor, prueba
límites de contraseña, varios bloques, contraseña incorrecta, alteraciones, truncado, bytes
sobrantes y mutaciones generadas con `fast-check`. `backup/backupFormat.test.ts` cubre el
ZIP v3, hashes, deduplicación, límites, rutas seguras, enlaces ambiguos, JPEG y compatibilidad
v1/v2. `scripts/decrypt-recovery.test.mjs` verifica la CLI, `0600`, no sobrescritura y que un
fallo no deje salida parcial. Los E2E de historial y recuperación ejercitan descarga,
contraseña incorrecta sin escrituras, importación cifrada y descifrado local.
