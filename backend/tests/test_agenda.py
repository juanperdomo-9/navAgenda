"""Agenda y contador de fidelidad (obligatorio)."""

from datetime import datetime, time, timedelta

import pytest
from sqlalchemy import select

from app.core.tz import ZONA_AR
from app.db import inspirationmen
from app.models import Barberia, Barbero, Servicio, Usuario
from tests.util import CLAVE, crear_usuario, ingresar

MANANA = (datetime.now(ZONA_AR) + timedelta(days=1)).date()


@pytest.fixture
def ins(client, db):
    inspirationmen.cargar(db)
    bid = db.scalar(select(Barberia.id).where(Barberia.slug == "inspirationmen"))
    admin = db.scalar(select(Usuario).where(Usuario.usuario == "inspirationmen"))
    from app.core.security import hashear_clave

    admin.password_hash, admin.debe_cambiar_clave = hashear_clave(CLAVE), False
    db.flush()
    ingresar(client, "inspirationmen")
    return {
        "barbero": db.scalar(
            select(Barbero).where(Barbero.barberia_id == bid, Barbero.nombre == "Thiago")
        ).id,
        "vip": db.scalar(
            select(Servicio).where(Servicio.barberia_id == bid, Servicio.nombre.like("%VIP%"))
        ).id,
    }


def manual(client, ins, h, tel="221 456 7890"):
    inicio = datetime.combine(MANANA, time(h), tzinfo=ZONA_AR).isoformat()
    r = client.post(
        "/panel/turnos",
        json={
            "barbero_id": str(ins["barbero"]),
            "servicio_id": str(ins["vip"]),
            "inicio": inicio,
            "nombre": "Juan",
            "telefono": tel,
        },
    )
    return r


def test_turno_a_mano_aparece_en_la_agenda_y_no_se_superpone(client, ins):
    assert manual(client, ins, 12).status_code == 201
    assert manual(client, ins, 12, tel="221 111 2222").status_code == 409
    ag = client.get("/panel/agenda", params={"fecha": str(MANANA)}).json()
    assert len(ag["turnos"]) == 1 and ag["cada_x_cortes"] == 5


def test_tarjeta_de_cortes_completa_y_premio(client, ins):
    ids = [manual(client, ins, h).json()["id"] for h in (12, 13, 14, 15, 16, 17)]
    for i in ids[:4]:
        client.post(f"/panel/turnos/{i}/asistio", json={})
    quinto = client.get("/panel/agenda", params={"fecha": str(MANANA)}).json()["turnos"][4]
    assert quinto["completa_tarjeta"] is True
    r = client.post(f"/panel/turnos/{ids[4]}/asistio", json={}).json()
    assert r["tiene_premio"] is True and r["cortes"] == 0
    # El sexto usa el premio
    r = client.post(f"/panel/turnos/{ids[5]}/asistio", json={"aplicar_premio": True}).json()
    assert r["beneficio_aplicado"] is True and r["tiene_premio"] is False


def test_no_asistio_no_suma_y_corregir_deshace(client, ins):
    a, b = manual(client, ins, 12).json()["id"], manual(client, ins, 13).json()["id"]
    assert client.post(f"/panel/turnos/{a}/no-asistio").json()["cortes"] == 0
    assert client.post(f"/panel/turnos/{b}/asistio", json={}).json()["cortes"] == 1
    assert client.post(f"/panel/turnos/{b}/corregir").json()["cortes"] == 0
    assert (
        client.post(f"/panel/turnos/{a}/asistio", json={"aplicar_premio": True}).status_code == 409
    )


def test_no_se_marca_dos_veces(client, ins):
    t = manual(client, ins, 12).json()["id"]
    client.post(f"/panel/turnos/{t}/asistio", json={})
    assert client.post(f"/panel/turnos/{t}/no-asistio").status_code == 409


def test_aislamiento_otra_barberia_no_ve_ni_marca(client, ins, db):
    t = manual(client, ins, 12).json()["id"]
    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.get("/panel/agenda", params={"fecha": str(MANANA)}).json()["turnos"] == []
    assert client.post(f"/panel/turnos/{t}/asistio", json={}).status_code == 404
    assert manual(client, ins, 15).status_code == 404


def test_turno_a_mano_solo_con_servicios_del_barbero(client, ins, db):
    agus = db.scalar(select(Barbero).where(Barbero.nombre == "Agus Martín")).id
    otro = db.scalar(select(Servicio).where(Servicio.nombre.like("Asesoramiento%"))).id
    inicio = datetime.combine(MANANA, time(12), tzinfo=ZONA_AR).isoformat()
    r = client.post(
        "/panel/turnos",
        json={
            "barbero_id": str(agus),
            "servicio_id": str(otro),
            "inicio": inicio,
            "nombre": "Juan",
            "telefono": "221 456 7890",
        },
    )
    assert r.status_code == 422


def test_la_barberia_cancela_un_turno_y_libera_el_horario(client, ins):
    t = manual(client, ins, 12).json()["id"]
    assert client.post(f"/panel/turnos/{t}/cancelar").json()["estado"] == "cancelado"
    assert client.post(f"/panel/turnos/{t}/cancelar").status_code == 409
    assert manual(client, ins, 12, tel="221 999 8888").status_code == 201


def test_no_se_cancela_uno_ya_atendido(client, ins):
    t = manual(client, ins, 12).json()["id"]
    client.post(f"/panel/turnos/{t}/asistio", json={})
    assert client.post(f"/panel/turnos/{t}/cancelar").status_code == 409


def test_el_mail_del_barbero_se_guarda_y_se_borra(client, ins):
    b = str(ins["barbero"])
    r = client.patch(f"/panel/barberos/{b}", json={"email": " Thiago@Mail.com "})
    assert r.json()["email"] == "thiago@mail.com"
    assert client.patch(f"/panel/barberos/{b}", json={"email": "no-es-un-mail"}).status_code == 422
    assert client.patch(f"/panel/barberos/{b}", json={"email": ""}).json()["email"] is None
