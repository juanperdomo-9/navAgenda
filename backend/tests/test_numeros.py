"""Clientes y Números del panel (facturación solo con "asistió" y aislamiento)."""

from tests.test_agenda import MANANA, ins, manual  # noqa: F401
from tests.util import crear_usuario, ingresar


def test_numeros_solo_cuenta_asistio(client, ins):  # noqa: F811
    a, b, _c = (manual(client, ins, h).json()["id"] for h in (12, 13, 14))
    client.post(f"/panel/turnos/{a}/asistio", json={})
    client.post(f"/panel/turnos/{b}/no-asistio")
    n = client.get("/panel/numeros", params={"desde": str(MANANA), "hasta": str(MANANA)}).json()
    assert (n["facturado"], n["cortes"], n["ausencias"]) == (20000, 1, 1)
    assert n["servicios"] == [{"nombre": "Peinado y corte VIP", "veces": 1}]
    thiago = next(x for x in n["por_barbero"] if x["nombre"] == "Thiago")
    assert thiago["facturado"] == 20000
    assert n["por_periodo"] == [{"clave": str(MANANA), "facturado": 20000}]
    # Sin "desde": desde el primer turno (todo el historial); más de 2 meses se agrupa por mes
    todo = client.get("/panel/numeros", params={"hasta": str(MANANA)}).json()
    assert todo["facturado"] == 20000 and todo["desde"] == str(MANANA)
    largo = client.get(
        "/panel/numeros", params={"desde": "2026-01-01", "hasta": str(MANANA)}
    ).json()
    assert largo["agrupado"] == "mes" and largo["por_periodo"][0]["clave"] == "2026-01"


def test_rango_invalido(client, ins):  # noqa: F811
    r = client.get("/panel/numeros", params={"desde": "2026-10-10", "hasta": "2026-10-01"})
    assert r.status_code == 422


def test_clientes_cuenta_visitas_y_bloqueo(client, ins):  # noqa: F811
    a = manual(client, ins, 12).json()["id"]
    manual(client, ins, 13, tel="221 111 2222")
    client.post(f"/panel/turnos/{a}/asistio", json={})
    ls = client.get("/panel/clientes").json()
    assert len(ls) == 2 and ls[0]["telefono"] == "+5492214567890"
    assert (ls[0]["visitas"], ls[0]["cortes"]) == (1, 1)
    r = client.patch(f"/panel/clientes/{ls[0]['id']}", json={"bloqueado": True})
    assert r.json()["bloqueado"] is True


def test_aislamiento_clientes_y_numeros(client, ins, db):  # noqa: F811
    t = manual(client, ins, 12).json()["id"]
    client.post(f"/panel/turnos/{t}/asistio", json={})
    cid = client.get("/panel/clientes").json()[0]["id"]
    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.get("/panel/clientes").json() == []
    assert client.patch(f"/panel/clientes/{cid}", json={"bloqueado": True}).status_code == 404
    n = client.get("/panel/numeros", params={"desde": str(MANANA), "hasta": str(MANANA)}).json()
    assert n["facturado"] == 0


def test_borrar_cliente_con_sus_turnos(client, db):
    """Limpiar clientes de prueba: se va con sus turnos y su tarjeta; otra barbería no puede."""
    from datetime import date, timedelta

    from sqlalchemy import func, select

    from app.core.security import hashear_clave
    from app.db import inspirationmen
    from app.models import Barberia, Cliente, Turno, Usuario
    from tests.util import CLAVE, crear_usuario, ingresar

    inspirationmen.cargar(db)
    admin = db.scalar(select(Usuario).where(Usuario.usuario == "inspirationmen"))
    admin.password_hash, admin.debe_cambiar_clave = hashear_clave(CLAVE), False
    db.flush()
    ingresar(client, "inspirationmen")
    bid = db.scalar(select(Barberia.id).where(Barberia.slug == "inspirationmen"))
    p = client.get("/p/inspirationmen").json()
    b = p["barberos"][0]
    manana = date.today() + timedelta(days=1)
    r = client.post(
        "/panel/turnos",
        json={
            "barbero_id": b["id"],
            "servicio_id": b["servicio_ids"][0],
            "inicio": f"{manana}T12:00:00-03:00",
            "nombre": "Prueba",
            "telefono": "221 000 0001",
        },
    )
    assert r.status_code == 201, r.text
    client.post(f"/panel/turnos/{r.json()['id']}/asistio", json={})
    cid = db.scalar(select(Cliente.id).where(Cliente.barberia_id == bid))

    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.delete(f"/panel/clientes/{cid}").status_code == 404

    client.post("/auth/salir")
    ingresar(client, "inspirationmen")
    assert client.delete(f"/panel/clientes/{cid}").status_code == 204
    assert db.get(Cliente, cid) is None
    assert db.scalar(select(func.count()).select_from(Turno).where(Turno.cliente_id == cid)) == 0
