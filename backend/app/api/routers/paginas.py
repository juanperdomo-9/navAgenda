"""El HTML de la web con las etiquetas para compartir de cada barbería (Open Graph).

WhatsApp e Instagram no ejecutan JavaScript: leen el HTML. Render reescribe las rutas de la web
(/inspirationmen, /panel, /t/...) a /pagina/<ruta>; acá se toma el index.html publicado y se le
ponen el título, la descripción y la foto de la barbería si la ruta es su link.
"""

import re
import time
import urllib.request
from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from app.api.deps import DB
from app.core.config import get_settings
from app.models import Barberia

router = APIRouter(tags=["paginas"])
_cache: dict = {"html": None, "hora": 0.0}
BLOQUE = re.compile(r"<!--og[\s\S]*?<!--/og-->")


def _index() -> str | None:
    """index.html de la web publicada (cacheado 60 s, para tomar rápido cada deploy nuevo)."""
    if _cache["html"] and time.time() - _cache["hora"] < 60:
        return _cache["html"]
    try:
        url = get_settings().sitio_url.rstrip("/") + "/index.html"
        with urllib.request.urlopen(url, timeout=10) as r:  # noqa: S310 (URL de configuración)
            _cache["html"], _cache["hora"] = r.read().decode(), time.time()
    except OSError:
        pass  # si falla, sirve el último que tenía
    return _cache["html"]


def etiquetas(titulo: str, descripcion: str, imagen: str, url: str) -> str:
    t, d, i, u = (escape(x, quote=True) for x in (titulo, descripcion, imagen, url))
    return (
        f'<!--og--><meta name="description" content="{d}" />'
        f'<link rel="canonical" href="{u}" />'
        '<meta property="og:type" content="website" />'
        '<meta property="og:site_name" content="NavAgenda" />'
        '<meta property="og:locale" content="es_AR" />'
        f'<meta property="og:url" content="{u}" />'
        f'<meta property="og:title" content="{t}" />'
        f'<meta property="og:description" content="{d}" />'
        f'<meta property="og:image" content="{i}" />'
        '<meta property="og:image:width" content="1200" />'
        '<meta property="og:image:height" content="630" />'
        '<meta name="twitter:card" content="summary_large_image" /><!--/og-->'
    )


@router.get("/pagina/{ruta:path}", response_class=HTMLResponse)
def pagina(ruta: str, db: DB):
    html = _index()
    if not html:  # sin el index publicado: que lo resuelva la carpeta de la barbería o el inicio
        return HTMLResponse(f"<script>location.replace('/{escape(ruta)}/')</script>")
    sitio = get_settings().sitio_url.rstrip("/")
    slug = ruta.strip("/").split("/")[0]
    b = db.scalar(select(Barberia).where(Barberia.slug == slug, Barberia.activa)) if slug else None
    if b:
        lugar = " · ".join(x for x in (b.direccion, b.barrio) if x)
        titulo = f"{b.nombre} · Sacá turno"
        html = BLOQUE.sub(
            lambda _: etiquetas(
                titulo,
                f"{lugar + '. ' if lugar else ''}Sacá turno online con tu barbero: "
                "sin fila, sin cuenta, sin seña.",
                f"{sitio}/api/og/{b.slug}.png",
                f"{sitio}/{b.slug}",
            ),
            html,
            count=1,
        )
        html = re.sub(r"<title>.*?</title>", f"<title>{escape(titulo)}</title>", html, count=1)
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})
