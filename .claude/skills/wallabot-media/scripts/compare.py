"""Pone imágenes en fila (misma altura, transparencia sobre damero) para revisar antes/después.

uv run --with pillow compare.py a.png b.png [c.png ...] salida.jpg
"""
import sys
from PIL import Image, ImageDraw

*ins, out = sys.argv[1:]; H = 360
ims = []
for f in ins:
    im = Image.open(f).convert('RGBA'); bg = Image.new('RGBA', im.size, (190, 190, 190, 255))
    for x in range(0, im.size[0], 48):
        for y in range(0, im.size[1], 48):
            if (x//48 + y//48) % 2: bg.paste((235, 235, 235, 255), (x, y, x+48, y+48))
    im = Image.alpha_composite(bg, im).convert('RGB'); w, h = im.size
    ims.append((im.resize((round(w*H/h), H)), f"{f.split('/')[-1]} {w}x{h}"))
sheet = Image.new('RGB', (sum(i.size[0] for i, _ in ims) + 8*len(ims), H+18), 'white'); d = ImageDraw.Draw(sheet); x = 0
for im, t in ims: sheet.paste(im, (x, 0)); d.text((x+2, H+3), t, fill='black'); x += im.size[0] + 8
sheet.save(out, quality=88)
