"""Cálculo de horarios disponibles (obligatorio): cada 30 min, menos turnos, bloqueos y duración."""

from datetime import UTC, date, datetime, time, timedelta

import pytest

from app.core.tz import ZONA_AR
from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    Bloqueo,
    Cliente,
    HorarioBarbero,
    Servicio,
    Turno,
)
from app.services.disponibilidad import horarios_libres

MIE = date(2026, 10, 28)  # miércoles
ANTES = datetime(2026, 10, 1, tzinfo=UTC)  # "ahora" para los tests: todo es futuro


def ar(h: int, m: int = 0, dia: date = MIE) -> datetime:
    return datetime.combine(dia, time(h, m), tzinfo=ZONA_AR).astimezone(UTC)


def horas(libres) -> list[str]:
    return [x.inicio.astimezone(ZONA_AR).strftime("%H:%M") for x in libres]


@pytest.fixture
def b(db):
    """Barbería con Agus (mié 10-13 y 16-18) y Thiago (mié 10-12), corte 30 y mechas 60."""
    barberia = Barberia(nombre="Test", slug="test-disp")
    db.add(barberia)
    db.flush()
    agus = Barbero(barberia_id=barberia.id, nombre="Agus")
    thiago = Barbero(barberia_id=barberia.id, nombre="Thiago")
    corte = Servicio(barberia_id=barberia.id, nombre="Corte", precio=20000, duracion_min=30)
    mechas = Servicio(barberia_id=barberia.id, nombre="Mechas", precio=60000, duracion_min=60)
    cliente = Cliente(barberia_id=barberia.id, telefono="+5492214567890", nombre="Juan")
    db.add_all([agus, thiago, corte, mechas, cliente])
    db.flush()
    db.add_all(
        [
            HorarioBarbero(barbero_id=agus.id, dia_semana=2, desde=time(10), hasta=time(13)),
            HorarioBarbero(barbero_id=agus.id, dia_semana=2, desde=time(16), hasta=time(18)),
            HorarioBarbero(barbero_id=thiago.id, dia_semana=2, desde=time(10), hasta=time(12)),
            *[
                BarberoServicio(barbero_id=x.id, servicio_id=s.id, barberia_id=barberia.id)
                for x, s in [(agus, corte), (thiago, corte), (thiago, mechas)]
            ],
        ]
    )
    db.flush()
    return {
        "bid": barberia.id,
        "agus": agus,
        "thiago": thiago,
        "corte": corte,
        "mechas": mechas,
        "cliente": cliente,
    }


def libres(db, b, servicio="corte", barbero=None, dia=MIE, ahora=ANTES):
    bid = b[barbero].id if barbero else None
    return horarios_libres(db, b["bid"], b[servicio].id, dia, bid, ahora)


def turno(db, b, barbero, inicio, minutos=30, estado="reservado"):
    db.add(
        Turno(
            barberia_id=b["bid"],
            barbero_id=b[barbero].id,
            cliente_id=b["cliente"].id,
            servicio_id=b["corte"].id,
            inicio=inicio,
            fin=inicio + timedelta(minutes=minutos),
            precio=20000,
            estado=estado,
        )
    )
    db.flush()


def test_cada_30_minutos_con_horario_cortado(db, b):
    assert horas(libres(db, b, barbero="agus")) == [
        "10:00",
        "10:30",
        "11:00",
        "11:30",
        "12:00",
        "12:30",
        "16:00",
        "16:30",
        "17:00",
        "17:30",
    ]


def test_cualquiera_junta_a_todos_ordenados(db, b):
    r = libres(db, b)
    assert horas(r)[:4] == ["10:00", "10:00", "10:30", "10:30"]
    assert len(r) == 10 + 4


def test_turno_existente_ocupa_su_horario(db, b):
    turno(db, b, "agus", ar(10, 30))
    assert "10:30" not in horas(libres(db, b, barbero="agus"))


def test_turno_cancelado_libera_el_horario(db, b):
    turno(db, b, "agus", ar(10, 30), estado="cancelado")
    assert "10:30" in horas(libres(db, b, barbero="agus"))


def test_servicio_largo_tiene_que_entrar_en_el_tramo(db, b):
    # Thiago trabaja 10 a 12: mechas (60 min) puede a las 10, 10:30 y 11, no a las 11:30
    assert horas(libres(db, b, "mechas", "thiago")) == ["10:00", "10:30", "11:00"]


def test_servicio_largo_no_pisa_un_turno_siguiente(db, b):
    turno(db, b, "thiago", ar(11))
    assert horas(libres(db, b, "mechas", "thiago")) == ["10:00"]


def test_bloqueo_y_dia_libre(db, b):
    db.add(
        Bloqueo(
            barberia_id=b["bid"],
            barbero_id=b["agus"].id,
            inicio=ar(12),
            fin=ar(13),
            motivo="Almuerzo",
        )
    )
    db.add(
        Bloqueo(
            barberia_id=b["bid"],
            barbero_id=b["thiago"].id,
            inicio=ar(0),
            fin=ar(0, dia=MIE + timedelta(days=1)),
            motivo="Franco",
        )
    )
    db.flush()
    assert "12:00" not in horas(libres(db, b, barbero="agus")) and "12:30" not in horas(
        libres(db, b, barbero="agus")
    )
    assert libres(db, b, barbero="thiago") == []


def test_no_ofrece_horarios_pasados(db, b):
    assert horas(libres(db, b, barbero="agus", ahora=ar(16, 10))) == ["16:30", "17:00", "17:30"]


def test_dia_que_no_trabaja(db, b):
    assert libres(db, b, dia=MIE + timedelta(days=4)) == []  # domingo


def test_barbero_que_no_hace_el_servicio_o_de_baja(db, b):
    assert libres(db, b, "mechas", "agus") == []
    b["thiago"].activo = False
    db.flush()
    assert all(x.barbero_id == b["agus"].id for x in libres(db, b))


def test_tramo_que_no_arranca_en_punto_se_alinea_a_la_media_hora(db, b):
    db.add(
        HorarioBarbero(
            barbero_id=b["thiago"].id, dia_semana=2, desde=time(14, 15), hasta=time(15, 30)
        )
    )
    db.flush()
    assert [h for h in horas(libres(db, b, barbero="thiago")) if h >= "14:00"] == ["14:30", "15:00"]


def test_aislamiento_otra_barberia_no_ve_nada(db, b):
    otra = Barberia(nombre="Otra", slug="otra-disp")
    db.add(otra)
    db.flush()
    assert horarios_libres(db, otra.id, b["corte"].id, MIE, None, ANTES) == []
    assert horarios_libres(db, otra.id, b["corte"].id, MIE, b["agus"].id, ANTES) == []
