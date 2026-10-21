"""Horarios libres para reservar.

Libre = horario laboral del barbero - turnos (no cancelados) - bloqueos - duracion del servicio.
Los turnos arrancan cada 30 minutos en hora de Buenos Aires (10:00, 10:30...), alineados a la
media hora, y el servicio tiene que terminar dentro del mismo tramo de trabajo.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.tz import ZONA_AR
from app.models import Barbero, BarberoServicio, Bloqueo, HorarioBarbero, Servicio, Turno

PASO_MIN = 30


@dataclass(frozen=True)
class Libre:
    inicio: datetime  # UTC
    fin: datetime  # UTC
    barbero_id: UUID


def _local(dia: date, t: time) -> datetime:
    return datetime.combine(dia, t, tzinfo=ZONA_AR)


def horarios_libres(
    db: Session,
    barberia_id: UUID,
    servicio_id: UUID,
    dia: date,
    barbero_id: UUID | None = None,
    ahora: datetime | None = None,
) -> list[Libre]:
    """Turnos libres de `dia` (fecha en Buenos Aires) para un servicio.

    Con barbero_id=None trae los de todos los barberos que hacen el servicio ("cualquiera"),
    ordenados por hora. Nunca devuelve horarios pasados.
    """
    ahora = ahora or datetime.now(UTC)
    servicio = db.scalar(
        select(Servicio).where(
            Servicio.id == servicio_id, Servicio.barberia_id == barberia_id, Servicio.activo
        )
    )
    if not servicio:
        return []
    duracion = timedelta(minutes=servicio.duracion_min)

    q = (
        select(Barbero.id)
        .join(BarberoServicio, BarberoServicio.barbero_id == Barbero.id)
        .where(
            Barbero.barberia_id == barberia_id,
            Barbero.activo,
            BarberoServicio.servicio_id == servicio_id,
        )
    )
    if barbero_id:
        q = q.where(Barbero.id == barbero_id)
    ids = list(db.scalars(q).all())
    if not ids:
        return []

    desde_dia, hasta_dia = _local(dia, time(0)), _local(dia + timedelta(days=1), time(0))
    ocupado: dict[UUID, list[tuple[datetime, datetime]]] = {i: [] for i in ids}
    turnos = select(Turno).where(
        Turno.barbero_id.in_(ids),
        Turno.estado != "cancelado",
        Turno.inicio < hasta_dia,
        Turno.fin > desde_dia,
    )
    for t in db.scalars(turnos):
        ocupado[t.barbero_id].append((t.inicio, t.fin))
    bloqueos = select(Bloqueo).where(
        Bloqueo.barbero_id.in_(ids), Bloqueo.inicio < hasta_dia, Bloqueo.fin > desde_dia
    )
    for b in db.scalars(bloqueos):
        ocupado[b.barbero_id].append((b.inicio, b.fin))

    tramos = db.scalars(
        select(HorarioBarbero).where(
            HorarioBarbero.barbero_id.in_(ids), HorarioBarbero.dia_semana == dia.weekday()
        )
    ).all()
    libres: list[Libre] = []
    for tramo in tramos:
        fin_tramo = _local(dia, tramo.hasta)
        minutos = tramo.desde.hour * 60 + tramo.desde.minute
        inicio = _local(dia, tramo.desde) + timedelta(minutes=(-minutos) % PASO_MIN)
        while inicio + duracion <= fin_tramo:
            fin = inicio + duracion
            choca = any(a < fin and inicio < z for a, z in ocupado[tramo.barbero_id])
            if not choca and inicio > ahora:
                libres.append(Libre(inicio.astimezone(UTC), fin.astimezone(UTC), tramo.barbero_id))
            inicio += timedelta(minutes=PASO_MIN)
    libres.sort(key=lambda x: (x.inicio, str(x.barbero_id)))
    return libres
