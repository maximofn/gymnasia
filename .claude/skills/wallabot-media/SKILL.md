---
name: wallabot-media
description: Genera y edita imágenes (Qwen Image 2.1) y vídeos con audio (MiniMax H3) en los servidores Gradio Wallabot del mantenedor (apps image21 y h3). Usar siempre que haya que crear, editar o animar imágenes o vídeos — texto→imagen, edición con referencias, PNG transparente, quitar o mover objetos, ampliar/outpaint, intercambiar caras, cambiar ropa, reiluminar, rotar el punto de vista de un objeto, texto/imagen/audio→vídeo, inpainting de vídeo, ControlNet, cambiar el fondo, quitar una persona o cambiar el personaje de un vídeo.
metadata:
  author: Claude + maximofn
  version: "1.0.0"
  tested: "2026-10-12 · las 17 herramientas probadas de extremo a extremo"
  origin: "Adaptada del proyecto articulator (.agents/skills/wallabot-media) el 2026-10-15"
---

# Wallabot · imágenes y vídeos

Dos webs Gradio 6.28 en el servidor de casa del mantenedor (Tailscale, 2 GPU de ~24 GiB **compartidas**):

| App | URL | Qué hace |
|---|---|---|
| `IMG` | `$WALLABOT_ROOT/image21/` | Qwen Image 2.1: generar, editar y 7 herramientas de edición |
| `VID` | `$WALLABOT_ROOT/h3/` | MiniMax H3: vídeo **con audio**, 10 pestañas |

**El host no está en el repositorio**, que es público. `scripts/wallabot.py` lo lee de `WALLABOT_ROOT`:
la variable de entorno o una línea `WALLABOT_ROOT=https://…` en el `.env` de la raíz (ignorado por Git;
en un worktree se busca subiendo hasta el del repositorio principal). Sin ella, el script se detiene con
un mensaje claro. Nunca escribas el host en un fichero versionado.

Todo se hace con `scripts/wallabot.py` (solo stdlib): CLI para generar y librería para el resto.

- **Rutas.** Son relativas a esta skill. Desde la raíz del proyecto: `SKILL=.claude/skills/wallabot-media`.
- **Python.** Si existe `.venv`, primero `conda deactivate` y `source .venv/bin/activate`. Después ejecuta con `uv run`.
- **Pillow.** Para máscaras y comparaciones añade `--with pillow`.

## Reglas (no negociables)

1. **Solo cabe UN motor en las GPU**, contando todas las pestañas de las dos apps y también el Qwen3-TTS de la skill `wallabot-voice` (de otros proyectos; aquí no está, así que el script no puede comprobarlo). Cargar un modelo obliga a descargar el que haya. `ensure(..., swap=True)` y `--swap` lo hacen solos, incluida la parada del TTS. Si no, image21 responde "Otro modelo o un mantenimiento reserva el servidor".
2. **Las GPU son del mantenedor y las comparten otras sesiones**, de este proyecto y de otros (también usan wallabot para compilar Android). Antes de cargar, mira el estado: `call(IMG,"status","fp8")[0]` y `call(VID,"status")[0]`. El de VID muestra la memoria usada en cada GPU. Si hay algo cargado o generando que no lanzaste tú en esta sesión, **pregunta** antes de usar swap. Si el mantenedor ha dicho que wallabot está ocupado, no lo uses hasta que diga lo contrario.
3. **Nunca cortes una llamada en curso.** El stream SSE solo se lee una vez: si se corta, la GPU termina el trabajo pero el resultado se pierde (da 404).
   - Las llamadas largas, lánzalas con `run_in_background`.
   - No las metas en tuberías que puedan cerrarse antes de tiempo, como `| head` o un `grep` con una expresión no válida (el grep del sistema es ugrep).
4. **Mira cada resultado antes de darlo por bueno.** Usa `Read` para la imagen, `scripts/vstrip.sh` para vídeos y `scripts/compare.py` para el antes/después. Varios fallos solo se ven mirando: recuadros mal puestos, máscaras desplazadas, objetos fantasma.
5. **Al terminar, libera las GPU:** `call(VID,"unload_model")` y `call(IMG,"unload_model","fp8")`. H3 además se descarga sola tras 15 min sin uso.

## Qué herramienta usar

Los tiempos están medidos en estas GPU, con la configuración indicada y sin contar la carga del modelo (10-40 s).

**Imagen (IMG)**

| Objetivo | Cómo | Tiempo |
|---|---|---|
| Imagen desde texto, incluido texto tipográfico | CLI `image` (official_turbo) | ~30 s a 1024² |
| Editar o combinar fotos | CLI `image -r ref.png` (≤10 refs) + instrucción | ~40 s |
| PNG con fondo transparente | CLI `image --transparent` | ~30 s |
| Quitar un objeto pequeño o mediano | `remove_objects` (tab `remover`) | 41 s Turbo · 196 s Estándar |
| Quitar una persona grande o central | CLI `image -r foto "Remove the woman completely… show the empty scene…"` | ~40 s |
| Ampliar el lienzo o cambiar la proporción | `outpaint` | ~480 s a 2 MP |
| Poner la cara de otra persona | `face_swap` | ~54 s |
| Cambiar la ropa, con prenda de referencia o sin ella | `outfit_swap` | ~143 s |
| Ver un objeto desde otro ángulo (PNG RGBA) | `orbit` / `turntable` (7 vistas + GIF) | 111 s / ~420 s |
| Reiluminar con luces de color | `relight` | ~50 s |
| Mover o redimensionar un objeto | `detect_move_objects` + `move_objects` | 5 s + 40 s |

**Vídeo (VID)** · H3 genera también el sonido del prompt

| Objetivo | Cómo | Tiempo → duración |
|---|---|---|
| Texto → vídeo, con la mejor calidad por tiempo | `generate_veda_video` (8 pasos) | 119 s → 3 s |
| Imagen → vídeo rápido | `generate_pdmd_video` (4 pasos) | 146 s → 2,3 s |
| Fotogramas primero y último, base de calidad | CLI `video --first a --last b` | ~318 s → 3 s |
| Que un retrato hable con una voz (lip sync) | `generate_audio_video` | 253 s → 4,5 s |
| Copiar el movimiento de otro vídeo | `generate_control_video` (Canny) | 446 s → 2,3 s |
| Cambiar una zona del vídeo (ropa, objeto) | `generate_inpaint_video` | 500 s → 2,3 s |
| Cambiar el fondo con el sujeto extraído solo | `generate_background_auto` | 488 s → 1,6 s |
| Quitar una persona del vídeo | `generate_person_video` | 972 s → 1,6 s |
| Sustituir a la persona por otra | `generate_character_video` | ⚠ 1592 s → 2,3 s |
| Foto que gira (CardSpin) u orbita (ORB360) | `generate_orb_video` | ⚠ 764 s → 5,2 s (siempre) |

Firmas exactas, ejemplos y trampas de cada fila: **[references/images.md](references/images.md)** y **[references/videos.md](references/videos.md)**. Protocolo HTTP, estados y cómo inspeccionar endpoints nuevos: **[references/api.md](references/api.md)**.

## Uso

```bash
# Imagen (por defecto official_turbo, 1024², semilla aleatoria)
uv run $SKILL/scripts/wallabot.py image "prompt" -o out.png [-r ref.png ...] \
    [--size square1k|square2k|landscape|portrait|WxH] [--seed N] [--transparent] [--swap]
# Vídeo base (por defecto fl2va_q4, 640x384, 3 s, 20 pasos)
uv run $SKILL/scripts/wallabot.py video "escena, movimiento y sonido" -o out.mp4 \
    [--first img] [--last img] [--res 640x384|864x480|960x544|512x512|480x864] [--duration S] [--steps N] [--swap]
```

```python
import sys; sys.path.insert(0, ".claude/skills/wallabot-media/scripts")
from wallabot import *   # IMG, VID, ROOT, call, upload, b64, save, defaults, ensure, relight_prompt, mask_editor

ensure(IMG, "face", "face_swap_turbo", swap=True)          # carga la pestaña y espera a que esté lista
r = call(IMG, "face_swap", "face_swap_turbo", upload(IMG, "cara.jpg"), upload(IMG, "destino.jpg"),
         1024, 6, 1.0, 42, False, defaults(IMG, "face_swap")["prompt"])
save(r[1], "resultado.png")
```

Qué hace cada ayudante:
- `ensure(app, tab, key, *extra, swap)`: el `tab` es el sufijo de `/load_{tab}_model`, con `""` para la pestaña principal.
- `upload`: devuelve el FileData que esperan las entradas Image, Video y Audio.
- `b64`: devuelve una data URL. Lo usan `relight` y `move`.
- `save`: acepta un FileData, una URL (también relativa) o una data URL.
- `defaults(app, api)`: valores por defecto de `/info`, incluidos los prompts largos predefinidos.
- `relight_prompt(luces, difusión)`: genera el prompt de iluminación.
- `mask_editor(VID, prep, (x1,y1,x2,y2))`: genera la máscara blanca para el editor de vídeo; necesita Pillow.

## Flujo recomendado

1. **Estado de las GPU.** Aplica la regla 2.
2. **Elegir herramienta** con las tablas.
3. **Iterar barato:** perfiles Turbo/PDMD/Veda, resolución mínima (640×384 o 480×864) y 1-2 s. Pruebas en segundo plano si pasan de unos 5 min.
4. **Revisar** con `vstrip.sh` y `compare.py`, y ajustar el prompt, los recuadros o las máscaras.
5. **Final** con el perfil de calidad (por ejemplo Object Remover Estándar, outpaint a 1408 o más pasos) y la resolución definitiva.
6. **Descargar** las GPU.

Encadenar funciona bien, por ejemplo:
- Generar la imagen en IMG → animarla en VID (`--first` o PDMD) → editar el vídeo (inpaint, fondo, personaje).
- Sacar un fotograma (`prepare_*_clip`) → limpiarlo en IMG → usarlo en VID.

## En Gymnasia

- **Para qué se usa aquí:** material de los vídeos y charlas (`docs/videos/<vídeo>/`, `charla-agente/`):
  fotos de escena, ilustraciones y clips cortos. Las imágenes de ejercicios y alimentos siguen sus
  propias skills (`generate-exercise-image`, `generate-food-image`) y su estilo; no las sustituyas por
  esta sin que lo pida el mantenedor.
- **Lo generado es ilustrativo.** No lo presentes como una captura real de la app, un dato real ni una
  persona real. Si una escena lo necesita, rotúlalo como ilustración.
- **Nada de personas reales.** No subas fotos de terceros ni de usuarios al servidor, y no uses
  intercambio de caras o de personaje con personas reales sin su consentimiento explícito.
- **Deja constancia de cada asset que se versione:** modelo, prompt, semilla y tamaño, en el README de
  la carpeta donde se guarde, para poder regenerarlo.
- **El repositorio es público:** comprueba que la imagen no contiene datos personales, rutas locales ni
  el host de Wallabot antes de hacer commit.

## Prompts

- **Qwen Image** admite español o inglés y escribe texto en la imagen muy bien. Para editar, describe el cambio y lo que hay que conservar.
- **Prompts que van a plantillas en inglés:** escríbelos en inglés. Es el caso de la ropa ("Dress the person in image 1 in {texto}…"), la iluminación (lo genera `relight_prompt`), el borrador, el intercambio de caras, mover objetos, quitar persona y cambiar personaje.
- **H3** genera el audio a partir del prompt: describe escena, acción, movimiento de cámara **y sonido**.
- **Character Swap** se refiere al vídeo como `<Video 1>` y a la foto como `<Picture 1>`.
- **ORB/CardSpin** usa un prompt estructurado (ver videos.md).

## Trampas aprendidas

- **Quitar objetos:**
  - El recuadro debe cubrir el objeto **entero**, con su sombra o reflejo. Si lo corta, el modelo lo "completa" en vez de borrarlo.
  - Turbo deja fantasmas en casos difíciles; Estándar no.
  - `color` va como string hex.
- **Máscaras de vídeo:** se pintan sobre el fotograma que devuelve `/prepare_*_clip` (`prep["background"]`), **no** sobre la foto original, porque H3 reencuadra. La máscara es fija, así que deja margen para el movimiento.
- **Person Remover** puede inventar a una persona en los primeros fotogramas. Revisa los 10 primeros y recorta: `ffmpeg -i in.mp4 -vf "select=gte(n\,N),setpts=PTS-STARTPTS" -af "atrim=start=N/24 en decimal,asetpts=PTS-STARTPTS" -c:v libx264 -crf 18 -c:a aac out.mp4`.
- **H3 ajusta la duración** a los fotogramas que admite: 2 s → 2,33 s, 3 s → 3,04 s, 1,62 s con 39 fotogramas, 5,17 s con 124.
- **`/outpaint_compose` falla por API** (bug del servidor); usa `/outpaint_preview`, que no gasta GPU.
- **`load_orb_model`** es el único `load_*` con 2 argumentos (modelo + efecto): `ensure(VID, "orb", "ref2va_q4", "orbit")`.
- **El giro de 7 vistas con 20 pasos** sale poco coherente; usa 40 pasos.
- **El PNG "transparente" de image21 no es limpio.** El fondo queda con alfa 1-9 (no 0) y RGB magenta debajo. A simple vista no se nota, pero al componer con alfa, escalar, rotar o desenfocar aparece un halo o cuadrado magenta. Antes de componer, aplica un umbral: alfa = clip((a−24)/(90−24)) y RGB = 0 donde alfa = 0. Para elementos luminosos (hologramas, energía, partículas) es mejor generarlos **sobre fondo negro puro** y mezclarlos en modo *screen*/*add*.
