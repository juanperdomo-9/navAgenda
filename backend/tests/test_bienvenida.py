"""Ruleta de bienvenida: un teléfono nuevo gira una vez y tiene 3 minutos para sacar turno."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.api.routers.publico import limite_bienvenida, limite_reservas
from app.core.security import hashear_clave
from app.core.tz import ZONA_AR
from app.db import inspirationmen
from app.models import Barberia, Bienvenida, ReglaBeneficio, Usuario
from tests.util import CLAVE, crear_usuario, ingresar

TEL = "221 555 0001"


@pytest.fixture
def ins(client, db):
    inspirationmen.cargar(db)
    limite_reservas.reiniciar()
    limite_bienvenida.reiniciar()
    b = db.scalar(select(Barberia).where(Barberia.slug == "inspirationmen"))
    for r in db.scalars(select(ReglaBeneficio).where(ReglaBeneficio.barberia_id == b.id)):
        r.activa = False
    # Dos premios del mismo descuento: el resultado del azar no cambia lo que se verifica
    premios = [{"texto": "10% off", "descuento_pct": 10}, {"texto": "Cera", "descuento_pct": 10}]
    db.add(
        ReglaBeneficio(
            barberia_id=b.id,
            cada_x_cortes=5,
            tipo="texto",
            descripcion="Cada 5 cortes, girás la ruleta",
            modo="ruleta",
            ruleta=premios,
        )
    )
    b.ruleta_bienvenida = True
    db.flush()
    p = client.get("/p/inspirationmen").json()
    return {"b": b, "p": p, "servicio": p["servicios"][0]["id"]}


def girar(client, tel=TEL):
    return client.post("/p/inspirationmen/bienvenida", json={"telefono": tel})


def libre(client, ins, dias=1):
    hoy = datetime.now(ZONA_AR).date()
    for d in range(dias, dias + 10):
        r = client.get(
            "/p/inspirationmen/libres",
            params={"servicio_id": ins["servicio"], "fecha": str(hoy + timedelta(days=d))},
        ).json()
        if r:
            return r[0]
    raise AssertionError("sin horarios")


def reservar(client, ins, hueco, tel=TEL):
    return client.post(
        "/p/inspirationmen/turnos",
        json={
            "servicio_id": ins["servicio"],
            "inicio": hueco["inicio"],
            "nombre": "Nuevo",
            "telefono": tel,
        },
    )


def test_apagada_no_gira(client, ins, db):
    ins["b"].ruleta_bienvenida = False
    db.flush()
    assert client.get("/p/inspirationmen").json()["bienvenida"] is False
    assert girar(client).status_code == 404


def test_numero_nuevo_gira_una_sola_vez(client, ins):
    assert ins["p"]["bienvenida"] is True
    r = girar(client).json()
    assert r["nuevo"] is True and r["premio"] in ("10% off", "Cera")
    # Saque o no el turno, ese número ya no vuelve a girar
    assert girar(client).json()["nuevo"] is False
    assert girar(client, "+54 9 221 555-0001").json()["nuevo"] is False


def test_si_saca_turno_a_tiempo_el_premio_queda_en_el_turno(client, ins):
    premio = girar(client).json()["premio"]
    t = reservar(client, ins, libre(client, ins))
    assert t.status_code == 201 and t.json()["bienvenida"] == premio


def test_vencido_no_se_aplica(client, ins, db):
    girar(client)
    g = db.scalar(select(Bienvenida))
    g.vence_en = datetime.now(UTC) - timedelta(seconds=1)
    db.flush()
    assert reservar(client, ins, libre(client, ins)).json()["bienvenida"] is None


def test_turno_a_mas_de_7_dias_no_se_aplica(client, ins):
    girar(client)
    assert reservar(client, ins, libre(client, ins, dias=8)).json()["bienvenida"] is None


def test_cliente_que_ya_vino_no_gira(client, ins):
    assert reservar(client, ins, libre(client, ins)).status_code == 201
    r = girar(client).json()
    assert r["nuevo"] is False and "primera vez" in r["motivo"]


def test_al_asistir_se_cobra_con_el_descuento_y_corregir_lo_deshace(client, ins, db):
    girar(client)
    t = reservar(client, ins, libre(client, ins)).json()
    admin = db.scalar(select(Usuario).where(Usuario.usuario == "inspirationmen"))
    admin.password_hash, admin.debe_cambiar_clave = hashear_clave(CLAVE), False
    db.flush()
    ingresar(client, "inspirationmen")
    fecha = datetime.fromisoformat(t["inicio"]).astimezone(ZONA_AR).date()
    turno = next(
        x
        for x in client.get("/panel/agenda", params={"fecha": str(fecha)}).json()["turnos"]
        if x["cliente"]["nombre"] == "Nuevo"
    )
    assert turno["bienvenida"] in ("10% off", "Cera")
    hecho = client.post(f"/panel/turnos/{turno['id']}/asistio", json={}).json()
    assert hecho["cobrado"] == round(turno["precio"] * 0.9) and hecho["cortes"] == 1
    assert client.post(f"/panel/turnos/{turno['id']}/corregir").json()["cobrado"] == turno["precio"]


def test_otra_barberia_no_ve_el_giro(client, ins, db):
    girar(client)
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    fecha = datetime.now(ZONA_AR).date() + timedelta(days=1)
    assert client.get("/panel/agenda", params={"fecha": str(fecha)}).json()["turnos"] == []
