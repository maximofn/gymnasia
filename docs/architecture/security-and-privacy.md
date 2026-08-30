# Arquitectura - Seguridad y Privacidad

> **Declaración vinculante**: la política publicada en
> <https://gymnasia.maximofn.com/privacidad>, cuya fuente es
> `docs/legal/privacy-policy.es.md`. El inventario verificado de datos vive en
> `scripts/data-inventory/inventory.json`. Este documento describe la arquitectura;
> ante cualquier discrepancia, mandan aquellos.

> **Aviso**: hasta agosto de 2026 este fichero describía un backend con cuentas de
> usuario, claves BYOK cifradas en servidor y fotos alojadas en la UE. Nada de eso
> existe ni ha existido en el producto. Se corrigió al redactar la política de
> privacidad (GYM-190, ticket para publicar una política veraz y preparar las declaraciones de salud), porque publicar aquellas afirmaciones ante Google Play habría
> sido declarar en falso. Los documentos de `docs/backend/` y `docs/specs/` describen
> esa misma arquitectura no implementada: no son fuente de verdad sobre privacidad.

## Modelo real: local-first, sin backend

- No hay cuentas, ni autenticación, ni servidor propio.
- Todos los datos viven en el dispositivo: AsyncStorage para el estado y SecureStore
  para las credenciales.
- No hay analítica, telemetría ni crash reporting. Ningún SDK de ese tipo está
  incorporado.
- La única salida de datos personales es hacia el proveedor de IA que el usuario elige,
  con la clave que él aporta, y ocurre directamente desde el dispositivo.

## Datos personales tratados

Actividad de entrenamiento, registro nutricional, peso y composición corporal
(incluidos perímetros y porcentaje de grasa), datos de cálculo (sexo, altura, fecha de
nacimiento), historial de conversaciones con el asistente y la memoria del asistente en
texto libre. El detalle por clave de almacenamiento, con su propósito y su ciclo de
vida, está en el inventario.

## Secretos

- Las claves de API son BYOK: las introduce el usuario y se guardan en SecureStore, es
  decir, en el llavero del sistema operativo.
- No se incluye ninguna clave en el binario.
- Las claves se excluyen del estado antes de escribirlo en AsyncStorage, **siempre que
  SecureStore esté disponible**. En web no lo está, y la clave queda en el
  almacenamiento del navegador. La aplicación lo advierte en la pantalla del proveedor.
- La copia de seguridad exportada nunca incluye claves de API.
- Dos nombres de clave heredados de una integración retirada permanecen en SecureStore
  para conservar sus valores durante una actualización normal. El build actual no los
  lee ni transmite y «Borrar todos mis datos» los elimina.

## Copias de seguridad

Exportación e importación manuales a un fichero JSON. Contiene medidas, dieta, historial
de entrenamiento, ajustes personales, memoria del asistente y el historial completo de
conversaciones. Es el artefacto más sensible que produce la aplicación.
En móvil, la copia temporal usada para abrir la hoja de compartir se elimina al
cerrarla; el archivo que el usuario guarde fuera de la app deja de estar bajo su control.

## Borrado

La sección Ajustes → Datos ofrece dos alcances. «Borrar actividad y conversaciones»
vacía el historial funcional y las sesiones, pero conserva configuración, memoria,
alimentos personales, credenciales y diagnósticos. «Borrar todos mis datos» recorre el
inventario local, elimina y vuelve a leer cada destino para comprobarlo, informa de los
fallos sin ocultarlos y permite reintentar. Solo conserva la caché pública firmada que
impide retroceder a instrucciones de seguridad antiguas; no contiene datos del usuario.

## Trazas

`apps/mobile/trace.ts` mantiene un registro local de hasta 1000 entradas en
AsyncStorage. Nunca sale por red; el usuario puede copiarlo o borrarlo desde Ajustes.

## Seguridad de la IA

- Divulgación de identidad de IA en las tres superficies conversacionales
  (`apps/mobile/agent/aiTransparency.ts`).
- Instrucciones de sistema que prohíben presentarse como persona o profesional
  sanitario.
- Barreras de contenido sanitario y avisos cuando el contexto lo requiere.

## Cómo se evita que esto vuelva a divergir

`npm run check:data-inventory` compara el inventario declarado con las claves de
almacenamiento, los destinos de red y los permisos que hay en el código, y falla si no
coinciden. `npm run check:legal` verifica que la política publicada corresponde a su
fuente. Ambos corren en CI. El procedimiento al tocar cualquiera de esas cosas está en
`docs/legal/privacy-change-checklist.md`.
