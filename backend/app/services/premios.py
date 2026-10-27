"""Premios de la tarjeta de cortes: fijo o ruleta (todos los premios con la misma chance).

La ruleta la gira el cliente desde su ticket; lo que sale queda guardado (Giro) y se usa al
marcar "asistió" con el premio. Si llega al turno sin haber girado, se gira en ese momento.
"""

import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Fidelidad, Giro, ReglaBeneficio, Turno


def es_ruleta(regla: ReglaBeneficio | None) -> bool:
    return bool(regla and regla.modo == "ruleta" and len(regla.ruleta) >= 2)


def giros_sin_usar(db: Session, cliente_id) -> list[Giro]:
    return list(
        db.scalars(
            select(Giro)
            .where(Giro.cliente_id == cliente_id, Giro.usado_en.is_(None))
            .order_by(Giro.creado_en)
        )
    )


def puede_girar(db: Session, regla, fid: Fidelidad | None) -> bool:
    """Tiene un premio ganado que todavía no giró."""
    if not es_ruleta(regla) or not fid:
        return False
    return fid.beneficios_disponibles > len(giros_sin_usar(db, fid.cliente_id))


def girar(db: Session, regla: ReglaBeneficio, fid: Fidelidad) -> tuple[Giro, int]:
    """Premio al azar (criptográfico, misma chance para todos). Devuelve el giro y su índice."""
    i = secrets.randbelow(len(regla.ruleta))
    p = regla.ruleta[i]
    g = Giro(
        barberia_id=fid.barberia_id,
        cliente_id=fid.cliente_id,
        premio=p["texto"],
        descuento_pct=int(p["descuento_pct"]),
    )
    db.add(g)
    db.flush()
    return g, i


def cobrado_fijo(precio: int, regla: ReglaBeneficio | None) -> int:
    """Lo que se cobra con el premio fijo aplicado."""
    if not regla or regla.tipo == "servicio_gratis":
        return 0
    if regla.tipo == "descuento_pct":
        return round(precio * (100 - (regla.valor or 0)) / 100)
    if regla.tipo == "descuento_monto":
        return max(0, precio - (regla.valor or 0))
    return precio


def aplicar(db: Session, regla, fid: Fidelidad, t: Turno) -> str:
    """Aplica un premio al turno (descuenta lo cobrado). Devuelve el texto del premio."""
    t.beneficio_aplicado = True
    fid.beneficios_disponibles -= 1
    if not es_ruleta(regla):
        t.cobrado = cobrado_fijo(t.precio, regla)
        return regla.descripcion if regla else "Premio"
    pend = giros_sin_usar(db, fid.cliente_id)
    g = pend[0] if pend else girar(db, regla, fid)[0]
    g.usado_en, g.turno_id = datetime.now(UTC), t.id
    t.cobrado = round(t.precio * (100 - g.descuento_pct) / 100)
    return g.premio


def deshacer(db: Session, fid: Fidelidad, t: Turno) -> None:
    """Corregir un turno con premio aplicado: el premio (y su giro) vuelven a estar disponibles."""
    t.beneficio_aplicado = False
    t.cobrado = None
    fid.beneficios_disponibles += 1
    g = db.scalar(select(Giro).where(Giro.turno_id == t.id))
    if g:
        g.usado_en, g.turno_id = None, None


def premio_pendiente(db: Session, regla, fid: Fidelidad | None) -> str | None:
    """Texto del premio que tiene disponible (para la grilla y el ticket)."""
    if not fid or fid.beneficios_disponibles < 1:
        return None
    if not es_ruleta(regla):
        return regla.descripcion if regla else "Premio"
    pend = giros_sin_usar(db, fid.cliente_id)
    return pend[0].premio if pend else "Ruleta sin girar"
