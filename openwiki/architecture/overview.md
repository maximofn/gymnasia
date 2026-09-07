---
type: arquitectura de producto
title: Arquitectura local-first
description: Gymnasia es un cliente Expo local-first para móvil y web, con estado personal en el dispositivo. Esta página delimita los catálogos, proveedores BYOK y el único servicio remoto opcional para no convertirlos en un backend de producto.
tags: [local-first, mobile, web, byok, privacy]
verified:
  - by: openwiki/0.5.0
    at: 2026-09-07T11:37:28.236Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-c2d1a0c89805fc4fc01238e2
    resource: repo://apps/anthropic_proxy/cors-proxy.py
  - id: openwiki-source-00f3917787dfe248860adc3b
    resource: repo://apps/feedback-worker/src/index.ts
  - id: openwiki-source-3cfa88bf1d888145532ec324
    resource: repo://apps/feedback-worker/test/handler.test.ts
  - id: openwiki-source-08bfc20c1f23c70bb8990d47
    resource: repo://apps/feedback-worker/wrangler.jsonc
  - id: openwiki-source-0c30fc96b9e7c8b57c35473c
    resource: repo://apps/mobile/agent/agentPolicyRuntime.ts
  - id: openwiki-source-2d700f6a4bc31347c3488941
    resource: repo://apps/mobile/agent/policyDeployment.ts
  - id: openwiki-source-cc29928f3ae5e1998f27d57a
    resource: repo://apps/mobile/agent/providerTransport.ts
  - id: openwiki-source-a9edace0149f999b4868ad8d
    resource: repo://apps/mobile/agent/signedPolicyRuntime.ts
  - id: openwiki-source-a6ba9053969a3e00cd971742
    resource: repo://apps/mobile/app.config.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
  - id: openwiki-source-10afa4ec1c37f1f581a11096
    resource: repo://apps/mobile/catalogs/runtime.ts
  - id: openwiki-source-38c56531000e6ccc59045ff7
    resource: repo://apps/mobile/catalogs/sources.ts
  - id: openwiki-source-7a047b00a95eb325eb147887
    resource: repo://apps/mobile/environment.ts
  - id: openwiki-source-12bdb95b5f863aab1ff9964a
    resource: repo://apps/mobile/index.js
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-1d477406340582311e84da48
    resource: repo://apps/mobile/runtimeEnvironment.ts
  - id: openwiki-source-f5a826b1adfe83cfcc01ce9c
    resource: repo://apps/mobile/vercel.json
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.5.0", at: "2026-09-07T11:37:28.236Z" }
---

# Arquitectura local-first

Gymnasia tiene una única superficie de producto: `apps/mobile`. `index.js` registra el mismo `App` de Expo para Android, iOS y web. Entrenamientos, dieta, medidas, conversaciones y preferencias no dependen de una cuenta ni de una API de Gymnasia: se crean y se conservan localmente. La red puede enriquecer una función concreta, pero no confirma ni autoriza las mutaciones de esos dominios.

La excepción autorizada es `apps/feedback-worker`: recibe voluntariamente propuestas e informes y crea *issues* en GitHub sin exponer el token de escritura al cliente. Si no está configurado o falla, la aplicación sigue siendo utilizable. La distribución de política firmada y los catálogos son entradas remotas verificadas o cacheables, no servicios que sincronicen datos personales. El sitio `arquitectura-agente/` es un tablero estático independiente y no forma parte del runtime de `App`.

```mermaid
flowchart TD
    User["Usuario"] --> Client["Cliente Expo local"]
    Client --> State["Estado local AsyncStorage"]
    Client --> Secrets["Credenciales SecureStore nativo"]
    Client --> Catalogs["Catálogos GitHub Raw"]
    Client --> Policy["Política firmada por canal"]
    Client --> BYOK["Proveedores BYOK"]
    BYOK --> OpenAI["OpenAI"]
    BYOK --> Anthropic["Anthropic directo"]
    BYOK --> Google["Google"]
    Client -. "envío voluntario" .-> Feedback["Worker de feedback opcional"]
    Feedback --> GitHub["GitHub Issues privado"]
    Client -. "depuración web opt in" .-> Proxy["Proxy Anthropic loopback"]
    Proxy --> Anthropic
```

*Figura 1. El límite local-first: el cliente posee el estado; catálogos, política, proveedores y feedback son salidas o entradas remotas independientes.*

## Límites y responsabilidades

| Límite | Responsabilidad | No debe convertirse en |
|---|---|---|
| `apps/mobile` | Shell Expo, dominios de entrenamiento y dieta, agente, persistencia, backup y adaptadores de red. | Cliente de una API central, identidad de Gymnasia o sincronización implícita. |
| Política del agente | Snapshot integrado en `Local`; en `Staging` y `Production`, resolución y verificación de un artefacto firmado para el canal. | Prompt remoto libre ni almacén de datos del usuario. |
| Catálogos | Referencias de alimentos, productos, recetas y ejercicios publicadas como JSON; se validan y cachean en el cliente. | Estado personal o fuente de autoridad sobre los registros del usuario. |
| Proveedores de IA | OpenAI, Anthropic y Google reciben una clave que aporta el usuario y el contexto necesario para su petición. | Backend o cuenta compartida de Gymnasia. |
| `apps/feedback-worker` | Valida feedback e informes y custodia la credencial para crear *issues* privados. | Autenticación, base de datos de producto o sincronización. |
| `apps/anthropic_proxy` | Pasarela local opt-in para depurar Anthropic desde web. | Infraestructura desplegada o ruta de producción. |

No se deben inferir una base de datos, cuentas centralizadas o una API de producto a partir de documentos históricos. Un cambio que haga que guardar actividad, dieta o conversaciones requiera una respuesta de red rompe este límite y requiere diseñar explícitamente identidad, sincronización, conflictos, recuperación y borrado.

## Arranque, dominios y aislamiento por variante

`app.config.ts` exige `APP_ENV` y compila `development`, `staging` o `production`. La variante fija nombre, identificador de aplicación, canal de política y *namespace* de almacenamiento. Desarrollo usa el canal `Local` y, salvo que se pida `DEV_PROVIDER_MODE=byok`, proveedores falsos deterministas; Staging y Production usan BYOK. El runtime vuelve a validar que la configuración pública no mezcle versión, entorno, canal, namespace y modo de proveedor.

Las claves de `AsyncStorage` y de SecureStore se derivan de la variante. Development y Staging se prefijan para no mezclar instalaciones; producción conserva las claves de producción y excluye los prefijos no productivos. Por ello, una migración de claves o de backup debe respetar el ámbito activo, no enumerar o borrar indiscriminadamente el almacenamiento del dispositivo.

`LocalStore` reúne plantillas, historial de entrenamiento, dieta, medidas, hilos y mensajes, además de selección de proveedor. El repositorio de recuperación mantiene la copia principal, un último snapshot válido y una cuarentena; durante la hidratación puede normalizar datos reparables, pero detiene la carga para recuperar o tratar datos corruptos. El borrado local elimina y verifica las familias administradas, incluidas las copias de recuperación y las sesiones dependientes.

## Persistencia, secretos y privacidad

El estado general se serializa en `AsyncStorage`. Las claves API no deben ir en esa serialización: en nativo, la configuración de proveedores usa `expo-secure-store` cuando está disponible y la app informa de un fallo de ese almacén sin perder el estado principal. En web la configuración de proveedor se guarda con el almacenamiento local disponible en el navegador; no tiene la garantía de un secreto del servidor ni la protección equivalente a SecureStore nativo.

Una exportación `.gymnasia` es una copia local iniciada por la persona usuaria. Incluye datos seleccionados y fotos de progreso normalizadas, pero excluye claves API y cachés remotas; conversaciones y demás datos sensibles del backup no se cifran automáticamente. Importar, exportar o añadir una nueva categoría de datos debe conservar esa distinción y el borrado verificable.

El espejo `/dev-store` solo se habilita en preview web de desarrollo con `EXPO_PUBLIC_DEV_STORE_MIRROR=1`. Es una comodidad local, no un mecanismo de persistencia publicado, y no escribe claves BYOK. La exportación web es estática mediante `expo export --platform web`; `app.json` declara plugins y permisos nativos, así que no se debe asumir que la web tenga las mismas capacidades de notificación, audio o almacén seguro.

## Catálogos: referencias remotas recuperables

Los catálogos remotos de `alimentos/`, `productos_comerciales/`, `recetas/` y `ejercicios/` se obtienen desde `all.json` en GitHub Raw. Cada definición aporta URL, procedencia, clave de caché y parser. Antes de aceptar una descarga se comprueba el esquema; el sobre persistido incluye versión, fuente, fecha, ETag, procedencia y hash SHA-256 del contenido ya validado.

Al arrancar puede utilizarse una caché válida marcada como `cached` o `stale`. Al refrescar, un HTTP inválido, JSON malformado, esquema inválido o fallo de red conserva el snapshot anterior y señala el fallo en vez de borrar los datos disponibles. Los alimentos personales son otro origen, `local://device`, y no se envían ni se sustituyen por GitHub Raw. Este diseño permite uso offline sin convertir el catálogo en una dependencia de arranque.

## Política y llamadas de IA

El agente obtiene un *lease* de política al iniciar una conversación o un turno. En `Local` usa el snapshot integrado. En los canales remotos, el runtime resuelve una activación, descarga el bundle y su firma, comprueba hash, firma Ed25519, entorno, canal y contrato de herramientas contra raíces públicas integradas. Puede recurrir a caché o snapshot integrado según el resultado de verificación, pero no debe aceptar contenido remoto no autenticado.

El *lease* congela prompt, política sanitaria combinada, procedencia y contexto de activación para ese uso. El flujo de chat usa esa selección al clasificar entrada y salida y adjunta `policy_context`; modificar la entrega de política exige preservar también los contratos sanitarios y de herramientas.

Los proveedores son BYOK y se consumen desde el cliente. En particular, Anthropic usa en web la cabecera `anthropic-dangerous-direct-browser-access`, por lo que la clave del usuario y el contenido de la solicitud son visibles dentro de la frontera del navegador y se transmiten al proveedor. OpenAI y Google también se llaman directamente. Esta es una decisión de privacidad: BYOK no transforma una clave de navegador en un secreto de servidor ni crea identidad de Gymnasia.

`EXPO_PUBLIC_API_BASE_URL` está vacío por defecto. Solo una configuración explícita en web redirige Anthropic al proxy local. El proxy escucha en loopback, rechaza clientes remotos y no debe desplegarse; adapta el cuerpo con la clave BYOK a la cabecera upstream y limita los errores que devuelve. Sus rutas de salud, verificación, modelos y mensajes son útiles para depurarlo, no una dependencia de la aplicación publicada.

## Feedback: la única integración remota opcional

La URL de feedback queda vacía por defecto en desarrollo y se configura para Staging y Production; un override solo sirve para desarrollo. El resolver rechaza URLs inválidas, credenciales embebidas, query o fragmento, y solo permite HTTP loopback en desarrollo. Si falta o falla la validación, devuelve `unavailable` sin impedir el arranque.

El Worker expone salud y acepta únicamente `POST /feedback/issues`. Puede apagarse con `FEEDBACK_ENABLED=false`, aplica CORS a orígenes configurados, valida el payload y limita la tasa con un identificador de IP pseudonimizado mediante HMAC. Reserva una clave de idempotencia antes de crear la issue: un reintento ya completado devuelve la misma issue y una reserva en curso solicita reintento, evitando duplicados. El token y el repositorio de GitHub viven exclusivamente en el entorno del Worker.

La tarea programada redacta informes que superan 30 días y poda contadores de límite de tasa. D1 conserva solo lo necesario para idempotencia, límites y ese ciclo de retención. No amplíe este Worker hacia perfiles, sesiones, telemetría de producto o copias de los dominios locales sin una excepción de arquitectura explícita y sus controles de privacidad.

## Invariantes para cambios seguros

1. **El dispositivo es la autoridad del producto.** Las funciones principales deben operar sin red y recuperar estado localmente.
2. **Las variantes aíslan estado y comportamiento.** Toda clave persistente o segura nueva debe usar el ámbito de `runtimeEnvironment`.
3. **Lo remoto se valida antes de usarse.** Mantenga esquema, hash, firma, procedencia y fallback al cambiar catálogos o política.
4. **Los secretos tienen una frontera distinta del resto del estado.** No serialice claves BYOK en `LocalStore`, backups, trazas ni el espejo de desarrollo; comunique la menor garantía de web.
5. **El contexto de IA sale del cliente.** Documente y minimice qué se transmite a cada proveedor; no presente BYOK como confidencialidad de servidor.
6. **Feedback sigue siendo opcional e idempotente.** Mantenga custodia del token, validación, límites, deduplicación y retención.

## Validación enfocada

Antes de cambiar estos límites, ejecute al menos:

```bash
npm --workspace apps/mobile exec tsc --noEmit
npm test
npm run check:health-safety
npm run policy:bundle:check
npm run check:policy-trust
npm run check:anthropic-proxy
npm --workspace apps/mobile run build:web
npm --workspace apps/feedback-worker run test
```

Para catálogos, añada `npm run check:catalogs`, `npm run test:catalogs` y `npm run test:catalogs:e2e`; para el proxy, `npm run test:proxy`. Los scripts de raíz incluyen pruebas deterministas de la app y del espejo de desarrollo, pruebas de contratos de catálogos y política, compilación web y E2E específicos como agente, recuperación de almacenamiento y flujos de entrenamiento o dieta. La suite del Worker usa un entorno y base de datos falsos, por lo que verifica creación, rechazo, límites, deduplicación y retención sin token ni red reales.
