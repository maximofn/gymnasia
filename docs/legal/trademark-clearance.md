# Comprobación preliminar de la marca «Gymnasia» (GYM-193)

> **Esto no es un dictamen jurídico.** Es una investigación preliminar de
> disponibilidad hecha con fuentes públicas por el equipo del producto, no por un
> agente de la propiedad industrial. No sustituye a un informe profesional de
> viabilidad ni garantiza que el uso del nombre esté libre de riesgo. Sirve para
> decidir si se sigue adelante con la ficha de Google Play o si hay que parar.

- **Fecha de la comprobación:** 22 de agosto de 2026 (consultas registrales
  reproducidas y perfiles sociales verificados a mano el 23 de agosto de 2026,
  con idéntico resultado)
- **Signo evaluado:** `Gymnasia` (denominativo)
- **Identidad actual del producto:** `apps/mobile/app.json` → `name: "Gymnasia"`,
  `package: "com.maximofn.gymnasia"`, dominio en uso `gymnasia.maximofn.com`
- **Territorios evaluados:** España (mercado de lanzamiento) y Unión Europea
- **Sectores evaluados:** software, fitness y salud
- **Decisión:** **continuar con el nombre**, con las mitigaciones de la sección
  «Decisión y condiciones». No se bloquean GYM-195 ni GYM-197.

## Resumen

No existe ninguna marca ni nombre comercial registrado o solicitado que contenga
la cadena «gymnasia» en España ni en la Unión Europea, en ninguna clase y en
ningún estado. El riesgo registral en el territorio de lanzamiento es, por tanto,
el más bajo posible: cero coincidencias.

Sí existe uso comercial del nombre por terceros no relacionados: una cadena de
gimnasios francesa con app propia publicada en Google Play bajo el nombre exacto
«Gymnasia», una app de gestión de gimnasios turca llamada «GYMNASIA» en la App
Store, y casi todos los dominios de primer nivel relevantes ocupados. Ninguno de
esos usos está protegido por un registro con efectos en España o la UE, y ninguno
es español.

La conclusión operativa es que se puede lanzar, pero que **el nombre no es
exclusivo ni fácilmente apropiable**: «Gymnasia» está a una letra de «gimnasia»,
palabra descriptiva del castellano para la actividad del propio producto, lo que
debilita cualquier pretensión de exclusiva y a la vez explica por qué nadie la ha
registrado.

## Alcance y método

| Fuente | Qué cubre | Cómo se consultó |
| --- | --- | --- |
| TMview (TMDN) | Base agregada que incluye los registros de la **OEPM** (marcas `M…` y nombres comerciales `N…`) y de la **EUIPO** (marcas de la Unión) | API pública `POST https://www.tmdn.org/tmview/api/search/results`, criterio `C` (contiene), filtro de oficinas `["ES","EM"]`, sin filtro de estado ni de clase |
| Google Play | Apps publicadas con el término en el nombre | Búsqueda web y descarga directa de las fichas con `hl=es&gl=ES` |
| App Store | Apps publicadas con el término en el nombre | Búsqueda web |
| DNS / RDAP | Ocupación de dominios | `dig` contra `8.8.8.8` y RDAP de Verisign |
| Perfiles públicos | Handles en GitHub y redes | API pública de GitHub; Instagram, X y LinkedIn revisados a mano con sesión iniciada |

Clases de Niza consideradas relevantes para este producto: **9** (software),
**41** (entrenamiento y actividad deportiva), **44** (servicios de salud), y de
forma secundaria **35** y **42**.

Términos consultados: `gymnasia`, `gimnasia`, `gymnasium`, `gymnasio`,
`gimnasya`.

## Resultados registrales

### OEPM y EUIPO — coincidencias exactas

Búsqueda de `gymnasia` (contiene), oficinas `ES` + `EM`, todos los estados y
todas las clases:

**0 resultados.**

La consulta de control con el término `gimnasio` sobre el mismo filtro devolvió
80 resultados, lo que confirma que el filtro de oficinas funcionaba y que el cero
anterior es un cero real, no un fallo de la consulta.

Búsqueda de `gymnasia` sin filtro de oficina: 45 resultados en todo el mundo
(GE, FR, MA, IL, CZ, CA, AU, IN, US, GB, WO, BR, CN, CH, TR, DE). **Ninguno en
España ni en la EUIPO.** Los más cercanos por sector y por clase:

| Oficina | Titular | Clases | Estado | Solicitud |
| --- | --- | --- | --- | --- |
| CH | Swiss Education Institute AG | 9, 41, 42 | Registrada | 2024-12-03 |
| GB / WO | ISF International School Sport Federation | 25, 41 | Registrada | 2015-06-01 |
| FR | FRANK JANIK; DUPAS SPORT SAS | 25, 41 | Registrada | 2020-08-19 |
| FR | MAN SAS | 16, 25, 28, 35, 38, 41 | Registrada | 2024-12-20 |
| US | Gymnasia, LLC | 41 | Extinguida | 2015-12-05 |

El registro internacional WO 1256471 (ISF) designa GB, no la UE: no aparece en la
consulta filtrada por `EM`.

### OEPM y EUIPO — signos similares

`gimnasia` en ES/EM: 37 resultados, 32 vivos en clases 9/35/41/42/44. **Todos**
son marcas compuestas o figurativas en las que «gimnasia» es el elemento
descriptivo dentro de una denominación más larga: `REAL FEDERACIÓN ESPAÑOLA DE
GIMNASIA`, `GIMNASIA ESTÉTICA DE GRUPO`, `CLUB GIMNASIA RÍTMICA AMANTES DE
TERUEL`, `GIMNASIA FINANCIERA`, `GIMNASIA SUTIL`, `GIMNASIA EMOCIONAL`… Ninguna
es la palabra «GIMNASIA» a secas, porque en clase 41 es descriptiva y no sería
registrable por sí sola.

Ninguna de las 32 incluye la clase 9. La única marca viva en ES/EM que combina un
signo parecido con la clase 9 es:

- **GYMNASIUM**, denominativa, EUIPO 004825758, NAVIGARE S.R.L., clases 3, 9, 14,
  16, 18, 25, registrada desde 2005-12-23. El conjunto de clases (cosmética,
  joyería, marroquinería, ropa) es el típico de una marca de moda, donde la clase
  9 suele cubrir gafas, no software. Signo distinto («GYMNASIUM» ≠ «Gymnasia») y
  sector distinto: riesgo bajo, pero queda anotado.

`gymnasio` en ES/EM: 1 resultado, un colegio griego (figurativa, clase 41).
`gimnasya` en ES/EM: 0 resultados.

## Resultados comerciales

### Google Play

| App | Package | Desarrollador | Categoría | Observación |
| --- | --- | --- | --- | --- |
| **Gymnasia** | `com.gymnasia.programs` | GYMNASIA | Salud y bienestar / Familia | Coincidencia exacta de nombre. Ficha localizada al español («Gymnasia los expertos en fitness y salud»), actualizada el 27 de julio de 2026. Contacto `VILLEFRANCHE@GYMNASIA.FR` y política en `api-gymnasia.azeoo.com`: es la app de marca blanca (plataforma AZEOO) de la cadena de gimnasios francesa de `gymnasia.fr` |
| Fitness Freak La Gymnasia | `com.app.fitnessfreaklagymnasia` | CLICKWISE AGENCY PRIVATE LIMITED | Fitness | Contiene el término. Actualizada el 21 de enero de 2026 |

El package `com.maximofn.gymnasia` **no colisiona** con ninguno de los dos, y el
identificador de aplicación es lo único que Google Play exige que sea único: el
nombre visible de la ficha no lo es.

### App Store

- **GYMNASIA**, `id6443939029`, SENKRON BILGISAYAR OTOM LTD (Turquía). App de
  gestión de gimnasios: abonos, programas de clientes, mediciones y reservas.
  Coincidencia exacta de nombre en la misma categoría.

### Dominios

| Dominio | Estado | Qué sirve |
| --- | --- | --- |
| `gymnasia.com` | Ocupado desde 2002-05-29, renovado hasta 2029 | Sitio activo de campamentos de deportes de combate (MMA, boxeo, BJJ) |
| `gymnasia.fr` | Ocupado | Cadena de gimnasios francesa, titular de la app de Play |
| `gymnasia.app` | Ocupado | Página de reserva «Coming Soon» en Squarespace |
| `gymnasia.io` | Ocupado | Sitio «Gymnasia» montado en el creador de webs de GoDaddy |
| `gymnasia.net` | Ocupado | En venta (Dan.com) |
| `gymnasia.org`, `gymnasia.fit` | Ocupados | Gimnasio nº1 de Sebastopol (centro escolar ruso) |
| `gymnasia.eu` | Ocupado | En venta (Sedo) |
| `gymnasia.es` | **NXDOMAIN**, sin delegar | Probablemente libre. Un dominio registrado pero sin delegar también da NXDOMAIN, así que habría que confirmarlo en dominios.es antes de darlo por disponible. El proyecto no lo necesita: ver la condición 2 |

### Perfiles

- `github.com/gymnasia`: ocupado desde 2015-11-13, organización con 3 repos
  públicos.
- Instagram, X y LinkedIn devuelven 200 también para perfiles inexistentes
  cuando no hay sesión iniciada, así que la comprobación automática no sirve
  aquí. Las revisó a mano el mantenedor el 23 de agosto de 2026, con sesión:
  - **X y LinkedIn:** no hay ninguna cuenta con ese nombre.
  - **Instagram:** no hay ninguna cuenta llamada exactamente «gymnasia». Sí hay
    varias que lo contienen dentro de un nombre más largo; son gimnasios
    locales sin relación con el producto ni presencia en España.

## Valoración del riesgo

**Riesgo registral en España y la UE: bajo.** No hay derecho anterior registrado
que oponer. Nadie puede invocar en España una marca «Gymnasia» que no existe.

**Riesgo de confusión comercial: moderado y acotado.** Hay tres usos del mismo
nombre en el mismo sector (gimnasios FR, software de gimnasios TR, campamentos de
combate US/EN), pero ninguno opera en España, ninguno tiene registro con efectos
aquí, y ninguno se solapa con el producto: Gymnasia es una app local-first de
entrenamiento y nutrición para el usuario final, no un software de gestión para
clubes ni la app de una cadena concreta.

**Riesgo de política de Google Play: bajo.** Lo que Play sanciona es la
suplantación y la similitud engañosa, no el nombre repetido. Con desarrollador,
icono, package y ficha propios y sin referencias a los terceros, no se cumple el
supuesto.

**Riesgo de no poder proteger el nombre: alto, y es el hallazgo incómodo.**
«Gymnasia» se percibirá en España como una variante gráfica de «gimnasia»,
palabra que designa la propia actividad. Una solicitud en OEPM en clases 41 o 44
se expone a una objeción por carácter descriptivo (art. 5.1.c de la Ley 17/2001);
en clase 9, aplicada a software, la distintividad es mayor pero tampoco está
garantizada. Es decir: se puede usar, pero difícilmente se podrá impedir que otros
lo usen. Esa es una decisión de negocio, no un obstáculo para publicar.

## Decisión y condiciones

**Se continúa con «Gymnasia».** No hay riesgo material que justifique detener la
creación de la ficha ni la producción de recursos gráficos, de modo que GYM-195 y
GYM-197 quedan desbloqueados.

Condiciones que acompañan a la decisión:

1. **Mantener la diferenciación visual y de autoría.** El nombre de desarrollador
   y el icono no deben parecerse a los de la app francesa ni a la turca. No usar
   nunca `gymnasia.fr`, `gymnasia.com` ni sus materiales como referencia.
2. **Ningún dominio nuevo hace falta para publicar.** Google Play solo exige una
   URL pública de política de privacidad, y eso ya lo cubre
   `gymnasia.maximofn.com/privacidad`. El producto es una app local-first que se
   descubre en la tienda, no una web, así que no depende de un dominio de marca.
   `gymnasia.es` aparece libre, pero registrarlo **no es una condición del
   lanzamiento** ni protege el nombre: lo que hace frágil a «Gymnasia» es su
   proximidad con «gimnasia», y ningún dominio corrige eso. Es una compra
   defendible solo si algún día se quiere una web de marketing en dominio
   español, y esa decisión puede tomarse entonces.
3. **No prometer exclusividad del nombre** en textos de la ficha ni en materiales
   de marketing.
4. **Consultar a un agente de la propiedad industrial** antes de gastar dinero en
   identidad de marca, o antes de solicitar el registro. Si se solicita, empezar
   por la **clase 9**, que es donde el signo es más defendible, y valorar añadir
   la 41 y la 44 sabiendo que pueden objetarse.
5. **Revisar de nuevo antes de ampliar territorios.** Francia y Turquía son los
   dos mercados donde hay titulares activos del mismo nombre; en Francia además
   hay marcas registradas «Gymnasia» en clases 25 y 41. La ampliación prevista en
   GYM-201 debe repetir esta comprobación para esos países.

## Reproducir esta comprobación

La consulta registral es reproducible sin credenciales. Desde cualquier máquina
con red:

```bash
curl -sS -X POST 'https://www.tmdn.org/tmview/api/search/results' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://www.tmdn.org' -H 'Referer: https://www.tmdn.org/tmview/' \
  -H 'User-Agent: Mozilla/5.0' \
  --data-raw '{"page":1,"pageSize":100,"criteria":"C","basicSearch":"gymnasia",
               "fOffices":["ES","EM"],"fTMStatus":[],"fNiceClass":[],
               "selectedFields":["markVerbalElementText","tradeMarkOffice","niceClass",
                                 "applicantName","tradeMarkStatus","applicationDate","tradeMarkType"]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["totalResults"])'
```

Debe imprimir `0`. Si algún día imprime otra cosa, hay un derecho anterior nuevo
y esta comprobación ha caducado.

Detalles de la consulta que conviene conservar:

- `criteria: "C"` significa «contiene», el criterio más amplio; con «exacto» el
  resultado también sería 0, pero «contiene» descarta además los compuestos.
- `fTMStatus: []` y `fNiceClass: []` vacíos significan **todos** los estados
  (incluidas solicitudes en trámite y marcas caducadas) y **todas** las clases.
- El código de oficina de la EUIPO en TMview es `EM`, no `EU`.
- Sin `selectedFields`, la respuesta no incluye el nombre de la marca
  (`tmName`) y solo devuelve números de expediente: es fácil creer que la API
  no lo expone.
- La consulta de control recomendada es `basicSearch: "gimnasio"` con el mismo
  filtro: debe devolver decenas de resultados. Si devuelve 0, el filtro está mal
  y el resultado principal no vale.
- **TMview bloquea la API por IP tras unas quince consultas, y el bloqueo dura
  mucho.** El síntoma es `curl: (56) Recv failure: Connection reset by peer`, o
  un `ConnectionResetError` desde Python, sin ningún código HTTP. Lo que despista
  es que **`https://www.tmdn.org/tmview/` sigue devolviendo 200**: la web parece
  sana mientras todo `/tmview/api/*` —búsqueda e imágenes incluidas— deja de
  responder. Reintentar no lo arregla: en esta comprobación se reintentó durante
  más de 25 minutos con esperas de 120 segundos y no cedió.
  - Por eso, planifica las consultas antes de lanzarlas y espácialas desde el
    principio. No hagas un barrido de decenas de términos.
  - Si te bloqueas a mitad, no insistas: pasa a las interfaces web de la OEPM y
    la EUIPO que se listan abajo, o repite desde otra red más tarde.
  - El bloqueo **sí caduca**: al día siguiente, 23 de agosto de 2026, la misma
    IP volvía a recibir `HTTP 200`. Ese día se reprodujeron las tres consultas y
    devolvieron exactamente lo mismo que la víspera: `gymnasia` en ES/EM → `0`,
    el control `gimnasio` en ES/EM → `80`, `gymnasia` en todas las oficinas →
    `45`. El comando de arriba queda por tanto **verificado**.

Las interfaces web equivalentes, para verificación manual:

- OEPM, buscador de marcas y nombres comerciales:
  <https://www.oepm.es/es/herramientas/buscador-base-de-datos/buscador-marcas-y-nombres-comerciales/>
- EUIPO eSearch: <https://www.euipo.europa.eu/eSearch/>
- TMview: <https://www.tmdn.org/tmview/>

## Cuándo hay que repetir esta comprobación

Según el plan de pruebas de GYM-193:

- **Antes de solicitar producción (GYM-201)** si ha pasado tiempo desde esta
  fecha. Los derechos anteriores aparecen: una solicitud presentada en la OEPM
  mañana no está en este documento.
- **Si cambia el nombre** del producto, en cuyo caso hay que rehacerla entera.
- **Al ampliar a territorios nuevos**, con las oficinas de esos territorios en
  `fOffices`.
