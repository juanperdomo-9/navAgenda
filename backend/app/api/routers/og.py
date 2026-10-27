"""Fotos para compartir links (Open Graph): una general de NavAgenda y una por barbería.

Es la imagen que muestran WhatsApp, Instagram y compañía al pegar el link. Se dibuja con el
sistema "El turnero": el color de la barbería, su nombre en Archivo angosto y el display negro.
"""

from functools import cache
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, status
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from sqlalchemy import select

from app.api.deps import DB
from app.models import Barberia

router = APIRouter(tags=["og"])
FUENTE = Path(__file__).resolve().parents[2] / "static" / "Archivo.ttf"
ANCHO, ALTO = 1200, 630
TINTA, PAPEL, ROLLO, DISPLAY, LED = "#141210", "#fffdf3", "#f6d13a", "#120c0b", "#ff2b1c"


@cache
def _fuente(tam: int, peso: int = 900, ancho: int = 62) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FUENTE), tam)
    f.set_variation_by_axes([peso, ancho])
    return f


def _lum(hex_: str) -> float:
    c = [int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def _tinta(fondo: str) -> str:
    """La tinta que más contrasta con el fondo (igual que en la página)."""
    l = _lum(fondo)  # noqa: E741
    return (
        TINTA if (l + 0.05) / (_lum(TINTA) + 0.05) >= (_lum(PAPEL) + 0.05) / (l + 0.05) else PAPEL
    )


def _titular(
    d: ImageDraw.ImageDraw,
    texto: str,
    y: int,
    color: str,
    maximo: int = 250,
    ancho: int = ANCHO - 120,
) -> int:
    """El texto en mayúsculas lo más grande posible (hasta 2 líneas). Devuelve dónde termina."""
    texto = texto.upper()
    for tam in range(maximo, 60, -6):
        f = _fuente(tam)
        lineas, actual = [], ""
        for palabra in texto.split():
            prueba = f"{actual} {palabra}".strip()
            if d.textlength(prueba, font=f) <= ancho or not actual:
                actual = prueba
            else:
                lineas.append(actual)
                actual = palabra
        lineas.append(actual)
        if (
            len(lineas) <= 2
            and len(lineas) * tam * 0.86 <= 300
            and all(d.textlength(x, font=f) <= ancho for x in lineas)
        ):
            for i, linea in enumerate(lineas):
                d.text((60, y + i * tam * 0.86), linea, font=f, fill=color)
            return int(y + len(lineas) * tam * 0.86)
    d.text((60, y), texto[:30], font=_fuente(60), fill=color)
    return y + 60


def _display(img: Image.Image, texto: str, chico: str) -> None:
    """La franja del display negro con el texto en LED rojo."""
    d = ImageDraw.Draw(img)
    caja = (40, 440, ANCHO - 40, ALTO - 40)
    d.rounded_rectangle(caja, radius=22, fill=DISPLAY, outline="#2a2220", width=8)
    f = _fuente(96)
    brillo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(brillo).text((84, 458), texto, font=f, fill=LED)
    img.alpha_composite(brillo.filter(ImageFilter.GaussianBlur(10)))
    img.alpha_composite(brillo)
    fc = _fuente(30, 700, 100)
    d.text((ANCHO - 84 - d.textlength(chico, font=fc), 506), chico, font=fc, fill="#cdbfae")


def _png(img: Image.Image) -> Response:
    buf = BytesIO()
    img.convert("RGB").save(buf, "PNG", optimize=True)
    return Response(
        buf.getvalue(), media_type="image/png", headers={"Cache-Control": "public, max-age=3600"}
    )


def _marca(d: ImageDraw.ImageDraw, color: str, fondo: str, tinta: str, texto: str) -> None:
    d.rectangle((60, 48, 112, 92), fill=fondo)
    d.text((70, 52), "Nº", font=_fuente(34), fill=tinta)
    d.text((128, 50), texto, font=_fuente(40), fill=color)


@router.get("/og.png")
def og_general():
    img = Image.new("RGBA", (ANCHO, ALTO), ROLLO)
    d = ImageDraw.Draw(img)
    _marca(d, TINTA, TINTA, ROLLO, "NAVAGENDA")
    _titular(d, "Sacá número.", 112, TINTA, maximo=290)
    _display(img, "TURNOS ONLINE", "Barberías de La Plata · sin seña")
    return _png(img)


@router.get("/og/{slug}.png")
def og_barberia(slug: str, db: DB):
    b = db.scalar(select(Barberia).where(Barberia.slug == slug, Barberia.activa))
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa barbería.")
    fondo = b.color_acento or "#c9a46a"
    tinta = _tinta(fondo)
    img = Image.new("RGBA", (ANCHO, ALTO), fondo)
    d = ImageDraw.Draw(img)
    _marca(d, tinta, tinta, fondo, "SACÁ TURNO ONLINE")
    ancho = ANCHO - 120
    if b.logo_png:  # el logo en un círculo arriba a la derecha
        logo = Image.open(BytesIO(b.logo_png)).convert("RGBA").resize((250, 250))
        mascara = Image.new("L", (250, 250), 0)
        ImageDraw.Draw(mascara).ellipse((0, 0, 249, 249), fill=255)
        d.ellipse((ANCHO - 60 - 258, 44, ANCHO - 60 + 8 - 8, 44 + 258), fill=tinta)
        img.paste(logo, (ANCHO - 60 - 254, 48), mascara)
        ancho = ANCHO - 120 - 290
    fin = _titular(d, b.nombre, 112, tinta, ancho=ancho)
    lugar = " · ".join(x for x in (b.direccion, b.barrio or b.ciudad) if x)
    if lugar and fin < 400:
        d.text((62, fin + 6), lugar, font=_fuente(36, 700, 100), fill=tinta)
    _display(img, "SACÁ TU TURNO", "Sin fila · sin cuenta · sin seña")
    return _png(img)
