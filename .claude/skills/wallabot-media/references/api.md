# Protocolo y diagnóstico

Las dos apps usan Gradio 6.28 con `api_prefix=/gradio_api`. La base es `B = ROOT/<app>/gradio_api`, donde `ROOT` es el valor de `WALLABOT_ROOT` (ver SKILL.md) y `<app>` es `image21` o `h3`. `wallabot.py` implementa todo esto solo con stdlib.

## Llamar a un endpoint

```
POST {B}/call/<api>   {"data": [args en orden]}   → {"event_id": "..."}
GET  {B}/call/<api>/<event_id>                      → SSE: "event: heartbeat|complete|error" + "data: [...]"
```

- **El stream solo se puede leer una vez.** Si el cliente se corta, el trabajo sigue en la GPU, pero al reconectar se recibe `404: Not Found` y el resultado se pierde.
- En las llamadas largas llega un heartbeat cada ~15 s.
- Los errores llegan como `event: error` con un JSON `{"error": "..."}`. Los de validación indican qué componente y qué tipo esperaba, y sirven para deducir formatos.
- Ficheros:
  - Subida: `POST {B}/upload -F files=@x` → `["/tmp/gradio/<hash>/x"]`. Se pasa como `{"path": ..., "meta": {"_type": "gradio.FileData"}}`.
  - Descarga: `GET {B}/file=<path>`, o directamente el `url` del FileData de salida.
- Los ficheros de ejemplo de la web están en `ROOT/image21/gradio_api/file=/app/assets/...`. Por ejemplo: `sailboat_ocean.jpg`, `rubber_ducks.jpg`, `orbit/ood_*.png`, `face/reference_*.jpg`, `face/target_*.jpg`, `outpaint/*.jpg`, `outfit/*.jpg` y `relight/*.jpg`.

## Estados

**image21:** solo hay un motor, compartido por todas las pestañas.
- `/status [modelo_normal]` o `/select_{tab}_model [modelo]` devuelven estos estados:
  - "**Descargado de las GPU**"
  - "**Cargándose**"
  - "**Cargado · listo** · Motor: <etiqueta>"
  - "**Generando**"
  - "**Descargándose**"
- Si el modelo pedido no es el activo, añade "Descarga el motor activo antes de cargar esta selección".
- `/load_{tab}_model [modelo]` es asíncrono: vuelve enseguida y hay que sondear el estado.
- `/unload_model ["fp8"]` descarga el motor activo, sea cual sea.

**h3:**
- `/status []` devuelve estos estados, junto con la memoria y la temperatura de cada GPU:
  - "**Descargado de las GPU**"
  - "**Cargando modelo…**"
  - "**Listo para generar** · <etiqueta del perfil>"
  - "**Generando vídeo…**"
  - "**Descargando de las GPU…**"
- `/load_{tab}_model [modelo]` también es asíncrono. `orb` lleva además el efecto como segundo argumento.
- `/unload_model []` y los `/cancel_*` descargan el motor.
- Se descarga sola tras 15 min sin generar.
- Las etiquetas de cada clave están en las `choices` de los desplegables de `/h3/config`; `wallabot.vid_label()` las cachea.

Con un perfil de H3 cargado, cada GPU tiene en uso ~16,5-17,5 GiB de 23,6 GiB (memoria total, no solo la del modelo). Sin nada cargado, ~0,1 GiB.

## Inspeccionar endpoints (por si la app cambia)

```bash
curl -s ROOT/<app>/gradio_api/info  > info.json   # named_endpoints: parámetros (orden, tipo, default, enum) y salidas
curl -s ROOT/<app>/config           > config.json # componentes (rangos de sliders, choices, textos), dependencias, i18n
```

- **Etiquetas de image21:** son claves `__i18n__{"key": "wallabot_…"}`. Se traducen con `config["i18n_translations"]["es"][key]`.
- **Formatos de los componentes propios:** están en el JS del config. Lo encontré en dos sitios:
  - `dependencies[i].js`: el relight construye su JSON de petición y el move construye `images_json` y `boxes_json`.
  - `components[i].props.js_on_load`: el lienzo de outpaint, que da el significado de `l/t/r/b`.
- **Prompts largos por defecto:** `wallabot.defaults(app, api)`.
- **Cómo saber si una app ha cambiado:** compara un `info.json` nuevo con el anterior. El 2026-10-12 apareció así el modelo `official_turbo`, a mitad de sesión.

## Errores conocidos

- `/outpaint_compose` responde "Object of type partial is not JSON serializable". Es un bug del servidor; usa `/outpaint_preview`.
- `image_annotator`: si `color` va como lista, falla con "expected string or bytes-like object, got 'list'". Debe ir como hex.
- `load_orb_model` con un solo argumento falla con "didn't receive enough input values (needed: 2, got: 1)".
