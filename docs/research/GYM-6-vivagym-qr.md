# GYM-6 · Cómo obtiene VivaGym el QR de acceso

Investigación de interoperabilidad (cuenta propia, fines de aprendizaje) sobre cómo la
app oficial de **VivaGym** genera el QR de acceso, para valorar y reproducir el flujo en
GYMNASIA.

> **Estado desde 2026-08-24:** la integración está retirada de todas las variantes por
> GYM-192 (ticket para retirar temporalmente VivaGym de la versión pública). Este
> documento conserva la investigación histórica para una posible reintroducción; no
> describe una función disponible ni código incluido en el AAB.

## Resumen

- La app oficial es **VivaGym MyApp** (`com.myvitale.vivagym.group`), nativa Android.
- El backend es **MyVitale** (Vitale Intelligent Training System): base `https://vivagym.myvitale.com/`.
- El QR **lo emite el servidor** bajo demanda; la app solo lo pide y lo pinta con zxing.
- **Es replicable**: basta con reproducir 3 peticiones HTTP. No hay criptografía en cliente
  ni certificate pinning.

## Método

- Se extrajo el APK/XAPK (v2.0.12) y se decompiló con `jadx` (análisis estático).
- Se verificó el flujo en vivo contra la API real (pasos 1–3) con una cuenta propia.
- No hizo falta MITM: la red no usa pinning (`res/xml/network_security.xml` sin `<pin-set>`).

## Flujo de autenticación y obtención del QR

Base URL: `https://vivagym.myvitale.com`

### 1) Token de app (OAuth2 client_credentials)

No usa datos de usuario. `client_id`/`client_secret` van embebidos en el APK (`BuildConfig`).

```http
GET /oauth/v2/token?grant_type=client_credentials&client_id=<CLIENT_ID>&client_secret=<CLIENT_SECRET>
User-Agent: okhttp/4.12.0
```

Respuesta:

```json
{ "access_token": "<APP_TOKEN>", "expires_in": 3600, "token_type": "bearer", "scope": null }
```

### 2) Login de usuario

```http
POST /api/v2.0/exerp/newAuth
Content-Type: application/x-www-form-urlencoded

access_token=<APP_TOKEN>&email=<EMAIL>&password=<PASSWORD>&appName=vivagym
```

- 200 → `{ "access_token": "<USER_TOKEN>", "refresh_token": "...", "expires_in": 3449, ... }`
- 400 (credenciales inválidas) → `{ "message": "Usuario y/o contraseña no válido. Prueba de nuevo.", "code": 400 }`

El token de usuario dura ~57 min.

### 3) Obtener el QR

El interceptor de la app añade `Authorization: Bearer <token>` a toda ruta con `api`.

```http
GET /api/v2.0/exerp/qr
Authorization: Bearer <USER_TOKEN>
```

Respuesta `200`: un **String en texto plano** (el contenido del QR). Con el token de app en
vez del de usuario, devuelve `500` (requiere sesión de usuario).

## Formato del QR y datos que codifica

```
exerp:checkin:631p4559-1783608395440-bf044a991260a20e6cfbd1e720f1d90a
```

| Parte           | Ejemplo                              | Significado                                   |
|-----------------|--------------------------------------|-----------------------------------------------|
| Prefijo         | `exerp:checkin:`                     | Acción de check-in en Exerp (fijo)            |
| ID socio        | `631p4559`                           | Identificador del socio (constante)           |
| Timestamp       | `1783608395440`                      | Milisegundos (`Date.now()` al generarlo)      |
| Firma           | `bf044a99…f1d90a` (32 hex, 128 bit)  | HMAC/MD5 con secreto de servidor              |

- **Rota en cada petición** (verificado: dos llamadas con 2 s de diferencia cambian
  timestamp y firma).
- La validación del torno la hace el servidor de Exerp (firma + frescura del timestamp).
- La app renderiza el string con zxing: `QRCodeWriter().encode(str, QR_CODE, 512, 512)`.

## Conclusión de viabilidad

**Viable.** GYMNASIA puede mostrar un QR de acceso válido reproduciendo los 3 requests y
pintando el string devuelto. Consideraciones:

- **No falsificable offline** (la firma la calcula el servidor con un secreto que no
  tenemos), pero **no es necesario**: se pide el QR igual que la app oficial.
- Como el QR **rota y caduca**, hay que **pedir uno fresco al mostrarlo** y ofrecer refresco.
- Requiere guardar las credenciales de VivaGym del usuario (email + password) de forma
  segura (SecureStore). Alternativa: guardar el `refresh_token`.
- `QrActivity` de la app usa `FLAG_SECURE` (bloquea capturas del QR).

## Notas

- `client_id`/`client_secret` son credenciales **de app** (no del usuario) y son
  trivialmente extraíbles del APK público; se embeben igual que en la app oficial.
- Revisar los términos de uso de VivaGym antes de cualquier uso en producción.
- La implementación histórica fue GYM-7 (ticket que implementó el QR de VivaGym).
- Antes de reintroducirla hay que confirmar el encaje autorizado, reutilizar las claves
  heredadas `vivagym.email` y `vivagym.password`, resolver GYM-154 (ticket para
  endurecer solicitudes, validación y persistencia de VivaGym) y GYM-155 (ticket para
  proteger secretos y códigos QR de VivaGym), actualizar la documentación legal y
  volver a inspeccionar el AAB.
