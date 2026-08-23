# Checklist de cambios que afectan a la privacidad (GYM-190)

La política publicada envejece en silencio. Nadie la lee al añadir una clave de
almacenamiento o al llamar a un host nuevo, y el desajuste no da error: simplemente
llega un día en que el documento publicado ya no describe la aplicación, y quien lo
descubre es la revisión de Google Play.

Esta checklist es el paso obligatorio cuando el guard rail falla, y la revisión
recomendada antes de cada publicación.

## Cuándo aplica

Si un cambio toca cualquiera de estas cosas, recórrela entera:

- una clave de AsyncStorage o una entrada de SecureStore, nueva o retirada;
- un host al que la aplicación se conecta;
- un permiso de Android;
- lo que se envía a un proveedor de IA;
- el contenido del fichero de copia de seguridad;
- lo que borra "Restablecer datos locales";
- una función que use cámara, galería o notificaciones;
- añadir o quitar un proveedor de IA.

## Pasos

1. **Actualiza el inventario.** `scripts/data-inventory/inventory.json`: la entrada
   nueva necesita `purpose`, `personal`, `dataCategory` y `clearedBy`; un destino
   necesita `trigger` y `sends`.
2. **Comprueba que el guard rail vuelve a estar verde.**
   ```bash
   npm run check:data-inventory
   npm run test:data-inventory
   ```
3. **Decide si la política cambia.** Si el dato o el destino es visible para el usuario
   —o afecta a lo que puede esperar— la política cambia. Edita
   `docs/legal/privacy-policy.es.md` **y** `docs/legal/privacy-policy.en.md`: las
   secciones deben seguir siendo las mismas y estar en el mismo orden en ambos idiomas.
4. **Sube la versión** en el `version` de ambos documentos y actualiza `effective_date`.
   El formato es `AAAA-MM-vN`.
5. **Regenera y verifica.**
   ```bash
   npm run sync:legal
   npm run check:legal
   npm run test:legal
   ```
6. **Revisa las declaraciones de Play.** `docs/legal/play-declarations.md`: si cambia
   una categoría de datos, un permiso o un tercero, la tabla de Data safety cambia con
   ella. Si la ficha ya está publicada, hay que reenviar el formulario.
7. **Publica.** El HTML generado se sirve desde `apps/mobile/public/`, en el proyecto
   Vercel **`gymnasia-web`** (no `gymnasia`, que es el tablero). El push a `main` **no**
   despliega: hay que lanzar la CLI a mano, enlazando antes porque `apps/mobile/.vercel/`
   está git-ignored.
   ```bash
   npm exec --yes -- vercel@latest link --yes --project gymnasia-web --cwd apps/mobile
   npm exec --yes -- vercel@latest deploy --prod --yes --cwd apps/mobile
   ```
   La salida debe decir `Deploying gymnasia-web`. Si dice `Created`, detente.

## Verificación de lo publicado

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://gymnasia.maximofn.com/privacidad
curl -sS https://gymnasia.maximofn.com/privacidad | grep -o 'gymnasia-policy-version" content="[^"]*"'
curl -sS https://gymnasia.maximofn.com/privacidad | grep -o 'gymnasia-policy-digest" content="[^"]*"'
grep PRIVACY_POLICY_DIGESTS -A 3 apps/mobile/agent/generated/legalCopy.generated.ts
```

El digest publicado debe coincidir con el del módulo generado. Si no coincide, lo que
hay en producción no es lo que se revisó en el PR.

## Revisiones pendientes anotadas

Cosas que hay que rehacer cuando cierren otros tickets. No son opcionales: la política
publicada afirma hoy cosas que dejarán de ser ciertas.

- **GYM-162 (borrado completo)**: la sección `#eliminacion` describe hoy un borrado
  parcial y enumera lo que *no* se borra. Al arreglar `resetLocalData`, reescribir esa
  sección, subir versión y republicar.
- **GYM-188 (retirar el actualizador de GitHub)**: elimina `api.github.com` del
  inventario si deja de usarse por completo, y ajusta `#terceros`.
- **GYM-189 (denuncia dentro de la app)**: sustituir en `#denuncia` el canal de correo
  por la acción in-app, y actualizar la declaración de IA generativa.
- **GYM-147 (idioma de la app)**: cuando exista `appLanguage`, el enlace de la app debe
  elegir entre las dos URLs de la política en vez de apuntar siempre a la española.
