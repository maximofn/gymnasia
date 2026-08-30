# Fotos de progreso y copias portables

La app conserva las fotos asociadas a mediciones en el almacenamiento privado del
dispositivo. Al guardar o migrar una foto, crea un JPEG con calidad 0,8, limita el lado
largo a 2048 píxeles y elimina EXIF, XMP, IPTC y comentarios. El nombre del fichero es
el SHA-256 de sus bytes, lo que permite deduplicar imágenes idénticas.

## Paquete `.gymnasia` v2

El backup es un ZIP con extensión `.gymnasia`. Contiene:

- `manifest.json`, con `schemaVersion: 2`, los datos locales, la lista de recursos y
  las relaciones entre `Measurement.id` y cada foto;
- `media/<sha256>.jpg`, una entrada por contenido único.

El manifiesto nunca usa una ruta del dispositivo como vínculo portable. Cada recurso
declara ruta interna, MIME `image/jpeg`, tamaño y checksum `sha256:<hex>`. Al importar,
la app valida primero el manifiesto y después verifica el tamaño y el SHA-256 de cada
imagen antes de guardarla. Una imagen ausente o corrupta se omite sin eliminar la
medición numérica correspondiente.

## Límites y selección

- 5 MiB por foto normalizada;
- 500 relaciones de foto por copia;
- 200 MiB de imágenes únicas;
- 2 MiB para el manifiesto;
- 220 MiB para el paquete completo.

Si no caben todas, se incluyen primero las fotos asociadas a mediciones más recientes.
El manifiesto registra las omisiones y la interfaz las explica al terminar. Los datos
que no son fotos se conservan completos.

## Compatibilidad y plataformas

El importador mantiene la compatibilidad con el JSON v1. Como ese formato solo guardaba
la URI original, una foto antigua únicamente puede migrarse si el sistema aún permite
leerla. Los datos numéricos se restauran aunque la foto ya no exista.

Android e iOS guardan las fotos importadas en el directorio privado de la app. La web
puede crear y leer el paquete, pero no promete persistencia durable para las fotos: al
restaurar conserva las mediciones, omite sus imágenes y muestra un aviso.

El paquete no contiene claves BYOK, no se sube automáticamente y no está cifrado ni
protegido por contraseña. La ubicación final depende de la opción que el usuario elija
en la hoja de compartir.
