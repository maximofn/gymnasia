---
type: arquitectura de shell móvil
title: Shell y navegación de la aplicación móvil
description: El shell Expo de Gymnasia coordina la landing HTML pública del export web y, tras JavaScript, el arranque local-first, los destinos React y el retorno de Atrás. Esta página separa el contrato indexable previo a React de los datos y controles privados del runtime.
tags: [mobile, application-shell, expo, navigation, hydration, react-native, web-export, seo]
sources:
  - id: openwiki-source-a6ba9053969a3e00cd971742
    resource: repo://apps/mobile/app.config.ts
  - id: openwiki-source-3de323c9f3752d72d82de839
    resource: repo://apps/mobile/app.json
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
  - id: openwiki-source-5bc85cb19c272fd7fc38c992
    resource: repo://apps/mobile/controllers/homeController.ts
  - id: openwiki-source-7a047b00a95eb325eb147887
    resource: repo://apps/mobile/environment.ts
  - id: openwiki-source-12bdb95b5f863aab1ff9964a
    resource: repo://apps/mobile/index.js
  - id: openwiki-source-d84b62e4a597047843fbd320
    resource: repo://apps/mobile/LocalStoreRecoveryScreen.tsx
  - id: openwiki-source-e6092e57680c1313a5efe04e
    resource: repo://apps/mobile/notifications/notificationSounds.json
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-b47b785d881caefec5840687
    resource: repo://apps/mobile/public/index.html
  - id: openwiki-source-1d477406340582311e84da48
    resource: repo://apps/mobile/runtimeEnvironment.ts
  - id: openwiki-source-13b3cbcccd9499e5edfcca02
    resource: repo://apps/mobile/screens/AppShell.tsx
  - id: openwiki-source-ee382022b458bb4be8f1d137
    resource: repo://apps/mobile/scripts/shell-navigation.e2e.mjs
  - id: openwiki-source-566414ee4d2c02f464360b14
    resource: repo://apps/mobile/scripts/storage-recovery.e2e.mjs
  - id: openwiki-source-a37cf68b40d9429a8dfe2b36
    resource: repo://apps/mobile/shell/safeArea.contract.test.ts
  - id: openwiki-source-3486307c420c174fb98d9315
    resource: repo://apps/mobile/shell/shellRegistry.contract.test.ts
  - id: openwiki-source-e49562cb6bbccd786d80c2b7
    resource: repo://apps/mobile/shell/shellRegistry.test.ts
  - id: openwiki-source-e5d6f282bc4f08b4d12f037b
    resource: repo://apps/mobile/shell/shellRegistry.ts
  - id: openwiki-source-f5a826b1adfe83cfcc01ce9c
    resource: repo://apps/mobile/vercel.json
generated: { by: "openwiki/0.6.0", at: "2026-10-29T14:43:04.676Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-29T14:43:04.676Z
---

# Shell y navegación de la aplicación móvil

Hay dos superficies web con responsabilidades distintas. Antes de que cargue JavaScript, `apps/mobile/public/index.html` entrega una **landing HTML pública** para navegador, previsualizadores sociales y rastreadores. Cuando el bundle Expo arranca, `apps/mobile/index.js` registra `App` con `registerRootComponent` y React sustituye el contenido inicial de `#root`; desde ahí `App` y `GymnasiaApp` ejecutan el shell de producto local-first. La landing no es una pantalla React, una ruta ni un origen de estado del usuario.

```mermaid
flowchart TD
    Visitor["Navegador o rastreador"] --> Html["index.html público"]
    Html --> Bot["Metadatos y contenido estático"]
    Html --> Js{"JavaScript disponible"}
    Js -->|"no"| Notice["Aviso noscript y enlaces públicos"]
    Js -->|"sí"| Bundle["Bundle Expo web"]
    Bundle --> Root["React sustituye #root"]
    Root --> App["App y GymnasiaApp"]
    App --> Local["Hidratación del almacenamiento local"]
```

*El HTML previo a JavaScript sirve contenido público; el estado local-first empieza únicamente en el shell React ya montado.*

## Landing pública del export web

La plantilla declara idioma español, viewport, color de tema e iconos, además del `title`, descripción, canónica y directiva `robots` de la página pública. Incluye las variantes Open Graph y Twitter —con URL, título, descripción e imagen— y un objeto JSON-LD `SoftwareApplication` con categoría, sistemas operativos, autor y oferta. El cuerpo contiene un `noscript`, un único `#root` y una landing con `h1`, descripción, enlaces de proyecto/autor y enlaces a `/privacidad` y `/privacy`; el fondo y estilos de esa landing evitan un destello blanco mientras se carga la aplicación.

Ese material es deliberadamente público y está escrito de forma literal en el HTML exportable. Es apropiado cambiarlo al modificar SEO, tarjetas sociales, datos estructurados o la experiencia sin JavaScript. No debe usarse para modelar navegación, sesión, preferencias, claves, historial ni consentimiento: no lee almacenamiento, no conoce al usuario y React elimina su contenido al montar. En particular, las afirmaciones promocionales de la landing (incluidas las relativas a datos o servicios externos) son copy público, **no** una garantía técnica adicional ni una fuente de verdad sobre el flujo de datos. Cualquier cambio de ese copy debe revisarse frente a la implementación local-first y la documentación de privacidad, no inferir protección de datos solo de un `meta` o del JSON-LD.

El contrato de sustitución es importante: mantener `#root` y conservar la landing dentro de él permite que el export de Expo tome el mismo contenedor. No convierta el fallback en una segunda app, no añada datos por usuario al HTML y no dependa de que sus enlaces o texto sigan visibles después del montaje. Si se modifica el HTML, compruebe tanto el documento entregado sin JavaScript como el shell después de montar; las pruebas de navegación no cubren por sí solas sus metadatos ni la validez de los datos estructurados.

## Arranque protegido e hidratación

`App` conserva una generación de runtime y, después de un borrado local, remonta `GymnasiaApp` con una `key` nueva y el resultado del borrado. Por ello, `GymnasiaApp` concentra la composición del shell local-first —estado de pantalla, almacenamiento, controladores y superficies globales— sin reemplazar los límites de cada dominio.

El runtime parte de `createInitialStore()`, `loading: true` e `isHydrated: false`, y ejecuta `runLocalStoreHydration` al montar. Antes de normalizar o publicar estado React inspecciona el agregado local. Un resultado `recoverable` o `corrupt` mantiene `isHydrated` en falso y sustituye el shell por `LocalStoreRecoveryScreen`; un error que no puede pasar a cuarentena muestra `LocalStoreStartupFailureScreen`, que solo permite reintentar. La aplicación no se presenta como vacía ni persiste sobre un agregado sin comprobar.

```mermaid
flowchart TD
    Entry["index.js"] --> Root["App y SafeAreaProvider"]
    Root --> Inspect["Inspeccionar almacenamiento local"]
    Inspect --> Quarantine{"Resultado recuperable o corrupto"}
    Quarantine -->|"sí"| Recovery["Pantalla de recuperación"]
    Quarantine -->|"no"| Normalize["Normalizar e hidratar"]
    Normalize --> Commit["Confirmar representación canónica"]
    Commit --> Secondary["Cargar estado secundario"]
    Secondary --> Ready["isHydrated true"]
    Normalize --> Failure["Fallo no recuperable"]
    Failure --> Retry["Pantalla de fallo y reintento"]
```

*El arranque React separa la cuarentena protectora de la ruta que puede publicar y persistir el estado normalizado; no depende del contenido estático previo.*

En la ruta válida, el shell carga y migra las claves de proveedor según plataforma, confirma la representación canónica del agregado y solo después lee sesión activa, instantánea y borrador de sesión, preferencias, salud de alarmas y consentimiento. Los fallos del almacén seguro o de datos secundarios se comunican como no fatales cuando es posible; no invalidan automáticamente el agregado principal. Al final reemplaza los runtimes y estados React, habilita `isHydrated` y refresca los diagnósticos de notificaciones.

`isHydrated` es una barrera de escritura: la persistencia del agregado, de la sesión y de su borrador retorna mientras sea falso. Si un `commit` es ambiguo o queda bloqueado, el shell se deshidrata e inspecciona de nuevo antes de permitir más escrituras. No retire esta barrera al extraer una pantalla o controlador. Para el detalle del agregado, copias y recuperación, véase [Estado local y copias de seguridad](local-state-and-backup.md).

### Recuperación deliberada

La pantalla de recuperación no muestra valores del usuario en sus detalles; lista rutas y códigos de incidencias. Sus acciones son:

- **Recuperar última copia**, solo si hay una instantánea verificada; restaura y vuelve a hidratar.
- **Guardar copia dañada**, si se conserva el payload; solicita contraseña y exporta contenido cifrado.
- **Volver a intentarlo**, que inspecciona de nuevo sin respetar una cuarentena previa para aceptar una reparación externa.
- **Descartar estos datos y empezar de cero**, protegido por confirmación.

Al descartar, `discardAffected` escribe un `createInitialStore()` con las claves de proveedor cargadas —o las predeterminadas— y elimina la sesión activa, su instantánea de plantilla y su borrador. No borra las particiones de datos personales ni preferencias. La E2E de recuperación comprueba que un JSON roto permanece intacto hasta una acción explícita, que la exportación está cifrada, que los detalles omiten valores privados y que reintento, restauración y descarte solo eliminan la cuarentena por una ruta válida.

## Insets y superficie raíz

`App` envuelve exactamente una instancia de `GymnasiaApp` en `SafeAreaProvider`; la superficie normal de `GymnasiaApp` es un `SafeAreaView` de `react-native-safe-area-context`. Esto es necesario para los insets bajo edge-to-edge de Android: no se debe importar `SafeAreaView` desde `react-native` ni compensar `StatusBar.currentHeight` manualmente, porque duplicaría el margen del contenedor raíz.

Los `Modal` nativos se dibujan fuera de ese contenedor, así que cada uno debe aplicar su propio `SafeAreaView` de la misma biblioteca. El contrato estático enumera los modales nativos actuales —informe de IA, recuperación local y contraseña de copia— y falla si aparece el import del core, una compensación manual o más de un proveedor raíz.

## Navegación: un estado, dos presentaciones

No hay rutas URL ni una pila principal restaurable. `TAB_DESTINATIONS` es el registro único de `TabKey`: `home`, `training`, `diet`, `measures`, `chat` y `settings`. `tab` es estado React; comienza en Inicio y comienza en Configuración únicamente cuando un restablecimiento por borrado informa estado `incomplete`. El renderizado de `App` selecciona la pantalla de cada pestaña y las vistas secundarias —detalle/editor de rutina, sesión, selectores y overlays— conservan su estado/controlador propio.

La página Inicio no reproduce reglas de navegación: `useHomeController` recibe los destinos desde el shell. Su acción primaria abre Entrenamiento si hay una sesión activa o no existe plantilla ejecutable; solo inicia la primera plantilla ejecutable cuando no hay sesión activa. Así la tarjeta de Inicio comparte el mismo `setTab("training")` y el arranque de sesión que el resto del shell.

El registro de destinos también define etiquetas, iconos y `testID` de ambos formatos. `usesDesktopNavigation` habilita escritorio exclusivamente en `Platform.OS === "web"` con viewport de al menos 960 px. En ese caso se monta `DesktopSidebar`; en web estrecha y en iOS/Android, incluso con pantalla grande, `AppHeader` monta la banda horizontal. Ambos invocan el mismo `onTabChange`, por lo que cambiar el ancho intercambia el control visual sin reiniciar `tab` ni el estado anidado.

| Formato | Registro visual | Selectores |
|---|---|---|
| Escritorio web | Barra lateral de 246 px con los seis destinos. | `desktop-nav-${key}` |
| Compacto, web estrecha y nativo | Banda horizontal en el encabezado con los mismos destinos. | `nav-tab-${key}` |

Añadir una pestaña exige actualizar `TAB_DESTINATIONS` **y** el renderizado de contenido de `App`; las dos barras se derivan del registro. Las pruebas de `shellRegistry` fijan destinos, frontera de 960 px, selectores únicos y que Android/iOS nunca reciban escritorio por su ancho.

## Atrás de Android y propiedad de superficies

`SHELL_BACK_LAYERS` registra las capas que pertenecen a `BackHandler`: identificador, alcance, prioridad única descendente, `testID`, propietario y comportamiento. `App.tsx` construye de forma exhaustiva el mapa de visibilidad y el de handlers desde controladores y estado local. `resolveShellBackCommand` elige la primera capa activa según el orden del registro. Existe una sola suscripción Android, estable, que consulta un `ref` actualizado en cada render y por tanto usa el estado y handler actuales sin resuscribirse.

```mermaid
flowchart TD
    Back["Atrás físico"] --> Layer{"Capa registrada activa"}
    Layer -->|"sí"| Close["Ejecutar handler de mayor prioridad"]
    Layer -->|"no"| Template{"Ruta de plantilla"}
    Template -->|"editor sucio"| Draft["Pedir descarte"]
    Template -->|"otra ruta abierta"| TemplateClose["Cerrar plantilla"]
    Template -->|"cerrada"| Session{"Sesión activa"}
    Session -->|"sí"| Discard["Pedir descarte de sesión"]
    Session -->|"no"| Tab{"Pestaña no es Inicio"}
    Tab -->|"sí"| Home["Ir a Inicio"]
    Tab -->|"no"| System["Delegar en Android"]
```

*Las capas visuales prevalecen sobre rutas anidadas, sesión y pestaña; solo Inicio sin superficie administrada devuelve el control al sistema.*

Los `Modal` nativos y las pantallas de recuperación/fallo figuran por separado en `SYSTEM_OWNED_SHELL_SURFACES`: React Native gestiona `onRequestClose` de los modales y las pantallas de arranque delegan en el sistema; no participan en el resolvedor global. Al crear una superficie, regístrela con propietario y prioridad si debe responder a Atrás; renderizarla no basta.

## Sesión, avisos locales y retorno a primer plano

Al iniciar una sesión se solicita permiso de notificaciones y, en Android, se crea o consulta el canal local `rest_end_alert` con importancia máxima, sonido, vibración, visibilidad pública y `bypassDnd`. Los errores se trazan y no impiden continuar con el entrenamiento. El shell prepara el aviso de descanso al entrar en un descanso programable: cancela avisos anteriores, valida sesión y preferencias y programa una notificación fechada con el instante esperado. Al pasar a segundo plano persiste el reloj conciliado y conserva el aviso armado solo si sigue siendo aplicable.

En primer plano, el temporizador reproduce la alerta interna al terminar el descanso. El `setNotificationHandler` suprime banner y sonido de una notificación de descanso recibida en primer plano para evitar duplicados. Los listeners, la bandeja y la última respuesta aportan evidencia de entrega y el retraso respecto de `expected_at_ms`; esa evidencia decide si se reproduce la alerta interna recuperada en la ventana de respaldo.

## Variantes Expo, export web y aislamiento

`app.config.ts` exige `APP_ENV` y acepta `development`, `staging` o `production`. Cada variante recibe nombre, identificadores iOS/Android, canal de política y espacio de nombres. Desarrollo usa proveedor `fake` por defecto y puede cambiar a `byok` con `DEV_PROVIDER_MODE`; staging y producción usan `byok`. La configuración inyecta esos valores, versión de configuración y metadatos de política en `expo.extra`, y configura el endpoint de incidencias.

Al arrancar, `resolveRuntimeEnvironment` rechaza extras ausentes, híbridos o incompatibles y metadatos de política inválidos. AsyncStorage y SecureStore no productivos se prefijan con el espacio de nombres; producción conserva claves canónicas. Así las instalaciones de prueba no comparten estado local con producción. Esta separación pertenece al runtime: no se configura desde la landing ni se expone como contenido HTML.

`npm --workspace apps/mobile run build:web` ejecuta `expo export --platform web` y usa `APP_ENV=development` si no se proporciona otro. El despliegue de Vercel prepara primero el snapshot de política para producción, fuerza `APP_ENV=production`, exporta web a `dist` y publica ese directorio sin un framework gestionado. Por tanto, una modificación de `public/index.html` debe verificarse en el `dist/index.html` producido por el mismo export que se desplegará, y una modificación de configuración debe conservar un `APP_ENV` válido.

El manifiesto declara `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` y `SCHEDULE_EXACT_ALARM` en Android, y bloquea explícitamente `USE_EXACT_ALARM`, instalación de paquetes, micrófono y ventanas superpuestas. `app.config.ts` añade dinámicamente `expo-notifications` con sonidos empaquetados. No se declara permiso de servicio en primer plano.

## Validación enfocada

Use controles proporcionales al límite modificado:

```bash
npm --workspace apps/mobile exec tsc --noEmit
npm --workspace apps/mobile run test:deterministic -- shell/shellRegistry.test.ts shell/shellRegistry.contract.test.ts shell/safeArea.contract.test.ts
npm --workspace apps/mobile run build:web
node apps/mobile/scripts/shell-navigation.e2e.mjs
npm --workspace apps/mobile run test:storage-recovery:e2e
```

Después de `build:web`, inspeccione `apps/mobile/dist/index.html` sin ejecutar JavaScript: debe conservar los metadatos, JSON-LD, `noscript`, `#root` y la landing esperados. Compruebe las URLs de canónica, imagen y enlaces como recursos de producción; la exportación solo demuestra que se emitieron, no que un host externo responda ni que un buscador indexe la página.

`shell-navigation.e2e.mjs` exporta un bundle web de desarrollo en modo BYOK, sirve `dist` localmente y precarga una fixture en el namespace de `localStorage` de desarrollo. En Chromium espera a que React muestre Inicio, ejercita los seis destinos y varias capas, y comprueba los selectores de formato compacto a 390 px y escritorio a 960 px, sin errores de página. En ambos anchos también abre el diagnóstico de almacenamiento: inserta un canario en catálogos, configuración de credenciales y una clave desconocida, crea 41 artefactos de índice y verifica que la medición y el informe copiado no lean ni filtren los datos privados, ni modifiquen los artefactos. Esto valida el shell React montado —incluido ese recorrido de diagnóstico—, no la indexación, los metadatos ni el fallback estático para rastreadores. `shellRegistry.test.ts` cubre destinos, prioridad determinista y los fallbacks plantilla/sesión/pestaña/sistema, incluso mediante propiedades sobre combinaciones de capas. `shellRegistry.contract.test.ts` exige una suscripción estable, estados y handlers exhaustivos y `testID` para cada superficie. `safeArea.contract.test.ts` es estática: cubre todos los fuentes de la app y protege los insets de Android. Para cambios en permisos, canales, audio o alarmas, la exportación web no basta: valide una compilación nativa con permisos concedidos y denegados y una transición real a segundo plano/primer plano.
