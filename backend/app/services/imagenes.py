"""Imágenes que suben las barberías (llegan en base64 desde el navegador)."""

import base64
import binascii
from io import BytesIO

from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError


def abrir(dato: str) -> Image.Image:
    try:
        img = Image.open(BytesIO(base64.b64decode(dato.split(",", 1)[-1], validate=False)))
        img.load()
    except (binascii.Error, UnidentifiedImageError, OSError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "No pudimos leer esa imagen. Probá con JPG/PNG.",
        ) from None
    return ImageOps.exif_transpose(img)


def cuadrada_png(dato: str, lado: int = 400) -> bytes:
    """Logo: recortado en cuadrado, con transparencia."""
    img = ImageOps.fit(abrir(dato).convert("RGBA"), (lado, lado), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def cuadrada_jpg(dato: str, lado: int = 480) -> bytes:
    """Foto de un barbero: cuadrada, liviana."""
    img = ImageOps.fit(abrir(dato).convert("RGB"), (lado, lado), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=84, optimize=True)
    return buf.getvalue()


def foto_jpg(dato: str, maximo: int = 1600) -> bytes:
    """Foto del local: se respeta la proporción, con el lado mayor en `maximo`."""
    img = abrir(dato).convert("RGB")
    img.thumbnail((maximo, maximo), Image.Resampling.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
    return buf.getvalue()
