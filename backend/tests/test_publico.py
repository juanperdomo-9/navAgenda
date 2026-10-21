"""Reserva sin cuenta: página, horarios libres, reservar, ticket y cancelar."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.api.routers.publico import limite_reservas, normalizar_telefono
from app.core.tz import ZONA_AR
from app.db import inspirationmen
from app.models import Barberia, Cliente


@pytest.fixture
def ins(client, db):
    inspirationmen.cargar(db)
    limite_reservas.reiniciar()
    p = client.get("/p/inspirationmen").json()
    return {"p": p, "vip": next(s for s in p["servicios"] if "VIP" in s["nombre"])["id"]}


def proximo_libre(client, ins, **extra):
    hoy = datetime.now(ZONA_AR).date()
    for d in range(1, 10):
        r = client.get(
            "/p/inspirationmen/libres",
            params={"servicio_id": ins["vip"], "fecha": str(hoy + timedelta(days=d)), **extra},
        ).json()
        if r:
            return r[0]
    raise AssertionError("sin horarios")


def reservar(client, ins, libre, tel="221 456 7890", **extra):
    return client.post(
        "/p/inspirationmen/turnos",
        json={
            "servicio_id": ins["vip"],
            "inicio": libre["inicio"],
            "nombre": "Juan",
            "telefono": tel,
            **extra,
        },
    )


@pytest.mark.parametrize(
    "v,ok",
    [
        ("221 456-7890", "+5492214567890"),
        ("0221 15 456 7890", "+5492214567890"),
        ("+54 9 221 456 7890", "+5492214567890"),
        ("11 15 2233 4455", "+5491122334455"),
        ("1234", None),
    ],
)
def test_normalizar_telefono(v, ok):
    assert normalizar_telefono(v) == ok


def test_pagina_publica(ins):
    p = ins["p"]
    assert (
        p["nombre"] == "Inspirationmen" and len(p["barberos"]) == 3 and p["fidelidad"]["cada"] == 5
    )


def test_barberia_inexistente(client):
    assert client.get("/p/no-existe").status_code == 404


def test_reservar_da_ticket_y_ocupa_el_horario(client, ins):
    libre = proximo_libre(client, ins)
    res = reservar(client, ins, libre)
    assert res.status_code == 201
    t = res.json()
    assert t["precio"] == 20000 and t["estado"] == "reservado" and t["token"]
    assert client.get(f"/t/{t['token']}").json()["cliente"] == "Juan"
    # el mismo horario con ese barbero ya no está libre
    otra = reservar(client, ins, libre, tel="221 111 2222", barbero_id=libre["barbero_id"])
    assert otra.status_code == 409


def test_horario_que_no_es_libre_se_rechaza(client, ins):
    libre = proximo_libre(client, ins)
    raro = (datetime.fromisoformat(libre["inicio"]) + timedelta(minutes=15)).isoformat()
    assert reservar(client, ins, {"inicio": raro}).status_code == 409


def test_maximo_dos_turnos_futuros_por_telefono(client, ins):
    hoy = datetime.now(ZONA_AR).date()
    libres = []
    for d in range(1, 10):
        libres += client.get(
            "/p/inspirationmen/libres",
            params={"servicio_id": ins["vip"], "fecha": str(hoy + timedelta(days=d))},
        ).json()
    assert reservar(client, ins, libres[0]).status_code == 201
    assert reservar(client, ins, libres[3]).status_code == 201
    assert reservar(client, ins, libres[6]).status_code == 409


def test_telefono_bloqueado_no_reserva(client, ins, db):
    bid = db.scalar(select(Barberia.id).where(Barberia.slug == "inspirationmen"))
    db.add(Cliente(barberia_id=bid, telefono="+5492214567890", nombre="X", bloqueado=True))
    db.flush()
    assert reservar(client, ins, proximo_libre(client, ins)).status_code == 403


def test_cancelar_libera_el_horario(client, ins):
    libre = proximo_libre(client, ins)
    t = reservar(client, ins, libre).json()
    res = client.post(f"/t/{t['token']}/cancelar")
    assert res.status_code == 200 and res.json()["estado"] == "cancelado"
    assert client.post(f"/t/{t['token']}/cancelar").status_code == 409
    assert (
        reservar(client, ins, libre, tel="221 999 8888", barbero_id=libre["barbero_id"]).status_code
        == 201
    )


def test_no_se_cancela_fuera_de_termino(client, ins, db):
    from app.models import Turno

    t = reservar(client, ins, proximo_libre(client, ins)).json()
    turno = db.scalar(select(Turno).where(Turno.estado == "reservado"))
    turno.inicio = datetime.now(UTC) + timedelta(hours=1)
    turno.fin = turno.inicio + timedelta(minutes=30)
    db.flush()
    assert client.post(f"/t/{t['token']}/cancelar").status_code == 409


def test_token_invalido(client):
    assert client.get("/t/no-existe").status_code == 404


def test_portal_lista_barberias_con_proximo_libre(client, ins):
    lista = client.get("/p").json()
    ins_ = next(x for x in lista if x["slug"] == "inspirationmen")
    assert ins_["precio_desde"] == 20000 and ins_["proximo_libre"]
