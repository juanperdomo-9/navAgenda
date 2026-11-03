"""Videos de la galería: suben directo a Supabase Storage con URL firmada (acá, simulado)."""

import pytest
from sqlalchemy import select

from app.core.security import hashear_clave
from app.db import inspirationmen
from app.models import Usuario
from app.services import almacen
from tests.util import CLAVE, crear_usuario, ingresar


@pytest.fixture
def storage(monkeypatch):
    borrados = []
    monkeypatch.setattr(almacen, "configurado", lambda: True)
    monkeypatch.setattr(
        almacen, "firmar_subida", lambda ruta: f"https://s.test/sign/{ruta}?token=x"
    )
    monkeypatch.setattr(almacen, "url_publica", lambda ruta: f"https://s.test/public/{ruta}")
    monkeypatch.setattr(almacen, "existe", lambda ruta: True)
    monkeypatch.setattr(almacen, "borrar", borrados.append)
    return borrados


@pytest.fixture
def ins(client, db):
    inspirationmen.cargar(db)
    admin = db.scalar(select(Usuario).where(Usuario.usuario == "inspirationmen"))
    admin.password_hash, admin.debe_cambiar_clave = hashear_clave(CLAVE), False
    db.flush()
    ingresar(client, "inspirationmen")


def subir(client):
    r = client.post("/panel/videos/subida", json={"tipo": "video/mp4", "bytes": 5_000_000})
    assert r.status_code == 200, r.text
    return client.post("/panel/videos", json={"ruta": r.json()["ruta"]})


def test_sin_configurar_no_hay_videos(client, ins):
    assert client.get("/panel/videos").json() == {"habilitado": False, "videos": []}
    r = client.post("/panel/videos/subida", json={"tipo": "video/mp4", "bytes": 1000})
    assert r.status_code == 503


def test_sube_hasta_dos_videos_y_se_ven_en_la_pagina(client, ins, storage):
    assert subir(client).status_code == 201
    assert subir(client).status_code == 201
    r = client.post("/panel/videos/subida", json={"tipo": "video/mp4", "bytes": 1000})
    assert r.status_code == 409
    assert len(client.get("/p/inspirationmen").json()["videos"]) == 2


def test_valida_tipo_y_tamanio(client, ins, storage):
    assert (
        client.post("/panel/videos/subida", json={"tipo": "image/png", "bytes": 10}).status_code
        == 422
    )
    grande = {"tipo": "video/mp4", "bytes": 16 * 1024 * 1024}
    assert client.post("/panel/videos/subida", json=grande).status_code == 422


def test_no_se_confirma_una_ruta_de_otra_barberia(client, ins, storage):
    r = client.post("/panel/videos", json={"ruta": "00000000-0000-0000-0000-000000000000/x.mp4"})
    assert r.status_code == 422


def test_borrar_lo_saca_del_storage_y_otra_barberia_no_puede(client, db, ins, storage):
    v = subir(client).json()
    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.delete(f"/panel/videos/{v['id']}").status_code == 404
    client.post("/auth/salir")
    ingresar(client, "inspirationmen")
    assert client.delete(f"/panel/videos/{v['id']}").status_code == 204
    assert len(storage) == 1 and client.get("/p/inspirationmen").json()["videos"] == []
