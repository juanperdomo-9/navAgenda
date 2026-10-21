"""'Quiero sumar mi barbería': formulario público y bandeja del superadmin."""

import pytest

from app.api.routers.solicitudes import limite_solicitudes
from tests.util import crear_usuario, ingresar

PEDIDO = {"barberia": "Barbería Nueva", "nombre": "Pablo", "telefono": "221 456 7890"}


@pytest.fixture(autouse=True)
def _limpio():
    limite_solicitudes.reiniciar()


def test_pedido_llega_al_superadmin_y_se_descarta(client, db):
    assert client.post("/p/solicitudes", json={**PEDIDO, "barrio": "Tolosa"}).status_code == 201
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    ls = client.get("/super/solicitudes").json()
    assert len(ls) == 1 and ls[0]["telefono"] == "+5492214567890" and ls[0]["barrio"] == "Tolosa"
    client.patch(f"/super/solicitudes/{ls[0]['id']}", json={"estado": "descartada"})
    assert client.get("/super/solicitudes").json() == []


def test_telefono_invalido_y_limite_por_ip(client):
    assert client.post("/p/solicitudes", json={**PEDIDO, "telefono": "12345678"}).status_code == 422
    for _ in range(3):
        client.post("/p/solicitudes", json=PEDIDO)
    assert client.post("/p/solicitudes", json=PEDIDO).status_code == 429


def test_admin_no_ve_las_solicitudes(client, db):
    crear_usuario(db, "admin-x")
    ingresar(client, "admin-x")
    assert client.get("/super/solicitudes").status_code == 403


def test_sumar_es_un_slug_reservado(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    r = client.post(
        "/super/barberias",
        json={"nombre": "Sumar", "slug": "sumar", "admin_nombre": "Ana", "admin_usuario": "ana"},
    )
    assert r.status_code == 422
