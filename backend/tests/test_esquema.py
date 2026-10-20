"""Reglas que garantiza la base: superposición de turnos y aislamiento entre barberías."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.seed import SLUG, sembrar
from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    Cliente,
    HorarioBarbero,
    ReglaBeneficio,
    Servicio,
    Turno,
    Usuario,
)

BASE = datetime(2026, 10, 21, 13, 0, tzinfo=UTC)  # 10:00 en Buenos Aires


def crear_barberia(db: Session, slug: str) -> dict:
    """Barbería mínima con un barbero, un servicio de 30 min y un cliente."""
    b = Barberia(nombre=slug.title(), slug=slug)
    db.add(b)
    db.flush()
    barbero = Barbero(barberia_id=b.id, nombre="Barbero")
    servicio = Servicio(barberia_id=b.id, nombre="Corte", precio=10000, duracion_min=30)
    cliente = Cliente(barberia_id=b.id, telefono="+5491122334455", nombre="Cliente")
    db.add_all([barbero, servicio, cliente])
    db.flush()
    return {"barberia": b, "barbero": barbero, "servicio": servicio, "cliente": cliente}


def turno(
    d: dict, inicio: datetime, minutos: int = 30, estado: str = "reservado", **otros
) -> Turno:
    datos = {
        "barberia_id": d["barberia"].id,
        "barbero_id": d["barbero"].id,
        "cliente_id": d["cliente"].id,
        "servicio_id": d["servicio"].id,
        "inicio": inicio,
        "fin": inicio + timedelta(minutes=minutos),
        "precio": 10000,
        "estado": estado,
    }
    datos.update(otros)
    return Turno(**datos)


def insertar_falla(db: Session, obj) -> None:
    """Afirma que la base rechaza el objeto, sin romper la transacción del test."""
    with pytest.raises(IntegrityError), db.begin_nested():
        db.add(obj)
        db.flush()


# ——— Superposición de turnos ———


def test_dos_turnos_superpuestos_del_mismo_barbero_se_rechazan(db: Session):
    d = crear_barberia(db, "a")
    db.add(turno(d, BASE))
    db.flush()
    insertar_falla(db, turno(d, BASE + timedelta(minutes=15)))


def test_turno_que_contiene_a_otro_se_rechaza(db: Session):
    d = crear_barberia(db, "a")
    db.add(turno(d, BASE + timedelta(minutes=10), minutos=10))
    db.flush()
    insertar_falla(db, turno(d, BASE, minutos=60))


def test_turnos_pegados_estan_permitidos(db: Session):
    d = crear_barberia(db, "a")
    db.add_all([turno(d, BASE), turno(d, BASE + timedelta(minutes=30))])
    db.flush()
    assert db.scalar(select(func.count()).select_from(Turno)) == 2


def test_turno_cancelado_libera_el_horario(db: Session):
    d = crear_barberia(db, "a")
    db.add(turno(d, BASE, estado="cancelado"))
    db.flush()
    db.add(turno(d, BASE))
    db.flush()


def test_barberos_distintos_pueden_tener_turnos_a_la_misma_hora(db: Session):
    d = crear_barberia(db, "a")
    otro = Barbero(barberia_id=d["barberia"].id, nombre="Otro")
    db.add(otro)
    db.flush()
    db.add_all([turno(d, BASE), turno(d, BASE, barbero_id=otro.id)])
    db.flush()


def test_no_asistio_sigue_ocupando_el_horario(db: Session):
    d = crear_barberia(db, "a")
    db.add(turno(d, BASE, estado="no_asistio"))
    db.flush()
    insertar_falla(db, turno(d, BASE))


def test_turno_con_fin_antes_del_inicio_se_rechaza(db: Session):
    d = crear_barberia(db, "a")
    insertar_falla(db, turno(d, BASE, minutos=-30))


# ——— Aislamiento entre barberías ———


def test_turno_con_barbero_de_otra_barberia_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    b = crear_barberia(db, "b")
    insertar_falla(db, turno(a, BASE, barbero_id=b["barbero"].id))


def test_turno_con_servicio_de_otra_barberia_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    b = crear_barberia(db, "b")
    insertar_falla(db, turno(a, BASE, servicio_id=b["servicio"].id))


def test_turno_con_cliente_de_otra_barberia_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    b = crear_barberia(db, "b")
    insertar_falla(db, turno(a, BASE, cliente_id=b["cliente"].id))


def test_no_se_asigna_un_servicio_de_otra_barberia_a_un_barbero(db: Session):
    a = crear_barberia(db, "a")
    b = crear_barberia(db, "b")
    insertar_falla(
        db,
        BarberoServicio(
            barbero_id=a["barbero"].id, servicio_id=b["servicio"].id, barberia_id=a["barberia"].id
        ),
    )


def test_mismo_telefono_es_un_cliente_distinto_en_cada_barberia(db: Session):
    crear_barberia(db, "a")
    crear_barberia(db, "b")  # ambas crean un cliente con el mismo teléfono
    assert db.scalar(select(func.count()).select_from(Cliente)) == 2


def test_telefono_repetido_en_la_misma_barberia_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    insertar_falla(
        db, Cliente(barberia_id=a["barberia"].id, telefono="+5491122334455", nombre="Otro")
    )


def test_telefono_sin_formato_e164_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    insertar_falla(db, Cliente(barberia_id=a["barberia"].id, telefono="11 2233-4455", nombre="X"))


# ——— Usuarios del panel ———


def test_usuario_unico_sin_distinguir_mayusculas(db: Session):
    db.add(Usuario(nombre="Juan", usuario="Juan", password_hash="x", rol="superadmin"))
    db.flush()
    insertar_falla(db, Usuario(nombre="Otro", usuario="JUAN", password_hash="x", rol="superadmin"))


def test_admin_sin_barberia_se_rechaza(db: Session):
    insertar_falla(db, Usuario(nombre="Admin", usuario="admin", password_hash="x", rol="admin"))


def test_superadmin_con_barberia_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    insertar_falla(
        db,
        Usuario(
            nombre="S",
            usuario="s",
            password_hash="x",
            rol="superadmin",
            barberia_id=a["barberia"].id,
        ),
    )


# ——— Beneficios ———


def test_una_sola_regla_activa_por_barberia(db: Session):
    a = crear_barberia(db, "a")
    bid = a["barberia"].id
    db.add(ReglaBeneficio(barberia_id=bid, cada_x_cortes=5, tipo="texto", descripcion="Regalo"))
    db.flush()
    insertar_falla(
        db, ReglaBeneficio(barberia_id=bid, cada_x_cortes=3, tipo="texto", descripcion="Otro")
    )


def test_descuento_porcentual_fuera_de_rango_se_rechaza(db: Session):
    a = crear_barberia(db, "a")
    insertar_falla(
        db,
        ReglaBeneficio(
            barberia_id=a["barberia"].id,
            cada_x_cortes=5,
            tipo="descuento_pct",
            valor=150,
            descripcion="x",
        ),
    )


# ——— Datos de ejemplo ———


def test_seed_crea_la_barberia_de_ejemplo_y_es_idempotente(db: Session):
    barberia = sembrar(db)
    assert barberia is not None
    bid = barberia.id
    assert (
        db.scalar(select(func.count()).select_from(Barbero).where(Barbero.barberia_id == bid)) == 3
    )
    assert (
        db.scalar(select(func.count()).select_from(Servicio).where(Servicio.barberia_id == bid))
        == 4
    )
    assert db.scalar(select(func.count()).select_from(BarberoServicio)) == 12
    assert db.scalar(select(func.count()).select_from(HorarioBarbero)) > 0
    assert sembrar(db) is None
    assert db.scalar(select(func.count()).select_from(Barberia).where(Barberia.slug == SLUG)) == 1
