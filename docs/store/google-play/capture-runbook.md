# Capturas reales para la ficha de Google Play

Estas capturas corresponden a GYM-197 (ticket para preparar la ficha española
de Google Play). Deben obtenerse del mismo commit que el AAB final y desde un
teléfono Android real. No se admiten mockups del diseño ni la versión web.
El AAB aprobado, su commit y su digest están fijados en `aab-validation.md`.

## Preparación segura

1. Instalar en limpio un APK derivado del AAB final mediante `bundletool`. La
   clave local usada para firmar ese APK de prueba vive fuera del repositorio y
   se destruye al terminar.
2. Crear datos sintéticos, sin nombre, correo ni fotografías de una persona:
   una rutina «Fuerza 3 días», un ejercicio personalizado «Sentadilla», una
   sesión terminada, comidas genéricas y dos medidas ficticias.
3. Configurar la credencial temporal de revisión solo en el dispositivo. No
   exportar una copia de seguridad después de configurarla.
4. Usar el chat ficticio: «Ayúdame a repartir una rutina de fuerza en tres días
   sin entrenar dos días seguidos». La respuesta visible debe ser prudente,
   breve y no mencionar lesiones, medicación ni enfermedades.
5. Usar el estimador con el texto «200 g de arroz cocido y 150 g de verduras».
   No fotografiar a una persona ni usar imágenes de la galería.

## Captura

- Desactivar notificaciones emergentes y limpiar la barra de estado.
- Mantener batería, wifi y cobertura con iconos completos.
- Guardar los PNG originales, sin edición, en `assets/raw/` usando los seis
  nombres declarados en `listing.es.json`.
- En la sesión usar un ejercicio personalizado sin imagen para que la captura
  no herede procedencia de IA del catálogo.
- En Proveedor IA, cerrar el teclado, mantener la clave enmascarada y comprobar
  que ningún carácter del secreto es visible.
- Ejecutar `npm run generate:store-listing` para producir las versiones
  1080×1920 con caption. El generador recorta sin deformar y elimina metadatos.

## Revisión visual obligatoria

- Abrir cada PNG final a tamaño completo.
- Confirmar que al menos el 80 % de la imagen muestra interfaz real.
- Confirmar que no aparecen claves, nombres, correos, fotos personales,
  VivaGym, el actualizador de APK, GitHub Releases ni mensajes de desarrollo.
- Confirmar que Chat muestra la identificación de IA y Denunciar.
- Confirmar que el descargo sanitario y la configuración BYOK coinciden con la
  ficha y la política publicadas.
