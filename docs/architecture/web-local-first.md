# Web local-first

La versión web de Gymnasia se publica como un export estático de Expo. No tiene
backend ni base de datos: el estado de la app se conserva en `AsyncStorage`, que
en navegador usa `localStorage`.

## Decisiones de la primera publicación

- `localStorage` es suficiente para la primera versión. El estado actual es un
  JSON único y el backup manual ya permite descargar/importar todos los datos.
  IndexedDB se reserva para una migración futura si fotos o historiales hacen
  crecer el payload por encima de los límites prácticos del navegador.
- Las API keys BYOK se guardan en el almacenamiento local del navegador porque
  `expo-secure-store` no ofrece un almacén seguro equivalente en web. La pantalla
  de Proveedor IA lo advierte explícitamente. En móvil siguen usando SecureStore.
- El mirror `apps/mobile/.dev-store.json` está desactivado por defecto. Solo se
  consulta y escribe con `__DEV__`, `EXPO_PUBLIC_DEV_STORE_MIRROR=1` y Metro
  servido en loopback. Antes de tocar disco se censuran recursivamente claves
  BYOK, identificadores de workspace y cualquier campo de credencial conocido;
  el endpoint `/dev-store` no admite CORS, LAN ni cuerpos sin validar.
- OpenAI y Google se llaman directamente desde el navegador. Anthropic queda
  desactivado por defecto en producción por CORS: solo se habilita si el build
  recibe `EXPO_PUBLIC_API_BASE_URL` apuntando a un proxy compatible con las rutas
  `/chat/providers/anthropic/{verify,models,messages}`.
- La creación automática de issues en GitHub queda desactivada en el cliente
  estático. Un token de escritura nunca se inyecta en `EXPO_PUBLIC_*`; esa
  integración requiere un proxy/backend confiable.
- Cámara, notificaciones nativas y audio de fondo son funciones degradadas en web. La
  app mantiene los controles disponibles cuando el navegador los soporta; las
  notificaciones de descanso y el audio nativo no se consideran garantías de la
  publicación web.

## Build y publicación

Desde la raíz:

```bash
npm install
npm --workspace apps/mobile run build:web
```

El resultado queda en `apps/mobile/dist/` y la configuración de Vercel está en
`apps/mobile/vercel.json`. Para el build público no se debe pasar `--dev`.

Para probar Anthropic localmente antes de un build de desarrollo:

```bash
apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm --workspace apps/mobile run web
```

Para conservar además el estado no sensible entre reinicios de Metro, usa el
modo explícito de espejo local:

```bash
npm --workspace apps/mobile run web:mirror
```

Este modo solo funciona desde `localhost`, `127.0.0.1` o `::1`. El archivo se
reemplaza de forma atómica, con permisos privados, un máximo de 5 MiB y un
esquema de transporte cerrado. `npm run test:dev-store` impide también que el
archivo llegue a versionarse mediante un alta forzada en Git.

La publicación de producción requiere además asociar el proyecto de Vercel al
dominio `gymnasia.maximofn.com` y crear su CNAME en Cloudflare. Esa configuración
DNS no forma parte del bundle estático.
