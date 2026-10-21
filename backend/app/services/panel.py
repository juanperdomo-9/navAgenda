"""Reglas del panel de la barbería. Todas las funciones reciben el barberia_id del admin:
nada se busca ni se modifica fuera de su barbería."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Barbero, BarberoServicio, Bloqueo, HorarioBarbero, Servicio
from app.schemas.panel import BarberoOut, ServicioOut, Tramo


class NoEncontrado(Exception):
    pass


class ServicioAjeno(Exception):
    """Se pidió asignar un servicio que no es de esta barbería (o no existe)."""


# ─── Lecturas ───


def barbero_de(db: Session, barberia_id: UUID, barbero_id: UUID) -> Barbero:
    b = db.scalar(
        select(Barbero).where(Barbero.id == barbero_id, Barbero.barberia_id == barberia_id)
    )
    if not b:
        raise NoEncontrado
    return b


def servicio_de(db: Session, barberia_id: UUID, servicio_id: UUID) -> Servicio:
    s = db.scalar(
        select(Servicio).where(Servicio.id == servicio_id, Servicio.barberia_id == barberia_id)
    )
    if not s:
        raise NoEncontrado
    return s


def barbero_out(db: Session, b: Barbero) -> BarberoOut:
    horarios = db.scalars(
        select(HorarioBarbero)
        .where(HorarioBarbero.barbero_id == b.id)
        .order_by(HorarioBarbero.dia_semana, HorarioBarbero.desde)
    ).all()
    servicios = db.scalars(
        select(BarberoServicio.servicio_id).where(BarberoServicio.barbero_id == b.id)
    ).all()
    return BarberoOut(
        id=b.id,
        nombre=b.nombre,
        foto_url=b.foto_url,
        activo=b.activo,
        horarios=[Tramo.model_validate(h) for h in horarios],
        servicio_ids=list(servicios),
    )


def servicio_out(db: Session, s: Servicio) -> ServicioOut:
    barberos = db.scalars(
        select(BarberoServicio.barbero_id).where(BarberoServicio.servicio_id == s.id)
    ).all()
    return ServicioOut(
        id=s.id,
        nombre=s.nombre,
        precio=s.precio,
        duracion_min=s.duracion_min,
        activo=s.activo,
        barbero_ids=list(barberos),
    )


# ─── Barberos ───


def crear_barbero(
    db: Session, barberia_id: UUID, nombre: str, foto_url: str | None, horarios: list[Tramo]
) -> Barbero:
    """Al crear un barbero se genera todo lo suyo: horarios y asignación a todos los servicios
    activos. Su grilla, dashboard y disponibilidad salen de estos datos, sin configurar nada más."""
    b = Barbero(barberia_id=barberia_id, nombre=nombre.strip(), foto_url=foto_url)
    db.add(b)
    db.flush()
    reemplazar_horarios(db, b, horarios)
    activos = db.scalars(
        select(Servicio.id).where(Servicio.barberia_id == barberia_id, Servicio.activo)
    ).all()
    db.add_all(
        BarberoServicio(barbero_id=b.id, servicio_id=sid, barberia_id=barberia_id)
        for sid in activos
    )
    db.flush()
    return b


def reemplazar_horarios(db: Session, b: Barbero, horarios: list[Tramo]) -> None:
    db.execute(delete(HorarioBarbero).where(HorarioBarbero.barbero_id == b.id))
    db.add_all(
        HorarioBarbero(barbero_id=b.id, dia_semana=t.dia_semana, desde=t.desde, hasta=t.hasta)
        for t in horarios
    )
    db.flush()


def asignar_servicios(db: Session, b: Barbero, servicio_ids: list[UUID]) -> None:
    ids = set(servicio_ids)
    propios = set(
        db.scalars(
            select(Servicio.id).where(Servicio.barberia_id == b.barberia_id, Servicio.id.in_(ids))
        ).all()
    )
    if propios != ids:
        raise ServicioAjeno
    db.execute(delete(BarberoServicio).where(BarberoServicio.barbero_id == b.id))
    db.add_all(
        BarberoServicio(barbero_id=b.id, servicio_id=sid, barberia_id=b.barberia_id) for sid in ids
    )
    db.flush()


# ─── Servicios ───


def crear_servicio(
    db: Session, barberia_id: UUID, nombre: str, precio: int, duracion: int
) -> Servicio:
    """Un servicio nuevo lo hacen todos los barberos activos (se puede ajustar después)."""
    s = Servicio(
        barberia_id=barberia_id, nombre=nombre.strip(), precio=precio, duracion_min=duracion
    )
    db.add(s)
    db.flush()
    activos = db.scalars(
        select(Barbero.id).where(Barbero.barberia_id == barberia_id, Barbero.activo)
    ).all()
    db.add_all(
        BarberoServicio(barbero_id=bid, servicio_id=s.id, barberia_id=barberia_id)
        for bid in activos
    )
    db.flush()
    return s


# ─── Bloqueos ───


def bloqueo_de(db: Session, barberia_id: UUID, bloqueo_id: UUID) -> Bloqueo:
    bl = db.scalar(
        select(Bloqueo).where(Bloqueo.id == bloqueo_id, Bloqueo.barberia_id == barberia_id)
    )
    if not bl:
        raise NoEncontrado
    return bl
