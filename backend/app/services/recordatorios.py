"""Recordatorio por mail al cliente, el día anterior desde las 20:00 (hora de Buenos Aires).

Lo corre el hilo de fondo de la API cada 15 minutos: manda los turnos reservados de mañana
de clientes que dejaron su mail y todavía no tienen recordatorio. Cada turno, una sola vez.
"""

import hashlib
import secrets
from datetime import UTC, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.tz import ZONA_AR
from app.models import Cliente, Turno
from app.services import avisos

HORA = 20


def pendientes(db: Session, ahora: datetime | None = None) -> list[Turno]:
    ahora = (ahora or datetime.now(UTC)).astimezone(ZONA_AR)
    if ahora.hour < HORA:
        return []
    desde = datetime.combine(ahora.date() + timedelta(days=1), time(0), tzinfo=ZONA_AR)
    return list(
        db.scalars(
            select(Turno)
            .join(Cliente, Cliente.id == Turno.cliente_id)
            .where(
                Turno.estado == "reservado",
                Turno.recordado_en.is_(None),
                Turno.inicio >= desde,
                Turno.inicio < desde + timedelta(days=1),
                Cliente.email.is_not(None),
            )
        )
    )


def mandar_pendientes(db: Session, ahora: datetime | None = None) -> int:
    n = 0
    for t in pendientes(db, ahora):
        token = secrets.token_urlsafe(18)
        aviso = avisos.recordatorio(db, t, token)
        t.recordado_en = datetime.now(UTC)
        t.token_recordatorio_hash = hashlib.sha256(token.encode()).hexdigest()
        db.commit()  # se marca antes de mandar: nunca dos recordatorios del mismo turno
        avisos.mandar(aviso)
        n += 1
    return n
