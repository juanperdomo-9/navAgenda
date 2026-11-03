"""Videos de la galería en Supabase Storage (fuera de la base, que tiene poco espacio).

El navegador sube el archivo directo a Supabase con una URL firmada que arma la API: el video
no pasa por Render. Se sirven desde la URL pública del bucket (con soporte de Range, para iPhone).
Sin SUPABASE_URL / SUPABASE_SERVICE_KEY no hay videos (el panel lo avisa).
"""

import json
import urllib.error
import urllib.request

from app.core.config import get_settings


class SinAlmacen(Exception):
    """Falta configurar Supabase Storage."""


def _base() -> tuple[str, str, str]:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise SinAlmacen
    return s.supabase_url.rstrip("/"), s.supabase_service_key, s.supabase_bucket


def configurado() -> bool:
    try:
        _base()
        return True
    except SinAlmacen:
        return False


def _pedido(metodo: str, url: str, clave: str, cuerpo: dict | None = None) -> dict:
    req = urllib.request.Request(
        url,
        method=metodo,
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
        headers={
            "Authorization": f"Bearer {clave}",
            "apikey": clave,
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        texto = r.read().decode() or "{}"
    return json.loads(texto)


def firmar_subida(ruta: str) -> str:
    """URL para que el navegador suba el archivo con PUT (vale un rato, una sola vez)."""
    url, clave, bucket = _base()
    r = _pedido("POST", f"{url}/storage/v1/object/upload/sign/{bucket}/{ruta}", clave, {})
    return f"{url}/storage/v1{r['url']}"


def url_publica(ruta: str) -> str:
    url, _, bucket = _base()
    return f"{url}/storage/v1/object/public/{bucket}/{ruta}"


def existe(ruta: str) -> bool:
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url_publica(ruta), method="HEAD"), timeout=20
        ):
            return True
    except urllib.error.HTTPError:
        return False


def borrar(ruta: str) -> None:
    url, clave, bucket = _base()
    try:
        _pedido("DELETE", f"{url}/storage/v1/object/{bucket}", clave, {"prefixes": [ruta]})
    except urllib.error.HTTPError:
        pass  # si ya no estaba, da igual
