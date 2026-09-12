---
type: concepto
title: Repositorios de contenido y consumo de catálogos
description: Publicación validada de alimentos, productos, recetas y ejercicios, y consumo móvil local-first. Describe agregados nutricionales, catálogo paginado verificable de ejercicios, caché, migraciones e invariantes de identidad.
tags: [content, catalogs, validation, offline, mobile]
sources:
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
  - id: openwiki-source-c0eca02912a89ea7ca68826e
    resource: repo://apps/mobile/catalogs/exerciseCatalogRuntime.test.ts
  - id: openwiki-source-997461d2f9cf061268adfc05
    resource: repo://apps/mobile/catalogs/exerciseCatalogRuntime.ts
  - id: openwiki-source-9ee51f66db370430ab589e76
    resource: repo://apps/mobile/catalogs/migrations.test.ts
  - id: openwiki-source-067a47a65078f5a592130881
    resource: repo://apps/mobile/catalogs/migrations.ts
  - id: openwiki-source-3f0c486b0570afaf7b1b7a38
    resource: repo://apps/mobile/catalogs/runtime.test.ts
  - id: openwiki-source-10afa4ec1c37f1f581a11096
    resource: repo://apps/mobile/catalogs/runtime.ts
  - id: openwiki-source-4f86ce9a61028058a0af6dce
    resource: repo://apps/mobile/catalogs/schemaValidation.ts
  - id: openwiki-source-38c56531000e6ccc59045ff7
    resource: repo://apps/mobile/catalogs/sources.ts
  - id: openwiki-source-36ac1d1b6a1d97f5db056148
    resource: repo://apps/mobile/catalogs/types.ts
  - id: openwiki-source-bd210931c947e300164b7a63
    resource: repo://apps/mobile/scripts/catalogs.e2e.mjs
  - id: openwiki-source-9fbf7552e9a684c0750e0a04
    resource: repo://ejercicios/catalog-v1/manifest.json
  - id: openwiki-source-d54ece17be93a2b0fabf9d35
    resource: repo://ejercicios/SOURCES.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-b896fa4e3ea6b5bfcc4ef173
    resource: repo://scripts/catalogs/catalogs.mjs
  - id: openwiki-source-87ef8bdaf847493a7f3a10e0
    resource: repo://scripts/catalogs/exercise-pagination.mjs
  - id: openwiki-source-2cc0790639fb245db6d26267
    resource: repo://scripts/catalogs/generate.mjs
  - id: openwiki-source-2408b57c618a3b50aea06e81
    resource: repo://scripts/catalogs/schemas/ejercicio.schema.json
  - id: openwiki-source-025372dfd931964e023a41cf
    resource: repo://scripts/catalogs/schemas/food-entry.schema.json
generated: { by: "openwiki/0.5.0", at: "2026-09-12T11:47:11.882Z" }
verified:
  - by: openwiki/0.5.0
    at: 2026-09-12T11:47:11.882Z
---

# Repositorios de contenido y consumo de catálogos

Los directorios versionados son la fuente curada compartida para `alimentos/`, `productos_comerciales/`, `recetas/` y `ejercicios/`. Se editan fichas JSON e imágenes; los agregados e índices son derivados reproducibles que se confirman junto a las fichas. La separación es también de privacidad: los alimentos personales pertenecen al almacenamiento local del usuario, no a estos repositorios ni a una URL de imagen remota.

La aplicación móvil tiene dos protocolos de consumo distintos. Los tres catálogos nutricionales descargan su `all.json`; ejercicios publica un manifiesto con páginas e índices fragmentados para no descargar el catálogo completo al abrirlo. Ambos protocolos validan antes de aceptar contenido y mantienen una copia local para tolerar falta de red. Para el uso funcional, véanse [Dieta y estimación de alimentos](../mobile/diet-and-food-estimation.md) y [Plantillas de entrenamiento](../mobile/training.md).

## Autoría, derivados y puerta de publicación

| Dominio | Fuente editable | Derivados publicados |
| --- | --- | --- |
| `alimentos/` | `<id>.json` e `images/` | `all.json` e `index.json` (`id`, `name`) |
| `productos_comerciales/` | `<id>.json` e `images/` | `all.json` |
| `recetas/` | `<id>.json` e `images/` | `all.json` |
| `ejercicios/` | `<id>.json` e imágenes por sexo | `all.json`, `index.json` y `catalog-v1/` |
| `apps/mobile/catalogs/generated/` | No editable a mano | `catalogSchemas.generated.ts` |

El generador enumera fichas raíz —no los derivados— en orden de nombre de archivo y produce los agregados. En ejercicios también construye `catalog-v1`: páginas de 30 entradas, índice de búsqueda y directorio por ID, más un `manifest.json` que describe cada artefacto y su hash. El manifiesto se escribe al final de una actualización, de modo que es el punto de activación de una publicación coherente. No edite manualmente `all.json`, `index.json`, `catalog-v1/` ni el schema TypeScript generado.

```mermaid
flowchart TD
    Edit["Editar ficha JSON e imagen"] --> Inspect["Validar fichas, IDs e imágenes"]
    Inspect -->|"Error"| Fix["Corregir fuente"]
    Fix --> Edit
    Inspect -->|"Válido"| Build["Generar agregados y catálogo paginado"]
    Build --> Check["Ejecutar check:catalogs"]
    Check -->|"Deriva"| Build
    Check -->|"Correcto"| Commit["Confirmar fuentes y derivados juntos"]
    Commit --> Publish["Publicar desde GitHub Raw"]
```

*La publicación depende de que fuentes y artefactos derivados superen la misma inspección.*

Los comandos operativos son:

```bash
npm run sync:catalogs
npm run check:catalogs
npm run test:catalogs
npm run test:catalogs:e2e
```

`sync:catalogs` valida y escribe; admite limitar la escritura con `node scripts/catalogs/generate.mjs --write --domain alimentos`. `check:catalogs` no admite esa limitación: inspecciona todos los dominios y falla si falta un derivado, hay deriva o queda un JSON obsoleto dentro de `ejercicios/catalog-v1/`. La escritura prepara temporales, sustituye los contenidos antes que el manifiesto de ejercicios y, si una operación falla, restaura los reemplazos y eliminaciones ya realizados.

## Contrato de contenido y recursos

Las fichas nutricionales son objetos cerrados: ID kebab-case, nombre, categoría, nutrientes y fibra por 100 g, tamaño y descripción de porción; los números son finitos y no negativos. `image` es opcional y, cuando existe, es un nombre de archivo WebP seguro dentro de `images/`. Una receta es por tanto una entrada nutricional por 100 g, no una receta ejecutable por ingredientes.

Las fichas de ejercicio son igualmente cerradas y requieren `name`, grupo y músculos secundarios, equipo, dificultad, instrucciones y las dos imágenes. El ID debe coincidir con el nombre del JSON y las rutas deben ser exactamente `images/<id>-male.webp` e `images/<id>-female.webp`. La inspección además rechaza duplicados —también entre dominios nutricionales—, JSON o schema inválido, rutas que escapen del catálogo, diferencias de mayúsculas, imágenes ausentes o huérfanas, bytes que no decodifiquen como WebP y proporciones distintas de 1:1 para nutrición o 16:9 para ejercicios.

Estas guardas importan para consumidores de sistemas de archivos con distinta sensibilidad de mayúsculas y para impedir que una referencia publicada lea fuera de su directorio. Una imagen nutricional puede reutilizarse por varias fichas; cualquier archivo presente en `images/` debe, aun así, estar referenciado.

## Fuentes móviles y caché nutricional

El registro de fuentes nombra tres catálogos nutricionales remotos (`gymnasia_foods`, `gymnasia_products`, `gymnasia_recipes`) y una fuente local privada (`user_personal_foods`). Las tres URLs apuntan a su `all.json` en GitHub Raw y llevan claves de caché actual y heredada, además de procedencia. El catálogo de ejercicios usa el mismo repositorio y procedencia, pero su runtime dedicado obtiene `ejercicios/catalog-v1/manifest.json`, no `all.json`.

Después de hidratar el estado general, la app lee primero las cachés nutricionales, las muestra y refresca sus tres fuentes en paralelo. Un refresco añade `ts` a la URL y solo publica el nuevo snapshot si HTTP, JSON y el arreglo completo pasan el parser; luego persiste un sobre con versión, fuente, fecha, hash SHA-256 canónico, ETag, procedencia y datos. Al leer, vuelve a validar estructura, fuente, fecha, entradas y hash. Una caché actual inválida se rechaza sin retroceder a la clave heredada; un array heredado válido se migra como `stale` sin fecha.

```mermaid
sequenceDiagram
    participant App as Aplicación
    participant Store as AsyncStorage
    participant Raw as GitHub Raw
    App->>Store: Leer sobre nutricional
    Store-->>App: Snapshot validado o vacío
    App->>App: Mostrar datos locales
    App->>Raw: Solicitar all.json con ts
    alt Respuesta y catálogo válidos
        Raw-->>App: Arreglo completo
        App->>Store: Guardar sobre con hash
        App->>App: Publicar snapshot fresh
    else Red, JSON o schema fallan
        App->>App: Conservar snapshot anterior
    end
```

*El fallo remoto no sustituye una copia previamente aceptada.*

Una copia fechada de hasta siete días es `cached`; después es `stale`. Las fuentes pueden estar `fresh`, `cached`, `stale` o `unavailable`; el agregado nutricional es `partial` cuando sus estados no coinciden. Una escritura de caché que falle no descarta los datos frescos de la sesión, pero deja el aviso de que no estarán offline al reiniciar. La carga y el reintento de ejercicios son independientes; las dependencias de almacenamiento incorporan una generación para impedir que una operación tardía persista después de que la eliminación de datos invalide el runtime.

El parser nutricional agrega `sourceId` y el origen histórico tras validar. Ese origen decide si la imagen vive en `alimentos`, `productos_comerciales` o `recetas`; para un alimento personal devuelve `null`, incluso si la entrada tuviera `image`.

## Catálogo paginado y verificable de ejercicios

El servicio de ejercicios mantiene metadatos de caché v4 con una versión activa y, opcionalmente, la anterior. Al inicializar solo lee y valida esa caché; al abrir, descarga el manifiesto y la página 0. Para aceptar una publicación nueva, valida el manifiesto y descarga y valida esa primera página antes de activarla. Si falla cualquiera de esos pasos, conserva la versión activa comprobada. Los artefactos se cachean por `catalogVersion` y ruta, se comprueban contra el hash declarado y la poda conserva únicamente versiones activa y anterior.

```mermaid
sequenceDiagram
    participant UI as Selector
    participant Service as Servicio ejercicios
    participant Store as AsyncStorage
    participant Raw as GitHub Raw
    UI->>Service: open
    Service->>Raw: manifest.json
    Raw-->>Service: Manifiesto con hashes
    Service->>Raw: pages/0000.json
    Raw-->>Service: Primera página
    Service->>Store: Activar versión y cachear artefactos
    UI->>Service: search o resolveByIds
    Service->>Raw: Fragmento de búsqueda o directorio
    Service->>Raw: Página de detalle si hace falta
```

*La apertura está acotada al manifiesto y primera página; la búsqueda y resolución cargan fragmentos bajo demanda.*

El manifiesto impone versión de schema, `sourceId`, tamaño de página 30, conteos coherentes, rutas relativas predecibles y hashes. Las búsquedas normalizan texto español, usan índices de unigramas y bigramas por campos, y pueden devolver resúmenes globales sin descargar la página que contiene las instrucciones. `getEntry` carga esa página solo cuando se abre el detalle. La resolución de IDs consulta primero páginas ya cacheadas y, para los faltantes, el directorio fragmentado que señala la página correspondiente. Cursores incluyen versión y firma de consulta: no se pueden reutilizar entre una búsqueda, otra búsqueda o una versión distinta.

Sin un fragmento remoto, la búsqueda usa las páginas verificadas que ya estén en caché y señala que no hay cobertura global. Como compatibilidad, si falla red y existe la caché v3 completa, se convierte localmente a páginas v4 y queda `stale`; esa migración no tiene los índices publicados, por lo que la búsqueda se limita a sus páginas locales.

## Identidad persistida y cambio seguro

Las referencias persistidas no dependen del nombre: usan `{ schemaVersion, sourceId, itemId }`. Tras abrir o actualizar el catálogo, la aplicación resuelve enlaces de rutinas por ID y sincroniza los campos mostrados; renombrar una ficha no rompe el vínculo. Para elementos heredados, la migración automática solo crea el enlace ante una coincidencia exacta o alias con un único candidato. Una ambigüedad requiere decisión explícita; no se adivina un alimento o ejercicio. Si se renombra o retira un ID, mantenga un alias de compatibilidad mientras existan referencias almacenadas.

Al añadir contenido, mantenga el ID estable, incorpore las imágenes declaradas, ejecute `npm run sync:catalogs` y confirme fuentes y derivados juntos. Cambiar ID, schema, rutas de imagen, tamaño de página o estrategia de índice es un cambio de contrato: exige revisar enlaces persistidos, cachés, manifiesto y clientes. La atribución de ejercicios se mantiene en `ejercicios/SOURCES.md`: pueden adaptarse metadatos e instrucciones bajo MIT según la fuente fijada, pero no reutilizar imágenes ni GIF de Gym Visual.

## Pruebas que protegen el contrato

Las pruebas del productor cubren la inspección, generación determinista, seguridad de rutas y rollback. Las pruebas del runtime paginado prueban que la apertura no pide `all.json`, que sigue limitada a manifiesto más primera página incluso con 10.000 ejercicios, búsqueda global con carga diferida del detalle, cursores ligados a versión y consulta, deduplicación de descargas, migración v3, fallback ante publicación corrupta y retención de dos versiones.

`npm run test:catalogs:e2e` intercepta GitHub Raw y verifica consumo de dieta y entrenamiento, scroll infinito y búsqueda del selector, continuidad offline, migración de cachés antiguas, disponibilidad parcial, arranque sin red, rechazo de caché manipulada y elección manual ante coincidencias alimentarias ambiguas. También demuestra que, tras renombrar un ejercicio publicado, una plantilla conservada mantiene el mismo `itemId` y actualiza su nombre mostrado.
