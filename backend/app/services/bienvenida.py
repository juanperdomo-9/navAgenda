"""Ruleta de bienvenida: el cliente nuevo gira una vez y tiene 3 minutos para sacar turno.

Un teléfono gira una sola vez por barbería, saque o no el turno (queda guardado). Es "nuevo"
si nunca tuvo un turno en esa barbería. Usa los premios de la ruleta de fidelidad.
"""

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Barberia, Bienvenida, Cliente, ReglaBeneficio, Turno
from app.services import premios

MINUTOS = 3
DIAS_PARA_EL_TURNO = 7


def regla_activa(db: Session, barberia_id) -> ReglaBeneficio | None:
    return db.scalar(
        select(ReglaBeneficio).where(
            ReglaBeneficio.barberia_id == barberia_id, ReglaBeneficio.activa
        )
    )


def activa(db: Session, b: Barberia) -> bool:
    """La barbería la prendió y tiene una ruleta con premios para girar."""
    return b.ruleta_bienvenida and premios.es_ruleta(regla_activa(db, b.id))


def es_nuevo(db: Session, barberia_id, telefono: str) -> bool:
    turnos = db.scalar(
        select(func.count())
        .select_from(Turno)
        .join(Cliente, Cliente.id == Turno.cliente_id)
        .where(Cliente.barberia_id == barberia_id, Cliente.telefono == telefono)
    )
    return turnos == 0


def girar(db: Session, b: Barberia, telefono: str) -> tuple[Bienvenida, int]:
    regla = regla_activa(db, b.id)
    i = secrets.randbelow(len(regla.ruleta))
    p = regla.ruleta[i]
    g = Bienvenida(
        barberia_id=b.id,
        telefono=telefono,
        premio=p["texto"],
        descuento_pct=int(p["descuento_pct"]),
        vence_en=datetime.now(UTC) + timedelta(minutes=MINUTOS),
    )
    db.add(g)
    db.flush()
    return g, i


def vincular(db: Session, barberia_id, telefono: str, t: Turno) -> Bienvenida | None:
    """Al reservar: si giró hace menos de 3 minutos y el turno es dentro de 7 días, el premio
    queda pegado a ese turno."""
    ahora = datetime.now(UTC)
    g = db.scalar(
        select(Bienvenida).where(
            Bienvenida.barberia_id == barberia_id,
            Bienvenida.telefono == telefono,
            Bienvenida.turno_id.is_(None),
            Bienvenida.vence_en > ahora,
        )
    )
    if g and t.inicio <= ahora + timedelta(days=DIAS_PARA_EL_TURNO):
        g.turno_id = t.id
        return g
    return None


def del_turno(db: Session, t: Turno) -> Bienvenida | None:
    return db.scalar(select(Bienvenida).where(Bienvenida.turno_id == t.id))


def cobrado(precio: int, g: Bienvenida) -> int:
    return round(precio * (100 - g.descuento_pct) / 100)
