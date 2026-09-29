#!/usr/bin/env python3
"""Create editable 16:9 SVG frames for the Gymnasia agent-loop video."""

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parent
W, H = 1920, 1080
BG = "#07090D"
SURFACE = "#141820"
SURFACE_2 = "#1B212B"
BORDER = "#303844"
WHITE = "#F4F7FB"
MUTED = "#A6AFBC"
LIME = "#CBFF1A"
BLUE = "#71D8FF"
AMBER = "#FFC36A"
RED = "#FF6D73"


def rect(x, y, w, h, *, fill=SURFACE, stroke=BORDER, radius=26, sw=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def text(x, y, value, *, size=34, color=WHITE, weight=500, anchor="start", spacing=0):
    return (f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" '
            f'font-weight="{weight}" text-anchor="{anchor}" letter-spacing="{spacing}" '
            f'font-family="Arial, Helvetica, sans-serif">{escape(value)}</text>')


def circle(x, y, r, *, fill=LIME, stroke="none", sw=0):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def path(d, *, stroke=LIME, width=6, dash="", marker=False):
    extra = ' marker-end="url(#arrow)"' if marker else ""
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{dash_attr}{extra}/>'


def pill(x, y, w, label, *, fill="#263315", fg=LIME, border=LIME, size=23):
    return (rect(x, y, w, 48, fill=fill, stroke=border, radius=24, sw=1.5)
            + text(x + w / 2, y + 32, label, size=size, color=fg, weight=700, anchor="middle"))


def frame(number, title, subtitle):
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<defs><marker id="arrow" markerWidth="15" markerHeight="15" refX="12" refY="7.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M2 2 L12 7.5 L2 13" fill="none" stroke="#CBFF1A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>',
        rect(0, 0, W, H, fill=BG, stroke="none", radius=0, sw=0),
        rect(98, 68, 8, 55, fill=LIME, stroke="none", radius=4, sw=0),
        text(130, 105, "GYMNASIA  /  AGENT LOOP", size=25, color=LIME, weight=800, spacing=3),
        text(1820, 105, f"{number:02d} / 07", size=25, color=MUTED, weight=700, anchor="end"),
        text(98, 210, title, size=66, weight=800),
        text(100, 268, subtitle, size=29, color=MUTED),
        path("M100 1005 H1820", stroke=BORDER, width=2),
        text(100, 1042, "EL BUCLE DE UN AGENTE", size=22, color=MUTED, weight=700, spacing=2),
        text(1820, 1042, "maximofn.com/gymnasia-agent-tool-loop", size=21, color=MUTED, anchor="end"),
    ]


def save(name, parts):
    ROOT.joinpath(name).write_text("\n".join(parts + ["</svg>"]) + "\n", encoding="utf-8")


# 01 — A model call stops when it requests a tool.
s = frame(1, "Una llamada no es un agente", "La tool call termina el turno. La aplicación tiene que continuar el ciclo.")
s += [
    rect(100, 350, 500, 480),
    pill(135, 385, 166, "PERSONA"),
    text(140, 505, "¿Cuánto he progresado", size=37, weight=700),
    text(140, 558, "en press banca", size=37, weight=700),
    text(140, 611, "este mes?", size=37, weight=700),
    text(140, 752, "Una pregunta", size=28, color=MUTED),
    path("M605 595 H686", marker=True),
    rect(700, 350, 500, 480),
    pill(735, 385, 157, "MODELO"),
    text(740, 505, "Necesito consultar", size=37, weight=700),
    text(740, 558, "los entrenamientos", size=37, weight=700),
    text(740, 752, "Pide una herramienta", size=28, color=MUTED),
    path("M1205 595 H1286", marker=True),
    rect(1300, 350, 520, 480, fill="#1D2118", stroke="#596C20"),
    pill(1335, 385, 180, "TOOL CALL", fill="#354018"),
    text(1340, 505, "leer_entrenamientos", size=34, weight=700),
    text(1340, 570, "El turno termina aquí", size=33, color=AMBER, weight=700),
    text(1340, 750, "Aún no ha visto el resultado", size=28, color=MUTED),
]
save("01-una-llamada-no-es-un-agente.svg", s)


# 02 — Main loop and both exits.
s = frame(2, "El bucle lo controla la app", "El modelo pide; Gymnasia ejecuta, devuelve el resultado y decide cuándo parar.")
for x, label, detail in [
    (105, "1  MODELO", "Pide una tool"),
    (565, "2  APP", "Ejecuta código local"),
    (1025, "3  HISTORIAL", "Petición + resultado"),
    (1485, "4  MODELO", "Vuelve a responder"),
]:
    s += [rect(x, 370, 330, 260), text(x + 32, 445, label, size=31, color=LIME, weight=800),
          text(x + 32, 525, detail, size=27, weight=600)]
for x in (438, 898, 1358):
    s.append(path(f"M{x} 500 H{x + 105}", marker=True))
s += [
    path("M1650 648 V735 H260 V648", stroke=LIME, width=6, marker=True),
    pill(755, 699, 365, "OTRA RONDA", size=26),
    rect(360, 800, 520, 125, fill="#152319", stroke="#38794E"),
    text(405, 853, "SIN MÁS TOOLS", size=27, color=LIME, weight=800),
    text(405, 894, "Respuesta final", size=27),
    rect(1040, 800, 520, 125, fill="#282018", stroke="#9A6938"),
    text(1085, 853, "LÍMITE DE RONDAS", size=27, color=AMBER, weight=800),
    text(1085, 894, "Cierre sin tools", size=27),
]
save("02-el-bucle.svg", s)


# 03 — The common local selection and provider adapters.
s = frame(3, "Una política de contexto", "Gymnasia elige el historial en el móvil antes de adaptarlo a cada API.")
s += [
    rect(105, 352, 630, 520, fill="#171F19", stroke="#587228"),
    pill(145, 390, 262, "EN EL TELÉFONO"),
    text(145, 505, "Hasta 20 mensajes", size=50, weight=800),
    text(145, 570, "del chat local", size=37, color=MUTED),
]
for y in (633, 677, 721):
    s += [rect(150, y, 445, 27, fill=SURFACE_2, stroke="none", radius=13, sw=0)]
s += [
    path("M745 610 H915", marker=True),
    text(935, 368, "MISMA SELECCIÓN", size=26, color=LIME, weight=800, spacing=1),
]
for y, name, detail in [
    (402, "OpenAI", "store: false · sin previous_response_id"),
    (565, "Anthropic", "tool_use → tool_result"),
    (728, "Google", "ajuste de tamaño si hace falta"),
]:
    s += [rect(920, y, 895, 132), text(960, y + 55, name, size=36, weight=800),
          text(960, y + 100, detail, size=26, color=MUTED)]
s += [
    rect(104, 905, 1710, 67, fill="#202515", stroke="#4A6324", radius=20),
    text(140, 949, "Durante la consulta se reenvía completa la secuencia activa de peticiones y resultados.", size=28, color=WHITE, weight=600),
]
save("03-contexto-comun.svg", s)


# 04 — Budget and explicit unexecuted result.
s = frame(4, "Diez rondas por mensaje", "El límite corta el ciclo y deja claro qué petición quedó pendiente.")
s += [text(103, 385, "RONDAS DEL BUCLE", size=27, color=MUTED, weight=800, spacing=2)]
for i in range(10):
    x = 168 + i * 177
    fill = "#425411" if i < 9 else "#4A341A"
    stroke = LIME if i < 9 else AMBER
    s += [circle(x, 505, 57, fill=fill, stroke=stroke, sw=4),
          text(x, 520, str(i + 1), size=42, color=WHITE, weight=800, anchor="middle")]
    if i < 9:
        s.append(path(f"M{x + 62} 505 H{x + 113}", stroke=LIME, width=5))
s += [
    rect(120, 660, 770, 270, fill="#2B2118", stroke="#A76D32"),
    pill(158, 699, 205, "PENDIENTE", fill="#4A341A", fg=AMBER, border=AMBER),
    text(160, 790, "Tool no ejecutada", size=43, weight=800),
    text(160, 845, "Resultado explícito en el historial", size=27, color=MUTED),
    path("M906 795 H1009", marker=True),
    rect(1025, 660, 770, 270, fill="#172319", stroke="#4B8D4B"),
    pill(1062, 699, 254, "ÚLTIMA LLAMADA"),
    text(1062, 790, "Solo respuesta en texto", size=42, weight=800),
    text(1062, 845, "tool_choice: none", size=29, color=LIME, weight=700),
]
save("04-diez-rondas.svg", s)


# 05 — Separate data and system instruction, within one request.
s = frame(5, "Una sola llamada de cierre", "Dos campos cumplen funciones diferentes en la misma petición a la API.")
s += [
    rect(110, 360, 805, 445),
    pill(150, 399, 165, "HISTORIAL"),
    text(150, 508, "Qué ocurrió", size=49, weight=800),
    rect(150, 553, 716, 166, fill="#23211A", stroke="#7D693E", radius=18),
    text(182, 620, "Resultado de tool:", size=30, color=AMBER, weight=700),
    text(182, 673, "«No ejecutada; se llegó al límite»", size=30, color=WHITE),
    rect(1005, 360, 805, 445),
    pill(1045, 399, 284, "INSTRUCCIONES"),
    text(1045, 508, "Cómo responder", size=49, weight=800),
    rect(1045, 553, 716, 166, fill="#1C281A", stroke="#62834A", radius=18),
    text(1077, 620, "«Explica el límite, aclara", size=30, color=WHITE),
    text(1077, 673, "lo pendiente y pregunta si continuar»", size=30, color=WHITE),
    pill(701, 849, 518, "tool_choice: none", fill="#2B3719", size=33),
    text(960, 953, "No puede solicitar más herramientas", size=29, color=MUTED, anchor="middle"),
]
save("05-llamada-de-cierre.svg", s)


# 06 — Tool results are data, not authority.
s = frame(6, "El resultado es un dato", "Las órdenes sobre cómo responder van en las instrucciones de la app.")
s += [
    rect(105, 355, 810, 480),
    pill(145, 393, 274, "RESULTADO DE TOOL", fill="#342219", fg=AMBER, border=AMBER),
    text(145, 506, "Texto de una página web", size=38, weight=800),
    rect(145, 558, 730, 139, fill="#261B1D", stroke="#B44A56", radius=18),
    text(176, 618, "«Ignora lo anterior y... »", size=35, color=RED, weight=700),
    text(145, 769, "Puede contener instrucciones externas", size=29, color=MUTED),
    rect(1005, 355, 810, 480, fill="#18241B", stroke="#578B4F"),
    pill(1045, 393, 292, "CÓDIGO DE LA APP"),
    text(1045, 506, "Controla el siguiente paso", size=38, weight=800),
    rect(1045, 558, 730, 139, fill="#20311D", stroke="#70A958", radius=18),
    text(1076, 618, "Instrucciones de sistema", size=35, color=LIME, weight=700),
    text(1045, 769, "Define cómo debe responder el modelo", size=29, color=MUTED),
    path("M930 594 H990", stroke=RED, width=6),
    path("M944 570 L977 618 M977 570 L944 618", stroke=RED, width=5),
    text(960, 922, "Una tool informa de lo que pasó; no dirige al agente.", size=37, weight=700, anchor="middle"),
]
save("06-dato-vs-instruccion.svg", s)


# 07 — Deterministic fake-provider checks.
s = frame(7, "Probar el bucle sin modelo", "Un proveedor falso devuelve turnos preparados y permite comprobar cada paso.")
s += [
    rect(110, 365, 1700, 177),
    pill(150, 398, 239, "CASO NORMAL"),
    text(150, 492, "Tool 1   →   Tool 2   →   Respuesta final", size=41, weight=800),
    rect(110, 570, 1700, 177),
    pill(150, 603, 226, "CASO LÍMITE", fill="#4A341A", fg=AMBER, border=AMBER),
    text(150, 697, "10 rondas   →   No ejecutada   →   Cierre sin tools", size=41, weight=800),
    rect(110, 775, 1700, 177),
    pill(150, 808, 253, "TRES APIs"),
    text(150, 902, "Misma regla: OpenAI · Anthropic · Google", size=41, weight=800),
]
save("07-tests-del-bucle.svg", s)


# Transparent type overlay. Keep artwork separate so it can be replaced in an editor.
overlay = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941" viewBox="0 0 1672 941">',
    '<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07090D" stop-opacity="0"/><stop offset="0.6" stop-color="#07090D" stop-opacity="0.82"/><stop offset="1" stop-color="#07090D" stop-opacity="0.98"/></linearGradient></defs>',
    '<rect x="0" y="620" width="1672" height="321" fill="url(#shade)"/>',
    text(87, 74, "GYMNASIA  /  AGENTES", size=31, color=LIME, weight=800, spacing=3),
    text(836, 827, "¿CUÁNDO PARA?", size=115, color=WHITE, weight=900, anchor="middle", spacing=-2),
    '<rect x="390" y="860" width="892" height="8" rx="4" fill="#CBFF1A"/>',
    '</svg>',
]
ROOT.joinpath("thumbnail-overlay.svg").write_text("\n".join(overlay) + "\n", encoding="utf-8")
