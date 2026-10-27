"""Logo de la barbería y fotos para compartir links (Open Graph)."""

import base64
from io import BytesIO

from PIL import Image

from tests.test_agenda import ins  # noqa: F401


def _png(ancho=800, alto=500) -> str:
    buf = BytesIO()
    Image.new("RGB", (ancho, alto), "#c9a46a").save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def test_subir_logo_lo_recorta_cuadrado_y_se_ve_publico(client, ins):  # noqa: F811
    r = client.put("/panel/barberia/logo", json={"imagen": _png()})
    assert r.status_code == 200 and r.json()["logo_url"].endswith("?v=1")
    logo = client.get("/logo/inspirationmen.png")
    assert logo.status_code == 200 and Image.open(BytesIO(logo.content)).size == (400, 400)
    assert client.get("/p/inspirationmen").json()["logo_url"] == r.json()["logo_url"]
    assert (
        client.put("/panel/barberia/logo", json={"imagen": _png()})
        .json()["logo_url"]
        .endswith("?v=2")
    )
    assert client.delete("/panel/barberia/logo").status_code == 204
    assert client.get("/logo/inspirationmen.png").status_code == 404


def test_imagen_invalida(client, ins):  # noqa: F811
    r = client.put("/panel/barberia/logo", json={"imagen": "data:image/png;base64," + "A" * 200})
    assert r.status_code == 422


def test_fotos_para_compartir(client, ins):  # noqa: F811
    for url in ("/og.png", "/og/inspirationmen.png"):
        r = client.get(url)
        assert r.status_code == 200 and Image.open(BytesIO(r.content)).size == (1200, 630)
    client.put("/panel/barberia/logo", json={"imagen": _png()})
    assert client.get("/og/inspirationmen.png").status_code == 200
    assert client.get("/og/no-existe.png").status_code == 404


def test_pagina_con_etiquetas_de_la_barberia(client, ins, monkeypatch):  # noqa: F811
    from app.api.routers import paginas

    base = (
        '<html><head><title>NavAgenda</title><!--og--><meta property="og:image" '
        'content="general" /><!--/og--></head><body></body></html>'
    )
    monkeypatch.setitem(paginas._cache, "html", base)
    monkeypatch.setitem(paginas._cache, "hora", 1e12)
    r = client.get("/pagina/inspirationmen").text
    assert "<title>Inspirationmen · Sacá turno</title>" in r and "/api/og/inspirationmen.png" in r
    otra = client.get("/pagina/panel").text
    assert 'content="general"' in otra and "<title>NavAgenda</title>" in otra
