"""Imágenes (Qwen Image 2.1) y vídeos (MiniMax H3) con las webs Gradio de Wallabot.

CLI:
uv run wallabot.py image "prompt" -o out.png [-m official_turbo] [-r ref.png ...]
    [--size 1024x1024|square1k|square2k|landscape|portrait] [--steps N] [--seed N]
    [--negative TXT] [--transparent] [--swap]
uv run wallabot.py video "prompt" -o out.mp4 [-m fl2va_q4] [--first img] [--last img]
    [--res 640x384|864x480|960x544|512x512|480x864] [--duration S] [--steps N] [--seed N] [--swap]

Librería (resto de pestañas): from wallabot import *; ensure(IMG|VID, tab, key); call(...)
Las dos apps comparten las GPU: swap=True descarga lo que haya cargado en la otra.
Recetas de cada pestaña: ../SKILL.md y ../references/.
"""
import argparse, base64, json, mimetypes, os, sys, time, urllib.request, uuid
from pathlib import Path


def _root():
    """URL base de Wallabot. El repositorio es público: no se escribe aquí, se lee de WALLABOT_ROOT
    (variable de entorno o línea del .env de la raíz, que Git ignora)."""
    root = os.environ.get("WALLABOT_ROOT")
    for d in Path(__file__).resolve().parents:  # en un worktree el .env está en la raíz del repo principal
        if root:
            break
        env = d / ".env"
        if env.is_file():
            for line in env.read_text().splitlines():
                if line.startswith("WALLABOT_ROOT="):
                    root = line.split("=", 1)[1].strip().strip("\"'")
    if not root:
        sys.exit("Falta WALLABOT_ROOT: añade WALLABOT_ROOT=https://<host de Wallabot> al .env de la raíz.")
    return root.rstrip("/")


ROOT = _root()
IMG, VID = f"{ROOT}/image21/gradio_api", f"{ROOT}/h3/gradio_api"
PRESETS = {"square1k": (1024, 1024), "square2k": (2048, 2048), "landscape": (1344, 768), "portrait": (768, 1344)}
FIXED_STEPS = {"official_turbo": 8, "turbo8": 8, "viggle_turbo": 6, "satoshi_turbo": 6}
OTHER_ENGINE = "Descarga el motor activo"


def call(base, api, *data):
    # El stream SSE solo se puede leer una vez: si se corta, el trabajo sigue en la GPU pero el resultado se pierde.
    req = urllib.request.Request(f"{base}/call/{api}", json.dumps({"data": list(data)}).encode(),
                                 {"Content-Type": "application/json"})
    eid = json.load(urllib.request.urlopen(req))["event_id"]
    event = None
    for line in urllib.request.urlopen(f"{base}/call/{api}/{eid}", timeout=600):
        line = line.decode().rstrip("\n")
        if line.startswith("event: "):
            event = line[7:]
        elif line.startswith("data: ") and event in ("complete", "error"):
            if event == "error":
                sys.exit(f"{api} error: {line[6:]}")
            return json.loads(line[6:])
    sys.exit(f"{api}: stream sin resultado")


def upload(base, path):
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"{Path(path).name}\"\r\n"
            f"Content-Type: {mime}\r\n\r\n").encode() + Path(path).read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{base}/upload", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    return {"path": json.load(urllib.request.urlopen(req))[0], "meta": {"_type": "gradio.FileData"}}


def b64(path):
    return f"data:{mimetypes.guess_type(path)[0] or 'image/png'};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def save(fd, out):
    """Guarda un FileData, una URL o un data: URL devuelto por la API."""
    url = fd["url"] if isinstance(fd, dict) else fd
    if url.startswith("data:"):
        Path(out).write_bytes(base64.b64decode(url.split(",", 1)[1]))
    else:
        urllib.request.urlretrieve(url if url.startswith("http") else ROOT + url, out)
    return out


def defaults(base, api):
    """{parámetro: valor por defecto} de un endpoint, leído de /info (p. ej. los prompts largos predefinidos)."""
    ep = json.load(urllib.request.urlopen(f"{base}/info"))["named_endpoints"][f"/{api}"]
    return {p["parameter_name"]: p.get("parameter_default") for p in ep["parameters"]}


_labels = {}


def vid_label(key):
    """Etiqueta que muestra /status de H3 para una clave de modelo (sale de los desplegables del config)."""
    if not _labels:
        cfg = json.load(urllib.request.urlopen(f"{ROOT}/h3/config"))
        for c in cfg["components"]:
            for ch in c.get("props", {}).get("choices") or []:
                if isinstance(ch, list) and len(ch) == 2 and isinstance(ch[1], str):
                    _labels[ch[1]] = ch[0]
    return _labels.get(key, key)


def _tts_busy():
    """(estado, parar) del Qwen3-TTS de la skill wallabot-voice, que también reserva las GPU.
    Esa skill no está en este repositorio: sin ella no se puede comprobar y se ignora."""
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "wallabot-voice" / "scripts"))
        import tts
        s = tts.status()
    except Exception:  # sin la skill o sin credencial: no se puede comprobar
        return "", None
    def stop():
        tts.stop()
        while tts.status() != "stopped":
            time.sleep(3)
    return ("" if s == "stopped" else f"Qwen3-TTS en estado {s}"), stop


def ensure(app, tab, key, *extra, swap=False):
    """Deja cargado `key` de la pestaña `tab` ('' = principal) en IMG o VID. Solo cabe un motor en las GPU.
    `extra`: argumentos adicionales de /load_* (solo ORB: el efecto, p. ej. "orbit")."""
    ep = lambda verb: f"{verb}_{tab}_model" if tab else f"{verb}_model"
    if app == IMG:
        status = lambda: call(IMG, ep("select"), key)[0]
        ready = lambda s: "Cargado · listo" in s and OTHER_ENGINE not in s
        loaded_here = lambda s: s.startswith("**Cargado") or s.startswith("**Cargándose")
        other = lambda: (lambda v: "" if v.startswith("**Descargado") else v)(call(VID, "status")[0])
        unload_here, unload_other = (lambda: call(IMG, "unload_model", "fp8")), (lambda: call(VID, "unload_model"))
    else:
        status = lambda: call(VID, "status")[0]
        ready = lambda s: "Listo para generar" in s and vid_label(key) in s
        loaded_here = lambda s: not s.startswith("**Descargado")
        other = lambda: (lambda v: v if v.startswith(("**Cargado", "**Cargándose")) else "")(call(IMG, "status", "fp8")[0])
        unload_here, unload_other = (lambda: call(VID, "unload_model")), (lambda: call(IMG, "unload_model", "fp8"))
    s = status()
    if ready(s):
        return
    for busy, unload in ((s if loaded_here(s) else "", unload_here), (other(), unload_other), _tts_busy()):
        if busy:
            if not swap:
                sys.exit(f"Las GPU están ocupadas (usa swap/--swap para descargar):\n{busy}")
            unload(); time.sleep(5)
    print(f"Cargando {key}…", file=sys.stderr)
    call(app, ep("load"), key, *extra)
    for _ in range(360):  # ponytail: sondeo fijo cada 5 s, hasta 30 min
        s = status()
        if ready(s):
            return
        if "No se puede cargar" in s or s.startswith("**Descargado"):
            sys.exit(f"Fallo cargando {key}:\n{s}")
        time.sleep(5)
    sys.exit(f"Timeout cargando {key}:\n{s}")


# ── Iluminación: port de autoPrompt() del JS de la pestaña ──
LIGHT_COLORS = {"red": "#ff2828", "orange": "#ff8c1e", "warm amber": "#ffb450", "yellow": "#ffe632", "green": "#5ae628",
                "teal": "#1ec8be", "cyan": "#28dcff", "blue": "#285aff", "purple": "#963cff", "magenta": "#f028dc",
                "pink": "#ff6eb4", "white": "#ffffff", "cool white": "#d7e6ff", "warm white": "#ffebcd"}


def relight_prompt(lights, diffusion):
    """lights: [{color:'#hex', x:0 izq→1 der, y:0 abajo→1 arriba, z:0 cerca→1 lejos}] (máx. 3); diffusion 0 dura→1 suave."""
    rgb = lambda h: [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    name = lambda h: min(LIGHT_COLORS, key=lambda n: sum((a - b) ** 2 for a, b in zip(rgb(LIGHT_COLORS[n]), rgb(h))))
    parts = [f"a strong {name(L['color'])} light coming from "
             f"{'the left' if L['x'] < 0.35 else 'the right' if L['x'] > 0.65 else 'the front'}, "
             f"{'high above' if L['y'] > 0.7 else 'below' if L['y'] < 0.3 else 'at face height'}, "
             f"{'close to the subject' if L['z'] < 0.35 else 'far away' if L['z'] > 0.65 else 'at a medium distance'}"
             for L in lights]
    q = ('hard, crisp light with sharp, defined shadows' if diffusion < 0.35 else
         'soft, diffused light with gentle shadow falloff' if diffusion > 0.65 else 'moderately soft light')
    return ('Relight the photo with ' + '; and '.join(parts) + f'. Use {q}. Remove the original lighting so the scene '
            "is dark and lit only by these lights. Keep the person's identity, face, expression, pose, hair, clothing "
            "and the background exactly the same; only change the lighting and the colour of the light falling on the scene.")


def mask_editor(base, prep, box, tmp="/tmp"):
    """Valor de ImageEditor para H3: `prep` lo devuelve /prepare_*_clip; pinta en blanco el rectángulo
    `box` (x1,y1,x2,y2 normalizados). Necesita Pillow: uv run --with pillow."""
    from PIL import Image, ImageDraw
    bg = Image.open(save(prep["background"], f"{tmp}/wb_frame.png")).convert("RGBA"); W, H = bg.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle([box[0] * W, box[1] * H, box[2] * W, box[3] * H], fill=(255, 255, 255, 255))
    layer.save(f"{tmp}/wb_layer.png"); Image.alpha_composite(bg, layer).save(f"{tmp}/wb_comp.png")
    return {"background": prep["background"], "layers": [upload(base, f"{tmp}/wb_layer.png")],
            "composite": upload(base, f"{tmp}/wb_comp.png"), "id": None}


def image(a):
    ensure(IMG, "", a.model, swap=a.swap)
    w, h = PRESETS.get(a.size) or map(int, a.size.lower().split("x"))
    refs = [{"image": upload(IMG, r), "caption": None} for r in a.ref]
    img, seed, info = call(IMG, "generate", a.model, a.prompt, refs, w, h, a.steps or FIXED_STEPS.get(a.model, 40),
                           a.seed or 0, a.seed is None, a.negative, a.transparent)
    print(f"{save(img, a.out)} · seed {seed} · {info}")


def video(a):
    ensure(VID, "", a.model, swap=a.swap)
    mode = {(0, 0): "text", (1, 0): "first", (0, 1): "last", (1, 1): "first_last"}[bool(a.first), bool(a.last)]
    first, last = (upload(VID, p) if p else None for p in (a.first, a.last))
    res = " × ".join(a.res.lower().split("x"))
    _, mp4, seed, info = call(VID, "generate_video", a.model, mode, a.prompt, first, last, res, a.duration,
                              a.steps, a.seed or 0, a.seed is None)
    print(f"{save(mp4, a.out)} · seed {seed} · {info}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("image")
    i.add_argument("prompt")
    i.add_argument("-o", "--out", default="out.png")
    i.add_argument("-m", "--model", default="official_turbo")
    i.add_argument("-r", "--ref", action="append", default=[])
    i.add_argument("--size", default="square1k")
    i.add_argument("--steps", type=int)
    i.add_argument("--seed", type=int)
    i.add_argument("--negative", default="")
    i.add_argument("--transparent", action="store_true")
    v = sub.add_parser("video")
    v.add_argument("prompt")
    v.add_argument("-o", "--out", default="out.mp4")
    v.add_argument("-m", "--model", default="fl2va_q4")
    v.add_argument("--first")
    v.add_argument("--last")
    v.add_argument("--res", default="640x384")
    v.add_argument("--duration", type=float, default=3)
    v.add_argument("--steps", type=int, default=20)
    v.add_argument("--seed", type=int)
    for p in (i, v):
        p.add_argument("--swap", action="store_true", help="descarga lo que ocupe las GPU")
    a = ap.parse_args()
    (image if a.cmd == "image" else video)(a)


if __name__ == "__main__":
    main()
