"""Agenda del panel: turnos del día, asistió / no vino (tarjeta de cortes) y turnos a mano."""

from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, Admin
from app.api.routers.publico import normalizar_telefono
from app.core.tz import ZONA_AR
from app.models import (
    Barbero,
    BarberoServicio,
    Bloqueo,
    Cliente,
    Fidelidad,
    ReglaBeneficio,
    Servicio,
    Turno,
)
from app.services import premios

router = APIRouter(prefix="/panel", tags=["agenda"])


def _regla(db, barberia_id) -> ReglaBeneficio | None:
    return db.scalar(
        select(ReglaBeneficio).where(
            ReglaBeneficio.barberia_id == barberia_id, ReglaBeneficio.activa
        )
    )


def _fid(db, c: Cliente) -> Fidelidad:
    f = db.get(Fidelidad, c.id)
    if not f:
        f = Fidelidad(
            cliente_id=c.id,
            barberia_id=c.barberia_id,
            cortes_acumulados=0,
            beneficios_disponibles=0,
        )
        db.add(f)
        db.flush()
    return f


def _turno(db, admin, turno_id: UUID) -> Turno:
    t = db.scalar(select(Turno).where(Turno.id == turno_id, Turno.barberia_id == admin.barberia_id))
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese turno.")
    return t


def _out(db, t: Turno, regla) -> dict:
    c, s = db.get(Cliente, t.cliente_id), db.get(Servicio, t.servicio_id)
    f = db.get(Fidelidad, c.id)
    cortes, disponibles = (f.cortes_acumulados, f.beneficios_disponibles) if f else (0, 0)
    return {
        "id": t.id,
        "barbero_id": t.barbero_id,
        "inicio": t.inicio,
        "fin": t.fin,
        "precio": t.precio,
        "cobrado": t.cobrado if t.cobrado is not None else t.precio,
        "estado": t.estado,
        "beneficio_aplicado": t.beneficio_aplicado,
        "origen": t.origen,
        "servicio": s.nombre,
        "cliente": {"nombre": c.nombre, "telefono": c.telefono},
        # Para el sello en la grilla: tiene el premio, o con este corte completa la tarjeta
        "tiene_premio": disponibles > 0,
        "premio": premios.premio_pendiente(db, regla, f),
        "completa_tarjeta": bool(regla) and disponibles == 0 and cortes == regla.cada_x_cortes - 1,
        "cortes": cortes,
    }


@router.get("/agenda")
def agenda(fecha: date, admin: Admin, db: DB):
    desde = datetime.combine(fecha, time(0), tzinfo=ZONA_AR)
    hasta = desde + timedelta(days=1)
    regla = _regla(db, admin.barberia_id)
    turnos = db.scalars(
        select(Turno)
        .where(
            Turno.barberia_id == admin.barberia_id,
            Turno.inicio >= desde,
            Turno.inicio < hasta,
            Turno.estado != "cancelado",
        )
        .order_by(Turno.inicio)
    ).all()
    bloqueos = db.scalars(
        select(Bloqueo).where(
            Bloqueo.barberia_id == admin.barberia_id, Bloqueo.inicio < hasta, Bloqueo.fin > desde
        )
    ).all()
    return {
        "fecha": fecha,
        "cada_x_cortes": regla.cada_x_cortes if regla else None,
        "premio": regla.descripcion if regla else None,
        "turnos": [_out(db, t, regla) for t in turnos],
        "bloqueos": [
            {
                "id": b.id,
                "barbero_id": b.barbero_id,
                "inicio": b.inicio,
                "fin": b.fin,
                "motivo": b.motivo,
            }
            for b in bloqueos
        ],
    }


class Asistencia(BaseModel):
    aplicar_premio: bool = False


@router.post("/turnos/{turno_id}/asistio")
def asistio(turno_id: UUID, datos: Asistencia, admin: Admin, db: DB):
    """Suma a la facturación y una tijera a la tarjeta. Si se aplica el premio, lo consume."""
    t = _turno(db, admin, turno_id)
    if t.estado != "reservado":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ese turno ya está marcado. Corregilo primero."
        )
    regla, f = _regla(db, admin.barberia_id), _fid(db, db.get(Cliente, t.cliente_id))
    if datos.aplicar_premio:
        if f.beneficios_disponibles < 1:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Ese cliente no tiene un premio disponible."
            )
        premios.aplicar(db, regla, f, t)
    elif regla:
        f.cortes_acumulados += 1
        if f.cortes_acumulados >= regla.cada_x_cortes:
            f.cortes_acumulados = 0
            f.beneficios_disponibles += 1
    t.estado = "asistio"
    db.commit()
    return _out(db, t, regla)


@router.post("/turnos/{turno_id}/no-asistio")
def no_asistio(turno_id: UUID, admin: Admin, db: DB):
    t = _turno(db, admin, turno_id)
    if t.estado != "reservado":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ese turno ya está marcado. Corregilo primero."
        )
    t.estado = "no_asistio"
    db.commit()
    return _out(db, t, _regla(db, admin.barberia_id))


@router.post("/turnos/{turno_id}/corregir")
def corregir(turno_id: UUID, admin: Admin, db: DB):
    """Vuelve el turno a 'reservado' deshaciendo lo que sumó a la tarjeta."""
    t = _turno(db, admin, turno_id)
    regla, f = _regla(db, admin.barberia_id), _fid(db, db.get(Cliente, t.cliente_id))
    if t.estado == "asistio":
        if t.beneficio_aplicado:
            premios.deshacer(db, f, t)
        elif regla:
            if f.cortes_acumulados > 0:
                f.cortes_acumulados -= 1
            elif f.beneficios_disponibles > 0:  # ese corte había completado la tarjeta
                f.beneficios_disponibles -= 1
                f.cortes_acumulados = regla.cada_x_cortes - 1
    t.estado = "reservado"
    db.commit()
    return _out(db, t, regla)


class TurnoManual(BaseModel):
    barbero_id: UUID
    servicio_id: UUID
    inicio: AwareDatetime
    nombre: str = Field(min_length=2, max_length=60)
    telefono: str = Field(min_length=8, max_length=24)


@router.post("/turnos", status_code=status.HTTP_201_CREATED)
def turno_a_mano(datos: TurnoManual, admin: Admin, db: DB):
    """Cliente que llamó o pasó por la puerta. Suma a su tarjeta igual que uno web."""
    bid = admin.barberia_id
    barbero = db.scalar(
        select(Barbero).where(Barbero.id == datos.barbero_id, Barbero.barberia_id == bid)
    )
    servicio = db.scalar(
        select(Servicio).where(Servicio.id == datos.servicio_id, Servicio.barberia_id == bid)
    )
    if not barbero or not servicio:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese barbero o servicio.")
    if not db.get(BarberoServicio, (barbero.id, servicio.id)):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"{barbero.nombre.split(' ')[0]} no hace {servicio.nombre}.",
        )
    tel = normalizar_telefono(datos.telefono)
    if not tel:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Revisá el teléfono: con código de área, sin 0 ni 15.",
        )
    c = db.scalar(select(Cliente).where(Cliente.barberia_id == bid, Cliente.telefono == tel))
    if not c:
        c = Cliente(barberia_id=bid, telefono=tel, nombre=datos.nombre.strip())
        db.add(c)
        db.flush()
    t = Turno(
        barberia_id=bid,
        barbero_id=barbero.id,
        cliente_id=c.id,
        servicio_id=servicio.id,
        inicio=datos.inicio,
        fin=datos.inicio + timedelta(minutes=servicio.duracion_min),
        precio=servicio.precio,
        origen="manual",
    )
    db.add(t)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ese barbero ya tiene un turno en ese horario."
        ) from None
    return _out(db, t, _regla(db, bid))
