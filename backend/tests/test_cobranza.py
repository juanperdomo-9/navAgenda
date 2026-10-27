"""Cobranza del abono: pagos por mes, recordatorios de un toque y pausa automática por deuda."""

from datetime import date

from sqlalchemy import select

from app.api.routers.cobranza import pausar_vencidas
from app.models import Barberia
from tests.util import crear_usuario, ingresar


def _nueva(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    b = client.post(
        "/super/barberias",
        json={
            "nombre": "Deudora",
            "slug": "deudora",
            "admin_nombre": "Ana",
            "admin_usuario": "ana",
        },
    ).json()["barberia"]
    return b["id"]


def _item(client, bid):
    return next(x for x in client.get("/super/cobranza").json()["barberias"] if x["id"] == bid)


def test_datos_de_cobro_pago_y_recordatorio(client, db):
    bid = _nueva(client, db)
    r = client.patch(
        f"/super/barberias/{bid}/cobro", json={"whatsapp": "221 456 7890", "abono": 15000}
    )
    assert r.json()["whatsapp"] == "+5492214567890"
    it = _item(client, bid)
    assert it["pago"] is None and it["toca_recordar"] and it["dias_debe"] >= 1
    client.post(f"/super/cobranza/{bid}/recordatorio", json={})
    assert _item(client, bid)["toca_recordar"] is False  # ya se le recordó hoy
    client.post(f"/super/cobranza/{bid}/pago", json={})
    it = _item(client, bid)
    assert it["pago"]["monto"] == 15000 and it["dias_debe"] is None
    client.delete(f"/super/cobranza/{bid}/pago")
    assert _item(client, bid)["pago"] is None


def test_whatsapp_invalido(client, db):
    bid = _nueva(client, db)
    assert (
        client.patch(f"/super/barberias/{bid}/cobro", json={"whatsapp": "123"}).status_code == 422
    )


def test_pausa_por_deuda_y_se_reactiva_al_pagar(client, db):
    bid = _nueva(client, db)
    client.patch(f"/super/barberias/{bid}/cobro", json={"pausa_por_deuda": True})
    hoy = date.today()
    assert pausar_vencidas(db, hoy.replace(day=10)) == 0  # sin ningún aviso, no se pausa
    client.post(f"/super/cobranza/{bid}/recordatorio", json={})
    assert pausar_vencidas(db, hoy.replace(day=5)) == 0  # antes del día 10 no se pausa
    assert pausar_vencidas(db, hoy.replace(day=10)) == 1
    b = db.scalar(select(Barberia).where(Barberia.slug == "deudora"))
    assert not b.activa and b.pausada_por_deuda
    assert client.post(f"/super/cobranza/{bid}/pago", json={}).json()["activa"] is True


def test_solo_el_superadmin(client, db):
    crear_usuario(db, "admin-x")
    ingresar(client, "admin-x")
    assert client.get("/super/cobranza").status_code == 403
