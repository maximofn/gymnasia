# Herramientas de vídeo (VID · h3 · MiniMax H3)

Todos los ejemplos dan por hecho que ya se ejecutó `from wallabot import *` y `import json`. Las llamadas están copiadas de pruebas reales (2026-10-12), todas con cuantización Q4.

**Convenciones:**
- **Cargar:** `ensure(VID, tab, modelo, swap=True)`, con 12-37 s por modelo. El estado de listo es "Listo para generar".
- **Resoluciones:** se escriben **con el signo ×**: `"640 × 384"`, `"864 × 480"`, `"960 × 544"`, `"512 × 512"` o `"480 × 864"`.
- **Salidas:** los `generate_*` devuelven `[vídeo, mp4 FD, seed, info]`. Guarda el MP4 con `save(r[1], "x.mp4")`. Salen en H.264 a 24 fps, con AAC estéreo a 32 kHz.
- **Duración:** H3 la ajusta a los fotogramas que admite: 39 → 1,62 s, 56 → 2,33 s, 73 → 3,04 s, 107 → 4,46 s y 124 → 5,17 s.
- **Cuantizaciones:**
  - `fl2va_*`: q8, q6, q5, q4, ud_q3, q3, ud_q2 y q2.
  - `ref2va_*`: q8, q6, q5, q4, q3 y q2.
  - Solo he probado q4. Las de 2 bits usan el codificador Q2.
- **Idioma de los prompts:** funcionaron tanto en español como en inglés. Describe la escena, la acción, la cámara **y el sonido**, porque H3 genera el audio.
- **Revisión:** `scripts/vstrip.sh out.mp4 tira.jpg 6` y luego `Read` de la tira. El volumen medio indica si hay audio: −65 dB es silencio y de −15 a −30 dB es audio normal.

## Base · tab `""` · `fl2va_q4`

Usa el CLI `video`, o directamente:

```python
ensure(VID, "", "fl2va_q4", swap=True)
r = call(VID, "generate_video", "fl2va_q4", "first",            # mode: text|first|last|first_last
         "Las olas rompen contra las rocas… Se oye el mar y las gaviotas.",
         upload(VID, "primer.png"), None, "640 × 384", 2, 20, 3, False)   # first, last, res, dur 1-15, steps 4-40, seed, rand
save(r[1], "v.mp4")
```

Tarda ~318 s para 3 s desde texto y ~261 s para 2,33 s desde una imagen inicial, ambos a 640×384 y 20 pasos.

## Veda + Turbo · tab `veda` · `fl2va_q4_veda`

La **mejor opción para texto → vídeo**. Tiene la misma firma que `generate_video`, con 4-8 pasos:

```python
ensure(VID, "veda", "fl2va_q4_veda", swap=True)
r = call(VID, "generate_veda_video", "fl2va_q4_veda", "text",
         "A red car drives along a mountain road at sunset, the camera tracks it from the side. Engine sound.",
         None, None, "640 × 384", 3, 8, 42, False)
```

- Tarda ~119 s para 3 s, con calidad muy alta.
- La atención dispersa (Veda) no ahorra nada a resoluciones bajas; la velocidad viene del Turbo de 8 pasos.

## PDMD, 4 pasos · tab `pdmd` · `fl2va_q4_pdmd`

```python
ensure(VID, "pdmd", "fl2va_q4_pdmd", swap=True)
r = call(VID, "generate_pdmd_video", "fl2va_q4_pdmd",
         "The woman smiles, sways gently and looks at the camera. Static camera. Soft street ambience.",
         upload(VID, "persona.jpg"), "480 × 864", 2, 42, False)       # imagen inicial o None, res, dur, seed, rand
```

Tarda ~146 s para 2,33 s a 480×864, con buena coherencia de identidad. Es ideal para crear un vídeo fuente que luego se edita.

## Audio → vídeo · tab `audio` · `fl2va_q4_turbo`

```python
ensure(VID, "audio", "fl2va_q4_turbo", swap=True)
r = call(VID, "generate_audio_video", "fl2va_q4_turbo",
         "A woman talks to the camera, natural lip sync and subtle head movement. Static camera, studio background.",
         upload(VID, "voz.wav"), upload(VID, "retrato.jpg"), "512 × 512", 4, 6, 42, False)  # audio, img|None, res, dur, steps 4-8, seed, rand
```

- **Sincronización de labios** buena y con identidad estable. Tarda ~253 s para 4,46 s a 512².
- El MP4 conserva **tu** audio, desde el principio de la pista y recortado o rellenado con silencio hasta la duración.
- Voz local sin servicios externos: `say -v 'Flo (Español (España))' -o voz.aiff "texto"` y luego `ffmpeg -i voz.aiff -ar 44100 voz.wav`. También hay otras voces es_ES/es_MX: Eddy, Flo, Grandma…

## ControlNet Union · tab `control` · `fl2va_q4_control`

```python
ensure(VID, "control", "fl2va_q4_control", swap=True)
src = upload(VID, "fuente.mp4")
m = call(VID, "prepare_control_video", "fl2va_q4_control", src, "canny", "640 × 384", 3, 0)   # vista previa del mapa
save(m[0], "mapa.mp4"); print(m[1])                     # "640 × 384 · 2.33 s · 56 fotogramas · canny"
r = call(VID, "generate_control_video", "fl2va_q4_control",
         "A grey wolf walks through a snowy forest at dusk, the camera follows it. Footsteps on snow.",
         src, "canny", "640 × 384", 3, 0, 1.0, 24, 43, False)   # vídeo, prep, res, dur ≤5, inicio, scale 0-1.5, steps 8-40, seed, rand
```

- `"canny"` extrae los bordes de un vídeo normal. Con `"map"`, el vídeo ya es un mapa de profundidad, HED, MLSD o pose.
- Copia fielmente la pose y el movimiento: el zorro pasó a ser un lobo. Tarda ~446 s para 2,33 s.
- La duración se recorta a lo que da el clip.

## Inpainting · tab `inpaint` · `ref2va_q4_turbo` (o `ref2va_q4` base, 28 pasos)

```python
ensure(VID, "inpaint", "ref2va_q4_turbo", swap=True)
v = upload(VID, "fuente.mp4")
prep = call(VID, "prepare_inpaint_clip", v, 0, "480 × 864")[0]       # fotograma para pintar (inicio, res)
save(prep["background"], "frame.png")                                   # ¡MÍRALO antes de poner la máscara!
ed = mask_editor(VID, prep, (0.24, 0.50, 0.80, 0.81))                   # rectángulo normalizado sobre ESE fotograma
r = call(VID, "generate_inpaint_video", "ref2va_q4_turbo",
         "A smiling woman wearing a bright red t-shirt and blue jeans stands in front of a metal gate. Keep the camera and background.",
         v, ed, None, None, "480 × 864", 0, 2, 8, 42, False, True, True, 64)
# vídeo, editor, mask_video|None (blanco cambia, negro conserva), ref|None, res, inicio, dur, steps, seed, rand, keep_audio, crop, padding 0-256
```

- **El prompt describe la escena final completa**, no solo el cambio.
- La máscara pintada es fija en todos los fotogramas, así que deja margen para el movimiento. Para seguir un objeto que se mueve, pasa un vídeo de máscaras alineado con el original.
- **Fallo real que tuve:** calculé el recuadro con la foto original y la máscara cayó sobre la cara, porque H3 reencuadra. Sobre el fotograma de `prep` acerté.
- Tarda ~500 s para 2,33 s a 480×864, con Turbo y 8 pasos. El resultado es coherente.

## Fondo nuevo · tab `background` · `ref2va_q4_background`

```python
ensure(VID, "background", "ref2va_q4_background", swap=True)
v = upload(VID, "sujeto.mp4")
prep = call(VID, "prepare_background_clip", v, 0, "480 × 864")[0]
r = call(VID, "generate_background_auto", "ref2va_q4_background",
         "a sunny tropical beach, white sand, palm trees and turquoise ocean waves behind the subject, bright warm daylight, static camera",
         v, prep, None, "480 × 864", 0, 39, 8, 7, False, True, True, 6, False, True)
# vídeo, editor, matte|None, res, inicio, frames 22|39|56|73|90|107|124, steps ≤8, seed, rand,
# keep_audio, harmonize, drop 1-7 (menor = cambia más el sujeto), remove_only, automatic
save(r[1], "fondo.mp4")      # r[4] matte del sujeto, r[5] máscara del fondo, r[6] referencia del sujeto
```

- La extracción automática con LTX-2.5 Alpha-Gen llega hasta 107 fotogramas; para 124 hace falta una máscara manual.
- `remove_only=True` deja el sujeto sobre negro sin pasar por H3.
- `harmonize` ajusta la luz del sujeto, pero puede retocarlo.
- Muy bueno: ~488 s para 39 fotogramas.

## Quitar persona · tab `person` · `ref2va_q4_person`

Necesita el **primer fotograma ya limpio**, con la persona eliminada y el mismo encuadre.

```python
v = upload(VID, "fuente.mp4")
prep = call(VID, "prepare_person_clip", v, 0, "480 × 864")[0]
save(prep["background"], "frame0.png")
# 1) limpiar el fotograma en IMG (para una persona grande, el editor general: object_remover falló)
#    uv run scripts/wallabot.py image "Remove the woman completely from the photo. Show only the empty scene behind her: …" \
#        -r frame0.png --size 768x1376 --swap -o limpio.png
# 2) quitar a la persona del vídeo
ensure(VID, "person", "ref2va_q4_person", swap=True)
ed = mask_editor(VID, prep, (0.17, 0.28, 0.84, 1.0))                      # cubre a la persona con margen
r = call(VID, "generate_person_video", "ref2va_q4_person", defaults(VID, "generate_person_video")["prompt"],
         v, ed, None, upload(VID, "limpio.png"), "480 × 864", 0, 39, 12, 1.0, 904234, False, True, 5)
# vídeo, editor, mask_video|None, fotograma limpio, res, inicio, frames, steps, lora_scale, seed, rand, keep_audio, expansion 0-20
save(r[1], "sin_persona.mp4")   # r[4] vídeo marcado en verde, r[5] fotograma limpio usado
```

- Tarda ~972 s para 39 fotogramas y 12 pasos. **Los fotogramas 0 y 1 traían a otra persona inventada**, aunque las entradas eran correctas; desde el 2 estaba limpio.
- Revisa los 10 primeros con `ffmpeg -i v.mp4 -vf "select='lt(n,10)',scale=-1:200,tile=10x1" -fps_mode vfr -frames:v 1 t.jpg`.
- Para recortar N fotogramas (con N = 2, 2/24 = 0,0833): `ffmpeg -i v.mp4 -vf "select=gte(n\,2),setpts=PTS-STARTPTS" -af "atrim=start=0.0833,asetpts=PTS-STARTPTS" -c:v libx264 -crf 18 -c:a aac out.mp4`.
- El modelo regenera la escena: puede alterar el fondo y a otras personas.

## Cambiar personaje · tab `character` · `ref2va_q4_character`

```python
ensure(VID, "character", "ref2va_q4_character", swap=True)
r = call(VID, "generate_character_video", "ref2va_q4_character",
         defaults(VID, "generate_character_video")["prompt"],   # "Swap the person in <Video 1> with the character in <Picture 1>. Preserve…"
         upload(VID, "escena.mp4"), upload(VID, "personaje.jpg"), "480 × 864", 0, False, 2, 28, 1.0, 42, False)
# escena (≤15 s), personaje, res, inicio, match_length, dur ≤5, steps, lora_scale, seed, rand
```

- Funciona: conserva la pose, el movimiento y el fondo. La ropa puede cambiar según la referencia.
- ⚠ Es **lentísimo**: ~1592 s (27 min) para 2,33 s a 480×864 con 28 pasos. Prueba antes con 1 s o menos pasos, y lánzalo en segundo plano.
- Genera un audio nuevo.

## ORB360 / CardSpin · tab `orb` · `ref2va_q4`

```python
ensure(VID, "orb", "ref2va_q4", "cardspin_v2", swap=True)     # efecto: "orbit" (ORB360) | "cardspin_v2" | "cardspin_v1"
r = call(VID, "generate_orb_video", "ref2va_q4", "cardspin_v2", defaults(VID, "generate_orb_video")["prompt"],
         upload(VID, "retrato.jpg"), "640 × 384", 20, 42, False)   # variant, prompt, ref, res, steps, seed, rand
```

- `load_orb_model` es el único con 2 argumentos. Para cambiar de efecto hay que descargar y volver a cargar.
- Siempre son 124 fotogramas (5,17 s). ⚠ Tarda ~764 s a 640×384 con 20 pasos. Sale en silencio.
- **CardSpin v2** gira la foto como una tarjeta: perfil, canto, nuca y vuelta al frente.
- **ORB360** orbita alrededor del sujeto.
- El prompt de `/info` es el de CardSpin v2. El recomendado para ORB360 lo pone la web con una función privada; adáptalo con la misma estructura:
  - `subject_definitions`: `<Subject 1>` / `<Picture 1>` como primer fotograma de `[Shot 1]`.
  - `summary`: "[reference generation] ORB360_CARDSPIN…".
  - `retention_analysis`.
  - `detailed_description`, con una marca por segundo y fotograma.
  - `overall_soundscape: N/A` y `non_diegetic_music: N/A`.
- Con una sola foto, el modelo inventa las vistas ocultas.
