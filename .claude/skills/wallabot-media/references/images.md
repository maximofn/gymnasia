# Herramientas de imagen (IMG · image21)

Todos los ejemplos dan por hecho que ya se ejecutó `from wallabot import *` y `import json`. Las llamadas están copiadas de pruebas reales (2026-10-12).

Convenciones:
- **FD** = FileData de `upload(IMG, ruta)`. Cada salida de imagen o archivo es un FD con `url`, que se guarda con `save(fd, "x.png")`.
- **Cargar:** `ensure(IMG, tab, modelo, swap=True)`, con unos 30 s por modelo.
- **Resolución:** las herramientas con opción `res` conservan la proporción de la entrada y usan `res` como área aproximada. Por ejemplo, 1024 con una foto apaisada 3:2 da 1280×832.

## Generar y editar · tab `""` (principal)

Lo más cómodo es el CLI `image`. La llamada directa:

```python
ensure(IMG, "", "viggle_turbo", swap=True)
refs = [{"image": upload(IMG, "ref.png"), "caption": None}]          # [] para texto → imagen
img, seed, info = call(IMG, "generate", "viggle_turbo", "prompt", refs,
                       1024, 1024, 6, 0, True, "", False)          # w, h, steps, seed, randomize, negative, transparent
save(img, "out.png")                                                  # siempre PNG RGBA
```

**Parámetros:**
- Ancho y alto de 256 a 2752, en pasos de 32.
- Presets de `/sizes`: square1k 1024², square2k 2048², landscape 1344×768 y portrait 768×1344.
- Con referencias, la salida conserva la proporción de la **primera** y `w×h` solo fija el área.
- Referencias de ≤16 MP, con proporción entre 1:4 y 4:1.

**Modelos** (`model`):
- `viggle_turbo`: Viggle Turbo v0.3 (LoRA sobre BF16), 6 pasos, CFG1, **≤3 refs**, sin negativo. Es el **predeterminado** desde el 2026-11-10.
- `bf16`: el original, 40 pasos (~150 s a 1024²), admite negativo. Úsalo si hacen falta más de 3 referencias.
- **Retirados el 2026-11-10** para liberar disco (ya no salen en el desplegable de la web y por la API no cargan): `official_turbo` (el predeterminado anterior, ≤10 refs), `fp8` (el que propone la web), `nvfp4_benny`, `gguf`, `gguf_uc`, `turbo8` y `satoshi_turbo`. Comparación en `docs/wallabot.md` de articulator.

Los modelos turbo usan pasos fijos y no admiten prompt negativo.

**Tiempos con viggle_turbo:** 1024² en ~35 s; 1664×928 en ~46 s. `--transparent` da transparencia real.

## Quitar objetos · tab `remover`

```python
ensure(IMG, "remover", "object_remover", swap=True)   # o "object_remover_turbo"
ann = {"image": upload(IMG, "foto.jpg"),
       "boxes": [{"xmin": 560, "ymin": 55, "xmax": 875, "ymax": 600, "label": "", "color": "#ff0000"}],  # píxeles
       "orientation": 0}
r = call(IMG, "remove_objects", "object_remover", ann,
         "Remove the red highlighted object from the scene", 42, False, 40, 1024)  # prompt, seed, rand, steps, res 512-1536
save(r[1], "limpia.png")      # r[0] slider, r[2] imagen marcada enviada, r[3] seed, r[4] info
```

- `object_remover_turbo` usa 6 pasos fijos (~41 s) y puede dejar un **fantasma**. `object_remover` usa 40 pasos (~196 s) y borra limpio.
- `color` debe ser un string hex; una lista da error.
- El recuadro debe cubrir el objeto **completo, con su sombra o reflejo**. Si lo corta, el modelo reconstruye el objeto.
- **No sirve para una persona grande en el centro**: la deja igual. En ese caso usa el CLI `image -r foto.png` con "Remove the woman completely from the photo. Show only the empty scene behind her: …", que funcionó en ~40 s.
- Turbo no es fino: al pedir un ojo de un robot quitó los dos (2026-11-10).
- También acepta los modelos generales como motor, pero no los he probado.

## Ampliar · tab `outpaint`

```python
ensure(IMG, "outpaint", "outpaint_v2", swap=True)   # outpaint_v1: alejar mucho · bf16: sin LoRA
im = upload(IMG, "foto.jpg")
lay = json.dumps({"l": 0.549, "t": 0, "r": 0.549, "b": 0})
print(call(IMG, "outpaint_preview", im, lay, 1408)[1])   # sin GPU: "1888 × 1056 px · imagen original: 47%…"
r = call(IMG, "outpaint", "outpaint_v2", im, lay, "", 1408, 25, True, 42, False)
#        model, imagen, layout, escena ("" = autodescripción con Qwen3-VL), res 1024|1248|1408, steps 10-40, preserve, seed, randomize
save(r[1], "ampliada.png")   # r[0] slider, r[2] seed, r[3] info, r[4] escena usada, r[5] prompt
```

- **`layout`:** cada valor es la fracción del ancho (`l`, `r`) o del alto (`t`, `b`) **original** que se añade por ese lado. El lienzo mide `w·(1+l+r) × h·(1+t+b)`, con l+r ≤ 3 y t+b ≤ 3.
- **Para llegar a una proporción R desde w×h**, si R > w/h: `extra = R·h/w − 1`, y se reparte entre `l` y `r` (por ejemplo, la mitad a cada lado).
- **`preserve=True`** recupera los píxeles originales y une con una costura de 32 px.
- **Calidad:** costuras invisibles.
- **Tiempo:** de 868×1024 a 1888×1056 con 1408 y 25 pasos tardó ~481 s. Con 1024 es más rápido.
- **La autodescripción tarda:** con la escena vacía, Qwen3-VL la describe y suma ~114 s (2026-11-10: 16:9 → 768×1344 a 1024 y 25 pasos, 238 s en total). Escribe la escena si la conoces.
- `/outpaint_compose` falla por API ("Object of type partial is not JSON serializable"): no usarlo.

## Intercambiar caras · tab `face`

```python
ensure(IMG, "face", "face_swap_turbo", swap=True)      # o "face_swap" (base, 30 pasos, rango 1-50)
r = call(IMG, "face_swap", "face_swap_turbo", upload(IMG, "cara_ref.jpg"), upload(IMG, "destino.jpg"),
         1024, 6, 1.0, 42, False, defaults(IMG, "face_swap")["prompt"])
#        res 512|1024|1536 (conserva la proporción del destino), steps (Turbo 4-8), lora_scale 0-1.5, seed, rand, prompt
save(r[1], "cara.png")   # r[0] slider, r[2] seed, r[3] info
```

- Excelente, en ~54 s: adapta la cara a la luz de la escena destino, conserva el cuerpo y la ropa y elimina accesorios del destino, como las gafas.
- 2K supera la VRAM del codificador; el máximo es 1536.

## Cambiar ropa · tab `outfit`

```python
ensure(IMG, "outfit", "outfit_swap", swap=True)
r = call(IMG, "outfit_swap", "outfit_swap", upload(IMG, "persona.jpg"), upload(IMG, "prenda.jpg"),  # prenda o None
         "a dark green wool coat over a navy turtleneck", 1024, 25, 42, False)  # res 512|1024|1408, steps 10-40
save(r[1], "ropa.png")   # r[2] prompt final, r[3] seed, r[4] info
```

- El texto se inserta en "Dress the person in image 1 in {texto} shown in image 2. Keep their face, hair, hands, pose…". Escríbelo **en inglés, como descripción de la prenda**.
- La prenda de referencia puede ser una foto de producto o alguien que la lleve. Con referencia, el texto puede ir vacío.
- Excelente, en ~143 s con 25 pasos.

## Punto de vista · tab `orbit`

```python
ensure(IMG, "orbit", "viewpoint_orbit", swap=True)
obj = upload(IMG, "objeto.png")            # PNG RGBA de un objeto aislado; se encaja en un lienzo de 768² sin deformar
r = call(IMG, "orbit", "viewpoint_orbit", obj, "90 right", "elevated", 40, 42, False, 1.0, False)
#   move: "45 left"|"90 left"|"135 left"|"180"|"135 right"|"90 right"|"45 right"|"keep angle" (relativo a la vista de entrada)
#   elevation: "low angle"|"eye level"|"elevated" (absoluta) · steps 8-50 · seed · rand · lora_scale 0-1.5 · compare_base
save(r[0], "vista.png")    # RGBA; r[1] base (si compare_base), r[2] prompt, r[3] seed, r[4] info

r = call(IMG, "turntable", "viewpoint_orbit", obj, "eye level", 40, 42, False, 1.0)   # 7 vistas + GIF
for i, g in enumerate(r[0]): save(g["image"], f"vista_{i}.png")    # g["caption"] = ángulo
save(r[1], "orbita.gif")
```

- La órbita sencilla tarda ~111 s con 40 pasos y conserva la transparencia.
- El giro de 7 vistas con 20 pasos tardó ~417 s, pero las vistas salieron poco coherentes: la de 180° cambió de escala. Para el resultado final usa 40 pasos o vistas sueltas.
- El modelo inventa los lados ocultos.

## Iluminación · tab `relight`

```python
ensure(IMG, "relight", "relight_viggle", swap=True)    # o "relight_pruna"
L = [{"color": "#5ae628", "x": 0.08, "y": 0.6, "z": 0.3},       # máx. 3 luces
     {"color": "#f028dc", "x": 0.92, "y": 0.6, "z": 0.3}]       # x: 0 izq→1 der · y: 0 abajo→1 arriba · z: 0 cerca→1 lejos
d = 0.25                                                         # difusión: 0 dura → 1 suave
p = relight_prompt(L, d); m = "viggle"                           # "pruna" | "viggle"
req = {"sig": json.dumps({"p": p, "m": m}), "model": m, "prompt": p, "diffusion": d, "lights": L}
res = json.loads(call(IMG, "relight", f"relight_{m}", b64("foto.jpg"), json.dumps(req), 42, False)[0])
save(res["image"], "luces.png")                                  # pasada "solo luces" (con Pruna ya es el resultado final)
save(res["export_url"] + "?intensity=0.9", "final.png")          # Viggle: mezcla con el original en luz lineal
```

- Reduce antes la foto a un lado máximo de 1536 px (la web lo hace así) y envíala en JPEG.
- **Pruna** (~52 s) hace una reiluminación completa y su salida se desplaza respecto a la foto, así que no se mezcla.
- **Viggle** (~44 s) queda alineado y permite mezclar: `intensity` = 1 es todo reiluminado y 0 el original. Con 0,6 se ve lavado; usa de 0,8 a 1.
- Colores con nombre en `LIGHT_COLORS`: red, orange, warm amber, yellow, green, teal, cyan, blue, purple, magenta, pink, white, cool white y warm white. `relight_prompt` elige el más cercano.
- Ejemplos de la web:
  - Neón: los dos colores de arriba, difusión 0,25 e intensidad 0,6.
  - Luz de escenario: azul #2860ff en x 0,15, y 0,1, z 0,5, con difusión 0,8.
  - Atardecer: naranja #ff8c1e en x 0,85, y 0,85, z 0,35, con difusión 0,1.
  - Habitación roja: rojo #ff2828 en x 0,1, y 0,6, z 0,3, con difusión 0,15.

## Mover objetos · tab `move`

```python
ensure(IMG, "move", "move_turbo", swap=True)
img = b64("escena.jpg")
det = json.loads(call(IMG, "detect_move_objects", "move_turbo",
                      json.dumps({"idx": 0, "nonce": 1, "image": img}))[0])    # ~5 s
obj = det["objects"][0]       # {"label": "sailboat on ocean", "bbox": {"x1","y1","x2","y2"} normalizados 0-1}
dst = {"x1": 0.12, "y1": 0.45, "x2": 0.26, "y2": 0.73}                        # destino, también normalizado
boxes = {"moves": [{"label": obj["label"], "src": {"img": 0, **obj["bbox"]}, "dst": {"img": 0, **dst}}],
         "rows": [1]}
r = call(IMG, "move_objects", "move_turbo", json.dumps([img]), json.dumps(boxes), obj["label"],
         defaults(IMG, "move_objects")["prompt"], 42, False, 6, 1024)          # steps 4-8 · res 512-1024
save(r[0], "movido.png")      # r[1] seed, r[2] marcada (rojo origen, verde destino), r[3] info
```

- Mueve y redimensiona el objeto y rellena bien el hueco, en ~40 s.
- Admite hasta 4 movimientos y 4 imágenes.
  - Para llevar un objeto de una imagen a otra: `src.img = 0`, `dst.img = 1`.
  - `rows` indica cómo se colocan las imágenes en el panel: `[n]` en una fila, `[1,1]` en columna, `[2,1]` o `[2,2]`.
  - El caso de varias imágenes no está probado.
- **Revisa el recuadro detectado** (2026-11-10): «green robot holding sign» no incluía el cartel, y al mover el robot el cartel desapareció. Esa prueba tardó 490 s en total, no 45.
- Sin detección, dibuja `src` a mano en coordenadas normalizadas.

## Quitar fondo · tab `background` (CPU)

BiRefNet, como el Space [not-lain/background-removal](https://huggingface.co/spaces/not-lain/background-removal): separa el sujeto del fondo y devuelve un PNG RGBA con los píxeles y el tamaño originales. Analiza a 1024×1024 y reescala la máscara.

```python
ensure(IMG, "background", "birefnet", swap=True)     # único modelo: "birefnet"
r = call(IMG, "remove_background", "birefnet", upload(IMG, "foto.jpg"))
save(r[1], "recorte.png")   # PNG RGBA · r[0] slider [original RGB, recorte RGBA] · r[2] "20.06 s · 8:5 · 720 × 450 px · PNG RGBA"
```

Probado el 2026-10-19 con una mariposa, dos retratos con pelo rizado, una bailarina y una foto de 2925×4096.
- **Tiempo:** ~20 s por imagen en CPU, sea cual sea su tamaño, porque siempre analiza a 1024². Con 12 MP fueron 26 s contando la subida. La carga tardó 21 s, incluida la descarga del motor anterior.
- **Calidad excelente.** Saca las antenas de la mariposa, el pelo rizado mechón a mechón y la bailarina sin su sombra en el suelo.
- **Alfa casi binario:**
  - El fondo queda a 0, y solo un 1-2 % de los píxeles tiene valores intermedios, en los bordes.
  - El sujeto queda a **254, no a 255**: no busques el sujeto con `alfa == 255`.
- **El RGB es idéntico al original.** Por eso en el pelo queda un halo leve del fondo original: se nota algo sobre blanco y apenas sobre negro o colores vivos.
- **Corre en CPU, pero reserva el servidor como un motor más:**
  - No convive con otro motor de image21. Cargarlo así da el error "Primero descarga el modelo cargado …".
  - Tampoco con el TTS: da "Otro modelo o un mantenimiento reserva el servidor". Lo mismo cabe esperar de H3, aunque no lo he probado.
  - `ensure(..., swap=True)` lo resuelve como en las demás pestañas.
- Sus estados son "**Descargado**" (no "de las GPU"), "**Cargado · listo**" y "**Procesando**" (no "Generando"). `unload_model` lo descarga como a los demás.

## Workflow · nodos · tab `workflow`

Es un lienzo de nodos para usar en el navegador: conecta texto, generación y edición, y guarda el workflow. Es otra app Gradio 6.28 (en modo `workflow`) metida en un iframe, en `ROOT/image21/workflow/`, con su propia API.

```python
ensure(IMG, "workflow", "viggle_turbo", swap=True)   # los modelos de la pestaña principal; la web propone fp8, que ya no carga
WF = f"{ROOT}/image21/workflow/gradio_api"
img = call(WF, "generated_image", "prompt")[0]                              # nodo text_to_image → PNG RGBA 1024²
img = call(WF, "edited_image", upload(WF, "foto.png"), "instrucción")[0]   # nodo edit_image → conserva la proporción
save(img, "out.png")
```

Probado el 2026-10-19 con `official_turbo`.
- **Tiempos:** la carga tardó 31 s, generar 33 s y editar 46 s, lo mismo que con `generate`. La edición pasó de 720×450 a 1280×800 y solo cambió lo pedido.
- **Por API no aporta nada: usa `generate`.**
  - Los endpoints solo reciben el prompt, o la imagen y la instrucción.
  - Los pasos, el tamaño y la semilla no son parámetros.
  - Solo admite una imagen de entrada.
- **Alfa sucio:** la salida es PNG RGBA, y entre un 3 % y un 7 % de los píxeles tiene el alfa entre 227 y 254, repartidos por toda la imagen. Conviértela con `.convert("RGB")` antes de usarla como imagen opaca. No he comprobado si `generate` hace lo mismo.
- El lienzo usa el motor cargado en image21. Trae además funciones para buscar y llamar Spaces y modelos de Hugging Face, guardar workflows y ver el historial de ejecuciones, todo pensado para usarlo a mano.
