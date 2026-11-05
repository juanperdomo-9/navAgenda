"""Opiniones: solo quien fue, una por turno; 4-5 estrellas se publican solas; la barbería modera."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.api.routers.publico import limite_reservas
from app.core.security import hashear_clave
from app.core.tz import ZONA_AR
from app.db import inspirationmen
from app.models import Turno, Usuario
from tests.util import CLAVE, crear_usuario, ingresar


@pytest.fixture
def ins(client, db):
    inspirationmen.cargar(db)
    limite_reservas.reiniciar()
    admin = db.scalar(select(Usuario).where(Usuario.usuario == "inspirationmen"))
    admin.password_hash, admin.debe_cambiar_clave = hashear_clave(CLAVE), False
    db.flush()
    return client.get("/p/inspirationmen").json()


def reservar(client, p, tel="221 456 7890", nombre="Lucas Gómez", saltear=0):
    s = p["servicios"][0]["id"]
    hoy = datetime.now(ZONA_AR).date()
    for d in range(1, 12):
        libres = client.get(
            "/p/inspirationmen/libres",
            params={"servicio_id": s, "fecha": str(hoy + timedelta(days=d))},
        ).json()
        if len(libres) > saltear:
            break
    r = client.post(
        "/p/inspirationmen/turnos",
        json={
            "servicio_id": s,
            "inicio": libres[saltear]["inicio"],
            "nombre": nombre,
            "telefono": tel,
            "email": "lucas@mail.com",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["token"]


def asistio(client, db, token):
    t = db.scalars(select(Turno).order_by(Turno.creado_en.desc())).first()
    ingresar(client, "inspirationmen")
    assert client.post(f"/panel/turnos/{t.id}/asistio", json={}).status_code == 200
    client.post("/auth/salir")
    return t


def test_antes_del_corte_no_se_puede_opinar(client, ins):
    token = reservar(client, ins)
    assert client.get(f"/t/{token}").json()["puede_opinar"] is False
    assert client.post(f"/t/{token}/opinion", json={"estrellas": 5}).status_code == 409


def test_despues_del_corte_opina_una_vez_y_sale_en_la_pagina(client, db, ins):
    token = reservar(client, ins)
    asistio(client, db, token)
    assert client.get(f"/t/{token}").json()["puede_opinar"] is True
    r = client.post(f"/t/{token}/opinion", json={"estrellas": 5, "texto": " Un golazo el corte "})
    assert r.status_code == 201 and r.json()["opinion"]["texto"] == "Un golazo el corte"
    assert client.post(f"/t/{token}/opinion", json={"estrellas": 4}).status_code == 409
    pag = client.get("/p/inspirationmen").json()["opiniones"]
    assert pag["cantidad"] == 1 and pag["promedio"] == 5.0
    assert pag["lista"][0]["nombre"] == "Lucas" and "telefono" not in pag["lista"][0]


def test_las_bajas_quedan_ocultas_hasta_que_la_barberia_las_muestre(client, db, ins):
    token = reservar(client, ins)
    asistio(client, db, token)
    client.post(f"/t/{token}/opinion", json={"estrellas": 2, "texto": "Tardaron"})
    assert client.get("/p/inspirationmen").json()["opiniones"]["cantidad"] == 0
    ingresar(client, "inspirationmen")
    o = client.get("/panel/opiniones").json()["lista"][0]
    assert o["visible"] is False and o["telefono"] == "+5492214567890"
    assert client.patch(f"/panel/opiniones/{o['id']}", json={"visible": True}).json()["visible"]
    assert client.get("/p/inspirationmen").json()["opiniones"]["promedio"] == 2.0
    # Otra barbería no la ve ni la toca
    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.get("/panel/opiniones").json()["lista"] == []
    assert client.delete(f"/panel/opiniones/{o['id']}").status_code == 404


def test_video_sin_storage_no_se_puede(client, db, ins):
    token = reservar(client, ins)
    asistio(client, db, token)
    r = client.post(f"/t/{token}/opinion/video", json={"tipo": "video/mp4", "bytes": 1000})
    assert r.status_code == 503


def test_mail_del_dia_despues_pide_la_opinion_con_su_link(client, db, ins, monkeypatch):
    from app.services import avisos, recordatorios

    enviados = []
    monkeypatch.setattr(avisos, "_enviar", lambda *a: enviados.append(a))
    token = reservar(client, ins)
    t = asistio(client, db, token)
    ayer = datetime.now(UTC) - timedelta(days=1)
    t.inicio, t.fin = ayer, ayer + timedelta(minutes=30)
    db.flush()
    ahora = datetime.now(ZONA_AR).replace(hour=12)
    assert recordatorios.pedir_opiniones(db, ahora.replace(hour=9)) == 0  # antes de las 11
    assert recordatorios.pedir_opiniones(db, ahora) == 1
    mail = enviados[-1]
    assert mail[0] == "lucas@mail.com" and mail[1].startswith("¿Cómo te fue")
    link = mail[2].split("/t/")[1].split()[0]
    assert client.get(f"/t/{link}").json()["puede_opinar"] is True
    assert recordatorios.pedir_opiniones(db, ahora) == 0  # una sola vez
